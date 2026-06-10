// ─── UI CORE ──────────────────────────────────────────────────────────────────
// Shared state, utilities, toast, sidebar stats, trade list + detail
// Page renderers are assigned by js/pages/*.js

const UI = (() => {
  const $ = id => document.getElementById(id);

  // Shared state
  let selectedId    = null;
  // v0.9.238 : persistance du filtre + recherche journal dans localStorage.
  // Évite de tout refiltrer manuellement à chaque switch de page / reload.
  const _FILTER_KEY = 'zeld_journal_filter_v1';
  const _SEARCH_KEY = 'zeld_journal_search_v1';
  let currentFilter = 'all';
  try {
    const saved = localStorage.getItem(_FILTER_KEY);
    if (saved && ['all', 'win', 'loss', 'be', 'open'].includes(saved)) currentFilter = saved;
  } catch {}

  // Shared constants (exposed for page files)
  const OB_CLASS = { win:'ob-win', loss:'ob-loss', be:'ob-be', breakeven:'ob-be', open:'ob-open' };
  const OB_LABEL = { win: i18n.t('ob.win'), loss: i18n.t('ob.loss'), be: i18n.t('ob.be'), breakeven: i18n.t('ob.be'), open: i18n.t('ob.open') };
  const MICRO_RATES = {
    bnc:          { cotis: 24.6, cfp: 0.2, vl: 2.2, abat: 34, labelKey: 'micro.bnc.label' },
    bic_services: { cotis: 21.2, cfp: 0.3, vl: 1.7, abat: 50, labelKey: 'micro.bic.services.label' },
    bic_vente:    { cotis: 12.3, cfp: 0.1, vl: 1.0, abat: 71, labelKey: 'micro.bic.vente.label' },
  };

  // ── Shared helpers (exposed on UI for page files) ───────────────────────────
  function localDay(dateStr) {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // YYYY-MM-DD au fuseau local — à utiliser pour comparer aux dates de trades
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function statsForTrades(trades) {
    // Winrate basé sur netPnl > 0 (pas outcome) : un trade `be` avec partial profitable
    // compte comme un gain. Cohérent avec ce que voit le user dans son P&L réel.
    // Trades `open` exclus (résultat non final). manualPnl override pris en compte.
    let closedCount = 0, winsCount = 0, totalPnL = 0, rrSum = 0;
    // v0.9.376 : gain moyen (avg win) + risque moyen (avg loss) sur les trades clôturés.
    let winSum = 0, winN = 0, lossSum = 0, lossN = 0;
    trades.forEach(t => {
      const c = Calc.trade(t);
      if (c.invalid) return;
      if (Number.isFinite(c.netPnl)) totalPnL += c.netPnl;
      if (Number.isFinite(c.rr))     rrSum    += c.rr;
      if (t.outcome === 'win' || t.outcome === 'loss' || t.outcome === 'be') {
        if (!c.estimated) {
          closedCount++;
          if (Number.isFinite(c.netPnl) && c.netPnl > 0)      { winsCount++; winSum += c.netPnl; winN++; }
          else if (Number.isFinite(c.netPnl) && c.netPnl < 0) { lossSum += Math.abs(c.netPnl); lossN++; }
        }
      }
    });
    return {
      totalPnL,
      winRate: closedCount ? (winsCount / closedCount) * 100 : null,
      avgRR:   trades.length ? rrSum / trades.length : 0,
      avgWin:  winN  ? winSum  / winN  : 0,
      avgLoss: lossN ? lossSum / lossN : 0,
      winN, lossN,
      total:   trades.length,
      open:    trades.filter(t => t.outcome === 'open').length,
      wins:    winsCount,
      losses:  closedCount - winsCount,
    };
  }

  // ── Toast ───────────────────────────────────────────────────────────────────
  let toastTimer = null;
  // v0.9.238 : file d'attente toast. Avant : 2 toasts rapides → le 2e écrasait
  // le 1er instantanément, l'user ratait le message. Maintenant : queue FIFO,
  // chaque toast est visible (durée ci-dessous) avant de céder la place. Évite la
  // perte d'info quand plusieurs erreurs/confirmations arrivent en cascade.
  // v0.9.303 : durées allongées (avant 2.5s, trop court pour lire un message de
  // guidage type « crée un compte de trading… ») → 4.5s info / 6.5s erreur+warning.
  const _toastQueue = [];
  let _toastShowing = false;
  function _drainToast() {
    if (_toastShowing) return;
    const next = _toastQueue.shift();
    if (!next) return;
    _toastShowing = true;
    const el = $('toast');
    el.textContent = next.msg;
    el.className   = 'toast' + (next.isError ? ' error' : '');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      // Délai 250ms pour laisser l'animation de fade-out se jouer avant le suivant
      setTimeout(() => { _toastShowing = false; _drainToast(); }, 250);
    }, next.duration);
  }
  function toast(msg, isError = false, duration = isError ? 6500 : 4500) {
    _toastQueue.push({ msg, isError, duration });
    // Cap soft à 5 toasts en queue (sinon spam d'erreurs réseau peut empiler 50 toasts)
    if (_toastQueue.length > 5) _toastQueue.splice(0, _toastQueue.length - 5);
    _drainToast();
    // v0.9.304 : on journalise aussi dans le centre de notifications (cloche)
    try { notify(msg, isError); } catch {}
  }

  // ── Centre de notifications (v0.9.304) ──────────────────────────────────────
  // Cloche à droite de la recherche : historique persistant des messages (les
  // toasts y sont journalisés), badge de non-lus, panneau déroulant. Permet de
  // relire un message manqué (ex. « crée d'abord un compte de trading »).
  const _NOTIF_KEY = 'zeld_notifs_v1';
  const _NOTIF_MAX = 30;
  let _notifs = [];
  try {
    const raw = localStorage.getItem(_NOTIF_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) _notifs = arr.slice(0, _NOTIF_MAX); }
  } catch {}

  // v0.9.305 : sync Firestore (rattaché au compte) → les notifs suivent l'user
  // d'un appareil à l'autre. localStorage reste pour l'affichage instant/offline.
  let _notifSaveTimer = null;
  function _notifUser() {
    try { return (typeof _fbAuth !== 'undefined' && _fbAuth && _fbAuth.currentUser) ? _fbAuth.currentUser : null; }
    catch { return null; }
  }
  function _notifDocRef(u) {
    if (!u || typeof _fbDb === 'undefined' || !_fbDb) return null;
    try { return _fbDb.collection('users').doc(u.uid).collection('data').doc('notifications'); }
    catch { return null; }
  }
  function _saveNotifs() {
    // 1) localStorage immédiat (instant + offline)
    try { localStorage.setItem(_NOTIF_KEY, JSON.stringify(_notifs.slice(0, _NOTIF_MAX))); } catch {}
    // 2) Firestore débounce (compte vérifié uniquement → la rule exige isVerified)
    const u = _notifUser();
    if (!u || u.emailVerified !== true) return;
    const ref = _notifDocRef(u);
    if (!ref) return;
    clearTimeout(_notifSaveTimer);
    _notifSaveTimer = setTimeout(() => {
      try { ref.set({ items: _notifs.slice(0, _NOTIF_MAX), updatedAt: Date.now() }).catch(() => {}); } catch {}
    }, 1500);
  }
  async function _loadNotifsRemote() {
    const ref = _notifDocRef(_notifUser());
    if (!ref) return;
    try {
      const snap = await ref.get();
      if (snap.exists && Array.isArray(snap.data().items)) {
        _notifs = snap.data().items.slice(0, _NOTIF_MAX);
        try { localStorage.setItem(_NOTIF_KEY, JSON.stringify(_notifs)); } catch {}
        const panel = $('notifPanel');
        if (panel && !panel.hidden) _renderNotifList();
        _renderNotifBadge();
      }
    } catch {}
  }
  function _unreadCount() { return _notifs.reduce((n, x) => n + (x.read ? 0 : 1), 0); }
  function _fmtNotifTime(ts) {
    try {
      const d = new Date(ts);
      const sameDay = d.toDateString() === new Date().toDateString();
      const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return sameDay ? hm : (d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + hm);
    } catch { return ''; }
  }
  function _renderNotifBadge() {
    const badge = $('notifBadge'); const btn = $('btnNotif');
    if (!badge || !btn) return;
    const n = _unreadCount();
    if (n > 0) { badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = false; btn.classList.add('has-unread'); }
    else { badge.hidden = true; btn.classList.remove('has-unread'); }
  }
  function _renderNotifList() {
    const list = $('notifList'); const empty = $('notifEmpty');
    if (!list) return;
    if (_notifs.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = _notifs.map(x =>
      '<div class="notif-item' + (x.read ? '' : ' unread') + (x.isError ? ' error' : '') + '">' +
        '<span class="notif-item-msg">' + escHtml(x.msg) + '</span>' +
        '<span class="notif-item-time">' + escHtml(_fmtNotifTime(x.ts)) + '</span>' +
      '</div>'
    ).join('');
  }
  function notify(msg, isError = false) {
    if (!msg) return;
    _notifs.unshift({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      msg: String(msg), isError: !!isError, ts: Date.now(), read: false,
    });
    if (_notifs.length > _NOTIF_MAX) _notifs = _notifs.slice(0, _NOTIF_MAX);
    _saveNotifs();
    _renderNotifBadge();
    const panel = $('notifPanel');
    if (panel && !panel.hidden) _renderNotifList();   // panneau ouvert → refresh live
  }
  function _notifOutside(e) {
    const wrap = $('notifWrap');
    if (wrap && !wrap.contains(e.target)) _closeNotifPanel();
  }
  function _openNotifPanel() {
    const panel = $('notifPanel'); const btn = $('btnNotif');
    if (!panel) return;
    _renderNotifList();
    panel.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
    let changed = false;
    _notifs.forEach(x => { if (!x.read) { x.read = true; changed = true; } });
    if (changed) _saveNotifs();
    _renderNotifBadge();
    setTimeout(() => document.addEventListener('click', _notifOutside), 0);
  }
  function _closeNotifPanel() {
    const panel = $('notifPanel'); const btn = $('btnNotif');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', _notifOutside);
  }
  function initNotifs() {
    const btn = $('btnNotif');
    if (!btn || btn._wired) return;   // idempotent
    btn._wired = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = $('notifPanel');
      if (panel && panel.hidden) _openNotifPanel(); else _closeNotifPanel();
    });
    const clear = $('btnNotifClear');
    if (clear) clear.addEventListener('click', (e) => {
      e.stopPropagation();
      _notifs = []; _saveNotifs(); _renderNotifList(); _renderNotifBadge();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _closeNotifPanel(); });
    _renderNotifBadge();
    _loadNotifsRemote();   // v0.9.305 : récupère les notifs du compte (cross-device)
  }

  // ── Sidebar stats ───────────────────────────────────────────────────────────
  function updateStats() {
    const s   = Store.getStats();
    const pEl = $('statPnL');
    pEl.textContent = s.total > 0
      ? (s.totalPnL >= 0 ? '+' : '-') + '$' + Math.abs(s.totalPnL).toFixed(0)
      : '—';
    pEl.style.color = s.totalPnL > 0 ? 'var(--green)'
                    : s.totalPnL < 0 ? 'var(--red)'
                    : 'var(--muted)';
    const wEl = $('statWR');
    wEl.textContent = s.winRate !== null ? s.winRate.toFixed(0) + '%' : '—';
    wEl.style.color = s.winRate >= 50 ? 'var(--green)'
                    : s.winRate !== null ? 'var(--red)'
                    : 'var(--muted)';
    $('statCount').textContent = s.total;
  }

  // ── Trade list ──────────────────────────────────────────────────────────────
  // v1.0.4 : le Journal honore le Focus (sélecteur de compte/firm/groupe du header),
  // comme le dashboard/analytics/calendrier — avant il listait toujours TOUS les comptes.
  function _journalTrades() {
    return (Store.scopedTrades ? Store.scopedTrades() : Store.getTrades());
  }
  function getFiltered() {
    const q = ($('searchInput').value || '').toLowerCase();
    return _journalTrades().filter(t => {
      const matchFilter = currentFilter === 'all' || t.outcome === currentFilter;
      const matchSearch = !q || [t.instrument, t.setup, t.apex, t.notes]
        .some(s => (s || '').toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });
  }

  function renderList() {
    const list     = $('tradeList');
    const filtered = getFiltered();
    const total    = _journalTrades().length;

    // U24 : compteur "X / N trades" quand un filtre/recherche est actif
    // (escape les nombres via toFixed ou Number — pas de user-controlled string)
    const isFiltered = filtered.length < total;
    const counterHtml = isFiltered
      ? `<div class="list-counter">${filtered.length} / ${total} ${i18n.t('ui.trades.lbl') || 'trades'}</div>`
      : '';

    if (!filtered.length) {
      // v0.9.238 : empty state contextuel.
      //   - Aucun trade du tout      → CTA "+ Premier trade"
      //   - Aucun résultat (filtré)  → CTA "Effacer les filtres"
      const isEmpty = total === 0;
      const msg     = isEmpty ? i18n.t('ui.no.trades') : i18n.t('ui.no.results');
      // v0.9.261 — CTA bindés par addEventListener (l'inline onclick était bloqué
      // par la CSP `script-src 'self'`, et le sélecteur `.filter-chip` était faux).
      const ctaHtml = isEmpty
        ? `<button type="button" class="btn-primary" style="margin-top:14px" data-empty-cta="newtrade">+ ${i18n.t('btn.newtrade') || 'Nouveau trade'}</button>`
        : `<button type="button" class="btn-ghost" style="margin-top:14px" data-empty-cta="clear">${i18n.t('ui.clear.filters') || 'Effacer les filtres'}</button>`;
      list.innerHTML = `${counterHtml}
        <div class="empty-list">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="9" x2="15" y2="9"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
          </svg>
          <p>${msg}</p>
          ${ctaHtml}
        </div>`;
      list.querySelector('[data-empty-cta="newtrade"]')?.addEventListener('click', () => $('btnNewTrade')?.click());
      list.querySelector('[data-empty-cta="clear"]')?.addEventListener('click', () => {
        const s = $('searchInput'); if (s) { s.value = ''; s.dispatchEvent(new Event('input')); }
        document.querySelector('.chip[data-filter="all"]')?.click();
      });
      return;
    }

    list.innerHTML = counterHtml + filtered.map(t => {
      const c       = Calc.trade(t);
      const dc      = t.direction === 'long' ? 'var(--green)' : 'var(--red)';
      const rrC     = Calc.rrColor(c.rr);
      const date    = new Date(t.date).toLocaleDateString(i18n.locale(), {
        day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
      });
      const pnlHtml = c.pnl !== null && !c.estimated
        ? `<span class="trade-pnl" style="color:${Calc.pnlColor(c.pnl)}">${Calc.formatPnL(c.pnl)}</span>`
        : '';
      // v1.0.4 : setup/notes sont DÉJÀ échappés au stockage (_escHtmlStore, invariant store,
      // ré-appliqué même au chargement) → on NE re-échappe PAS (sinon &lt; s'affiche littéralement).
      const setupHtml = t.setup
        ? `<div class="trade-setup">${t.setup}</div>`
        : '';

      const safeDir = t.direction === 'long' ? 'long' : 'short';
      return `<div class="trade-item ${selectedId === t.id ? 'selected' : ''}" data-id="${escHtml(t.id)}">
        <div class="trade-bar" style="background:${dc}"></div>
        <div class="trade-item-body">
          <div class="trade-item-top">
            <span class="trade-instr">${escHtml(t.instrument)}</span>
            <span class="dir-badge dir-${safeDir}">${safeDir.toUpperCase()}</span>
            <span class="outcome-badge ${OB_CLASS[t.outcome]}">${OB_LABEL[t.outcome]}</span>
          </div>
          <div class="trade-item-meta">
            <span>${date}${t.apex ? ' · ' + escHtml(t.apex) : ''}</span>
            <span class="trade-rr" style="color:${rrC}">${c.rr.toFixed(2)}R</span>
            ${pnlHtml}
          </div>
          ${setupHtml}
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.trade-item').forEach(el => {
      el.addEventListener('click', () => selectTrade(el.dataset.id));
    });
  }

  // ── Detail ──────────────────────────────────────────────────────────────────
  function selectTrade(id) {
    selectedId = id;
    renderList();
    renderDetail();
    // Mobile : afficher le panel et cacher la liste
    const layout = document.querySelector('.journal-layout');
    if (layout) layout.classList.toggle('has-detail', !!id);
  }

  function renderDetail() {
    const panel = $('detailPanel');
    const t     = selectedId ? Store.getTradeById(selectedId) : null;

    if (!t) {
      // v0.9.261 — accueil guidé quand le compte est vide (0 trade).
      // Sinon (des trades existent mais aucun sélectionné) → simple invite.
      if (Store.getTrades().length === 0) {
        const en = i18n.getLang() === 'en';
        panel.innerHTML = `
          <div class="onboarding-card">
            <div class="onb-hi" style="color:var(--accent)">${Icons.svg('wave',40)}</div>
            <h2 class="onb-title">${en ? 'Welcome to ZeldTrade' : 'Bienvenue sur ZeldTrade'}</h2>
            <p class="onb-sub">${en ? 'Your prop-firm trading journal — 3 steps to get started:' : 'Ton journal de trading prop firm — 3 étapes pour démarrer :'}</p>
            <div class="onb-steps">
              <div class="onb-step">
                <div class="onb-num">1</div>
                <div class="onb-step-body">
                  <div class="onb-step-title">${en ? 'Set up your account' : 'Configure ton compte'}</div>
                  <div class="onb-step-desc">${en ? 'Add your prop firm or personal account (size, rules).' : 'Ajoute ta prop firm ou ton compte perso (taille, règles).'}</div>
                  <button class="btn-ghost onb-btn" data-onb="accounts">${en ? 'Configure my accounts' : 'Configurer mes comptes'}</button>
                </div>
              </div>
              <div class="onb-step">
                <div class="onb-num">2</div>
                <div class="onb-step-body">
                  <div class="onb-step-title">${en ? 'Log your first trade' : 'Enregistre ton premier trade'}</div>
                  <div class="onb-step-desc">${en ? 'Paste a screenshot (AI reads your chart) or type it by hand.' : 'Colle une capture (l\'IA lit ton graphe) ou saisis à la main.'}</div>
                  <button class="btn-primary onb-btn" data-onb="newtrade">+ ${i18n.t('btn.newtrade') || 'Nouveau trade'}</button>
                </div>
              </div>
              <div class="onb-step">
                <div class="onb-num">3</div>
                <div class="onb-step-body">
                  <div class="onb-step-title">${en ? 'Track your stats automatically' : 'Suis tes stats automatiquement'}</div>
                  <div class="onb-step-desc">${en ? 'Win rate, R:R, drawdown, calendar… all computed for you.' : 'Win rate, R:R, drawdown, calendrier… tout se calcule tout seul.'}</div>
                </div>
              </div>
            </div>
          </div>`;
        panel.querySelector('[data-onb="accounts"]')?.addEventListener('click', () => {
          document.querySelector('[data-page="settings"]')?.click();
        });
        panel.querySelector('[data-onb="newtrade"]')?.addEventListener('click', () => {
          $('btnNewTrade')?.click();
        });
        return;
      }
      panel.innerHTML = `
        <div class="detail-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          </svg>
          <p>${i18n.t('ui.select.trade')}</p>
        </div>`;
      return;
    }

    const c    = Calc.trade(t);
    const date = new Date(t.date).toLocaleDateString(i18n.locale(), {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });

    const apexClass = c.riskPct <= 1.5 ? 'apex-ok' : c.riskPct <= 2 ? 'apex-warn' : 'apex-err';
    const apexMsg   = c.riskPct <= 1.5
      ? i18n.t('ui.apex.ok',   { pct: c.riskPct.toFixed(2) })
      : c.riskPct <= 2
        ? i18n.t('ui.apex.warn', { pct: c.riskPct.toFixed(2) })
        : i18n.t('ui.apex.err',  { pct: c.riskPct.toFixed(2) });

    const tpCards = buildTpCards(t, c);
    const pnlCard = c.netPnl !== null
      ? `<div class="metric-card">
           <div class="mc-label">${c.estimated ? i18n.t('ui.pnl.potential') : i18n.t('ui.pnl.net')}</div>
           <div class="mc-val" style="color:${Calc.pnlColor(c.netPnl)}">${c.estimated ? '~' : ''}${Calc.formatPnL(c.netPnl)}</div>
           <div class="mc-sub">${c.estimated ? i18n.t('ui.pnl.estimated') : i18n.t('ui.gross') + ' ' + Calc.formatPnL(c.pnl) + ' · Comm. -$' + c.commFees.toFixed(2) + ' · Spread -$' + c.spreadFees.toFixed(2)}</div>
         </div>`
      : '';

    // Si manualPnl override → le partial est ignoré dans le calcul, mais on l'affiche
    // quand même comme info contextuelle (avec mention "ignoré").
    const hasManualOverride = t.manualPnl != null && t.manualPnl !== '' && !isNaN(Number(t.manualPnl)) && t.outcome !== 'open';
    const ignoredTag = hasManualOverride ? ' <span style="color:var(--muted);font-size:11px">(ignoré — P&L manuel)</span>' : '';
    let partialRow = '';
    if (c.hasPartials && Array.isArray(c.partialBreakdown) && c.partialBreakdown.length) {
      // v0.9.250 : tableau des sorties partielles + P&L par tranche
      const rows = c.partialBreakdown.map((b, i) => {
        const label = b.runner ? (i18n.t('ui.partials.runner') || 'Runner') : `${i18n.t('ui.partials.exit') || 'Sortie'} ${i + 1}`;
        const pnlColor = b.pnl >= 0 ? 'var(--green)' : 'var(--red)';
        return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;font-size:12px;padding:3px 0">
                  <span style="color:var(--muted)">${label}</span>
                  <span class="mono">${(+b.lots).toFixed(b.lots % 1 === 0 ? 0 : 2)} @ ${(+b.price).toFixed(2)}</span>
                  <span class="mono" style="color:${pnlColor};min-width:64px;text-align:right">${b.pnl >= 0 ? '+' : ''}$${b.pnl.toFixed(2)}</span>
                </div>`;
      }).join('');
      partialRow = `<div class="info-row" style="flex-direction:column;align-items:stretch;gap:2px">
          <span class="info-key" style="margin-bottom:4px">${i18n.t('ui.partials.title') || 'Sorties partielles'}${ignoredTag}</span>
          ${rows}
        </div>`;
    } else if (c.hasPartial && c.partialPercent != null && c.partialPrice != null) {
      // Legacy single partial
      partialRow = `<div class="info-row"><span class="info-key">Partial close</span><span class="info-val" style="color:var(--accent-l)">${c.partialPercent}% à ${c.partialPrice.toFixed(2)}${ignoredTag}</span></div>`;
    }

    // v1.0.2 : champs non-chiffrés du journal personnalisé (sentiment, respect du plan,
    // confiance…). Valeurs enum traduites via i18n ; confiance = n/max.
    const customRows = (t.custom && typeof t.custom === 'object')
      ? Object.keys(t.custom).map(key => {
          const def = (Store.JOURNAL_CUSTOM_FIELDS || {})[key];
          if (!def) return '';
          const raw = t.custom[key];
          const valLabel = def.kind === 'rating'
            ? `${escHtml(String(raw))}/${def.max}`
            : escHtml(i18n.t('jf.' + key + '.' + raw));
          return `<div class="info-row"><span class="info-key">${escHtml(i18n.t('jf.' + key + '.label'))}</span><span class="info-val">${valLabel}</span></div>`;
        }).join('')
      : '';
    // v1.0.2 : R réalisé saisi manuellement (si présent)
    const rRow = (t.rMultiple != null)
      ? `<div class="info-row"><span class="info-key">${i18n.t('jf.rMultiple.label')}</span><span class="info-val">${escHtml(String(t.rMultiple))}R</span></div>`
      : '';
    const infoCard = (t.setup || t.notes || t.apex || c.hasPartial || customRows || rRow)
      ? `<div class="info-card">
           <h4>${i18n.t('ui.analysis')}</h4>
           ${t.apex  ? `<div class="info-row"><span class="info-key">${i18n.t('ui.apex.account')}</span><span class="info-val">${escHtml(t.apex)}</span></div>` : ''}
           ${partialRow}
           ${rRow}
           ${customRows}
           ${t.setup ? `<div class="info-row"><span class="info-key">${i18n.t('ui.setup')}</span><span class="info-val">${t.setup}</span></div>` : ''}
           ${t.notes ? `<div class="info-row"><span class="info-key">${i18n.t('ui.notes')}</span><span class="info-val">${t.notes}</span></div>` : ''}
         </div>`
      : '';

    // v0.9.246 : Galerie screenshots (1 à 3 images). Lit `screenshotPaths` (array)
    // ou fallback sur `screenshotPath` (legacy single). Chaque image cliquable
    // pour lightbox plein écran.
    const shotPaths = (Array.isArray(t.screenshotPaths) && t.screenshotPaths.length)
      ? t.screenshotPaths.filter(Boolean)
      : (t.screenshotPath ? [t.screenshotPath] : []);
    const screenshotCard = shotPaths.length
      ? `<div class="info-card" style="margin-top:14px">
           <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:7px">${Icons.svg('camera',16)} Captures (${shotPaths.length})</h4>
           <div class="trade-shots-gallery" style="display:grid;grid-template-columns:repeat(${shotPaths.length === 1 ? 1 : 'auto-fit,minmax(180px,1fr)'});gap:10px">
             ${shotPaths.map((p, i) => `
               <div class="trade-screenshot-wrap" data-shot-idx="${i}" style="position:relative;background:var(--bg-deeper,#0a0a0a);border-radius:8px;overflow:hidden;cursor:zoom-in;min-height:160px;display:flex;align-items:center;justify-content:center">
                 <img class="tradeShotImg" data-shot-idx="${i}" alt="Capture ${i + 1}" style="max-width:100%;max-height:300px;display:block;border-radius:8px;opacity:0;transition:opacity 0.2s">
                 <div class="tradeShotLoading" data-shot-idx="${i}" style="position:absolute;color:var(--muted);font-size:12px">Chargement…</div>
               </div>
             `).join('')}
           </div>
         </div>`
      : '';

    const cfd = Calc.isCFD(t.instrument);
    const contractLabel = cfd ? 'lots' : (t.contracts > 1 ? i18n.t('ui.contracts') : i18n.t('ui.contract'));
    const contractDisplay = cfd ? t.contracts.toFixed(2) : t.contracts;

    panel.innerHTML = `
      <button class="detail-back-btn" id="detailBackBtn" style="display:none">
        ${i18n.t('ui.back') || '← Retour'}
      </button>
      <div class="detail-content">
        <div class="detail-header">
          <div>
            <div class="detail-title-row">
              <span class="detail-instr">${escHtml(t.instrument)}</span>
              <span class="dir-badge dir-${t.direction === 'long' ? 'long' : 'short'}" style="font-size:12px;padding:3px 9px">${t.direction === 'long' ? 'LONG' : 'SHORT'}</span>
              <span class="outcome-badge ${OB_CLASS[t.outcome]}" style="font-size:11px;padding:3px 9px">${OB_LABEL[t.outcome]}</span>
            </div>
            <div class="detail-date">${date}</div>
          </div>
          <div class="detail-actions">
            <button class="btn-ghost" id="detailBtnEdit">${i18n.t('btn.edit')}</button>
            <button class="btn-ghost btn-danger" id="detailBtnDelete">${i18n.t('btn.delete')}</button>
          </div>
        </div>

        <div class="metrics-strip">
          <div class="metric-card">
            <div class="mc-label">R:R</div>
            <div class="mc-val" style="color:${Calc.rrColor(c.rr)}">${c.rr.toFixed(2)}R</div>
            <div class="mc-sub">${Calc.rrLabel(c.rr)}</div>
          </div>
          <div class="metric-card">
            <div class="mc-label">${i18n.t('ui.risk.usd')}</div>
            <div class="mc-val" style="color:var(--red)">-$${c.riskUSD.toFixed(0)}</div>
            <div class="mc-sub">${cfd ? c.riskPts.toFixed(cfd ? 2 : 0) + ' pts' : c.riskTicks + ' ticks'}</div>
          </div>
          <div class="metric-card">
            <div class="mc-label">${i18n.t('ui.reward.usd')}</div>
            <div class="mc-val" style="color:var(--green)">+$${c.rewardUSD.toFixed(0)}</div>
            <div class="mc-sub">${cfd ? c.rewardPts.toFixed(2) + ' pts' : c.rewardTicks + ' ticks'}</div>
          </div>
          <div class="metric-card">
            <div class="mc-label">Risk %</div>
            <div class="mc-val" style="color:${Calc.riskColor(c.riskPct)}">${c.riskPct.toFixed(2)}%</div>
          </div>
          ${pnlCard}
        </div>

        <div class="levels-row">
          <div class="level-card lc-sl">
            <div class="lc-label">SL</div>
            <div class="lc-price">${t.sl.toFixed(2)}</div>
            <div class="lc-ticks">${cfd ? c.riskPts.toFixed(2) + ' pts' : c.riskTicks + ' ticks'}</div>
          </div>
          <div class="level-card lc-entry">
            <div class="lc-label">Entry</div>
            <div class="lc-price">${t.entry.toFixed(2)}</div>
            <div class="lc-ticks">${(t.direction === 'long' ? 'long' : 'short').toUpperCase()}</div>
          </div>
          ${tpCards}
          ${t.exitPrice ? `<div class="level-card lc-exit"><div class="lc-label">Exit</div><div class="lc-price">${t.exitPrice.toFixed(2)}</div></div>` : ''}
        </div>

        <div class="apex-bar ${apexClass}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          ${apexMsg}
          <span class="apex-right">${contractDisplay} ${contractLabel}${cfd ? '' : ' · $' + c.pv + '/pt'}</span>
        </div>

        ${infoCard}
        ${screenshotCard}
      </div>`;

    // v0.9.246 : charge async chaque capture de la galerie + bind lightbox.
    if (shotPaths.length) {
      shotPaths.forEach((path, i) => {
        const imgEl     = document.querySelector(`.tradeShotImg[data-shot-idx="${i}"]`);
        const loadingEl = document.querySelector(`.tradeShotLoading[data-shot-idx="${i}"]`);
        if (!imgEl) return;
        Store.getTradeScreenshotUrl(path).then(url => {
          if (url) {
            imgEl.src = url;
            imgEl.onload = () => {
              imgEl.style.opacity = '1';
              if (loadingEl) loadingEl.style.display = 'none';
            };
            imgEl.onerror = () => {
              if (loadingEl) loadingEl.textContent = 'Image introuvable';
            };
            const wrap = imgEl.parentElement;
            if (wrap) wrap.addEventListener('click', () => openLightbox(url));
          } else if (loadingEl) {
            loadingEl.textContent = 'Capture indisponible';
          }
        });
      });
    }

    // Bouton retour mobile
    const backBtn = $('detailBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        selectedId = null;
        const layout = document.querySelector('.journal-layout');
        if (layout) layout.classList.remove('has-detail');
        renderList();
        renderDetail();
      });
    }

    $('detailBtnEdit').addEventListener('click', () => {
      Modal.open(t.id, saved => {
        selectTrade(saved.id);
        updateStats();
      });
    });

    $('detailBtnDelete').addEventListener('click', async () => {
      const ok = await confirmModal({
        title:       i18n.t('confirm.trade.title') || 'Supprimer le trade',
        message:     i18n.t('confirm.trade.delete'),
        confirmText: i18n.t('btn.delete') || 'Supprimer',
        cancelText:  i18n.t('btn.cancel')  || 'Annuler',
        danger:      true,
      });
      if (!ok) return;
      Store.deleteTrade(t.id);
      selectedId = _journalTrades()[0]?.id || null;  // v1.0.4 : reste dans le scope Focus
      const layout = document.querySelector('.journal-layout');
      if (layout) layout.classList.remove('has-detail');
      renderList();
      renderDetail();
      updateStats();
      toast(i18n.t('ui.trade.deleted'));
    });
  }

  function buildTpCards(t, c) {
    const tps = [
      { label: 'TP1', price: t.tp1, ticks: c.rewardTicks },
      t.tp2 ? { label: 'TP2', price: t.tp2, ticks: null } : null,
      t.tp3 ? { label: 'TP3', price: t.tp3, ticks: null } : null,
    ].filter(Boolean);

    return tps.map(tp => `
      <div class="level-card lc-tp">
        <div class="lc-label">${tp.label}</div>
        <div class="lc-price">${tp.price.toFixed(2)}</div>
        ${tp.ticks ? `<div class="lc-ticks">${tp.ticks} ticks</div>` : ''}
      </div>`).join('');
  }

  // ── Lightbox : affichage plein écran d'une image ─────────────────────────────
  // Construction via DOM API (jamais d'innerHTML interpolant l'URL — defense-in-depth)
  function openLightbox(url) {
    if (!url) return;
    closeLightbox();
    const overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:24px';

    const img = document.createElement('img');
    img.alt = 'Screenshot';
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 0 40px rgba(0,0,0,0.8)';
    img.src = url;  // setter src : encodage automatique, pas d'interprétation HTML
    overlay.appendChild(img);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.title = 'Fermer (Échap)';
    btn.style.cssText = 'position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center';
    btn.addEventListener('click', closeLightbox);
    overlay.appendChild(btn);

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeLightbox(); });
    document.addEventListener('keydown', _lightboxKeyHandler);
  }
  function closeLightbox() {
    const el = $('lightboxOverlay');
    if (el) el.remove();
    document.removeEventListener('keydown', _lightboxKeyHandler);
  }
  // ── Modale de confirmation custom ───────────────────────────────────────────
  // Remplace le `confirm()` natif (look navigateur, pas i18n, look bizarre sur mobile).
  // Construction via DOM API (createElement + textContent) — JAMAIS innerHTML user-interpolé.
  // Focus par défaut sur "Annuler" (anti clic réflexe destructif).
  // Escape = Annuler (UX standard, safer).
  // Retourne une Promise<boolean> : true si Confirmer, false sinon.
  let _activeConfirmResolve = null;
  function confirmModal(opts) {
    return new Promise((resolve) => {
      // Si une modale déjà ouverte, on l'annule (l'ancienne résolve à false)
      if (_activeConfirmResolve) {
        const prev = _activeConfirmResolve;
        _activeConfirmResolve = null;
        try { prev(false); } catch {}
        closeConfirmModal();
      }
      _activeConfirmResolve = resolve;

      const title       = String(opts && opts.title       || 'Confirmer');
      const message     = String(opts && opts.message     || '');
      const confirmText = String(opts && opts.confirmText || 'Confirmer');
      const cancelText  = String(opts && opts.cancelText  || 'Annuler');
      const danger      = opts && opts.danger === true;

      const overlay = document.createElement('div');
      overlay.id = 'confirmModalOverlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'confirmModalTitle');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px';

      const card = document.createElement('div');
      card.style.cssText = 'background:var(--surface,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;padding:24px;max-width:440px;width:100%;color:var(--text,#e6edf3);box-shadow:0 20px 40px rgba(0,0,0,0.5)';
      overlay.appendChild(card);

      const h = document.createElement('h3');
      h.id = 'confirmModalTitle';
      h.style.cssText = 'margin:0 0 12px;font-size:16px;font-weight:600;' + (danger ? 'color:var(--red,#f85149)' : '');
      h.textContent = title;  // textContent : pas d'XSS possible
      card.appendChild(h);

      if (message) {
        const p = document.createElement('p');
        p.style.cssText = 'margin:0 0 20px;font-size:13px;color:var(--muted,#8b949e);line-height:1.5';
        p.textContent = message;  // textContent : pas d'XSS possible
        card.appendChild(p);
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
      card.appendChild(actions);

      // v0.9.143 : passer `cancelText: false` (ou null) cache le bouton —
      // utile pour les modales d'info pures (1 seul bouton "OK").
      const hideCancel = (opts && (opts.cancelText === false || opts.cancelText === null));
      let btnCancel = null;
      if (!hideCancel) {
        btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.style.cssText = 'padding:9px 18px;border-radius:6px;border:1px solid var(--border,#30363d);background:transparent;color:var(--muted,#8b949e);font-size:13px;cursor:pointer;font-family:inherit';
        btnCancel.textContent = cancelText;
        btnCancel.addEventListener('click', () => _resolveConfirm(false));
        actions.appendChild(btnCancel);
      }

      const btnConfirm = document.createElement('button');
      btnConfirm.type = 'button';
      btnConfirm.style.cssText = 'padding:9px 18px;border-radius:6px;border:none;background:' + (danger ? 'var(--red,#f85149)' : 'var(--accent)') + ';color:' + (danger ? '#fff' : 'var(--on-accent,#06080d)') + ';font-size:13px;font-weight:600;cursor:pointer;font-family:inherit';
      btnConfirm.textContent = confirmText;
      btnConfirm.addEventListener('click', () => _resolveConfirm(true));
      actions.appendChild(btnConfirm);

      // Click sur overlay (mais pas sur la card) = cancel
      overlay.addEventListener('click', (e) => { if (e.target === overlay) _resolveConfirm(false); });

      // Keyboard : Enter = confirm, Escape = cancel
      document.addEventListener('keydown', _confirmKeyHandler);

      document.body.appendChild(overlay);

      // Focus par défaut sur Cancel (safer — anti clic réflexe) ;
      // fallback sur Confirm si Cancel caché (modale info).
      setTimeout(() => (btnCancel || btnConfirm).focus(), 50);
    });
  }
  function _resolveConfirm(value) {
    const r = _activeConfirmResolve;
    _activeConfirmResolve = null;
    closeConfirmModal();
    if (r) try { r(value); } catch {}
  }
  function closeConfirmModal() {
    const el = $('confirmModalOverlay');
    if (el) el.remove();
    document.removeEventListener('keydown', _confirmKeyHandler);
  }
  function _confirmKeyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); _resolveConfirm(false); }
    else if (e.key === 'Enter') {
      // Enter sur Cancel = cancel, sur Confirm = confirm (laisser le default click)
      // Si focus sur autre chose (overlay) → on traite Enter comme Cancel par défaut (safer)
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault(); _resolveConfirm(false);
    }
  }

  function _lightboxKeyHandler(e) {
    if (e.key === 'Escape') closeLightbox();
  }

  return {
    toast, notify, initNotifs, confirmModal, updateStats, renderList, selectTrade, renderDetail,
    // Shared utilities exposed for js/pages/*.js
    escHtml, localDay, localToday, statsForTrades,
    OB_CLASS, OB_LABEL, MICRO_RATES,
    setFilter: (f) => {
      currentFilter = f;
      try { localStorage.setItem(_FILTER_KEY, f); } catch {}
      renderList();
    },
    get selectedId()  { return selectedId; },
    set selectedId(v) { selectedId = v; },
    // Page render functions — assigned by js/pages/*.js after this script loads
    renderDashboard: () => {},
    renderAnalytics: () => {},
    renderGoals:     () => {},
    renderCalendar:  () => {},
    renderMicro:     () => {},
    initSettings:    () => {},
  };
})();
