Tu es mon architecte/ingénieur/technicien en developpement.
Pour mon travail j'ai besoin d'une appli WEB utilisable aussi bien sur mon smartphone que dans mon navigateur de PC ou sur tablette.
Il s'agit de pouvoir gérer simplement mes evenements en tant que saxophoniste.
Voilà ce que j'envisage:
- Une vue principale de consultation de type agenda où je peux voir de manière synthétiques mes engagements, par défaut avec un affichage par mois, et où je peux facilement déclencher la création d'un nouvel évenement. Un évènement sera affiché avec son nom + sa typologie.
- On veut également une vue liste avec les même possibilités.
- Le détail d'un évènemenent en mode CRUD avec ces informations:
    - Nom de l'évènement
    - Typologie de l'évenement (de base Concert ou Mariage, liste ouverte)
    - Date et lieu
    - Groupe de musique intervenant (saisie libre du nom du groupe)
    - Organisateur
    - Prix negocié (un montant global simple)
    - Contact1, nom, prénom, téléphone, mail
    - ContactX, nom, prénom, téléphone, mail (ajout dynamique de nouveaux contacts)
    - Horaire de première intervention
    - Horaire prévu d'arrivée
    - Set 1
        - type (par défaut messe, cérmonie laïque, vin d'honneur, défilé, scène, liste ouverte)
        - horaire de début/horaire de fin
        - lieu
            - L'ordre de saisie suffit, pas besoin de glisser/déposer ou de réordonner
    - Set X (ajout dynamique de nouveau set)
    - Note 1, champs de saisie libre
    - Note X (ajout dynamique de nouvelle note)
    - Partenaire 1 (qui sont soit des des musiciens, soit des producteur, peu importe; saisie libre)
    - Partenaire X (ajout dynamique de nouveau partenaire)
    - Une case à cocher archiver; cette fonctionnalité sert uniquement à ne pas prendre en compte l'évenement pour la création du contenu des dropdown-list.
- Une bonne partie des champs est de type dropdown list saisissables; il doivent proposer toutes les saisies antérieures classées par ordre de nombre d'utilsations descendants
- Pouvoir dupliquer un événement pour modification pour un nouvel évènement; on garde tout l'existant sauf la date.
- Les données seront sauvegardées dans un fichier Json pour rester facilement lisible sans l'interface.
- Ce projet sera stocké et exécuté sur Github/Vercel et le fichier de données sera chargé/sauvegardé en local sur l'appareil de consultation dans un répertoire partagé MEGA qui gérera donc la synchronisation automatiquement
- L'UI proposera sur le navigateur local de charger un fichier de données. Il sauvegardera ensuite localement le chemin de ce fichier pour le rouvrir automatiquement à l'ouverture suivante de l'UI (dernier fichier chargé).
- L'interface doit être adaptée à la résolution de l'écran, en particulier pour le smartphone, et se prêter efficacement au tactile.
- On veut utiliser en priorité Firefox et créer une appli PWA pour smartphone.
- Le thème de l'application doit être globalement sombre mais posséder de bons contrastes pour lire clairement le contenu.
