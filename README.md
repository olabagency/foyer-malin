<p align="center"><img src="custom_components/foyer_malin/brand/icon.png" width="120" alt="Foyer Malin"></p>

# Foyer Malin par Adri 🏡

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)

Une intégration Home Assistant pour organiser la vie de famille : qui fait quoi, qui va où, et ce qu'il ne faut pas oublier. Tout reste chez vous, sur votre Home Assistant — pas de compte, pas d'abonnement, pas de cloud.

## Ce que fait Foyer Malin

**👨‍👩‍👧 La famille**
Un profil par membre : prénom, avatar, couleur, adulte ou enfant. Chaque membre peut être relié à une personne de Home Assistant pour recevoir les rappels sur son téléphone.

**✅ Les tâches**
- À qui, pour quand, avec une note. Ajout rapide en une ligne, ou détaillé.
- Répétition : tous les jours, toutes les semaines, tous les mois, tous les ans, ou « toutes les 2 semaines ». Une tâche faite revient toute seule à sa prochaine date.
- « Chacun son tour » : les poubelles passent de Léa à Tom, puis de Tom à Léa.
- Des points par tâche et un classement de la semaine, pour motiver les troupes (désactivable).
- Vue par membre, tâches en retard mises en avant.

**🗓️ L'agenda**
Rendez-vous, activités, vacances : avec une heure ou sur la journée, sur plusieurs jours, répétés chaque semaine si besoin, avec le lieu et les membres concernés. La vue semaine montre aussi les tâches à faire chaque jour.

**📝 Les listes partagées**
Valise des vacances, idées cadeaux, travaux à prévoir… Tapez « maillot, tongs, crème solaire » pour ajouter trois éléments d'un coup.

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

## Dans Home Assistant

| Entité | Rôle |
| --- | --- |
| `calendar.foyer_malin_agenda` | L'agenda de la famille, utilisable dans le tableau de bord Calendrier et les automatisations. |
| `todo.foyer_malin_taches` | Les tâches, visibles dans « À faire ». Cocher une tâche ici compte comme dans le panneau. |
| `sensor.foyer_malin_taches_du_jour` | Nombre de tâches à faire aujourd'hui, retards compris (détail dans les attributs). |
| `sensor.foyer_malin_prochain_evenement` | Titre du prochain événement (date, heure, lieu et membres dans les attributs). |

**Carte de tableau de bord** : Modifier le tableau de bord → Ajouter une carte → « Foyer Malin – Aujourd'hui en famille ».

Exemple d'automatisation — ajouter une tâche depuis n'importe où :

```yaml
action: todo.add_item
target:
  entity_id: todo.foyer_malin_taches
data:
  item: Sortir les poubelles
  due_date: "2026-11-12"
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
├── sensor.py          tâches du jour, prochain événement
├── reminder.py        rappel quotidien sur les téléphones
└── frontend/          panneau et carte (JavaScript sans build)
```

## Licence

MIT
