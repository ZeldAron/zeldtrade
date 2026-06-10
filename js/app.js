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
    if (page === 'econ')      renderEcon();
    if (page === 'offers')    UI.renderOffers();
    // v0.9.257 : recalcule la page Réglages à chaque ouverture (sinon la section
    // « Gérer mon abonnement » restait masquée si le doc Stripe a été chargé APRÈS
    // le 1er rendu — la visibilité n'était jamais réévaluée). initSettings est
    // idempotent (bindings gardés par dataset.bound).
    if (page === 'settings')  UI.initSettings();
  }

  // v1.0.4 : page « Éco » — calendrier économique (LIBRE, tous) + news Financial Juice
  // (réservé Funded/Elite/VIP via la feature fjNews). Le widget FJ sera branché dès qu'on
  // aura son code embed. Build une seule fois (l'iframe du calendrier persiste).
  // ── ÉCO (v1.0.4) : calendrier économique NATIF + news marchés filtrables ────
  // Remplace le widget TradingView tiers par un rendu maison : données ForexFactory
  // via la CF getEconCalendar (cache serveur 30 min — limite éditeur 2 req/5 min).
  // Filtres impact (High/Medium/Low) + devise, persistés. News : tags marché calculés
  // côté serveur (getMarketNews), filtre par marché. Tout contenu externe est échappé.
  let _ecalEvents = null;   // cache client de session (la CF a son propre cache serveur)
  let _newsItems  = null;

  function renderEcon() {
    const el = document.getElementById('econContent');
    if (!el) return;
    const en = i18n.getLang && i18n.getLang() === 'en';
    const hasFjNews = Store.canUseFeature && Store.canUseFeature('fjNews');

    const newsBlock = hasFjNews
      ? `<div class="news-tags" id="newsTags"></div>
         <div id="fjNewsHost" style="min-height:120px;border:1px solid var(--border);border-radius:12px;overflow:hidden"></div>`
      : `<div style="border:1px solid var(--border);border-radius:12px;padding:28px;text-align:center;background:var(--bg2)">
           <div style="font-size:30px;margin-bottom:6px">🔒</div>
           <p style="margin:0 0 14px;font-size:13.5px;color:var(--muted);line-height:1.55">${en
             ? 'Live market news is reserved for <strong>Funded / Elite</strong> plans.'
             : 'Les news marchés en direct sont réservées aux plans <strong>Funded / Elite</strong>.'}</p>
           <button class="btn-primary" id="econUpsell" type="button">${en ? 'See plans →' : 'Voir les offres →'}</button>
         </div>`;

    el.innerHTML = `
      <div class="page-title">${en ? 'Economy' : 'Économie'}</div>
      <h3 class="econ-h">${en ? 'Economic calendar' : 'Calendrier économique'}
        <span class="econ-sub">${en ? 'this week · your local time' : 'cette semaine · heure locale'}</span></h3>
      <div class="ecal-filters" id="ecalFilters" style="display:none">
        <div class="ecal-seg" id="ecalDay" role="group" aria-label="${en ? 'Period' : 'Période'}">
          <button type="button" data-day="today">${en ? 'Today' : 'Aujourd’hui'}</button>
          <button type="button" data-day="week">${en ? 'Whole week' : 'Toute la semaine'}</button>
        </div>
        <div class="ecal-seg" id="ecalImp" role="group" aria-label="Impact">
          <button type="button" data-imp="all">${en ? 'All' : 'Tout'}</button>
          <button type="button" data-imp="high">${en ? 'High' : 'Fort'}</button>
          <button type="button" data-imp="medium">${en ? 'Medium' : 'Moyen'}</button>
          <button type="button" data-imp="low">${en ? 'Low' : 'Faible'}</button>
        </div>
        <select class="ecal-cur" id="ecalCur" aria-label="${en ? 'Currency' : 'Devise'}"></select>
      </div>
      <div id="ecalList"><div class="econ-loading">${en ? 'Loading calendar…' : 'Chargement du calendrier…'}</div></div>
      <h3 class="econ-h" style="margin-top:28px">${en ? 'Market news' : 'News marchés'}
        ${hasFjNews ? `<span class="econ-sub">${en ? 'refreshed every 5 min' : 'rafraîchies toutes les 5 min'}</span>` : ''}</h3>
      ${newsBlock}`;

    document.getElementById('econUpsell')?.addEventListener('click', () => switchPage('offers'));
    _ecalInit(el, en);
    if (hasFjNews) _newsInit(el, en);
  }

  // Calendrier : fetch (CF cachée) → filtres impact/devise persistés → rendu groupé par jour.
  function _ecalInit(root, en) {
    const listEl = root.querySelector('#ecalList');
    const filtEl = root.querySelector('#ecalFilters');
    const dayEl  = root.querySelector('#ecalDay');
    const impEl  = root.querySelector('#ecalImp');
    const curEl  = root.querySelector('#ecalCur');
    const esc    = UI.escHtml;
    const errMsg = `<p class="econ-empty">${en ? 'Calendar unavailable — try again later.' : 'Calendrier indisponible — réessaie plus tard.'}</p>`;

    // v1.0.4 : vue « Aujourd'hui » par DÉFAUT — la semaine entière est opt-in via le filtre.
    let dayScope = localStorage.getItem('zt_ecal_day') || 'today';
    if (dayScope !== 'today' && dayScope !== 'week') dayScope = 'today';
    let imp = localStorage.getItem('zt_ecal_imp') || 'all';
    let cur = localStorage.getItem('zt_ecal_cur') || 'all';

    function paint() {
      if (!_ecalEvents) return;
      dayEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.day === dayScope));
      impEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.imp === imp));
      curEl.value = cur;
      const now = Date.now();
      const todayKey = new Date().toDateString();
      // 'ALL' (événements globaux type OPEC) reste visible quel que soit le filtre devise.
      const evs = _ecalEvents.filter(e =>
        (dayScope === 'week' || new Date(e.dateUtc).toDateString() === todayKey) &&
        (imp === 'all' || e.impact === imp) &&
        (cur === 'all' || e.country === cur || e.country === 'ALL'));
      if (!evs.length) {
        listEl.innerHTML = `<p class="econ-empty">${dayScope === 'today'
          ? (en ? 'No events today for these filters — try “Whole week”.' : 'Aucun événement aujourd’hui pour ces filtres — essaie « Toute la semaine ».')
          : (en ? 'No events match these filters.' : 'Aucun événement pour ces filtres.')}</p>`;
        return;
      }
      let html = '', lastDay = '';
      for (const e of evs) {
        const d = new Date(e.dateUtc);
        const dayKey = d.toDateString();
        if (dayKey !== lastDay) {
          lastDay = dayKey;
          const lbl = d.toLocaleDateString(en ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          html += `<div class="ecal-day${dayKey === todayKey ? ' today' : ''}">${esc(lbl)}${dayKey === todayKey ? (en ? ' · today' : ' · aujourd’hui') : ''}</div>`;
        }
        const hm = e.impact === 'holiday'
          ? '—'
          : d.toLocaleTimeString(en ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
        const fx = (e.forecast || e.previous)
          ? `<span class="ecal-fx">${e.forecast ? `${en ? 'Fcst' : 'Prév.'} ${esc(e.forecast)}` : ''}${e.forecast && e.previous ? ' · ' : ''}${e.previous ? `${en ? 'Prev' : 'Préc.'} ${esc(e.previous)}` : ''}</span>`
          : '';
        html += `<div class="ecal-row${e.dateUtc < now ? ' past' : ''}">
          <span class="ecal-time">${hm}</span>
          <span class="ecal-dot ${esc(e.impact)}"></span>
          <span class="ecal-cur-tag">${esc(e.country)}</span>
          <span class="ecal-title">${esc(e.title)}</span>
          ${fx}
        </div>`;
      }
      listEl.innerHTML = html;
    }

    function ready(events) {
      _ecalEvents = (events || []).slice().sort((a, b) => a.dateUtc - b.dateUtc);
      const curs = [...new Set(_ecalEvents.map(e => e.country))].filter(c => c && c !== 'ALL').sort();
      curEl.innerHTML = `<option value="all">${en ? 'All currencies' : 'Toutes devises'}</option>`
        + curs.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      if (cur !== 'all' && !curs.includes(cur)) cur = 'all';
      filtEl.style.display = '';
      paint();
    }

    dayEl.addEventListener('click', e => {
      const b = e.target.closest('button[data-day]');
      if (!b) return;
      dayScope = b.dataset.day;
      try { localStorage.setItem('zt_ecal_day', dayScope); } catch {}
      paint();
    });
    impEl.addEventListener('click', e => {
      const b = e.target.closest('button[data-imp]');
      if (!b) return;
      imp = b.dataset.imp;
      try { localStorage.setItem('zt_ecal_imp', imp); } catch {}
      paint();
    });
    curEl.addEventListener('change', () => {
      cur = curEl.value;
      try { localStorage.setItem('zt_ecal_cur', cur); } catch {}
      paint();
    });

    if (_ecalEvents) ready(_ecalEvents);   // rendu instantané depuis le cache de session
    const fn = (_fbFunctions || (firebase.app && firebase.app().functions('europe-west1')));
    if (!fn) { if (!_ecalEvents) listEl.innerHTML = errMsg; return; }
    fn.httpsCallable('getEconCalendar')({})
      .then(r => ready((r.data && r.data.events) || []))
      .catch(err => {
        console.warn('[Ecal] CF error:', err && err.message);
        if (!_ecalEvents) listEl.innerHTML = errMsg;
      });
  }

  // News : tags marché serveur → filtre client par marché, contenu échappé, liens https only.
  function _newsInit(root, en) {
    const host   = root.querySelector('#fjNewsHost');
    const tagsEl = root.querySelector('#newsTags');
    const esc    = UI.escHtml;
    const errMsg = `<p class="econ-empty">${en ? 'Could not load news.' : 'Impossible de charger les news.'}</p>`;
    const MKTS = [
      ['all', en ? 'All' : 'Tout'], ['usd', 'USD'], ['eur', 'EUR'],
      ['indices', 'Indices'], ['gold', en ? 'Gold' : 'Or'],
      ['energy', en ? 'Energy' : 'Énergie'], ['crypto', 'Crypto'],
    ];
    const MKT_LBL = Object.fromEntries(MKTS);
    let mkt = localStorage.getItem('zt_news_mkt') || 'all';
    if (!MKT_LBL[mkt]) mkt = 'all';

    tagsEl.innerHTML = MKTS.map(([k, lbl]) => `<button type="button" class="news-tag" data-mkt="${k}">${esc(lbl)}</button>`).join('');
    const paintTags = () => tagsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mkt === mkt));
    tagsEl.addEventListener('click', e => {
      const b = e.target.closest('button[data-mkt]');
      if (!b) return;
      mkt = b.dataset.mkt;
      try { localStorage.setItem('zt_news_mkt', mkt); } catch {}
      paintTags(); paintNews();
    });

    function paintNews() {
      if (!_newsItems) return;
      const items = mkt === 'all' ? _newsItems : _newsItems.filter(i => (i.tags || []).includes(mkt));
      if (!items.length) {
        host.innerHTML = `<p class="econ-empty">${en ? 'No news for this market right now.' : 'Aucune news pour ce marché actuellement.'}</p>`;
        return;
      }
      const rows = items.map(i => {
        const d  = new Date(i.pubDate);
        const hm = isNaN(d) ? '' : d.toLocaleTimeString(en ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
        const link = /^https:\/\//.test(i.link || '') ? i.link : '';
        const chips = (i.tags || []).map(tg => `<span class="fj-news-tag">${esc(MKT_LBL[tg] || tg)}</span>`).join('');
        return `<div class="fj-news-row">
          <span class="fj-news-time">${esc(hm)}</span>
          <span class="fj-news-title">${link
            ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a>`
            : esc(i.title)}${chips}</span>
          ${i.author ? `<span class="fj-news-src">${esc(i.author)}</span>` : ''}
        </div>`;
      }).join('');
      host.innerHTML = `<div class="fj-news-list">${rows}</div>`;
    }

    paintTags();
    if (_newsItems) paintNews();
    else host.innerHTML = `<div class="econ-loading">${en ? 'Loading news…' : 'Chargement des news…'}</div>`;

    const fn = (_fbFunctions || (firebase.app && firebase.app().functions('europe-west1')));
    if (!fn) { host.innerHTML = errMsg; return; }
    fn.httpsCallable('getMarketNews')({})
      .then(r => { _newsItems = (r.data && r.data.items) || []; paintNews(); })
      .catch(err => {
        console.warn('[News] CF error:', err && err.message);
        if (!_newsItems) host.innerHTML = errMsg;
      });
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
      // v1.0.3 : aucun compte → petite modale d'info (croix en haut à droite) ; son bouton
      // « Créer mon compte » ouvre Réglages + le formulaire d'ajout de compte directement.
      showNoAccountModal();
      return;
    }
    Modal.open(null, saved => {
      UI.selectTrade(saved.id);
      UI.updateStats();
      UI.renderList();
    });
  });

  // v1.0.3 : petite modale « pas de compte » — info + croix de fermeture + bouton qui
  // emmène vers Réglages avec le formulaire de création de compte ouvert.
  function showNoAccountModal() {
    if (document.getElementById('noAccountOverlay')) return; // anti double-ouverture
    const en = (i18n.getLang && i18n.getLang() === 'en');
    const overlay = document.createElement('div');
    overlay.id = 'noAccountOverlay';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:1000;opacity:1;pointer-events:all';
    overlay.innerHTML = `
      <div class="modal-card" style="position:relative;max-width:380px;width:90vw;padding:30px 24px 24px;background:var(--bg2);border-radius:12px;border:1px solid var(--border);text-align:center">
        <button id="naClose" type="button" aria-label="${en ? 'Close' : 'Fermer'}" style="position:absolute;top:10px;right:12px;background:none;border:none;color:var(--muted);font-size:24px;line-height:1;cursor:pointer;padding:2px 6px">&times;</button>
        <div style="font-size:34px;margin-bottom:8px">📒</div>
        <h3 style="margin:0 0 8px;font-size:18px;color:var(--text)">${en ? 'No trading account yet' : 'Pas encore de compte'}</h3>
        <p style="margin:0 0 20px;font-size:13.5px;color:var(--muted);line-height:1.55">${en ? 'To log a trade, you first need a trading account (prop firm, crypto or your own funds).' : 'Pour enregistrer un trade, tu dois d\'abord créer un compte de trading (prop firm, crypto ou fonds propres).'}</p>
        <button class="btn-primary" id="naCreate" type="button" style="width:100%">${en ? 'Create my account →' : 'Créer mon compte →'}</button>
      </div>`;
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.removeEventListener('keydown', onEsc); }
    function onEsc(e) { if (e.key === 'Escape') close(); }
    document.getElementById('naClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onEsc);
    document.getElementById('naCreate').addEventListener('click', () => {
      close();
      switchPage('settings');
      setTimeout(() => {
        document.getElementById('btnAddMyAccount')?.click();
        document.getElementById('maName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  }

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
  // v0.9.335 : relancer la visite guidée depuis le Guide (page tutorial)
  $('btnReplayTour')?.addEventListener('click', () => { try { window.ZTTour && ZTTour.start(); } catch {} });
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

  // ── FOCUS app-wide (v0.9.396) ────────────────────────────────────────────────
  // Sélecteur unique dans la topbar : Global (tout) / une prop firm / un compte / un
  // groupe. Persistant (settings.focusScope) + appliqué au dashboard, analytics, calendrier.
  function renderFocusScopeSelect() {
    const sel = $('focusScopeSelect');
    if (!sel) return;
    const accs  = Store.getMyAccounts ? Store.getMyAccounts() : [];
    const firms = Store.getMyFirms ? Store.getMyFirms() : [];
    const grps  = Store.getGroups ? Store.getGroups() : [];
    // Rien à filtrer (0 compte ET 0 firm) → on masque (pas de friction inutile).
    if (!accs.length && !firms.length) { sel.style.display = 'none'; return; }
    const en  = i18n.getLang() === 'en';
    const cur = (Store.getFocusScope && Store.getFocusScope()) || 'all';
    let opts = `<option value="all"${cur === 'all' ? ' selected' : ''}>${en ? '🌍 All' : '🌍 Tout'}</option>`;
    if (firms.length) {
      opts += `<optgroup label="${en ? 'By prop firm' : 'Par prop firm'}">`;
      opts += firms.map(f => { const v = 'firm:' + f.key; return `<option value="${UI.escHtml(v)}"${cur === v ? ' selected' : ''}>🎯 ${UI.escHtml(f.name)}</option>`; }).join('');
      opts += `</optgroup>`;
    }
    if (accs.length) {
      opts += `<optgroup label="${en ? 'By account' : 'Par compte'}">`;
      opts += accs.map(a => { const v = 'acc:' + a.name; return `<option value="${UI.escHtml(v)}"${cur === v ? ' selected' : ''}>${UI.escHtml(a.name)}</option>`; }).join('');
      opts += `</optgroup>`;
    }
    if (grps.length) {
      opts += `<optgroup label="${en ? 'By group' : 'Par groupe'}">`;
      opts += grps.map(g => { const v = 'grp:' + g.id; return `<option value="${UI.escHtml(v)}"${cur === v ? ' selected' : ''}>${UI.escHtml(g.name)}</option>`; }).join('');
      opts += `</optgroup>`;
    }
    sel.innerHTML = opts;
    sel.style.display = '';
  }
  UI.refreshFocusScope = renderFocusScopeSelect;

  $('focusScopeSelect')?.addEventListener('change', e => {
    const v = e.target.value;
    if (Store.setFocusScope) Store.setFocusScope(v === 'all' ? null : v);
    try { if (currentPage === 'dashboard') UI.renderDashboard(); } catch (err) {}
    try { if (currentPage === 'analytics') UI.renderAnalytics(); } catch (err) {}
    try { if (currentPage === 'calendar')  UI.renderCalendar();  } catch (err) {}
    try { if (currentPage === 'journal')   UI.renderList();      } catch (err) {}  // v1.0.4 : le journal suit le Focus
  });

  renderFocusScopeSelect();
  window.addEventListener('store:synced', renderFocusScopeSelect);

  // ── TIER-RECAP (v0.9.376) — récap features gagnées/perdues à un VRAI changement de palier ──
  // Déclenché sur store:synced (palier confirmé, pas le défaut transitoire) en comparant au
  // dernier palier vu (localStorage par-uid). Couvre l'upgrade Stripe (resync → synced).
  (function () {
    const TIER_NAME = { trader: 'Trader', funded: 'Funded', elite: 'Elite', beta: 'Bêta Testeur' };
    const FEAT_KEY = {
      accounts: 'tier.feat.accounts', ai: 'tier.feat.ai', shots: 'tier.feat.shots',
      groups: 'tier.feat.groups', exportPdf: 'tier.feat.exportPdf', exportCsv: 'tier.feat.exportCsv',
      prioritySupport: 'tier.feat.prioritySupport', betaFeatures: 'tier.feat.betaFeatures',
      decisiveVote: 'tier.feat.decisiveVote', partials: 'tier.feat.partials',
    };
    function lbl(x) {
      let s = i18n.t(FEAT_KEY[x.k] || x.k);
      if (x.to !== undefined) s = s.replace('%v', x.to);
      return s;
    }
    function showRecap(from, to) {
      const r = Store.getTierRecap(from, to);
      if (!r.gained.length && !r.lost.length) return;
      const title = (r.upgrade ? i18n.t('tier.recap.up') : i18n.t('tier.recap.down')).replace('%p', TIER_NAME[to] || to);
      const li = (arr, color, sym) => arr.map(x => `<li style="color:${color}">${sym} ${UI.escHtml(lbl(x))}</li>`).join('');
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10001;display:flex;align-items:center;justify-content:center;padding:24px';
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--surface,#161b22);border:1px solid var(--border,#30363d);border-radius:14px;padding:26px;max-width:460px;width:100%;color:var(--text,#e6edf3);box-shadow:0 20px 50px rgba(0,0,0,0.5)';
      card.innerHTML =
        `<h3 style="margin:0 0 16px;font-size:18px;font-weight:700">${UI.escHtml(title)}</h3>` +
        (r.gained.length ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--green);font-weight:700;margin-bottom:6px">${i18n.t('tier.recap.gain')}</div><ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7">${li(r.gained, 'var(--green)', '✓')}</ul>` : '') +
        (r.lost.length ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--red);font-weight:700;margin-bottom:6px">${i18n.t('tier.recap.lost')}</div><ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7">${li(r.lost, 'var(--red)', '✗')}</ul>` : '') +
        `<button id="tierRecapOk" class="btn-primary" style="width:100%">${i18n.t('tier.recap.ok')}</button>`;
      ov.appendChild(card);
      document.body.appendChild(ov);
      const close = () => ov.remove();
      card.querySelector('#tierRecapOk').addEventListener('click', close);
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
    }
    window.addEventListener('store:synced', () => {
      try {
        if (Store.isPlanLoaded && !Store.isPlanLoaded()) return;
        const uid = (firebase.auth().currentUser || {}).uid;
        if (!uid) return;
        const key = 'zt_tier_' + uid;
        const cur = Store.getTier();
        let prev = null;
        try { prev = localStorage.getItem(key); } catch {}
        try { localStorage.setItem(key, cur); } catch {}
        if (prev && prev !== cur) showRecap(prev, cur);
      } catch (e) { /* fail-soft */ }
    });
  })();

  // v0.9.384 : activation silencieuse d'un code Pro depuis le param URL
  // `?activatePro=ZELD-XXXX-XXXX-XXXX`. Permet à l'admin d'envoyer un lien direct
  // à un influenceur sans champ UI public visible.
  (function autoActivateProFromUrl() {
    try {
      const url = new URL(location.href);
      const code = (url.searchParams.get('activatePro') || '').trim();
      if (!code) return;
      // Attend que l'auth + le store soient prêts (1 store:synced après login)
      const onReady = async () => {
        window.removeEventListener('store:synced', onReady);
        if (!firebase.auth().currentUser) return;
        try {
          const result = await Store.activatePro(code);
          if (result === true) {
            try { UI.toast('Accès activé ✓'); } catch {}
            // Nettoie l'URL pour ne pas relancer l'activation au refresh
            url.searchParams.delete('activatePro');
            history.replaceState(null, '', url.toString());
            setTimeout(() => location.reload(), 1200);
          } else {
            console.warn('[activatePro] échec:', result);
          }
        } catch (e) { console.warn('[activatePro] error', e && e.message); }
      };
      window.addEventListener('store:synced', onReady);
    } catch (e) { /* fail-soft */ }
  })();

  Modal.init();
  UI.initSettings();
  UI.renderList();
  UI.updateStats();

  // ── Bannière J+2 freemium (upsell proactif) ───────────────────────────────
  // Affichée une seule fois à J+2 pour les traders Gratuit.
  // Montre ce qu'ils ratent concrètement plutôt qu'un mur muet.
  (function _checkJ2UpsellBanner() {
    try {
      if (Store.getTier() !== 'trader') return;
      const STORAGE_KEY = 'zt_j2_banner_dismissed';
      if (localStorage.getItem(STORAGE_KEY)) return;
      const user = _fbAuth.currentUser;
      if (!user || !user.metadata || !user.metadata.creationTime) return;
      const daysSince = (Date.now() - new Date(user.metadata.creationTime).getTime()) / 86400000;
      if (daysSince < 2) return;

      const isEn = i18n.getLang() === 'en';
      const banner = document.createElement('div');
      banner.id = 'j2UpsellBanner';
      banner.style.cssText = 'margin:0 0 20px;padding:14px 16px;background:linear-gradient(135deg,rgba(var(--accent-rgb,99,102,241),0.08),rgba(0,255,136,0.05));border:1px solid rgba(0,255,136,0.2);border-radius:10px;display:flex;align-items:flex-start;gap:12px;position:relative';
      banner.innerHTML = `
        <div style="font-size:20px;line-height:1;margin-top:2px">💡</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--fg);margin-bottom:4px">${isEn
            ? 'You\'ve been trading for 2 days — here\'s what you\'re missing'
            : 'Tu trades depuis 2 jours — voilà ce que tu rates'}</div>
          <div style="font-size:12px;color:var(--fg-dim);line-height:1.55">${isEn
            ? '📊 <b>10 accounts</b> — group Apex + FTMO in one trade &nbsp;·&nbsp; 🤖 <b>7 AI analyses/week</b> instead of 2 &nbsp;·&nbsp; 📄 <b>PDF archive</b> per trade'
            : '📊 <b>10 comptes</b> — groupe Apex + FTMO en un trade &nbsp;·&nbsp; 🤖 <b>7 analyses IA/semaine</b> au lieu de 2 &nbsp;·&nbsp; 📄 <b>Archive PDF</b> par trade'}</div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px">
            <button onclick="document.querySelector('[data-page=\\'offers\\']')?.click();document.getElementById('j2UpsellBanner')?.remove()" style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">${isEn ? 'See Funded →' : 'Voir Funded →'}</button>
            <span style="font-size:11px;color:var(--fg-mute)">${isEn ? '7-day trial · no card' : 'Essai 7j · sans CB'}</span>
          </div>
        </div>
        <button id="j2UpsellClose" style="position:absolute;top:10px;right:12px;background:none;border:none;color:var(--fg-mute);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px" aria-label="Fermer">×</button>`;

      const journalPage = document.getElementById('page-journal');
      if (journalPage) journalPage.prepend(banner);

      document.getElementById('j2UpsellClose')?.addEventListener('click', () => {
        banner.remove();
        localStorage.setItem(STORAGE_KEY, '1');
      });
    } catch (e) {}
  })();

  // Redirect post-login if a destination was set (ex: landing Pro button)
  const VALID_PAGES = new Set(['journal','dashboard','analytics','goals','calendar','outils','econ','offers','settings','tutorial']);
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
    // Meta Pixel : retour de checkout Stripe réussi → conversion "Purchase" (l'event $$).
    try { if (window.ztTrack) window.ztTrack('Purchase', { currency: 'EUR' }); } catch (e) {}
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
