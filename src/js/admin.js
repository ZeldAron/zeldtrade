// ─── CONSOLE ADMIN ZELDTRADE ─────────────────────────────────────────────────
if (window.top !== window.self) { window.top.location.replace(window.self.location.href); }

const ADMIN_EMAIL = 'zeldtradepro@gmail.com';

const Admin = (() => {

  // ── SHA-256 ──────────────────────────────────────────────────────────────────
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // v0.9.386 : `generateCode` retiré (génération de code Pro supprimée de l'UI).

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
    beta:   { label: 'VIP',      cls: 'plan-tag-beta'   },
  };

  // Palier spécial (v0.9.347) — ADMIN/TEST affichés DANS la colonne palier.
  // Test : pseudo OU partie locale de l'email = « test », « test1 », « test2 »…
  const _isTestAccount = (u) => {
    if (u.isTestAccount === true) return true;            // marqueur posé par adminCreateTestAccount
    const re = /^test\d*$/i;
    return re.test((u.username || '').trim()) || re.test((u.email || '').split('@')[0].trim());
  };
  // Méta du palier spécial (admin prioritaire sur test), ou null si user normal.
  const _specialTier = (u) =>
    (u.email === ADMIN_EMAIL) ? { label: 'ADMIN', cls: 'plan-tag-admin' }
    : _isTestAccount(u)       ? { label: 'TEST',  cls: 'plan-tag-test' }
    : null;
  // Tag de palier à afficher : spécial (admin/test) sinon palier réel.
  const _planTag = (u, tier) => {
    const m = _specialTier(u) || _TIER_META[tier];
    return `<span class="plan-tag ${m.cls}">${m.label}</span>`;
  };
  // v1.0.6 — libellé de la source d'acquisition (« tu viens d'où ? »)
  const _ACQ_LABELS = { discord: 'Discord', instagram: 'Instagram', word_of_mouth: 'Bouche à oreille', ads: 'Pub (Insta/Google)', other: 'Autre', skip: '(passé)' };
  const _acqLabel = (s) => s ? (_ACQ_LABELS[s] || s) : '—';

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
          ${u.acquisitionSource ? `<div style="font-size:10.5px;color:var(--muted2);margin-top:2px">📍 ${esc(_acqLabel(u.acquisitionSource))}</div>` : ''}
        </td>
        <td>${_planTag(u, tier)}</td>
        <td>
          <div class="cell-dates-act">${activated ? 'Activé ' + activated : '—'}</div>
          <div class="cell-dates-seen">Vu ${lastSeenRel}</div>
        </td>
        <td class="cell-actions">
          <button class="ico-btn ico-btn-violet" data-action="grant-elite" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Activer Elite gratuit (accès complet à vie)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
          <button class="ico-btn ico-btn-blue"   data-action="verify" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Forcer email_verified=true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><polyline points="4 7 12 13 20 7"/></svg></button>
          <button class="ico-btn ico-btn-green"  data-action="partner" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Activer comme partenaire (affiliation / clés)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></button>
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
        <div class="stat-chip stat-chip-beta"><span class="stat-val">${tierCounts.beta}</span><span class="stat-lbl">VIP</span></div>
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
          <option value="beta"${_sel(_filterPlan,'beta')}>VIP</option>
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
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div class="admin-flt-count" style="margin:0">${filtered.length} résultat${filtered.length > 1 ? 's' : ''}${_isFiltered ? ' (filtré)' : ''}</div>
        <button id="btnNewTest" class="btn-refresh" title="Créer un compte de test (réservé admin)">+ Compte test</button>
      </div>
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
    const newTestEl = $('btnNewTest');
    if (newTestEl) newTestEl.addEventListener('click', openTestModal);

    // Bind actions (data-action). stopPropagation → ne pas ouvrir le drawer en cliquant un bouton.
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid, email = btn.dataset.email;
        if (action === 'grant-elite') grantEliteToUser(uid, email, btn);
        else if (action === 'verify') markUserVerified(uid, email, btn);
        else if (action === 'delete') openDeleteModal(uid, email);
        else if (action === 'partner') openPartnerModal(uid, email);
      });
    });
    // Clic sur une ligne → drawer détail utilisateur
    wrap.querySelectorAll('tr.urow').forEach(tr => tr.addEventListener('click', () => openUserDrawer(tr.dataset.rowuid)));
  }

  // ── Activer Elite gratuit pour un user (v0.9.385) ───────────────────────────
  // Remplace le système de code Pro Bêta Testeur : l'admin grant Elite en 1 clic.
  async function grantEliteToUser(uid, email, btn) {
    if (!confirm(`Activer Elite GRATUIT pour ${email} ?\n\nLe user obtient un accès complet à vie (comptes illimités, IA illimitée, support 24h). Pas de prélèvement, géré côté admin uniquement.`)) return;
    if (!_fbFunctions) { toast('SDK Functions non chargé.', true); return; }
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const callable = _fbFunctions.httpsCallable('adminGrantElite');
      await callable({ uid });
      toast(`Elite activé pour ${email}`);
      // Refresh la liste pour voir le nouveau badge
      await renderUsers();
    } catch (e) {
      console.warn('[Admin] adminGrantElite failed', e);
      toast((e && e.message) || 'Erreur lors de l\'activation Elite.', true);
      if (btn) { btn.disabled = false; }
    }
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

  // ── Modale partenaire — activation depuis la liste utilisateurs ───────────────
  const _PACKS = { '5':200, '10':380, '25':902, '50':1715, '100':3258 };

  function _updatePartnerModalFields() {
    const type = $('prtModalType').value;
    const hasInvite    = type === 'invite' || type === 'both';
    const hasAffiliate = type === 'affiliate' || type === 'both';
    $('prtModalPackWrap').style.display    = hasInvite    ? '' : 'none';
    $('prtModalAffCodeWrap').style.display = hasAffiliate ? '' : 'none';
    $('prtModalCommWrap').style.display    = hasAffiliate ? '' : 'none';
  }

  function openPartnerModal(uid, email) {
    $('prtModalUid').value         = uid;
    $('prtModalEmail').textContent = email;
    $('prtModalType').value        = 'invite';
    $('prtModalPack').value        = '5';
    $('prtModalAffCode').value     = '';
    $('prtModalComm').value        = '25';
    $('prtModalNotes').value       = '';
    $('prtModalError').textContent = '';
    $('btnDoPartner').disabled     = false;
    $('btnDoPartner').textContent  = 'Activer le partenariat';
    _updatePartnerModalFields();
    $('partnerModal').style.display = 'flex';
    setTimeout(() => $('prtModalNotes').focus(), 50);
  }

  function closePartnerModal() {
    $('partnerModal').style.display = 'none';
  }

  async function doActivatePartner() {
    const uid     = $('prtModalUid').value;
    const email   = $('prtModalEmail').textContent;
    const type    = $('prtModalType').value;
    const pack    = parseInt($('prtModalPack').value, 10) || 5;
    const affCode = ($('prtModalAffCode').value || '').trim().toLowerCase();
    const comm    = parseFloat($('prtModalComm').value) || 0;
    const notes   = ($('prtModalNotes').value || '').trim();
    const errEl   = $('prtModalError');
    const btn     = $('btnDoPartner');
    const hasInvite    = type === 'invite' || type === 'both';
    const hasAffiliate = type === 'affiliate' || type === 'both';
    errEl.textContent = '';
    if (hasAffiliate && !affCode) {
      errEl.textContent = 'Code affilié requis pour le type Affiliation.'; return;
    }
    if (!_fbFunctions) { errEl.textContent = 'SDK Functions non chargé.'; return; }
    btn.disabled = true; btn.textContent = 'Activation…';
    try {
      // 1. Créer / mettre à jour le profil partenaire
      await _fbFunctions.httpsCallable('adminSetPartnerProfile')({
        uid, type, affCode: hasAffiliate ? affCode : '',
        commission: hasAffiliate ? comm : 0, notes, active: true
      });
      // 2. Générer les clés invite si le type le demande
      if (hasInvite) {
        btn.textContent = `Génération de ${pack} clés…`;
        await _fbFunctions.httpsCallable('adminCreateInviteTokens')({ count: pack, ownerUid: uid });
      }
      const packLabel = hasInvite ? ` · Pack ${pack} clés généré` : '';
      toast(`✓ Partenariat activé pour ${email}${packLabel}`);
      closePartnerModal();
      if (_affiliateLinks !== null || _inviteTokens !== null) {
        _affiliateLinks = null; _inviteTokens = null; renderAffiliate();
      }
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Erreur lors de l\'activation.';
      btn.disabled = false; btn.textContent = 'Activer le partenariat';
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
  // v0.9.390 : filtre par utilisateur (un seul à la fois). Quand un user est
  // sélectionné, on fetch all-time ses events depuis Firestore (au-delà du cap
  // de 1500). Fallback in-memory si l'index uid+ts manque encore.
  let _actUserFilter = '';
  let _actUserEvents = null; // { uid, events, indexMissing? }
  let _actUserLoading = false;

  async function _loadUserEvents(uid) {
    _actUserLoading = true;
    _renderActivityView();
    try {
      const snap = await _fbDb.collection('analyticsEvents')
        .where('uid', '==', uid).orderBy('ts', 'desc').limit(5000).get();
      _actUserEvents = { uid, events: snap.docs.map(d => d.data()) };
    } catch (e) {
      // Index composite uid+ts manquant → fallback sur le cache en mémoire.
      _actUserEvents = {
        uid,
        events: ((_actCache && _actCache.events) || []).filter(ev => ev.uid === uid),
        indexMissing: true,
      };
    } finally {
      _actUserLoading = false;
      _renderActivityView();
    }
  }

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

    // v0.9.390 : si un user est sélectionné, on bosse sur SES events all-time
    // (chargés depuis Firestore au-delà du cap 1500). Sinon on prend le cache global.
    const userFilterActive = !!_actUserFilter && _actUserEvents && _actUserEvents.uid === _actUserFilter;
    const sourceEvents = userFilterActive ? _actUserEvents.events : events;
    const ev = range.ms === Infinity
      ? sourceEvents
      : sourceEvents.filter(e => { const ms = evMs(e); return ms && now - ms <= range.ms; });

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

    // v0.9.390 : sélecteur d'utilisateur (tri par dernière activité desc).
    const sortedUsers = users.slice().sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    const userOptions = sortedUsers.map(u => {
      const label = u.email || u.username || u.uid;
      return `<option value="${esc(u.uid)}"${u.uid === _actUserFilter ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');
    const userFilterHtml = `
      <div class="act-userfilter">
        <label for="actUserFilter">Filtrer par utilisateur</label>
        <select id="actUserFilter">
          <option value="">— Tous les utilisateurs —</option>
          ${userOptions}
        </select>
        ${_actUserFilter ? '<button class="act-userclear" id="actUserClear">Réinitialiser</button>' : ''}
        ${userFilterActive ? `<span class="act-usertag">Historique complet · ${_actUserEvents.events.length} événements${_actUserEvents.indexMissing ? ' (cache local)' : ''}</span>` : ''}
        ${_actUserLoading ? '<span style="color:var(--muted);font-size:12px">Chargement…</span>' : ''}
      </div>`;

    const chips = `
      <div class="admin-stats">
        <div class="stat-chip stat-chip-pro"><span class="stat-val">${activeOnRange}</span><span class="stat-lbl">Actifs (${range.lbl})</span></div>
        <div class="stat-chip"><span class="stat-val">${sids.size}</span><span class="stat-lbl">Sessions</span></div>
        <div class="stat-chip"><span class="stat-val">${ev.length}</span><span class="stat-lbl">Événements${userFilterActive ? ' (user)' : ''}</span></div>
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

    // v0.9.390 : quand un user est sélectionné, on montre TOUT son historique
    // (jusqu'à 500 lignes), sinon on garde le résumé 40 lignes globales.
    const recentCap = userFilterActive ? 500 : 40;
    const recent = ev.slice(0, recentCap);
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

    const cappedNote = (capped && range.ms === Infinity && !userFilterActive)
      ? '<p class="ov-note">Affichage limité aux 1500 événements les plus récents (vue globale). Sélectionne un utilisateur ci-dessous pour son historique complet.</p>' : '';
    const userIndexNote = (userFilterActive && _actUserEvents.indexMissing)
      ? '<p class="ov-note">L\'index Firestore <code>uid + ts</code> n\'existe pas encore — affichage limité au cache global. Crée l\'index dans la console Firebase pour avoir l\'historique complet.</p>' : '';
    const fluxTitle = userFilterActive
      ? `Historique de l'utilisateur <span style="color:var(--muted);font-weight:400">· ${range.lbl} · ${recent.length}${ev.length > recent.length ? '/' + ev.length : ''} lignes</span>`
      : `Flux récent <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span>`;

    wrap.innerHTML = selector + visitorsBlock + chips + userFilterHtml +
      `<h3 style="font-size:13px;margin:20px 0 10px;color:var(--text)">Pages visitées <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span></h3>${pagesHtml}` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">Actions clés <span style="color:var(--muted);font-weight:400">· ${range.lbl}</span></h3><div class="admin-stats">${actionsHtml}</div>` +
      `<h3 style="font-size:13px;margin:24px 0 10px;color:var(--text)">${fluxTitle}</h3>` +
      (recent.length
        ? `<table class="admin-table"><thead><tr><th>Utilisateur</th><th>Type</th><th>Détail</th><th>Quand</th></tr></thead><tbody>${recentRows}</tbody></table>`
        : '<p class="admin-empty">Aucun événement sur cette période.</p>') + cappedNote + userIndexNote;

    wrap.querySelectorAll('.act-range-btn').forEach(b => b.addEventListener('click', () => { _actRange = b.dataset.range; _renderActivityView(); }));
    const sel = $('actUserFilter');
    if (sel) sel.addEventListener('change', () => {
      const v = sel.value;
      _actUserFilter = v;
      if (v) _loadUserEvents(v);
      else { _actUserEvents = null; _renderActivityView(); }
    });
    const clr = $('actUserClear');
    if (clr) clr.addEventListener('click', () => {
      _actUserFilter = ''; _actUserEvents = null; _renderActivityView();
    });
  }

  // v0.9.386 : onglet Codes + modale génération + fonctions associées retirées.
  // Activation Elite gratuite directe via bouton ★ sur chaque user (grantEliteToUser).
  // Les CFs `generateProCode` / `revokeProCode` restent en backend pour les 3 users
  // Lifetime historiques (avant v0.9.385), mais ne sont plus exposées dans l'UI.

  // ── Modale « créer un compte de test » (v0.9.347) ───────────────────────────
  // Propose le prochain pseudo testN libre + un email/mot de passe par défaut
  // (tout est éditable). La création passe par la CF adminCreateTestAccount
  // (admin SDK : email auto-vérifié, n'affecte pas la session admin).
  function _nextTestName() {
    const used = new Set((_cachedUsers || []).map(u => (u.username || '').toLowerCase()));
    let n = 1; while (used.has('test' + n)) n++;
    return 'test' + n;
  }
  function openTestModal() {
    const name = _nextTestName();
    $('testUsername').value    = name;
    $('testEmail').value       = name + '@zeldtrade.test';
    $('testPassword').value    = 'Test1234';
    $('testError').textContent = '';
    $('testModal').style.display = 'flex';
    setTimeout(() => { const el = $('testEmail'); if (el) { el.focus(); el.select(); } }, 0);
  }
  function closeTestModal() { $('testModal').style.display = 'none'; }

  async function doCreateTestAccount() {
    const email    = ($('testEmail').value || '').trim();
    const password = $('testPassword').value || '';
    const username = ($('testUsername').value || '').trim();
    const btn = $('btnDoTest');
    $('testError').textContent = '';
    if (!_fbFunctions) { $('testError').textContent = 'SDK Functions non chargé.'; return; }
    if (!/^test\d*$/i.test(username)) { $('testError').textContent = 'Le pseudo doit être test / test1 / test2…'; return; }
    if (password.length < 6)          { $('testError').textContent = 'Mot de passe : 6 caractères minimum.'; return; }
    btn.disabled = true; btn.textContent = '…';
    try {
      const callable = _fbFunctions.httpsCallable('adminCreateTestAccount');
      const res = await callable({ email, password, username });
      toast(`Compte de test « ${res.data.username} » créé ✓`);
      closeTestModal();
      await renderUsers(); // recharge → le compte apparaît avec le palier TEST
    } catch (e) {
      console.warn('[Admin] adminCreateTestAccount failed', e);
      $('testError').textContent = (e && e.message) || 'Création échouée — réessaie.';
    } finally {
      btn.disabled = false; btn.textContent = 'Créer le compte';
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

  // ── Profils partenaires ───────────────────────────────────────────────────
  async function _renderPartnerSection(wrap) {
    wrap.innerHTML = '<h3 style="font-size:15px;font-weight:700;margin-bottom:4px">🤝 Profils partenaires</h3>' +
      '<p style="font-size:12px;color:var(--muted);margin-bottom:16px">Associe un compte ZeldTrade à un profil partenaire. Le partenaire se connecte sur <strong>/partner</strong>.</p>' +
      '<div class="admin-loading">Chargement…</div>';

    let partners = [];
    try {
      const res = await _fbFunctions.httpsCallable('adminGetPartnerProfiles')();
      partners = res.data.partners || [];
    } catch (e) { wrap.innerHTML += '<p class="admin-empty">Erreur de chargement.</p>'; return; }

    // Formulaire création / mise à jour
    const form = document.createElement('div');
    form.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px';
    form.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">Créer / mettre à jour un partenaire</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <label style="font-size:12px;color:var(--muted);grid-column:1/-1">Rechercher un utilisateur *
          <input id="prtSearch" class="admin-input" placeholder="Email ou pseudo…" autocomplete="off" style="margin-top:4px;width:100%">
          <div id="prtSearchResults" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-top:2px;display:none;max-height:140px;overflow-y:auto;font-size:12px"></div>
          <div id="prtSelectedUser" style="margin-top:6px;font-size:12px;color:var(--green);display:none"></div>
        </label>
        <input id="prtUid" type="hidden">
        <label style="font-size:12px;color:var(--muted)">Type *
          <select id="prtType" class="admin-input" style="margin-top:4px;width:100%">
            <option value="invite">Clés d'invitation seulement</option>
            <option value="affiliate">Affiliation seulement</option>
            <option value="both">Les deux</option>
          </select>
        </label>
        <label style="font-size:12px;color:var(--muted)" id="prtAffCodeWrap">Code affiliation (affiliateLinks)
          <input id="prtAffCode" class="admin-input" placeholder="ex: kruz" style="margin-top:4px;width:100%;font-family:monospace">
        </label>
        <label style="font-size:12px;color:var(--muted)">Commission %
          <input id="prtComm" class="admin-input" type="number" min="0" max="100" value="0" style="margin-top:4px;width:100%">
        </label>
        <label style="font-size:12px;color:var(--muted)" style="grid-column:1/-1">Notes internes
          <input id="prtNotes" class="admin-input" placeholder="ex: Kruz Discord — partenariat signé 08/06" maxlength="300" style="margin-top:4px;width:100%">
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <button id="btnSavePartner" class="btn-primary" style="width:auto;padding:9px 20px">💾 Enregistrer</button>
        <span id="prtStatus" style="font-size:12px;color:var(--muted)"></span>
      </div>`;

    // Tableau des partenaires existants
    const tableWrap = document.createElement('div');
    const typeLabel = { affiliate: 'Affiliation', invite: 'Clés invite', both: 'Affiliation + Clés' };

    if (partners.length === 0) {
      tableWrap.innerHTML = '<p class="admin-empty" style="padding:16px 0">Aucun partenaire configuré.</p>';
    } else {
      const rows = partners.map(p => {
        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : '—';
        const type = typeLabel[p.type] || p.type;
        const aff  = p.affCode ? `<span style="font-family:monospace;font-size:11px;color:var(--green)">?ref=${p.affCode}</span>` : '—';
        const status = p.active
          ? '<span style="color:var(--green)">● Actif</span>'
          : '<span style="color:var(--muted)">○ Inactif</span>';
        return `<tr>
          <td><strong>${esc(p.username) || '—'}</strong><br><span style="font-size:11px;color:var(--muted)">${esc(p.email || p.uid)}</span></td>
          <td style="font-size:12px">${type}</td>
          <td>${aff}</td>
          <td style="font-size:12px">${p.commission || 0}%</td>
          <td>${status}</td>
          <td style="font-size:12px">${date}</td>
          <td>
            <button class="admin-btn-sm" data-prt-uid="${p.uid}" data-prt-edit="1" title="Modifier">✏️</button>
            <button class="admin-btn-sm" data-prt-uid="${p.uid}" data-prt-toggle="${p.active}" title="${p.active ? 'Désactiver' : 'Activer'}">${p.active ? '⏸' : '▶'}</button>
          </td>
        </tr>`;
      }).join('');
      tableWrap.innerHTML = `<table class="admin-table" style="margin-top:4px">
        <thead><tr><th>Partenaire</th><th>Type</th><th>Code affilié</th><th>Comm.</th><th>Statut</th><th>Créé</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    wrap.innerHTML = wrap.innerHTML.replace('<div class="admin-loading">Chargement…</div>', '');
    wrap.appendChild(form);
    wrap.appendChild(tableWrap);

    // ── Recherche email/pseudo → auto-complétion UID ─────────────────────────
    const searchInput   = form.querySelector('#prtSearch');
    const searchResults = form.querySelector('#prtSearchResults');
    const selectedLabel = form.querySelector('#prtSelectedUser');
    const uidInput      = form.querySelector('#prtUid');

    function _selectUser(u) {
      uidInput.value = u.uid;
      selectedLabel.textContent = `✓ ${u.username} — ${u.email}`;
      selectedLabel.style.display = '';
      searchResults.style.display = 'none';
      searchInput.value = '';
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q || q.length < 2) { searchResults.style.display = 'none'; return; }
      const users = _cachedUsers || [];
      const matches = users.filter(u =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
      ).slice(0, 8);
      if (!matches.length) { searchResults.style.display = 'none'; return; }
      searchResults.innerHTML = matches.map(u =>
        `<div data-uid="${esc(u.uid)}" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border)">
          <strong>${esc(u.username)}</strong> <span style="color:var(--muted)">${esc(u.email)}</span>
        </div>`
      ).join('');
      searchResults.style.display = '';
      searchResults.querySelectorAll('[data-uid]').forEach(row => {
        row.addEventListener('click', () => {
          const u = users.find(x => x.uid === row.dataset.uid);
          if (u) _selectUser(u);
        });
        row.addEventListener('mouseover', () => row.style.background = 'var(--bg3, #2a2a2e)');
        row.addEventListener('mouseout',  () => row.style.background = '');
      });
    });

    // Afficher/masquer le champ affCode
    const affCodeWrap = form.querySelector('#prtAffCodeWrap');
    form.querySelector('#prtType').addEventListener('change', e => {
      affCodeWrap.style.display = e.target.value === 'invite' ? 'none' : '';
    });
    affCodeWrap.style.display = form.querySelector('#prtType').value === 'invite' ? 'none' : '';

    // Pré-remplir depuis le tableau (edit)
    tableWrap.querySelectorAll('[data-prt-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.prtUid;
        const p   = partners.find(x => x.uid === uid);
        if (!p) return;
        uidInput.value = p.uid;
        selectedLabel.textContent = `✓ ${p.username || p.email || p.uid}`;
        selectedLabel.style.display = '';
        form.querySelector('#prtType').value   = p.type;
        form.querySelector('#prtAffCode').value = p.affCode || '';
        form.querySelector('#prtComm').value   = p.commission || 0;
        form.querySelector('#prtNotes').value  = p.notes || '';
        affCodeWrap.style.display = p.type === 'invite' ? 'none' : '';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    // Toggle actif/inactif
    tableWrap.querySelectorAll('[data-prt-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid    = btn.dataset.prtUid;
        const active = btn.dataset.prtToggle === 'true';
        btn.disabled = true;
        try {
          await _fbFunctions.httpsCallable('adminSetPartnerProfile')({ uid, active: !active, type: partners.find(p => p.uid === uid)?.type || 'invite' });
          toast(active ? 'Partenaire désactivé.' : 'Partenaire activé.');
          renderAffiliate();
        } catch (e) { toast('Erreur : ' + (e.message || e)); btn.disabled = false; }
      });
    });

    // Sauvegarde
    form.querySelector('#btnSavePartner').addEventListener('click', async () => {
      const uid     = (uidInput.value || '').trim();
      const type    = form.querySelector('#prtType').value;
      const affCode = (form.querySelector('#prtAffCode').value || '').trim().toLowerCase();
      const comm    = parseFloat(form.querySelector('#prtComm').value) || 0;
      const notes   = (form.querySelector('#prtNotes').value || '').trim();
      const stat    = form.querySelector('#prtStatus');
      if (!uid) { stat.textContent = 'Sélectionne un utilisateur via la recherche.'; return; }
      if ((type === 'affiliate' || type === 'both') && !affCode) { stat.textContent = 'Code affilié requis pour ce type.'; return; }
      form.querySelector('#btnSavePartner').disabled = true;
      stat.textContent = 'Enregistrement…';
      try {
        await _fbFunctions.httpsCallable('adminSetPartnerProfile')({ uid, type, affCode, commission: comm, notes });
        toast('Profil partenaire enregistré.');
        stat.textContent = '';
        renderAffiliate();
      } catch (e) {
        stat.textContent = e.message || 'Erreur.';
        form.querySelector('#btnSavePartner').disabled = false;
      }
    });
  }

  // ── Invitations bêta ─────────────────────────────────────────────────────
  let _inviteTokens = null;

  async function _loadInviteTokens() {
    const fn  = _fbFunctions.httpsCallable('adminGetInviteTokens');
    const res = await fn();
    _inviteTokens = res.data.tokens || [];
  }

  async function _renderInviteSection(container) {
    const BASE = 'https://zeldtrade.com/app?invite=';

    // Formulaire génération
    const form = document.createElement('div');
    form.style.cssText = 'max-width:680px;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--border)';
    form.innerHTML = `
      <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">🎟 Invitations bêta — accès Elite personnel</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px">Génère des liens à usage unique. L'invité signe up normalement → Elite activé instantanément → lien brûlé.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <label style="font-size:12px;color:var(--muted)">Label (qui est-ce ?) *
          <input id="invLabel" class="admin-input" placeholder="ex: Kruz Discord" maxlength="100" style="margin-top:4px;width:100%">
        </label>
        <label style="font-size:12px;color:var(--muted)">Tier accordé
          <select id="invTier" class="admin-input" style="margin-top:4px;width:100%">
            <option value="elite">Elite</option>
            <option value="beta">VIP / Bêta (illimité)</option>
            <option value="funded">Funded</option>
          </select>
        </label>
        <label style="font-size:12px;color:var(--muted)">Durée (jours — 0 = illimité)
          <input id="invDays" class="admin-input" type="number" min="0" max="3650" value="0" style="margin-top:4px;width:100%">
        </label>
        <label style="font-size:12px;color:var(--muted)">Nombre de tokens à générer
          <input id="invCount" class="admin-input" type="number" min="1" max="50" value="1" style="margin-top:4px;width:100%">
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <button id="btnGenInvite" class="btn-primary" style="width:auto;padding:9px 20px">⚡ Générer</button>
        <span id="invStatus" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div id="invNewLinks" style="margin-top:16px"></div>`;
    container.appendChild(form);

    // Tableau des tokens existants
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'max-width:980px;margin-bottom:40px';
    _renderInviteTable(tableWrap);
    container.appendChild(tableWrap);

    // Événements formulaire
    const btnGen = form.querySelector('#btnGenInvite');
    btnGen.addEventListener('click', async () => {
      const label = (form.querySelector('#invLabel').value || '').trim();
      const tier  = form.querySelector('#invTier').value;
      const days  = parseInt(form.querySelector('#invDays').value) || 0;
      const count = parseInt(form.querySelector('#invCount').value) || 1;
      const stat  = form.querySelector('#invStatus');
      const box   = form.querySelector('#invNewLinks');
      if (!label) { stat.textContent = 'Label requis.'; return; }
      btnGen.disabled = true;
      stat.textContent = 'Génération…';
      box.innerHTML    = '';
      try {
        const fn  = _fbFunctions.httpsCallable('adminCreateInviteTokens');
        const res = await fn({ label, tier, trialDays: days, count });
        const tokens = res.data.tokens || [];
        stat.textContent = `${tokens.length} lien(s) généré(s) — copie-les maintenant !`;
        const durTxt = days > 0 ? `${days} jours` : 'illimité';
        box.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px">
          <div style="font-weight:600;margin-bottom:8px;color:var(--green)">${tier.toUpperCase()} · ${durTxt}</div>
          ${tokens.map(t => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <code style="background:var(--bg);padding:4px 8px;border-radius:4px;flex:1;overflow:auto;white-space:nowrap">${BASE}${t}</code>
            <button class="admin-btn-sm" data-copy-inv="${BASE}${t}">📋</button>
          </div>`).join('')}
        </div>`;
        box.querySelectorAll('[data-copy-inv]').forEach(b => {
          b.addEventListener('click', () => navigator.clipboard.writeText(b.dataset.copyInv).then(() => toast('Lien copié !')).catch(() => {}));
        });
        _inviteTokens = null;
        _renderInviteTable(tableWrap);
      } catch (e) { stat.textContent = e.message || 'Erreur.'; }
      btnGen.disabled = false;
    });
  }

  function _renderInviteTable(wrap) {
    if (!_inviteTokens) {
      wrap.innerHTML = '<div class="admin-loading">Chargement tokens…</div>';
      _loadInviteTokens().then(() => _renderInviteTable(wrap)).catch(() => {
        wrap.innerHTML = '<p class="admin-empty">Erreur de chargement.</p>';
      });
      return;
    }
    if (_inviteTokens.length === 0) {
      wrap.innerHTML = '<h3 style="font-size:15px;font-weight:700;margin-bottom:12px">Tokens existants</h3><p class="admin-empty">Aucun token généré.</p>';
      return;
    }
    const rows = _inviteTokens.map(t => {
      const date   = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—';
      const usedAt = t.usedAt    ? new Date(t.usedAt).toLocaleDateString('fr-FR') : null;
      const dur    = t.trialDays > 0 ? `${t.trialDays}j` : '∞';
      const status = t.used
        ? `<span style="color:var(--muted)">✓ Utilisé<br><span style="font-size:10px">${usedAt} · ${esc(t.usedEmail || '')}</span></span>`
        : t.active
          ? '<span style="color:var(--green);font-weight:600">● Disponible</span>'
          : '<span style="color:var(--red)">✗ Révoqué</span>';
      const actions = (!t.used && t.active)
        ? `<button class="admin-btn-sm" data-copy-tok="https://zeldtrade.com/app?invite=${esc(t.token)}" title="Copier">📋</button>
           <button class="admin-btn-sm" data-revoke-tok="${esc(t.token)}" title="Révoquer" style="color:var(--red)">✗</button>`
        : '';
      return `<tr>
        <td style="font-size:11px;font-family:monospace;max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(t.token)}</td>
        <td>${esc(t.label)}</td>
        <td><span style="font-size:12px;text-transform:uppercase;font-weight:600">${esc(t.tier)}</span> · ${dur}</td>
        <td style="font-size:12px">${date}</td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">Tokens existants (${_inviteTokens.length})</h3>
      <table class="admin-table">
        <thead><tr><th>Token</th><th>Label</th><th>Tier · Durée</th><th>Créé</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    wrap.querySelectorAll('[data-copy-tok]').forEach(b => {
      b.addEventListener('click', () => navigator.clipboard.writeText(b.dataset.copyTok).then(() => toast('Lien copié !')).catch(() => {}));
    });
    wrap.querySelectorAll('[data-revoke-tok]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm(`Révoquer ce token ? L'invité ne pourra plus l'utiliser.`)) return;
        b.disabled = true;
        try {
          await _fbFunctions.httpsCallable('adminRevokeInviteToken')({ token: b.dataset.revokeTok });
          toast('Token révoqué.');
          _inviteTokens = null;
          _renderInviteTable(wrap);
        } catch (e) { toast('Erreur : ' + (e.message || e)); b.disabled = false; }
      });
    });
  }

  // ── Affiliation ───────────────────────────────────────────────────────────
  let _affiliateLinks = null;

  async function renderAffiliate() {
    const wrap = $('tabAffiliate');
    if (!wrap) return;
    wrap.innerHTML = '';

    // Pré-charger les users en arrière-plan (pour la recherche partenaire, non-bloquant)
    if (!_cachedUsers.length) renderUsers().catch(() => {});

    // ── Section 1 : Invitations bêta (tokens uniques) ──
    try { await _renderInviteSection(wrap); } catch (e) {
      wrap.insertAdjacentHTML('beforeend', '<p class="admin-empty">Erreur de chargement des invitations.</p>');
    }

    // ── Section 2 : Profils partenaires ──
    const partnerSection = document.createElement('div');
    partnerSection.style.cssText = 'max-width:900px;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--border)';
    wrap.appendChild(partnerSection);
    try { await _renderPartnerSection(partnerSection); } catch (e) {
      partnerSection.innerHTML = '<p class="admin-empty">Erreur de chargement des partenaires.</p>';
    }

    // ── Section 3 : Codes d'affiliation (tracking) ──
    const affSection = document.createElement('div');
    wrap.appendChild(affSection);

    try {
      const fn  = _fbFunctions.httpsCallable('adminGetAffiliateLinks');
      const res = await fn();
      _affiliateLinks = res.data.links || [];
    } catch (e) {
      affSection.innerHTML = '<p class="admin-empty">Erreur de chargement des codes d\'affiliation.</p>';
      return;
    }

    const BASE_URL = 'https://zeldtrade.com/?ref=';

    // ── Formulaire création ──
    const formHtml = `
      <div style="max-width:680px;margin-bottom:32px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px">Créer un lien</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <label style="font-size:12px;color:var(--muted)">Code (slug URL) *
            <input id="affCode" class="admin-input" placeholder="ex: kruz" maxlength="30"
              style="margin-top:4px;width:100%;font-family:monospace"
              oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'')">
          </label>
          <label style="font-size:12px;color:var(--muted)">Label (usage interne) *
            <input id="affLabel" class="admin-input" placeholder="ex: Kruz - Discord" maxlength="100"
              style="margin-top:4px;width:100%">
          </label>
          <label style="font-size:12px;color:var(--muted)">Trial — Tier accordé
            <select id="affTier" class="admin-input" style="margin-top:4px;width:100%">
              <option value="">Aucun trial</option>
              <option value="funded">Funded</option>
              <option value="elite">Elite</option>
            </select>
          </label>
          <label style="font-size:12px;color:var(--muted)">Trial — Durée (jours)
            <input id="affDays" class="admin-input" type="number" min="0" max="365" value="7"
              style="margin-top:4px;width:100%">
          </label>
          <label style="font-size:12px;color:var(--muted)">Max signups (0 = illimité)
            <input id="affMax" class="admin-input" type="number" min="0" value="0"
              style="margin-top:4px;width:100%">
          </label>
        </div>
        <button id="btnCreateAffiliate" class="btn-primary" style="width:auto;padding:9px 20px">+ Créer le lien</button>
        <span id="affCreateStatus" style="font-size:12px;margin-left:12px;color:var(--muted)"></span>
      </div>`;

    // ── Table des liens ──
    let rows = '';
    if (_affiliateLinks.length === 0) {
      rows = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Aucun lien créé</td></tr>';
    } else {
      _affiliateLinks.forEach(l => {
        const url     = BASE_URL + l.code;
        const trial   = l.trialTier ? `${l.trialTier} · ${l.trialDays}j` : '—';
        const maxLbl  = l.maxUses > 0 ? l.maxUses : '∞';
        const date    = l.createdAt ? new Date(l.createdAt).toLocaleDateString('fr-FR') : '—';
        const status  = l.active
          ? '<span style="color:var(--green);font-weight:600">● Actif</span>'
          : '<span style="color:var(--muted)">○ Inactif</span>';
        rows += `<tr>
          <td><strong style="font-family:monospace">${esc(l.code)}</strong><br><span style="font-size:11px;color:var(--muted)">${esc(l.label)}</span></td>
          <td style="font-size:12px">${date}</td>
          <td>${status}</td>
          <td style="font-family:monospace;font-size:13px">${l.clicks}</td>
          <td style="font-family:monospace;font-size:13px;color:var(--green)">${l.uses} / ${maxLbl}</td>
          <td style="font-size:12px">${trial}</td>
          <td>
            <button class="admin-btn-sm" data-aff-copy="${url}" title="Copier le lien">📋</button>
            <button class="admin-btn-sm" data-aff-toggle="${esc(l.code)}" data-aff-active="${l.active}" title="${l.active ? 'Désactiver' : 'Activer'}">${l.active ? '⏸' : '▶'}</button>
            <button class="admin-btn-sm" data-aff-delete="${esc(l.code)}" title="Supprimer" style="color:var(--red)">🗑</button>
          </td>
        </tr>`;
      });
    }

    affSection.innerHTML = formHtml + `
      <div style="max-width:900px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:12px;padding-top:32px;border-top:1px solid var(--border)">Codes d'affiliation (tracking)</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:16px">Liens réutilisables pour tracker les signups d'un influenceur. Partagés publiquement.</p>
        <table class="admin-table">
          <thead><tr>
            <th>Code / Label</th><th>Créé</th><th>Statut</th>
            <th>Clics</th><th>Signups</th><th>Trial</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    // ── Événements ──
    const statusEl = affSection.querySelector('#affCreateStatus');

    affSection.querySelectorAll('[data-aff-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.affCopy).then(() => toast('Lien copié !')).catch(() => {});
      });
    });

    affSection.querySelectorAll('[data-aff-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code   = btn.dataset.affToggle;
        const active = btn.dataset.affActive === 'true';
        btn.disabled = true;
        try {
          await _fbFunctions.httpsCallable('adminUpdateAffiliateLink')({ code, active: !active });
          toast(active ? 'Lien désactivé.' : 'Lien activé.');
          _affiliateLinks = null;
          renderAffiliate();
        } catch (e) { toast('Erreur : ' + (e.message || e)); btn.disabled = false; }
      });
    });

    affSection.querySelectorAll('[data-aff-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Supprimer le lien "${btn.dataset.affDelete}" ? Action irréversible.`)) return;
        btn.disabled = true;
        try {
          await _fbFunctions.httpsCallable('adminDeleteAffiliateLink')({ code: btn.dataset.affDelete });
          toast('Lien supprimé.');
          _affiliateLinks = null;
          renderAffiliate();
        } catch (e) { toast('Erreur : ' + (e.message || e)); btn.disabled = false; }
      });
    });

    const btnCreate = affSection.querySelector('#btnCreateAffiliate');
    if (btnCreate) {
      btnCreate.addEventListener('click', async () => {
        const code  = (affSection.querySelector('#affCode').value || '').trim();
        const label = (affSection.querySelector('#affLabel').value || '').trim();
        const tier  = affSection.querySelector('#affTier').value;
        const days  = parseInt(affSection.querySelector('#affDays').value) || 0;
        const max   = parseInt(affSection.querySelector('#affMax').value) || 0;
        if (!code)  { statusEl.textContent = 'Code requis.';  return; }
        if (!label) { statusEl.textContent = 'Label requis.'; return; }
        btnCreate.disabled   = true;
        statusEl.textContent = 'Création…';
        try {
          await _fbFunctions.httpsCallable('adminCreateAffiliateLink')({
            code, label, trialTier: tier, trialDays: days, maxUses: max,
          });
          toast(`Lien "?ref=${code}" créé !`);
          statusEl.textContent = '';
          _affiliateLinks      = null;
          renderAffiliate();
        } catch (e) {
          statusEl.textContent = e.message || 'Erreur.';
          btnCreate.disabled   = false;
        }
      });
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
  let _ovIncludeTest = false;   // v1.0.6 : toggle staging — inclure comptes test/admin dans les stats
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
    // v1.0.6 — stats « vrais clients » : on exclut les comptes test + l'admin
    const isExcluded = (u) => _isTestAccount(u) || u.email === ADMIN_EMAIL;
    const realIdx = users.map((u, i) => i).filter(i => _ovIncludeTest || !isExcluded(users[i]));
    const rUsers = realIdx.map(i => users[i]);
    const rPlans = realIdx.map(i => plans[i]);
    const rStripes = realIdx.map(i => stripes[i]);
    const excluded = users.length - rUsers.length;
    const total = rUsers.length;
    const a7  = rUsers.filter(u => u.lastSeen && now - u.lastSeen <= 7 * DAY).length;
    const a30 = rUsers.filter(u => u.lastSeen && now - u.lastSeen <= 30 * DAY).length;
    const tiers = { basic: 0, funded: 0, elite: 0, beta: 0 };
    rPlans.forEach(p => tiers[_userTier(p)]++);
    const paying = tiers.funded + tiers.elite;
    let mrr = 0, activeSubs = 0;
    rStripes.forEach(s => { if (_isActiveSub(s) && s.tier) { activeSubs++; mrr += mrrFor(s.tier, s.cycle); } });
    const conv = total ? Math.round(paying / total * 100) : 0;
    // v1.0.6 — nouveau modèle : essais en cours + clients lifetime (vrais clients)
    const trials = rPlans.filter(p => p && p.trialEnd && p.trialEnd > now && p.plan !== 'pro').length;
    const lifeCount = rPlans.filter(p => p && p.lifetime === true).length;
    const lifeRev = lifeCount * 499.90;
    // v1.0.6 — attribution : d'où viennent les vrais inscrits
    const ACQ = [['discord', 'Discord'], ['instagram', 'Instagram'], ['word_of_mouth', 'Bouche à oreille'], ['ads', 'Pub (Insta/Google)'], ['other', 'Autre'], ['skip', '(passé)'], ['none', 'Non renseigné']];
    const acqCount = {}; ACQ.forEach(([k]) => acqCount[k] = 0);
    rUsers.forEach(u => { const s = u.acquisitionSource; if (s && acqCount[s] !== undefined) acqCount[s]++; else if (s) acqCount.other++; else acqCount.none++; });
    const ACQ_COLOR = { discord: '#5865f2', instagram: '#e1306c', ads: '#a78bfa', word_of_mouth: '#30d158', other: 'var(--muted)', skip: 'var(--muted2)', none: 'var(--muted2)' };

    // v1.0.6 — utilisateurs les plus actifs (agrégation des analyticsEvents par uid)
    let topActive = [];
    try {
      const evSnap = await _fbDb.collection('analyticsEvents').orderBy('ts', 'desc').limit(3000).get();
      const counts = {}, last = {};
      evSnap.docs.forEach(d => {
        const e = d.data(); const uid = e.uid || e.userId; if (!uid) return;
        counts[uid] = (counts[uid] || 0) + 1;
        const ts = _tsMs(e.ts); if (ts && ts > (last[uid] || 0)) last[uid] = ts;
      });
      const byUid = {}; realIdx.forEach(i => { byUid[users[i].uid] = { u: users[i], plan: plans[i] }; });
      topActive = Object.keys(counts).map(uid => ({ uid, n: counts[uid], last: last[uid], ref: byUid[uid] }))
        .filter(x => x.ref).sort((a, b) => b.n - a.n).slice(0, 10);
    } catch (e) {}

    const card = (v, l, cls) => `<div class="ov-card ${cls || ''}"><div class="ov-val">${v}</div><div class="ov-lbl">${l}</div></div>`;
    const activeRows = topActive.map((x, i) => {
      const u = x.ref.u, tier = _userTier(x.ref.plan);
      return `<tr><td style="color:var(--muted2)">${i + 1}</td><td><div class="cell-user-name">${esc(u.username || '?')}</div><div class="cell-user-email">${esc(u.email || '')}</div></td><td>${_planTag(u, tier)}</td><td style="font-family:var(--font-mono)">${x.n}</td><td style="color:var(--muted)">${formatRelative(x.last)}</td></tr>`;
    }).join('');
    const activePanel = topActive.length
      ? `<table class="admin-table"><thead><tr><th>#</th><th>Utilisateur</th><th>Palier</th><th>Événements</th><th>Vu</th></tr></thead><tbody>${activeRows}</tbody></table>`
      : `<p class="ov-note">Pas encore assez d'événements pour classer les plus actifs.</p>`;

    wrap.innerHTML = `
      <label style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);margin-bottom:14px;cursor:pointer">
        <input type="checkbox" id="ovInclTest"${_ovIncludeTest ? ' checked' : ''}> Inclure les comptes test &amp; admin${(!_ovIncludeTest && excluded) ? ` (${excluded} exclus)` : ''}
      </label>
      <div class="ov-grid">
        ${card(total, 'Utilisateurs')}
        ${card(a7, 'Actifs 7j', 'ov-accent')}
        ${card(a30, 'Actifs 30j')}
        ${card(paying, 'Payants')}
        ${card(trials, 'Essais en cours', 'ov-amber')}
        ${card(lifeCount, 'Clients Lifetime', 'ov-purple')}
        ${card(tiers.beta, 'Bêta (gratuit)')}
        ${card(_eur(mrr), 'MRR estimé', 'ov-green')}
        ${card(_eur(lifeRev), 'Revenu Lifetime', 'ov-green')}
        ${card(conv + '%', 'Conversion payante')}
        ${card(activeSubs, 'Abos Stripe actifs')}
      </div>
      <div class="ov-panel" style="margin-bottom:22px">
        <h3 class="ov-h">🔥 Utilisateurs les plus actifs</h3>
        ${activePanel}
      </div>
      <div class="ov-panel" style="margin-bottom:22px">
        <h3 class="ov-h">📍 Acquisition — d'où viennent les inscrits</h3>
        ${ACQ.filter(([k]) => acqCount[k] > 0 || k === 'none').map(([k, l]) => _tierBar(l, acqCount[k], total, ACQ_COLOR[k])).join('')}
      </div>
      <div class="ov-split">
        <div class="ov-panel">
          <h3 class="ov-h">Répartition des paliers</h3>
          ${_tierBar('✦ Funded', tiers.funded, total, '#a78bfa')}
          ${_tierBar('✦ Elite', tiers.elite, total, '#f0b232')}
          ${_tierBar('Bêta', tiers.beta, total, '#30d158')}
          ${_tierBar('Basic', tiers.basic, total, 'var(--muted)')}
        </div>
        <div class="ov-panel">
          <h3 class="ov-h">Raccourcis</h3>
          <div class="ov-links">
            <button class="btn-secondary" data-goto="users">Gérer les utilisateurs →</button>
            <button class="btn-secondary" data-goto="revenue">Revenu &amp; abonnements →</button>
            <button class="btn-secondary" data-goto="activity">Activité détaillée →</button>
          </div>
          <p class="ov-note">Stats sur les <strong>vrais clients</strong>${excluded ? ` — ${excluded} compte(s) test/admin exclus` : ''}. MRR au tarif courant (Funded ${_eur(PRICES.funded.monthly)}/m, Elite ${_eur(PRICES.elite.monthly)}/m). Lifetime = ${lifeCount} × 499,90 €.</p>
        </div>
      </div>`;
    wrap.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));
    const _it = wrap.querySelector('#ovInclTest'); if (_it) _it.addEventListener('change', (e) => { _ovIncludeTest = e.target.checked; renderOverview(); });
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

    let plan = null, stripe = null, trades = '—', accounts = '—', myAudit = [], myEmails = [], aiUse = null, myEvents = [];
    try {
      const base = _fbDb.collection('users').doc(uid).collection('data');
      const [pS, sS, tS, aS, aiS] = await Promise.all([
        base.doc('plan').get().catch(() => null), base.doc('stripe').get().catch(() => null),
        base.doc('trades').get().catch(() => null), base.doc('myAccounts').get().catch(() => null),
        base.doc('aiUsage').get().catch(() => null),
      ]);
      if (pS && pS.exists) plan = pS.data();
      if (sS && sS.exists) stripe = sS.data();
      if (tS && tS.exists) trades = (tS.data().items || []).length;
      if (aS && aS.exists) accounts = (aS.data().items || []).length;
      if (aiS && aiS.exists) aiUse = aiS.data();
      const [audS, emS, evS] = await Promise.all([
        _fbDb.collection('auditLogs').orderBy('at', 'desc').limit(200).get().catch(() => null),
        _fbDb.collection('emailEvents').where('email', '==', u.email).limit(20).get().catch(() => null),
        _fbDb.collection('analyticsEvents').where('uid', '==', uid).limit(50).get().catch(() => null),
      ]);
      if (audS) myAudit = audS.docs.map(d => d.data()).filter(l => { const p = l.payload || {}; return p.uid === uid || p.targetUid === uid || p.email === u.email; });
      if (emS) myEmails = emS.docs.map(d => d.data());
      if (evS) myEvents = evS.docs.map(d => d.data()).sort((a, b) => _tsMs(b.ts) - _tsMs(a.ts)).slice(0, 25);
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
    const aiTxt = aiUse ? String(aiUse.count != null ? aiUse.count : (aiUse.aiUsedThisWeek != null ? aiUse.aiUsedThisWeek : 0)) : '0';
    const trialHtml = (plan && typeof plan.trialEnd === 'number')
      ? r('Essai', `${Math.max(0, Math.ceil((plan.trialEnd - Date.now()) / 86400000))} j restants · ${formatDateShort(plan.trialEnd)}${plan.trialSource ? ' · ' + esc(plan.trialSource) : ''}`)
      : '';
    const evHtml = myEvents.length
      ? myEvents.map(e => `<div class="dr-log"><code>${esc(e.name || e.event || e.type || e.label || e.action || '?')}</code> · <span style="color:var(--muted)">${formatRelative(_tsMs(e.ts))}</span></div>`).join('')
      : '<span class="dr-empty">Aucun événement récent.</span>';

    $('drawerBody').innerHTML = `
      <div class="dr-sec">${_planTag(u, tier)}${u.newsletterOptIn ? ' <span class="ev-tag ev-soft">newsletter</span>' : ''}</div>
      <div class="dr-sec">
        ${r('Email', esc(u.email || '—'))}
        ${r('UID', `<code class="dr-uid">${esc(uid)}</code>`)}
        ${r('Acquisition', esc(_acqLabel(u.acquisitionSource)))}
        ${r('Dernière activité', formatRelative(u.lastSeen))}
        ${r('Trades', trades)}
        ${r('Comptes', accounts)}
        ${r('Analyses IA', aiTxt)}
        ${trialHtml}
      </div>
      <div class="dr-sec"><div class="dr-sec-h">Abonnement</div>${subBlock}</div>
      <div class="dr-sec"><div class="dr-sec-h">Activité récente</div>${evHtml}</div>
      <div class="dr-sec"><div class="dr-sec-h">Délivrabilité email</div>${emHtml}</div>
      <div class="dr-sec"><div class="dr-sec-h">Historique admin</div>${audHtml}</div>
      <div class="dr-actions">
        <button class="btn-secondary" data-dr="grant-elite">★ Activer Elite gratuit</button>
        <button class="btn-secondary" data-dr="verify">Forcer vérif</button>
        <button class="btn-danger" data-dr="delete">Supprimer</button>
      </div>`;
    $('drawerBody').querySelectorAll('[data-dr]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.dr;
      if (a === 'grant-elite') grantEliteToUser(uid, u.email, b);
      else if (a === 'verify') markUserVerified(uid, u.email, b);
      else if (a === 'delete') { closeDrawer(); openDeleteModal(uid, u.email); }
    }));
  }
  function closeDrawer() { $('userDrawer').classList.remove('open'); $('drawerOverlay').classList.remove('open'); }

  // ── Onglets ───────────────────────────────────────────────────────────────────
  let _currentTab = 'overview';

  // Rafraîchit TOUTES les données de l'onglet courant (vide les caches + re-fetch).
  function refreshAll() {
    _cachedUsers = []; _cachedPlans = []; _cachedCodes = []; _actCache = null; _affiliateLinks = null;
    const btn = $('btnRefresh');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 800); }
    switchTab(_currentTab);
    toast('Données rafraîchies');
  }

  function switchTab(name) {
    _currentTab = name;
    ['overview', 'users', 'revenue', 'activity', 'audit', 'affiliate', 'config'].forEach(t => {
      const btn = $('tab-' + t); if (btn) btn.classList.toggle('tab-active', t === name);
      const div = $('tab' + t.charAt(0).toUpperCase() + t.slice(1)); if (div) div.style.display = t === name ? '' : 'none';
    });
    if (name === 'overview')   renderOverview();
    if (name === 'users')      renderUsers();
    if (name === 'revenue')    renderRevenue();
    if (name === 'activity')   renderActivity();
    if (name === 'audit')      renderAudit();
    if (name === 'affiliate')  renderAffiliate();
    if (name === 'config')     renderConfig();
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
      // v0.9.392 : compte enrôlé en 2FA → Firebase demande le 2nd facteur.
      if (e && e.code === 'auth/multi-factor-auth-required') {
        const elapsed0 = Date.now() - start;
        if (elapsed0 < minDelay) await new Promise(r => setTimeout(r, minDelay - elapsed0));
        btn.disabled = false;
        _mfaBeginLogin(e);   // bascule sur l'écran code 2FA
        return;
      }
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
    // v0.9.392 : si l'admin n'est pas enrôlé en 2FA → bannière d'incitation.
    _mfaUpdateBanner(user);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2FA (TOTP) — v0.9.393 (SDK modulaire via window._mfaApi, cf. admin-fb.js)
  //  - Login : si auth/multi-factor-auth-required → getMultiFactorResolver → code
  //  - Enrôlement : multiFactor(user).getSession → generateSecret → enroll
  //  Le compat n'expose pas TOTP → on passe par les helpers modulaires exposés
  //  sur window._mfaApi = { multiFactor, TotpMultiFactorGenerator, getMultiFactorResolver }.
  //  Durcissement backend (sign_in_second_factor) APRÈS 2 logins MFA réussis.
  // ════════════════════════════════════════════════════════════════════════════
  let _mfaResolver  = null;   // resolver Firebase pendant un login MFA
  let _mfaSecret    = null;   // TotpSecret pendant un enrôlement

  function _mfaIsEnrolled(user) {
    try {
      const factors = user ? (window._mfaApi.multiFactor(user).enrolledFactors || []) : [];
      return factors.length > 0;
    } catch { return false; }
  }

  function _mfaUpdateBanner(user) {
    const banner = $('mfaBanner');
    if (!banner) return;
    banner.style.display = _mfaIsEnrolled(user) ? 'none' : 'flex';
  }

  // ── Login : 2nd facteur ──────────────────────────────────────────────────────
  function _mfaBeginLogin(err) {
    // SDK modulaire : le resolver s'obtient via getMultiFactorResolver(auth, err).
    try {
      _mfaResolver = window._mfaApi.getMultiFactorResolver(err);
    } catch {
      _mfaResolver = null;
    }
    if (!_mfaResolver) {
      $('loginError').textContent = 'Erreur 2FA — recharge la page.';
      return;
    }
    show('mfaLoginSection', 'block');
    $('btnLogin').style.display = 'none';
    $('mfaLoginError').textContent = '';
    $('mfaLoginCode').value = '';
    $('mfaLoginCode').focus();
  }

  async function mfaVerifyLogin() {
    const code = ($('mfaLoginCode').value || '').replace(/\D/g, '').slice(0, 6);
    const errEl = $('mfaLoginError');
    const btn = $('btnMfaVerify');
    errEl.textContent = '';
    if (code.length !== 6) { errEl.textContent = 'Code à 6 chiffres requis.'; return; }
    if (!_mfaResolver) { errEl.textContent = 'Session expirée — recharge la page.'; return; }
    btn.disabled = true;
    try {
      // Le 1er facteur enrôlé (TOTP)
      const hint = _mfaResolver.hints[0];
      const assertion = window._mfaApi.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
      const cred = await _mfaResolver.resolveSignIn(assertion);
      if (cred.user.email !== ADMIN_EMAIL) { await _fbAuth.signOut(); throw new Error('not admin'); }
      _mfaResolver = null;
      // onAuthStateChanged prendra le relais et affichera le dashboard
    } catch (e) {
      btn.disabled = false;
      errEl.textContent = (e && e.code === 'auth/invalid-verification-code')
        ? 'Code invalide. Réessaie.'
        : 'Échec de la vérification 2FA.';
      return;
    }
    btn.disabled = false;
  }

  // ── Enrôlement ─────────────────────────────────────────────────────────────
  async function mfaOpenEnroll() {
    const user = _fbAuth.currentUser;
    if (!user) { toast('Reconnecte-toi avant d\'activer la 2FA.', true); return; }
    $('mfaStep1').style.display = 'block';
    $('mfaStep2').style.display = 'none';
    $('mfaEnrollError').textContent = '';
    $('mfaEnrollCode').value = '';
    $('mfaSecretKey').textContent = 'Génération…';
    show('mfaEnrollModal', 'flex');
    try {
      const session = await window._mfaApi.multiFactor(user).getSession();
      _mfaSecret = await window._mfaApi.TotpMultiFactorGenerator.generateSecret(session);
      const key = _mfaSecret.secretKey || '';
      // Formatage par groupes de 4 pour lisibilité
      $('mfaSecretKey').textContent = key.replace(/(.{4})/g, '$1 ').trim();
      const url = _mfaSecret.generateQrCodeUrl
        ? _mfaSecret.generateQrCodeUrl(user.email || 'admin', 'ZeldTrade Admin')
        : '';
      const link = $('mfaOtpauthLink');
      if (url) { link.href = url; } else { link.style.display = 'none'; }
    } catch (e) {
      $('mfaEnrollError').textContent = 'Impossible de générer la clé 2FA. ' + ((e && e.message) || '');
      $('mfaSecretKey').textContent = '—';
    }
  }

  async function mfaDoEnroll() {
    const user = _fbAuth.currentUser;
    const code = ($('mfaEnrollCode').value || '').replace(/\D/g, '').slice(0, 6);
    const errEl = $('mfaEnrollError');
    const btn = $('btnDoMfaEnroll');
    errEl.textContent = '';
    if (!user || !_mfaSecret) { errEl.textContent = 'Session expirée — rouvre la fenêtre.'; return; }
    if (code.length !== 6) { errEl.textContent = 'Code à 6 chiffres requis.'; return; }
    btn.disabled = true;
    try {
      const assertion = window._mfaApi.TotpMultiFactorGenerator.assertionForEnrollment(_mfaSecret, code);
      await window._mfaApi.multiFactor(user).enroll(assertion, 'Authenticator TOTP');
      _mfaSecret = null;
      $('mfaStep1').style.display = 'none';
      $('mfaStep2').style.display = 'block';
      _mfaUpdateBanner(user);
    } catch (e) {
      btn.disabled = false;
      errEl.textContent = (e && e.code === 'auth/invalid-verification-code')
        ? 'Code invalide — vérifie l\'heure de ton téléphone et réessaie.'
        : 'Échec de l\'activation. ' + ((e && e.message) || '');
      return;
    }
    btn.disabled = false;
  }

  function mfaCloseEnroll() { hide('mfaEnrollModal'); _mfaSecret = null; }

  async function mfaCopySecret() {
    try {
      const txt = ($('mfaSecretKey').textContent || '').replace(/\s/g, '');
      await navigator.clipboard.writeText(txt);
      toast('Clé copiée ✓');
    } catch { toast('Copie impossible — sélectionne manuellement.', true); }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    _fbAuth.onAuthStateChanged(user => {
      if (user && user.email === ADMIN_EMAIL) {
        // v1.0.2 : marque cet appareil comme « admin » → tes visites ne comptent plus
        // dans les stats publiques (recordVisit landing/app lit ce flag et skip).
        try { localStorage.setItem('zt_notrack', '1'); } catch (e) {}
        showDashboard(user);
      } else {
        show('loginScreen', 'flex');
        hide('dashboard');
        // v0.9.392 : reset de l'écran login (cas retour après logout/échec MFA)
        const ms = $('mfaLoginSection'); if (ms) ms.style.display = 'none';
        const bl = $('btnLogin'); if (bl) bl.style.display = '';
        _mfaResolver = null;
      }
    });

    $('btnLogin').addEventListener('click', login);
    $('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    $('btnLogout').addEventListener('click', () => _fbAuth.signOut());
    // v0.9.392 : 2FA — login + enrôlement
    $('btnMfaVerify').addEventListener('click', mfaVerifyLogin);
    $('mfaLoginCode').addEventListener('keydown', e => { if (e.key === 'Enter') mfaVerifyLogin(); });
    $('btnOpenMfaEnroll').addEventListener('click', mfaOpenEnroll);
    $('btnDoMfaEnroll').addEventListener('click', mfaDoEnroll);
    $('mfaEnrollCode').addEventListener('keydown', e => { if (e.key === 'Enter') mfaDoEnroll(); });
    $('btnCloseMfaEnroll').addEventListener('click', mfaCloseEnroll);
    $('btnCloseMfaEnrollDone').addEventListener('click', mfaCloseEnroll);
    $('btnCopyMfaSecret').addEventListener('click', mfaCopySecret);
    $('mfaEnrollModal').addEventListener('click', e => { if (e.target === $('mfaEnrollModal')) mfaCloseEnroll(); });
    ['overview', 'users', 'revenue', 'activity', 'audit', 'affiliate', 'config'].forEach(t => {
      const b = $('tab-' + t); if (b) b.addEventListener('click', () => switchTab(t));
    });
    // v0.9.386 : bindings de la modale génération de code retirés.
    $('btnCloseDelete').addEventListener('click', closeDeleteModal);
    $('btnDoDelete').addEventListener('click', doDeleteUser);
    $('delConfirmInput').addEventListener('input', onConfirmInputChange);
    if ($('btnClosePartnerModal')) $('btnClosePartnerModal').addEventListener('click', closePartnerModal);
    if ($('btnDoPartner'))         $('btnDoPartner').addEventListener('click', doActivatePartner);
    if ($('prtModalType'))         $('prtModalType').addEventListener('change', _updatePartnerModalFields);
    if ($('partnerModal'))         $('partnerModal').addEventListener('click', e => { if (e.target === $('partnerModal')) closePartnerModal(); });
    $('deleteModal').addEventListener('click', e => { if (e.target === $('deleteModal')) closeDeleteModal(); });
    // Modale création compte de test (v0.9.347)
    const btCl = $('btnCloseTest'); if (btCl) btCl.addEventListener('click', closeTestModal);
    const btDo = $('btnDoTest');    if (btDo) btDo.addEventListener('click', doCreateTestAccount);
    const tm   = $('testModal');    if (tm)   tm.addEventListener('click', e => { if (e.target === tm) closeTestModal(); });
    // Drawer détail utilisateur
    const drClose = $('drawerClose'); if (drClose) drClose.addEventListener('click', closeDrawer);
    const drOv = $('drawerOverlay'); if (drOv) drOv.addEventListener('click', closeDrawer);
    const rf = $('btnRefresh'); if (rf) rf.addEventListener('click', refreshAll);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Admin.init());
