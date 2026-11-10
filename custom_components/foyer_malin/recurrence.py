"""Répétitions : tous les jours, toutes les semaines, tous les mois, tous les ans.

Fonctions pures (sans Home Assistant), partagées par les tâches et les événements.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Any

from .const import FREQUENCIES

# Garde-fou : nombre maximal d'occurrences calculées pour une période.
MAX_OCCURRENCES = 800


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
    return {"freq": freq, "interval": interval, "until": until if freq != "none" else None}


def _add_months(anchor: date, months: int) -> date:
    """Même jour du mois, ramené au dernier jour quand le mois est plus court (31 → 30, 29 févr. → 28)."""
    index = anchor.year * 12 + anchor.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(anchor.day, monthrange(year, month)[1]))


def occurrence(anchor: date, recurrence: dict[str, Any], index: int) -> date:
    """Date de la n-ième occurrence (0 = la première), calculée depuis la date d'origine."""
    step = index * recurrence.get("interval", 1)
    freq = recurrence.get("freq")
    if freq == "daily":
        return anchor + timedelta(days=step)
    if freq == "weekly":
        return anchor + timedelta(weeks=step)
    if freq == "monthly":
        return _add_months(anchor, step)
    if freq == "yearly":
        return _add_months(anchor, step * 12)
    return anchor


def next_after(anchor: date, recurrence: dict[str, Any], after: date) -> date | None:
    """Première occurrence strictement après une date, ou None si la répétition est finie."""
    if recurrence.get("freq", "none") == "none":
        return None
    until = date.fromisoformat(recurrence["until"]) if recurrence.get("until") else None
    for index in range(MAX_OCCURRENCES * 10):
        day = occurrence(anchor, recurrence, index)
        if until and day > until:
            return None
        if day > after:
            return day
    return None


def occurrences_between(anchor: date, recurrence: dict[str, Any], start: date, end: date) -> list[date]:
    """Occurrences comprises entre deux dates (incluses)."""
    if recurrence.get("freq", "none") == "none":
        return [anchor] if start <= anchor <= end else []
    until = date.fromisoformat(recurrence["until"]) if recurrence.get("until") else None
    last = min(end, until) if until else end
    found: list[date] = []
    index = 0
    # On saute directement près du début de la période pour les répétitions anciennes.
    if anchor < start and recurrence["freq"] in ("daily", "weekly"):
        days = recurrence.get("interval", 1) * (7 if recurrence["freq"] == "weekly" else 1)
        index = max(0, (start - anchor).days // days)
    while len(found) < MAX_OCCURRENCES:
        day = occurrence(anchor, recurrence, index)
        if day > last:
            break
        if day >= start:
            found.append(day)
        index += 1
    return found
