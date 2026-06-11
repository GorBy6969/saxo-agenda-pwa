/* ══════════════════════════════════════════════════════════
   events.js — CRUD des événements + formulaire de saisie
   ──────────────────────────────────────────────────────────
   Gère :
     - Ouverture/fermeture de la modale
     - Construction du formulaire HTML (sections dynamiques)
     - Lecture du formulaire (collecte des valeurs)
     - Création, modification, suppression, duplication
     - Helpers de fréquence pour les comboboxes
   ══════════════════════════════════════════════════════════ */

const SaxoEvents = (() => {

  /* ── ID de l'événement en cours d'édition (null = nouvel événement) ── */
  let editingId = null;


  /* ══════════════════════════════════════
     HELPERS FRÉQUENCE — alimentation des comboboxes
     ══════════════════════════════════════ */

  /**
   * Retourne la liste des valeurs distinctes d'un champ scalaire,
   * triée par nombre d'occurrences décroissant.
   * @param {string} field — nom du champ dans Event (ex: 'lieu', 'groupe')
   */
  function freqList(field) {
    const counts = {};
    (window._db?.events || []).forEach(ev => {
      const v = ev[field];
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
  }

  /**
   * Retourne les typologies disponibles (méta + utilisées),
   * triées par fréquence d'utilisation.
   */
  function getTypologies() {
    const base   = [...(window._db?.meta?.typologies || ['Concert', 'Mariage'])];
    const counts = {};
    (window._db?.events || []).forEach(ev => {
      if (ev.type) counts[ev.type] = (counts[ev.type] || 0) + 1;
    });
    // Ajoute les typologies utilisées mais pas encore dans la méta
    Object.keys(counts).forEach(u => { if (!base.includes(u)) base.push(u); });
    return base.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  }

  /**
   * Retourne les types de sets disponibles, triés par fréquence.
   */
  function getSetTypes() {
    const base   = [...(window._db?.meta?.setTypes ||
                   ['Messe', 'Cérémonie laïque', "Vin d'honneur", 'Défilé', 'Scène'])];
    const counts = {};
    (window._db?.events || []).forEach(ev =>
      (ev.sets || []).forEach(s => {
        if (s.type) counts[s.type] = (counts[s.type] || 0) + 1;
      })
    );
    Object.keys(counts).forEach(u => { if (!base.includes(u)) base.push(u); });
    return base.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  }


  /* ══════════════════════════════════════
     MODALE — ouverture / fermeture
     ══════════════════════════════════════ */

  /**
   * Ouvre la modale en mode création ou édition.
   * @param {string|null} id          — ID de l'événement à éditer, null pour créer
   * @param {string}      prefillDate — Date pré-remplie (clic sur une cellule du calendrier)
   */
  function openModal(id, prefillDate = '') {
    editingId = id;
    const ev = id ? (window._db?.events || []).find(e => e.id === id) : null;
    const isNew = !ev;

    /* Données de travail : copie profonde pour ne pas muter l'original */
    const data = ev
      ? JSON.parse(JSON.stringify(ev))
      : {
          id:               _uid(),
          name:             '',
          type:             '',
          date:             prefillDate,
          lieu:             '',
          groupe:           '',
          organisateur:     '',
          prix:             '',
          heureIntervention:'',
          heureArrivee:     '',
          contacts:         [{ nom:'', prenom:'', tel:'', mail:'' }],
          sets:             [{ type:'', debut:'', fin:'', lieu:'' }],
          notes:            [],
          partners:         [],
          archived:         false,
        };

    /* Titre et boutons conditionnels */
    document.getElementById('modal-title').textContent = isNew ? 'Nouvel événement' : (ev.name || 'Événement');
    document.getElementById('btn-delete').style.display    = isNew ? 'none' : '';
    document.getElementById('btn-duplicate').style.display = isNew ? 'none' : '';

    /* Injection du formulaire */
    document.getElementById('modal-body').innerHTML = _buildForm(data);

    /* Ouvre la modale via le store Alpine */
    Alpine.store('modal').open = true;

    /* Recrée les icônes Lucide dans le nouveau HTML injecté */
    SaxoUI.refreshIcons();
  }

  /** Ferme la modale et nettoie l'état d'édition */
  function closeModal() {
    Alpine.store('modal').open = false;
    editingId = null;
  }


  /* ══════════════════════════════════════
     CONSTRUCTION DU FORMULAIRE
     ══════════════════════════════════════ */

  /**
   * Génère le HTML complet du formulaire d'événement.
   * Divisé en sections : Infos générales, Contacts, Sets, Notes, Partenaires.
   */
  function _buildForm(ev) {
    const e = SaxoUI.escHtml;

    return `
      ${_sectionInfos(ev)}
      ${_sectionContacts(ev)}
      ${_sectionSets(ev)}
      ${_sectionNotes(ev)}
      ${_sectionPartners(ev)}
      ${_sectionOptions(ev)}
    `;
  }

  /* ── Section 1 : Informations générales ── */
  function _sectionInfos(ev) {
    const e = SaxoUI.escHtml;
    return `
    <div class="form-section">
      <div class="form-section-title">Informations générales</div>

      <div class="form-group full">
        <label>Nom de l'événement *</label>
        <input type="text" id="f-name" value="${e(ev.name)}" placeholder="Ex : Mariage Dupont">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Typologie</label>
          ${SaxoUI.buildCombo('f-type', 'Concert, Mariage…', getTypologies(), ev.type)}
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="f-date" value="${e(ev.date)}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Lieu</label>
          ${SaxoUI.buildCombo('f-lieu', 'Salle, ville…', freqList('lieu'), ev.lieu)}
        </div>
        <div class="form-group">
          <label>Groupe de musique</label>
          ${SaxoUI.buildCombo('f-groupe', 'Nom du groupe', freqList('groupe'), ev.groupe)}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Organisateur</label>
          ${SaxoUI.buildCombo('f-organisateur', 'Nom organisateur', freqList('organisateur'), ev.organisateur)}
        </div>
        <div class="form-group">
          <label>Prix négocié (€)</label>
          <input type="text" id="f-prix" value="${e(ev.prix)}" placeholder="Ex : 800">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>1ère intervention</label>
          <input type="time" id="f-heureIntervention" value="${e(ev.heureIntervention)}">
        </div>
        <div class="form-group">
          <label>Heure d'arrivée prévue</label>
          <input type="time" id="f-heureArrivee" value="${e(ev.heureArrivee)}">
        </div>
      </div>
    </div>`;
  }

  /* ── Section 2 : Contacts ── */
  function _sectionContacts(ev) {
    const contacts = ev.contacts?.length ? ev.contacts : [{ nom:'', prenom:'', tel:'', mail:'' }];
    return `
    <div class="form-section">
      <div class="form-section-title">Contacts</div>
      <div id="contacts-list">
        ${contacts.map((c, i) => _contactBlock(c, i)).join('')}
      </div>
      <button class="btn-add" onclick="SaxoEvents.addContact()">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        Ajouter un contact
      </button>
    </div>`;
  }

  /** HTML d'un bloc contact */
  function _contactBlock(c, i) {
    const e = SaxoUI.escHtml;
    return `
    <div class="dynamic-block" id="contact-${i}">
      <div class="dynamic-block-header">
        <span class="dynamic-block-title">Contact ${i + 1}</span>
        <button class="btn-remove" onclick="SaxoEvents.removeBlock('contact-${i}')">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nom</label>
          <input type="text" class="c-nom" value="${e(c.nom)}"></div>
        <div class="form-group"><label>Prénom</label>
          <input type="text" class="c-prenom" value="${e(c.prenom)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Téléphone</label>
          <input type="tel" class="c-tel" value="${e(c.tel)}"></div>
        <div class="form-group"><label>Email</label>
          <input type="email" class="c-mail" value="${e(c.mail)}"></div>
      </div>
    </div>`;
  }

  /* ── Section 3 : Sets ── */
  function _sectionSets(ev) {
    const sets = ev.sets?.length ? ev.sets : [{ type:'', debut:'', fin:'', lieu:'' }];
    return `
    <div class="form-section">
      <div class="form-section-title">Sets</div>
      <div id="sets-list">
        ${sets.map((s, i) => _setBlock(s, i)).join('')}
      </div>
      <button class="btn-add" onclick="SaxoEvents.addSet()">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        Ajouter un set
      </button>
    </div>`;
  }

  /** HTML d'un bloc set */
  function _setBlock(s, i) {
    const e = SaxoUI.escHtml;
    return `
    <div class="dynamic-block" id="set-${i}">
      <div class="dynamic-block-header">
        <span class="dynamic-block-title">Set ${i + 1}</span>
        <button class="btn-remove" onclick="SaxoEvents.removeBlock('set-${i}')">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="form-group">
        <label>Type de set</label>
        ${SaxoUI.buildCombo('set-type-' + i, 'Messe, Vin d\'honneur…', getSetTypes(), s.type)}
      </div>
      <div class="form-row">
        <div class="form-group"><label>Début</label>
          <input type="time" class="s-debut" value="${e(s.debut)}"></div>
        <div class="form-group"><label>Fin</label>
          <input type="time" class="s-fin" value="${e(s.fin)}"></div>
      </div>
      <div class="form-group"><label>Lieu du set</label>
        <input type="text" class="s-lieu" value="${e(s.lieu)}" placeholder="Salle, chapelle…"></div>
    </div>`;
  }

  /* ── Section 4 : Notes libres ── */
  function _sectionNotes(ev) {
    return `
    <div class="form-section">
      <div class="form-section-title">Notes</div>
      <div id="notes-list">
        ${(ev.notes || []).map((n, i) => _noteBlock(n, i)).join('')}
      </div>
      <button class="btn-add" onclick="SaxoEvents.addNote()">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        Ajouter une note
      </button>
    </div>`;
  }

  /** HTML d'un bloc note */
  function _noteBlock(n, i) {
    return `
    <div class="dynamic-block" id="note-${i}">
      <div class="dynamic-block-header">
        <span class="dynamic-block-title">Note ${i + 1}</span>
        <button class="btn-remove" onclick="SaxoEvents.removeBlock('note-${i}')">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <textarea class="n-text" rows="3">${SaxoUI.escHtml(n)}</textarea>
    </div>`;
  }

  /* ── Section 5 : Partenaires ── */
  function _sectionPartners(ev) {
    return `
    <div class="form-section">
      <div class="form-section-title">Partenaires</div>
      <div id="partners-list">
        ${(ev.partners || []).map((p, i) => _partnerBlock(p, i)).join('')}
      </div>
      <button class="btn-add" onclick="SaxoEvents.addPartner()">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        Ajouter un partenaire
      </button>
    </div>`;
  }

  /** HTML d'un bloc partenaire */
  function _partnerBlock(p, i) {
    return `
    <div class="dynamic-block" id="partner-${i}">
      <div class="dynamic-block-header">
        <span class="dynamic-block-title">Partenaire ${i + 1}</span>
        <button class="btn-remove" onclick="SaxoEvents.removeBlock('partner-${i}')">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <input type="text" class="p-name" value="${SaxoUI.escHtml(p)}" placeholder="Nom du partenaire">
    </div>`;
  }

  /* ── Section 6 : Options (archivage) ── */
  function _sectionOptions(ev) {
    const checked = ev.archived ? 'checked' : '';
    return `
    <div class="form-section">
      <div class="form-section-title">Options</div>
      <div class="checkbox-group">
        <input type="checkbox" id="f-archived" ${checked}>
        <label for="f-archived">Archiver cet événement</label>
      </div>
    </div>`;
  }


  /* ══════════════════════════════════════
     BLOCS DYNAMIQUES — ajout/suppression
     ══════════════════════════════════════ */

  /** Ajoute un bloc contact à la fin de la liste */
  function addContact() {
    const list = document.getElementById('contacts-list');
    const i    = list.querySelectorAll('.dynamic-block').length;
    list.insertAdjacentHTML('beforeend', _contactBlock({ nom:'', prenom:'', tel:'', mail:'' }, i));
    SaxoUI.refreshIcons();
  }

  /** Ajoute un bloc set */
  function addSet() {
    const list = document.getElementById('sets-list');
    const i    = list.querySelectorAll('.dynamic-block').length;
    list.insertAdjacentHTML('beforeend', _setBlock({ type:'', debut:'', fin:'', lieu:'' }, i));
    SaxoUI.refreshIcons();
  }

  /** Ajoute un bloc note */
  function addNote() {
    const list = document.getElementById('notes-list');
    const i    = list.querySelectorAll('.dynamic-block').length;
    list.insertAdjacentHTML('beforeend', _noteBlock('', i));
    SaxoUI.refreshIcons();
  }

  /** Ajoute un bloc partenaire */
  function addPartner() {
    const list = document.getElementById('partners-list');
    const i    = list.querySelectorAll('.dynamic-block').length;
    list.insertAdjacentHTML('beforeend', _partnerBlock('', i));
    SaxoUI.refreshIcons();
  }

  /** Supprime un bloc dynamique par son ID */
  function removeBlock(blockId) {
    const el = document.getElementById(blockId);
    if (el) el.remove();
  }


  /* ══════════════════════════════════════
     COLLECTE DU FORMULAIRE
     ══════════════════════════════════════ */

  /**
   * Lit tous les champs du formulaire et retourne un objet Event propre.
   * Appelé juste avant la sauvegarde.
   */
  function _collectForm() {
    const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

    const ev = {
      id:               editingId || _uid(),
      name:             g('f-name'),
      type:             g('f-type'),
      date:             g('f-date'),
      lieu:             g('f-lieu'),
      groupe:           g('f-groupe'),
      organisateur:     g('f-organisateur'),
      prix:             g('f-prix'),
      heureIntervention:g('f-heureIntervention'),
      heureArrivee:     g('f-heureArrivee'),
      archived:         document.getElementById('f-archived')?.checked || false,
      contacts:         [],
      sets:             [],
      notes:            [],
      partners:         [],
    };

    /* Contacts */
    document.querySelectorAll('#contacts-list .dynamic-block').forEach(bl => {
      ev.contacts.push({
        nom:    bl.querySelector('.c-nom')?.value.trim()  || '',
        prenom: bl.querySelector('.c-prenom')?.value.trim()|| '',
        tel:    bl.querySelector('.c-tel')?.value.trim()  || '',
        mail:   bl.querySelector('.c-mail')?.value.trim() || '',
      });
    });

    /* Sets */
    document.querySelectorAll('#sets-list .dynamic-block').forEach((bl, i) => {
      ev.sets.push({
        type:  document.getElementById('set-type-' + i)?.value.trim() || '',
        debut: bl.querySelector('.s-debut')?.value.trim() || '',
        fin:   bl.querySelector('.s-fin')?.value.trim()   || '',
        lieu:  bl.querySelector('.s-lieu')?.value.trim()  || '',
      });
    });

    /* Notes */
    document.querySelectorAll('#notes-list .dynamic-block').forEach(bl => {
      const v = bl.querySelector('.n-text')?.value.trim();
      if (v) ev.notes.push(v);
    });

    /* Partenaires */
    document.querySelectorAll('#partners-list .dynamic-block').forEach(bl => {
      const v = bl.querySelector('.p-name')?.value.trim();
      if (v) ev.partners.push(v);
    });

    return ev;
  }


  /* ══════════════════════════════════════
     CRUD — Créer / Modifier / Supprimer / Dupliquer
     ══════════════════════════════════════ */

  /**
   * Sauvegarde l'événement (création ou modification).
   * Met à jour la BD locale, puis synchronise avec le serveur.
   */
  async function saveEvent() {
    const ev = _collectForm();

    /* Validation minimale */
    if (!ev.name) {
      SaxoUI.toast('Le nom est requis', 'error');
      return;
    }

    /* Mise à jour ou ajout dans la liste */
    const idx = (window._db.events || []).findIndex(e => e.id === editingId);
    if (idx >= 0) {
      window._db.events[idx] = ev;
    } else {
      window._db.events.push(ev);
    }

    /* Enrichit la méta avec les nouvelles valeurs (typologies, setTypes) */
    _updateMeta(ev);

    /* Ferme la modale */
    closeModal();

    /* Sauvegarde (fichier MEGA + cache localStorage) */
    await SaxoStorage.save(window._db);

    /* Rafraîchit la vue */
    window._renderCurrentView();
    SaxoUI.toast(idx >= 0 ? 'Événement modifié ✓' : 'Événement créé ✓', 'success');
  }

  /**
   * Supprime l'événement en cours d'édition après confirmation.
   */
  async function deleteEvent() {
    if (!editingId) return;
    if (!confirm('Supprimer cet événement ?')) return;

    window._db.events = window._db.events.filter(e => e.id !== editingId);
    closeModal();

    await SaxoStorage.save(window._db);

    window._renderCurrentView();
    SaxoUI.toast('Événement supprimé');
  }

  /**
   * Duplique l'événement courant : crée une copie avec la date effacée.
   * Ouvre immédiatement la modale en mode création avec les données copiées.
   */
  function duplicateEvent() {
    const ev = (window._db?.events || []).find(e => e.id === editingId);
    if (!ev) return;

    const copy    = JSON.parse(JSON.stringify(ev));
    copy.id       = _uid();
    copy.date     = '';              // date volontairement vide
    copy.name     = (copy.name || '') + ' (copie)';
    copy.archived = false;

    closeModal();

    /* Ouvre la modale avec les données copiées (sans ID existant → création) */
    editingId = null;
    document.getElementById('modal-title').textContent = copy.name;
    document.getElementById('btn-delete').style.display    = 'none';
    document.getElementById('btn-duplicate').style.display = 'none';
    document.getElementById('modal-body').innerHTML = _buildForm(copy);
    Alpine.store('modal').open = true;
    SaxoUI.refreshIcons();
  }

  /**
   * Met à jour les listes de méta (typologies, setTypes) avec les nouvelles valeurs saisies.
   */
  function _updateMeta(ev) {
    if (!window._db.meta) window._db.meta = { typologies: [], setTypes: [] };

    if (ev.type && !window._db.meta.typologies.includes(ev.type)) {
      window._db.meta.typologies.push(ev.type);
    }
    (ev.sets || []).forEach(s => {
      if (s.type && !window._db.meta.setTypes.includes(s.type)) {
        window._db.meta.setTypes.push(s.type);
      }
    });
  }


  /* ══════════════════════════════════════
     GOOGLE AGENDA — lien "Ajouter à Google Agenda"
     ══════════════════════════════════════ */

  /** Ajoute des minutes à une heure "HH:MM". Retourne "HH:MM". */
  function _addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(':').map(Number);
    const total  = (h * 60 + m + minutes) % (24 * 60);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' +
           String(total % 60).padStart(2, '0');
  }

  /**
   * Construit le paramètre `dates` de Google Calendar.
   * - Avec horaires : YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS (heure locale)
   * - Sans horaire  : événement "journée entière" YYYYMMDD/YYYYMMDD+1
   */
  function _gcalDates(ev) {
    if (!ev.date) return null;
    const d = ev.date.replace(/-/g, '');

    const sets  = (ev.sets || []).filter(s => s.debut || s.fin);
    const start = ev.heureArrivee || ev.heureIntervention || sets[0]?.debut || '';
    const lastEnd = sets.map(s => s.fin).filter(Boolean).pop() || '';

    if (!start) {
      /* Journée entière : date de fin exclusive = lendemain */
      const next = new Date(ev.date + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      const n = next.getFullYear() +
                String(next.getMonth() + 1).padStart(2, '0') +
                String(next.getDate()).padStart(2, '0');
      return `${d}/${n}`;
    }

    /* Fin : dernier set, sinon début + 3 h (et fin > début) */
    let end = lastEnd && lastEnd > start ? lastEnd : _addMinutes(start, 180);
    const t = s => s.replace(':', '') + '00';
    return `${d}T${t(start)}/${d}T${t(end)}`;
  }

  /** Construit le texte "détails" de l'événement Google. */
  function _gcalDetails(ev) {
    const L = [];
    if (ev.type)              L.push('Typologie : ' + ev.type);
    if (ev.groupe)            L.push('Groupe : ' + ev.groupe);
    if (ev.organisateur)      L.push('Organisateur : ' + ev.organisateur);
    if (ev.prix)              L.push('Prix : ' + ev.prix + ' €');
    if (ev.heureArrivee)      L.push('Arrivée : ' + ev.heureArrivee);
    if (ev.heureIntervention) L.push('1ère intervention : ' + ev.heureIntervention);

    (ev.sets || []).forEach((s, i) => {
      if (!s.type && !s.debut && !s.lieu) return;
      L.push(`Set ${i + 1} : ${s.type || '—'} ${s.debut || ''}${s.fin ? '–' + s.fin : ''}` +
             (s.lieu ? ' @ ' + s.lieu : ''));
    });

    (ev.contacts || []).forEach(c => {
      const line = [c.prenom, c.nom].filter(Boolean).join(' ');
      const coord = [c.tel, c.mail].filter(Boolean).join(' · ');
      if (line || coord) L.push('Contact : ' + [line, coord].filter(Boolean).join(' — '));
    });

    if (ev.partners?.length) L.push('Partenaires : ' + ev.partners.join(', '));
    (ev.notes || []).forEach(n => L.push('Note : ' + n));

    return L.join('\n');
  }

  /**
   * Ouvre Google Calendar pré-rempli avec l'événement.
   * @param {string|null} id — ID de l'événement ; null = formulaire en cours
   */
  function addToGoogleCalendar(id = null) {
    const ev = id
      ? (window._db?.events || []).find(e => e.id === id)
      : _collectForm();
    if (!ev) return;

    const dates = _gcalDates(ev);
    if (!dates) {
      SaxoUI.toast('Renseignez une date d\'abord', 'error');
      return;
    }

    const params = new URLSearchParams({
      action:   'TEMPLATE',
      text:     ev.name || 'Événement saxo',
      dates,
      details:  _gcalDetails(ev),
      location: ev.lieu || '',
    });

    window.open('https://calendar.google.com/calendar/render?' + params.toString(), '_blank');
  }


  /* ══════════════════════════════════════
     UTILITAIRES
     ══════════════════════════════════════ */

  /** Génère un identifiant unique court */
  function _uid() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }


  /* ── API publique du module ── */
  return {
    openModal,
    closeModal,
    saveEvent,
    deleteEvent,
    duplicateEvent,
    addContact,
    addSet,
    addNote,
    addPartner,
    removeBlock,
    addToGoogleCalendar,
  };

})();
