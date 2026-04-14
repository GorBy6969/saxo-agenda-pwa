/* ══════════════════════════════════════════════════════════
   calendar.js — Rendu du calendrier (vues mois et semaine)
   ──────────────────────────────────────────────────────────
   Utilise Day.js pour toutes les manipulations de dates.
   Génère du HTML pur injecté dans #view-agenda.
   ══════════════════════════════════════════════════════════ */

const SaxoCalendar = (() => {

  /* Noms localisés — Day.js locale FR chargée dans index.html */
  dayjs.locale('fr');
  const MONTHS_FR    = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun',
                        'Jul','Aoû','Sep','Oct','Nov','Déc'];
  const DAYS_HEADER  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const DAYS_SHORT   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']; // index = getDay()


  /* ══════════════════════════════════════
     POINT D'ENTRÉE — rendu selon la vue active
     ══════════════════════════════════════ */

  /**
   * Rend le calendrier dans #view-agenda.
   * @param {string} calView  — 'month' | 'week'
   * @param {Date}   calDate  — date de référence (n'importe quel jour du mois/de la semaine)
   */
  function render(calView, calDate) {
    const el = document.getElementById('view-agenda');
    if (!el) return;
    el.innerHTML = calView === 'month'
      ? _renderMonth(calDate)
      : _renderWeek(calDate);
    SaxoUI.refreshIcons();
  }

  /**
   * Calcule le titre affiché dans la topbar.
   * @returns {string}
   */
  function getTitle(calView, calDate) {
    if (calView === 'month') {
      return MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear();
    }
    // Semaine : "Lun 3 — Dim 9 Avr 2025"
    const monday = _getMonday(calDate);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return monday.getDate() + ' ' + MONTHS_SHORT[monday.getMonth()] +
           ' – ' + sunday.getDate() + ' ' + MONTHS_SHORT[sunday.getMonth()] +
           ' ' + sunday.getFullYear();
  }


  /* ══════════════════════════════════════
     VUE MENSUELLE
     ══════════════════════════════════════ */

  function _renderMonth(calDate) {
    const year  = calDate.getFullYear();
    const month = calDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const today = _dateKey(new Date());

    /* Premier jour affiché : le lundi de la semaine contenant le 1er du mois */
    const startDay = (first.getDay() + 6) % 7; // 0=Lun … 6=Dim

    let html = '<div class="month-grid">';

    /* En-tête des jours */
    html += '<div class="month-header">';
    DAYS_HEADER.forEach(d => html += `<div class="month-header-cell">${d}</div>`);
    html += '</div>';

    /* Grille des semaines */
    let day = new Date(first);
    day.setDate(1 - startDay);

    for (let row = 0; row < 6; row++) {
      html += '<div class="month-row">';
      for (let col = 0; col < 7; col++) {
        html += _monthCell(day, month, today);
        day.setDate(day.getDate() + 1);
      }
      html += '</div>';
      /* On arrête si on a couvert tout le mois */
      if (day > last && row >= 4) break;
    }

    html += '</div>';
    return html;
  }

  /**
   * Génère le HTML d'une cellule de la grille mensuelle.
   */
  function _monthCell(day, currentMonth, today) {
    const dk      = _dateKey(day);
    const evs     = _eventsOnDate(dk);
    const isOther = day.getMonth() !== currentMonth;
    const isToday = dk === today;

    let cls = 'month-cell';
    if (isOther)    cls += ' other-month';
    if (isToday)    cls += ' today';
    if (evs.length) cls += ' has-events';

    /* onclick : créer un événement sur ce jour (si pas autre mois) ou voir les événements */
    const click = `SaxoEvents.openModal(null, '${dk}')`;

    let html = `<div class="${cls}" onclick="${click}">`;
    html += `<div class="day-num">${day.getDate()}</div>`;

    /* Jusqu'à 3 puces d'événements, puis "+N" */
    evs.slice(0, 3).forEach(ev => {
      html += `<span class="event-chip"
                     onclick="event.stopPropagation(); SaxoEvents.openModal('${ev.id}')">
                 ${SaxoUI.escHtml(ev.name || 'Sans titre')}
               </span>`;
    });
    if (evs.length > 3) {
      html += `<span class="event-chip">+${evs.length - 3}</span>`;
    }

    html += '</div>';
    return html;
  }


  /* ══════════════════════════════════════
     VUE HEBDOMADAIRE
     ══════════════════════════════════════ */

  function _renderWeek(calDate) {
    const monday = _getMonday(calDate);
    const today  = _dateKey(new Date());

    /* En-tête : colonne vide (pour l'étiquette) + 7 jours */
    let html = '<div class="week-grid"><div class="week-header"><div></div>';
    for (let i = 0; i < 7; i++) {
      const d  = new Date(monday); d.setDate(monday.getDate() + i);
      const dk = _dateKey(d);
      html += `<div class="week-header-cell ${dk === today ? 'today' : ''}">
                 <div class="wday">${DAYS_SHORT[d.getDay()]}</div>
                 <div class="wdate">${d.getDate()}</div>
               </div>`;
    }
    html += '</div>';

    /* Rangée "tous les jours" */
    html += '<div class="week-allday"><div class="week-allday-label">Évén.</div>';
    for (let i = 0; i < 7; i++) {
      const d  = new Date(monday); d.setDate(monday.getDate() + i);
      const evs = _eventsOnDate(_dateKey(d));
      html += '<div class="week-allday-cell">';
      evs.forEach(ev => {
        html += `<div class="week-event-block" onclick="SaxoEvents.openModal('${ev.id}')">
                   <div class="ev-name">${SaxoUI.escHtml(ev.name || 'Sans titre')}</div>
                   <div class="ev-time">${ev.heureIntervention || ''}</div>
                 </div>`;
      });
      html += '</div>';
    }
    html += '</div></div>';

    return html;
  }


  /* ══════════════════════════════════════
     RENDU DE LA VUE LISTE
     ══════════════════════════════════════ */

  /**
   * Génère la liste de tous les événements triés par date
   * et l'injecte dans #view-list.
   */
  function renderList() {
    const el = document.getElementById('view-list');
    if (!el) return;

    const sorted = [...(window._db?.events || [])]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (!sorted.length) {
      el.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"
               viewBox="0 0 24 24" style="margin:0 auto 12px">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          <p>Aucun événement</p>
          <span>Créez votre premier engagement</span>
        </div>`;
      return;
    }

    el.innerHTML = '<div class="event-list">' +
      sorted.map(ev => {
        const d   = ev.date ? new Date(ev.date + 'T00:00:00') : null;
        const day = d ? d.getDate() : '—';
        const mon = d ? MONTHS_SHORT[d.getMonth()] : '';
        return `
          <div class="event-card" onclick="SaxoEvents.openModal('${ev.id}')">
            <div class="event-card-date">
              <div class="ecd-day">${day}</div>
              <div class="ecd-mon">${mon}</div>
            </div>
            <div class="event-card-info">
              <div class="event-card-name">${SaxoUI.escHtml(ev.name || 'Sans titre')}</div>
              <div class="event-card-meta">
                ${ev.heureIntervention || ''}
                ${ev.lieu ? '· ' + SaxoUI.escHtml(ev.lieu) : ''}
              </div>
            </div>
            ${ev.type ? `<span class="event-type-badge">${SaxoUI.escHtml(ev.type)}</span>` : ''}
          </div>`;
      }).join('') + '</div>';
  }


  /* ══════════════════════════════════════
     UTILITAIRES
     ══════════════════════════════════════ */

  /**
   * Retourne la chaîne YYYY-MM-DD d'un objet Date.
   * Utilisée comme clé de correspondance avec ev.date.
   */
  function _dateKey(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /**
   * Retourne les événements dont la date correspond à dk (YYYY-MM-DD).
   * Exclut les événements archivés.
   */
  function _eventsOnDate(dk) {
    return (window._db?.events || []).filter(e => e.date === dk && !e.archived);
  }

  /**
   * Retourne le lundi de la semaine contenant la date donnée.
   */
  function _getMonday(d) {
    const day  = d.getDay();                    // 0=dim, 1=lun…
    const diff = day === 0 ? -6 : 1 - day;      // décalage vers lundi
    const m    = new Date(d);
    m.setDate(d.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m;
  }


  /* ── API publique du module ── */
  return {
    render,
    getTitle,
    renderList,
    _getMonday, // exposé pour app.js (calcul du titre)
  };

})();
