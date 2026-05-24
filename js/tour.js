// ─── TOUR GUIDÉ (onboarding 1er login) ──────────────────────────────────────
// v0.9.335 : visite guidée custom (sans lib, CSP-friendly). Spotlight via un
// masque en 4 pans autour de la cible (robuste aux contextes d'empilement) +
// popover repositionnée au resize/scroll. Bilingue FR/EN. Flag localStorage
// `zt_tour_done` (1er login auto). Relançable : window.ZTTour.start().
//
// Expose : window.ZTTour = { start, maybeAuto }.

(function () {
  'use strict';

  const LS_KEY = 'zt_tour_done';
  const T = function (fr, en) { return (window.i18n && i18n.getLang && i18n.getLang() === 'en') ? en : fr; };

  function getSteps() {
    return [
      { sel: null, title: T('Bienvenue sur ZeldTrade 👋', 'Welcome to ZeldTrade 👋'),
        text: T('Un tour rapide de 30 secondes pour démarrer. Tu peux le passer à tout moment.', 'A quick 30-second tour to get you started. You can skip it anytime.') },
      { sel: '#btnNewTrade', title: T('Crée ton premier trade', 'Create your first trade'),
        text: T('Colle ton screenshot TradingView (Ctrl+V) — l\'IA détecte entry, SL et TP. Ou saisis-le à la main.', 'Paste your TradingView screenshot (Ctrl+V) — AI detects entry, SL and TP. Or type it by hand.') },
      { sel: '.nav-item[data-page="journal"]', title: T('Ton journal', 'Your journal'),
        text: T('Tous tes trades, avec filtres (Win / Loss / B.E. / Ouverts), screenshots et notes.', 'All your trades, with filters (Win / Loss / B.E. / Open), screenshots and notes.') },
      { sel: '.nav-item[data-page="dashboard"]', title: T('Ton dashboard', 'Your dashboard'),
        text: T('P&L, win rate et drawdown prop firm calculés en temps réel sur tous tes comptes.', 'P&L, win rate and prop firm drawdown computed in real time across all your accounts.') },
      { sel: '.nav-item[data-page="outils"]', title: T('Tes outils', 'Your tools'),
        text: T('Calculateurs de position, R:R et fiscal micro-entrepreneur — au même endroit.', 'Position, R:R and French micro-business tax calculators — all in one place.') },
      { sel: '.nav-item-offers', title: T('Passe à la vitesse supérieure', 'Level up'),
        text: T('Funded et Elite débloquent le multi-comptes, plus d\'analyses IA et l\'export PDF. Tu peux revoir ce tour via le « ? » en haut à droite. Bon trade ! ✦', 'Funded and Elite unlock multi-account, more AI analyses and PDF export. You can replay this tour via the “?” top-right. Happy trading! ✦') },
    ];
  }

  let els = null, steps = [], idx = 0, active = false;

  function el(cls) { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; }

  function build() {
    return {
      masks: [el('zt-tour-mask'), el('zt-tour-mask'), el('zt-tour-mask'), el('zt-tour-mask')],
      ring:  el('zt-tour-ring'),
      pop:   el('zt-tour-pop'),
    };
  }

  function setBox(node, x, y, w, h) {
    node.style.left = x + 'px'; node.style.top = y + 'px';
    node.style.width = Math.max(0, w) + 'px'; node.style.height = Math.max(0, h) + 'px';
  }

  function targetRect() {
    const step = steps[idx];
    if (!step.sel) return null;
    const t = document.querySelector(step.sel);
    if (!t || t.offsetParent === null) return null;       // absent / caché (display:none)
    const b = t.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    // hors viewport (ex. sidebar translatée off-screen sur mobile) → fallback centré
    const vw = window.innerWidth, vh = window.innerHeight;
    if (b.right <= 0 || b.left >= vw || b.bottom <= 0 || b.top >= vh) return null;
    return b;
  }

  function place() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = targetRect();
    if (r) {
      const pad = 6;
      const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
      const w = r.width + pad * 2, h = r.height + pad * 2;
      setBox(els.masks[0], 0, 0, vw, y);                  // haut
      setBox(els.masks[1], x + w, y, vw - (x + w), h);    // droite
      setBox(els.masks[2], 0, y + h, vw, vh - (y + h));   // bas
      setBox(els.masks[3], 0, y, x, h);                   // gauche
      els.ring.style.display = 'block';
      setBox(els.ring, x, y, w, h);
    } else {
      setBox(els.masks[0], 0, 0, vw, vh);                 // plein écran (étape centrée)
      [1, 2, 3].forEach(function (i) { setBox(els.masks[i], 0, 0, 0, 0); });
      els.ring.style.display = 'none';
    }
    // popover
    const pop = els.pop, pw = pop.offsetWidth || 330, ph = pop.offsetHeight || 170;
    let left, top;
    if (r) {
      top = r.bottom + 14;
      if (top + ph > vh - 12) top = Math.max(12, r.top - ph - 14);
      left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), vw - pw - 12);
    } else { left = (vw - pw) / 2; top = (vh - ph) / 2; }
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }

  function render() {
    const step = steps[idx], n = steps.length;
    els.pop.innerHTML =
      '<div class="zt-tour-count"></div>' +
      '<h4 class="zt-tour-title"></h4>' +
      '<p class="zt-tour-text"></p>' +
      '<div class="zt-tour-actions">' +
        '<button type="button" class="zt-tour-skip"></button>' +
        '<div class="zt-tour-navbtns">' +
          (idx > 0 ? '<button type="button" class="zt-tour-prev"></button>' : '') +
          '<button type="button" class="zt-tour-next"></button>' +
        '</div>' +
      '</div>';
    els.pop.querySelector('.zt-tour-count').textContent = (idx + 1) + ' / ' + n;
    els.pop.querySelector('.zt-tour-title').textContent = step.title;
    els.pop.querySelector('.zt-tour-text').textContent = step.text;
    const skip = els.pop.querySelector('.zt-tour-skip'); skip.textContent = T('Passer', 'Skip'); skip.onclick = finish;
    const next = els.pop.querySelector('.zt-tour-next');
    next.textContent = (idx === n - 1) ? T('Terminer', 'Done') : T('Suivant', 'Next');
    next.onclick = function () { (idx >= n - 1) ? finish() : go(idx + 1); };
    const prev = els.pop.querySelector('.zt-tour-prev'); if (prev) { prev.textContent = T('Précédent', 'Back'); prev.onclick = function () { go(idx - 1); }; }
    place();
  }

  function go(i) { idx = Math.max(0, Math.min(steps.length - 1, i)); render(); }

  function onResize() { if (active) place(); }
  function onKey(e) {
    if (!active) return;
    // capture + stop : empêche les touches de déclencher les raccourcis de l'app
    if (e.key === 'Escape')          { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); (idx >= steps.length - 1) ? finish() : go(idx + 1); }
    else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); e.stopPropagation(); go(idx - 1); }
  }

  function finish() {
    if (!active) return;
    active = false;
    try { localStorage.setItem(LS_KEY, '1'); } catch (e) {}
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
    document.removeEventListener('keydown', onKey, true);
    if (els) { els.masks.forEach(function (m) { m.remove(); }); els.ring.remove(); els.pop.remove(); els = null; }
  }

  function start() {
    if (active) return;
    if (!document.getElementById('btnNewTrade')) return;   // app pas encore montée
    steps = getSteps(); idx = 0; active = true;
    els = build();
    render();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.addEventListener('keydown', onKey, true);
  }

  function maybeAuto() {
    try { if (localStorage.getItem(LS_KEY)) return; } catch (e) {}
    setTimeout(start, 900);   // laisse l'app se stabiliser après le reveal
  }

  window.ZTTour = { start: start, maybeAuto: maybeAuto };
})();
