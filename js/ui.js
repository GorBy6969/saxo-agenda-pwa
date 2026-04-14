/* ══════════════════════════════════════════════════════════
   ui.js — Helpers d'interface utilisateur
   ──────────────────────────────────────────────────────────
   Contient :
     - Toast (notifications temporaires)
     - Combobox (champ texte + dropdown suggestions)
     - Fonctions d'échappement HTML
     - Génération des icônes Lucide après injection dynamique
   ══════════════════════════════════════════════════════════ */

const SaxoUI = (() => {

  /* ══════════════════════════════════════
     TOAST — notification éphémère
     ══════════════════════════════════════ */

  let toastTimer = null;

  /**
   * Affiche une notification temporaire en bas à droite.
   * @param {string} msg   — Message à afficher
   * @param {string} type  — '' | 'success' | 'error'
   * @param {number} duration — Durée en ms (défaut 2500)
   */
  function toast(msg, type = '', duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    // On réinitialise les classes puis on applique le type
    el.className = 'fixed bottom-6 right-4 z-[100] bg-bg4 border border-white/20 rounded-xl ' +
                   'px-4 py-2.5 text-sm pointer-events-none transition-all duration-300 show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = el.className.replace(' show', '').replace(type, '').trim() +
                     ' translate-y-4 opacity-0';
    }, duration);
  }


  /* ══════════════════════════════════════
     COMBOBOX — champ texte + suggestions
     ══════════════════════════════════════ */

  /**
   * Génère le HTML d'une combobox (input libre + dropdown filtrable).
   * Les options sont triées par fréquence d'utilisation (passées en paramètre).
   *
   * @param {string}   id          — ID de l'input (doit être unique dans la page)
   * @param {string}   placeholder — Texte indicatif
   * @param {string[]} options     — Liste des suggestions (déjà triées)
   * @param {string}   value       — Valeur initiale
   * @returns {string} HTML de la combobox
   */
  function buildCombo(id, placeholder, options, value = '') {
    // Chaque option est un div cliquable qui remplit l'input
    const opts = options.map(o =>
      `<div class="combo-option"
            onmousedown="SaxoUI.selectCombo('${id}','${escAttr(o)}')"
            ontouchstart="SaxoUI.selectCombo('${id}','${escAttr(o)}')">
         <span>${escHtml(o)}</span>
       </div>`
    ).join('');

    return `
      <div class="combo-wrap">
        <input type="text"
               id="${id}"
               placeholder="${escAttr(placeholder)}"
               value="${escAttr(value)}"
               autocomplete="off"
               oninput="SaxoUI.filterCombo('${id}')"
               onfocus="SaxoUI.openCombo('${id}')"
               onblur="setTimeout(()=>SaxoUI.closeCombo('${id}'),200)">
        <div class="combo-dropdown" id="${id}-dd">${opts}</div>
      </div>`;
  }

  /** Ouvre le dropdown et filtre selon la saisie actuelle */
  function openCombo(id) {
    filterCombo(id);
    const dd = document.getElementById(id + '-dd');
    if (dd) dd.classList.add('open');
  }

  /** Ferme le dropdown */
  function closeCombo(id) {
    const dd = document.getElementById(id + '-dd');
    if (dd) dd.classList.remove('open');
  }

  /**
   * Filtre les options visibles selon la saisie.
   * Cache les options qui ne contiennent pas la saisie (insensible à la casse).
   */
  function filterCombo(id) {
    const inp = document.getElementById(id);
    const dd  = document.getElementById(id + '-dd');
    if (!inp || !dd) return;
    const filter = inp.value.toLowerCase();
    dd.querySelectorAll('.combo-option').forEach(opt => {
      const match = opt.querySelector('span').textContent.toLowerCase().includes(filter);
      opt.style.display = match ? '' : 'none';
    });
    dd.classList.add('open');
  }

  /**
   * Sélectionne une option du dropdown et la place dans l'input.
   * Déclenche un événement 'input' pour signaler le changement.
   */
  function selectCombo(id, val) {
    const inp = document.getElementById(id);
    if (inp) {
      inp.value = val;
      inp.dispatchEvent(new Event('input'));
    }
    closeCombo(id);
  }


  /* ══════════════════════════════════════
     SÉCURITÉ — échappement HTML
     ══════════════════════════════════════ */

  /**
   * Échappe les caractères spéciaux HTML pour éviter les injections XSS.
   * À utiliser pour tout contenu injecté dans innerHTML.
   */
  function escHtml(s) {
    return (s || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /**
   * Échappe pour usage dans un attribut HTML (valeur entre guillemets).
   */
  function escAttr(s) {
    return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }


  /* ══════════════════════════════════════
     ICÔNES LUCIDE
     ══════════════════════════════════════ */

  /**
   * Recrée les icônes Lucide après une injection dynamique de HTML.
   * Lucide remplace les balises <i data-lucide="..."> par des SVG.
   * À appeler après chaque mise à jour du DOM (modal, liste…).
   */
  function refreshIcons() {
    if (window.lucide) {
      // Petit délai pour laisser le DOM se mettre à jour
      setTimeout(() => lucide.createIcons(), 0);
    }
  }


  /* ── API publique du module ── */
  return {
    toast,
    buildCombo,
    openCombo,
    closeCombo,
    filterCombo,
    selectCombo,
    escHtml,
    escAttr,
    refreshIcons,
  };

})();
