"""Capteurs de Foyer Malin : les tâches du jour et le prochain événement.

Utilisés par la carte de tableau de bord, et disponibles pour vos automatisations
(par exemple une annonce vocale « Il reste 3 tâches aujourd'hui » à 18 h).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import PANEL_URL_PATH

if TYPE_CHECKING:
    from . import FoyerConfigEntry
    from .store import FoyerStore

DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def day_label(day: date, today: date) -> str:
    delta = (day - today).days
    if delta == 0:
        return "Aujourd'hui"
    if delta == 1:
        return "Demain"
    if 1 < delta < 7:
        return DAYS[day.weekday()].capitalize()
    return f"{DAYS[day.weekday()].capitalize()} {day.day}/{day.month}"


def _names(store: FoyerStore, member_ids: list[str]) -> list[str]:
    return [store.members[m]["name"] for m in member_ids if m in store.members]


def next_event(store: FoyerStore, now: datetime) -> dict[str, Any] | None:
    """Événement en cours ou prochain événement, dans les 60 jours."""
    current = now.replace(tzinfo=None)
    for occ in store.event_occurrences(now.date() - timedelta(days=1), now.date() + timedelta(days=60)):
        if occ["all_day"]:
            over = date.fromisoformat(occ["end"]) < now.date()
        else:
            over = datetime.fromisoformat(occ["end"]) <= current
        if not over:
            return occ
    return None


async def async_setup_entry(
    hass: HomeAssistant, entry: FoyerConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([TasksTodaySensor(entry), NextEventSensor(entry)])


class _FoyerSensor(SensorEntity):
    _attr_should_poll = False

    def __init__(self, entry: FoyerConfigEntry) -> None:
        self._entry = entry

    @property
    def _store(self) -> FoyerStore:
        return self._entry.runtime_data.store

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._store.add_listener(self._refresh))
        self.async_on_remove(
            async_track_time_interval(self.hass, lambda _now: self._refresh(), timedelta(minutes=10))
        )
        self._update()

    @callback
    def _refresh(self) -> None:
        self._update()
        self.async_write_ha_state()

    def _update(self) -> None:
        raise NotImplementedError


class TasksTodaySensor(_FoyerSensor):
    """Nombre de tâches à faire aujourd'hui, retards compris."""

    _attr_icon = "mdi:checkbox-marked-circle-outline"
    _attr_name = "Foyer Malin tâches du jour"
    _attr_native_unit_of_measurement = "tâches"

    def __init__(self, entry: FoyerConfigEntry) -> None:
        super().__init__(entry)
        self._attr_unique_id = f"{entry.entry_id}_tasks_today"
        self._attr_suggested_object_id = "foyer_malin_taches_du_jour"

    @callback
    def _update(self) -> None:
        today = dt_util.now().date()
        tasks = self._store.open_tasks(until=today)
        self._attr_native_value = len(tasks)
        self._attr_extra_state_attributes = {
            "overdue": sum(1 for t in tasks if t["due"] < today.isoformat()),
            "tasks": [
                {
                    "id": t["id"],
                    "title": t["title"],
                    "due": t["due"],
                    "time": t["time"],
                    "list": self._store.lists[t["list_id"]]["name"] if t["list_id"] in self._store.lists else None,
                    "overdue": t["due"] < today.isoformat(),
                    "assignees": _names(self._store, t["assignees"]),
                }
                for t in tasks[:20]
            ],
            "url": f"/{PANEL_URL_PATH}?tab=tasks",
        }


class NextEventSensor(_FoyerSensor):
    """Titre du prochain événement de l'agenda."""

    _attr_icon = "mdi:calendar-star"
    _attr_name = "Foyer Malin prochain événement"

    def __init__(self, entry: FoyerConfigEntry) -> None:
        super().__init__(entry)
        self._attr_unique_id = f"{entry.entry_id}_next_event"
        self._attr_suggested_object_id = "foyer_malin_prochain_evenement"

    @callback
    def _update(self) -> None:
        now = dt_util.now()
        occ = next_event(self._store, now)
        url = f"/{PANEL_URL_PATH}?tab=agenda"
        if occ is None:
            self._attr_native_value = "Rien de prévu"
            self._attr_extra_state_attributes = {"planned": False, "url": url}
            return
        day = date.fromisoformat(occ["start"][:10])
        self._attr_native_value = occ["title"][:255]
        self._attr_extra_state_attributes = {
            "planned": True,
            # Un événement de plusieurs jours déjà commencé est « en cours ».
            "label": "En cours" if day < now.date() else day_label(day, now.date()),
            "start": occ["start"],
            "end": occ["end"],
            "all_day": occ["all_day"],
            "time": None if occ["all_day"] else occ["start"][11:16],
            "members": _names(self._store, occ["members"]),
            "location": occ["location"],
            "event_id": occ["id"],
            "url": url,
        }
