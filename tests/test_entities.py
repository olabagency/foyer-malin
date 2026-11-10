"""Entités Home Assistant : liste de tâches, capteurs, calendrier, rappel."""

from datetime import timedelta

from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.foyer_malin.reminder import TaskReminder

TODO = "todo.foyer_malin_taches"


async def test_todo_list_follows_the_store(hass, entry, store):
    await hass.services.async_call(
        "todo", "add_item", {"item": "Appeler le plombier", "due_date": "2026-11-20"}, target={"entity_id": TODO}, blocking=True
    )
    task = next(iter(store.tasks.values()))
    assert (task["title"], task["due"]) == ("Appeler le plombier", "2026-11-20")
    assert hass.states.get(TODO).state == "1"

    await hass.services.async_call(
        "todo", "update_item", {"item": task["id"], "status": "completed"}, target={"entity_id": TODO}, blocking=True
    )
    assert store.tasks[task["id"]]["done"] is True
    assert hass.states.get(TODO).state == "0"
    # La date est conservée quand on ne change que l'état.
    assert store.tasks[task["id"]]["due"] == "2026-11-20"

    await hass.services.async_call(
        "todo", "update_item", {"item": task["id"], "status": "needs_action"}, target={"entity_id": TODO}, blocking=True
    )
    assert store.tasks[task["id"]]["done"] is False

    await hass.services.async_call("todo", "remove_item", {"item": task["id"]}, target={"entity_id": TODO}, blocking=True)
    assert store.tasks == {}


async def test_sensors(hass, entry, store):
    today = dt_util.now().date()
    lea = store.save_member({"name": "Léa"})
    store.save_task({"title": "En retard", "due": (today - timedelta(days=2)).isoformat(), "assignees": [lea["id"]]})
    store.save_task({"title": "Demain", "due": (today + timedelta(days=1)).isoformat()})
    start = (dt_util.now() + timedelta(days=1)).replace(tzinfo=None).isoformat(timespec="minutes")
    store.save_event({"title": "Dentiste", "start": start, "members": [lea["id"]], "location": "Cabinet"})
    await hass.async_block_till_done()

    tasks = hass.states.get("sensor.foyer_malin_taches_du_jour")
    assert tasks.state == "1"
    assert tasks.attributes["overdue"] == 1
    assert tasks.attributes["tasks"][0]["assignees"] == ["Léa"]

    event = hass.states.get("sensor.foyer_malin_prochain_evenement")
    assert event.state == "Dentiste"
    assert event.attributes["label"] == "Demain"
    assert event.attributes["members"] == ["Léa"]

    calendar = hass.states.get("calendar.foyer_malin_agenda")
    assert calendar.attributes["message"] == "Dentiste"
    assert calendar.attributes["location"] == "Cabinet"


async def test_calendar_lists_events(hass, entry, store, hass_client):
    store.save_event({"title": "Piscine", "start": "2026-11-11T17:00", "recurrence": {"freq": "weekly"}})
    store.save_event({"title": "Vacances", "start": "2026-11-13", "end": "2026-11-15", "all_day": True})
    client = await hass_client()
    response = await client.get(
        "/api/calendars/calendar.foyer_malin_agenda?start=2026-11-09T00:00:00Z&end=2026-11-23T00:00:00Z"
    )
    events = await response.json()
    found = sorted((e["summary"], e["start"].get("date") or e["start"]["dateTime"][:16]) for e in events)
    assert found == [("Piscine", "2026-11-11T17:00"), ("Piscine", "2026-11-18T17:00"), ("Vacances", "2026-11-13")]
    trip = next(e for e in events if e["summary"] == "Vacances")
    # Fin exclusive pour Home Assistant : le lendemain du dernier jour.
    assert trip["end"]["date"] == "2026-11-16"


async def test_reminder_reaches_the_right_phones(hass, entry, store):
    today = dt_util.now().date().isoformat()
    lea = store.save_member({"name": "Léa", "person": "person.lea"})
    tom = store.save_member({"name": "Tom", "role": "child", "person": "person.tom"})
    store.save_task({"title": "Poubelles", "due": today, "assignees": [lea["id"]]})
    store.save_task({"title": "Courrier", "due": "2020-01-01"})
    store.save_task({"title": "Plus tard", "due": "2099-01-01", "assignees": [tom["id"]]})

    from homeassistant.helpers import device_registry as dr, entity_registry as er  # noqa: PLC0415

    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("mobile_app", "lea")}, name="iPhone de Léa"
    )
    tracker = er.async_get(hass).async_get_or_create("device_tracker", "mobile_app", "lea", device_id=device.id)
    hass.states.async_set("person.lea", "home", {"device_trackers": [tracker.entity_id]})
    hass.states.async_set("person.tom", "home", {"device_trackers": []})
    calls = async_mock_service(hass, "notify", "mobile_app_iphone_de_lea")

    assert await TaskReminder(hass, entry.runtime_data).async_send() == 1
    assert calls[0].data["title"] == "✅ 2 tâches pour aujourd'hui"
    # Sa tâche, plus celle de personne (elle est adulte) ; rien pour Tom, qui n'a rien aujourd'hui.
    assert calls[0].data["message"] == "Courrier, Poubelles (1 en retard)"
    assert calls[0].data["data"]["url"] == f"/foyer-malin?tab=tasks&member={lea['id']}"
