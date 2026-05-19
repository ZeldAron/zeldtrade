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

  let currentPage = 'journal';

  function switchPage(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    $('topbarTitle').textContent = i18n.t(PAGE_KEYS[page] || page);
    $('searchWrap').style.display = page === 'journal' ? 'flex' : 'none';
    currentPage = page;
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
          <div style="text-align:center;font-size:32px;margin-bottom:8px">⌨️</div>
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
          <button type="button" class="btn-ghost" style="width:100%" onclick="document.getElementById('shortcutsCheatsheet').style.display='none'">Fermer</button>
        </div>
      `;
      document.body.appendChild(el);
      // Click overlay = close
      el.addEventListener('click', ev => { if (ev.target === el) el.style.display = 'none'; });
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
    const pro        = Store.isPro();
    const planBadge  = $('planBadge');
    const upgradeBlock = $('sidebarUpgrade');
    if (planBadge) {
      planBadge.textContent = pro ? 'PRO' : 'BASIC';
      planBadge.className   = 'plan-badge ' + (pro ? 'plan-pro' : 'plan-basic');
    }
    if (upgradeBlock) {
      upgradeBlock.style.display = pro ? 'none' : 'block';
    }
  }
  refreshPlanUI();
  $('btnSidebarUpgrade')?.addEventListener('click', () => switchPage('offers'));
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
