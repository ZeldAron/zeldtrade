// ─── APP ──────────────────────────────────────────────────────────────────────
// Point d'entrée : routing, événements globaux, init (appelé après auth)

function initApp() {
  const $ = id => document.getElementById(id);

  // ── ROUTING ────────────────────────────────────────────────────────────────
  const PAGE_KEYS = {
    journal:   'page.journal',
    dashboard: 'page.dashboard',
    analytics: 'page.analytics',
    goals:     'page.goals',
    calendar:  'page.calendar',
    outils:    'page.outils',
    offers:    'page.offers',
    settings:  'page.settings',
    tutorial:  'page.tutorial',
  };

  // v0.9.271 — sous-titres contextuels d'en-tête [FR, EN] (en-têtes de page riches)
  const PAGE_SUBTITLES = {
    journal:   ['Tes trades, un par un',            'Your trades, one by one'],
    dashboard: ['Ta performance en un coup d’œil', 'Your performance at a glance'],
    analytics: ['Statistiques détaillées',          'Detailed statistics'],
    goals:     ['Objectifs prop firm & progression', 'Prop-firm goals & progress'],
    calendar:  ['Tes résultats jour par jour',       'Your results day by day'],
    outils:    ['Calculateurs & utilitaires',       'Calculators & utilities'],
    offers:    ['Choisis ton abonnement',           'Choose your plan'],
    settings:  ['Comptes, règles & préférences',     'Accounts, rules & preferences'],
    tutorial:  ['Prise en main de ZeldTrade',       'Getting started with ZeldTrade'],
  };
  function _applySubtitle(page) {
    const el = $('topbarSubtitle');
    if (el) el.textContent = (PAGE_SUBTITLES[page] || ['', ''])[i18n.getLang() === 'en' ? 1 : 0];
  }

  let currentPage = 'journal';

  function switchPage(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    $('topbarTitle').textContent = i18n.t(PAGE_KEYS[page] || page);
    _applySubtitle(page);
    $('searchWrap').style.display = page === 'journal' ? 'flex' : 'none';
    currentPage = page;
    if (window.Analytics) Analytics.page(page);
    // U34 : scroll-to-top automatique au changement de page (sinon Analytics
    // après scroll bas de Settings démarrait scrollé vers le bas selon le browser)
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
    catch { window.scrollTo(0, 0); }
    // Scroll aussi le contenu principal si c'est lui qui scroll (selon le layout)
    const main = document.querySelector('main') || document.querySelector('.app-main');
    if (main && typeof main.scrollTo === 'function') {
      try { main.scrollTo({ top: 0, behavior: 'instant' }); } catch { main.scrollTop = 0; }
    }
    // v0.9.231 (VIS-02 fix) : skeleton loader léger sur les pages au render lourd.
    // Injecte un placeholder shimmer dans le container puis schedule le render
    // réel au prochain frame (= 1 paint pour le skeleton avant le bloque ~300ms).
    const _SKELETON = '<div class="page-skeleton"><div class="skl-bar skl-bar-tall"></div><div class="skl-row"><div class="skl-bar"></div><div class="skl-bar"></div><div class="skl-bar"></div></div><div class="skl-bar skl-bar-block"></div></div>';
    function _renderWithSkeleton(containerId, renderFn) {
      const c = $(containerId);
      if (c) c.innerHTML = _SKELETON;
      requestAnimationFrame(() => renderFn());
    }
    if (page === 'dashboard') _renderWithSkeleton('dashContent',     UI.renderDashboard);
    if (page === 'analytics') _renderWithSkeleton('analyticsContent', UI.renderAnalytics);
    if (page === 'goals')     _renderWithSkeleton('goalsContent',    UI.renderGoals);
    if (page === 'calendar')  _renderWithSkeleton('calContent',      UI.renderCalendar);
    if (page === 'outils')    UI.renderOutils();
    if (page === 'offers')    UI.renderOffers();
    // v0.9.257 : recalcule la page Réglages à chaque ouverture (sinon la section
    // « Gérer mon abonnement » restait masquée si le doc Stripe a été chargé APRÈS
    // le 1er rendu — la visibilité n'était jamais réévaluée). initSettings est
    // idempotent (bindings gardés par dataset.bound).
    if (page === 'settings')  UI.initSettings();
  }

  // ── SIDEBAR TOGGLE ─────────────────────────────────────────────────────────
  const sidebar        = $('sidebar');
  const sidebarOverlay = $('sidebarOverlay');
  const isMobile       = () => window.innerWidth <= 768;

  function openSidebar() {
    sidebar.classList.add('sb-open');
    sidebar.classList.remove('sb-collapsed');
    if (isMobile()) sidebarOverlay.classList.add('active');
  }

  function closeSidebar() {
    if (isMobile()) {
      sidebar.classList.remove('sb-open');
      sidebarOverlay.classList.remove('active');
    } else {
      sidebar.classList.toggle('sb-collapsed');
    }
  }

  $('btnSidebarToggle').addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.contains('sb-open') ? closeSidebar() : openSidebar();
    } else {
      sidebar.classList.toggle('sb-collapsed');
    }
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      switchPage(el.dataset.page);
      if (isMobile()) closeSidebar();
    });
  });

  // ── JOURNAL FILTERS ────────────────────────────────────────────────────────
  $('listFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#listFilters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    UI.setFilter(chip.dataset.filter);
  });

  // ── SEARCH (v0.9.238 : persistance + debounce léger) ──────────────────────
  const _SEARCH_KEY = 'zeld_journal_search_v1';
  try {
    const saved = localStorage.getItem(_SEARCH_KEY);
    if (saved && saved.length <= 200) $('searchInput').value = saved;
  } catch {}
  let _searchTimer = null;
  $('searchInput').addEventListener('input', () => {
    UI.renderList();
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      try {
        const v = $('searchInput').value || '';
        if (v) localStorage.setItem(_SEARCH_KEY, v.slice(0, 200));
        else   localStorage.removeItem(_SEARCH_KEY);
      } catch {}
    }, 400);
  });

  // ── NEW TRADE BUTTON ───────────────────────────────────────────────────────
  $('btnNewTrade').addEventListener('click', () => {
    if (isMobile()) closeSidebar();
    if (!Store.getMyAccounts().length) {
      UI.toast(i18n.t('err.no.account'), true);
      return;
    }
    Modal.open(null, saved => {
      UI.selectTrade(saved.id);
      UI.updateStats();
      UI.renderList();
    });
  });

  // ── KEYBOARD SHORTCUTS (v0.9.238 enrichis) ─────────────────────────────────
  document.addEventListener('keydown', e => {
    const target = e.target;
    const tag    = (target && target.tagName) || '';
    const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable);

    // Cmd/Ctrl+N → Nouveau trade (passe même dans les inputs : c'est une action métier)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      $('btnNewTrade').click();
      return;
    }
    // Cmd/Ctrl+K → focus recherche journal (raccourci VS Code / GitHub-style)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const search = $('searchInput');
      if (search) {
        switchPage('journal');
        setTimeout(() => { search.focus(); search.select(); }, 50);
      }
      return;
    }
    // `?` → ouvre la cheatsheet (uniquement si pas dans un input)
    if (e.key === '?' && !inEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      _showShortcutsCheatsheet();
      return;
    }
    if (e.key === 'Escape') Modal.close();
  });

  // v0.9.238 : cheatsheet des raccourcis (affichée via `?`)
  function _showShortcutsCheatsheet() {
    let el = document.getElementById('shortcutsCheatsheet');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shortcutsCheatsheet';
      el.className = 'consent-modal';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod   = isMac ? '⌘' : 'Ctrl';
      el.innerHTML = `
        <div class="consent-modal-box" style="max-width:380px">
          <div style="text-align:center;font-size:32px;margin-bottom:8px"></div>
          <h2 class="consent-title">Raccourcis clavier</h2>
          <div style="display:flex;flex-direction:column;gap:10px;margin:18px 0">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span style="color:var(--text)">Nouveau trade</span>
              <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:12px;color:var(--muted)">${mod} + N</kbd>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span style="color:var(--text)">Recherche</span>
              <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:12px;color:var(--muted)">${mod} + K</kbd>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span style="color:var(--text)">Fermer modale</span>
              <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:12px;color:var(--muted)">Esc</kbd>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span style="color:var(--text)">Cette aide</span>
              <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:monospace;font-size:12px;color:var(--muted)">?</kbd>
            </div>
          </div>
          <button type="button" class="btn-ghost" style="width:100%" data-cta="close-cheatsheet">Fermer</button>
        </div>
      `;
      document.body.appendChild(el);
      // Click overlay = close (l'inline onclick était bloqué par la CSP)
      el.addEventListener('click', ev => { if (ev.target === el) el.style.display = 'none'; });
      el.querySelector('[data-cta="close-cheatsheet"]')?.addEventListener('click', () => { el.style.display = 'none'; });
    }
    el.style.display = 'flex';
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  $('btnLogout').addEventListener('click', () => {
    try { Store.clearLocalCache(); } catch {}
    Auth.logout().finally(() => { location.href = '/'; });
  });

  // Bouton "Commencer →" du Guide → bascule sur Journal
  $('btnTutoCta')?.addEventListener('click', () => {
    document.querySelector('[data-page="journal"]')?.click();
  });

  // ── INIT ───────────────────────────────────────────────────────────────────
  // Applique les traductions statiques
  i18n.apply();

  // Bouton langue dans Settings
  document.getElementById('btnToggleLang').addEventListener('click', () => {
    i18n.setLang(i18n.getLang() === 'fr' ? 'en' : 'fr');
    location.reload();
  });

  // Badge plan + sidebar upgrade CTA
  function refreshPlanUI() {
    // v0.9.314 : tant que le plan n'est pas résolu depuis Firestore (~1 s), on affiche
    // un placeholder neutre au lieu de « BASIC » → fini le flash au rechargement.
    const loaded     = (typeof Store.isPlanLoaded === 'function') ? Store.isPlanLoaded() : true;
    const pro        = Store.isPro();
    const planBadge  = $('planBadge');
    const upgradeBlock = $('sidebarUpgrade');
    if (planBadge) {
      if (!loaded) {
        planBadge.textContent = '…';
        planBadge.className    = 'plan-badge plan-loading';
      } else {
        const b = Store.getTierBadge();
        planBadge.textContent = b.label;
        planBadge.className    = 'plan-badge ' + b.cls;
      }
    }
    if (upgradeBlock) {
      // pendant le chargement on cache aussi le CTA upgrade (sinon il flashe pour un Pro)
      upgradeBlock.style.display = (loaded && !pro) ? 'block' : 'none';
    }
  }
  refreshPlanUI();
  $('btnSidebarUpgrade')?.addEventListener('click', () => switchPage('offers'));
  $('btnTopbarHelp')?.addEventListener('click', () => switchPage('tutorial'));
  UI.initNotifs && UI.initNotifs();   // v0.9.304 : centre de notifications (cloche topbar)
  // v0.9.309 : version affichée (Réglages → À propos) lue du changelog → jamais périmée
  try {
    const _vEntry = (window.Changelog && Changelog.getEntries && Changelog.getEntries()[0]) || null;
    const _vEl = document.getElementById('appVersionLabel');
    if (_vEntry && _vEntry.version && _vEl) _vEl.textContent = _vEntry.version;
  } catch {}
  _applySubtitle(currentPage);
  if (window.Analytics) Analytics.page(currentPage);
  window.addEventListener('store:planChanged', () => {
    refreshPlanUI();
    if (currentPage === 'dashboard') UI.renderDashboard();
    if (currentPage === 'analytics') UI.renderAnalytics();
    if (currentPage === 'settings')  UI.initSettings();
  });

  Modal.init();
  UI.initSettings();
  UI.renderList();
  UI.updateStats();

  // Redirect post-login if a destination was set (ex: landing Pro button)
  const VALID_PAGES = new Set(['journal','dashboard','analytics','goals','calendar','outils','offers','settings','tutorial']);
  const _goto = sessionStorage.getItem('ztGoto');
  sessionStorage.removeItem('ztGoto');
  if (_goto && VALID_PAGES.has(_goto)) {
    switchPage(_goto);
    if (_goto === 'offers') {
      setTimeout(() => {
        const inp = document.getElementById('proCodeInput');
        if (inp) { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); }
      }, 400);
    }
  }

  // v0.9.261 — délégation globale pour les CTA "nouveau trade" rendus par les
  // pages (analytics, objectifs, journal vide…). Évite les onclick inline (bloqués
  // par la CSP `script-src 'self'`) tout en gardant un seul point de binding.
  document.addEventListener('click', (e) => {
    const cta = e.target.closest('[data-cta="newtrade"]');
    if (cta) { e.preventDefault(); $('btnNewTrade')?.click(); }
  });

  // ── POST-CHECKOUT (?payment=success) ───────────────────────────────────────
  // Après un paiement Stripe, l'utilisateur revient sur /app?payment=success.
  // Le webhook écrit les docs `plan` + `stripe` de façon ASYNCHRONE : on
  // re-synchronise en boucle jusqu'à voir le customerId, pour que le badge de
  // palier + la section « Gérer mon abonnement » (= résiliation) apparaissent
  // sans rechargement manuel. Sinon l'user reste bloqué sans bouton d'annulation.
  (function handlePostCheckout() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (params.get('payment') !== 'success') return;
    // Nettoie l'URL pour ne pas re-déclencher au refresh
    try {
      params.delete('payment');
      const qs = params.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    } catch {}
    UI.toast(i18n.t('pay.activating'));
    let tries = 0;
    const MAX = 8; // ~16 s max (8 × 2 s)
    (function poll() {
      const info = Store.getStripeInfo ? Store.getStripeInfo() : null;
      refreshPlanUI();
      if (info && info.customerId) {
        if (currentPage === 'settings') UI.initSettings();
        UI.toast(i18n.t('pay.active'));
        return;
      }
      if (tries++ >= MAX) {
        UI.toast(i18n.t('pay.pending'), true);
        return;
      }
      Store.resync().catch(() => {}).finally(() => setTimeout(poll, 2000));
    })();
  })();

  const first = Store.getTrades()[0];
  if (first) UI.selectTrade(first.id);

  // ── AUTO-REFRESH EOD ───────────────────────────────────────────────────────
  // Re-rend les pages actives à minuit local pour mettre à jour le plancher trailing
  let lastDate = UI.localToday();
  setInterval(() => {
    const nowDate = UI.localToday();
    if (nowDate !== lastDate) {
      lastDate = nowDate;
      if (currentPage === 'goals')     UI.renderGoals();
      if (currentPage === 'dashboard') UI.renderDashboard();
    }
  }, 60_000); // vérifie chaque minute

  // ── AUTO-LOGOUT après inactivité (sécurité contre vol de session sur appareil partagé) ──
  let _lastActivity = Date.now();
  const IDLE_LIMIT_MS = 30 * 60_000; // 30 minutes
  const resetActivity = () => { _lastActivity = Date.now(); };
  ['mousedown','keydown','scroll','touchstart','click'].forEach(ev => {
    window.addEventListener(ev, resetActivity, { passive: true });
  });
  setInterval(() => {
    if (Date.now() - _lastActivity > IDLE_LIMIT_MS) {
      try { Store.clearLocalCache(); } catch {}
      Auth.logout().finally(() => { location.href = '/'; });
    }
  }, 60_000); // check chaque minute
}
