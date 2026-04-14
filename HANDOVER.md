# HANDOVER — Saxo Agenda PWA

_Dernière mise à jour : 2026-04-14_

---

## Contexte du projet

Application web PWA pour la gestion des engagements d'un saxophoniste (concerts, mariages, sets, contacts, partenaires). Thème sombre, responsive mobile/desktop, installable sur Android Chrome.

**Utilisateur :** Flavien — `gorby69@hotmail.com`  
**Machine locale :** Debian 13, Chrome/Chromium + Firefox  
**Repo GitHub :** https://github.com/GorBy6969/saxo-agenda-pwa  
**URL Vercel :** à compléter après vérification dans le dashboard Vercel  
**Chemin local :** `~/IA/claude-cowork/informatique/saxo-agenda`  
**Monté dans Cowork à :** `/sessions/stoic-sharp-brown/mnt/saxo-agenda`

---

## Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Frontend | HTML + Alpine.js 3 + Tailwind CSS CDN | Léger, pas de build step |
| Dates | Day.js + locale FR | Remplace moment.js |
| Icônes | Lucide (UMD CDN) | SVG propres, chargement à la demande |
| Fonts | DM Serif Display / DM Mono / DM Sans | Google Fonts |
| Stockage | File System Access API + IndexedDB + localStorage | Voir section dédiée |
| Hébergement | Vercel (site statique pur) | Zéro config, déploiement auto sur push |
| Sync | MEGA desktop (sync dossier local) | Fichier JSON partagé entre appareils |

---

## Architecture de stockage — décision clé

**Décision :** Zéro backend. Données 100 % locales.

Trois alternatives ont été évaluées et rejetées :
- **Vercel KV** : discontinué fin 2024, migré vers Upstash
- **Upstash direct** : données en ligne, rejet pour raison de confidentialité (contacts clients, prix)
- **Chiffrement + Upstash** : trop complexe pour l'usage solo

**Solution retenue :**

```
Chrome (PC + Android)
  └─ File System Access API
       ├─ showOpenFilePicker() → sélection du fichier MEGA
       ├─ FileSystemFileHandle → lecture/écriture directe
       ├─ handle persisté dans IndexedDB → réouverture auto
       └─ MEGA détecte les changements → sync inter-appareils

Firefox (PC)
  └─ <input type="file"> (fallback)
       ├─ lecture OK
       ├─ écriture impossible (API non supportée)
       └─ cache localStorage + export manuel vers MEGA

localStorage (tous navigateurs)
  └─ cache universel mis à jour à chaque sauvegarde
       └─ permet démarrage hors-ligne / sans sélecteur
```

**Comportement au démarrage (Chrome) :**
1. App tente `tryReopenLastFile()` → lecture silencieuse si permission accordée
2. Si permission expirée (Android) → écran "Reprendre ?" avec confirmation en 1 tap
3. Si aucun handle connu → écran "Ouvrir fichier MEGA" / "Créer nouveau fichier"
4. Fallback : "Continuer sans fichier" (cache localStorage)

---

## Ce qui a été fait dans cette session

### Fichiers modifiés / créés

| Fichier | Action | Contenu |
|---|---|---|
| `js/storage.js` | Réécriture complète | FSA + IndexedDB + input fallback + localStorage |
| `js/app.js` | Réécriture complète | Alpine Store `appState`, init screen 3 états |
| `js/events.js` | Modification mineure | `SaxoStorage.save()` remplace `saveToServer()` |
| `index.html` | Réécriture écran d'accueil + sidebar | 3 états : ask-reopen / start / no-fsa |
| `css/app.css` | Modifications contraste | `--bg-card: #3f3f6e`, event-chip, week-event-block |
| `vercel.json` | Simplifié | Site statique pur, suppression champ `comment` invalide |
| `package.json` | Simplifié | Aucune dépendance npm |
| `sw.js` | Bump version | `saxo-agenda-v2`, ajout icons dans precache |
| `manifest.json` | Inchangé | Référence icons/icon-192.png et icon-512.png |
| `icons/icon-192.png` | Créé | Généré avec Pillow (♪ sur fond sombre) |
| `icons/icon-512.png` | Créé | Idem |
| `.gitignore` | Renommé depuis `gitignore` | Était mal nommé, git l'ignorait |
| `saxo-agenda.json` | Créé (données) | Conversion YAML → JSON, 3 événements initiaux |

### Fichiers supprimés
- `api/get-events.js` — serverless Vercel KV (abandonné)
- `api/save-events.js` — serverless Vercel KV (abandonné)
- `prompt/prompts.txt` — fichier de travail interne

### Bugs corrigés

1. **Écran noir au démarrage** — `x-show="appReady"` sur `#app` ne réagissait pas car `appReady` n'était pas dans le scope Alpine de `saxoApp()`. Corrigé avec `Alpine.store('appState')` partagé entre composants.

2. **Firefox : clic sans effet** — `showOpenFilePicker()` déclaré dans `window` mais non fonctionnel dans le contexte Alpine. Corrigé par fallback automatique sur `<input type="file">`.

3. **`vercel.json` invalide** — champ `comment` non supporté par l'API Vercel. Supprimé.

4. **`.gitignore` ignoré** — fichier nommé `gitignore` sans le point. Renommé.

---

## État actuel (testé)

| Fonctionnalité | Chrome | Firefox | Statut |
|---|---|---|---|
| Chargement fichier MEGA | ✅ FSA | ✅ input fallback | OK |
| Écriture auto dans fichier | ✅ | ❌ cache seulement | Comportement attendu |
| Réouverture auto (desktop) | ✅ silencieuse | — | OK |
| Réouverture (Android) | ✅ 1 tap | — | OK |
| Vue calendrier mois/semaine | ✅ | ✅ | OK |
| Vue liste | ✅ | ✅ | OK |
| CRUD événements | ✅ | ✅ | OK |
| Duplication événement | non testé | non testé | À vérifier |
| Archivage (filtre dropdowns) | non testé | non testé | À vérifier |
| Export JSON | ✅ | ✅ | OK |
| PWA install Android | non testé | — | À faire |
| Sync MEGA inter-appareils | non testé | — | À valider en conditions réelles |

---

## Ce qui reste à faire

### Priorité haute
- [ ] **Tester sur smartphone Android** — installer en PWA, vérifier le workflow complet (ouverture, ajout événement, écriture fichier, sync MEGA)
- [ ] **Valider la sync MEGA** — éditer sur PC, vérifier que le fichier JSON est bien modifié sur disque, que MEGA le synchronise, et qu'il est lisible sur une autre instance
- [ ] **Ajouter `saxo-agenda.json` au `.gitignore`** — le fichier de données ne doit pas être versionné

### Priorité moyenne
- [ ] **Auto-export Firefox** — en mode cache-only (Firefox), déclencher automatiquement un téléchargement après chaque sauvegarde pour faciliter la sync MEGA manuelle
- [ ] **Test duplication + archivage** — vérifier que la case "Archiver" exclut bien les entrées des dropdowns
- [ ] **Afficher la date de dernière sauvegarde** dans la sidebar (utiliser `savedAt` du JSON)

### Priorité basse
- [ ] **Icônes PWA personnalisées** — les icônes actuelles sont générées programmatiquement (♪ en DM Sans). Une version vectorielle/design serait plus propre
- [ ] **Améliorer le message Firefox** — indiquer clairement le workflow export → MEGA → sync
- [ ] **Gestion des conflits** — si le fichier MEGA est modifié par un autre appareil pendant qu'on travaille, l'app l'ignore. Un avertissement serait utile

---

## Infrastructure et accès

### Git
```bash
# Depuis /sessions/.../mnt/saxo-agenda (Cowork peut committer)
git add <fichiers>
git commit -m "message"
# Le push nécessite le terminal de l'utilisateur (credentials gh sur sa machine)
git push
```

### Vercel
- Déploiement automatique à chaque push sur `main`
- Aucune variable d'environnement requise
- Framework : Other (site statique)

### Fichier de données
- Format : `saxo-agenda.json` (voir structure dans `js/storage.js`)
- À placer dans le dossier MEGA synchronisé
- Chargé au démarrage via "Ouvrir fichier MEGA"

---

## Points d'attention pour la prochaine session

1. **Ne pas toucher à `js/calendar.js` et `js/ui.js`** — non modifiés, fonctionnels, stables.
2. **Alpine.js Store** — `$store.appState.ready` contrôle la visibilité de l'app. `$store.modal.open` contrôle la modale. Toute modification de visibilité globale doit passer par les stores.
3. **Ordre de chargement des scripts** dans `index.html` : `storage → ui → events → calendar → app`. Cet ordre est impératif.
4. **`_fileHandle`** est une variable privée du module `SaxoStorage`. Elle est `null` en mode Firefox/cache. `SaxoStorage.save()` gère les deux cas (avec et sans handle).
5. **`window._db`** est la source de vérité en mémoire. Toujours le modifier puis appeler `SaxoStorage.save(window._db)`.
