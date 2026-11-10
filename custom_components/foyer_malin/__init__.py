"""Foyer Malin : les tâches, l'agenda et les listes de toute la famille."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom, persistent_notification
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import (
    CHANGELOG_URL,
    DOMAIN,
    PANEL_COMPONENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    SIDEBAR_TITLE,
    STATIC_URL,
    VERSION,
)
from .reminder import TaskReminder
from .store import FoyerStore
from .websocket_api import async_register_websocket_api

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
UPDATE_NOTIFICATION_ID = f"{DOMAIN}_update"
PLATFORMS = [Platform.CALENDAR, Platform.SENSOR, Platform.TODO]
CARD_URL = f"{STATIC_URL}/foyer-malin-card.js?v={VERSION}"


@dataclass
class FoyerData:
    """Objets partagés pendant que l'intégration tourne."""

    entry: ConfigEntry
    store: FoyerStore


type FoyerConfigEntry = ConfigEntry[FoyerData]


async def async_setup_entry(hass: HomeAssistant, entry: FoyerConfigEntry) -> bool:
    store = FoyerStore(hass)
    await store.async_load()

    entry.runtime_data = FoyerData(entry=entry, store=store)
    hass.data[DOMAIN] = entry.runtime_data

    domain_flags = hass.data.setdefault(f"{DOMAIN}_flags", set())
    if "static" not in domain_flags:
        # Un chemin statique ne peut pas être retiré : on ne l'enregistre qu'une fois.
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        async_register_websocket_api(hass)
        domain_flags.add("static")

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title=SIDEBAR_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{STATIC_URL}/foyer-malin-panel.js?v={VERSION}",
        embed_iframe=False,
        require_admin=False,
        config={},
    )

    # Carte de tableau de bord « Aujourd'hui en famille », proposée dans le sélecteur de cartes.
    frontend.add_extra_js_url(hass, CARD_URL)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    reminder = TaskReminder(hass, entry.runtime_data)
    entry.async_on_unload(reminder.async_start())

    _announce_update(hass, store)
    return True


def _announce_update(hass: HomeAssistant, store: FoyerStore) -> None:
    """Prévient dans HA quand une nouvelle version vient d'être installée."""
    previous = store.last_version
    if previous == VERSION:
        return
    if previous is not None:
        _LOGGER.info("Foyer Malin mis à jour de %s vers %s", previous, VERSION)
        persistent_notification.async_create(
            hass,
            f"Foyer Malin est passé de la version {previous} à la version **{VERSION}**.\n\n"
            f"[Voir les nouveautés]({CHANGELOG_URL})\n\n"
            "Si l'écran de Foyer Malin semble inchangé sur votre téléphone, fermez puis rouvrez l'app.",
            title=f"{PANEL_TITLE} mis à jour",
            notification_id=UPDATE_NOTIFICATION_ID,
        )
    store.set_last_version(VERSION)


async def async_migrate_entry(hass: HomeAssistant, entry: FoyerConfigEntry) -> bool:
    """Adapte la configuration créée par une ancienne version.

    Pour une future évolution des réglages : augmenter VERSION ou MINOR_VERSION
    dans config_flow.py et ajouter ici l'étape correspondante.
    """
    # Configuration créée par une version plus récente : on ne sait pas la lire.
    return entry.version <= 1


async def async_unload_entry(hass: HomeAssistant, entry: FoyerConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    frontend.remove_extra_js_url(hass, CARD_URL)
    hass.data.pop(DOMAIN, None)
    return True
