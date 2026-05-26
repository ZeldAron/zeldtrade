// ─── ANALYTICS ────────────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = k => i18n.t(k);

  // Sessions UTC
  // Asia    : 00:00–07:00 UTC
  // London  : 07:00–13:30 UTC
  // New York: 13:30–20:15 UTC
  // Other   : 20:15–24:00 UTC
  const SESSIONS = [
    { key: 'asia',   label: () => t('analytics.session.asia'),   color: '#0a84ff', from:    0, to:  420 },
    { key: 'london', label: () => t('analytics.session.london'), color: '#bf5af2', from:  420, to:  810 },
    { key: 'ny',     label: () => t('analytics.session.ny'),     color: '#30d158', from:  810, to: 1215 },
    { key: 'other',  label: () => t('analytics.session.other'),  color: '#636366', from: 1215, to: 1440 },
  ];

  function getSession(dateStr) {
    if (!dateStr || !dateStr.includes('T')) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
    return SESSIONS.find(s => mins >= s.from && mins < s.to)?.key || 'other';
  }

  function getUTCHour(dateStr) {
    if (!dateStr || !dateStr.includes('T')) return null;
    const d = new Date(dateStr);
    return isNaN(d) ? null : d.getUTCHours();
  }

  function goOffers() {
    document.querySelector('[data-page="offers"]').click();
  }

  function featureLockSection(title, count, subtitle) {
    const isEn = i18n.getLang() === 'en';
    return `<div class="page-section">
      <div class="page-section-hd">
        <span class="page-section-ttl">${title}</span>
        <span class="plan-badge plan-pro" style="margin-left:8px">Funded+</span>
        ${count ? `<span class="page-section-count" style="margin-left:auto">${count}</span>` : ''}
      </div>
      <div class="feature-lock-wrap">
        <div class="feature-lock-placeholder">
          <div class="feature-lock-placeholder-inner">
            <div class="feature-lock-placeholder-bar"></div>
            <div class="feature-lock-placeholder-bar" style="height:90px"></div>
            <div class="feature-lock-placeholder-bar" style="height:50px"></div>
            <div class="feature-lock-placeholder-bar" style="height:75px"></div>
            <div class="feature-lock-placeholder-bar" style="height:40px"></div>
            <div class="feature-lock-placeholder-bar" style="height:110px"></div>
            <div class="feature-lock-placeholder-bar" style="height:65px"></div>
            <div class="feature-lock-placeholder-bar" style="height:85px"></div>
          </div>
        </div>
        <div class="feature-lock-overlay">
          <div class="feature-lock-icon">${Icons.svg('lock',30)}</div>
          <div class="feature-lock-title">${isEn ? 'Funded / Elite feature' : 'Fonctionnalité Funded / Elite'}</div>
          <div class="feature-lock-sub">${subtitle}</div>
          <button class="feature-lock-cta" id="lockCta_${Math.random().toString(36).slice(2,7)}">${isEn ? 'See plans →' : 'Voir les offres →'}</button>
        </div>
      </div>
    </div>`;
  }

  UI.renderAnalytics = function () {
    const el    = $('analyticsContent');
    const all   = Store.getTrades();
    const isPro = Store.isPro();

    if (!all.length) {
      // v0.9.181 : empty state propre (au lieu d'un simple paragraphe gris)
      el.innerHTML = `
        <div class="page-title">${t('page.analytics')}</div>
        <div class="dash-empty">
          <div class="dash-empty-icon">${Icons.svg('lineChart',44)}</div>
          <h2 class="dash-empty-title">${t('analytics.empty.title') || 'Pas encore de stats'}</h2>
          <p class="dash-empty-text">${t('analytics.empty.text') || 'Enregistre quelques trades et reviens — tu verras ici win rate, R:R, breakdown par setup/instrument, performance par session, etc.'}</p>
          <a class="dash-empty-cta" href="#" data-cta="newtrade">+ ${t('btn.newtrade') || 'Nouveau trade'}</a>
        </div>`;
      return;
    }

    // ── Setup + Instrument ──────────────────────────────────────────────────
    const setups = Object.create(null);
    const instrs = Object.create(null);

    all.forEach(tr => {
      const c      = Calc.trade(tr);
      const netPnl = c.netPnl !== null ? c.netPnl : 0;

      // v0.9.358 (fix B-07) : les trades sans setup ne sont plus ignorés en silence,
      // ils sont regroupés sous une ligne « (Aucun setup) » pour ne pas fausser le total.
      const setupKey = tr.setup ? tr.setup : '__nosetup__';
      if (!setups[setupKey]) setups[setupKey] = { wins:0, total:0, pnl:0 };
      setups[setupKey].total++;
      if (tr.outcome === 'win') setups[setupKey].wins++;
      setups[setupKey].pnl += netPnl;

      if (!instrs[tr.instrument]) instrs[tr.instrument] = { wins:0, total:0, pnl:0 };
      instrs[tr.instrument].total++;
      if (tr.outcome === 'win') instrs[tr.instrument].wins++;
      instrs[tr.instrument].pnl += netPnl;
    });

    const setupRows = Object.entries(setups)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => {
        const wr = v.total ? v.wins / v.total * 100 : 0;
        const nameCell = name === '__nosetup__'
          ? `<span style="color:var(--muted);font-style:italic">${t('analytics.setup.none') || '(Aucun setup)'}</span>`
          : UI.escHtml(name);
        return `<tr>
          <td>${nameCell}</td>
          <td>${v.total}</td>
          <td>
            <div class="wr-bar-wrap">
              <div class="wr-bar-bg">
                <div class="wr-bar-fill" style="width:${wr}%;background:${wr >= 50 ? 'var(--green)' : 'var(--red)'}"></div>
              </div>
              <span style="font-size:11px;font-family:'Geist Mono';color:${wr >= 50 ? 'var(--green)' : 'var(--red)'};width:32px;text-align:right">${wr.toFixed(0)}%</span>
            </div>
          </td>
          <td style="font-family:'Geist Mono';color:${v.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${Calc.formatPnL(v.pnl)}</td>
        </tr>`;
      }).join('');

    const instrRows = Object.entries(instrs)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => {
        const wr = v.total ? v.wins / v.total * 100 : 0;
        return `<tr>
          <td>${UI.escHtml(name)}</td>
          <td>${v.total}</td>
          <td>
            <div class="wr-bar-wrap">
              <div class="wr-bar-bg">
                <div class="wr-bar-fill" style="width:${wr}%;background:${wr >= 50 ? 'var(--green)' : 'var(--red)'}"></div>
              </div>
              <span style="font-size:11px;font-family:'Geist Mono';color:${wr >= 50 ? 'var(--green)' : 'var(--red)'};width:32px;text-align:right">${wr.toFixed(0)}%</span>
            </div>
          </td>
          <td style="font-family:'Geist Mono';color:${v.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${Calc.formatPnL(v.pnl)}</td>
        </tr>`;
      }).join('');

    // ── Sessions ─────────────────────────────────────────────────────────────
    const sessData = {};
    SESSIONS.forEach(s => { sessData[s.key] = { wins:0, losses:0, total:0, pnl:0, rr:0 }; });

    const timedTrades = all.filter(tr => tr.date && tr.date.includes('T'));
    timedTrades.forEach(tr => {
      const sk = getSession(tr.date);
      if (!sk || !sessData[sk]) return;
      const c = Calc.trade(tr);
      sessData[sk].total++;
      if (tr.outcome === 'win')  sessData[sk].wins++;
      if (tr.outcome === 'loss') sessData[sk].losses++;
      sessData[sk].pnl += c.netPnl !== null ? c.netPnl : 0;
      sessData[sk].rr  += c.rr;
    });

    const bestSession = timedTrades.length
      ? SESSIONS.slice().sort((a, b) => {
          const wa = sessData[a.key].total ? sessData[a.key].wins / sessData[a.key].total : 0;
          const wb = sessData[b.key].total ? sessData[b.key].wins / sessData[b.key].total : 0;
          return wb - wa;
        })[0]
      : null;

    const sessHtml = timedTrades.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:4px">
        ${SESSIONS.map(s => {
          const d   = sessData[s.key];
          const wr  = d.total ? d.wins / d.total * 100 : 0;
          const avr = d.total ? d.rr / d.total : 0;
          const isBest = bestSession?.key === s.key && d.total > 0;
          return `
            <div style="background:var(--surface2);border:1px solid ${isBest ? s.color : 'var(--border)'};border-radius:10px;padding:14px;position:relative;${isBest ? 'box-shadow:0 0 0 1px ' + s.color + '22' : ''}">
              ${isBest ? `<div style="position:absolute;top:8px;right:10px;font-size:9px;font-weight:700;color:${s.color};letter-spacing:0.08em;text-transform:uppercase">Meilleure</div>` : ''}
              <div style="font-size:15px;margin-bottom:8px">${s.label()}</div>
              ${d.total === 0
                ? `<div style="color:var(--muted);font-size:11px">${t('analytics.notrades') || 'Aucun trade'}</div>`
                : `<div style="font-size:22px;font-weight:700;font-family:'Geist Mono';color:${wr >= 50 ? 'var(--green)' : 'var(--red)'}">${wr.toFixed(0)}%</div>
                   <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${d.total} trade${d.total > 1 ? 's' : ''} · ${d.wins}W ${d.losses}L</div>
                   <div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:8px;overflow:hidden">
                     <div style="height:100%;width:${wr}%;background:${s.color};border-radius:2px;transition:width .4s"></div>
                   </div>
                   <div style="display:flex;justify-content:space-between;font-size:11px;font-family:'Geist Mono'">
                     <span style="color:var(--muted)">${t('analytics.col.avgrr')}</span>
                     <span style="color:${avr >= 1.5 ? 'var(--green)' : avr >= 1 ? 'var(--amber)' : 'var(--red)'}">${avr.toFixed(2)}R</span>
                   </div>
                   <div style="display:flex;justify-content:space-between;font-size:11px;font-family:'Geist Mono';margin-top:4px">
                     <span style="color:var(--muted)">PnL</span>
                     <span style="color:${d.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${Calc.formatPnL(d.pnl)}</span>
                   </div>`
              }
            </div>`;
        }).join('')}
      </div>` : `<p style="color:var(--muted);font-size:12px;margin-top:8px">${t('analytics.sessions.empty')}</p>`;

    // ── Perf par heure (UTC) ───────────────────────────────────────────────
    const hourData = {};
    timedTrades.forEach(tr => {
      const h = getUTCHour(tr.date);
      if (h === null) return;
      if (!hourData[h]) hourData[h] = { wins:0, total:0, pnl:0 };
      hourData[h].total++;
      if (tr.outcome === 'win') hourData[h].wins++;
      const c = Calc.trade(tr);
      hourData[h].pnl += c.netPnl !== null ? c.netPnl : 0;
    });

    const activeHours = Object.keys(hourData).map(Number).sort((a, b) => a - b);
    const maxHourTotal = activeHours.length ? Math.max(...activeHours.map(h => hourData[h].total)) : 1;

    const hoursHtml = activeHours.length ? `
      <div style="margin-top:4px;overflow-x:auto">
        <div style="display:flex;align-items:flex-end;gap:6px;min-width:max-content;padding-bottom:4px">
          ${activeHours.map(h => {
            const d   = hourData[h];
            const wr  = d.total ? d.wins / d.total * 100 : 0;
            const bar = Math.round((d.total / maxHourTotal) * 64);
            const sess = SESSIONS.find(s => { const m = h * 60; return m >= s.from && m < s.to; });
            const col  = sess ? sess.color : '#636366';
            return `
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:9px;font-family:'Geist Mono';color:${wr >= 50 ? 'var(--green)' : 'var(--red)'}">${wr.toFixed(0)}%</div>
                <div style="width:28px;height:${bar}px;background:${col};border-radius:4px 4px 0 0;opacity:0.85;min-height:4px"></div>
                <div style="font-size:9px;color:var(--muted);font-family:'Geist Mono'">${String(h).padStart(2,'0')}h</div>
                <div style="font-size:8px;color:var(--muted2)">${d.total}t</div>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap">
          ${SESSIONS.map(s => `<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)"><span style="width:8px;height:8px;border-radius:2px;background:${s.color};display:inline-block"></span>${s.label()}</span>`).join('')}
        </div>
      </div>` : `<p style="color:var(--muted);font-size:12px;margin-top:8px">${t('analytics.sessions.empty')}</p>`;

    // ── Render ────────────────────────────────────────────────────────────
    el.innerHTML = `
      <div class="page-title">${t('page.analytics')}</div>

      <div class="page-section">
        <div class="page-section-hd">
          <span class="page-section-ttl">${t('analytics.setup.perf')}</span>
          <span class="page-section-count">${Object.keys(setups).length} setup${Object.keys(setups).length > 1 ? 's' : ''}</span>
        </div>
        <div class="two-col">
          <div class="chart-card">
            ${setupRows
              ? `<table class="a-table"><thead><tr><th>${t('analytics.col.setup')}</th><th>${t('analytics.col.total')}</th><th>${t('analytics.col.wr')}</th><th>${t('analytics.col.pnl')}</th></tr></thead><tbody>${setupRows}</tbody></table>`
              : `<p style="color:var(--muted);font-size:12px">${t('analytics.no.setup')}</p>`}
          </div>
          <div class="chart-card">
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">${t('analytics.by.instrument')}</div>
            <table class="a-table">
              <thead><tr><th>${t('analytics.col.instr')}</th><th>${t('analytics.col.total')}</th><th>${t('analytics.col.wr')}</th><th>${t('analytics.col.pnl')}</th></tr></thead>
              <tbody>${instrRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      ${isPro
        ? `<div class="page-section">
            <div class="page-section-hd">
              <span class="page-section-ttl">${t('analytics.sessions.title')}</span>
              ${timedTrades.length ? `<span class="page-section-count">${(t('analytics.timed') || '%n / %t chronométrés').replace('%n', timedTrades.length).replace('%t', all.length)}</span>` : ''}
            </div>
            <div class="chart-card">
              <div style="font-size:11px;color:var(--muted);margin-bottom:12px">${t('analytics.sessions.hint')}</div>
              ${sessHtml}
            </div>
          </div>

          <div class="page-section">
            <div class="page-section-hd">
              <span class="page-section-ttl">${t('analytics.hours.title')}</span>
            </div>
            <div class="chart-card">${hoursHtml}</div>
          </div>`
        : featureLockSection(
            t('analytics.sessions.title'),
            timedTrades.length ? `${timedTrades.length} / ${all.length}` : null,
            i18n.getLang() === 'en'
              ? 'Session & hourly breakdowns are available with the Funded / Elite plans.'
              : 'L\'analyse par session et par heure est disponible avec les plans Funded / Elite.'
          )
          + featureLockSection(
            t('analytics.hours.title'),
            null,
            i18n.getLang() === 'en'
              ? 'Hourly performance heatmap is a Funded / Elite feature.'
              : 'La heatmap de performance par heure est une fonctionnalité Funded / Elite.'
          )
      }`;
    // Bind lock CTA buttons
    el.querySelectorAll('.feature-lock-cta').forEach(btn => {
      btn.addEventListener('click', goOffers);
    });
  };
})();
