// ─── DASHBOARD ────────────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = k => i18n.t(k);

  let dashFilter   = null;
  let pnlChart     = null;
  // Graphiques avancés — références pour destroy() au re-render
  const _charts = {};

  // v0.9.396 : le filtre du dashboard EST désormais le Focus app-wide (persistant,
  // partagé avec analytics + calendrier). On délègue à Store.scopedTrades().
  function tradesForFilter() {
    return Store.scopedTrades ? Store.scopedTrades() : Store.getTrades();
  }

  function progressBar(pct, color, label, sub) {
    const clamped = Math.min(100, Math.max(0, pct));
    const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : color;
    return `<div class="dash-progress">
      <div class="dp-header"><span>${label}</span><span style="color:${barColor}">${sub}</span></div>
      <div class="dp-track"><div class="dp-fill" style="width:${clamped}%;background:${barColor}"></div></div>
    </div>`;
  }

  function accountCard(acc, trades) {
    const s            = UI.statsForTrades(trades);
    const adjustedPnL  = s.totalPnL + (acc.pnlOffset || 0);
    const balance      = acc.capital + adjustedPnL;
    const today        = UI.localToday();
    const todayLoss    = trades
      .filter(tr => UI.localDay(tr.date) === today && tr.outcome === 'loss')
      .reduce((sum, tr) => sum + Math.abs(Calc.trade(tr).netPnl || 0), 0);

    const ddPct     = acc.maxDrawdown    ? Math.min(100, (Math.abs(Math.min(0, adjustedPnL)) / acc.maxDrawdown) * 100) : 0;
    const dailyPct  = acc.dailyLossLimit ? Math.min(100, (todayLoss / acc.dailyLossLimit) * 100) : 0;
    const targetPct = acc.profitTarget   ? Math.min(100, (Math.max(0, adjustedPnL) / acc.profitTarget) * 100) : 0;
    const STATUS_LABEL = { evaluation:'EVAL', funded:'PA' };
    const STATUS_C     = { evaluation:'var(--amber)', funded:'var(--green)' };
    const badge = STATUS_LABEL[acc.status] || '?';
    const bclr  = STATUS_C[acc.status]  || 'var(--muted)';
    const balColor    = balance >= acc.capital ? 'var(--green)' : 'var(--red)';
    const deltaSign   = adjustedPnL >= 0 ? '+' : '-';

    return `<div class="dash-acc-card">
      <div class="dac-header">
        <div>
          <span class="dac-badge" style="color:${bclr};border-color:${bclr}">${badge}</span>
          <span class="dac-name">${UI.escHtml(acc.name)}</span>
        </div>
        <span class="dac-pnl" style="color:${adjustedPnL >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${deltaSign}$${Math.abs(adjustedPnL).toFixed(0)}
        </span>
      </div>
      <div class="dac-balance-wrap">
        <div class="dac-balance-lbl">${t('dash.balance')}</div>
        <div class="dac-balance" style="color:${balColor}">$${Math.round(balance).toLocaleString('fr-FR')}</div>
        <div class="dac-balance-delta" style="color:${adjustedPnL >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${deltaSign}$${Math.abs(adjustedPnL).toFixed(0)} ${t('dash.since.start')}
        </div>
      </div>
      <div class="dac-kpis">
        <div class="dac-kpi"><div class="dac-kpi-val">${s.winRate !== null ? s.winRate.toFixed(0) + '%' : '—'}</div><div class="dac-kpi-lbl">${t('dash.win.rate')}</div></div>
        <div class="dac-kpi"><div class="dac-kpi-val">${s.avgRR.toFixed(2)}R</div><div class="dac-kpi-lbl">${t('dash.avg.rr')}</div></div>
        <div class="dac-kpi"><div class="dac-kpi-val">${s.total}</div><div class="dac-kpi-lbl">${t('dash.trades')}</div></div>
        <div class="dac-kpi"><div class="dac-kpi-val">${s.open}</div><div class="dac-kpi-lbl">${t('dash.open')}</div></div>
      </div>
      ${acc.profitTarget   ? progressBar(targetPct, 'var(--green)', t('dash.profit.target'), '+$' + Math.max(0, adjustedPnL).toFixed(0) + ' / $' + acc.profitTarget) : ''}
      ${acc.maxDrawdown    ? progressBar(ddPct,      'var(--amber)', t('dash.drawdown.used'), '$' + Math.abs(Math.min(0, adjustedPnL)).toFixed(0) + ' / $' + acc.maxDrawdown) : ''}
      ${acc.dailyLossLimit ? progressBar(dailyPct,   'var(--red)',   t('dash.daily.loss'),   '$' + todayLoss.toFixed(0) + ' / $' + acc.dailyLossLimit) : ''}
    </div>`;
  }

  function computeEquityStats(trades) {
    const closed = trades
      .filter(tr => tr.outcome !== 'open')
      .map(tr => ({ tr, pnl: Calc.trade(tr).netPnl || 0 }))
      .sort((a, b) => (a.tr.date || '') < (b.tr.date || '') ? -1 : 1);

    if (!closed.length) return null;

    let cum = 0, peak = 0, maxDD = 0, sumWins = 0, sumLosses = 0;
    let best = -Infinity, worst = Infinity;

    closed.forEach(({ pnl }) => {
      cum += pnl;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
      if (pnl > 0) sumWins += pnl;
      if (pnl < 0) sumLosses += Math.abs(pnl);
      if (pnl > best)  best  = pnl;
      if (pnl < worst) worst = pnl;
    });

    const pf = sumLosses > 0 ? sumWins / sumLosses : (sumWins > 0 ? Infinity : 0);
    const expectancy = closed.length ? cum / closed.length : 0;

    let streak = 0, streakType = null;
    for (let i = closed.length - 1; i >= 0; i--) {
      const o = closed[i].tr.outcome;
      if (o !== 'win' && o !== 'loss') { if (streak === 0) continue; break; }
      if (streakType === null) streakType = o;
      if (o === streakType) streak++;
      else break;
    }

    return {
      maxDD,
      pf,
      expectancy,
      best:  best  === -Infinity ? 0 : best,
      worst: worst ===  Infinity ? 0 : worst,
      streak,
      streakType,
    };
  }

  function renderPnlChart(containerId, trades) {
    const canvas = $(containerId);
    if (!canvas) return;

    const sorted = trades
      .slice()
      .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);

    if (!sorted.length) { canvas.style.display = 'none'; return; }
    canvas.style.display = '';

    let cum = 0;
    const labels = [''];
    const values = [0];
    const tradePnls = [0];
    sorted.forEach(tr => {
      const pnl = Calc.trade(tr).netPnl || 0;
      cum += pnl;
      labels.push(tr.date ? tr.date.slice(0, 10) : '');
      values.push(cum);
      tradePnls.push(pnl);
    });

    const isPositive = values[values.length - 1] >= 0;
    const lineColor  = isPositive ? '#00e5a0' : '#ff5767';
    const fillStart  = isPositive ? 'rgba(45,212,160,0.18)' : 'rgba(240,82,79,0.15)';

    if (pnlChart) { pnlChart.destroy(); pnlChart = null; }
    const ctx = canvas.getContext('2d');

    pnlChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data:                 values,
          borderColor:          lineColor,
          borderWidth:          2.5,
          pointRadius:          values.map((_, i) => (i === 0 || i === values.length - 1) ? 0 : 4),
          pointBackgroundColor: ['#636366', ...sorted.map(tr =>
            tr.outcome === 'win' ? '#30d158' : tr.outcome === 'loss' ? '#ff5767' : '#636366'
          )],
          tension:              0.35,
          fill:                 true,
          backgroundColor:      fillStart,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f1f26',
            borderColor:     'rgba(255,255,255,0.1)',
            borderWidth:     1,
            padding:         10,
            callbacks: {
              label: c => {
                const i   = c.dataIndex;
                const cum = Calc.formatPnL(c.parsed.y);
                if (i === 0) return t('dash.chart.start');
                const tr  = sorted[i - 1];
                const dir = tr.direction === 'long' ? '↑' : '↓';
                const pnlSign = tradePnls[i] >= 0 ? '+' : '';
                return ` ${tr.instrument} ${dir}  ${pnlSign}${Calc.formatPnL(tradePnls[i])}   ∑ ${cum}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks:  { color:'#55556a', font:{ size:10, family:"'Geist Mono',monospace" }, maxTicksLimit:8, maxRotation:0 },
            grid:   { display: false },
            border: { display: false },
          },
          y: {
            ticks:  { color:'#55556a', font:{ size:10, family:"'Geist Mono',monospace" }, callback: v => '$'+v.toFixed(0) },
            grid:   { color: 'rgba(255,255,255,0.05)' },
            border: { display: false },
          },
        },
      },
    });

    // Stats strip
    const stats   = computeEquityStats(trades);
    const statsEl = $('pnlStats');
    if (!stats || !statsEl) return;

    const pfStr = stats.pf === Infinity ? '∞' : stats.pf.toFixed(2);
    const pfCol = stats.pf >= 1.5 ? 'var(--green)' : stats.pf >= 1 ? 'var(--amber)' : 'var(--red)';
    const streakVal = stats.streak > 0
      ? `<span style="display:inline-flex;align-items:center;gap:5px;vertical-align:-2px">${Icons.svg(stats.streakType === 'win' ? 'flame' : 'snow', 15)} ${stats.streak}</span>`
      : '–';
    const streakLbl = stats.streakType === 'win'
      ? t('dash.streak.wins')
      : stats.streakType === 'loss'
        ? t('dash.streak.losses')
        : t('dash.streak.none');

    statsEl.innerHTML = `<div class="stat-strip">
      <div class="stat-strip-item"><div class="stat-strip-val" style="color:var(--red)">${stats.maxDD > 0 ? '-$' + stats.maxDD.toFixed(0) : '–'}</div><div class="stat-strip-lbl">Max DD</div></div>
      <div class="stat-strip-item"><div class="stat-strip-val" style="color:${pfCol}">${pfStr}</div><div class="stat-strip-lbl">Profit Factor</div></div>
      <div class="stat-strip-item"><div class="stat-strip-val" style="color:${stats.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}">${Calc.formatPnL(stats.expectancy)}</div><div class="stat-strip-lbl">${t('dash.expectancy')}</div></div>
      <div class="stat-strip-item"><div class="stat-strip-val" style="color:var(--green)">${Calc.formatPnL(stats.best)}</div><div class="stat-strip-lbl">${t('dash.best.trade')}</div></div>
      <div class="stat-strip-item"><div class="stat-strip-val" style="color:var(--red)">${Calc.formatPnL(stats.worst)}</div><div class="stat-strip-lbl">${t('dash.worst.trade')}</div></div>
      <div class="stat-strip-item"><div class="stat-strip-val">${streakVal}</div><div class="stat-strip-lbl">${streakLbl}</div></div>
    </div>`;
  }

  // v0.9.273 — sparkline SVG inline (léger, pas de Chart.js par carte)
  function _cumPnlSeries(trades) {
    const sorted = trades.slice().sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
    let cum = 0;
    const series = [0];
    sorted.forEach(tr => { cum += (Calc.trade(tr).netPnl || 0); series.push(cum); });
    return series;
  }
  function _sparkline(values, color) {
    if (!values || values.length < 3) return '';
    const w = 100, h = 30;
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max - min) || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="kpi-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" style="fill:none;stroke:${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  function kpiCard(label, value, sub, color, spark) {
    return `<div class="kpi-card">
      <div class="kpi-val" style="color:${color}">${value}</div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-sub">${sub}</div>
      ${spark || ''}
    </div>`;
  }

  // ── Helpers graphiques ────────────────────────────────────────────────────────
  const CHART_DEFAULTS = {
    color:   { green:'#00e5a0', red:'#ff5767', amber:'#f5a623', blue:'#4da6ff', muted:'#55556a' },
    font:    { family:"'Geist Mono',monospace", size: 11 },
    tooltip: { backgroundColor:'#1f1f26', borderColor:'rgba(255,255,255,0.1)', borderWidth:1, padding:10 },
  };
  function _destroyChart(key) { if (_charts[key]) { try { _charts[key].destroy(); } catch(_){} _charts[key] = null; } }
  function _closedTrades(trades) {
    return trades.filter(tr => tr.outcome && tr.outcome !== 'open')
                 .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
  }

  // 1. Donut Win / Loss / BE
  function _renderDonut(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const wins = closed.filter(t => t.outcome === 'win').length;
    const losses = closed.filter(t => t.outcome === 'loss').length;
    const be = closed.filter(t => t.outcome === 'breakeven').length;
    if (!closed.length) { el.parentElement.style.display = 'none'; return; }
    el.parentElement.style.display = '';
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Win', 'Loss', 'BE'],
        datasets: [{ data: [wins, losses, be],
          backgroundColor: [CHART_DEFAULTS.color.green, CHART_DEFAULTS.color.red, CHART_DEFAULTS.color.muted],
          borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { position: 'right', labels: { color:'#b2b5be', font: CHART_DEFAULTS.font, padding: 14, boxWidth: 12 } },
          tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` ${c.label} : ${c.raw} (${closed.length ? ((c.raw/closed.length)*100).toFixed(0) : 0}%)` } },
        },
      },
    });
  }

  // 2. P&L moyen par jour de la semaine (heatmap bars)
  function _renderDayOfWeek(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const sums = [0,0,0,0,0]; const counts = [0,0,0,0,0];
    closed.forEach(tr => {
      const d = new Date(tr.date).getDay(); // 0=dim, 1=lun…5=ven
      const idx = d - 1; if (idx < 0 || idx > 4) return;
      sums[idx]   += (Calc.trade(tr).netPnl || 0);
      counts[idx] += 1;
    });
    const avgs = sums.map((s, i) => counts[i] ? +(s / counts[i]).toFixed(2) : 0);
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: DAY_LABELS,
        datasets: [{ data: avgs, backgroundColor: avgs.map(v => v >= 0 ? 'rgba(0,229,160,0.75)' : 'rgba(255,87,103,0.75)'),
          borderRadius: 6, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` Moy: ${Calc.formatPnL(c.parsed.y)} (${counts[c.dataIndex]} trades)` } } },
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font }, grid:{ display:false }, border:{ display:false } },
          y: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, callback: v => '$'+v }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false } },
        },
      },
    });
  }

  // 3. Distribution des R:R (histogramme)
  function _renderRRDistrib(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const BUCKETS = ['-3+','-2','-1','0','1','2','3','4','5+'];
    const counts2 = new Array(BUCKETS.length).fill(0);
    closed.forEach(tr => {
      const rr = Calc.trade(tr).rr;
      if (rr === null || rr === undefined) return;
      if      (rr <= -3)   counts2[0]++;
      else if (rr <= -2)   counts2[1]++;
      else if (rr <= -1)   counts2[2]++;
      else if (rr <= 0)    counts2[3]++;
      else if (rr <= 1)    counts2[4]++;
      else if (rr <= 2)    counts2[5]++;
      else if (rr <= 3)    counts2[6]++;
      else if (rr <= 4)    counts2[7]++;
      else                 counts2[8]++;
    });
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: BUCKETS,
        datasets: [{ data: counts2,
          backgroundColor: BUCKETS.map((_, i) => i < 4 ? 'rgba(255,87,103,0.75)' : 'rgba(0,229,160,0.75)'),
          borderRadius: 4, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` ${c.raw} trade(s)` } } },
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font }, grid:{ display:false }, border:{ display:false } },
          y: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, stepSize: 1 }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false } },
        },
      },
    });
  }

  // 4. Performance par heure (bar)
  function _renderByHour(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const sums = {}; const counts3 = {};
    closed.forEach(tr => {
      const h = new Date(tr.date).getHours();
      sums[h]   = (sums[h]   || 0) + (Calc.trade(tr).netPnl || 0);
      counts3[h]= (counts3[h]|| 0) + 1;
    });
    const hours = Object.keys(sums).map(Number).sort((a,b) => a-b);
    if (!hours.length) { el.parentElement.style.display = 'none'; return; }
    el.parentElement.style.display = '';
    const labels = hours.map(h => h + 'h');
    const avgs2  = hours.map(h => counts3[h] ? +(sums[h]/counts3[h]).toFixed(2) : 0);
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: avgs2, backgroundColor: avgs2.map(v => v >= 0 ? 'rgba(0,229,160,0.75)' : 'rgba(255,87,103,0.75)'),
          borderRadius: 5, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` Moy: ${Calc.formatPnL(c.parsed.y)} (${counts3[hours[c.dataIndex]]} trades)` } } },
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font }, grid:{ display:false }, border:{ display:false } },
          y: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, callback: v => '$'+v }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false } },
        },
      },
    });
  }

  // 5. P&L par instrument (barres horizontales)
  function _renderByInstrument(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const sums = {}; const counts4 = {};
    closed.forEach(tr => {
      const k = String(tr.instrument || '?').replace(/[!1]/g,'');
      sums[k]   = (sums[k]   || 0) + (Calc.trade(tr).netPnl || 0);
      counts4[k]= (counts4[k]|| 0) + 1;
    });
    const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length) { el.parentElement.style.display = 'none'; return; }
    el.parentElement.style.display = '';
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(e => e[0]),
        datasets: [{ data: sorted.map(e => +e[1].toFixed(2)),
          backgroundColor: sorted.map(e => e[1] >= 0 ? 'rgba(0,229,160,0.75)' : 'rgba(255,87,103,0.75)'),
          borderRadius: 5, borderWidth: 0 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: {
          label: c => { const k = sorted[c.dataIndex][0]; return ` ${Calc.formatPnL(c.parsed.x)} · ${counts4[k]} trades`; }
        }}},
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, callback: v => '$'+v }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false } },
          y: { ticks:{ color:'#b2b5be', font: CHART_DEFAULTS.font }, grid:{ display:false }, border:{ display:false } },
        },
      },
    });
  }

  // 6. Courbe de drawdown (% over time)
  function _renderDrawdown(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    if (closed.length < 2) { el.parentElement.style.display = 'none'; return; }
    el.parentElement.style.display = '';
    let cum = 0, peak = 0;
    const labels = ['']; const dds = [0];
    closed.forEach(tr => {
      cum += (Calc.trade(tr).netPnl || 0);
      if (cum > peak) peak = cum;
      const dd = peak > 0 ? ((peak - cum) / peak) * 100 : 0;
      labels.push(tr.date ? tr.date.slice(0, 10) : '');
      dds.push(-+dd.toFixed(2));
    });
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{ data: dds, borderColor: CHART_DEFAULTS.color.red, borderWidth: 2,
          fill: true, backgroundColor: 'rgba(255,87,103,0.12)', tension: 0.3,
          pointRadius: 0, pointHitRadius: 8 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` DD: ${Math.abs(c.parsed.y).toFixed(1)}%` } } },
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, maxTicksLimit: 8, maxRotation:0 }, grid:{ display:false }, border:{ display:false } },
          y: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, callback: v => v + '%' }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false }, max: 0 },
        },
      },
    });
  }

  // 7. P&L par semaine (bar) — vue compte
  function _renderWeeklyPnl(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const byWeek = {};
    closed.forEach(tr => {
      const d = new Date(tr.date);
      // Clé semaine : année + numéro semaine ISO
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
      const key  = d.getFullYear() + '-W' + String(week).padStart(2,'0');
      byWeek[key] = (byWeek[key] || 0) + (Calc.trade(tr).netPnl || 0);
    });
    const sorted = Object.entries(byWeek).sort((a,b) => a[0] < b[0] ? -1 : 1).slice(-16);
    if (!sorted.length) { el.parentElement.style.display = 'none'; return; }
    el.parentElement.style.display = '';
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(e => e[0].replace(/\d{4}-/, '')),
        datasets: [{ data: sorted.map(e => +e[1].toFixed(2)),
          backgroundColor: sorted.map(e => e[1] >= 0 ? 'rgba(0,229,160,0.75)' : 'rgba(255,87,103,0.75)'),
          borderRadius: 5, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: c => ` ${Calc.formatPnL(c.parsed.y)}` } } },
        scales: {
          x: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font }, grid:{ display:false }, border:{ display:false } },
          y: { ticks:{ color: CHART_DEFAULTS.color.muted, font: CHART_DEFAULTS.font, callback: v => '$'+v }, grid:{ color:'rgba(255,255,255,0.05)' }, border:{ display:false } },
        },
      },
    });
  }

  // 8. Rolling win rate (fenêtre glissante N trades)
  function _renderRollingWinRate(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const N = 15;
    if (closed.length < N + 1) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const labels = [], vals = [];
    for (let i = N; i <= closed.length; i++) {
      const window = closed.slice(i - N, i);
      const wr = window.filter(t => t.outcome === 'win').length / N * 100;
      labels.push(closed[i-1].date ? closed[i-1].date.slice(5,10) : '');
      vals.push(+wr.toFixed(1));
    }
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{
        data: vals, borderColor: CHART_DEFAULTS.color.blue, borderWidth: 2.5,
        fill: true, backgroundColor: 'rgba(77,166,255,0.10)', tension: 0.4,
        pointRadius: 0, pointHitRadius: 10,
      },{
        data: new Array(labels.length).fill(50),
        borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderDash: [4,4],
        fill: false, pointRadius: 0,
      }]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...CHART_DEFAULTS.tooltip, filter: i => i.datasetIndex===0, callbacks:{ label: c => ` Win rate (${N}T): ${c.parsed.y}%` }}},
        scales:{
          x:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,maxTicksLimit:8,maxRotation:0}, grid:{display:false}, border:{display:false} },
          y:{ min:0, max:100, ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // 9. Rolling profit factor
  function _renderRollingPF(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const N = 15;
    if (closed.length < N + 1) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const labels = [], vals = [];
    for (let i = N; i <= closed.length; i++) {
      const win  = closed.slice(i-N,i).filter(t=>t.outcome==='win').reduce((s,t)=>s+(Calc.trade(t).netPnl||0),0);
      const loss = closed.slice(i-N,i).filter(t=>t.outcome==='loss').reduce((s,t)=>s+Math.abs(Calc.trade(t).netPnl||0),0);
      vals.push(loss>0 ? +Math.min(win/loss,5).toFixed(2) : (win>0?5:1));
      labels.push(closed[i-1].date ? closed[i-1].date.slice(5,10) : '');
    }
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{
        data: vals, borderColor: CHART_DEFAULTS.color.amber, borderWidth: 2.5,
        fill: true, backgroundColor: 'rgba(245,166,35,0.10)', tension: 0.4,
        pointRadius: 0, pointHitRadius: 10,
      },{
        data: new Array(labels.length).fill(1),
        borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderDash: [4,4],
        fill: false, pointRadius: 0,
      }]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...CHART_DEFAULTS.tooltip, filter:i=>i.datasetIndex===0, callbacks:{ label: c => ` PF (${N}T): ${c.parsed.y}` }}},
        scales:{
          x:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,maxTicksLimit:8,maxRotation:0}, grid:{display:false}, border:{display:false} },
          y:{ min:0, ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // 10. Multi-account equity overlay
  function _renderMultiAccountEquity(containerId, trades, accs) {
    const el = $(containerId); if (!el) return;
    if (!accs || accs.length < 2) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const PALETTE = ['#00e5a0','#4da6ff','#f5a623','#ff5767','#c678dd','#56b6c2','#98c379','#e06c75'];
    const datasets = accs.map((acc, ai) => {
      const accTrades = trades.filter(tr => tr.apex === acc.name && tr.outcome !== 'open')
                              .sort((a,b)=>(a.date||'')<(b.date||'')?-1:1);
      let cum = 0;
      const pts = [{ x: 0, y: 0 }];
      accTrades.forEach((tr,i) => { cum += (Calc.trade(tr).netPnl||0); pts.push({ x:i+1, y:+cum.toFixed(2) }); });
      return {
        label: acc.name,
        data: pts, parsing:{ xAxisKey:'x', yAxisKey:'y' },
        borderColor: PALETTE[ai % PALETTE.length],
        borderWidth: 2, fill: false, tension: 0.3,
        pointRadius: 0, pointHitRadius: 8,
      };
    });
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:12,padding:14} },
          tooltip:{ ...CHART_DEFAULTS.tooltip, callbacks:{ label: c => ` ${c.dataset.label}: ${Calc.formatPnL(c.parsed.y)}` }}},
        scales:{
          x:{ type:'linear', ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>'T'+v}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
          y:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // 11. Long vs Short (grouped bars : win rate + avg PnL)
  function _renderLongVsShort(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const long_t  = closed.filter(t => t.direction === 'long');
    const short_t = closed.filter(t => t.direction === 'short');
    if (!long_t.length && !short_t.length) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const wr  = arr => arr.length ? +(arr.filter(t=>t.outcome==='win').length/arr.length*100).toFixed(1) : 0;
    const avg = arr => arr.length ? +(arr.reduce((s,t)=>s+(Calc.trade(t).netPnl||0),0)/arr.length).toFixed(2) : 0;
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Win rate (%)', 'PnL moyen ($)'],
        datasets: [
          { label:'Long ↑', data:[wr(long_t), avg(long_t)], backgroundColor:'rgba(0,229,160,0.75)', borderRadius:5, borderWidth:0 },
          { label:'Short ↓', data:[wr(short_t), avg(short_t)], backgroundColor:'rgba(255,87,103,0.75)', borderRadius:5, borderWidth:0 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:12,padding:12} },
          tooltip:{ ...CHART_DEFAULTS.tooltip }},
        scales:{
          x:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font}, grid:{display:false}, border:{display:false} },
          y:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // 12. P&L par setup
  function _renderBySetup(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades).filter(t => t.setup);
    if (!closed.length) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const sums={}, counts={};
    closed.forEach(tr => {
      const k = tr.setup;
      sums[k]  = (sums[k]||0)  + (Calc.trade(tr).netPnl||0);
      counts[k]= (counts[k]||0) + 1;
    });
    const sorted = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(e=>e[0]),
        datasets: [{
          data: sorted.map(e=>+e[1].toFixed(2)),
          backgroundColor: sorted.map(e=>e[1]>=0?'rgba(0,229,160,0.75)':'rgba(255,87,103,0.75)'),
          borderRadius:5, borderWidth:0,
        }],
      },
      options: {
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...CHART_DEFAULTS.tooltip, callbacks:{ label:c=>` ${Calc.formatPnL(c.parsed.x)} · ${counts[sorted[c.dataIndex][0]]} trades` }}},
        scales:{
          x:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
          y:{ ticks:{color:'#b2b5be',font:{...CHART_DEFAULTS.font,size:10}}, grid:{display:false}, border:{display:false} },
        },
      },
    });
  }

  // 13. P&L mensuel (12 derniers mois)
  function _renderMonthlyPnl(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades);
    const byMonth={};
    closed.forEach(tr=>{
      const d = new Date(tr.date);
      const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      byMonth[k]=(byMonth[k]||0)+(Calc.trade(tr).netPnl||0);
    });
    const sorted = Object.entries(byMonth).sort((a,b)=>a[0]<b[0]?-1:1).slice(-12);
    if (!sorted.length) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    _destroyChart(containerId);
    const MONTHS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type:'bar',
      data:{
        labels: sorted.map(e=>{ const p=e[0].split('-'); return MONTHS[+p[1]-1]+' '+p[0].slice(2); }),
        datasets:[{ data:sorted.map(e=>+e[1].toFixed(2)),
          backgroundColor:sorted.map(e=>e[1]>=0?'rgba(0,229,160,0.75)':'rgba(255,87,103,0.75)'),
          borderRadius:5, borderWidth:0 }],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{...CHART_DEFAULTS.tooltip,callbacks:{label:c=>` ${Calc.formatPnL(c.parsed.y)}`}}},
        scales:{
          x:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font}, grid:{display:false}, border:{display:false} },
          y:{ ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // 14. Scatter R:R réel vs attendu
  function _renderRRScatter(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades).filter(tr=>tr.entry&&tr.sl&&tr.exitPrice);
    if (closed.length < 3) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const pts_win=[], pts_loss=[], pts_be=[];
    closed.forEach(tr=>{
      const risk = Math.abs(tr.entry - tr.sl);
      if (!risk) return;
      const planned = tr.tp1 ? Math.abs(tr.tp1 - tr.entry) / risk : null;
      const actual  = (Calc.trade(tr).rr) || 0;
      if (planned === null) return;
      const pt = { x:+planned.toFixed(2), y:+actual.toFixed(2) };
      if (tr.outcome==='win') pts_win.push(pt);
      else if (tr.outcome==='loss') pts_loss.push(pt);
      else pts_be.push(pt);
    });
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type:'scatter',
      data:{ datasets:[
        { label:'Win',  data:pts_win,  backgroundColor:'rgba(0,229,160,0.7)',  pointRadius:5 },
        { label:'Loss', data:pts_loss, backgroundColor:'rgba(255,87,103,0.7)', pointRadius:5 },
        { label:'BE',   data:pts_be,   backgroundColor:'rgba(85,85,106,0.7)',   pointRadius:5 },
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:10,padding:12} },
          tooltip:{...CHART_DEFAULTS.tooltip, callbacks:{label:c=>` Prévu: ${c.parsed.x}R  Réel: ${c.parsed.y}R`}}},
        scales:{
          x:{ title:{display:true,text:'R:R prévu (vers TP1)',color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font},
              ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>v+'R'}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
          y:{ title:{display:true,text:'R:R réalisé',color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font},
              ticks:{color:CHART_DEFAULTS.color.muted,font:CHART_DEFAULTS.font,callback:v=>v+'R'}, grid:{color:'rgba(255,255,255,0.05)'}, border:{display:false} },
        },
      },
    });
  }

  // ── Analytics psycho / contexte ───────────────────────────────────────────

  // Helper : win rate d'un groupe de trades
  function _wr(arr) { return arr.length ? arr.filter(t=>t.outcome==='win').length/arr.length*100 : null; }
  function _avgPnl(arr) { return arr.length ? arr.reduce((s,t)=>s+(Calc.trade(t).netPnl||0),0)/arr.length : null; }

  // Graphique barres groupées WR% + PnL moyen par valeur d'un champ custom
  function _renderCustomFieldChart(containerId, trades, fieldKey, labelFn) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades).filter(t => t.custom && t.custom[fieldKey] != null);
    if (closed.length < 3) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const groups = {};
    closed.forEach(t => {
      const v = String(t.custom[fieldKey]);
      if (!groups[v]) groups[v] = [];
      groups[v].push(t);
    });
    const keys    = Object.keys(groups);
    const wrVals  = keys.map(k => +(_wr(groups[k])||0).toFixed(1));
    const pnlVals = keys.map(k => +(_avgPnl(groups[k])||0).toFixed(2));
    const labels  = keys.map(k => labelFn ? labelFn(k) : k);
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Win rate (%)', data: wrVals, backgroundColor:'rgba(77,166,255,0.75)', borderRadius:5, borderWidth:0, yAxisID:'y' },
          { label:'PnL moyen ($)', data: pnlVals, backgroundColor: pnlVals.map(v=>v>=0?'rgba(0,229,160,0.6)':'rgba(255,87,103,0.6)'), borderRadius:5, borderWidth:0, yAxisID:'y2' },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:12,padding:12} },
          tooltip:{ ...CHART_DEFAULTS.tooltip, callbacks:{ label: c => c.datasetIndex===0 ? ` WR: ${c.parsed.y}% (${groups[keys[c.dataIndex]].length}T)` : ` Moy: ${Calc.formatPnL(c.parsed.y)}` }}},
        scales:{
          x:{ ticks:{color:'#b2b5be',font:{...CHART_DEFAULTS.font,size:10}}, grid:{display:false}, border:{display:false} },
          y:{ position:'left', min:0, max:100, ticks:{color:CHART_DEFAULTS.color.blue,font:CHART_DEFAULTS.font,callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{display:false} },
          y2:{ position:'right', ticks:{color:CHART_DEFAULTS.color.green,font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{display:false}, border:{display:false} },
        },
      },
    });
  }

  // Win rate + PnL par note de confiance (1–5) — barres + courbe
  function _renderConfidenceChart(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades).filter(t => t.custom && t.custom.confidence != null);
    if (closed.length < 3) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const byLevel = {};
    for (let i=1;i<=5;i++) byLevel[i]=[];
    closed.forEach(t => { const v=t.custom.confidence; if(byLevel[v]) byLevel[v].push(t); });
    const levels = [1,2,3,4,5];
    const wrVals  = levels.map(l => byLevel[l].length ? +_wr(byLevel[l]).toFixed(1) : null);
    const pnlVals = levels.map(l => byLevel[l].length ? +_avgPnl(byLevel[l]).toFixed(2) : null);
    const counts  = levels.map(l => byLevel[l].length);
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'],
        datasets:[
          { label:'Win rate (%)', data:wrVals, backgroundColor:'rgba(77,166,255,0.75)', borderRadius:5, borderWidth:0, yAxisID:'y' },
          { label:'PnL moyen ($)', data:pnlVals, type:'line', borderColor:CHART_DEFAULTS.color.amber, borderWidth:2.5, fill:false, tension:0.3, pointRadius:4, pointBackgroundColor:CHART_DEFAULTS.color.amber, yAxisID:'y2' },
        ],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:12,padding:12} },
          tooltip:{ ...CHART_DEFAULTS.tooltip, callbacks:{ label: c => c.datasetIndex===0 ? ` WR: ${c.parsed.y}% (${counts[c.dataIndex]}T)` : ` Moy: ${Calc.formatPnL(c.parsed.y)}` }}},
        scales:{
          x:{ ticks:{color:'#b2b5be',font:CHART_DEFAULTS.font}, grid:{display:false}, border:{display:false} },
          y:{ position:'left', min:0, max:100, ticks:{color:CHART_DEFAULTS.color.blue,font:CHART_DEFAULTS.font,callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{display:false} },
          y2:{ position:'right', ticks:{color:CHART_DEFAULTS.color.amber,font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{display:false}, border:{display:false} },
        },
      },
    });
  }

  // Plan suivi vs non suivi — barres comparatives
  function _renderPlanFollowedChart(containerId, trades) {
    const el = $(containerId); if (!el) return;
    const closed = _closedTrades(trades).filter(t => t.custom && t.custom.planFollowed);
    if (closed.length < 3) { el.parentElement.style.display='none'; return; }
    el.parentElement.style.display='';
    const groups = { yes:[], partial:[], no:[] };
    closed.forEach(t => { const v=t.custom.planFollowed; if(groups[v]) groups[v].push(t); });
    const labelMap = { yes:'✅ Oui', partial:'⚠️ Partiellement', no:'❌ Non' };
    const keys = ['yes','partial','no'];
    const wrVals  = keys.map(k => groups[k].length ? +_wr(groups[k]).toFixed(1) : 0);
    const pnlTot  = keys.map(k => +groups[k].reduce((s,t)=>s+(Calc.trade(t).netPnl||0),0).toFixed(0));
    _destroyChart(containerId);
    _charts[containerId] = new Chart(el.getContext('2d'), {
      type:'bar',
      data:{
        labels: keys.map(k=>labelMap[k]),
        datasets:[
          { label:'Win rate (%)', data:wrVals, backgroundColor:['rgba(0,229,160,0.75)','rgba(245,166,35,0.75)','rgba(255,87,103,0.75)'], borderRadius:5, borderWidth:0, yAxisID:'y' },
          { label:'P&L total ($)', data:pnlTot, type:'line', borderColor:'rgba(255,255,255,0.4)', borderWidth:2, fill:false, tension:0, pointRadius:5, pointBackgroundColor:'rgba(255,255,255,0.6)', yAxisID:'y2' },
        ],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'#b2b5be',font:CHART_DEFAULTS.font,boxWidth:12,padding:12} },
          tooltip:{ ...CHART_DEFAULTS.tooltip, callbacks:{ label: c => c.datasetIndex===0 ? ` WR: ${c.parsed.y}% (${groups[keys[c.dataIndex]].length}T)` : ` PnL total: ${Calc.formatPnL(c.parsed.y)}` }}},
        scales:{
          x:{ ticks:{color:'#b2b5be',font:CHART_DEFAULTS.font}, grid:{display:false}, border:{display:false} },
          y:{ position:'left', min:0, max:100, ticks:{color:CHART_DEFAULTS.color.green,font:CHART_DEFAULTS.font,callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{display:false} },
          y2:{ position:'right', ticks:{color:'rgba(255,255,255,0.5)',font:CHART_DEFAULTS.font,callback:v=>'$'+v}, grid:{display:false}, border:{display:false} },
        },
      },
    });
  }

  // 15. Calendar heatmap (90 jours, style GitHub)
  function _renderCalendarHeatmap(containerId, trades) {
    const host = $(containerId); if (!host) return;
    const byDay={};
    trades.forEach(tr=>{
      if (!tr.date || tr.outcome==='open') return;
      const k = tr.date.slice(0,10);
      byDay[k]=(byDay[k]||0)+(Calc.trade(tr).netPnl||0);
    });
    const today = new Date(); today.setHours(0,0,0,0);
    const DAYS=90;
    // Commence au lundi précédent le début
    const start = new Date(today); start.setDate(today.getDate()-DAYS+1);
    const mondayStart = new Date(start); mondayStart.setDate(start.getDate()-((start.getDay()||7)-1));
    const cells=[];
    const cursor=new Date(mondayStart);
    while(cursor<=today){
      const k=cursor.toISOString().slice(0,10);
      cells.push({ date:k, pnl:byDay[k]||null, dow:cursor.getDay() });
      cursor.setDate(cursor.getDate()+1);
    }
    // Max absolu pour scale couleur
    const vals=Object.values(byDay); const maxAbs=vals.length?Math.max(...vals.map(Math.abs),1):1;
    function cellColor(pnl){
      if(pnl===null) return '#1a1b21';
      const i=Math.min(1,Math.abs(pnl)/maxAbs);
      if(pnl>=0) return `rgba(0,229,160,${0.15+i*0.85})`;
      return `rgba(255,87,103,${0.15+i*0.85})`;
    }
    const DLABELS=['','L','M','M','J','V',''];
    // Construire la grille semaines × jours
    const weeks=[]; let week=[];
    cells.forEach((c,i)=>{ week.push(c); if(c.dow===0||i===cells.length-1){ weeks.push(week); week=[]; } });
    let grid='<div class="cal-heatmap">';
    grid+='<div class="cal-days">';
    DLABELS.forEach(d=>grid+=`<div class="cal-day-lbl">${d}</div>`);
    grid+='</div><div class="cal-weeks">';
    weeks.forEach(wk=>{
      grid+='<div class="cal-week">';
      for(let d=1;d<=7;d++){
        const c=wk.find(x=>x.dow===d%7)||(wk.find(x=>x.dow===0)&&d===7?wk.find(x=>x.dow===0):null);
        if(c&&c.date<=today.toISOString().slice(0,10)){
          const tip=c.pnl!==null?`${c.date} : ${c.pnl>=0?'+':''}$${c.pnl.toFixed(0)}`:`${c.date} : aucun trade`;
          grid+=`<div class="cal-cell" style="background:${cellColor(c.pnl)}" title="${tip}"></div>`;
        } else { grid+=`<div class="cal-cell cal-cell-empty"></div>`; }
      }
      grid+='</div>';
    });
    grid+='</div></div>';
    host.innerHTML=grid;
  }

  // ── Layout HTML ───────────────────────────────────────────────────────────────
  function _advancedChartsBlock(idSuffix) {
    const s = idSuffix;
    return `
    <div class="adv-section-hd">📊 Performance</div>
    <div class="adv-charts-grid">
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Répartition Win / Loss / BE</h3><div class="chart-area chart-area-sm"><canvas id="chartDonut${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">P&amp;L moyen par jour de semaine</h3><div class="chart-area chart-area-sm"><canvas id="chartDay${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Distribution des R:R</h3><div class="chart-area chart-area-sm"><canvas id="chartRR${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Performance par heure</h3><div class="chart-area chart-area-sm"><canvas id="chartHour${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Long ↑ vs Short ↓</h3><div class="chart-area chart-area-sm"><canvas id="chartLvS${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">P&amp;L par setup</h3><div class="chart-area chart-area-sm"><canvas id="chartSetup${s}"></canvas></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">P&amp;L par instrument</h3><div class="chart-area chart-area-sm"><canvas id="chartInstr${s}"></canvas></div></div>
    </div>
    <div class="adv-section-hd">📈 Analyse temporelle</div>
    <div class="adv-charts-grid">
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">Calendrier heatmap P&amp;L (90 jours)</h3><div id="chartCal${s}"></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">P&amp;L mensuel (12 derniers mois)</h3><div class="chart-area chart-area-sm"><canvas id="chartMonth${s}"></canvas></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">P&amp;L par semaine (16 dernières)</h3><div class="chart-area chart-area-sm"><canvas id="chartWeek${s}"></canvas></div></div>
    </div>
    <div class="adv-section-hd">🔬 Analyse avancée</div>
    <div class="adv-charts-grid">
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate glissant (15 trades)</h3><div class="chart-area chart-area-sm"><canvas id="chartRolWR${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Profit factor glissant (15 trades)</h3><div class="chart-area chart-area-sm"><canvas id="chartRolPF${s}"></canvas></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">Drawdown cumulé (%)</h3><div class="chart-area chart-area-sm"><canvas id="chartDD${s}"></canvas></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">Scatter : R:R prévu vs réalisé</h3><div class="chart-area"><canvas id="chartScatter${s}"></canvas></div></div>
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">Courbes d'équité par compte</h3><div class="chart-area"><canvas id="chartMulti${s}"></canvas></div></div>
    </div>
    <div class="adv-section-hd">🧠 Psychologie & Contexte</div>
    <div class="adv-charts-grid">
      <div class="chart-card adv-chart-full"><h3 class="chart-card-title">Win rate & PnL moyen — Plan suivi ?</h3><div class="chart-area chart-area-sm"><canvas id="chartPlan${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — État émotionnel</h3><div class="chart-area chart-area-sm"><canvas id="chartEmo${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Note de confiance</h3><div class="chart-area chart-area-sm"><canvas id="chartConf${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Préparation</h3><div class="chart-area chart-area-sm"><canvas id="chartPrep${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Grade trade (A–D)</h3><div class="chart-area chart-area-sm"><canvas id="chartGrade${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Structure marché</h3><div class="chart-area chart-area-sm"><canvas id="chartStruct${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Session</h3><div class="chart-area chart-area-sm"><canvas id="chartSess${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Contexte macro</h3><div class="chart-area chart-area-sm"><canvas id="chartMacro${s}"></canvas></div></div>
      <div class="chart-card adv-chart-half"><h3 class="chart-card-title">Win rate & PnL — Volatilité</h3><div class="chart-area chart-area-sm"><canvas id="chartVol${s}"></canvas></div></div>
    </div>`;
  }

  function _renderAdvancedCharts(idSuffix, trades, accs) {
    const s = idSuffix;
    requestAnimationFrame(() => {
      _renderDonut            ('chartDonut'  + s, trades);
      _renderDayOfWeek        ('chartDay'    + s, trades);
      _renderRRDistrib        ('chartRR'     + s, trades);
      _renderByHour           ('chartHour'   + s, trades);
      _renderLongVsShort      ('chartLvS'    + s, trades);
      _renderBySetup          ('chartSetup'  + s, trades);
      _renderByInstrument     ('chartInstr'  + s, trades);
      _renderCalendarHeatmap  ('chartCal'    + s, trades);
      _renderMonthlyPnl       ('chartMonth'  + s, trades);
      _renderWeeklyPnl        ('chartWeek'   + s, trades);
      _renderRollingWinRate   ('chartRolWR'  + s, trades);
      _renderRollingPF        ('chartRolPF'  + s, trades);
      _renderDrawdown         ('chartDD'     + s, trades);
      _renderRRScatter         ('chartScatter'+ s, trades);
      _renderMultiAccountEquity('chartMulti' + s, trades, accs || []);
      // Psychologie & contexte
      const emoLabel  = k => i18n.t('jf.emotion.'        + k) || k;
      const prepLabel = k => i18n.t('jf.prepQuality.'    + k) || k;
      const gradeLabel= k => i18n.t('jf.tradeGrade.'     + k) || k;
      const structLbl = k => i18n.t('jf.marketStructure.'+ k) || k;
      const sessLabel = k => i18n.t('jf.session.'        + k) || k;
      const macroLbl  = k => i18n.t('jf.macroContext.'   + k) || k;
      const volLabel  = k => i18n.t('jf.volatility.'     + k) || k;
      _renderPlanFollowedChart  ('chartPlan' + s, trades);
      _renderCustomFieldChart   ('chartEmo'  + s, trades, 'emotion',        emoLabel);
      _renderConfidenceChart    ('chartConf' + s, trades);
      _renderCustomFieldChart   ('chartPrep' + s, trades, 'prepQuality',    prepLabel);
      _renderCustomFieldChart   ('chartGrade'+ s, trades, 'tradeGrade',     gradeLabel);
      _renderCustomFieldChart   ('chartStruct'+s, trades, 'marketStructure',structLbl);
      _renderCustomFieldChart   ('chartSess' + s, trades, 'session',        sessLabel);
      _renderCustomFieldChart   ('chartMacro'+ s, trades, 'macroContext',   macroLbl);
      _renderCustomFieldChart   ('chartVol'  + s, trades, 'volatility',     volLabel);
    });
  }

  function goOffers() {
    document.querySelector('[data-page="offers"]').click();
  }

  UI.renderDashboard = function () {
    const el     = $('dashContent');
    const all    = Store.getTrades();
    const accs   = Store.getMyAccounts();
    const grps   = Store.getGroups();
    // v0.9.396 : le filtre vient du Focus app-wide (persistant), plus d'état local.
    dashFilter   = (Store.getFocusScope && Store.getFocusScope()) || null;
    const trades = tradesForFilter();
    const s      = UI.statsForTrades(trades);
    const isPro  = Store.isPro();

    // U21 : empty state si aucun trade enregistré (premier lancement)
    // Évite l'affichage de KPI à zéro et de graphes vides, guide vers la 1ère action
    if (!all.length) {
      el.innerHTML = `<div class="dash-empty">
        <div class="dash-empty-icon">${Icons.svg('lineChart',44)}</div>
        <h2 class="dash-empty-title">${t('dash.empty.title') || 'Bienvenue sur ZeldTrade'}</h2>
        <p class="dash-empty-text">${t('dash.empty.text') || 'Ajoute ton premier trade pour voir tes stats, ta courbe d\'équité, et tes performances par compte.'}</p>
        <div class="dash-empty-steps">
          <div class="dash-empty-step"><span class="dash-empty-num">1</span><span>${t('dash.empty.step1') || 'Configure ton compte prop firm dans Réglages'}</span></div>
          <div class="dash-empty-step"><span class="dash-empty-num">2</span><span>${t('dash.empty.step2') || 'Clique sur « + Nouveau trade » en bas de la sidebar'}</span></div>
          <div class="dash-empty-step"><span class="dash-empty-num">3</span><span>${t('dash.empty.step3') || 'Suis le wizard 3 étapes (direction → screenshot → détails)'}</span></div>
        </div>
        <button class="btn-primary dash-empty-cta" id="dashEmptyCta">${t('dash.empty.cta') || '+ Créer mon premier trade'}</button>
      </div>`;
      const btn = $('dashEmptyCta');
      if (btn) {
        btn.addEventListener('click', () => {
          if (accs.length === 0) {
            // Pas de compte → diriger vers Settings
            document.querySelector('[data-page="settings"]')?.click();
          } else {
            // Ouvrir le wizard
            const newTradeBtn = document.getElementById('btnNewTrade');
            if (newTradeBtn) newTradeBtn.click();
          }
        });
      }
      return;
    }

    // v0.9.396 : le sélecteur de filtre a migré dans la topbar (Focus app-wide).
    let body = '';

    function recentTradesBlock(tradesList) {
      if (!tradesList.length) return '';
      const rows = tradesList.slice(0, 8).map(tr => {
        const c       = Calc.trade(tr);
        const date    = new Date(tr.date).toLocaleDateString(i18n.locale(), { day:'2-digit', month:'2-digit' });
        const safeDir = tr.direction === 'long' ? 'long' : 'short';
        const dirC    = safeDir === 'long' ? 'var(--green)' : 'var(--red)';
        const outcomeC = tr.outcome === 'win' ? 'var(--green)' : tr.outcome === 'loss' ? 'var(--red)' : 'var(--muted)';
        const pnlStr  = c.netPnl !== null ? Calc.formatPnL(c.netPnl) : '—';
        return `<tr>
          <td><span style="display:inline-block;width:3px;height:14px;border-radius:2px;background:${dirC};margin-right:8px;vertical-align:middle"></span><strong>${UI.escHtml(tr.instrument)}</strong></td>
          <td style="color:${dirC}">${safeDir === 'long' ? '↑ Long' : '↓ Short'}</td>
          ${tr.apex ? `<td style="color:var(--muted);font-size:12px">${UI.escHtml(tr.apex)}</td>` : '<td></td>'}
          <td style="color:var(--muted)">${date}</td>
          <td style="color:${Calc.rrColor(c.rr)}">${c.rr.toFixed(2)}R</td>
          <td style="color:${outcomeC}">${pnlStr}</td>
        </tr>`;
      }).join('');
      return `<div class="page-section">
        <div class="page-section-hd">
          <span class="page-section-ttl">${t('dash.recent.trades')}</span>
          <span class="page-section-count">${tradesList.length} total</span>
        </div>
        <div class="chart-card" style="padding:16px 20px">
          <table class="recent-trade-table">
            <thead><tr>
              <th>Instrument</th><th>Direction</th><th>Compte</th><th>Date</th><th>R:R</th><th>PnL net</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    }

    if (dashFilter && dashFilter.startsWith('acc:')) {
      const accName = dashFilter.slice(4);
      const acc     = accs.find(a => a.name === accName);
      if (acc) body = accountCard(acc, trades);
      body += `<div class="chart-card"><h3>${t('dash.pnl.curve')}</h3><div class="chart-area"><canvas id="pnlChart"></canvas></div><div id="pnlStats"></div></div>`;
      body += _advancedChartsBlock('Acc');
      body += recentTradesBlock(trades);

    } else if (dashFilter && (dashFilter.startsWith('grp:') || dashFilter.startsWith('firm:'))) {
      // v0.9.396 : vue agrégée multi-comptes — groupe (grp:) OU prop firm entière (firm:)
      let memberAccs = [];
      if (dashFilter.startsWith('grp:')) {
        const grp = Store.getGroupById(dashFilter.slice(4));
        if (grp && grp.accountIds) memberAccs = grp.accountIds.map(id => Store.getMyAccountById(id)).filter(Boolean);
      } else {
        const key = dashFilter.slice(5);
        memberAccs = accs.filter(a => a.firmKey === key);
      }
      if (memberAccs.length) {
        body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.accounts.grp')}</span><span class="page-section-count">${memberAccs.length} ${memberAccs.length > 1 ? t('ui.accounts') : t('ui.account')}</span></div><div class="dash-group-accounts">`;
        memberAccs.forEach(acc => {
          body += accountCard(acc, trades.filter(tr => tr.apex === acc.name));
        });
        body += `</div></div>`;
      }
      body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.pnl.cumul')}</span></div>
        <div class="kpi-grid">
          ${kpiCard(t('ui.pnl.net'), (s.totalPnL>=0?'+':'-')+'$'+Math.abs(s.totalPnL).toFixed(0), s.total+' '+(s.total > 1 ? t('ui.trades') : t('ui.trade')), s.totalPnL>=0?'var(--green)':'var(--red)', _sparkline(_cumPnlSeries(trades), s.totalPnL>=0?'var(--green)':'var(--red)'))}
          ${kpiCard(t('dash.win.rate'), s.winRate!==null ? s.winRate.toFixed(0)+'%' : '—', s.wins+'W · '+s.losses+'L', (s.winRate||0)>=50?'var(--green)':'var(--red)')}
          ${kpiCard(t('dash.avg.rr'), s.avgRR.toFixed(2)+'R', t('dash.group'), s.avgRR>=1.5?'var(--green)':'var(--amber)')}
          ${kpiCard(t('dash.avg.win'), '+$'+s.avgWin.toFixed(0), s.winN+' W', 'var(--green)')}
          ${kpiCard(t('dash.avg.loss'), '-$'+s.avgLoss.toFixed(0), s.lossN+' L', 'var(--red)')}
          ${kpiCard(t('dash.open'), s.open.toString(), t('dash.in.progress'), 'var(--blue)')}
        </div>
        <div class="chart-card"><div class="chart-area"><canvas id="pnlChart"></canvas></div><div id="pnlStats"></div></div>
      </div>`;
      body += _advancedChartsBlock('Grp');
      body += recentTradesBlock(trades);

    } else {
      // Vue globale : comptes d'abord, puis courbe
      if (accs.length) {
        body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.accounts.grp')}</span><span class="page-section-count">${accs.length} ${accs.length > 1 ? t('ui.accounts') : t('ui.account')}</span></div><div class="dash-group-accounts">`;
        accs.forEach(acc => {
          body += accountCard(acc, all.filter(tr => tr.apex === acc.name));
        });
        body += `</div></div>`;
      }
      body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.pnl.cumul')}</span></div>
        <div class="kpi-grid">
          ${kpiCard(t('ui.pnl.net'), (s.totalPnL>=0?'+':'-')+'$'+Math.abs(s.totalPnL).toFixed(0), s.total+' '+(s.total > 1 ? t('ui.trades') : t('ui.trade')), s.totalPnL>=0?'var(--green)':'var(--red)', _sparkline(_cumPnlSeries(trades), s.totalPnL>=0?'var(--green)':'var(--red)'))}
          ${kpiCard(t('dash.win.rate'), s.winRate!==null ? s.winRate.toFixed(0)+'%' : '—', s.wins+'W · '+s.losses+'L', (s.winRate||0)>=50?'var(--green)':'var(--red)')}
          ${kpiCard(t('dash.avg.rr'), s.avgRR.toFixed(2)+'R', t('dash.all.trades'), s.avgRR>=1.5?'var(--green)':'var(--amber)')}
          ${kpiCard(t('dash.avg.win'), '+$'+s.avgWin.toFixed(0), s.winN+' W', 'var(--green)')}
          ${kpiCard(t('dash.avg.loss'), '-$'+s.avgLoss.toFixed(0), s.lossN+' L', 'var(--red)')}
          ${kpiCard(t('dash.open'), s.open.toString(), t('dash.in.progress'), 'var(--blue)')}
        </div>
        <div class="chart-card"><div class="chart-area"><canvas id="pnlChart"></canvas></div><div id="pnlStats"></div></div>
      </div>`;
      body += _advancedChartsBlock('All');
      body += recentTradesBlock(all);
    }

    // Upgrade nudge for Trader (free) users with 1 account
    const upgradeBanner = !isPro
      ? `<div class="upgrade-inline" id="dashUpgradeBanner" style="margin-bottom:20px">
          <div class="upgrade-inline-icon"></div>
          <div class="upgrade-inline-body">
            <div class="upgrade-inline-title">${i18n.getLang() === 'en' ? 'Funded & Elite: more accounts & advanced analytics' : 'Funded & Elite : plus de comptes & analytics avancées'}</div>
            <div class="upgrade-inline-sub">${i18n.getLang() === 'en'
              ? 'Trader plan · 1 account · Session analytics locked'
              : 'Plan Trader · 1 compte · Analytics par session verrouillées'}</div>
          </div>
          <button class="upgrade-inline-btn" id="btnDashUpgrade">${i18n.getLang() === 'en' ? 'See plans →' : 'Voir les offres →'}</button>
        </div>`
      : '';

    const titleRow = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div class="page-title" style="margin-bottom:0">Dashboard</div>
    </div>`;
    el.innerHTML = titleRow + upgradeBanner + body;

    const upgBtn = $('btnDashUpgrade');
    if (upgBtn) upgBtn.addEventListener('click', goOffers);

    if (typeof Chart === 'undefined') {
      const ca = $('pnlChart');
      if (ca) ca.parentElement.innerHTML = '<p style="color:var(--red);font-size:13px;padding:20px 0">⚠ Chart.js non chargé. Recharge avec Cmd+Shift+R.</p>';
    } else {
      requestAnimationFrame(() => {
        try { renderPnlChart('pnlChart', trades); } catch(e) {
          const ca = $('pnlChart');
          if (ca) { const p = document.createElement('p'); p.style.cssText = 'color:var(--red);font-size:12px;padding:20px 0'; p.textContent = '⚠ Erreur : ' + String(e).slice(0, 200); ca.parentElement.innerHTML = ''; ca.parentElement.appendChild(p); }
          console.error('[Chart error]', e);
        }
      });
      // Graphiques avancés — suffixe selon la vue active
      const sfx = dashFilter && dashFilter.startsWith('acc:') ? 'Acc'
                : dashFilter && (dashFilter.startsWith('grp:') || dashFilter.startsWith('firm:')) ? 'Grp'
                : 'All';
      _renderAdvancedCharts(sfx, trades, accs);
    }
  };
})();
