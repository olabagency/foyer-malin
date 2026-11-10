"""Liste « Foyer Malin tâches » : les tâches de la famille dans les listes de Home Assistant.

C'est une vraie liste Home Assistant (todo.foyer_malin_taches), visible dans
l'onglet « À faire » et utilisable dans les automatisations (todo.add_item…).
Cocher une tâche ici compte comme dans le panneau : une tâche qui se répète
passe à sa prochaine date.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback

if TYPE_CHECKING:
    from . import FoyerConfigEntry
    from .store import FoyerStore


async def async_setup_entry(
    hass: HomeAssistant, entry: FoyerConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([FamilyTaskList(entry)])


def _due(item: TodoItem) -> str | None:
    if isinstance(item.due, datetime):
        return item.due.date().isoformat()
    if isinstance(item.due, date):
        return item.due.isoformat()
    return None


class FamilyTaskList(TodoListEntity):
    """Les tâches de la famille, stockées avec les données de Foyer Malin."""

    _attr_name = "Foyer Malin tâches"
    _attr_icon = "mdi:checkbox-marked-circle-outline"
    _attr_should_poll = False
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.SET_DUE_DATE_ON_ITEM
        | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
    )

    def __init__(self, entry: FoyerConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_tasks"
        self._attr_suggested_object_id = "foyer_malin_taches"

    @property
    def _store(self) -> FoyerStore:
        return self._entry.runtime_data.store

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._store.add_listener(self._refresh))
        self._refresh_items()

    @callback
    def _refresh(self) -> None:
        self._refresh_items()
        self.async_write_ha_state()

    @callback
    def _refresh_items(self) -> None:
        tasks = sorted(self._store.tasks.values(), key=lambda t: (t["done"], t["due"] or "9999", t["created_at"]))
        self._attr_todo_items = [
            TodoItem(
                uid=task["id"],
                summary=task["title"],
                status=TodoItemStatus.COMPLETED if task["done"] else TodoItemStatus.NEEDS_ACTION,
                due=date.fromisoformat(task["due"]) if task["due"] else None,
                description=task["notes"] or None,
            )
            for task in tasks
        ]

    async def async_create_todo_item(self, item: TodoItem) -> None:
        try:
            task = self._store.save_task({"title": item.summary, "due": _due(item), "notes": item.description})
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err
        if item.status == TodoItemStatus.COMPLETED:
            self._store.complete_task(task["id"])

    async def async_update_todo_item(self, item: TodoItem) -> None:
        task = self._store.tasks.get(item.uid or "")
        if task is None:
            raise HomeAssistantError(f"Tâche introuvable : {item.uid}")
        # Home Assistant renvoie la tâche complète : un champ vide veut dire « effacé ».
        try:
            self._store.save_task(
                {
                    "id": task["id"],
                    "title": item.summary or task["title"],
                    "due": _due(item),
                    "notes": item.description or "",
                }
            )
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err
        if item.status == TodoItemStatus.COMPLETED and not task["done"]:
            self._store.complete_task(task["id"])
        elif item.status == TodoItemStatus.NEEDS_ACTION and task["done"]:
            self._store.reopen_task(task["id"])

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        for uid in uids:
            self._store.delete_task(uid)
