# Saxo Agenda

Agenda PWA pour saxophoniste — hébergé sur Vercel, données stockées sur Vercel KV (Redis).

---

## Structure du projet

```
saxo-agenda/
├── index.html          ← Page principale (PWA, Alpine.js)
├── manifest.json       ← Manifest PWA (requis pour installation Android)
├── sw.js               ← Service Worker (cache hors-ligne)
├── vercel.json         ← Configuration Vercel
├── package.json        ← Dépendance @vercel/kv
├── .gitignore
├── css/
│   └── app.css         ← Thème custom (variables CSS, composants)
├── js/
│   ├── app.js          ← Init Alpine.js, état global, Service Worker
│   ├── calendar.js     ← Rendu calendrier mois/semaine + liste
│   ├── events.js       ← CRUD événements, formulaire, blocs dynamiques
│   ├── storage.js      ← Appels API Vercel KV + cache localStorage
│   └── ui.js           ← Toast, combobox, escapeHTML, icônes Lucide
├── api/
│   ├── get-events.js   ← GET /api/get-events  → lit Vercel KV
│   └── save-events.js  ← POST /api/save-events → écrit Vercel KV
└── icons/              ← À créer (voir étape 3)
    ├── icon-192.png
    └── icon-512.png
```

---

## Déploiement étape par étape

### 1. Créer le dépôt GitHub

```bash
git init
git add .
git commit -m "Initial commit — Saxo Agenda"
```

Sur github.com → New repository → nom : `saxo-agenda` → Create.

```bash
git remote add origin https://github.com/VOTRE_PSEUDO/saxo-agenda.git
git branch -M main
git push -u origin main
```

---

### 2. Lier le dépôt à Vercel

1. Aller sur **vercel.com** → "Add New Project"
2. Importer le dépôt `saxo-agenda` depuis GitHub
3. Framework Preset : **Other** (pas de build)
4. Root Directory : `.` (racine)
5. Cliquer **Deploy**

À chaque `git push main`, Vercel redéploie automatiquement.

---

### 3. Créer les icônes PNG (obligatoire pour PWA Android)

Vercel a besoin de vrais fichiers PNG pour l'installation PWA.

**Option simple :** utiliser https://realfavicongenerator.net
- Uploader une image carrée (votre logo ou ♪ sur fond #21213a)
- Télécharger le pack, récupérer les PNG 192×192 et 512×512
- Les renommer `icon-192.png` et `icon-512.png`
- Les placer dans le dossier `icons/`
- `git add icons/ && git commit -m "Ajout icônes PWA" && git push`

---

### 4. Créer et connecter Vercel KV (Redis)

C'est ici que les données de l'agenda sont stockées.

1. Dans le dashboard Vercel → votre projet → onglet **Storage**
2. Cliquer **Create Database** → choisir **KV**
3. Nom : `saxo-agenda-kv` → Create
4. Aller dans l'onglet **Settings** du store KV → **Connected Projects**
5. Connecter votre projet `saxo-agenda`

Vercel injecte automatiquement les variables d'environnement :
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

**Pas besoin de copier ces clés nulle part** : elles sont injectées automatiquement
dans les serverless functions grâce à `@vercel/kv`.

---

### 5. Redéployer après la connexion KV

```bash
git commit --allow-empty -m "Trigger redeploy after KV connection"
git push
```

Ou cliquer "Redeploy" dans le dashboard Vercel.

---

### 6. Tester

Ouvrir `https://saxo-agenda.vercel.app` dans Chrome Android.
Après quelques secondes d'utilisation, Chrome proposera :
**"Ajouter Saxo Agenda à l'écran d'accueil"**.

---

## Export / Sauvegarde sur MEGA

L'app propose un bouton **"Exporter JSON"** dans la sidebar.
Il télécharge un fichier `saxo-agenda-YYYY-MM-DD.json`.

**Workflow recommandé pour MEGA :**
1. Créer un dossier `Saxo Agenda / Sauvegardes` sur MEGA
2. Faire un export depuis l'app quand vous voulez (hebdo, mensuel…)
3. Glisser le fichier dans MEGA (web ou app desktop)

Pour **restaurer** depuis un export JSON, une fonctionnalité d'import
peut être ajoutée facilement (simple `JSON.parse` + POST vers `/api/save-events`).

---

## Développement local

Pour tester les serverless functions en local :

```bash
npm install -g vercel
vercel dev
```

Vercel CLI charge automatiquement les variables KV depuis votre projet connecté.
L'app est disponible sur `http://localhost:3000`.

---

## Mise à jour de l'app

Modifier les fichiers → `git add . && git commit -m "..." && git push` → Vercel déploie.

Pour invalider le cache du Service Worker après une mise à jour :
incrémenter `CACHE_NAME` dans `sw.js` (ex : `saxo-agenda-v2`).
