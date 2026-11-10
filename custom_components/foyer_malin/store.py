"""Stockage local du foyer : membres, tâches, agenda et listes."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta
from typing import Any
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_SETTINGS,
    HISTORY_LIMIT,
    MEMBER_COLORS,
    STORAGE_KEY,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
)
from .recurrence import next_after, normalize_recurrence, occurrences_between


def _text(value: Any, limit: int = 200) -> str:
    return str(value or "").strip()[:limit]


def _date(value: Any) -> str | None:
    """Date « AAAA-MM-JJ » valide, sinon None."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10]).isoformat()
    except ValueError:
        return None


def _time(value: Any, default: str) -> str:
    try:
        hour, minute = (int(x) for x in str(value).split(":")[:2])
    except (TypeError, ValueError):
        return default
    if not (0 <= hour < 24 and 0 <= minute < 60):
        return default
    return f"{hour:02d}:{minute:02d}"


def normalize_settings(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    return {
        "reminder": bool(raw.get("reminder", DEFAULT_SETTINGS["reminder"])),
        "reminder_time": _time(raw.get("reminder_time"), DEFAULT_SETTINGS["reminder_time"]),
        "points": bool(raw.get("points", DEFAULT_SETTINGS["points"])),
    }


class _MigratingStore(Store[dict[str, Any]]):
    """Met à jour les données enregistrées par une ancienne version de Foyer Malin."""

    async def _async_migrate_func(
        self, old_major_version: int, old_minor_version: int, old_data: dict[str, Any]
    ) -> dict[str, Any]:
        if old_major_version > STORAGE_VERSION:
            raise NotImplementedError("Données créées par une version plus récente de Foyer Malin")
        # Les futures migrations s'ajoutent ici, une par version mineure du stockage.
        return dict(old_data)


class FoyerStore:
    """Données persistantes dans .storage/foyer_malin.data."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = _MigratingStore(hass, STORAGE_VERSION, STORAGE_KEY, minor_version=STORAGE_MINOR_VERSION)
        self.members: dict[str, dict[str, Any]] = {}
        self.tasks: dict[str, dict[str, Any]] = {}
        self.events: dict[str, dict[str, Any]] = {}
        self.lists: dict[str, dict[str, Any]] = {}
        # Tâches terminées (qui, quand, combien de points), de la plus ancienne à la plus récente.
        self.history: list[dict[str, Any]] = []
        self.settings: dict[str, Any] = normalize_settings(None)
        # Dernière version de l'intégration qui a ouvert ces données (pour annoncer les mises à jour).
        self.last_version: str | None = None
        self._listeners: list[Callable[[], None]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.members = {m["id"]: m for m in data.get("members", [])}
        self.tasks = {t["id"]: t for t in data.get("tasks", [])}
        self.events = {e["id"]: e for e in data.get("events", [])}
        self.lists = {l["id"]: l for l in data.get("lists", [])}
        self.history = data.get("history", [])
        self.settings = normalize_settings(data.get("settings"))
        self.last_version = data.get("last_version")

    def _data(self) -> dict[str, Any]:
        return {
            "last_version": self.last_version,
            "members": list(self.members.values()),
            "tasks": list(self.tasks.values()),
            "events": list(self.events.values()),
            "lists": list(self.lists.values()),
            "history": self.history,
            "settings": self.settings,
        }

    def _save(self) -> None:
        self._store.async_delay_save(self._data, 1)
        for listener in list(self._listeners):
            listener()

    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Appelé à chaque modification. Renvoie de quoi se désabonner."""
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener) if listener in self._listeners else None

    def set_last_version(self, version: str) -> None:
        self.last_version = version
        self._save()

    def snapshot(self) -> dict[str, Any]:
        """Tout ce que le panneau affiche, en un seul envoi."""
        today = dt_util.now().date()
        return {
            "members": list(self.members.values()),
            "tasks": list(self.tasks.values()),
            "events": list(self.events.values()),
            "lists": list(self.lists.values()),
            "settings": self.settings,
            "scores": self.scores(today - timedelta(days=today.weekday())),
            "today": today.isoformat(),
        }

    def _known_members(self, value: Any) -> list[str]:
        seen: list[str] = []
        for member_id in value or []:
            if member_id in self.members and member_id not in seen:
                seen.append(member_id)
        return seen

    # ------------------------------------------------------------------ réglages

    def save_settings(self, raw: dict[str, Any]) -> dict[str, Any]:
        self.settings = normalize_settings({**self.settings, **(raw or {})})
        self._save()
        return self.settings

    # ------------------------------------------------------------------ membres

    def save_member(self, raw: dict[str, Any]) -> dict[str, Any]:
        name = _text(raw.get("name"), 40)
        if not name:
            raise ValueError("Le prénom est obligatoire")
        member_id = raw.get("id") if raw.get("id") in self.members else uuid4().hex
        existing = self.members.get(member_id, {})
        color = raw.get("color") or existing.get("color") or MEMBER_COLORS[len(self.members) % len(MEMBER_COLORS)]
        person = _text(raw.get("person"), 100)
        member = {
            "id": member_id,
            "name": name,
            "emoji": _text(raw.get("emoji"), 8) or existing.get("emoji") or "🙂",
            "color": _text(color, 9),
            "role": "child" if raw.get("role") == "child" else "adult",
            # Personne de Home Assistant reliée, pour envoyer les rappels sur son téléphone.
            "person": person if person.startswith("person.") else None,
        }
        self.members[member_id] = member
        self._save()
        return member

    def delete_member(self, member_id: str) -> None:
        if self.members.pop(member_id, None) is None:
            return
        for task in self.tasks.values():
            task["assignees"] = [m for m in task["assignees"] if m != member_id]
        for event in self.events.values():
            event["members"] = [m for m in event["members"] if m != member_id]
        self._save()

    # ------------------------------------------------------------------ tâches

    def save_task(self, raw: dict[str, Any]) -> dict[str, Any]:
        title = _text(raw.get("title"))
        if not title:
            raise ValueError("Le titre est obligatoire")
        task_id = raw.get("id") if raw.get("id") in self.tasks else uuid4().hex
        existing = self.tasks.get(task_id, {})
        recurrence = normalize_recurrence(raw.get("recurrence", existing.get("recurrence")))
        due = _date(raw["due"]) if "due" in raw else existing.get("due")
        if recurrence["freq"] != "none" and not due:
            # Une tâche qui se répète a besoin d'un point de départ.
            due = dt_util.now().date().isoformat()
        try:
            points = max(0, min(int(raw.get("points", existing.get("points", 1))), 100))
        except (TypeError, ValueError):
            points = 1
        assignees = self._known_members(raw["assignees"]) if "assignees" in raw else existing.get("assignees", [])
        task = {
            "id": task_id,
            "title": title,
            "notes": _text(raw.get("notes", existing.get("notes")), 1000),
            "assignees": assignees,
            "due": due,
            # Date d'origine de la répétition : « le 31 du mois » reste le 31 après un mois de 30 jours.
            "anchor": due if due != existing.get("due") or not existing.get("anchor") else existing["anchor"],
            "recurrence": recurrence,
            # À tour de rôle : la tâche passe au membre suivant à chaque fois qu'elle est faite.
            "rotate": bool(raw.get("rotate", existing.get("rotate", False))) and len(assignees) > 1,
            "points": points,
            "done": bool(existing.get("done", False)),
            "done_at": existing.get("done_at"),
            "done_by": existing.get("done_by"),
            "created_at": existing.get("created_at") or dt_util.utcnow().isoformat(),
        }
        self.tasks[task_id] = task
        self._save()
        return task

    def complete_task(self, task_id: str, member_id: str | None = None) -> dict[str, Any]:
        """Termine une tâche. Une tâche qui se répète passe à sa prochaine date."""
        task = self.tasks[task_id]
        if task["done"]:
            return task
        if member_id not in self.members:
            member_id = task["assignees"][0] if task["assignees"] else None
        now = dt_util.utcnow().isoformat()
        self.history.append(
            {
                "id": uuid4().hex,
                "task_id": task_id,
                "title": task["title"],
                "member_id": member_id,
                "points": task["points"],
                "at": now,
            }
        )
        del self.history[:-HISTORY_LIMIT]

        following = None
        if task["recurrence"]["freq"] != "none" and task["due"]:
            today = dt_util.now().date()
            anchor = date.fromisoformat(task.get("anchor") or task["due"])
            following = next_after(anchor, task["recurrence"], max(today, date.fromisoformat(task["due"])))
        if following is not None:
            task["due"] = following.isoformat()
            if task["rotate"] and len(task["assignees"]) > 1:
                task["assignees"] = [*task["assignees"][1:], task["assignees"][0]]
        else:
            task.update(done=True, done_at=now, done_by=member_id)
        self._save()
        return task

    def reopen_task(self, task_id: str) -> dict[str, Any]:
        """Remet à faire une tâche cochée par erreur, et retire les points gagnés."""
        task = self.tasks[task_id]
        if task["done"]:
            task.update(done=False, done_at=None, done_by=None)
            for index in range(len(self.history) - 1, -1, -1):
                if self.history[index]["task_id"] == task_id:
                    del self.history[index]
                    break
            self._save()
        return task

    def delete_task(self, task_id: str) -> None:
        if self.tasks.pop(task_id, None) is not None:
            self._save()

    def clear_done_tasks(self) -> int:
        done = [t["id"] for t in self.tasks.values() if t["done"]]
        for task_id in done:
            self.tasks.pop(task_id)
        if done:
            self._save()
        return len(done)

    def open_tasks(self, until: date | None = None, member_id: str | None = None) -> list[dict[str, Any]]:
        """Tâches à faire, les plus urgentes d'abord. `until` garde celles dues au plus tard ce jour-là."""
        tasks = [t for t in self.tasks.values() if not t["done"]]
        if until is not None:
            tasks = [t for t in tasks if t["due"] and t["due"] <= until.isoformat()]
        if member_id is not None:
            tasks = [t for t in tasks if not t["assignees"] or member_id in t["assignees"]]
        return sorted(tasks, key=lambda t: (t["due"] or "9999", t["created_at"]))

    def scores(self, since: date) -> dict[str, dict[str, int]]:
        """Points et nombre de tâches terminées par membre depuis une date."""
        start = dt_util.start_of_local_day(since)
        totals: dict[str, dict[str, int]] = {m: {"points": 0, "count": 0} for m in self.members}
        for entry in self.history:
            member_id = entry.get("member_id")
            done_at = dt_util.parse_datetime(entry["at"])
            if member_id in totals and done_at is not None and done_at >= start:
                totals[member_id]["points"] += entry.get("points", 0)
                totals[member_id]["count"] += 1
        return totals

    # ------------------------------------------------------------------ agenda

    def save_event(self, raw: dict[str, Any]) -> dict[str, Any]:
        title = _text(raw.get("title"))
        if not title:
            raise ValueError("Le titre est obligatoire")
        event_id = raw.get("id") if raw.get("id") in self.events else uuid4().hex
        existing = self.events.get(event_id, {})
        all_day = bool(raw.get("all_day", existing.get("all_day", False)))
        try:
            start = datetime.fromisoformat(str(raw.get("start") or existing.get("start")))
        except ValueError as err:
            raise ValueError("La date de début est invalide") from err
        try:
            end = datetime.fromisoformat(str(raw.get("end") or ""))
        except ValueError:
            end = start
        if all_day:
            # Journée entière : la fin est le dernier jour, inclus.
            start = datetime(start.year, start.month, start.day)
            end = max(start, datetime(end.year, end.month, end.day))
            start_text, end_text = start.date().isoformat(), end.date().isoformat()
        else:
            start, end = start.replace(tzinfo=None), end.replace(tzinfo=None)
            if end <= start:
                end = start + timedelta(hours=1)
            start_text, end_text = start.isoformat(timespec="minutes"), end.isoformat(timespec="minutes")
        event = {
            "id": event_id,
            "title": title,
            "all_day": all_day,
            # Heure locale du foyer, sans fuseau : « 2026-11-14T18:30 », ou « 2026-11-14 » pour une journée entière.
            "start": start_text,
            "end": end_text,
            "members": self._known_members(raw["members"]) if "members" in raw else existing.get("members", []),
            "location": _text(raw.get("location", existing.get("location"))),
            "notes": _text(raw.get("notes", existing.get("notes")), 1000),
            "recurrence": normalize_recurrence(raw.get("recurrence", existing.get("recurrence"))),
            "created_at": existing.get("created_at") or dt_util.utcnow().isoformat(),
        }
        self.events[event_id] = event
        self._save()
        return event

    def delete_event(self, event_id: str) -> None:
        if self.events.pop(event_id, None) is not None:
            self._save()

    def event_occurrences(self, start: date, end: date) -> list[dict[str, Any]]:
        """Événements entre deux dates (incluses), répétitions dépliées, dans l'ordre.

        Chaque occurrence reprend l'événement avec ses propres `start` et `end`.
        """
        found: list[dict[str, Any]] = []
        for event in self.events.values():
            first_start = datetime.fromisoformat(event["start"])
            first_end = datetime.fromisoformat(event["end"])
            span = first_end.date() - first_start.date()
            anchor = first_start.date()
            # Un événement de plusieurs jours commencé avant la période peut encore la recouvrir.
            for day in occurrences_between(anchor, event["recurrence"], start - span, end):
                shift = day - anchor
                occ_start, occ_end = first_start + shift, first_end + shift
                if event["all_day"]:
                    texts = (occ_start.date().isoformat(), occ_end.date().isoformat())
                else:
                    texts = (occ_start.isoformat(timespec="minutes"), occ_end.isoformat(timespec="minutes"))
                found.append({**event, "start": texts[0], "end": texts[1], "first_start": event["start"]})
        return sorted(found, key=lambda e: (e["start"][:10], not e["all_day"], e["start"], e["title"]))

    # ------------------------------------------------------------------ listes

    def save_list(self, raw: dict[str, Any]) -> dict[str, Any]:
        name = _text(raw.get("name"), 60)
        if not name:
            raise ValueError("Le nom de la liste est obligatoire")
        list_id = raw.get("id") if raw.get("id") in self.lists else uuid4().hex
        existing = self.lists.get(list_id, {})
        entry = {
            "id": list_id,
            "name": name,
            "emoji": _text(raw.get("emoji"), 8) or existing.get("emoji") or "📝",
            "items": existing.get("items", []),
        }
        self.lists[list_id] = entry
        self._save()
        return entry

    def delete_list(self, list_id: str) -> None:
        if self.lists.pop(list_id, None) is not None:
            self._save()

    def add_list_items(self, list_id: str, texts: list[str]) -> dict[str, Any]:
        entry = self.lists[list_id]
        for text in texts:
            text = _text(text)
            if text:
                entry["items"].append({"id": uuid4().hex, "text": text, "done": False})
        del entry["items"][500:]
        self._save()
        return entry

    def update_list_item(self, list_id: str, item_id: str, **changes: Any) -> dict[str, Any]:
        entry = self.lists[list_id]
        for item in entry["items"]:
            if item["id"] == item_id:
                if changes.get("done") is not None:
                    item["done"] = bool(changes["done"])
                if changes.get("text"):
                    item["text"] = _text(changes["text"])
                break
        else:
            raise KeyError(item_id)
        self._save()
        return entry

    def delete_list_items(self, list_id: str, item_ids: list[str] | None = None) -> dict[str, Any]:
        """Retire des éléments ; sans identifiants, retire tous ceux qui sont cochés."""
        entry = self.lists[list_id]
        if item_ids is None:
            entry["items"] = [i for i in entry["items"] if not i["done"]]
        else:
            entry["items"] = [i for i in entry["items"] if i["id"] not in set(item_ids)]
        self._save()
        return entry
