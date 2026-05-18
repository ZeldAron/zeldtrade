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
    setTimeout(() => { t.style.opacity = '0'; }, 3000);
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
    let proCount = 0, newsletterCount = 0;
    for (let i = 0; i < users.length; i++) {
      if (plans[i]?.plan === 'pro')        proCount++;
      if (users[i].newsletterOptIn)        newsletterCount++;
    }
    const basicCount = total - proCount;

    // Filtre live (pseudo OU email)
    const q = (_userSearchQuery || '').toLowerCase().trim();
    const filtered = users.map((u, i) => ({ u, plan: plans[i] }))
      .filter(({ u }) => !q
        || (u.username || '').toLowerCase().includes(q)
        || (u.email    || '').toLowerCase().includes(q));

    // Lignes
    const rows = filtered.map(({ u, plan }) => {
      const isPro       = plan?.plan === 'pro';
      const isSelf      = u.uid === currentAdminUid;
      const activated   = isPro ? formatDateShort(plan.activatedAt) : null;
      const lastSeenRel = formatRelative(u.lastSeen);
      const newsletter  = u.newsletterOptIn
        ? '<span class="badge-news" title="Inscrit à la newsletter">📬</span>' : '';

      const deleteBtn = isSelf
        ? '<button class="ico-btn" disabled title="Vous ne pouvez pas vous supprimer vous-même">🗑️</button>'
        : `<button class="ico-btn ico-btn-red" data-action="delete" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Supprimer le compte">🗑️</button>`;

      return `<tr>
        <td>
          <div class="cell-user-name">${esc(u.username)}${newsletter}</div>
          <div class="cell-user-email">${esc(u.email)}</div>
        </td>
        <td><span class="plan-tag ${isPro ? 'plan-tag-pro' : 'plan-tag-basic'}">${isPro ? '✦ PRO' : 'BASIC'}</span></td>
        <td>
          <div class="cell-dates-act">${activated ? 'Activé ' + activated : '—'}</div>
          <div class="cell-dates-seen">Vu ${lastSeenRel}</div>
        </td>
        <td class="cell-actions">
          <button class="ico-btn ico-btn-violet" data-action="gen"    data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Générer un code Bêta Testeur (accès complet)">🎟️</button>
          <button class="ico-btn ico-btn-violet" data-action="stripe" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Créer un lien de paiement Stripe">💳</button>
          <button class="ico-btn ico-btn-blue"   data-action="verify" data-uid="${esc(u.uid)}" data-email="${esc(u.email)}" title="Forcer email_verified=true">✉️</button>
          ${deleteBtn}
        </td>
      </tr>`;
    }).join('');

    const emptyRow = filtered.length === 0
      ? '<tr><td colspan="4" class="admin-empty-row">Aucun résultat pour ce filtre.</td></tr>'
      : '';

    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="stat-chip"><span class="stat-val">${total}</span><span class="stat-lbl">Utilisateurs</span></div>
        <div class="stat-chip stat-chip-pro"><span class="stat-val">${proCount}</span><span class="stat-lbl">Pro</span></div>
        <div class="stat-chip"><span class="stat-val">${basicCount}</span><span class="stat-lbl">Basic</span></div>
        <div class="stat-chip"><span class="stat-val">${newsletterCount}</span><span class="stat-lbl">Newsletter</span></div>
      </div>
      <div class="admin-search">
        <input type="text" id="userSearch" placeholder="Rechercher par pseudo ou email…" value="${esc(q)}" autocomplete="off" spellcheck="false" />
      </div>
      <table class="admin-table">
        <thead><tr><th>Utilisateur</th><th>Plan</th><th>Activité</th><th class="th-actions">Actions</th></tr></thead>
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
          <button class="ico-btn ico-btn-red" data-action="revoke" data-id="${esc(c.id)}" data-uid="${esc(c.uid)}" data-email="${esc(c.email || '?')}" data-active="${c.isActive}" title="Révoquer ce code">🚫</button>
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
      toast(`Utilisateur ${email} supprimé.`);
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

  // ── Config Groq — DÉPRÉCIÉE depuis v0.9.82 ───────────────────────────────────
  // La clé Groq est désormais stockée dans Google Secret Manager et utilisée
  // exclusivement par la Cloud Function `analyzeChart`. Plus aucune lecture
  // ni écriture client (rules Firestore : `allow read, write: if false`).
  async function renderConfig() {
    const wrap = $('tabConfig');
    // Construction via DOM API (pas innerHTML user-injection — sécurité)
    wrap.textContent = '';

    // Section 1 — Clés API IA (admin info)
    const sectionGroq = document.createElement('div');
    sectionGroq.style.cssText = 'max-width:560px;margin-bottom:32px';
    sectionGroq.innerHTML = `
      <h3 style="margin:0 0 6px;font-size:15px">Clés API IA Vision</h3>
      <p style="font-size:12px;color:var(--muted);line-height:1.6">
        Les clés des fournisseurs IA tiers sont dans <strong>Google Secret Manager</strong>, utilisées uniquement par
        la Cloud Function <code>analyzeChart</code>. Jamais exposées au client.
      </p>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:14px;font-family:monospace;font-size:12px;color:var(--muted);line-height:1.7">
        # IA standard (Groq Llama 4) :<br>
        <span style="color:var(--text)">firebase functions:secrets:set GROQ_API_KEY</span><br><br>
        # IA avancée (Anthropic Claude) :<br>
        <span style="color:var(--text)">firebase functions:secrets:set CLAUDE_API_KEY</span>
      </div>`;
    wrap.appendChild(sectionGroq);

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
    btnAnalyze.textContent = '🔍 Analyser (dry-run)';
    btnRow.appendChild(btnAnalyze);

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'btn-danger';
    btnConfirm.id = 'btnCleanupConfirm';
    btnConfirm.textContent = '🗑 Supprimer les orphelins';
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
          txt += '✅ Aucun orphelin détecté. Tout est propre.';
          btnConfirm.disabled = true;
          btnConfirm.style.opacity = '0.5';
        } else {
          txt += '❌ ORPHELINS À SUPPRIMER :\n';
          lastDryRunOrphans.forEach(o => {
            txt += `  • UID: ${o.uid}\n    Email: ${o.email}\n`;
          });
          btnConfirm.disabled = false;
          btnConfirm.style.opacity = '1';
        }
        resultBox.textContent = txt;
      } catch (e) {
        resultBox.textContent = '❌ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.textContent = '🔍 Analyser (dry-run)';
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
          txt += '✅ SUPPRIMÉS :\n';
          d.deleted.forEach(x => {
            txt += `  • ${x.email} (UID: ${x.uid}) — ${x.codesRevoked} code(s) révoqué(s)\n`;
          });
        }
        if (d.errors && d.errors.length) {
          txt += '\n❌ ERREURS :\n';
          d.errors.forEach(e => { txt += `  • ${e.email}: ${e.error}\n`; });
        }
        resultBox.textContent = txt;
        lastDryRunOrphans = null;
        toast('Cleanup terminé');
      } catch (e) {
        resultBox.textContent = '❌ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnConfirm.disabled = true;
        btnConfirm.style.opacity = '0.5';
        btnConfirm.textContent = '🗑 Supprimer les orphelins';
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
    btnVerify.textContent = '✉️ Marquer tous les emails comme vérifiés';
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
        txt += `✅ Vérifiés : ${d.verified}\n`;
        txt += `⏭ Déjà vérifiés (skip) : ${d.skipped}\n`;
        if (d.errors) txt += `❌ Erreurs : ${d.errors}\n`;
        if (d.truncated) txt += '\n⚠ Tronqué à 1000 users — relance si tu as plus de monde.';
        resultV.textContent = txt;
        toast('Vérification email bulk terminée.');
      } catch (e) {
        resultV.textContent = '❌ Erreur : ' + ((e && e.message) || 'inconnue');
      } finally {
        btnVerify.disabled = false;
        btnVerify.textContent = '✉️ Marquer tous les emails comme vérifiés';
      }
    });
  }

  // ── Onglets ───────────────────────────────────────────────────────────────────
  function switchTab(name) {
    ['users', 'codes', 'config'].forEach(t => {
      $('tab-' + t).classList.toggle('tab-active', t === name);
      $('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === name ? '' : 'none';
    });
    if (name === 'users')  renderUsers();
    if (name === 'codes')  renderCodes();
    if (name === 'config') renderConfig();
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
