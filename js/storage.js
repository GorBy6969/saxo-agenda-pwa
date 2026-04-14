/* ══════════════════════════════════════════════════════════
   storage.js — Couche de persistance des données
   ──────────────────────────────────────────────────────────
   Stratégie à deux niveaux :

   1. FILE SYSTEM ACCESS API (Chrome PC + Chrome Android)
      → lit/écrit directement le fichier JSON dans votre
        dossier MEGA. MEGA se charge de la sync inter-appareils.
      → le FileSystemFileHandle est persisté dans IndexedDB
        pour être réutilisé sans re-picker à chaque session.

   2. localStorage (cache et fallback universel)
      → mis à jour à chaque sauvegarde réussie
      → utilisé si le fichier n'est pas (encore) accessible

   Format du fichier / localStorage :
   {
     events   : Event[],
     meta     : { typologies: string[], setTypes: string[] },
     savedAt  : ISO string
   }
   ══════════════════════════════════════════════════════════ */

const SaxoStorage = (() => {

  /* ── Clés ── */
  const LS_KEY       = 'saxo-agenda-db';
  const LS_META_KEY  = 'saxo-agenda-meta';
  const IDB_DB_NAME  = 'saxo-agenda-idb';
  const IDB_STORE    = 'fileHandles';
  const IDB_KEY      = 'lastFileHandle';

  /* ── Handle courant (FileSystemFileHandle ou null) ── */
  let _fileHandle = null;


  /* ══════════════════════════════════════
     SUPPORT
     ══════════════════════════════════════ */

  /** true si le navigateur supporte File System Access API */
  function supportsFileSystemAccess() {
    return ('showOpenFilePicker' in window);
  }

  /** true si le navigateur supporte l'écriture dans un fichier local (Chrome) */
  function supportsFileWrite() {
    return supportsFileSystemAccess() &&
           typeof FileSystemFileHandle !== 'undefined' &&
           'createWritable' in FileSystemFileHandle.prototype;
  }


  /* ══════════════════════════════════════
     INDEXED DB — persistance du handle
     ══════════════════════════════════════ */

  function _openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function _saveHandleToIDB(handle) {
    try {
      const db = await _openIDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(IDB_STORE, 'readwrite');
        const st  = tx.objectStore(IDB_STORE);
        const req = st.put(handle, IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[IDB] Sauvegarde handle échouée :', e.message);
    }
  }

  async function _loadHandleFromIDB() {
    try {
      const db = await _openIDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(IDB_STORE, 'readonly');
        const st  = tx.objectStore(IDB_STORE);
        const req = st.get(IDB_KEY);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror   = e => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[IDB] Lecture handle échouée :', e.message);
      return null;
    }
  }

  async function _clearHandleFromIDB() {
    try {
      const db = await _openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => resolve();
      });
    } catch (e) { /* silencieux */ }
  }


  /* ══════════════════════════════════════
     FICHIER — ouverture / lecture / écriture
     ══════════════════════════════════════ */

  /**
   * Ouvre le sélecteur de fichier et charge le JSON.
   * Essaie File System Access API (Chrome) en premier,
   * puis fallback sur <input type="file"> (Firefox, etc.).
   * Retourne { data, fileName } ou null si annulé.
   */
  async function pickAndLoadFile() {
    /* ── Tentative File System Access API (Chrome, écriture directe) ── */
    if (supportsFileSystemAccess()) {
      try {
        let handle;
        [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Fichier JSON Saxo Agenda',
            accept: { 'application/json': ['.json'] },
          }],
          excludeAcceptAllOption: false,
          multiple: false,
        });

        const data = await _readHandle(handle);
        if (!data) return null;

        _fileHandle = handle;
        await _saveHandleToIDB(handle);
        saveToLocalStorage(data);
        updateSyncStatus('saved');
        return { data, fileName: handle.name };

      } catch (e) {
        if (e.name === 'AbortError') return null;
        /* FSA non fonctionnel dans ce navigateur → fallback */
        console.warn('[FS] showOpenFilePicker indisponible, fallback input :', e.message);
      }
    }

    /* ── Fallback universel : <input type="file"> (Firefox, etc.) ── */
    return await _loadFileViaInput();
  }

  /**
   * Ouvre un <input type="file"> programmatique (fallback Firefox).
   * Pas d'écriture automatique : les sauvegardes vont dans localStorage
   * + download manuel via le bouton "Exporter JSON".
   */
  function _loadFileViaInput() {
    return new Promise((resolve) => {
      const input    = document.createElement('input');
      input.type     = 'file';
      input.accept   = '.json,application/json';

      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) { resolve(null); return; }
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.events) data.events = [];
          if (!data.meta)   data.meta   = { typologies: ['Concert', 'Mariage'], setTypes: [] };
          /* Mémorise le nom pour l'afficher dans la sidebar */
          _fallbackFileName = file.name;
          saveToLocalStorage(data);
          updateSyncStatus('cache-only');
          resolve({ data, fileName: file.name });
        } catch (err) {
          console.error('[Input] Lecture échouée :', err.message);
          resolve(null);
        }
      };

      /* Certains navigateurs ne déclenchent pas onchange si annulé */
      input.oncancel = () => resolve(null);
      input.click();

      /* Sécurité : résoudre après 5 min si rien ne se passe */
      setTimeout(() => resolve(null), 300_000);
    });
  }

  /* Nom de fichier mémorisé en mode fallback (pas de FileHandle) */
  let _fallbackFileName = null;

  /**
   * Tente de rouvrir le dernier fichier utilisé (handle stocké en IDB).
   * Retourne { data, fileName, needsPermission }
   *   - needsPermission : true si l'utilisateur doit confirmer l'accès
   *   - data : null si la permission est refusée ou le fichier introuvable
   */
  async function tryReopenLastFile() {
    if (!supportsFileSystemAccess()) return { data: null, needsPermission: false };

    const handle = await _loadHandleFromIDB();
    if (!handle) return { data: null, needsPermission: false };

    /* Vérifie l'état de la permission sans déclencher de prompt */
    let permission = await handle.queryPermission({ mode: 'readwrite' });

    if (permission === 'prompt') {
      /* Sur Android, la permission est toujours à re-demander */
      return { data: null, needsPermission: true, handle, fileName: handle.name };
    }

    if (permission === 'granted') {
      const data = await _readHandle(handle);
      if (!data) return { data: null, needsPermission: false };
      _fileHandle = handle;
      saveToLocalStorage(data);
      updateSyncStatus('saved');
      return { data, needsPermission: false, fileName: handle.name };
    }

    /* Permission refusée définitivement */
    await _clearHandleFromIDB();
    return { data: null, needsPermission: false };
  }

  /**
   * Demande explicitement la permission d'accès à un handle connu.
   * À appeler après que l'utilisateur ait cliqué un bouton (gesture requise).
   */
  async function requestPermissionAndLoad(handle) {
    try {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return null;

      const data = await _readHandle(handle);
      if (!data) return null;

      _fileHandle = handle;
      saveToLocalStorage(data);
      updateSyncStatus('saved');
      return { data, fileName: handle.name };
    } catch (e) {
      console.warn('[FS] Permission refusée :', e.message);
      return null;
    }
  }

  /**
   * Lit et parse le contenu JSON d'un FileSystemFileHandle.
   * Retourne l'objet ou null en cas d'erreur.
   */
  async function _readHandle(handle) {
    try {
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      /* Normalise la structure au minimum attendu */
      if (!data.events) data.events = [];
      if (!data.meta)   data.meta   = { typologies: ['Concert', 'Mariage'], setTypes: ['Messe', 'Cérémonie laïque', "Vin d'honneur", 'Défilé', 'Scène'] };
      return data;
    } catch (e) {
      console.warn('[FS] Lecture fichier échouée :', e.message);
      return null;
    }
  }

  /**
   * Écrit les données dans le fichier ouvert.
   * Met aussi à jour le cache localStorage.
   * Retourne true si succès.
   */
  async function saveToFile(data) {
    if (!_fileHandle) return false;

    try {
      updateSyncStatus('syncing');
      const payload  = { ...data, savedAt: new Date().toISOString() };
      const writable = await _fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      saveToLocalStorage(payload);
      updateSyncStatus('saved');
      return true;
    } catch (e) {
      console.error('[FS] Écriture fichier échouée :', e.message);
      updateSyncStatus('error');
      return false;
    }
  }

  /**
   * Crée un nouveau fichier JSON vide via le sélecteur "Enregistrer sous".
   * Utile pour initialiser le fichier dans le dossier MEGA.
   */
  async function createNewFile() {
    if (!supportsFileSystemAccess() || !('showSaveFilePicker' in window)) return null;

    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: 'saxo-agenda.json',
        types: [{
          description: 'Fichier JSON Saxo Agenda',
          accept: { 'application/json': ['.json'] },
        }],
      });
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }

    const emptyData = {
      events: [],
      meta: {
        typologies: ['Concert', 'Mariage'],
        setTypes:   ['Messe', 'Cérémonie laïque', "Vin d'honneur", 'Défilé', 'Scène'],
      },
      savedAt: new Date().toISOString(),
    };

    _fileHandle = handle;
    await _saveHandleToIDB(handle);
    await saveToFile(emptyData);
    return { data: emptyData, fileName: handle.name };
  }

  /**
   * Retourne le nom du fichier actuellement ouvert, ou null.
   */
  function getCurrentFileName() {
    return _fileHandle ? _fileHandle.name : (_fallbackFileName || null);
  }

  /**
   * Oublie le fichier courant (déconnexion).
   */
  async function forgetFile() {
    _fileHandle = null;
    await _clearHandleFromIDB();
    updateSyncStatus('disconnected');
  }


  /* ══════════════════════════════════════
     CACHE LOCAL (localStorage)
     ══════════════════════════════════════ */

  function saveToLocalStorage(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      localStorage.setItem(LS_META_KEY, JSON.stringify({
        savedAt:    new Date().toISOString(),
        eventCount: (data.events || []).length,
        fileName:   _fileHandle?.name || null,
      }));
    } catch (e) {
      console.warn('[LS] localStorage indisponible :', e.message);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.events) data.events = [];
      if (!data.meta)   data.meta   = { typologies: ['Concert', 'Mariage'], setTypes: [] };
      return data;
    } catch (e) {
      console.warn('[LS] Lecture échouée :', e.message);
      return null;
    }
  }

  function getLocalMeta() {
    try {
      const raw = localStorage.getItem(LS_META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }


  /* ══════════════════════════════════════
     EXPORT JSON (téléchargement de secours)
     ══════════════════════════════════════ */

  function downloadJSON(data) {
    const payload = { ...data, exportedAt: new Date().toISOString() };
    const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.download    = `saxo-agenda-${dayjs().format('YYYY-MM-DD')}.json`;
    a.href        = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    SaxoUI.toast('Export téléchargé ✓', 'success');
  }


  /* ══════════════════════════════════════
     SAUVEGARDE PRINCIPALE — appelée après chaque modification
     ══════════════════════════════════════ */

  /**
   * Tente d'abord d'écrire dans le fichier MEGA,
   * puis met à jour le cache localStorage dans tous les cas.
   */
  async function save(data) {
    /* Toujours mettre à jour le cache local */
    saveToLocalStorage(data);

    if (_fileHandle) {
      return await saveToFile(data);
    } else {
      /* Pas de fichier ouvert : on sauvegarde uniquement en localStorage */
      updateSyncStatus('cache-only');
      return true;
    }
  }


  /* ══════════════════════════════════════
     INDICATEUR DE SYNCHRONISATION
     ══════════════════════════════════════ */

  function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const labels = {
      syncing:      '⟳ Écriture…',
      saved:        '✓ Fichier MEGA à jour',
      error:        '⚠ Erreur écriture',
      'cache-only': '⚡ Cache local — exporter pour sync',
      disconnected: '— Aucun fichier',
    };
    const colors = {
      syncing:      '#8a8580',
      saved:        '#6dd4a0',
      error:        '#f07070',
      'cache-only': '#d4a84c',
      disconnected: '#8a8580',
    };
    el.textContent = labels[status] || '—';
    el.style.color  = colors[status] || '#8a8580';
  }


  /* ── API publique ── */
  return {
    supportsFileSystemAccess,
    pickAndLoadFile,
    tryReopenLastFile,
    requestPermissionAndLoad,
    createNewFile,
    getCurrentFileName,
    forgetFile,
    save,
    saveToLocalStorage,
    loadFromLocalStorage,
    getLocalMeta,
    downloadJSON,
    updateSyncStatus,
  };

})();
