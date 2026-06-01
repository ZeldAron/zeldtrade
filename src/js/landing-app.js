// ─── LANDING APP (v0.9.397) ────────────────────────────────────────────────
// Interactivité vanilla de la landing cinématique (port du proto React "zeldaron") :
// status bar clock, boutons magnétiques, scroll-reveal, dashboard hero live,
// rotation démo, calculateur EOD interactif, FAQ accordéon, nav mobile,
// toggle pricing mensuel/annuel, copie du code promo.
(function () {
  'use strict';
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  // v0.9.419 — setters null-safe (évite « Cannot set textContent of null » si un élément manque)
  const setTxt  = (sel, v) => { const e = $(sel); if (e) e.textContent = v; return e; };
  const setHtml = (sel, v) => { const e = $(sel); if (e) e.innerHTML = v; return e; };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = () => Math.random();

  // ── Status bar : horloge UTC ────────────────────────────────────────────────
  (function clock() {
    const el = $('#sbClock');
    if (!el) return;
    function tick() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      el.textContent = `EU-WEST-1 · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
    }
    tick();
    setInterval(tick, 1000);
  })();

  // ── Boutons magnétiques ─────────────────────────────────────────────────────
  if (!reduceMotion && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
    $$('.magnetic[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
    });
  }

  // ── Scroll reveal (IntersectionObserver) ────────────────────────────────────
  (function reveal() {
    const items = $$('.reveal');
    if (!items.length) return;
    const showAll = () => items.forEach(el => el.classList.add('in'));
    if (reduceMotion || !('IntersectionObserver' in window)) { showAll(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const d = parseInt(e.target.dataset.delay, 10) || 0;
          e.target.style.transitionDelay = d + 'ms';
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    items.forEach(el => io.observe(el));
    // Révèle immédiatement ce qui est déjà visible au chargement (évite un flash vide
    // si l'IO ne déclenche pas tout de suite, ou si un bloc est plus haut que le viewport).
    const revealInView = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      items.forEach(el => {
        if (el.classList.contains('in')) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); }
      });
    };
    requestAnimationFrame(revealInView);
    // Filet de sécurité : si pour une raison quelconque l'observer n'a rien révélé,
    // on garantit que tout le contenu finit visible (jamais de page « vide »).
    setTimeout(() => { if (!$$('.reveal.in').length) showAll(); }, 1500);
  })();

  // ── Hero dashboard live ─────────────────────────────────────────────────────
  (function heroDash() {
    const line = $('#dashLine'), area = $('#dashArea'), dot = $('#dashDot'), ping = $('#dashPing');
    const balEl = $('#dashBalance'), pnlEl = $('#dashPnl');
    const ddFill = $('#dashDdFill'), ddNeg = $('#dashDdNeg'), ddBuf = $('#dashDdBuf');
    if (!line) return;
    const W = 380, H = 100, N = 30, DD_LIMIT = 5000;
    let pts = [], y = 60;
    for (let i = 0; i < N; i++) { y += (rand() - 0.42) * 5; pts.push(Math.max(20, Math.min(90, y))); }
    let balance = 152847.21, pnl = 420.18, dd = 2153;

    function draw() {
      const stepX = W / (N - 1);
      let d = '';
      pts.forEach((py, i) => { d += `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${(H - py).toFixed(1)} `; });
      line.setAttribute('d', d.trim());
      area.setAttribute('d', `${d.trim()} L ${W} ${H} L 0 ${H} Z`);
      const lx = (N - 1) * stepX, ly = H - pts[N - 1];
      dot.setAttribute('cx', lx.toFixed(1)); dot.setAttribute('cy', ly.toFixed(1));
      if (ping) { ping.setAttribute('cx', lx.toFixed(1)); ping.setAttribute('cy', ly.toFixed(1)); }
      if (balEl) balEl.textContent = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (pnlEl) {
        const up = pnl >= 0;
        pnlEl.textContent = `${up ? '▲ +' : '▼ −'}$${Math.abs(pnl).toFixed(2)}`;
        pnlEl.classList.toggle('red', !up);
      }
      const ddPct = Math.min(100, (dd / DD_LIMIT) * 100);
      if (ddFill) ddFill.style.width = ddPct.toFixed(1) + '%';
      if (ddNeg) ddNeg.textContent = '-$' + Math.round(dd).toLocaleString('en-US');
      if (ddBuf) ddBuf.textContent = 'BUFFER $' + (DD_LIMIT - Math.round(dd)).toLocaleString('en-US');
    }
    draw();
    if (reduceMotion) return;
    setInterval(() => {
      const delta = (rand() - 0.42) * 32;
      balance = +(balance + delta).toFixed(2);
      pnl = +(pnl + delta).toFixed(2);
      dd = Math.max(800, Math.min(4500, dd + (rand() - 0.5) * 60));
      pts = pts.slice(1);
      pts.push(Math.max(20, Math.min(90, pts[pts.length - 1] + (rand() - 0.42) * 6)));
      draw();
    }, 1200);
  })();

  // ── Parallax léger du widget hero ───────────────────────────────────────────
  (function parallax() {
    const wrap = $('#heroDashWrap');
    if (!wrap || reduceMotion) return;
    window.addEventListener('scroll', () => {
      wrap.style.transform = `translateY(${window.scrollY * 0.04}px)`;
    }, { passive: true });
  })();

  // ── Démo : rotation du trade actif ──────────────────────────────────────────
  (function demoRotate() {
    const items = $$('#demoSidebar .demo-sb-item[data-acc]');
    const tk = $('#dTicker'), sd = $('#dSide'), en = $('#dEntry'), sl = $('#dSl'),
          tp = $('#dTp'), sz = $('#dSize'), rr = $('#dR'), pn = $('#dPnl'), tm = $('#dTime'), ai = $('#demoAiText');
    if (!items.length || !tk) return;
    const trades = [
      { sym: 'NQ · Nasdaq', side: 'LONG', entry: '$20 847,5', sl: '$20 830,0', tp: '$20 892,0', size: '2', r: '2.55R', pnl: 420, time: '14:32', tag: 'NQ LONG' },
      { sym: 'FTMO · EURUSD', side: 'SHORT', entry: '$1.08321', sl: '$1.08385', tp: '$1.08220', size: '1.5', r: '1.58R', pnl: 180, time: '10:14', tag: 'EURUSD SHORT' },
      { sym: 'ES · S&P', side: 'LONG', entry: '$5 892,25', sl: '$5 884,00', tp: '$5 910,50', size: '1', r: '2.20R', pnl: -210, time: '09:48', tag: 'ES LONG' },
      { sym: 'BTC · perp', side: 'LONG', entry: '$98 420', sl: '$97 950', tp: '$99 180', size: '0.3', r: '1.62R', pnl: 380, time: '08:22', tag: 'BTC LONG' },
    ];
    const lang = (fr, en) => document.documentElement.lang === 'en' ? en : fr;
    let i = 0;
    function show(idx) {
      const t = trades[idx];
      items.forEach(el => el.classList.toggle('active', +el.dataset.acc === idx));
      tk.textContent = t.sym;
      if (sd) { sd.textContent = t.side; sd.className = 'side ' + (t.side === 'LONG' ? 'long' : 'short'); }
      if (en) en.textContent = t.entry;
      if (sl) sl.textContent = t.sl;
      if (tp) tp.textContent = t.tp;
      if (sz) sz.textContent = t.size;
      if (rr) rr.textContent = t.r;
      if (pn) { pn.textContent = (t.pnl >= 0 ? '+' : '−') + '$' + Math.abs(t.pnl); pn.style.color = t.pnl >= 0 ? 'var(--green)' : 'var(--red)'; }
      if (tm) tm.textContent = t.time;
      if (ai) {
        const cls = t.pnl >= 0 ? 'green' : 'red';
        const head = lang('IA Vision · screenshot lu en 1,2s.', 'AI Vision · screenshot read in 1.2s.');
        const detected = lang('Trade détecté :', 'Trade detected:');
        const riskLbl = lang('risque', 'risk');
        const outcome = t.pnl >= 0 ? lang('clôturé à TP', 'closed at TP') : lang('stoppé', 'stopped');
        ai.innerHTML = `<b>${head}</b><br>${detected} <span class="tag ${cls}">${t.tag}</span> · entry <b>${t.entry.replace('$','')}</b> · SL <b>${t.sl.replace('$','')}</b> · TP <b>${t.tp.replace('$','')}</b> · ${riskLbl} <b>${t.r}</b> · ${outcome} <span class="tag ${cls}">${t.pnl>=0?'+':'−'}$${Math.abs(t.pnl)}</span>`;
      }
    }
    show(0);
    // Re-render le trade courant quand la langue change (l'IA strip est en dur, pas via data-i18n).
    window.addEventListener('zt:langchange', () => { try { show(i); } catch (e) {} });
    if (reduceMotion) return;
    setInterval(() => { i = (i + 1) % trades.length; show(i); }, 4500);
  })();

  // ── Calculateur EOD drawdown ────────────────────────────────────────────────
  (function calc() {
    const row = $('#cFirmRow');
    if (!row) return;
    const FIRMS = {
      Apex:    { trailing: 5000,  type: 'EOD',    tag: 'trailing EOD jusqu\'au profit target' },
      FTMO:    { trailing: 10000, type: 'STATIC', tag: 'statique 10% du compte initial' },
      Topstep: { trailing: 3000,  type: 'EOD',    tag: 'trailing EOD selon le plan choisi' },
      Lucid:   { trailing: 4500,  type: 'EOD',    tag: 'trailing EOD' },
      FNP:     { trailing: 8000,  type: 'STATIC', tag: 'statique 8% du compte initial' },
    };
    let firm = 'Apex';
    const size = $('#cSize'), hwm = $('#cHwm'), pnl = $('#cPnl'), risk = $('#cRisk');
    const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
    function lang(fr, en) { return document.documentElement.lang === 'en' ? en : fr; }

    function compute() {
      if (!size || !hwm || !pnl || !risk) return;   // calculatrice absente → on ne fait rien
      const rule = FIRMS[firm] || FIRMS.Apex;
      const accountSize = +size.value;
      let highWM = +hwm.value; if (highWM < accountSize) highWM = accountSize;
      const openPnL = +pnl.value, plannedRisk = +risk.value;
      const floor = rule.type === 'EOD'
        ? Math.max(accountSize - rule.trailing, highWM - rule.trailing)
        : accountSize - rule.trailing;
      const equity = accountSize + openPnL;
      const buffer = equity - floor;
      const afterRisk = buffer - plannedRisk;
      const status = afterRisk < 0 ? 'danger' : afterRisk < rule.trailing * 0.25 ? 'warn' : 'safe';

      setTxt('#cSizeVal', '$' + accountSize.toLocaleString('en-US'));
      setTxt('#cHwmVal', '$' + highWM.toLocaleString('en-US'));
      const pv = setTxt('#cPnlVal', (openPnL >= 0 ? '+' : '−') + '$' + Math.abs(openPnL).toLocaleString('en-US')); if (pv) pv.style.color = openPnL >= 0 ? 'var(--green)' : 'var(--red)';
      setTxt('#cRiskVal', '$' + plannedRisk.toLocaleString('en-US'));
      setTxt('#cFirmVal', firm);
      setTxt('#cFirmNote', '→ ' + rule.tag);

      const big = setTxt('#cBig', (afterRisk >= 0 ? '' : '−') + fmt(Math.abs(afterRisk))); if (big) big.className = 'calc-big ' + status;
      const st = $('#cStatus');
      if (st) {
        st.className = 'calc-output-status ' + status;
        st.innerHTML = '<i></i> ' + (status === 'safe' ? lang('SAFE · trade autorisé', 'SAFE · trade allowed')
          : status === 'warn' ? lang('WARNING · proche limite', 'WARNING · near limit')
          : lang('DANGER · breach probable', 'DANGER · likely breach'));
      }
      // A-02 — expose la valeur courante des sliders aux lecteurs d'écran
      [size, hwm, pnl, risk].forEach(el => {
        if (!el) return;
        el.setAttribute('aria-valuenow', el.value);
        el.setAttribute('aria-valuetext', fmt(+el.value));
      });

      setTxt('#cFloor', fmt(floor));
      setTxt('#cEquity', fmt(equity));
      const bf = setTxt('#cBuffer', (buffer >= 0 ? '+' : '−') + fmt(Math.abs(buffer))); if (bf) bf.style.color = buffer < 0 ? 'var(--red)' : 'var(--green)';
      setTxt('#cDist', ((afterRisk / rule.trailing) * 100).toFixed(1) + '%');
    }
    row.addEventListener('click', e => {
      const b = e.target.closest('button[data-firm]'); if (!b) return;
      firm = b.dataset.firm;
      $$('button', row).forEach(x => x.classList.toggle('active', x === b));
      // borne le HWM au-dessus de la taille compte
      compute();
    });
    [size, hwm, pnl, risk].forEach(el => el && el.addEventListener('input', compute));
    window.addEventListener('zt:langchange', () => { try { compute(); } catch (e) {} });
    compute();
  })();

  // ── FAQ accordéon ───────────────────────────────────────────────────────────
  (function faq() {
    const list = $('#faqList'); if (!list) return;
    list.addEventListener('click', e => {
      const q = e.target.closest('.faq-q'); if (!q) return;
      const item = q.closest('.faq-item');
      const open = item.classList.contains('open');
      $$('.faq-item', list).forEach(it => {
        it.classList.remove('open');
        const b = it.querySelector('.faq-q'); if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    });
  })();

  // ── Nav mobile ──────────────────────────────────────────────────────────────
  (function nav() {
    const toggle = $('#navToggle'), links = $('#navLinks');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav-link', links).forEach(a => a.addEventListener('click', () => {
      links.classList.remove('open'); toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    }));
  })();

  // ── Pricing : toggles mensuel/annuel + devise € / $ ─────────────────────────
  (function pricing() {
    const toggle = $('#pricingToggle');
    const curToggle = $('#currencyToggle');
    const note = $('#currencyNote');
    const RATE = 1.08;            // EUR → USD (indicatif ; encaissement réel en €)
    let currency = 'eur';

    const fmtEur = v => {
      if (!v) return '0 €';
      const hasDec = Math.round(v) !== v;
      return v.toLocaleString('fr-FR', { minimumFractionDigits: hasDec ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
    };
    const fmtUsd = v => {
      if (!v) return '$0';
      const u = v * RATE;
      const val = (Math.round(v) !== v)
        ? u.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : Math.round(u).toLocaleString('en-US');
      return '≈ $' + val;
    };
    function renderPrices() {
      $$('.amt[data-eur]').forEach(el => {
        const v = parseFloat(el.dataset.eur) || 0;
        el.textContent = currency === 'usd' ? fmtUsd(v) : fmtEur(v);
      });
      if (note) note.style.visibility = currency === 'usd' ? 'visible' : 'hidden';
    }

    if (toggle) toggle.addEventListener('click', e => {
      const b = e.target.closest('button[data-lp-billing]'); if (!b) return;
      const mode = b.dataset.lpBilling;
      $$('button', toggle).forEach(x => x.classList.toggle('active', x === b));
      $$('[data-lp-price-monthly]').forEach(el => el.style.display = mode === 'monthly' ? '' : 'none');
      $$('[data-lp-price-yearly]').forEach(el => el.style.display = mode === 'yearly' ? '' : 'none');
    });
    if (curToggle) curToggle.addEventListener('click', e => {
      const b = e.target.closest('button[data-lp-currency]'); if (!b) return;
      currency = b.dataset.lpCurrency;
      $$('button', curToggle).forEach(x => x.classList.toggle('active', x === b));
      renderPrices();
    });
    renderPrices();
  })();

  // ── Copie du code promo (feedback visuel clair sur tout le bouton) ───────────
  (function promo() {
    const btn = $('#promoCode'); if (!btn) return;
    let busy = false;
    function feedback() {
      if (busy) return; busy = true;
      const en = document.documentElement.lang === 'en';
      const orig = btn.innerHTML;
      btn.innerHTML = en ? '✓ Copied!' : '✓ Copié !';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); busy = false; }, 1700);
    }
    function fallbackCopy(code) {
      try {
        const ta = document.createElement('textarea');
        ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      } catch (e) { /* silencieux */ }
    }
    btn.addEventListener('click', () => {
      const code = btn.dataset.code || 'ZELD40';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(feedback).catch(() => { fallbackCopy(code); feedback(); });
      } else { fallbackCopy(code); feedback(); }
    });
  })();
})();
