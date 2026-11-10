"""Règles du foyer : tâches, points, agenda, listes."""

from datetime import date, timedelta

import pytest

from homeassistant.util import dt as dt_util


def today() -> date:
    return dt_util.now().date()


def test_task_needs_a_title(store):
    with pytest.raises(ValueError):
        store.save_task({"title": "   "})


def test_complete_and_reopen_gives_and_removes_points(store):
    lea = store.save_member({"name": "Léa"})
    task = store.save_task({"title": "Sortir les poubelles", "assignees": [lea["id"]], "points": 3})
    store.complete_task(task["id"])
    monday = today() - timedelta(days=today().weekday())
    assert store.tasks[task["id"]]["done"] is True
    assert store.tasks[task["id"]]["done_by"] == lea["id"]
    assert store.scores(monday)[lea["id"]] == {"points": 3, "count": 1}

    # Terminer deux fois ne compte qu'une fois.
    store.complete_task(task["id"])
    assert store.scores(monday)[lea["id"]]["count"] == 1

    store.reopen_task(task["id"])
    assert store.tasks[task["id"]]["done"] is False
    assert store.scores(monday)[lea["id"]] == {"points": 0, "count": 0}


def test_recurring_task_moves_to_next_date_and_rotates(store):
    lea = store.save_member({"name": "Léa"})
    tom = store.save_member({"name": "Tom"})
    late = (today() - timedelta(days=10)).isoformat()
    task = store.save_task(
        {
            "title": "Vider le lave-vaisselle",
            "assignees": [lea["id"], tom["id"]],
            "due": late,
            "recurrence": {"freq": "daily"},
            "rotate": True,
        }
    )
    done = store.complete_task(task["id"])
    # En retard de dix jours : la suivante est demain, pas dix tâches à rattraper.
    assert done["done"] is False
    assert done["due"] == (today() + timedelta(days=1)).isoformat()
    assert done["assignees"] == [tom["id"], lea["id"]]
    # Les points vont à celle dont c'était le tour.
    assert store.history[-1]["member_id"] == lea["id"]


def test_recurring_task_without_date_starts_today(store):
    task = store.save_task({"title": "Arroser", "recurrence": {"freq": "weekly"}})
    assert task["due"] == today().isoformat()


def test_recurring_task_ends_after_until(store):
    task = store.save_task(
        {"title": "Médicament", "due": today().isoformat(), "recurrence": {"freq": "daily", "until": today().isoformat()}}
    )
    assert store.complete_task(task["id"])["done"] is True


def test_editing_a_task_keeps_what_is_not_sent(store):
    lea = store.save_member({"name": "Léa"})
    task = store.save_task({"title": "Linge", "assignees": [lea["id"]], "due": "2026-11-20", "notes": "30°"})
    edited = store.save_task({"id": task["id"], "title": "Linge blanc"})
    assert (edited["assignees"], edited["due"], edited["notes"]) == ([lea["id"]], "2026-11-20", "30°")
    # Envoyer « due: None » retire la date.
    assert store.save_task({"id": task["id"], "title": "Linge blanc", "due": None})["due"] is None


def test_deleting_a_member_unassigns(store):
    lea = store.save_member({"name": "Léa"})
    task = store.save_task({"title": "Linge", "assignees": [lea["id"], "inconnu"]})
    event = store.save_event({"title": "Danse", "start": "2026-11-14T17:00", "members": [lea["id"]]})
    assert task["assignees"] == [lea["id"]]
    store.delete_member(lea["id"])
    assert store.tasks[task["id"]]["assignees"] == []
    assert store.events[event["id"]]["members"] == []


def test_open_tasks_filters(store):
    lea = store.save_member({"name": "Léa"})
    tom = store.save_member({"name": "Tom"})
    store.save_task({"title": "Plus tard", "due": "2099-01-01"})
    store.save_task({"title": "Sans date"})
    store.save_task({"title": "Retard Tom", "due": "2020-01-01", "assignees": [tom["id"]]})
    store.save_task({"title": "Aujourd'hui", "due": today().isoformat()})
    assert [t["title"] for t in store.open_tasks(until=today())] == ["Retard Tom", "Aujourd'hui"]
    # Les tâches de personne concernent tout le monde.
    assert [t["title"] for t in store.open_tasks(until=today(), member_id=lea["id"])] == ["Aujourd'hui"]


def test_event_defaults_and_occurrences(store):
    timed = store.save_event({"title": "Piscine", "start": "2026-11-11T17:00", "recurrence": {"freq": "weekly"}})
    assert timed["end"] == "2026-11-11T18:00"
    trip = store.save_event({"title": "Vacances", "start": "2026-11-13", "end": "2026-11-16", "all_day": True})
    assert (trip["start"], trip["end"]) == ("2026-11-13", "2026-11-16")

    week = store.event_occurrences(date(2026, 11, 16), date(2026, 11, 22))
    # Les vacances commencées avant la période la recouvrent encore ; la piscine se répète.
    assert [(e["title"], e["start"]) for e in week] == [("Vacances", "2026-11-13"), ("Piscine", "2026-11-18T17:00")]
    assert week[1]["first_start"] == "2026-11-11T17:00"

    with pytest.raises(ValueError):
        store.save_event({"title": "Sans date", "start": "bientôt"})


def test_lists(store):
    bag = store.save_list({"name": "Valise", "emoji": "🧳"})
    entry = store.add_list_items(bag["id"], ["Maillot", "  ", "Crème solaire"])
    assert [i["text"] for i in entry["items"]] == ["Maillot", "Crème solaire"]
    first = entry["items"][0]["id"]
    store.update_list_item(bag["id"], first, done=True)
    with pytest.raises(KeyError):
        store.update_list_item(bag["id"], "inconnu", done=True)
    # Renommer la liste garde son contenu.
    assert len(store.save_list({"id": bag["id"], "name": "Valise d'été"})["items"]) == 2
    assert [i["text"] for i in store.delete_list_items(bag["id"])["items"]] == ["Crème solaire"]


async def test_data_survives_a_restart(hass, entry, store):
    store.save_member({"name": "Léa"})
    store.save_task({"title": "Linge"})
    await hass.config_entries.async_unload(entry.entry_id)
    await store._store.async_save(store._data())
    assert await hass.config_entries.async_setup(entry.entry_id)
    reloaded = entry.runtime_data.store
    assert reloaded is not store
    assert [m["name"] for m in reloaded.members.values()] == ["Léa"]
    assert [t["title"] for t in reloaded.tasks.values()] == ["Linge"]
