from custom_components.foyer_malin.const import DOMAIN, PANEL_URL_PATH


async def test_setup_and_unload(hass, entry):
    assert hass.states.get("calendar.foyer_malin_agenda") is not None
    assert hass.states.get("todo.foyer_malin_taches").state == "0"
    assert hass.states.get("sensor.foyer_malin_taches_du_jour").state == "0"
    assert hass.states.get("sensor.foyer_malin_prochain_evenement").state == "Rien de prévu"
    assert PANEL_URL_PATH in hass.data["frontend_panels"]

    assert await hass.config_entries.async_unload(entry.entry_id)
    assert DOMAIN not in hass.data
    assert PANEL_URL_PATH not in hass.data["frontend_panels"]
