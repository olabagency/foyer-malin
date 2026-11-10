"""Calendrier « Foyer Malin agenda » : les événements de la famille dans le calendrier de Home Assistant.

Utilisable dans les automatisations : déclencheur « Calendrier », décalage « -30 min »…
Les événements se créent et se modifient dans le panneau Foyer Malin.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from . import FoyerConfigEntry
    from .store import FoyerStore


def family_events(store: FoyerStore, start: date, end: date) -> list[CalendarEvent]:
    """Événements de l'agenda entre deux dates (incluses)."""
    tz = dt_util.get_default_time_zone()
    events: list[CalendarEvent] = []
    for occ in store.event_occurrences(start, end):
        names = [store.members[m]["name"] for m in occ["members"] if m in store.members]
        details = [", ".join(names)] if names else []
        if occ["notes"]:
            details.append(occ["notes"])
        if occ["all_day"]:
            # Pour Home Assistant, la fin d'une journée entière est le lendemain du dernier jour.
            begin: date | datetime = date.fromisoformat(occ["start"])
            finish: date | datetime = date.fromisoformat(occ["end"]) + timedelta(days=1)
        else:
            begin = datetime.fromisoformat(occ["start"]).replace(tzinfo=tz)
            finish = datetime.fromisoformat(occ["end"]).replace(tzinfo=tz)
        events.append(
            CalendarEvent(
                start=begin,
                end=finish,
                summary=occ["title"],
                description="\n".join(details) or None,
                location=occ["location"] or None,
                uid=f"{occ['id']}_{occ['start']}",
            )
        )
    return events


async def async_setup_entry(
    hass: HomeAssistant, entry: FoyerConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([FamilyCalendar(entry)])


class FamilyCalendar(CalendarEntity):
    """L'agenda de la famille."""

    _attr_icon = "mdi:calendar-heart"
    _attr_should_poll = False
    _attr_name = "Foyer Malin agenda"

    def __init__(self, entry: FoyerConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_calendar"
        self._attr_suggested_object_id = "foyer_malin_agenda"
        self._event: CalendarEvent | None = None

    @property
    def event(self) -> CalendarEvent | None:
        """Événement en cours, sinon le prochain."""
        return self._event

    async def async_added_to_hass(self) -> None:
        store = self._entry.runtime_data.store
        self.async_on_remove(store.add_listener(self._refresh))
        self.async_on_remove(
            async_track_time_interval(self.hass, lambda _now: self._refresh(), timedelta(minutes=5))
        )
        self._update()

    @callback
    def _refresh(self) -> None:
        self._update()
        self.async_write_ha_state()

    @callback
    def _update(self) -> None:
        now = dt_util.now()
        store = self._entry.runtime_data.store
        events = family_events(store, now.date() - timedelta(days=1), now.date() + timedelta(days=60))
        upcoming = [e for e in events if e.end_datetime_local > now]
        upcoming.sort(key=lambda e: e.start_datetime_local)
        self._event = upcoming[0] if upcoming else None

    async def async_get_events(
        self, hass: HomeAssistant, start_date: datetime, end_date: datetime
    ) -> list[CalendarEvent]:
        store = self._entry.runtime_data.store
        events = family_events(store, start_date.date() - timedelta(days=1), end_date.date())
        return [e for e in events if e.end_datetime_local > start_date and e.start_datetime_local < end_date]
