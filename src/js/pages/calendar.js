// ─── CALENDAR ─────────────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = k => i18n.t(k);

  // v0.9.358 (fix B-04) : montant signé. Le `-` manquait sur les pertes
  // (`Math.abs` + `>=0?'+':''` → un montant rouge sans signe est ambigu sur capture).
  function fmtSigned(v, approx) {
    const n = Number(v) || 0;
    const sign = n < 0 ? '-' : (approx ? '' : '+');
    return (approx ? '~' : '') + sign + '$' + Math.abs(n).toFixed(0);
  }

  let calYear         = new Date().getFullYear();
  let calMonth        = new Date().getMonth();
  let calSelectedDate = null;

  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getMonths() {
    return t('cal.months').split(',');
  }

  function getDays() {
    return t('cal.days').split(',');
  }

  function buildByDate(trades) {
    const byDate = Object.create(null);
    trades.forEach(tr => {
      const d = UI.localDay(tr.date);
      if (!d) return;
      if (!byDate[d]) byDate[d] = { trades: [], pnl: 0, wins: 0, losses: 0, be: 0, open: 0 };
      const c = Calc.trade(tr);
      if (tr.outcome !== 'open') byDate[d].pnl += (c.netPnl || 0);
      byDate[d].trades.push(tr);
      if      (tr.outcome === 'win')  byDate[d].wins++;
      else if (tr.outcome === 'loss') byDate[d].losses++;
      else if (tr.outcome === 'be')   byDate[d].be++;
      else if (tr.outcome === 'open') byDate[d].open++;
    });
    return byDate;
  }

  function buildGrid(byDate, today) {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay  = new Date(calYear, calMonth + 1, 0);
    const startOff = (firstDay.getDay() + 6) % 7; // Monday = 0

    let grid = '';
    for (let i = 0; i < startOff; i++)
      grid += '<div class="cal-cell cal-cell--empty"></div>';

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const ds  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow = (new Date(calYear, calMonth, day).getDay() + 6) % 7;
      const isWE       = dow >= 5;
      const isToday    = ds === today;
      const isSelected = ds === calSelectedDate;
      const data       = byDate[ds];

      let cls = 'cal-cell';
      if (isWE)       cls += ' cal-cell--we';
      if (isToday)    cls += ' cal-cell--today';
      if (isSelected) cls += ' cal-cell--sel';
      if (data) {
        const hasClosed = data.wins + data.losses + data.be > 0;
        if (hasClosed && data.pnl > 0)       cls += ' cal-cell--win';
        else if (hasClosed && data.pnl < 0)  cls += ' cal-cell--loss';
        else if (data.trades.length)          cls += ' cal-cell--be';
      }

      let inner = `<div class="cal-num">${day}</div>`;
      if (data) {
        const hasClosed = data.wins + data.losses + data.be > 0;
        const pnlColor  = data.pnl > 0 ? 'var(--green)' : data.pnl < 0 ? 'var(--red)' : 'var(--muted)';
        if (hasClosed) {
          inner += `<div class="cal-pnl" style="color:${pnlColor}">${fmtSigned(data.pnl)}</div>`;
        } else if (data.open) {
          inner += `<div class="cal-pnl" style="color:var(--muted)">${t('cal.open')}</div>`;
        }
        const wl = [];
        if (data.wins)   wl.push(data.wins   + 'W');
        if (data.losses) wl.push(data.losses  + 'L');
        if (data.be)     wl.push(data.be      + 'BE');
        if (data.open && (data.wins || data.losses || data.be)) wl.push(data.open + '…');
        if (wl.length)   inner += `<div class="cal-wl">${wl.join(' ')}</div>`;
      }

      grid += `<div class="${cls}" data-date="${ds}">${inner}</div>`;
    }

    const total = startOff + lastDay.getDate();
    for (let i = 0; i < (7 - (total % 7)) % 7; i++)
      grid += '<div class="cal-cell cal-cell--empty"></div>';

    return grid;
  }

  function buildSummary(byDate) {
    const monthStr  = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
    const tradingDays = Object.entries(byDate)
      .filter(([d]) => d.startsWith(monthStr))
      .sort(([a], [b]) => b.localeCompare(a));

    if (!tradingDays.length) return '';

    const monthPnL    = tradingDays.reduce((s, [, d]) => s + d.pnl, 0);
    const monthWins   = tradingDays.reduce((s, [, d]) => s + d.wins, 0);
    const monthLoss   = tradingDays.reduce((s, [, d]) => s + d.losses, 0);
    const monthTotal  = tradingDays.reduce((s, [, d]) => s + d.trades.length, 0);
    const pnlColor    = monthPnL > 0 ? 'var(--green)' : monthPnL < 0 ? 'var(--red)' : 'var(--muted)';

    const rows = tradingDays.map(([ds, data]) => {
      const [y, m, day] = ds.split('-').map(Number);
      const label = new Date(y, m - 1, day).toLocaleDateString(i18n.locale(), {
        weekday: 'short', day: 'numeric', month: 'short'
      });

      const hasClosed = data.wins + data.losses + data.be > 0;
      const pnl       = data.pnl;
      const pc        = pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--muted)';
      const pnlStr    = hasClosed ? fmtSigned(pnl) : '—';

      const avgRR = data.trades.length
        ? (data.trades.reduce((s, tr) => s + Calc.trade(tr).rr, 0) / data.trades.length).toFixed(2) + 'R'
        : '—';

      const badges = [
        data.wins   ? `<span class="cal-badge cal-badge--w">${data.wins}W</span>`   : '',
        data.losses ? `<span class="cal-badge cal-badge--l">${data.losses}L</span>` : '',
        data.be     ? `<span class="cal-badge cal-badge--be">${data.be}BE</span>`   : '',
        data.open   ? `<span class="cal-badge cal-badge--o">${data.open} open</span>` : '',
      ].filter(Boolean).join('');

      const tradeLabel = data.trades.length > 1 ? t('ui.trades') : t('ui.trade');
      const isSel = calSelectedDate === ds;
      return `<div class="cal-sum-row${isSel ? ' cal-sum-row--sel' : ''}" data-date="${ds}">
        <span class="cal-sum-date">${label}</span>
        <span class="cal-sum-count">${data.trades.length} ${tradeLabel}</span>
        <span class="cal-sum-badges">${badges}</span>
        <span class="cal-sum-rr">${avgRR}</span>
        <span class="cal-sum-pnl" style="color:${pc}">${pnlStr}</span>
      </div>`;
    }).join('');

    const dayLabel = tradingDays.length > 1 ? t('ui.days') : t('ui.day');
    return `
      <div class="cal-summary">
        <div class="cal-summary-header">
          <span class="cal-summary-title">${t('cal.recap')}</span>
          <div class="cal-summary-meta">
            <span>${tradingDays.length} ${dayLabel} · ${monthTotal} ${monthTotal > 1 ? t('ui.trades') : t('ui.trade')} · ${monthWins}W ${monthLoss}L</span>
            <span style="font-family:'Geist Mono',monospace;font-weight:700;font-size:14px;color:${pnlColor}">${fmtSigned(monthPnL)}</span>
          </div>
        </div>
        <div class="cal-sum-head">
          <span>${t('cal.col.date')}</span><span>${t('cal.col.trades')}</span><span>${t('cal.col.result')}</span><span>${t('cal.col.rr')}</span><span style="text-align:right">${t('cal.col.pnl')}</span>
        </div>
        ${rows}
      </div>`;
  }

  function buildDetail(byDate) {
    if (!calSelectedDate || !byDate[calSelectedDate]) return '';
    const data     = byDate[calSelectedDate];
    const [y, m, day] = calSelectedDate.split('-').map(Number);
    const dateLabel = new Date(y, m - 1, day).toLocaleDateString(i18n.locale(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const pc = data.pnl >= 0 ? 'var(--green)' : 'var(--red)';

    const tradeRows = data.trades.map(tr => {
      const c      = Calc.trade(tr);
      const pnlTxt = fmtSigned(c.netPnl || 0, c.estimated);
      const safeOutcome = ['win','loss','be','open'].includes(tr.outcome) ? tr.outcome : 'open';
      return `<div class="cdt-row">
        <span class="ob ob-${safeOutcome} ob-sm">${i18n.t('ob.' + safeOutcome)}</span>
        <span class="cdt-inst">${UI.escHtml(tr.instrument)} ${tr.direction === 'long' ? 'long' : 'short'}</span>
        <span class="cdt-setup">${UI.escHtml(tr.setup || '—')}</span>
        <span class="cdt-pnl-val" style="color:${(c.netPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${pnlTxt}</span>
        <span class="cdt-rr">R:R ${c.rr.toFixed(2)}</span>
      </div>`;
    }).join('');

    const tradeLabel = data.trades.length > 1 ? t('ui.trades') : t('ui.trade');
    return `
      <div class="cal-day-trades">
        <div class="cdt-header">
          <span class="cdt-date">${dateLabel}</span>
          <span class="cdt-pnl" style="color:${pc}">
            ${fmtSigned(data.pnl)} net · ${data.trades.length} ${tradeLabel}
          </span>
        </div>
        ${tradeRows}
      </div>`;
  }

  UI.renderCalendar = function () {
    const el = $('calContent');
    if (!el) return;

    const today  = localToday();
    const trades = Store.getTrades();
    const byDate = buildByDate(trades);
    const months = getMonths();
    const days   = getDays();

    el.innerHTML = `
      <div class="page-title">${t('page.calendar')}</div>

      <div class="cal-nav-row">
        <button class="cal-nav-btn" id="calPrev" aria-label="Mois précédent">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="cal-month-label">${months[calMonth]} ${calYear}</div>
        <button class="cal-nav-btn cal-today-btn" id="calToday" title="Revenir au mois courant">${i18n.t('cal.today') || 'Aujourd\'hui'}</button>
        <button class="cal-nav-btn" id="calNext" aria-label="Mois suivant">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <div class="cal-grid">
        ${days.map((h, i) =>
          `<div class="cal-head ${i >= 5 ? 'cal-head--we' : ''}">${h}</div>`).join('')}
        ${buildGrid(byDate, today)}
      </div>

      ${buildDetail(byDate)}
      ${buildSummary(byDate)}
    `;

    $('calPrev').addEventListener('click', () => {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      calSelectedDate = null;
      UI.renderCalendar();
    });
    $('calNext').addEventListener('click', () => {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      calSelectedDate = null;
      UI.renderCalendar();
    });
    // U20 : bouton "Aujourd'hui" pour revenir au mois courant en 1 clic
    const todayBtn = $('calToday');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        const now = new Date();
        calMonth = now.getMonth();
        calYear  = now.getFullYear();
        calSelectedDate = null;
        UI.renderCalendar();
      });
    }

    el.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        calSelectedDate = calSelectedDate === cell.dataset.date ? null : cell.dataset.date;
        UI.renderCalendar();
      });
    });

    el.querySelectorAll('.cal-sum-row').forEach(row => {
      row.addEventListener('click', () => {
        calSelectedDate = calSelectedDate === row.dataset.date ? null : row.dataset.date;
        UI.renderCalendar();
      });
    });
  };
})();
