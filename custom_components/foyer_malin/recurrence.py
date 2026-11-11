"""Répétitions : jours, semaines (jours choisis, cycles), mois, années.

Fonctions pures (sans Home Assistant), partagées par les tâches et les événements.

Une répétition se décrit ainsi :
- freq : none, daily, weekly, monthly ou yearly ;
- interval : « tous les N » jours, semaines, mois ou ans ;
- weekdays (semaines) : jours de la semaine concernés, 0 = lundi (vide : le jour de la date de départ) ;
- weeks (semaines, interval > 1) : semaines actives du cycle, 0 = la semaine de la date de départ.
  « Une semaine sur deux » : interval 2, weeks [0]. « Deux semaines sur trois » : interval 3, weeks [0, 1] ;
- month_mode (mois) : day (le 15), nth_weekday (le 2e mardi), last_weekday (le dernier mardi) ou last_day ;
- until : dernière date possible.

La date de départ (anchor) est toujours la première occurrence.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Any

from .const import FREQUENCIES, MONTH_MODES

# Garde-fou : nombre maximal d'occurrences calculées pour une période.
MAX_OCCURRENCES = 800


def _ints(value: Any, low: int, high: int) -> list[int]:
    found: set[int] = set()
    for item in value if isinstance(value, (list, tuple)) else []:
        try:
            number = int(item)
        except (TypeError, ValueError):
            continue
        if low <= number <= high:
            found.add(number)
    return sorted(found)


def normalize_recurrence(raw: Any) -> dict[str, Any]:
    """Nettoie une répétition reçue de l'interface."""
    raw = raw if isinstance(raw, dict) else {}
    freq = raw.get("freq") if raw.get("freq") in FREQUENCIES else "none"
    try:
        interval = max(1, min(int(raw.get("interval") or 1), 99))
    except (TypeError, ValueError):
        interval = 1
    until = None
    if raw.get("until"):
        try:
            until = date.fromisoformat(str(raw["until"])[:10]).isoformat()
        except ValueError:
            until = None
    weekly = freq == "weekly"
    weeks = _ints(raw.get("weeks"), 0, interval - 1) if weekly and interval > 1 else []
    return {
        "freq": freq,
        "interval": interval,
        "until": until if freq != "none" else None,
        "weekdays": _ints(raw.get("weekdays"), 0, 6) if weekly else [],
        "weeks": weeks or [0],
        "month_mode": raw.get("month_mode") if freq == "monthly" and raw.get("month_mode") in MONTH_MODES else "day",
    }


def _add_months(anchor: date, months: int) -> date:
    """Même jour du mois, ramené au dernier jour quand le mois est plus court (31 → 30, 29 févr. → 28)."""
    index = anchor.year * 12 + anchor.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(anchor.day, monthrange(year, month)[1]))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    last = date(year, month, monthrange(year, month)[1])
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _month_date(year: int, month: int, anchor: date, mode: str) -> date:
    """Le jour visé dans un mois donné, selon le mode de répétition mensuelle."""
    if mode == "last_day":
        return date(year, month, monthrange(year, month)[1])
    if mode == "last_weekday":
        return _last_weekday(year, month, anchor.weekday())
    if mode == "nth_weekday":
        first = date(year, month, 1)
        found = first + timedelta(days=(anchor.weekday() - first.weekday()) % 7 + 7 * ((anchor.day - 1) // 7))
        # Pas de 5e mardi ce mois-ci : le dernier.
        return found if found.month == month else _last_weekday(year, month, anchor.weekday())
    return date(year, month, min(anchor.day, monthrange(year, month)[1]))


def occurrences_between(anchor: date, recurrence: dict[str, Any], start: date, end: date) -> list[date]:
    """Occurrences comprises entre deux dates (incluses), dans l'ordre. La date de départ en fait toujours partie."""
    freq = recurrence.get("freq", "none")
    if freq == "none":
        return [anchor] if start <= anchor <= end else []
    until = date.fromisoformat(recurrence["until"]) if recurrence.get("until") else None
    last = min(end, until) if until else end
    first = max(start, anchor)
    if first > last:
        return []
    interval = max(1, int(recurrence.get("interval") or 1))
    found: list[date] = []
    try:
        if freq == "daily":
            index = -(-(first - anchor).days // interval)
            day = anchor + timedelta(days=index * interval)
            while day <= last and len(found) < MAX_OCCURRENCES:
                found.append(day)
                day += timedelta(days=interval)
        elif freq == "weekly":
            weekdays = sorted(recurrence.get("weekdays") or [anchor.weekday()])
            weeks = set(recurrence.get("weeks") or [0])
            anchor_monday = anchor - timedelta(days=anchor.weekday())
            week = max(0, (first - anchor_monday).days // 7)
            while len(found) < MAX_OCCURRENCES:
                monday = anchor_monday + timedelta(weeks=week)
                if monday > last:
                    break
                if week % interval in weeks:
                    found.extend(d for d in (monday + timedelta(days=w) for w in weekdays) if first <= d <= last)
                week += 1
        elif freq == "monthly":
            mode = recurrence.get("month_mode", "day")
            base = anchor.year * 12 + anchor.month - 1
            step = max(0, ((first.year * 12 + first.month - 1) - base) // interval - 1)
            while len(found) < MAX_OCCURRENCES:
                year, month = divmod(base + step * interval, 12)
                day = _month_date(year, month + 1, anchor, mode)
                if day > last:
                    break
                if day >= first:
                    found.append(day)
                step += 1
        elif freq == "yearly":
            step = max(0, (first.year - anchor.year) // interval - 1)
            while len(found) < MAX_OCCURRENCES:
                day = _add_months(anchor, 12 * interval * step)
                if day > last:
                    break
                if day >= first:
                    found.append(day)
                step += 1
    except (OverflowError, ValueError):
        pass
    # La date de départ est la première occurrence, même si elle tombe hors du motif (ex. un mardi pour « lun. et jeu. »).
    if first == anchor and anchor not in found:
        found.append(anchor)
    return sorted(found)


def upcoming(anchor: date, recurrence: dict[str, Any], count: int) -> list[date]:
    """Les `count` premières dates de la répétition, date de départ comprise."""
    horizon = 400
    while True:
        try:
            end = anchor + timedelta(days=horizon)
        except OverflowError:
            end = date.max
        found = occurrences_between(anchor, recurrence, anchor, end)
        if len(found) >= count or horizon >= 40000 or end == date.max:
            return found[:count]
        horizon *= 10


def next_after(anchor: date, recurrence: dict[str, Any], after: date) -> date | None:
    """Première occurrence strictement après une date, ou None si la répétition est finie."""
    if recurrence.get("freq", "none") == "none":
        return None
    horizon = 400
    while horizon <= 40000 * 10:
        try:
            found = occurrences_between(anchor, recurrence, after + timedelta(days=1), after + timedelta(days=horizon))
        except OverflowError:
            return None
        if found:
            return found[0]
        horizon *= 10
    return None
