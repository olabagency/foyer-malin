"""Constantes de Foyer Malin."""

from __future__ import annotations

DOMAIN = "foyer_malin"
# Version de l'intégration. Ne pas modifier à la main : utiliser scripts/bump_version.py.
VERSION = "0.3.0"

# Panneau
PANEL_URL_PATH = "foyer-malin"
PANEL_TITLE = "Foyer Malin par Adri"
# Nom court affiché dans la barre latérale de Home Assistant.
SIDEBAR_TITLE = "Foyer Malin"
PANEL_ICON = "mdi:home-heart"
PANEL_COMPONENT = "foyer-malin-panel"
STATIC_URL = "/foyer_malin_static"

# Stockage : augmenter STORAGE_MINOR_VERSION pour un ajout de champ compatible,
# STORAGE_VERSION pour un changement de structure, et prévoir la migration dans store.py.
STORAGE_KEY = f"{DOMAIN}.data"
STORAGE_VERSION = 1
STORAGE_MINOR_VERSION = 2

CHANGELOG_URL = "https://github.com/olabagency/foyer-malin/blob/main/CHANGELOG.md"

# Répétition d'une tâche ou d'un événement.
FREQUENCIES = ["none", "daily", "weekly", "monthly", "yearly"]

# Couleurs proposées pour les membres du foyer.
MEMBER_COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0091ff", "#6e56cf", "#d6409f"]

# Couleurs proposées pour les listes (en-tête de la liste, bouton d'ajout).
LIST_COLORS = ["#3b8247", "#2f7fb8", "#6e56cf", "#c2477f", "#d0533c", "#d98b1c", "#3f8f8a", "#5f6b7a"]

# Réglages du foyer, modifiables dans le panneau.
DEFAULT_SETTINGS = {
    # Rappel quotidien des tâches du jour sur les téléphones des membres.
    "reminder": True,
    "reminder_time": "18:00",
    # Points gagnés en terminant une tâche (classement de la semaine).
    "points": True,
}

# Nombre de tâches terminées gardées dans l'historique.
HISTORY_LIMIT = 500
