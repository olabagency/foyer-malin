"""Installation depuis l'interface de Home Assistant."""

from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType

from custom_components.foyer_malin.const import DOMAIN


async def test_user_flow_creates_the_entry(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Foyer Malin par Adri"
    assert hass.states.get("todo.foyer_malin_taches") is not None


async def test_only_one_instance(hass, entry):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"
