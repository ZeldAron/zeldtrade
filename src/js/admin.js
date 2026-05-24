// ─── CONSOLE ADMIN ZELDTRADE ─────────────────────────────────────────────────
if (window.top !== window.self) { window.top.location.replace(window.self.location.href); }

const ADMIN_EMAIL = 'zeldtradepro@gmail.com';

const Admin = (() => {

  // ── SHA-256 ──────────────────────────────────────────────────────────────────
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Génération de code unique ────────────────────────────────────────────────
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L ambigus
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes).map(b => chars[b % chars.length]).join('');
    return `ZELD-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function show(id, type = 'block') { $(id).style.display = type; }
  function hide(id) { $(id).style.display = 'none'; }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  function toast(msg, isError = false) {
    const t = $('adminToast');
    t.textContent  = msg;
    t.className    = 'admin-toast ' + (isError ? 'admin-toast-err' : 'admin-toast-ok');
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 4500);
  }

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // v0.9.174 — date courte pour le tableau utilisateurs admin
  function formatDateShort(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  // v0.9.174 — date relative ("il y a 3j", "il y a 2h")
  function formatRelative(ts) {
    if (!ts) return 'jamais';
    const ms = Date.now() - ts;
    if (ms < 0) return 'à l\'instant';
    const sec = Math.floor(ms / 1000);
    if (sec < 60)  return 'à l\'instant';
    const min = Math.floor(sec / 60);
    if (min < 60)  return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)    return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7)     return `il y a ${d} j`;
    return formatDateShort(ts);
  }

  // ── Chargement des données ────────────────────────────────────────────────────
  async function loadUsers() {
    const snap = await _fbDb.collection('userEmails').get();
    return snap.docs.map(d => d.data());
  }

  async function loadCodes() {
    const snap  = await _fbDb.collection('proCodeHashes').get();
    const codes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                           .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const planSnaps = await Promise.all(
      codes.map(c =>
        _fbDb.collection('users').doc(c.uid).collection('data').doc('plan')
          .get().catch(() => null)
      )
    );

    return codes.map((c, i) => {
      const plan     = planSnaps[i];
      const isActive = plan && plan.exists && plan.data().codeHash === c.id;
      return { ...c, isActive };
    });
  }

  async function getUserPlan(uid) {
    try {
      const snap = await _fbDb.collection('users').doc(uid).collection('data').doc('plan').get();
      return snap.exists ? snap.data() : null;
    } catch { return null; }
  }

  // ── Rendu onglet Utilisateurs (v0.9.174 — redesign compact + stats + recherche) ──
  let _cachedUsers     = [];
  let _cachedPlans     = [];
  let _userSearchQuery = '';
  // v0.9.260 — filtres multi-critères + palier réel par user
  let _filterPlan   = 'all';      // all | basic | funded | elite | beta
  let _filterNews   = 'all';      // all | yes | no
  let _filterSource = 'all';      // all | stripe | code
  let _sortBy       = 'lastSeen'; // lastSeen | username | activated

  // Palier réel d'un user d'après son doc plan (aligné sur Store : pro legacy sans tier → beta)
  function _userTier(plan) {
    if (!plan || plan.plan !== 'pro') return 'basic';
    const t = plan.tier;
    return (t === 'funded' || t === 'elite' || t === 'beta') ? t : 'beta';
  }
  // Origine de l'abonnement pro : stripe (payant) / code (bêta testeur) / autre (manuel)
  function _userSource(plan) {
    if (!plan || plan.plan !== 'pro') return null;
    if (plan.source === 'stripe') return 'stripe';
    if (plan.codeHash) return 'code';
    return 'autre';
  }
  const _TIER_META = {
    basic:  { label: 'BASIC',    cls: 'plan-tag-basic'  },
    funded: { label: '✦ FUNDED', cls: 'plan-tag-funded' },
    elite:  { label: '✦ ELITE',  cls: 'plan-tag-elite'  },
    beta:   { label: 'BÊTA',     cls: 'plan-tag-beta'   },
  };

  async function renderUsers() {
    const wrap = $('tabUsers');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    const users = await loadUsers();
    if (!users.length) {
      wrap.innerHTML = '<p class="admin-empty">Aucun utilisateur enregistré.</p>';
      return;
    }
    // Charge les plans en parallèle
    const plans = await Promise.all(users.map(u => getUserPlan(u.uid)));
    _cachedUsers = users;
    _cachedPlans = plans;
    _renderUsersTable();
  }

  function _renderUsersTable() {
    const wrap = $('tabUsers');
    const users = _cachedUsers;
    const plans = _cachedPlans;
    const currentAdminUid = _fbAuth.currentUser?.uid || '';

    // Stats globales
    const total = users.length;
    const tierCounts = { basic: 0, funded: 0, elite: 0, beta: 0 };
    let newsletterCount = 0;
    for (let i = 0; i < users.length; i++) {
      tierCounts[_userTier(plans[i])]++;
      if (users[i].newsletterOptIn) newsletterCount++;
    }

    // Filtre live (pseudo OU email)
    const q = (_userSearchQuery || '').toLowerCase().trim();
    const filtered = users.map((u, i) => ({ u, plan: plans[i], tier: _userTier(plans[i]), source: _userSource(plans[i]) }))
      .filter(({ u, tier, source }) => {
        if (q && !(u.username || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
        if (_filterPlan   !== 'all' && tier !== _filterPlan)            return false;
        if (_filterNews   === 'yes' && !u.newsletterOptIn)              return false;
        if (_filterNews   === 'no'  &&  u.newsletterOptIn)              return false;
        if (_filterSource !== 'all' && source !== _filterSource)        return false;
        return true;
      });
    // Tri
    filtered.sort((a, b) => {
      if (_sortBy === 'username')  return (a.u.username || '').localeCompare(b.u.username || '');
      if (_sortBy === 'activated') return (b.plan?.activatedAt || 0) - (a.plan?.activatedAt || 0);
      return (b.u.lastSeen || 0) - (a.u.lastSeen || 0); // lastSeen (par défaut)
    });

    // Lignes
    const rows = filtered.map(({ u, plan, tier }) => {
      const isPro       = plan?.plan === 'pro';
      const isSelf      = u.uid === currentAdminUid;
      const activated   = isPro ? formatDateShort(plan.activatedAt) : null;
      const lastSeenRel = formatRelative(u.lastSeen);
      const newsletter  = u.newsletterOptIn
        ? '<span class="badge-news" title="Inscrit à la newsletter"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg></span>' : '';

      const _trash = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v5M14 11v5"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
      const deleteBtn = isSelf
        ? `<button class="ico-btn" disabled title="Vous ne pouvez pas vous supprimer vous-même">${_trash}</button>`
        : `<button class="ico-btn ico-btn-red" data-action="delete" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Supprimer le compte">${_trash}</button>`;

      return `<tr class="urow" data-rowuid="${esc(u.uid)}" title="Voir le détail">
        <td>
          <div class="cell-user-name">${esc(u.username)}${newsletter}</div>
          <div class="cell-user-email">${esc(u.email)}</div>
        </td>
        <td><span class="plan-tag ${_TIER_META[tier].cls}">${_TIER_META[tier].label}</span></td>
        <td>
          <div class="cell-dates-act">${activated ? 'Activé ' + activated : '—'}</div>
          <div class="cell-dates-seen">Vu ${lastSeenRel}</div>
        </td>
        <td class="cell-actions">
          <button class="ico-btn ico-btn-violet" data-action="gen"    data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Générer un code Bêta Testeur (accès complet)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><line x1="10" y1="6" x2="10" y2="16" stroke-dasharray="1.5 2"/></svg></button>
          <button class="ico-btn ico-btn-blue"   data-action="verify" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Forcer email_verified=true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><polyline points="4 7 12 13 20 7"/></svg></button>
          ${deleteBtn}
        </td>
      </tr>`;
    }).join('');

    const emptyRow = filtered.length === 0
      ? '<tr><td colspan="4" class="admin-empty-row">Aucun résultat pour ce filtre.</td></tr>'
      : '';

    const _sel = (cur, val) => cur === val ? ' selected' : '';
    const _isFiltered = _filterPlan !== 'all' || _filterNews !== 'all' || _filterSource !== 'all' || !!q;
    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="stat-chip"><span class="stat-val">${total}</span><span class="stat-lbl">Total</span></div>
        <div class="stat-chip stat-chip-funded"><span class="stat-val">${tierCounts.funded}</span><span class="stat-lbl">Funded</span></div>
        <div class="stat-chip stat-chip-elite"><span class="stat-val">${tierCounts.elite}</span><span class="stat-lbl">Elite</span></div>
        <div class="stat-chip stat-chip-beta"><span class="stat-val">${tierCounts.beta}</span><span class="stat-lbl">Bêta</span></div>
        <div class="stat-chip"><span class="stat-val">${tierCounts.basic}</span><span class="stat-lbl">Basic</span></div>
        <div class="stat-chip"><span class="stat-val">${newsletterCount}</span><span class="stat-lbl">Newsletter</span></div>
      </div>
      <div class="admin-filters">
        <input type="text" id="userSearch" class="admin-flt-search" placeholder="Rechercher pseudo / email…" value="${esc(q)}" autocomplete="off" spellcheck="false" />
        <select id="fltPlan" class="admin-flt">
          <option value="all"${_sel(_filterPlan,'all')}>Tous les paliers</option>
          <option value="basic"${_sel(_filterPlan,'basic')}>Basic</option>
          <option value="funded"${_sel(_filterPlan,'funded')}>Funded</option>
          <option value="elite"${_sel(_filterPlan,'elite')}>Elite</option>
          <option value="beta"${_sel(_filterPlan,'beta')}>Bêta</option>
        </select>
        <select id="fltNews" class="admin-flt">
          <option value="all"${_sel(_filterNews,'all')}>Newsletter : tous</option>
          <option value="yes"${_sel(_filterNews,'yes')}>Inscrits </option>
          <option value="no"${_sel(_filterNews,'no')}>Non inscrits</option>
        </select>
        <select id="fltSource" class="admin-flt">
          <option value="all"${_sel(_filterSource,'all')}>Source : toutes</option>
          <option value="stripe"${_sel(_filterSource,'stripe')}>Stripe (payant)</option>
          <option value="code"${_sel(_filterSource,'code')}>Code Bêta</option>
        </select>
        <select id="fltSort" class="admin-flt">
          <option value="lastSeen"${_sel(_sortBy,'lastSeen')}>Tri : activité récente</option>
          <option value="username"${_sel(_sortBy,'username')}>Tri : pseudo (A-Z)</option>
          <option value="activated"${_sel(_sortBy,'activated')}>Tri : date d'activation</option>
        </select>
        ${_isFiltered ? '<button id="fltReset" class="admin-flt-reset" title="Réinitialiser les filtres">✕ Réinitialiser</button>' : ''}
      </div>
      <div class="admin-flt-count">${filtered.length} résultat${filtered.length > 1 ? 's' : ''}${_isFiltered ? ' (filtré)' : ''}</div>
      <table class="admin-table">
        <thead><tr><th>Utilisateur</th><th>Palier</th><th>Activité</th><th class="th-actions">Actions</th></tr></thead>
        <tbody>${rows || emptyRow}</tbody>
      </table>`;

    // Bind search (live filter)
    const searchEl = $('userSearch');
    searchEl.addEventListener('input', (e) => {
      _userSearchQuery = e.target.value;
      _renderUsersTable();
      // Restore focus + cursor à la fin (le ré-render détruit l'input)
      setTimeout(() => {
        const s = $('userSearch');
        if (!s) return;
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
      }, 0);
    });

    // Bind filtres (palier / newsletter / source / tri)
    const _fltMap = { fltPlan: v => _filterPlan = v, fltNews: v => _filterNews = v, fltSource: v => _filterSource = v, fltSort: v => _sortBy = v };
    Object.keys(_fltMap).forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', (e) => { _fltMap[id](e.target.value); _renderUsersTable(); });
    });
    const resetEl = $('fltReset');
    if (resetEl) resetEl.addEventListener('click', () => {
      _userSearchQuery = ''; _filterPlan = 'all'; _filterNews = 'all'; _filterSource = 'all'; _sortBy = 'lastSeen';
      _renderUsersTable();
    });

    // Bind actions (data-action). stopPropagation → ne pas ouvrir le drawer en cliquant un bouton.
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid, email = btn.dataset.email;
        if (action === 'gen')         openGenModal(uid, email);
        else if (action === 'verify') markUserVerified(uid, email, btn);
        else if (action === 'delete') openDeleteModal(uid, email);
      });
    });
    // Clic sur une ligne → drawer détail utilisateur
    wrap.querySelectorAll('tr.urow').forEach(tr => tr.addEventListener('click', () => openUserDrawer(tr.dataset.rowuid)));
  }

  // ── Forcer email_verified=true sur un compte (v0.9.144) ─────────────────────
  async function markUserVerified(uid, email, btn) {
    if (!confirm(`Forcer email_verified=true pour ${email} ?\n\nUtilise cette action si l'utilisateur ne reçoit pas l'email Firebase (souvent en spam). L'IA Vision sera débloquée immédiatement.`)) return;
    if (!_fbFunctions) { toast('SDK Functions non chargé.', true); return; }
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const callable = _fbFunctions.httpsCallable('adminMarkEmailVerified');
      const res = await callable({ uid });
      const d = res.data;
      if (d.alreadyVerified) toast(`${email} était déjà vérifié.`);
      else toast(`${email} marqué comme vérifié ✓`);
    } catch (e) {
      console.warn('[Admin] markUserVerified failed', e);
      toast('Erreur : ' + ((e && e.message) || 'inconnue'), true);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // ── Rendu onglet Activité (v0.9.277) — analytics produit ──────────────────────
  const _ACT_LABELS = {
    trade_created: 'Trade créé', account_created: 'Compte créé',
    checkout_started: 'Checkout lancé', ai_analysis: 'Analyse IA', page_view: 'Page vue',
  };
  const _PAGE_LABELS = {
    journal: 'Journal', dashboard: 'Dashboard', analytics: 'Analytics', goals: 'Objectifs',
    calendar: 'Calendrier', outils: 'Outils', offers: 'Offres', settings: 'Réglages', tutorial: 'Guide',
  };

  // Période d'analyse de l'activité (défaut 24h) + cache des events bruts.
  let _actRange = '24h';
  const _ACT_RANGES = [
    { k: '24h', lbl: '24 h',     ms: 86400000,      days: 1 },
    { k: '7d',  lbl: '7 jours',  ms: 7 * 86400000,  days: 7 },
    { k: '30d', lbl: '30 jours', ms: 30 * 86400000, days: 30 },
    { k: 'all', lbl: 'Tout',     ms: Infinity,      days: Infinity },
  ];
  let _actCache = null;

  async function renderActivity() {
    const wrap = $('tabActivity');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    const _today = new Date().toISOString().slice(0, 10);
    const _since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10); // 30 jours glissants
    try {
      const [u, ev, gSnap, dvSnap] = await Promise.all([
        loadUsers(),
        _fbDb.collection('analyticsEvents').orderBy('ts', 'desc').limit(1500).get(),
        _fbDb.doc('publicStats/global').get().catch(() => null),
        // Compteur de visites cookieless, par jour (publicStats/visits-YYYY-MM-DD,
        // champ `day`='YYYY-MM-DD' qui trie par ordre chronologique). On prend les
        // 30 derniers jours d'un coup ; 'global' n'a pas de champ `day` donc exclu.
        _fbDb.collection('publicStats').where('day', '>=', _since).get().catch(() => null),

      ]);
      _actCache = {
        users:       u,
        events:      ev.docs.map(d => d.data()),
        visitsTotal: (gSnap && gSnap.exists) ? Math.max(0, Number(gSnap.data().visitsTotal) || 0) : 0,
        dailyVisits: dvSnap ? dvSnap.docs.map(d => ({ day: d.data().day || d.id.replace('visits-', ''), count: Math.max(0, Number(d.data().count) || 0) })) : [],
        capped:      ev.size >= 1500,
      };
    } catch (e) {
      wrap.innerHTML = '<p class="admin-empty">Erreur de chargement. (Si c\'est la 1ʳᵉ fois, l\'index Firestore se crée — réessaie dans 1 min.)</p>';
      return;
    }
    _renderActivityView();
  }

  // Re-render à partir du cache (changement de période = pas de re-fetch).
  function _renderActivityView() {
    const wrap = $('tabActivity');
    if (!_actCache) { renderActivity(); return; }
    const { users, events, visitsTotal, dailyVisits, capped } = _actCache;
    const range = _ACT_RANGES.find(r => r.k === _actRange) || _ACT_RANGES[0];
    const now = Date.now();
    const evMs = e => (e.ts && e.ts.toMillis) ? e.ts.toMillis() : null;
    const ev = range.ms === Infinity ? events : events.filter(e => { const ms = evMs(e); return ms && now - ms <= range.ms; });

    const emailByUid = {};
    users.forEach(u => { emailByUid[u.uid] = u.email || u.username || u.uid; });
    const activeOnRange = (range.ms === Infinity)
      ? users.filter(u => u.lastSeen).length
      : users.filter(u => u.lastSeen && now - u.lastSeen <= range.ms).length;

    // Visiteurs sur la période (compteur cookieless, tout le trafic) : somme des docs
    // journaliers ; « Tout » = total cumulé global (au-delà des 30 jours chargés).
    const rangeVisits = (range.days === Infinity)
      ? visitsTotal
      : (() => {
          const cutoff = new Date(now - (range.days - 1) * 86400000).toISOString().slice(0, 10);
          return (dailyVisits || []).filter(d => d.day >= cutoff).reduce((s, d) => s + d.count, 0);
        })();

    const byType = {}, byPage = {}, sids = new Set();
    ev.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.sid) sids.add(e.sid);
      if (e.type === 'page_view' && e.page) byPage[e.page] = (byPage[e.page] || 0) + 1;
    });

    const selector = '<div class="act-range">' + _ACT_RANGES.map(r =>
      `<button class="act-range-btn${r.k === _actRange ? ' active' : ''}" data-range="${r.k}">${r.lbl}</button>`).join('') + '</div>';

    const chips = `
      <div class="admin-stats">
        <div class="stat-chip stat-chip-pro"><span class="stat-val">${activeOnRange}</span><span class="stat-lbl">Actifs (${range.lbl})</span></div>
        <div class="stat-chip"><span class="stat-val">${sids.size}</span><span class="stat-lbl">Sessions</span></div>
        <div class="stat-chip"><span class="stat-val">${ev.length}</span><span class="stat-lbl">Événements</span></div>
      </div>`;

    const pages = Object.entries(byPage).sort((a, b) => b[1] - a[1]);
    const maxPage = pages.length ? pages[0][1] : 1;
    const pagesHtml = pages.length ? pages.map(([p, n]) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="width:95px;font-size:12px;color:var(--text)">${esc(_PAGE_LABELS[p] || p)}</span>
        <div style="flex:1;background:var(--bg);border-radius:5px;overflow:hidden;height:18px"><div style="height:100%;width:${Math.round(n / maxPage * 100)}%;background:var(--purple);border-radius:5px"></div></div>
        <span style="width:42px;text-align:right;font-size:12px;color:var(--muted)">${n}</span>
      </div>`).join('') : '<p class="admin-empty">Aucune vue de page sur cette période.</p>';

    const actions = ['trade_created', 'account_created', 'ai_analysis', 'checkout_started'];
    const actionsHtml = actions.map(a => `
      <div class="stat-chip" style="flex:1"><span class="stat-val">${byType[a] || 0}</span><span class="stat-lbl">${_ACT_LABELS[a]}</span></div>`).join('');

    const recent = ev.slice(0, 40);
    const recentRows = recent.map(e => {
      const ms    = evMs(e);
      const label = e.type === 'page_view' ? (_PAGE_LABELS[e.page] || e.page || '?') : (_ACT_LABELS[e.type] || e.type);
      const kind  = e.type === 'page_view' ? 'Page' : 'Action';
      return `<tr><td>${esc(emailByUid[e.uid] || e.uid || '?')}</td><td>${kind}</td><td>${esc(label)}</td><td style="color:var(--muted)">${ms ? formatRelative(ms) : '—'}</td></tr>`;
    }).join('');

    const visitorsBlock = `
      <div style="display:flex;gap:14px;margin-bottom:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:170px;background:linear-gradient(135deg,rgba(124,58,237,0.18),rgba(124,58,237,0.05));border:1px solid rgba(124,58,237,0.4);border-radius:12px;padding:18px 22px">
          <div style="font-size:34px;font-weight:800;color:var(--purple-l);line-height:1">${rangeVisits}</div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Visiteurs · ${range.lbl}</div>
        </div>
        <div style="flex:1;min-width:170px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 22px">
          <div style="font-size:34px;font-weight:800;color:var(--text);line-height:1">${visitsTotal}</div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Visiteurs au total</div>
        </div>
      </div>
      <p class="ov-note" style="margin:0 0 16px">Trafic global (compteur cookieless, landing incluse). L'activité détaillée ci-dessous ne concerne que les comptes connectés.</p>`;

    const cappedNote = (capped && range.ms === Infinity)
      ? '<p class="ov-note">Affichage limité aux 1500 événements les plus récents.</p>' : '';

    wrap.innerHTML = selector + visitorsBlock + chips +
      `<h3 style="font-size:13px;margin:20px 0 10px;color:var(--text)">Pages visitées <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span></h3>${pagesHtml}` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">Actions clés <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span></h3><div class="admin-stats">${actionsHtml}</div>` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">Flux récent <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span></h3>` +
      (recent.length
        ? `<table class="admin-table"><thead><tr><th>Utilisateur</th><th>Type</th><th>Détail</th><th>Quand</th></tr></thead><tbody>${recentRows}</tbody></table>`
        : '<p class="admin-empty">Aucun événement sur cette période.</p>') + cappedNote;

    wrap.querySelectorAll('.act-range-btn').forEach(b => b.addEventListener('click', () => { _actRange = b.dataset.range; _renderActivityView(); }));
  }

  // ── Rendu onglet Codes (v0.9.179 : unifié avec design Users — stats + search + actions icônes) ──
  let _cachedCodes      = [];
  let _codeSearchQuery  = '';

  async function renderCodes() {
    const wrap = $('tabCodes');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    const codes = await loadCodes();
    if (!codes.length) {
      wrap.innerHTML = '<p class="admin-empty">Aucun code généré.</p>';
      return;
    }
    _cachedCodes = codes;
    _renderCodesTable();
  }

  function _renderCodesTable() {
    const wrap  = $('tabCodes');
    const codes = _cachedCodes;

    // Stats globales
    const total       = codes.length;
    const activeCount = codes.filter(c => c.isActive).length;
    const inactiveCount = total - activeCount;
    const uniqueUsers = new Set(codes.map(c => c.uid)).size;

    // Filtre live (email)
    const q = (_codeSearchQuery || '').toLowerCase().trim();
    const filtered = codes.filter(c =>
      !q
      || (c.email || '').toLowerCase().includes(q)
      || (c.id    || '').toLowerCase().includes(q));

    const rows = filtered.map(c => {
      const statusTag = c.isActive
        ? '<span class="plan-tag plan-tag-pro">✦ Abonnement actif</span>'
        : '<span class="plan-tag plan-tag-basic">Non activé</span>';
      return `<tr>
        <td>
          <div class="cell-user-name">${esc(c.email || '?')}</div>
          <div class="cell-user-email" style="font-family:monospace">${esc(c.id.slice(0, 16))}…</div>
        </td>
        <td>${statusTag}</td>
        <td>
          <div class="cell-dates-act">Créé ${formatDateShort(c.createdAt)}</div>
          <div class="cell-dates-seen">${formatRelative(c.createdAt)}</div>
        </td>
        <td class="cell-actions">
          <button class="ico-btn ico-btn-red" data-action="revoke" data-id="${esc(c.id)}" data-uid="${esc(c.uid)}" data-email="${esc(c.email || '?')}" data-active="${c.isActive}" title="Révoquer ce code"></button>
        </td>
      </tr>`;
    }).join('');

    const emptyRow = filtered.length === 0
      ? '<tr><td colspan="4" class="admin-empty-row">Aucun résultat pour ce filtre.</td></tr>'
      : '';

    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="stat-chip"><span class="stat-val">${total}</span><span class="stat-lbl">Total codes</span></div>
        <div class="stat-chip stat-chip-pro"><span class="stat-val">${activeCount}</span><span class="stat-lbl">Actifs</span></div>
        <div class="stat-chip"><span class="stat-val">${inactiveCount}</span><span class="stat-lbl">Non activés</span></div>
        <div class="stat-chip"><span class="stat-val">${uniqueUsers}</span><span class="stat-lbl">Users uniques</span></div>
      </div>
      <div class="admin-search">
        <input type="text" id="codeSearch" placeholder="Rechercher par email ou hash…" value="${esc(q)}" autocomplete="off" spellcheck="false" />
      </div>
      <table class="admin-table">
        <thead><tr><th>Bénéficiaire / Hash</th><th>Statut</th><th>Création</th><th class="th-actions">Action</th></tr></thead>
        <tbody>${rows || emptyRow}</tbody>
      </table>`;

    const searchEl = $('codeSearch');
    searchEl.addEventListener('input', (e) => {
      _codeSearchQuery = e.target.value;
      _renderCodesTable();
      setTimeout(() => {
        const s = $('codeSearch');
        if (!s) return;
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
      }, 0);
    });

    wrap.querySelectorAll('[data-action="revoke"]').forEach(btn => {
      btn.addEventListener('click', () =>
        revokeCode(btn.dataset.id, btn.dataset.uid, btn.dataset.email, btn.dataset.active === 'true')
      );
    });
  }

  // ── Modale génération de code ─────────────────────────────────────────────────
  function openGenModal(uid, email) {
    $('genModalTitle').textContent = `Générer un code pour ${email}`;
    $('genResult').style.display   = 'none';
    $('genError').textContent      = '';
    $('genCode').textContent       = '';
    $('genTargetUid').value        = uid;
    $('genTargetEmail').value      = email;
    $('adminModal').style.display  = 'flex';
  }

  function closeGenModal() {
    $('adminModal').style.display = 'none';
  }

  async function doGenerate() {
    const uid   = $('genTargetUid').value;
    const email = $('genTargetEmail').value;
    const btn   = $('btnDoGen');
    btn.disabled    = true;
    btn.textContent = '…';
    $('genError').textContent = '';
    if (!_fbFunctions) {
      $('genError').textContent = 'SDK Functions non chargé.';
      btn.disabled = false; btn.textContent = 'Générer';
      return;
    }
    try {
      const code       = generateCode();
      const normalized = code.replace(/[-\s]/g, '').toUpperCase();
      const hash       = await sha256(normalized);

      // Passe par Cloud Function : audit log + rate-limit + cap par user
      const callable = _fbFunctions.httpsCallable('generateProCode');
      await callable({ codeHash: hash, uid, email });

      $('genCode').textContent    = code;
      $('genResult').style.display = 'block';
      toast('Code généré avec succès !');
      renderCodes();
    } catch (e) {
      console.warn('[Admin] generateProCode failed', e);
      $('genError').textContent = (e && e.message) || 'Erreur lors de la génération — réessaie.';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Générer';
    }
  }

  async function copyCode() {
    const code = $('genCode').textContent;
    try {
      await navigator.clipboard.writeText(code);
      toast('Code copié !');
    } catch {
      toast('Sélectionne le code manuellement.', true);
    }
  }

  // ── (retiré v0.9.340) Modale « lien de paiement Stripe » ────────────────────
  // createCheckoutSession prend l'uid/email du TOKEN (jamais targetUid) → le lien
  // aurait visé le compte admin ; et le param envoyé (`tier: monthly/yearly/lifetime`)
  // ne matchait aucune clé prix (`funded_monthly`…). Pour donner l'accès à un
  // testeur → bouton « Code bêta ». Pour un vrai paiement → le user souscrit
  // lui-même via la page Offres. (Si besoin un jour : Stripe Payment Links.)

  // ── Modale suppression utilisateur ───────────────────────────────────────────
  function openDeleteModal(uid, email) {
    $('delTargetUid').value     = uid;
    $('delTargetEmail').textContent = email;
    $('delConfirmInput').value  = '';
    $('delError').textContent   = '';
    $('btnDoDelete').disabled   = true;
    $('btnDoDelete').textContent = 'Supprimer définitivement';
    $('deleteModal').style.display = 'flex';
    setTimeout(() => $('delConfirmInput').focus(), 50);
  }

  function closeDeleteModal() {
    $('deleteModal').style.display = 'none';
  }

  function onConfirmInputChange() {
    $('btnDoDelete').disabled = $('delConfirmInput').value.trim() !== 'SUPPRIMER';
  }

  async function doDeleteUser() {
    const uid   = $('delTargetUid').value;
    const email = $('delTargetEmail').textContent;
    if ($('delConfirmInput').value.trim() !== 'SUPPRIMER') return;
    if (!_fbFunctions) {
      $('delError').textContent = 'SDK Functions non chargé.';
      return;
    }
    const btn = $('btnDoDelete');
    btn.disabled    = true;
    btn.textContent = 'Suppression…';
    $('delError').textContent = '';
    try {
      const callable = _fbFunctions.httpsCallable('deleteUserAccount');
      await callable({ uid });
      toast(`✓ Utilisateur ${email} supprimé définitivement.`);
      closeDeleteModal();
      renderUsers();
    } catch (e) {
      console.warn('[Admin] deleteUser failed', e);
      const msg = (e && e.message) ? e.message : 'Erreur lors de la suppression.';
      $('delError').textContent = msg;
      btn.disabled    = false;
      btn.textContent = 'Supprimer définitivement';
    }
  }

  // ── Révoquer un code (via Cloud Function pour atomicité) ──────────────────────
  let _revokeInFlight = false;
  async function revokeCode(id, uid, email, isActive) {
    if (_revokeInFlight) return;
    const msg = isActive
      ? `Révoquer le code ET désactiver l'abonnement Pro de ${email} ?`
      : `Supprimer le code non utilisé de ${email} ?`;
    if (!confirm(msg)) return;
    if (!_fbFunctions) {
      toast('SDK Functions non chargé.', true);
      return;
    }
    _revokeInFlight = true;
    try {
      const callable = _fbFunctions.httpsCallable('revokeProCode');
      await callable({ codeHash: id, uid });
      toast(isActive ? 'Abonnement Pro révoqué.' : 'Code supprimé.');
      renderCodes();
    } catch (e) {
      console.warn('[Admin] revokeCode failed', e);
      toast((e && e.message) || 'Erreur lors de la révocation.', true);
    } finally {
      _revokeInFlight = false;
    }
  }

  // ── Config IA — DÉPRÉCIÉE depuis v0.9.82 ───────────────────────────────────
  // La clé IA est désormais stockée dans Google Secret Manager et utilisée
  // exclusivement par la Cloud Function `analyzeChart`. Plus aucune lecture
  // ni écriture client (rules Firestore : `allow read, write: if false`).
  async function renderConfig() {
    const wrap = $('tabConfig');
    // Construction via DOM API (pas innerHTML user-injection — sécurité)
    wrap.textContent = '';

    // Section 1 — Cleanup userEmails orphelins
    const sectionCleanup = document.createElement('div');
    sectionCleanup.style.cssText = 'max-width:680px';

    const h = document.createElement('h3');
    h.style.cssText = 'margin:0 0 6px;font-size:15px';
    h.textContent = 'Nettoyage des comptes orphelins';
    sectionCleanup.appendChild(h);

    const p = document.createElement('p');
    p.style.cssText = 'font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:14px';
    p.textContent = 'Détecte et supprime les userEmails qui pointent vers un UID Firebase Auth supprimé (cas après recréation manuelle de compte). Mode "Analyse" (dry-run) d\'abord obligatoire avant suppression.';
    sectionCleanup.appendChild(p);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-bottom:14px';

    const btnAnalyze = document.createElement('button');
    btnAnalyze.className = 'btn-secondary';
    btnAnalyze.id = 'btnCleanupAnalyze';
    btnAnalyze.textContent = 'Analyser (dry-run)';
    btnRow.appendChild(btnAnalyze);

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'btn-danger';
    btnConfirm.id = 'btnCleanupConfirm';
    btnConfirm.textContent = 'Supprimer les orphelins';
    btnConfirm.disabled = true;  // activé seulement après dry-run
    btnConfirm.style.opacity = '0.5';
    btnConfirm.title = 'Lance d\'abord l\'analyse';
    btnRow.appendChild(btnConfirm);

    sectionCleanup.appendChild(btnRow);

    const resultBox = document.createElement('div');
    resultBox.id = 'cleanupResult';
    resultBox.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;font-family:monospace;font-size:12px;line-height:1.7;color:var(--text);white-space:pre-wrap;min-height:80px';
    resultBox.textContent = 'Lance "Analyser" pour voir les userEmails orphelins.';
    sectionCleanup.appendChild(resultBox);

    wrap.appendChild(sectionCleanup);

    // Handlers
    let lastDryRunOrphans = null;

    btnAnalyze.addEventListener('click', async () => {
      if (!_fbFunctions) { resultBox.textContent = 'SDK Functions non chargé.'; return; }
      btnAnalyze.disabled = true;
      btnAnalyze.textContent = 'Analyse...';
      resultBox.textContent = 'Recherche en cours...';
      try {
        const callable = _fbFunctions.httpsCallable('cleanupOrphanUserEmails');
        const res = await callable({ confirm: false });
        const d = res.data;
        lastDryRunOrphans = d.orphans || [];
        let txt = d.message + '\n\n';
        if (lastDryRunOrphans.length === 0) {
          txt += '✓ Aucun orphelin détecté. Tout est propre.';
          btnConfirm.disabled = true;
          btnConfirm.style.opacity = '0.5';
        } else {
          txt += '✗ ORPHELINS À SUPPRIMER :\n';
          lastDryRunOrphans.forEach(o => {
            txt += `  • UID: ${o.uid}\n    Email: ${o.email}\n`;
          });
          btnConfirm.disabled = false;
          btnConfirm.style.opacity = '1';
        }
        resultBox.textContent = txt;
      } catch (e) {
        resultBox.textContent = '✗ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.textContent = 'Analyser (dry-run)';
      }
    });

    btnConfirm.addEventListener('click', async () => {
      if (!lastDryRunOrphans || lastDryRunOrphans.length === 0) return;
      if (!confirm(`Supprimer ${lastDryRunOrphans.length} userEmails orphelins + leurs proCodeHashes ? Action IRRÉVERSIBLE.`)) return;
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Suppression...';
      try {
        const callable = _fbFunctions.httpsCallable('cleanupOrphanUserEmails');
        const res = await callable({ confirm: true });
        const d = res.data;
        let txt = d.message + '\n\n';
        if (d.deleted && d.deleted.length) {
          txt += '✓ SUPPRIMÉS :\n';
          d.deleted.forEach(x => {
            txt += `  • ${x.email} (UID: ${x.uid}) — ${x.codesRevoked} code(s) révoqué(s)\n`;
          });
        }
        if (d.errors && d.errors.length) {
          txt += '\n✗ ERREURS :\n';
          d.errors.forEach(e => { txt += `  • ${e.email}: ${e.error}\n`; });
        }
        resultBox.textContent = txt;
        lastDryRunOrphans = null;
        toast('Cleanup terminé');
      } catch (e) {
        resultBox.textContent = '✗ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnConfirm.disabled = true;
        btnConfirm.style.opacity = '0.5';
        btnConfirm.textContent = 'Supprimer les orphelins';
      }
    });

    // ── Section 3 : Vérification email manuelle (v0.9.144) ──────────────────
    // Outil pour débloquer les bêta-testeurs qui ne reçoivent pas l'email
    // Firebase (filtré en spam Gmail/free.fr/Hotmail). Bulk action one-shot
    // + bouton individuel via la liste des users.
    const sectionVerify = document.createElement('div');
    sectionVerify.style.cssText = 'max-width:680px;margin-top:32px';

    const hV = document.createElement('h3');
    hV.style.cssText = 'margin:0 0 6px;font-size:15px';
    hV.textContent = 'Forcer la vérification email';
    sectionVerify.appendChild(hV);

    const pV = document.createElement('p');
    pV.style.cssText = 'font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:14px';
    pV.textContent = 'Pour débloquer les utilisateurs qui ne reçoivent pas l\'email Firebase (filtré en spam Gmail/free.fr/Hotmail). À utiliser tant que Brevo+DKIM n\'est pas en place. Marque tous les comptes non-vérifiés comme vérifiés (Auth flag emailVerified=true).';
    sectionVerify.appendChild(pV);

    const btnVerify = document.createElement('button');
    btnVerify.className = 'btn-secondary';
    btnVerify.id = 'btnVerifyAll';
    btnVerify.textContent = 'Marquer tous les emails comme vérifiés';
    sectionVerify.appendChild(btnVerify);

    const resultV = document.createElement('div');
    resultV.id = 'verifyResult';
    resultV.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;font-family:monospace;font-size:12px;line-height:1.7;color:var(--text);white-space:pre-wrap;min-height:60px;margin-top:14px';
    resultV.textContent = 'Clique sur le bouton pour marquer tous les comptes existants comme email-verified.';
    sectionVerify.appendChild(resultV);

    wrap.appendChild(sectionVerify);

    btnVerify.addEventListener('click', async () => {
      if (!_fbFunctions) { resultV.textContent = 'SDK Functions non chargé.'; return; }
      if (!confirm('Marquer TOUS les comptes non-vérifiés comme email-verified ?\n\nUtilise cette action UNE seule fois pour rattraper la base bêta. Les nouveaux signups continueront à recevoir l\'email normal.')) return;
      btnVerify.disabled = true;
      btnVerify.textContent = 'Traitement...';
      resultV.textContent = 'En cours...';
      try {
        const callable = _fbFunctions.httpsCallable('adminMarkEmailVerified');
        const res = await callable({ all: true });
        const d = res.data;
        let txt = (d.message || 'OK') + '\n\n';
        txt += `✓ Vérifiés : ${d.verified}\n`;
        txt += `⏭ Déjà vérifiés (skip) : ${d.skipped}\n`;
        if (d.errors) txt += `✗ Erreurs : ${d.errors}\n`;
        if (d.truncated) txt += '\n⚠ Tronqué à 1000 users — relance si tu as plus de monde.';
        resultV.textContent = txt;
        toast('Vérification email bulk terminée.');
      } catch (e) {
        resultV.textContent = '✗ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnVerify.disabled = false;
        btnVerify.textContent = 'Marquer tous les emails comme vérifiés';
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  v0.9.340 — Cockpit : Vue d'ensemble · Revenu · Audit & Emails · drawer user
  // ════════════════════════════════════════════════════════════════════════════

  // Prix de référence pour estimer le MRR (montants réels = dans Stripe ; ajuste
  // ici si les tarifs annuels changent). Mensuel-équivalent annuel = annuel / 12.
  const PRICES = { funded: { monthly: 14.99, yearly: 149 }, elite: { monthly: 29.99, yearly: 299 } };
  function mrrFor(tier, cycle) { const p = PRICES[tier]; if (!p) return 0; return cycle === 'yearly' ? p.yearly / 12 : p.monthly; }
  const _eur = n => (Math.round(n) === n ? n : Math.round(n * 100) / 100).toLocaleString('fr-FR') + ' €';
  const _tsMs = x => (x && x.toMillis) ? x.toMillis() : (typeof x === 'number' ? x : null);

  async function loadStripeDocs(users) {
    const snaps = await Promise.all(users.map(u =>
      _fbDb.collection('users').doc(u.uid).collection('data').doc('stripe').get().catch(() => null)));
    return snaps.map(s => (s && s.exists) ? s.data() : null);
  }
  const _isActiveSub = s => s && (s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trialing');

  // ── VUE D'ENSEMBLE (cockpit) ──────────────────────────────────────────────
  async function renderOverview() {
    const wrap = $('tabOverview');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    let users, plans, stripes;
    try {
      users = await loadUsers();
      [plans, stripes] = await Promise.all([
        Promise.all(users.map(u => getUserPlan(u.uid))),
        loadStripeDocs(users),
      ]);
    } catch (e) { wrap.innerHTML = '<p class="admin-empty">Erreur de chargement.</p>'; return; }
    _cachedUsers = users; _cachedPlans = plans;

    const now = Date.now(), DAY = 86400000;
    const total = users.length;
    const a7  = users.filter(u => u.lastSeen && now - u.lastSeen <= 7 * DAY).length;
    const a30 = users.filter(u => u.lastSeen && now - u.lastSeen <= 30 * DAY).length;
    const tiers = { basic: 0, funded: 0, elite: 0, beta: 0 };
    plans.forEach(p => tiers[_userTier(p)]++);
    const paying = tiers.funded + tiers.elite;
    let mrr = 0, activeSubs = 0;
    stripes.forEach(s => { if (_isActiveSub(s) && s.tier) { activeSubs++; mrr += mrrFor(s.tier, s.cycle); } });
    const conv = total ? Math.round(paying / total * 100) : 0;

    const card = (v, l, cls) => `<div class="ov-card ${cls || ''}"><div class="ov-val">${v}</div><div class="ov-lbl">${l}</div></div>`;
    wrap.innerHTML = `
      <div class="ov-grid">
        ${card(total, 'Utilisateurs')}
        ${card(a7, 'Actifs 7j')}
        ${card(a30, 'Actifs 30j')}
        ${card(paying, 'Payants', 'ov-accent')}
        ${card(tiers.beta, 'Bêta (gratuit)')}
        ${card(_eur(mrr), 'MRR estimé', 'ov-green')}
        ${card(conv + '%', 'Conversion payante')}
        ${card(activeSubs, 'Abos Stripe actifs')}
      </div>
      <div class="ov-split">
        <div class="ov-panel">
          <h3 class="ov-h">Répartition des paliers</h3>
          ${_tierBar('✦ Funded', tiers.funded, total, '#a78bfa')}
          ${_tierBar('✦ Elite', tiers.elite, total, '#f0b232')}
          ${_tierBar('Bêta', tiers.beta, total, '#3fb950')}
          ${_tierBar('Basic', tiers.basic, total, 'var(--muted)')}
        </div>
        <div class="ov-panel">
          <h3 class="ov-h">Raccourcis</h3>
          <div class="ov-links">
            <button class="btn-secondary" data-goto="users">Gérer les utilisateurs →</button>
            <button class="btn-secondary" data-goto="revenue">Revenu &amp; abonnements →</button>
            <button class="btn-secondary" data-goto="audit">Journal d'audit &amp; emails →</button>
          </div>
          <p class="ov-note">MRR estimé au tarif courant (Funded ${_eur(PRICES.funded.monthly)}/m, Elite ${_eur(PRICES.elite.monthly)}/m). Montants réels dans Stripe.</p>
        </div>
      </div>`;
    wrap.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));
  }
  function _tierBar(label, n, total, color) {
    const pct = total ? Math.round(n / total * 100) : 0;
    return `<div class="ov-bar"><span class="ov-bar-lbl">${esc(label)}</span><div class="ov-bar-track"><div class="ov-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="ov-bar-n">${n} · ${pct}%</span></div>`;
  }

  // ── REVENU / ABONNEMENTS ──────────────────────────────────────────────────
  async function renderRevenue() {
    const wrap = $('tabRevenue');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    let users, stripes;
    try { users = await loadUsers(); stripes = await loadStripeDocs(users); }
    catch (e) { wrap.innerHTML = '<p class="admin-empty">Erreur de chargement.</p>'; return; }

    const subs = [];
    stripes.forEach((s, i) => { if (s && s.tier) subs.push(Object.assign({}, s, { email: users[i].email, username: users[i].username })); });
    const active = subs.filter(_isActiveSub);
    let mrr = 0; active.forEach(s => mrr += mrrFor(s.tier, s.cycle));
    const f = active.filter(s => s.tier === 'funded').length, el = active.filter(s => s.tier === 'elite').length;
    const mo = active.filter(s => s.cycle === 'monthly').length, yr = active.filter(s => s.cycle === 'yearly').length;
    const canceling = active.filter(s => s.cancelAtPeriodEnd).length;
    const card = (v, l, cls) => `<div class="ov-card ${cls || ''}"><div class="ov-val">${v}</div><div class="ov-lbl">${l}</div></div>`;
    const head = `<div class="ov-grid">
        ${card(_eur(mrr), 'MRR estimé', 'ov-green')}
        ${card(_eur(mrr * 12), 'ARR estimé')}
        ${card(active.length, 'Abos actifs', 'ov-accent')}
        ${card(f, '✦ Funded')}
        ${card(el, '✦ Elite')}
        ${card(mo + ' / ' + yr, 'Mensuel / Annuel')}
        ${card(canceling, 'Résiliations prévues', canceling ? 'ov-red' : '')}
      </div>`;

    if (!subs.length) {
      wrap.innerHTML = head + '<p class="admin-empty" style="margin-top:18px">Aucun abonnement Stripe enregistré.<br>En mode TEST ça se remplit avec les paiements de test ; en LIVE avec les vrais abonnements.</p>';
      return;
    }
    const rows = subs.sort((a, b) => (_isActiveSub(b) ? 1 : 0) - (_isActiveSub(a) ? 1 : 0)).map(s => {
      const meta = _TIER_META[s.tier] || { label: esc(s.tier), cls: 'plan-tag-basic' };
      const stCls = _isActiveSub(s) ? 'plan-tag-pro' : 'plan-tag-basic';
      return `<tr>
        <td><div class="cell-user-name">${esc(s.username || '?')}</div><div class="cell-user-email">${esc(s.email || '')}</div></td>
        <td><span class="plan-tag ${meta.cls}">${meta.label}</span></td>
        <td>${s.cycle === 'yearly' ? 'Annuel' : s.cycle === 'monthly' ? 'Mensuel' : '—'}</td>
        <td><span class="plan-tag ${stCls}">${esc(s.subscriptionStatus || '—')}</span>${s.cancelAtPeriodEnd ? ' <span class="ev-tag ev-hard">résil.</span>' : ''}</td>
        <td style="color:var(--muted)">${s.currentPeriodEnd ? formatDateShort(s.currentPeriodEnd) : '—'}</td>
      </tr>`;
    }).join('');
    wrap.innerHTML = head +
      '<h3 class="ov-h" style="margin-top:24px">Abonnements</h3>' +
      `<table class="admin-table"><thead><tr><th>Client</th><th>Palier</th><th>Cycle</th><th>Statut</th><th>Échéance</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p class="ov-note" style="margin-top:14px">Prix de réf. : Funded ${_eur(PRICES.funded.monthly)}/m · ${_eur(PRICES.funded.yearly)}/an, Elite ${_eur(PRICES.elite.monthly)}/m · ${_eur(PRICES.elite.yearly)}/an (ajuste <code>PRICES</code> dans admin.js).</p>`;
  }

  // ── AUDIT & EMAILS ────────────────────────────────────────────────────────
  async function renderAudit() {
    const wrap = $('tabAudit');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    let logs = [], emails = [];
    try {
      const [aSnap, eSnap] = await Promise.all([
        _fbDb.collection('auditLogs').orderBy('at', 'desc').limit(100).get().catch(() => null),
        _fbDb.collection('emailEvents').orderBy('at', 'desc').limit(50).get().catch(() => null),
      ]);
      if (aSnap) logs = aSnap.docs.map(d => d.data());
      if (eSnap) emails = eSnap.docs.map(d => d.data());
    } catch (e) { wrap.innerHTML = '<p class="admin-empty">Erreur (index Firestore en cours de création ? réessaie dans 1 min).</p>'; return; }

    const auditRows = logs.map(l => {
      const ms = _tsMs(l.at);
      const p = l.payload || {};
      const tgt = p.email || p.targetEmail || p.uid || p.targetUid || '';
      const detail = esc(JSON.stringify(p).slice(0, 140));
      return `<tr><td><code>${esc(l.action || '?')}</code></td><td>${esc(l.admin || '—')}</td><td title="${detail}">${esc(String(tgt).slice(0, 42)) || '—'}</td><td style="color:var(--muted)">${ms ? formatRelative(ms) : '—'}</td></tr>`;
    }).join('');
    const emailRows = emails.map(e => {
      const ms = _tsMs(e.at) || _tsMs(e.ts);
      const type = e.evType || e.type || e.event || '?';
      const hard = e.isHard || /bounce|blocked|spam|hard|error|invalid/i.test(type);
      return `<tr><td><span class="ev-tag ${hard ? 'ev-hard' : 'ev-soft'}">${esc(type)}</span></td><td>${esc(e.email || '—')}</td><td style="color:var(--muted)">${ms ? formatRelative(ms) : '—'}</td></tr>`;
    }).join('');

    wrap.innerHTML =
      '<h3 class="ov-h">Journal d\'audit <span class="ov-sub">— actions admin (100 dernières)</span></h3>' +
      (logs.length
        ? `<table class="admin-table"><thead><tr><th>Action</th><th>Admin</th><th>Cible</th><th>Quand</th></tr></thead><tbody>${auditRows}</tbody></table>`
        : '<p class="admin-empty">Aucune action enregistrée.</p>') +
      '<h3 class="ov-h" style="margin-top:28px">Délivrabilité email <span class="ov-sub">— bounces / spam / blocked (Brevo)</span></h3>' +
      (emails.length
        ? `<table class="admin-table"><thead><tr><th>Événement</th><th>Email</th><th>Quand</th></tr></thead><tbody>${emailRows}</tbody></table>`
        : '<p class="admin-empty">Aucun incident email. 👍</p>');
  }

  // ── DRAWER détail utilisateur (clic sur une ligne) ────────────────────────
  async function openUserDrawer(uid) {
    const u = (_cachedUsers || []).find(x => x.uid === uid);
    if (!u) return;
    $('drawerTitle').textContent = u.username || u.email || uid;
    $('drawerBody').innerHTML = '<div class="admin-loading">Chargement…</div>';
    $('userDrawer').classList.add('open');
    $('drawerOverlay').classList.add('open');

    let plan = null, stripe = null, trades = '—', accounts = '—', myAudit = [], myEmails = [];
    try {
      const base = _fbDb.collection('users').doc(uid).collection('data');
      const [pS, sS, tS, aS] = await Promise.all([
        base.doc('plan').get().catch(() => null), base.doc('stripe').get().catch(() => null),
        base.doc('trades').get().catch(() => null), base.doc('myAccounts').get().catch(() => null),
      ]);
      if (pS && pS.exists) plan = pS.data();
      if (sS && sS.exists) stripe = sS.data();
      if (tS && tS.exists) trades = (tS.data().items || []).length;
      if (aS && aS.exists) accounts = (aS.data().items || []).length;
      const [audS, emS] = await Promise.all([
        _fbDb.collection('auditLogs').orderBy('at', 'desc').limit(200).get().catch(() => null),
        _fbDb.collection('emailEvents').where('email', '==', u.email).limit(20).get().catch(() => null),
      ]);
      if (audS) myAudit = audS.docs.map(d => d.data()).filter(l => { const p = l.payload || {}; return p.uid === uid || p.targetUid === uid || p.email === u.email; });
      if (emS) myEmails = emS.docs.map(d => d.data());
    } catch (e) { /* best-effort */ }

    const tier = _userTier(plan);
    const r = (k, v) => `<div class="dr-row"><span class="dr-k">${k}</span><span class="dr-v">${v}</span></div>`;
    const subBlock = (plan && plan.plan === 'pro')
      ? (r('Source', _userSource(plan) || '—') + (stripe
          ? r('Statut', esc(stripe.subscriptionStatus || '—')) +
            r('Cycle', stripe.cycle === 'yearly' ? 'Annuel' : stripe.cycle === 'monthly' ? 'Mensuel' : '—') +
            r('Échéance', stripe.currentPeriodEnd ? formatDateShort(stripe.currentPeriodEnd) : '—') +
            (stripe.cancelAtPeriodEnd ? r('Résiliation', '<span class="ev-tag ev-hard">prévue</span>') : '')
          : (plan.activatedAt ? r('Activé', formatDateShort(plan.activatedAt)) : '')))
      : '<span class="dr-empty">Compte gratuit (Basic).</span>';
    const audHtml = myAudit.length
      ? myAudit.map(l => `<div class="dr-log"><code>${esc(l.action)}</code> · <span style="color:var(--muted)">${formatRelative(_tsMs(l.at))}</span></div>`).join('')
      : '<span class="dr-empty">Aucune action admin.</span>';
    const emHtml = myEmails.length
      ? myEmails.map(e => `<span class="ev-tag ev-hard">${esc(e.evType || e.type || '?')}</span>`).join(' ')
      : '<span class="dr-ok">Aucun incident ✓</span>';

    $('drawerBody').innerHTML = `
      <div class="dr-sec"><span class="plan-tag ${_TIER_META[tier].cls}">${_TIER_META[tier].label}</span>${u.newsletterOptIn ? ' <span class="ev-tag ev-soft">newsletter</span>' : ''}</div>
      <div class="dr-sec">
        ${r('Email', esc(u.email || '—'))}
        ${r('UID', `<code class="dr-uid">${esc(uid)}</code>`)}
        ${r('Dernière activité', formatRelative(u.lastSeen))}
        ${r('Trades', trades)}
        ${r('Comptes', accounts)}
      </div>
      <div class="dr-sec"><div class="dr-sec-h">Abonnement</div>${subBlock}</div>
      <div class="dr-sec"><div class="dr-sec-h">Délivrabilité email</div>${emHtml}</div>
      <div class="dr-sec"><div class="dr-sec-h">Historique admin</div>${audHtml}</div>
      <div class="dr-actions">
        <button class="btn-secondary" data-dr="gen">Code bêta</button>
        <button class="btn-secondary" data-dr="verify">Forcer vérif</button>
        <button class="btn-danger" data-dr="delete">Supprimer</button>
      </div>`;
    $('drawerBody').querySelectorAll('[data-dr]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.dr;
      if (a === 'gen') openGenModal(uid, u.email);
      else if (a === 'verify') markUserVerified(uid, u.email, b);
      else if (a === 'delete') { closeDrawer(); openDeleteModal(uid, u.email); }
    }));
  }
  function closeDrawer() { $('userDrawer').classList.remove('open'); $('drawerOverlay').classList.remove('open'); }

  // ── Onglets ───────────────────────────────────────────────────────────────────
  let _currentTab = 'overview';

  // Rafraîchit TOUTES les données de l'onglet courant (vide les caches + re-fetch).
  function refreshAll() {
    _cachedUsers = []; _cachedPlans = []; _cachedCodes = []; _actCache = null;
    const btn = $('btnRefresh');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 800); }
    switchTab(_currentTab);
    toast('Données rafraîchies');
  }

  function switchTab(name) {
    _currentTab = name;
    ['overview', 'users', 'revenue', 'activity', 'audit', 'codes', 'config'].forEach(t => {
      const btn = $('tab-' + t); if (btn) btn.classList.toggle('tab-active', t === name);
      const div = $('tab' + t.charAt(0).toUpperCase() + t.slice(1)); if (div) div.style.display = t === name ? '' : 'none';
    });
    if (name === 'overview') renderOverview();
    if (name === 'users')    renderUsers();
    if (name === 'revenue')  renderRevenue();
    if (name === 'activity') renderActivity();
    if (name === 'audit')    renderAudit();
    if (name === 'codes')    renderCodes();
    if (name === 'config')   renderConfig();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  let _adminLoginAttempts = 0;
  let _adminLockedUntil = 0;

  async function login() {
    const email    = $('loginEmail').value.trim().slice(0, 254);
    const password = $('loginPassword').value;
    const errEl    = $('loginError');
    const btn      = $('btnLogin');
    errEl.textContent = '';

    if (Date.now() < _adminLockedUntil) {
      const wait = Math.ceil((_adminLockedUntil - Date.now()) / 1000);
      errEl.textContent = `Trop de tentatives — réessayez dans ${wait}s.`;
      return;
    }

    btn.disabled = true;
    // Anti-timing-attack : on garantit une durée minimale uniforme pour
    // toutes les branches (succès, mauvais email, mauvais password, erreur réseau).
    const start = Date.now();
    const minDelay = 1500;
    let success = false;
    let user = null;
    try {
      const cred = await _fbAuth.signInWithEmailAndPassword(email, password);
      if (cred.user.email !== ADMIN_EMAIL) {
        await _fbAuth.signOut();
      } else {
        success = true;
        user = cred.user;
      }
    } catch (e) {
      // Identifiants invalides ou erreur réseau — traité comme un échec uniforme
    }

    const elapsed = Date.now() - start;
    if (elapsed < minDelay) await new Promise(r => setTimeout(r, minDelay - elapsed));

    btn.disabled = false;
    if (success) {
      _adminLoginAttempts = 0;
      showDashboard(user);
    } else {
      _adminLoginAttempts++;
      if (_adminLoginAttempts >= 3) {
        _adminLockedUntil = Date.now() + 5 * 60_000;
        _adminLoginAttempts = 0;
      }
      errEl.textContent = 'Identifiants invalides.';
    }
  }

  function showDashboard(user) {
    hide('loginScreen');
    show('dashboard', 'block');
    $('adminUserEmail').textContent = user.email;
    switchTab('overview');
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    _fbAuth.onAuthStateChanged(user => {
      if (user && user.email === ADMIN_EMAIL) {
        showDashboard(user);
      } else {
        show('loginScreen', 'flex');
        hide('dashboard');
      }
    });

    $('btnLogin').addEventListener('click', login);
    $('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    $('btnLogout').addEventListener('click', () => _fbAuth.signOut());
    ['overview', 'users', 'revenue', 'activity', 'audit', 'codes', 'config'].forEach(t => {
      const b = $('tab-' + t); if (b) b.addEventListener('click', () => switchTab(t));
    });
    $('btnDoGen').addEventListener('click', doGenerate);
    $('btnCopyCode').addEventListener('click', copyCode);
    $('btnCloseModal').addEventListener('click', closeGenModal);
    $('adminModal').addEventListener('click', e => { if (e.target === $('adminModal')) closeGenModal(); });
    $('btnCloseDelete').addEventListener('click', closeDeleteModal);
    $('btnDoDelete').addEventListener('click', doDeleteUser);
    $('delConfirmInput').addEventListener('input', onConfirmInputChange);
    $('deleteModal').addEventListener('click', e => { if (e.target === $('deleteModal')) closeDeleteModal(); });
    // Drawer détail utilisateur
    const drClose = $('drawerClose'); if (drClose) drClose.addEventListener('click', closeDrawer);
    const drOv = $('drawerOverlay'); if (drOv) drOv.addEventListener('click', closeDrawer);
    const rf = $('btnRefresh'); if (rf) rf.addEventListener('click', refreshAll);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Admin.init());
