/* ══════════════════════════════════════════════════════════
   app.js — Point d'entrée Alpine.js, état global, init
   ──────────────────────────────────────────────────────────
   Ce fichier :
     1. Définit les composants Alpine (saxoApp, initScreen)
     2. Expose la BD globale (window._db) partagée entre modules
     3. Expose window._renderCurrentView() utilisé par events.js
     4. Enregistre le store Alpine pour la modale
     5. Enregistre le Service Worker (PWA)
   ══════════════════════════════════════════════════════════ */

/* ── BD globale partagée entre tous les modules JS ── */
window._db = {
  events: [],
  meta: {
    typologies: ['Concert', 'Mariage'],
    setTypes: ['Messe', 'Cérémonie laïque', "Vin d'honneur", 'Défilé', 'Scène'],
  },
};

/* ── Flag global : l'app est-elle prête ? ── */
window.appReady = false;


/* ══════════════════════════════════════════════════════════
   STORE ALPINE — modale (partagée entre composants)
   ══════════════════════════════════════════════════════════ */
document.addEventListener('alpine:init', () => {

  /* Store partagé : état global de l'application */
  Alpine.store('appState', {
    ready: false,
  });

  Alpine.store('modal', {
    open: false,
    close() {
      this.open = false;
      SaxoEvents.closeModal();
    },
  });

});


/* ══════════════════════════════════════════════════════════
   COMPOSANT ALPINE — Écran d'accueil
   ══════════════════════════════════════════════════════════ */
function initScreen() {
  return {
    loading:      false,
    error:        '',
    appReady:     false,

    /* État de l'écran de chargement :
       'start'        → premier affichage, aucune donnée connue
       'ask-reopen'   → un fichier connu existe, demande de confirmation
       'no-fsa'       → File System Access non supporté (Firefox…)
    */
    screen: 'start',

    /* Handle en attente de permission (Android) */
    _pendingHandle: null,
    _pendingFileName: '',

    /* Infos sur le cache localStorage */
    cacheInfo: null,

    async mounted() {
      this.cacheInfo = SaxoStorage.getLocalMeta();

      /* Tente de rouvrir le dernier fichier silencieusement */
      if (SaxoStorage.supportsFileSystemAccess()) {
        const result = await SaxoStorage.tryReopenLastFile();

        if (result.data) {
          /* Succès silencieux (permission déjà accordée) */
          this._enterApp(result.data, result.fileName);
          return;
        }

        if (result.needsPermission) {
          /* Android / session fraîche : demande d'un tap utilisateur */
          this._pendingHandle   = result.handle;
          this._pendingFileName = result.fileName;
          this.screen = 'ask-reopen';
          return;
        }
      } else {
        this.screen = 'no-fsa';
      }

      /* Aucun fichier connu : écran de démarrage standard */
      this.screen = 'start';
    },

    /* ── L'utilisateur confirme la réouverture du dernier fichier (Android) ── */
    async confirmReopen() {
      this.loading = true;
      this.error   = '';
      const result = await SaxoStorage.requestPermissionAndLoad(this._pendingHandle);
      if (result) {
        this._enterApp(result.data, result.fileName);
      } else {
        this.error  = 'Accès refusé. Choisissez le fichier manuellement.';
        this.screen = 'start';
        this.loading = false;
      }
    },

    /* ── Ouvre le sélecteur de fichier MEGA ── */
    async openFilePicker() {
      this.loading = true;
      this.error   = '';
      try {
        const result = await SaxoStorage.pickAndLoadFile();
        if (!result) { this.loading = false; return; } // annulé
        this._enterApp(result.data, result.fileName);
      } catch (e) {
        this.error   = 'Erreur de lecture : ' + e.message;
        this.loading = false;
      }
    },

    /* ── Crée un nouveau fichier dans le dossier MEGA ── */
    async createFile() {
      this.loading = true;
      this.error   = '';
      try {
        const result = await SaxoStorage.createNewFile();
        if (!result) { this.loading = false; return; }
        this._enterApp(result.data, result.fileName);
      } catch (e) {
        this.error   = 'Erreur de création : ' + e.message;
        this.loading = false;
      }
    },

    /* ── Utilise le cache localStorage (mode hors-ligne ou sans MEGA) ── */
    useCache() {
      const data = SaxoStorage.loadFromLocalStorage();
      if (data) {
        SaxoStorage.updateSyncStatus('cache-only');
        this._enterApp(data, null);
      } else {
        this.error = 'Aucun cache disponible.';
      }
    },

    /* ── Active l'app avec les données chargées ── */
    _enterApp(data, fileName) {
      window._db   = data;
      this.loading = false;
      /* Déclenche l'affichage de l'app via le store Alpine réactif */
      Alpine.store('appState').ready = true;
      /* Met à jour le nom de fichier affiché dans la sidebar */
      this.$nextTick(() => {
        const el = document.getElementById('file-name');
        if (el) el.textContent = fileName || 'Cache local';
      });
    },
  };
}


/* ══════════════════════════════════════════════════════════
   COMPOSANT ALPINE — Application principale
   ══════════════════════════════════════════════════════════ */
function saxoApp() {
  return {
    /* ── État local du composant ── */
    view:        'agenda',
    calView:     'month',
    calDate:     new Date(),
    calTitle:    '',
    sidebarOpen: false,

    /* ── Initialisation ── */
    init() {
      window._renderCurrentView = () => this.renderCurrentView();

      this.calTitle = SaxoCalendar.getTitle(this.calView, this.calDate);
      this.$nextTick(() => {
        this.renderCurrentView();
        lucide.createIcons();
      });

      /* Raccourci Ctrl/Cmd+S → sauvegarde forcée */
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          SaxoStorage.save(window._db);
        }
      });
    },

    setView(v) {
      this.view = v;
      this.$nextTick(() => this.renderCurrentView());
    },

    renderCurrentView() {
      if (this.view === 'agenda') {
        SaxoCalendar.render(this.calView, this.calDate);
      } else {
        SaxoCalendar.renderList();
      }
    },

    calPrev() {
      if (this.calView === 'month') {
        this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() - 1, 1);
      } else {
        this.calDate = new Date(this.calDate);
        this.calDate.setDate(this.calDate.getDate() - 7);
      }
      this.calTitle = SaxoCalendar.getTitle(this.calView, this.calDate);
      this.renderCurrentView();
    },

    calNext() {
      if (this.calView === 'month') {
        this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() + 1, 1);
      } else {
        this.calDate = new Date(this.calDate);
        this.calDate.setDate(this.calDate.getDate() + 7);
      }
      this.calTitle = SaxoCalendar.getTitle(this.calView, this.calDate);
      this.renderCurrentView();
    },

    renderCal() {
      this.calTitle = SaxoCalendar.getTitle(this.calView, this.calDate);
      this.renderCurrentView();
    },

    openModal(id, prefillDate) {
      SaxoEvents.openModal(id, prefillDate);
    },

    exportJSON() {
      SaxoStorage.downloadJSON(window._db);
    },

    /* ── Changer de fichier MEGA ── */
    async changeFile() {
      await SaxoStorage.forgetFile();
      window.appReady = false;
      this.appReady   = false;
      /* Recharge la page pour revenir à l'écran d'accueil */
      window.location.reload();
    },
  };
}


/* ══════════════════════════════════════════════════════════
   SERVICE WORKER — enregistrement PWA
   ══════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] SW enregistré :', reg.scope))
      .catch(err => console.warn('[PWA] Échec SW :', err));
  });
}
