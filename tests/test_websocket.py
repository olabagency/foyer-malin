"""Commandes websocket du panneau."""

from homeassistant.util import dt as dt_util


async def call(client, type_, **payload):
    await client.send_json_auto_id({"type": f"foyer_malin/{type_}", **payload})
    return await client.receive_json()


async def test_subscribe_pushes_every_change(hass, entry, hass_ws_client):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "foyer_malin/subscribe"})
    assert (await client.receive_json())["success"]
    first = (await client.receive_json())["event"]
    assert first["members"] == [] and first["today"] == dt_util.now().date().isoformat()

    other = await hass_ws_client(hass)
    saved = await call(other, "members/save", member={"name": "Léa", "color": "#30a46c"})
    assert saved["success"]
    pushed = (await client.receive_json())["event"]
    assert [m["name"] for m in pushed["members"]] == ["Léa"]
    assert pushed["scores"] == {saved["result"]["member"]["id"]: {"points": 0, "count": 0}}


async def test_task_flow(hass, entry, store, hass_ws_client, hass_admin_user):
    client = await hass_ws_client(hass)
    lea = (await call(client, "members/save", member={"name": "Léa", "person": "person.lea"}))["result"]["member"]
    hass.states.async_set("person.lea", "home", {"user_id": hass_admin_user.id})
    config = (await call(client, "config"))["result"]
    assert config["me"] == lea["id"]
    assert config["persons"] == [{"entity_id": "person.lea", "name": "lea"}]

    task = (await call(client, "tasks/save", task={"title": "Linge", "points": 2}))["result"]["task"]
    done = (await call(client, "tasks/complete", task_id=task["id"]))["result"]["task"]
    # Tâche de personne, cochée par Léa : c'est elle qui gagne les points.
    assert done["done_by"] == lea["id"]
    assert (await call(client, "tasks/reopen", task_id=task["id"]))["result"]["task"]["done"] is False
    assert (await call(client, "tasks/complete", task_id=task["id"]))["success"]
    assert (await call(client, "tasks/clear_done"))["result"] == {"removed": 1}


async def test_errors_are_readable(hass, entry, hass_ws_client):
    client = await hass_ws_client(hass)
    empty = await call(client, "tasks/save", task={"title": " "})
    assert empty["error"] == {"code": "invalid_format", "message": "Le titre est obligatoire"}
    missing = await call(client, "tasks/complete", task_id="inconnu")
    assert missing["error"]["code"] == "not_found"
    assert (await call(client, "lists/items/add", list_id="inconnu", texts=["x"]))["error"]["code"] == "not_found"
    assert (await call(client, "events/range", start="2026-11-20", end="2026-11-01"))["error"]["code"] == "invalid_format"
    assert not (await call(client, "members/save", member={"name": "Léa", "color": "rouge"}))["success"]


async def test_events_lists_and_settings(hass, entry, hass_ws_client):
    client = await hass_ws_client(hass)
    event = (
        await call(client, "events/save", event={"title": "Piscine", "start": "2026-11-11T17:00", "recurrence": {"freq": "weekly"}})
    )["result"]["event"]
    found = (await call(client, "events/range", start="2026-11-16", end="2026-11-22"))["result"]["events"]
    assert [(e["id"], e["start"]) for e in found] == [(event["id"], "2026-11-18T17:00")]
    await call(client, "events/delete", event_id=event["id"])
    assert (await call(client, "events/range", start="2026-11-16", end="2026-11-22"))["result"]["events"] == []

    bag = (await call(client, "lists/save", list={"name": "Valise"}))["result"]["list"]
    items = (await call(client, "lists/items/add", list_id=bag["id"], texts=["Maillot", "Tongs"]))["result"]["list"]["items"]
    await call(client, "lists/items/update", list_id=bag["id"], item_id=items[0]["id"], done=True)
    left = (await call(client, "lists/items/delete", list_id=bag["id"]))["result"]["list"]["items"]
    assert [i["text"] for i in left] == ["Tongs"]

    settings = (await call(client, "settings/save", settings={"reminder_time": "7:05"}))["result"]["settings"]
    assert settings == {"reminder": True, "reminder_time": "07:05", "points": True}
    assert (await call(client, "reminder/test"))["result"] == {"sent": 0}
