"""Réglages communs aux tests (pytest-homeassistant-custom-component)."""

from __future__ import annotations

import pytest

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.foyer_malin.const import DOMAIN


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Autorise le chargement de custom_components/ pendant les tests."""


@pytest.fixture
async def entry(hass, hass_client):
    """Foyer Malin installé et démarré."""
    config_entry = MockConfigEntry(domain=DOMAIN, title="Foyer Malin par Adri", data={})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry


@pytest.fixture
def store(entry):
    return entry.runtime_data.store
