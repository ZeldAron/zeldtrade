// ─── GOALS & REWARDS ──────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = (k, v) => i18n.t(k, v);

  function goalBar(label, current, max, color) {
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const col = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : color;
    return `<div class="goal-progress">
      <div class="gp-header">
        <span class="gp-label">${label}</span>
        <span class="gp-value" style="color:${col}">$${current.toFixed(0)} / $${max}</span>
      </div>
      <div class="gp-track"><div class="gp-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`;
  }

  function goalRuleRow(label, value, state) {
    // v0.9.358 (fix B-11) : état « breach » = badge rouge bien visible (une violation
    // de daily loss / drawdown sur prop firm est critique, pas un simple ✗ discret).
    const cls = state === 'ok' ? 'grr-ok' : state === 'breach' ? 'grr-breach' : state === 'warn' ? 'grr-warn' : 'grr-pending';
    return `<div class="goal-rule-row">
      <span class="grr-label">${label}</span>
      <span class="grr-val ${cls}">${value}</span>
    </div>`;
  }

  function evalCard(acc, accTrades, today) {
    const s           = UI.statsForTrades(accTrades);
    const adjustedPnL = s.totalPnL + (acc.pnlOffset || 0);
    const ddUsed      = Math.abs(Math.min(0, adjustedPnL));
    const profit      = Math.max(0, adjustedPnL);

    const todayLoss = accTrades
      .filter(tr => UI.localDay(tr.date) === today && tr.outcome === 'loss')
      .reduce((sum, tr) => sum + Math.abs(Calc.trade(tr).netPnl || 0), 0);

    const days   = new Set(accTrades.map(tr => UI.localDay(tr.date))).size;
    const minDays = 5;

    const byDay = Object.create(null);
    accTrades.forEach(tr => {
      const d = UI.localDay(tr.date);
      byDay[d] = (byDay[d] || 0) + (Calc.trade(tr).netPnl || 0);
    });
    const bestDay = Math.max(0, ...Object.values(byDay), 0);
    const maxDay  = profit > 0 ? profit * 0.30 : 0;
    const consOk  = maxDay === 0 || bestDay <= maxDay;

    const ddOk      = !acc.maxDrawdown    || ddUsed   <  acc.maxDrawdown;
    const dailyOk   = !acc.dailyLossLimit || todayLoss < acc.dailyLossLimit;
    const targetMet = acc.profitTarget    && profit   >= acc.profitTarget;
    const daysOk    = days >= minDays;
    // v0.9.367 : le PASSAGE de l'éval = profit target + jours min + aucun breach drawdown/daily.
    // La consistance (consOk) est une règle de PAYOUT du compte financé, PAS une condition de
    // passage de l'éval (et le seuil 30% codé en dur est faux selon les firms) → ne bloque plus
    // le bouton « Passer en financé ». Elle reste affichée en info dans la carte.
    const allOk     = targetMet && ddOk && dailyOk && daysOk;

    const statusHtml = allOk
      ? `<div class="goal-status goal-status--pass">${t('goals.pass')}</div>
         <button class="goal-convert-btn" data-convert-eval="${acc.id}">${t('goals.convert.cta') || '🎉 Passer en compte financé →'}</button>`
      : targetMet
        ? `<div class="goal-status goal-status--almost">${t('goals.almost')}</div>`
        : `<div class="goal-status goal-status--eval">${t('goals.eval.status')}</div>`;

    const daysLabel  = days > 1 ? t('ui.days') : t('ui.day');
    const mDaysLabel = minDays > 1 ? t('ui.days') : t('ui.day');

    return `<div class="goal-card">
      <div class="goal-card-header">
        <div><span class="goal-badge goal-badge--eval">EVAL</span><span class="goal-card-name">${UI.escHtml(acc.name)}</span></div>
        <span class="goal-pnl" style="color:${adjustedPnL>=0?'var(--green)':'var(--red)'}">${adjustedPnL>=0?'+':'-'}$${Math.abs(adjustedPnL).toFixed(0)}</span>
      </div>
      <div class="goal-rules">
        ${acc.profitTarget   ? goalBar(t('goals.profit.target'),   profit,    acc.profitTarget,   'var(--green)') : ''}
        ${acc.maxDrawdown    ? goalBar(t('goals.drawdown.used'),   ddUsed,    acc.maxDrawdown,    'var(--amber)') : ''}
        ${acc.dailyLossLimit ? goalBar(t('goals.daily.loss'),      todayLoss, acc.dailyLossLimit, 'var(--red)')   : ''}
      </div>
      <div class="goal-rules">
        ${goalRuleRow(t('goals.days.min'), `${days} / ${minDays} ${t('ui.days')}`, daysOk ? 'ok' : 'pending')}
        ${maxDay > 0 ? goalRuleRow(t('goals.consistency'), `+$${bestDay.toFixed(0)} best`, consOk ? 'ok' : 'warn') : ''}
        ${goalRuleRow(t('goals.drawdown.ok'), ddOk ? '✓ OK' : `⚠ ${t('goals.breach')} -$${ddUsed.toFixed(0)}`, ddOk ? 'ok' : 'breach')}
        ${goalRuleRow(t('goals.daily.ok'),   dailyOk ? '✓ OK' : `⚠ ${t('goals.breach')} -$${todayLoss.toFixed(0)}`, dailyOk ? 'ok' : 'breach')}
      </div>
      ${statusHtml}
    </div>`;
  }

  function fundedCard(acc, accTrades, today) {
    const s  = UI.statsForTrades(accTrades);
    const fl = Calc.trailingFloor(acc, accTrades);

    // v0.9.189 (Phase 1) : compte Personal/Crypto → carte simplifiée (pas de drawdown/safety)
    if (fl && fl.notApplicable) {
      const totalPnl = s.totalPnl || 0;
      const isProf = totalPnl >= 0;
      return `<div class="goal-card" style="position:relative">
        <div class="goal-card-header">
          <div class="goal-card-name">${UI.escHtml(acc.name)}</div>
          <span class="status-badge" style="background:rgba(124, 58, 237,0.15);color:var(--accent-l)">${acc.accountType === 'crypto' ? 'CRYPTO' : 'PERSONNEL'}</span>
        </div>
        <div class="goal-card-balance">
          <div class="gcb-label">Solde actuel</div>
          <div class="gcb-value" style="color:${isProf ? 'var(--green)' : 'var(--red)'}">${fl.balance >= 0 ? '+' : '−'}$${Math.abs(fl.balance).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</div>
          <div class="gcb-sub">Capital départ : $${(acc.capital || 0).toLocaleString('fr-FR')}</div>
        </div>
        <div style="padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-top:14px">
          <div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Mode libre</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">Pas de règles prop firm sur ce compte. Pas de drawdown imposé, pas de profit target, pas de daily loss limit. Trade librement avec ton propre capital.</div>
        </div>
      </div>`;
    }

    const { startBalance, currentBalance, hwm, floor, drawdown,
            safetyNet, safetyReached, distanceToFloor, drawdownUsedPct, profit } = fl;

    const safetyLeft = Math.max(0, safetyNet - profit);

    const floorColor = distanceToFloor <= drawdown * 0.25 ? 'var(--red)'
                     : distanceToFloor <= drawdown * 0.5  ? 'var(--amber)'
                     : 'var(--green)';

    const dayValues    = Object.values(fl.byDay);
    const bestDay      = Math.max(0, ...dayValues, 0);
    const consistScore = profit > 0 ? (bestDay / profit) * 100 : 0;
    const consistOk    = profit <= 0 || consistScore <= 50;
    const consistBarW  = Math.min(100, consistScore * 2);
    const consistCol   = consistScore > 50 ? 'var(--red)' : consistScore > 40 ? 'var(--amber)' : 'var(--green)';
    const consistBar   = profit > 0
      ? `<div class="goal-progress">
           <div class="gp-header">
             <span class="gp-label">${t('goals.best.day.ratio')}</span>
             <span class="gp-value" style="color:${consistCol}">${consistScore.toFixed(0)}% ${consistOk ? '✓' : '✗'}</span>
           </div>
           <div class="gp-track" style="position:relative">
             <div class="gp-fill" style="width:${consistBarW}%;background:${consistCol}"></div>
             <div style="position:absolute;top:0;left:50%;width:1px;height:100%;background:rgba(255,255,255,0.2)"></div>
           </div>
           <div style="font-size:10px;color:var(--muted);margin-top:4px">${t('goals.best.day.detail', { best: bestDay.toFixed(0), total: profit.toFixed(0) })}</div>
         </div>`
      : `<div style="font-size:11px;color:var(--muted);padding:6px 0">${t('goals.no.profit.data')}</div>`;

    const month       = today.slice(0, 7);
    const monthTrades = accTrades.filter(tr => (UI.localDay(tr.date) || '').startsWith(month));
    const monthStats  = UI.statsForTrades(monthTrades);
    const monthDays   = new Set(monthTrades.map(tr => UI.localDay(tr.date))).size;
    const monthlyGoal = acc.profitTarget ? Math.round(acc.profitTarget * 0.5) : 0;

    const todayLoss = accTrades
      .filter(tr => UI.localDay(tr.date) === today)
      .reduce((sum, tr) => {
        const c = Calc.trade(tr);
        return c.netPnl < 0 ? sum + Math.abs(c.netPnl) : sum;
      }, 0);

    const totalDays   = new Set(accTrades.map(tr => UI.localDay(tr.date))).size;
    const payoutReady = totalDays >= 5 && profit > 0 && safetyReached;
    const dailyOk     = !acc.dailyLossLimit || todayLoss < acc.dailyLossLimit;

    const ddBarW   = Math.min(100, drawdownUsedPct);
    const ddBarCol = drawdownUsedPct >= 75 ? 'var(--red)' : drawdownUsedPct >= 50 ? 'var(--amber)' : 'var(--green)';
    const monthDayLabel = monthDays > 1 ? t('ui.days') : t('ui.day');

    return `<div class="goal-card">
      <div class="goal-card-header">
        <div><span class="goal-badge goal-badge--funded">PA</span><span class="goal-card-name">${UI.escHtml(acc.name)}</span></div>
        <span class="goal-pnl" style="color:${(currentBalance-startBalance)>=0?'var(--green)':'var(--red)'}">${(currentBalance-startBalance)>=0?'+':'-'}$${Math.abs(currentBalance-startBalance).toFixed(0)}</span>
      </div>

      <div class="floor-panel ${safetyReached ? 'floor-panel--safe' : ''}">
        <div class="floor-panel-top">
          <div class="floor-main">
            <span class="floor-label">${t('goals.floor.current')}</span>
            <span class="floor-value" style="color:${floorColor}">$${floor.toLocaleString('fr-FR')}</span>
          </div>
          <div class="floor-balance">
            <span class="floor-label">${t('goals.hwm')}</span>
            <span class="floor-hwm">$${hwm.toLocaleString('fr-FR')}</span>
          </div>
        </div>
        <div class="floor-margin-row">
          <span style="font-size:11px;color:var(--muted)">${t('goals.floor.margin')}</span>
          <span style="font-size:13px;font-weight:700;color:${floorColor}">$${Math.max(0, distanceToFloor).toLocaleString('fr-FR')}</span>
        </div>
        <div class="gp-track" style="margin-top:6px;position:relative">
          <div class="gp-fill" style="width:${ddBarW}%;background:${ddBarCol}"></div>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px;display:flex;justify-content:space-between">
          <span>${t('goals.drawdown.label')} : $${Math.max(0, fl.drawdownConsumed).toFixed(0)} / $${drawdown}</span>
          <span>${t('goals.start.capital')} : $${startBalance.toLocaleString('fr-FR')}</span>
        </div>
        ${safetyReached
          ? `<div class="floor-safe-badge">${t('goals.safety.locked', { amt: startBalance.toLocaleString('fr-FR') })}</div>`
          : `<div style="font-size:10px;color:var(--muted);margin-top:6px">${t('goals.safety.progress', { amt: safetyLeft.toFixed(0) })}</div>`
        }
      </div>

      <div class="goal-section-label">${t('goals.safety.priority')} ($${safetyNet.toLocaleString('fr-FR')})</div>
      <div class="goal-rules">
        ${goalBar(t('goals.profit.target'), profit, safetyNet, 'var(--green)')}
      </div>
      ${safetyReached
        ? `<div class="goal-status goal-status--pass" style="margin-bottom:16px">${t('goals.safety.reached')}</div>`
        : `<div class="goal-info-row">${t('goals.safety.left', { left: safetyLeft.toFixed(0), floor: startBalance.toLocaleString('fr-FR') })}</div>`
      }

      <div class="goal-section-label">${t('goals.consistency.score')}</div>
      <div class="goal-rules">${consistBar}</div>
      <div class="goal-rules">
        ${goalRuleRow(t('goals.rule.50'), consistOk
          ? t('goals.rule.50.ok', { pct: consistScore.toFixed(0) })
          : t('goals.rule.50.fail', { pct: consistScore.toFixed(0) }),
          consistOk ? 'ok' : 'warn')}
      </div>

      <div class="goal-section-label">${t('goals.this.month')} ${month}</div>
      <div class="goal-rules">
        ${monthlyGoal ? goalBar(t('goals.monthly.target'), Math.max(0, monthStats.totalPnL), monthlyGoal, 'var(--green)') : ''}
        ${acc.dailyLossLimit ? goalBar(t('goals.daily.loss'), todayLoss, acc.dailyLossLimit, 'var(--red)') : ''}
      </div>
      <div class="goal-rules">
        ${goalRuleRow(t('goals.days.traded.month'), `${monthDays} ${monthDayLabel}`, monthDays > 0 ? 'ok' : 'pending')}
        ${goalRuleRow(t('goals.month.pnl'), monthStats.totalPnL >= 0 ? `+$${monthStats.totalPnL.toFixed(0)}` : `-$${Math.abs(monthStats.totalPnL).toFixed(0)}`, monthStats.totalPnL >= 0 ? 'ok' : 'warn')}
      </div>

      <div class="goal-section-label">${t('goals.protection')}</div>
      <div class="goal-rules">
        ${goalRuleRow(t('goals.daily.limit.ok'), dailyOk ? '✓ OK' : `⚠ ${t('goals.breach')} -$${todayLoss.toFixed(0)}`, dailyOk ? 'ok' : 'breach')}
        ${goalRuleRow(t('goals.payout'), payoutReady ? '✓' : `${totalDays}/5 ${t('ui.days')} · Safety Net ${safetyReached ? '✓' : '✗'}`, payoutReady ? 'ok' : 'pending')}
      </div>
      ${payoutReady ? `<div class="goal-status goal-status--pass">${t('goals.payout.eligible')}</div>` : ''}
    </div>`;
  }

  function achievementsCard(trades) {
    const closed = trades.filter(tr => tr.outcome === 'win' || tr.outcome === 'loss');
    const s      = UI.statsForTrades(trades);

    let maxConsec = 0, consec = 0;
    [...trades].reverse().forEach(tr => {
      if (tr.outcome === 'win')       { consec++; maxConsec = Math.max(maxConsec, consec); }
      else if (tr.outcome === 'loss') { consec = 0; }
    });

    const badges = [
      { icon:Icons.svg('target',26),     label:t('ach.first.label'),       desc:t('ach.first.desc'),       done: trades.length >= 1 },
      { icon:Icons.svg('barChart',26),   label:t('ach.5.label'),            desc:t('ach.5.desc'),            done: trades.length >= 5 },
      { icon:Icons.svg('trendingUp',26), label:t('ach.10.label'),           desc:t('ach.10.desc'),           done: trades.length >= 10 },
      { icon:Icons.svg('dollar',26),     label:t('ach.profitable.label'),   desc:t('ach.profitable.desc'),   done: s.totalPnL > 0 },
      { icon:Icons.svg('zap',26),        label:t('ach.rr1.label'),          desc:t('ach.rr1.desc'),          done: s.avgRR >= 1.5 },
      { icon:Icons.svg('rocket',26),     label:t('ach.rr2.label'),          desc:t('ach.rr2.desc'),          done: s.avgRR >= 2.0 },
      { icon:Icons.svg('medal',26),      label:t('ach.wr60.label'),         desc:t('ach.wr60.desc'),         done: closed.length >= 10 && (s.winRate || 0) >= 60 },
      { icon:Icons.svg('star',26),       label:t('ach.wr70.label'),         desc:t('ach.wr70.desc'),         done: closed.length >= 10 && (s.winRate || 0) >= 70 },
      { icon:Icons.svg('flame',26),      label:t('ach.streak3.label'),      desc:t('ach.streak3.desc'),      done: maxConsec >= 3 },
      { icon:Icons.svg('flame',26),      label:t('ach.streak5.label'),      desc:t('ach.streak5.desc'),      done: maxConsec >= 5 },
      { icon:Icons.svg('shield',26),     label:t('ach.disciplined.label'),  desc:t('ach.disciplined.desc'),  done: trades.length >= 5 && trades.every(tr => tr.setup && tr.setup.trim()) },
      { icon:Icons.svg('calendar',26),   label:t('ach.week.label'),         desc:t('ach.week.desc'),         done: (() => { const days = new Set(trades.map(tr => UI.localDay(tr.date))); return days.size >= 5; })() },
    ];

    const done = badges.filter(b => b.done).length;
    return `<div class="goal-card">
      <div class="goal-card-header" style="margin-bottom:18px">
        <span style="font-size:14px;font-weight:700">${t('goals.achievements')}</span>
        <span style="font-size:12px;color:var(--muted)">${done} / ${badges.length} ${t('goals.obtained')}</span>
      </div>
      <div class="achievements-grid">
        ${badges.map(b => `
          <div class="achievement-badge ${b.done ? 'ach-done' : 'ach-locked'}">
            <div class="ach-icon">${b.icon}</div>
            <div class="ach-label">${b.label}</div>
            <div class="ach-desc">${b.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  UI.renderGoals = function () {
    const el     = $('goalsContent');
    const accs   = Store.getMyAccounts();
    const trades = Store.getTrades();
    const today  = UI.localToday();

    if (!accs.length) {
      el.innerHTML = `<div class="page-title">${t('page.goals')}</div>
        <div class="goal-card" style="text-align:center;padding:48px 24px">
          <div style="margin-bottom:12px;color:var(--muted2)">${Icons.svg('target',40)}</div>
          <p style="color:var(--muted);margin-bottom:4px">${t('goals.no.accounts')}</p>
          <p style="font-size:12px;color:var(--muted2)">${t('goals.no.accounts.hint')}</p>
        </div>`;
      return;
    }

    // v0.9.231 : empty state si comptes mais 0 trade — évite l'affichage de
    // cartes à 0% qui faisaient croire que les comptes étaient "déjà bustés".
    if (!trades.length) {
      el.innerHTML = `<div class="page-title">${t('page.goals')}</div>
        <div class="goal-card" style="text-align:center;padding:48px 24px">
          <div style="margin-bottom:12px;color:var(--muted2)">${Icons.svg('barChart',40)}</div>
          <p style="color:var(--text);font-size:15px;margin-bottom:6px"><strong>${t('goals.no.trades') || 'Aucun trade enregistré pour le moment'}</strong></p>
          <p style="font-size:13px;color:var(--muted);margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">${t('goals.no.trades.hint') || 'Ajoute ton premier trade pour voir ta progression sur les objectifs prop firm (profit target, drawdown, days traded).'}</p>
          <button class="btn-primary" data-cta="newtrade">+ ${t('btn.newtrade') || 'Nouveau trade'}</button>
        </div>`;
      return;
    }

    const evalAccs   = accs.filter(a => a.status !== 'funded');
    const fundedAccs = accs.filter(a => a.status === 'funded');

    let html = `<div class="page-title">${t('page.goals')}</div>`;

    if (evalAccs.length) {
      html += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('goals.eval.accounts')}</span><span class="page-section-count">${evalAccs.length} compte${evalAccs.length > 1 ? 's' : ''}</span></div>`;
      html += `<div class="goals-grid">`;
      evalAccs.forEach(acc => {
        html += evalCard(acc, trades.filter(tr => tr.apex === acc.name), today);
      });
      html += `</div></div>`;
    }

    if (fundedAccs.length) {
      html += `<div class="page-section"><div class="page-section-hd"><span class="page-section-ttl">${t('goals.funded.accounts')}</span><span class="page-section-count">${fundedAccs.length} compte${fundedAccs.length > 1 ? 's' : ''}</span></div>`;
      html += `<div class="goals-grid">`;
      fundedAccs.forEach(acc => {
        html += fundedCard(acc, trades.filter(tr => tr.apex === acc.name), today);
      });
      html += `</div></div>`;
    }

    html += `<div class="page-section">` + achievementsCard(trades) + `</div>`;
    el.innerHTML = html;

    // v0.9.366 — passage éval → financé (bouton de confirmation)
    el.querySelectorAll('[data-convert-eval]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = btn.dataset.convertEval;
        const acc = Store.getMyAccountById(id);
        if (!acc) return;
        const ok = await UI.confirmModal({
          title:       t('goals.convert.title') || 'Passer en compte financé',
          message:     (t('goals.convert.confirm') ||
            'Objectif validé ! « %a » sera archivé dans tes comptes passés, et un nouveau compte financé démarrera à 0 P&L avec les règles du compte financé. Continuer ?').replace('%a', acc.name),
          confirmText: t('goals.convert.ok') || 'Passer en financé',
        });
        if (!ok) return;
        try {
          const funded = Store.convertEvalToFunded(id);
          UI.toast((t('goals.convert.done') || '🎉 Compte financé créé : %a').replace('%a', funded.name));
          UI.renderGoals();
        } catch (e) {
          UI.toast((e && e.message) || 'Échec du passage en financé.', true);
        }
      });
    });
  };
})();
