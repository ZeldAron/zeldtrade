// ─── DASHBOARD ────────────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = k => i18n.t(k);

  let dashFilter = null;
  let pnlChart   = null;

  function tradesForFilter(filter) {
    const all = Store.getTrades();
    if (!filter || filter === 'all') return all;
    if (filter.startsWith('acc:')) {
      const name = filter.slice(4);
      return all.filter(t => t.apex === name);
    }
    if (filter.startsWith('grp:')) {
      const grp = Store.getGroupById(filter.slice(4));
      if (!grp) return [];
      const names = (grp.accountIds || [])
        .map(id => Store.getMyAccountById(id))
        .filter(Boolean)
        .map(a => a.name);
      return all.filter(t => names.includes(t.apex));
    }
    return all;
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

  function goOffers() {
    document.querySelector('[data-page="offers"]').click();
  }

  UI.renderDashboard = function () {
    const el     = $('dashContent');
    const all    = Store.getTrades();
    const accs   = Store.getMyAccounts();
    const grps   = Store.getGroups();
    const trades = tradesForFilter(dashFilter);
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

    const currentVal = dashFilter || 'all';
    let opts = `<option value="all"${currentVal==='all'?' selected':''}>${t('dash.all.accounts')}</option>`;
    if (accs.length) {
      opts += `<optgroup label="${t('dash.accounts.grp')}">`;
      opts += accs.map(a => {
        const v = 'acc:' + a.name;
        return `<option value="${UI.escHtml(v)}"${currentVal===v?' selected':''}>${UI.escHtml(a.name)}</option>`;
      }).join('');
      opts += `</optgroup>`;
    }
    if (grps.length) {
      opts += `<optgroup label="${t('dash.groups.grp')}">`;
      opts += grps.map(g => {
        const v = 'grp:' + g.id;
        return `<option value="${UI.escHtml(v)}"${currentVal===v?' selected':''}>${UI.escHtml(g.name)}</option>`;
      }).join('');
      opts += `</optgroup>`;
    }
    const filterBar = `<div class="dash-selector-row">
      <select class="dash-account-select" id="dashAccountSelect">${opts}</select>
    </div>`;

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
      body += recentTradesBlock(trades);

    } else if (dashFilter && dashFilter.startsWith('grp:')) {
      const grp = Store.getGroupById(dashFilter.slice(4));
      if (grp && grp.accountIds && grp.accountIds.length) {
        body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.accounts.grp')}</span><span class="page-section-count">${grp.accountIds.length} compte${grp.accountIds.length > 1 ? 's' : ''}</span></div><div class="dash-group-accounts">`;
        grp.accountIds.forEach(accId => {
          const acc = Store.getMyAccountById(accId);
          if (!acc) return;
          body += accountCard(acc, trades.filter(tr => tr.apex === acc.name));
        });
        body += `</div></div>`;
      }
      body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.pnl.cumul')}</span></div>
        <div class="kpi-grid">
          ${kpiCard(t('ui.pnl.net'), (s.totalPnL>=0?'+':'-')+'$'+Math.abs(s.totalPnL).toFixed(0), s.total+' '+(s.total > 1 ? t('ui.trades') : t('ui.trade')), s.totalPnL>=0?'var(--green)':'var(--red)', _sparkline(_cumPnlSeries(trades), s.totalPnL>=0?'var(--green)':'var(--red)'))}
          ${kpiCard(t('dash.win.rate'), s.winRate!==null ? s.winRate.toFixed(0)+'%' : '—', s.wins+'W · '+s.losses+'L', (s.winRate||0)>=50?'var(--green)':'var(--red)')}
          ${kpiCard(t('dash.avg.rr'), s.avgRR.toFixed(2)+'R', t('dash.group'), s.avgRR>=1.5?'var(--green)':'var(--amber)')}
          ${kpiCard(t('dash.open'), s.open.toString(), t('dash.in.progress'), 'var(--blue)')}
        </div>
        <div class="chart-card"><div class="chart-area"><canvas id="pnlChart"></canvas></div><div id="pnlStats"></div></div>
      </div>`;
      body += recentTradesBlock(trades);

    } else {
      // Vue globale : comptes d'abord, puis courbe
      if (accs.length) {
        body += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('dash.accounts.grp')}</span><span class="page-section-count">${accs.length} compte${accs.length > 1 ? 's' : ''}</span></div><div class="dash-group-accounts">`;
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
          ${kpiCard(t('dash.open'), s.open.toString(), t('dash.in.progress'), 'var(--blue)')}
        </div>
        <div class="chart-card"><div class="chart-area"><canvas id="pnlChart"></canvas></div><div id="pnlStats"></div></div>
      </div>`;
      body += recentTradesBlock(all);
    }

    // Upgrade nudge for Trader (free) users with 1 account
    const upgradeBanner = !isPro
      ? `<div class="upgrade-inline" id="dashUpgradeBanner" style="margin-bottom:20px">
          <div class="upgrade-inline-icon">✦</div>
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
      ${filterBar.replace('<div class="dash-selector-row">', '<div class="dash-selector-row" style="margin-bottom:0">')}
    </div>`;
    el.innerHTML = titleRow + upgradeBanner + body;

    const upgBtn = $('btnDashUpgrade');
    if (upgBtn) upgBtn.addEventListener('click', goOffers);

    const sel = $('dashAccountSelect');
    if (sel) sel.addEventListener('change', () => {
      dashFilter = sel.value === 'all' ? null : sel.value;
      UI.renderDashboard();
    });

    if (typeof Chart === 'undefined') {
      const ca = $('pnlChart');
      if (ca) ca.parentElement.innerHTML = '<p style="color:var(--red);font-size:13px;padding:20px 0">⚠ Chart.js non chargé. Recharge avec Cmd+Shift+R.</p>';
    } else {
      requestAnimationFrame(() => {
        try {
          renderPnlChart('pnlChart', trades);
        } catch(e) {
          const ca = $('pnlChart');
          if (ca) { const p = document.createElement('p'); p.style.cssText = 'color:var(--red);font-size:12px;padding:20px 0'; p.textContent = '⚠ Erreur : ' + String(e).slice(0, 200); ca.parentElement.innerHTML = ''; ca.parentElement.appendChild(p); }
          console.error('[Chart error]', e);
        }
      });
    }
  };
})();
