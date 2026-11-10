# Nouveautés de Foyer Malin

Toutes les évolutions notables sont listées ici. Les numéros de version suivent
[SemVer](https://semver.org/lang/fr/) :

- **correctif** (1.0.**1**) : corrections, rien ne change pour vous ;
- **mineure** (1.**1**.0) : nouvelles fonctions, vos données et réglages sont conservés ;
- **majeure** (**2**.0.0) : changement important, lisez les notes avant de mettre à jour.

## [0.2.0] – 2026-11-10

### Modifié

- 📋 **Les listes contiennent maintenant des tâches**, comme dans FamilyWall.
  - Sommaire : une ligne par liste avec son icône, « Partagée », le nombre de tâches à faire et les retards en rouge. Bouton + pour créer une liste.
  - Une liste ouverte : grand en-tête à sa couleur, champ « Ajouter » pour taper une tâche d'un coup, bouton + pour une tâche détaillée.
  - Chaque tâche affiche son rond à cocher, sa date et son heure (en rouge si elle est passée), sa répétition (« Toutes les 2 semaines », « Tous les 3 jours ») et les avatars des membres. Les tâches terminées restent en bas, barrées.
  - Chaque liste a une couleur au choix.
- ⏰ **Heure facultative** sur les tâches, aussi dans la liste `todo.foyer_malin_taches` de Home Assistant.
- L'onglet Tâches rappelle la liste de chaque tâche.

### Mis à jour automatiquement

- Les éléments des anciennes listes deviennent des tâches de ces listes, cochées ou non comme avant.

## [0.1.0] – 2026-11-10

### Ajouté

- 🏡 **Première version**, construite sur la base technique de Frigo Malin.
- 👨‍👩‍👧 **Famille** : un profil par membre (prénom, avatar, couleur, adulte ou enfant), relié si on veut à une personne de Home Assistant.
- ✅ **Tâches** : à qui, pour quand, avec une note.
  - Répétition tous les jours, semaines, mois ou ans ; une tâche faite revient à sa prochaine date.
  - « Chacun son tour » : la tâche passe au membre suivant à chaque fois.
  - Points par tâche et classement de la semaine (désactivable).
- 🗓️ **Agenda** : événements avec heure ou sur la journée, sur plusieurs jours, répétés, avec lieu et membres concernés. Vue semaine, avec les tâches du jour.
- 📝 **Listes partagées** : valise, idées cadeaux, travaux… avec ajout de plusieurs éléments d'un coup.
- 🔔 **Rappel quotidien** des tâches du jour sur le téléphone de chaque membre, à l'heure choisie.
- 🔄 **Synchronisation en direct** : un changement fait sur un appareil apparaît aussitôt sur les autres.
- 🧩 **Dans Home Assistant** : calendrier `calendar.foyer_malin_agenda`, liste `todo.foyer_malin_taches`, capteurs « tâches du jour » et « prochain événement », et une carte de tableau de bord « Aujourd'hui en famille ».
