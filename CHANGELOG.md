# Nouveautés de Foyer Malin

Toutes les évolutions notables sont listées ici. Les numéros de version suivent
[SemVer](https://semver.org/lang/fr/) :

- **correctif** (1.0.**1**) : corrections, rien ne change pour vous ;
- **mineure** (1.**1**.0) : nouvelles fonctions, vos données et réglages sont conservés ;
- **majeure** (**2**.0.0) : changement important, lisez les notes avant de mettre à jour.

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
