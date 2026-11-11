<p align="center"><img src="custom_components/foyer_malin/brand/icon.png" width="120" alt="Foyer Malin"></p>

# Foyer Malin par Adri 🏡

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)

Une intégration Home Assistant pour organiser la vie de famille : qui fait quoi, qui va où, et ce qu'il ne faut pas oublier. Tout reste chez vous, sur votre Home Assistant — pas de compte, pas d'abonnement, pas de cloud.

## Ce que fait Foyer Malin

**👨‍👩‍👧 La famille**
Un profil par membre : prénom, avatar, couleur, adulte ou enfant. Chaque membre peut être relié à une personne de Home Assistant pour recevoir les rappels sur son téléphone.

**📋 Les listes et leurs tâches**
- Une liste par sujet, partagée par toute la famille : tâches ménagères, jardin, le chat… avec une icône et une couleur.
- Dans chaque liste, des tâches : à qui, pour quel jour et quelle heure, avec une note. Tapez-en une dans « Ajouter », ou touchez + pour la détailler.
- Répétition personnalisée (voir plus bas) : tous les N jours, semaines, mois ou ans, jours de la semaine au choix, cycles « 1 semaine sur 2 », jour du mois, date de fin. Une tâche faite revient toute seule à sa prochaine date.
- « Chacun son tour » : les poubelles passent de Léa à Tom, puis de Tom à Léa.
- Les retards s'affichent en rouge ; les tâches terminées restent en bas, barrées.

**✅ L'onglet Tâches**
Toutes les tâches de toutes les listes, rangées par échéance, avec un filtre par membre. Des points par tâche et un classement de la semaine pour motiver les troupes (désactivable).

**🗓️ L'agenda**
Rendez-vous, activités, vacances : avec une heure ou sur la journée, sur plusieurs jours, répétés chaque semaine si besoin, avec le lieu et les membres concernés. La vue semaine montre aussi les tâches à faire chaque jour.

**🔔 Le rappel du jour**
À l'heure de votre choix, chacun reçoit sur son téléphone les tâches qui l'attendent encore aujourd'hui.

**🔄 Toujours à jour**
Une tâche cochée sur un téléphone disparaît aussitôt sur la tablette de la cuisine.

L'interface s'ouvre en plein écran depuis la barre latérale, est pensée d'abord pour le téléphone et reprend le thème de votre Home Assistant, en clair comme en sombre.

## Installation

### Avec HACS (recommandé)

1. Dans HACS, menu ⋮ → **Dépôts personnalisés**.
2. Ajoutez `https://github.com/olabagency/foyer-malin`, catégorie **Intégration**.
3. Cherchez **Foyer Malin**, installez, puis redémarrez Home Assistant.

### À la main

Copiez le dossier `custom_components/foyer_malin` dans le dossier `config/custom_components/` de Home Assistant, puis redémarrez.

## Configuration

1. **Paramètres → Appareils et services → Ajouter une intégration → Foyer Malin.**
2. **Foyer Malin** apparaît dans la barre latérale.
3. Dans l'onglet **Famille**, ajoutez les membres du foyer.

Aucun fichier YAML à modifier, aucune clé à fournir. Les réglages (rappel, heure, points) sont dans l'onglet **Famille**.

### Recevoir les rappels

Le rappel arrive par l'application mobile Home Assistant. Pour chaque membre : ouvrez son profil et choisissez sa **personne dans Home Assistant** (celle dont le téléphone a l'application installée). Le bouton « Envoyer le rappel maintenant » permet de vérifier.

Les adultes reçoivent aussi les tâches attribuées à personne.

## Répétitions

Pour une tâche ou un événement : choisissez « Toutes les semaines », « Tous les mois »… puis réglez le détail. Une phrase résume la règle et les prochaines dates sont affichées avant d'enregistrer. La date de la tâche (ou le début de l'événement) est le **point de départ** et la première occurrence.

| Je veux… | Réglage |
| --- | --- |
| Tous les lundis et jeudis | Toutes les semaines · jours : lun. et jeu. |
| Une semaine sur deux, à partir du 23 novembre | Toutes les **2** semaines · date : 23 novembre · semaine 1 cochée |
| Une semaine sur deux, mais l'autre semaine | Toutes les 2 semaines · cochez « Semaine 2 » |
| Deux semaines sur trois | Toutes les **3** semaines · semaines 1 et 2 cochées |
| Le 15 de chaque mois | Tous les mois · « Le 15 de chaque mois » |
| Le 2e mardi du mois | Tous les mois · « Le 2e mardi du mois » |
| Le dernier vendredi du mois | Tous les mois · « Le dernier vendredi du mois » |
| Tous les 3 mois, le dernier jour | Tous les **3** mois · « Le dernier jour du mois » |
| Jusqu'à une date | Champ « Jusqu'au » |

Dans un cycle de plusieurs semaines, la semaine 1 est celle de la date de départ. Changer la répétition d'une tâche repart de sa date affichée.

## Dans Home Assistant

| Entité | Rôle |
| --- | --- |
| `calendar.foyer_malin_agenda` | L'agenda de la famille, utilisable dans le tableau de bord Calendrier et les automatisations. |
| `todo.foyer_malin_taches` | Toutes les tâches (date et heure comprises), visibles dans « À faire ». Cocher une tâche ici compte comme dans le panneau. |
| `sensor.foyer_malin_taches_du_jour` | Nombre de tâches à faire aujourd'hui, retards compris (détail dans les attributs). |
| `sensor.foyer_malin_prochain_evenement` | Titre du prochain événement (date, heure, lieu et membres dans les attributs). |

| `sensor.foyer_malin_classement_du_mois` | Le membre qui a le plus de points ce mois-ci ; le classement du mois et de la semaine est dans les attributs. |

Les cartes de tableau de bord sont décrites plus bas.

Exemple d'automatisation — ajouter une tâche depuis n'importe où :

```yaml
action: todo.add_item
target:
  entity_id: todo.foyer_malin_taches
data:
  item: Sortir les poubelles
  due_date: "2026-11-12"
```

## Widgets du tableau de bord

Modifier le tableau de bord → Ajouter une carte → cherchez « Foyer Malin ». Chaque carte a son éditeur visuel, et se règle aussi en YAML. Elles se mettent à jour en direct et on peut cocher une tâche directement depuis la carte. Toucher le titre ouvre Foyer Malin à la bonne page.

| Carte | Type YAML | Ce qu'elle montre |
| --- | --- | --- |
| Tâches du jour | `custom:foyer-malin-tasks-card` | Les tâches à faire, retards en rouge, à cocher. |
| Top points du mois | `custom:foyer-malin-ranking-card` | Le classement des points, avec médailles. |
| Agenda | `custom:foyer-malin-agenda-card` | Les événements des prochains jours. |
| Une liste | `custom:foyer-malin-list-card` | Les tâches d'une liste, avec un champ « Ajouter ». |
| La famille | `custom:foyer-malin-members-card` | Chaque membre : tâches du jour et points du mois. |
| Aujourd'hui en famille | `custom:foyer-malin-card` | Le prochain événement et les tâches du jour (utilise les capteurs). |

**Options des cartes**

| Carte | Option | Rôle | Défaut |
| --- | --- | --- | --- |
| Tâches | `title` | Titre | « Tâches du jour » |
| | `member` | Prénom du membre, ou `me` pour la personne connectée | toute la famille |
| | `list` | Nom d'une liste | toutes |
| | `scope` | `today` (aujourd'hui et retards), `week` (7 jours) ou `all` | `today` |
| | `max_tasks` | Nombre maximum de tâches | 6 |
| | `show_list` | Afficher le nom de la liste | `true` |
| Classement | `title` | Titre | « Top points du mois » |
| | `period` | `month` ou `week` | `month` |
| | `show_count` | Afficher le nombre de tâches faites | `true` |
| Agenda | `title`, `member` | Titre, membre concerné | |
| | `days` | Nombre de jours (1 à 14) | 5 |
| | `max_events` | Nombre maximum d'événements | 8 |
| Une liste | `list` | Nom de la liste (obligatoire) | |
| | `title`, `max_tasks` | Titre, nombre de tâches | 8 |
| | `show_add` | Champ « Ajouter une tâche » | `true` |
| La famille | `title` | Titre | « Famille » |
| | `show_points` | Afficher les points du mois | `true` |

Un tableau de bord par personne : avec `member: me`, la même carte montre à chacun ses propres tâches (la personne Home Assistant du membre doit être choisie dans son profil).

```yaml
type: grid
columns: 2
cards:
  - type: custom:foyer-malin-tasks-card
    member: me
    title: Mes tâches
  - type: custom:foyer-malin-ranking-card
    period: month
  - type: custom:foyer-malin-agenda-card
    days: 7
  - type: custom:foyer-malin-list-card
    list: Jardin
```

## Vos données

Tout est enregistré dans `.storage/foyer_malin.data`, inclus dans les sauvegardes de Home Assistant.

## Développement

```bash
pip install -r requirements_test.txt
```

```bash
pytest -q
```

Changer de version (met à jour le manifeste, le code et le CHANGELOG) :

```bash
python3 scripts/bump_version.py minor
```

Une version poussée sur `main` est publiée automatiquement en release GitHub, que HACS propose ensuite en mise à jour.

## Structure

```
custom_components/foyer_malin/
├── __init__.py        démarrage, panneau, carte
├── config_flow.py     installation depuis l'interface
├── store.py           données et règles du foyer
├── recurrence.py      répétitions (jours, semaines, mois, ans)
├── websocket_api.py   commandes utilisées par le panneau
├── calendar.py        agenda
├── todo.py            liste des tâches
├── sensor.py          tâches du jour, prochain événement, classement du mois
├── reminder.py        rappel quotidien sur les téléphones
└── frontend/          panneau et widgets (JavaScript sans build)
```

## Licence

MIT
