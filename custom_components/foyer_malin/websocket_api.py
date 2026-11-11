"""Commandes websocket utilisées par l'interface du panneau."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from functools import wraps
from typing import TYPE_CHECKING, Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN, FREQUENCIES, LIST_COLORS, MEMBER_COLORS, MONTH_MODES, VERSION
from .recurrence import normalize_recurrence, upcoming
from .reminder import TaskReminder

if TYPE_CHECKING:
    from . import FoyerData

type Handler = Callable[[HomeAssistant, websocket_api.ActiveConnection, dict[str, Any]], None]

ID = vol.All(str, vol.Length(min=1, max=64))
RECURRENCE = vol.Schema(
    {
        vol.Optional("freq"): vol.In(FREQUENCIES),
        vol.Optional("interval"): vol.All(vol.Coerce(int), vol.Range(min=1, max=99)),
        vol.Optional("until"): vol.Any(None, str),
        vol.Optional("weekdays"): [vol.All(vol.Coerce(int), vol.Range(min=0, max=6))],
        vol.Optional("weeks"): [vol.All(vol.Coerce(int), vol.Range(min=0, max=98))],
        vol.Optional("month_mode"): vol.In(MONTH_MODES),
    }
)
# Période maximale demandée par l'agenda en une fois.
MAX_RANGE_DAYS = 400


def _data(hass: HomeAssistant) -> FoyerData:
    data = hass.data.get(DOMAIN)
    if data is None:
        raise HomeAssistantError("Foyer Malin n'est pas configuré")
    return data


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as err:
        raise vol.Invalid("Date invalide") from err


def _guarded(func: Handler) -> Handler:
    """Transforme les erreurs de saisie et les éléments introuvables en réponses lisibles."""

    @wraps(func)
    def wrapper(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
        try:
            func(hass, connection, msg)
        except KeyError:
            connection.send_error(msg["id"], "not_found", "Cet élément n'existe plus")
        except (ValueError, vol.Invalid) as err:
            connection.send_error(msg["id"], "invalid_format", str(err))

    return wrapper


def _me(hass: HomeAssistant, data: FoyerData, user_id: str) -> str | None:
    """Membre du foyer qui correspond à l'utilisateur connecté (via sa personne Home Assistant)."""
    for member in data.store.members.values():
        state = hass.states.get(member["person"]) if member.get("person") else None
        if state is not None and state.attributes.get("user_id") == user_id:
            return member["id"]
    return None


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    for command in (
        ws_config,
        ws_subscribe,
        ws_events_range,
        ws_recurrence_preview,
        ws_members_save,
        ws_members_delete,
        ws_tasks_save,
        ws_tasks_complete,
        ws_tasks_reopen,
        ws_tasks_delete,
        ws_tasks_clear_done,
        ws_events_save,
        ws_events_delete,
        ws_lists_save,
        ws_lists_delete,
        ws_settings_save,
        ws_reminder_test,
    ):
        websocket_api.async_register_command(hass, command)


# ---------------------------------------------------------------------- démarrage


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/config"})
@callback
def ws_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    data = _data(hass)
    connection.send_result(
        msg["id"],
        {
            "version": VERSION,
            "is_admin": connection.user.is_admin,
            "me": _me(hass, data, connection.user.id),
            "colors": MEMBER_COLORS,
            "list_colors": LIST_COLORS,
            # Personnes de Home Assistant, pour relier un membre à son téléphone.
            "persons": [
                {"entity_id": state.entity_id, "name": state.name}
                for state in sorted(hass.states.async_all("person"), key=lambda s: s.name.lower())
            ],
        },
    )


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Envoie toutes les données du foyer, puis de nouveau à chaque modification.

    Un changement fait sur un téléphone apparaît ainsi aussitôt sur les autres.
    """
    store = _data(hass).store

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], store.snapshot()))

    connection.subscriptions[msg["id"]] = store.add_listener(forward)
    connection.send_result(msg["id"])
    forward()


# ---------------------------------------------------------------------- membres


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/members/save",
        vol.Required("member"): vol.Schema(
            {
                vol.Optional("id"): vol.Any(None, ID),
                vol.Required("name"): str,
                vol.Optional("emoji"): str,
                vol.Optional("color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
                vol.Optional("role"): vol.In(["adult", "child"]),
                vol.Optional("person"): vol.Any(None, str),
            }
        ),
    }
)
@callback
@_guarded
def ws_members_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"member": _data(hass).store.save_member(msg["member"])})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/members/delete", vol.Required("member_id"): ID})
@callback
def ws_members_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    _data(hass).store.delete_member(msg["member_id"])
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------- tâches


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/tasks/save",
        vol.Required("task"): vol.Schema(
            {
                vol.Optional("id"): vol.Any(None, ID),
                vol.Required("title"): str,
                vol.Optional("notes"): str,
                vol.Optional("assignees"): [ID],
                vol.Optional("due"): vol.Any(None, str),
                vol.Optional("time"): vol.Any(None, vol.Match(r"^\d{1,2}:\d{2}$")),
                vol.Optional("list_id"): vol.Any(None, ID),
                vol.Optional("recurrence"): RECURRENCE,
                vol.Optional("rotate"): bool,
                vol.Optional("points"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
            }
        ),
    }
)
@callback
@_guarded
def ws_tasks_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"task": _data(hass).store.save_task(msg["task"])})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/tasks/complete",
        vol.Required("task_id"): ID,
        vol.Optional("member_id"): vol.Any(None, ID),
    }
)
@callback
@_guarded
def ws_tasks_complete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    data = _data(hass)
    # Sans précision, les points vont à la personne connectée si la tâche est à elle ou à personne.
    member_id = msg.get("member_id")
    task = data.store.tasks[msg["task_id"]]
    me = _me(hass, data, connection.user.id)
    if member_id is None and me is not None and (not task["assignees"] or me in task["assignees"]):
        member_id = me
    connection.send_result(msg["id"], {"task": data.store.complete_task(msg["task_id"], member_id)})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/tasks/reopen", vol.Required("task_id"): ID})
@callback
@_guarded
def ws_tasks_reopen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"task": _data(hass).store.reopen_task(msg["task_id"])})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/tasks/delete", vol.Required("task_id"): ID})
@callback
def ws_tasks_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    _data(hass).store.delete_task(msg["task_id"])
    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {vol.Required("type"): "foyer_malin/tasks/clear_done", vol.Optional("list_id"): vol.Any(None, ID)}
)
@callback
def ws_tasks_clear_done(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    removed = _data(hass).store.clear_done_tasks(msg.get("list_id"))
    connection.send_result(msg["id"], {"removed": removed})


# ---------------------------------------------------------------------- agenda


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/events/range",
        vol.Required("start"): str,
        vol.Required("end"): str,
    }
)
@callback
@_guarded
def ws_events_range(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Événements d'une période, répétitions dépliées."""
    start, end = _parse_date(msg["start"]), _parse_date(msg["end"])
    if end < start or (end - start).days > MAX_RANGE_DAYS:
        raise vol.Invalid("Période invalide")
    connection.send_result(msg["id"], {"events": _data(hass).store.event_occurrences(start, end)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/recurrence/preview",
        vol.Required("start"): str,
        vol.Required("recurrence"): RECURRENCE,
        vol.Optional("count", default=6): vol.All(int, vol.Range(min=1, max=24)),
    }
)
@callback
@_guarded
def ws_recurrence_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Les prochaines dates d'une répétition, pour les montrer pendant qu'on la règle."""
    dates = upcoming(_parse_date(msg["start"][:10]), normalize_recurrence(msg["recurrence"]), msg["count"])
    connection.send_result(msg["id"], {"dates": [d.isoformat() for d in dates]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/events/save",
        vol.Required("event"): vol.Schema(
            {
                vol.Optional("id"): vol.Any(None, ID),
                vol.Required("title"): str,
                vol.Required("start"): str,
                vol.Optional("end"): vol.Any(None, str),
                vol.Optional("all_day"): bool,
                vol.Optional("members"): [ID],
                vol.Optional("location"): str,
                vol.Optional("notes"): str,
                vol.Optional("recurrence"): RECURRENCE,
            }
        ),
    }
)
@callback
@_guarded
def ws_events_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"event": _data(hass).store.save_event(msg["event"])})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/events/delete", vol.Required("event_id"): ID})
@callback
def ws_events_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    _data(hass).store.delete_event(msg["event_id"])
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------- listes


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/lists/save",
        vol.Required("list"): vol.Schema(
            {
                vol.Optional("id"): vol.Any(None, ID),
                vol.Required("name"): str,
                vol.Optional("emoji"): str,
                vol.Optional("color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
            }
        ),
    }
)
@callback
@_guarded
def ws_lists_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"list": _data(hass).store.save_list(msg["list"])})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/lists/delete", vol.Required("list_id"): ID})
@callback
def ws_lists_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    _data(hass).store.delete_list(msg["list_id"])
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------- réglages


@websocket_api.websocket_command(
    {
        vol.Required("type"): "foyer_malin/settings/save",
        vol.Required("settings"): vol.Schema(
            {
                vol.Optional("reminder"): bool,
                vol.Optional("reminder_time"): vol.Match(r"^\d{1,2}:\d{2}$"),
                vol.Optional("points"): bool,
            }
        ),
    }
)
@callback
def ws_settings_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"settings": _data(hass).store.save_settings(msg["settings"])})


@websocket_api.websocket_command({vol.Required("type"): "foyer_malin/reminder/test"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_reminder_test(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Envoie tout de suite le rappel des tâches, pour vérifier que les téléphones le reçoivent."""
    sent = await TaskReminder(hass, _data(hass)).async_send()
    connection.send_result(msg["id"], {"sent": sent})
