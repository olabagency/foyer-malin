"""Rappel quotidien des tâches du jour.

À l'heure choisie dans les réglages, chaque membre relié à une personne de
Home Assistant reçoit sur son téléphone (application Home Assistant) la liste
des tâches qui l'attendent encore aujourd'hui, retards compris.
"""

from __future__ import annotations

from collections.abc import Callable
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util, slugify

from .const import DOMAIN, PANEL_URL_PATH

if TYPE_CHECKING:
    from . import FoyerData

_LOGGER = logging.getLogger(__name__)


def notify_services_for_person(hass: HomeAssistant, person_id: str) -> list[str]:
    """Services notify.mobile_app_* des téléphones rattachés à une personne."""
    state = hass.states.get(person_id)
    if state is None:
        return []
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    services: list[str] = []
    for tracker in state.attributes.get("device_trackers") or []:
        entry = ent_reg.async_get(tracker)
        if entry is None or entry.platform != "mobile_app" or entry.device_id is None:
            continue
        device = dev_reg.async_get(entry.device_id)
        if device is None:
            continue
        for name in (device.name_by_user, device.name):
            if not name:
                continue
            service = f"mobile_app_{slugify(name)}"
            if hass.services.has_service("notify", service) and service not in services:
                services.append(service)
                break
    return services


def reminder_payload(member: dict[str, Any], tasks: list[dict[str, Any]], today: str) -> dict[str, Any]:
    """Notification envoyée à un membre pour ses tâches du jour."""
    late = sum(1 for t in tasks if t["due"] < today)
    titles = [t["title"] for t in tasks[:4]]
    more = len(tasks) - len(titles)
    message = ", ".join(titles) + (f" et {more} autre{'s' if more > 1 else ''}" if more > 0 else "")
    if late:
        message += f" ({late} en retard)"
    url = f"/{PANEL_URL_PATH}?tab=tasks&member={member['id']}"
    return {
        "title": f"✅ {len(tasks)} tâche{'s' if len(tasks) > 1 else ''} pour aujourd'hui",
        "message": message,
        "data": {
            "url": url,  # iOS
            "clickAction": url,  # Android
            "tag": f"{DOMAIN}_tasks",
            "group": DOMAIN,
        },
    }


class TaskReminder:
    """Envoie le rappel quotidien, à l'heure des réglages."""

    def __init__(self, hass: HomeAssistant, data: FoyerData) -> None:
        self.hass = hass
        self.data = data
        self._time: str | None = None
        self._unsub_time: Callable[[], None] | None = None
        self._unsub_store: Callable[[], None] | None = None

    @callback
    def async_start(self) -> Callable[[], None]:
        # L'heure peut changer dans les réglages : on reprogramme à chaque modification.
        self._unsub_store = self.data.store.add_listener(self._schedule)
        self._schedule()
        return self.async_stop

    @callback
    def async_stop(self) -> None:
        for unsub in (self._unsub_time, self._unsub_store):
            if unsub:
                unsub()
        self._unsub_time = self._unsub_store = None

    @callback
    def _schedule(self) -> None:
        wanted = self.data.store.settings["reminder_time"]
        if wanted == self._time:
            return
        if self._unsub_time:
            self._unsub_time()
        self._time = wanted
        hour, minute = (int(x) for x in wanted.split(":"))
        self._unsub_time = async_track_time_change(
            self.hass, self._handle, hour=hour, minute=minute, second=0
        )

    @callback
    def _handle(self, _now: Any) -> None:
        if self.data.store.settings["reminder"]:
            self.hass.async_create_task(self.async_send())

    async def async_send(self) -> int:
        """Envoie les rappels. Renvoie le nombre de notifications parties."""
        store = self.data.store
        today = dt_util.now().date()
        sent = 0
        for member in list(store.members.values()):
            if not member.get("person"):
                continue
            # Ses tâches, plus celles qui ne sont attribuées à personne s'il est adulte.
            tasks = [
                t
                for t in store.open_tasks(until=today)
                if member["id"] in t["assignees"] or (not t["assignees"] and member["role"] == "adult")
            ]
            if not tasks:
                continue
            services = notify_services_for_person(self.hass, member["person"])
            if not services:
                _LOGGER.info(
                    "Rappel des tâches : aucun téléphone avec l'app Home Assistant trouvé pour %s", member["person"]
                )
                continue
            payload = reminder_payload(member, tasks, today.isoformat())
            for service in services:
                try:
                    await self.hass.services.async_call("notify", service, payload, blocking=True)
                    sent += 1
                except HomeAssistantError as err:
                    _LOGGER.warning("Rappel des tâches : échec de l'envoi via notify.%s : %s", service, err)
        return sent
