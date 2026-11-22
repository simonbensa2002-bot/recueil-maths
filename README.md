# Mon recueil de mathématiques

Appli installable (PWA) pour Terminale spé maths + maths expertes, utilisable sans Wi-Fi.

- **Conseiller de DS** : on coche les notions du contrôle et le niveau voulu, l'appli classe les DS les plus adaptés.
- **Tous les DS** : recherche et filtres. **Cours** : chapitres, fiches, statuts, chapitres à réviser. **Plus** : lacunes, trucs niches, import des PDF.
- Les difficultés (1 à 5) et les notions de chaque DS sont dans `data/docs.json` (champs `lv`, `tags`, `why`). Elles se règlent sur l'élève avec le ressenti noté après chaque DS.

## PDF
Les PDF ne sont pas dans ce dépôt (cours et sujets de M. Hattab, Paul Milan, etc.). Le dossier `recueil-pdf.zip` s'importe une seule fois depuis l'écran *Plus*. Les noms de fichiers attendus sont les champs `pdf` et `cor` de `data/docs.json`, plus `cours`, `fiche` et `pdf` des niches.
Pour servir les PDF depuis l'appli à la place, les déposer dans `pdf/` (retirer la ligne du `.gitignore`).

## Mettre à jour
Ajouter un DS : ajouter une entrée dans `data/docs.json` et son PDF, puis déployer.
Changer le numéro de `SHELL` dans `sw.js` quand les fichiers de l'appli changent.
