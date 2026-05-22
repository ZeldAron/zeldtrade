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

      return `<tr>
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
          <button class="ico-btn ico-btn-violet" data-action="stripe" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Créer un lien de paiement Stripe"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>
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

    // Bind actions (event delegation par data-action)
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        const email = btn.dataset.email;
        if (action === 'gen')         openGenModal(uid, email);
        else if (action === 'stripe') openStripeModal(uid, email);
        else if (action === 'verify') markUserVerified(uid, email, btn);
        else if (action === 'delete') openDeleteModal(uid, email);
      });
    });
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

  async function renderActivity() {
    const wrap = $('tabActivity');
    wrap.innerHTML = '<div class="admin-loading">Chargement…</div>';
    let users = [], events = [], visitsTotal = 0, visitsToday = 0;
    const _today = new Date().toISOString().slice(0, 10);
    try {
      const [u, ev, gSnap, dSnap] = await Promise.all([
        loadUsers(),
        _fbDb.collection('analyticsEvents').orderBy('ts', 'desc').limit(1500).get(),
        _fbDb.doc('publicStats/global').get().catch(() => null),
        _fbDb.doc('publicStats/visits-' + _today).get().catch(() => null),
      ]);
      users  = u;
      events = ev.docs.map(d => d.data());
      if (gSnap && gSnap.exists) visitsTotal = Math.max(0, Number(gSnap.data().visitsTotal) || 0);
      if (dSnap && dSnap.exists) visitsToday = Math.max(0, Number(dSnap.data().count) || 0);
    } catch (e) {
      wrap.innerHTML = '<p class="admin-empty">Erreur de chargement. (Si c\'est la 1ʳᵉ fois, l\'index Firestore se crée — réessaie dans 1 min.)</p>';
      return;
    }
    const emailByUid = {};
    users.forEach(u => { emailByUid[u.uid] = u.email || u.username || u.uid; });
    const now = Date.now(), DAY = 86400000;
    const activeIn = ms => users.filter(u => u.lastSeen && (now - u.lastSeen) <= ms).length;

    const byType = {}, byPage = {}, sids = new Set();
    events.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.sid) sids.add(e.sid);
      if (e.type === 'page_view' && e.page) byPage[e.page] = (byPage[e.page] || 0) + 1;
    });

    const chips = `
      <div class="admin-stats">
        <div class="stat-chip"><span class="stat-val">${activeIn(DAY)}</span><span class="stat-lbl">Actifs 24h</span></div>
        <div class="stat-chip"><span class="stat-val">${activeIn(7 * DAY)}</span><span class="stat-lbl">Actifs 7j</span></div>
        <div class="stat-chip"><span class="stat-val">${activeIn(30 * DAY)}</span><span class="stat-lbl">Actifs 30j</span></div>
        <div class="stat-chip stat-chip-pro"><span class="stat-val">${sids.size}</span><span class="stat-lbl">Sessions</span></div>
        <div class="stat-chip"><span class="stat-val">${events.length}</span><span class="stat-lbl">Événements</span></div>
      </div>`;

    const pages = Object.entries(byPage).sort((a, b) => b[1] - a[1]);
    const maxPage = pages.length ? pages[0][1] : 1;
    const pagesHtml = pages.length ? pages.map(([p, n]) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="width:95px;font-size:12px;color:var(--text)">${esc(_PAGE_LABELS[p] || p)}</span>
        <div style="flex:1;background:var(--bg);border-radius:5px;overflow:hidden;height:18px"><div style="height:100%;width:${Math.round(n / maxPage * 100)}%;background:var(--purple);border-radius:5px"></div></div>
        <span style="width:42px;text-align:right;font-size:12px;color:var(--muted)">${n}</span>
      </div>`).join('') : '<p class="admin-empty">Aucune vue de page encore enregistrée.</p>';

    const actions = ['trade_created', 'account_created', 'ai_analysis', 'checkout_started'];
    const actionsHtml = actions.map(a => `
      <div class="stat-chip" style="flex:1"><span class="stat-val">${byType[a] || 0}</span><span class="stat-lbl">${_ACT_LABELS[a]}</span></div>`).join('');

    const recent = events.slice(0, 30);
    const recentRows = recent.map(e => {
      const ms    = (e.ts && e.ts.toMillis) ? e.ts.toMillis() : null;
      const label = e.type === 'page_view' ? (_PAGE_LABELS[e.page] || e.page || '?') : (_ACT_LABELS[e.type] || e.type);
      const kind  = e.type === 'page_view' ? 'Page' : 'Action';
      return `<tr><td>${esc(emailByUid[e.uid] || e.uid || '?')}</td><td>${kind}</td><td>${esc(label)}</td><td style="color:var(--muted)">${ms ? formatRelative(ms) : '—'}</td></tr>`;
    }).join('');

    const visitorsBlock = `
      <div style="display:flex;gap:14px;margin-bottom:22px;flex-wrap:wrap">
        <div style="flex:1;min-width:170px;background:linear-gradient(135deg,rgba(124,58,237,0.18),rgba(124,58,237,0.05));border:1px solid rgba(124,58,237,0.4);border-radius:12px;padding:18px 22px">
          <div style="font-size:34px;font-weight:800;color:var(--purple-l);line-height:1">${visitsToday}</div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Visiteurs aujourd'hui</div>
        </div>
        <div style="flex:1;min-width:170px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 22px">
          <div style="font-size:34px;font-weight:800;color:var(--text);line-height:1">${visitsTotal}</div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Visiteurs au total</div>
        </div>
      </div>`;

    wrap.innerHTML = visitorsBlock + chips +
      `<h3 style="font-size:13px;margin:20px 0 10px;color:var(--text)">Pages visitées</h3>${pagesHtml}` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">Actions clés</h3><div class="admin-stats">${actionsHtml}</div>` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">Flux récent</h3>` +
      (recent.length
        ? `<table class="admin-table"><thead><tr><th>Utilisateur</th><th>Type</th><th>Détail</th><th>Quand</th></tr></thead><tbody>${recentRows}</tbody></table>`
        : '<p class="admin-empty">Aucun événement encore. L\'activité apparaîtra dès que les utilisateurs navigueront (après déploiement).</p>');
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

  // ── Modale génération de lien Stripe (admin uniquement) ─────────────────────
  // Le user ne fait RIEN — il reçoit juste le lien par message direct (Discord/email)
  // et clique → Stripe affiche le prix → il paie → webhook active Pro automatiquement.
  function openStripeModal(uid, email) {
    $('stripeTargetUid').value      = uid;
    $('stripeTargetEmail').value    = email;
    $('stripeTargetEmailLabel').textContent = email;
    $('stripeResult').style.display = 'none';
    $('stripeError').textContent    = '';
    $('stripeUrl').value            = '';
    $('stripeTier').value           = 'monthly';
    $('btnDoStripe').disabled       = false;
    $('btnDoStripe').textContent    = 'Générer le lien';
    $('adminStripeModal').style.display = 'flex';
  }
  function closeStripeModal() {
    $('adminStripeModal').style.display = 'none';
  }
  async function doGenerateStripeLink() {
    const tier        = $('stripeTier').value;
    const targetUid   = $('stripeTargetUid').value;
    const targetEmail = $('stripeTargetEmail').value;
    const btn         = $('btnDoStripe');
    btn.disabled    = true;
    btn.textContent = '…';
    $('stripeError').textContent = '';
    if (!_fbFunctions) {
      $('stripeError').textContent = 'SDK Functions non chargé.';
      btn.disabled = false; btn.textContent = 'Générer le lien';
      return;
    }
    try {
      const callable = _fbFunctions.httpsCallable('createCheckoutSession');
      const res = await callable({ tier, targetUid, targetEmail });
      $('stripeUrl').value = res.data.url;
      $('stripeResult').style.display = 'block';
      toast('Lien Stripe généré !');
    } catch (e) {
      console.warn('[Admin] createCheckoutSession failed', e);
      $('stripeError').textContent = (e && e.message) || 'Erreur lors de la génération.';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Générer le lien';
    }
  }
  async function copyStripeUrl() {
    const url = $('stripeUrl').value;
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié — envoie-le par message au bêta-testeur');
    } catch {
      toast('Sélectionne le lien manuellement.', true);
    }
  }

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

    // Section 1 — Clés API IA (admin info)
    const sectionAI = document.createElement('div');
    sectionAI.style.cssText = 'max-width:560px;margin-bottom:32px';
    sectionAI.innerHTML = `
      <h3 style="margin:0 0 6px;font-size:15px">Clés API IA Vision</h3>
      <p style="font-size:12px;color:var(--muted);line-height:1.6">
        Les clés des fournisseurs IA tiers sont dans <strong>Google Secret Manager</strong>, utilisées uniquement par
        la Cloud Function <code>analyzeChart</code>. Jamais exposées au client.
      </p>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:14px;font-family:monospace;font-size:12px;color:var(--muted);line-height:1.7">
        # IA standard (modèle vision) :<br>
        <span style="color:var(--text)">firebase functions:secrets:set GROQ_API_KEY</span><br><br>
        # IA avancée (Anthropic Claude) :<br>
        <span style="color:var(--text)">firebase functions:secrets:set CLAUDE_API_KEY</span>
      </div>`;
    wrap.appendChild(sectionAI);

    // Section 2 — Cleanup userEmails orphelins
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

  // ── Onglets ───────────────────────────────────────────────────────────────────
  function switchTab(name) {
    ['users', 'activity', 'codes', 'config'].forEach(t => {
      $('tab-' + t).classList.toggle('tab-active', t === name);
      $('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === name ? '' : 'none';
    });
    if (name === 'users')    renderUsers();
    if (name === 'activity') renderActivity();
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
    switchTab('users');
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
    $('tab-users').addEventListener('click', () => switchTab('users'));
    $('tab-activity').addEventListener('click', () => switchTab('activity'));
    $('tab-codes').addEventListener('click', () => switchTab('codes'));
    $('tab-config').addEventListener('click', () => switchTab('config'));
    $('btnDoGen').addEventListener('click', doGenerate);
    $('btnCopyCode').addEventListener('click', copyCode);
    $('btnCloseModal').addEventListener('click', closeGenModal);
    $('adminModal').addEventListener('click', e => { if (e.target === $('adminModal')) closeGenModal(); });
    $('btnCloseDelete').addEventListener('click', closeDeleteModal);
    $('btnDoDelete').addEventListener('click', doDeleteUser);
    $('delConfirmInput').addEventListener('input', onConfirmInputChange);
    $('deleteModal').addEventListener('click', e => { if (e.target === $('deleteModal')) closeDeleteModal(); });
    // Stripe modal
    $('btnDoStripe').addEventListener('click', doGenerateStripeLink);
    $('btnCloseStripe').addEventListener('click', closeStripeModal);
    $('btnCopyStripeUrl').addEventListener('click', copyStripeUrl);
    $('adminStripeModal').addEventListener('click', e => { if (e.target === $('adminStripeModal')) closeStripeModal(); });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Admin.init());
