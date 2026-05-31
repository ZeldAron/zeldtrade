// ─── CALC ─────────────────────────────────────────────────────────────────────
// Calculs R:R, risk, reward, P&L brut/net pour un trade

const Calc = (() => {
  const POINT_VALUES = {
    // Futures CME
    MES1: 5, ES1: 50, MNQ1: 2, NQ1: 20,
    MYM1: 0.5, YM1: 5, M2K1: 5, RTY1: 50,
    MGC1: 10, GC1: 100, QO1: 50,  // QO1 délisté par CME en 2017 — gardé pour rétro-compat trades historiques uniquement
    MCL1: 100, CL1: 1000,
    ZN1: 1000,
    // v0.9.414 — instruments Lucid (specs CME officielles). $/point = tickValue / tickSize.
    NKD1: 5,                                   // Nikkei/USD
    SI1: 5000, SIL1: 500, PL1: 50, HG1: 25000, // métaux (Silver, µSilver, Platinum, Copper)
    QM1: 500, NG1: 10000, QG1: 2500,           // énergie (e-mini Crude, NatGas, e-mini NatGas)
    '6E1': 125000, '6B1': 62500, '6J1': 12500000, '6C1': 100000, '6A1': 100000, '6S1': 125000, '6N1': 100000,  // futures FX
    ZS1: 50, ZC1: 50, ZW1: 50, ZL1: 600, ZM1: 100, HE1: 400, LE1: 400,  // agricoles
    // v0.9.416 — instruments Topstep supplémentaires (specs CME). $/point = tickValue/tickSize.
    MHG1: 2500,                                  // µCopper
    M6E1: 12500, M6B1: 6250, M6A1: 10000, E71: 62500, '6M1': 1000000,  // µFX + e-mini EUR + Peso
    MNG1: 1000, RB1: 42000, HO1: 42000,          // µNatGas, RBOB, Heating Oil
    ZB1: 1000, ZF1: 1000, ZT1: 2000, UB1: 1000, TN1: 1000,  // taux/obligations
    // CFD Indices MT4/MT5 ($ par lot par point d'index — contract size 1 chez FTMO → $1/pt)
    US30: 1, US100: 1, US500: 1, GER40: 1, UK100: 1,   // v0.9.416 : US30 5→1 (contract size FTMO = 1)
    // Métaux CFD ($ par lot par $ de prix — XAUUSD : 100 oz/lot)
    XAUUSD: 100,
    // Forex ($ par lot par unité complète — EURUSD 100k$/lot, 1 pip=0.0001=$10/lot)
    EURUSD: 100000, GBPUSD: 100000, USDJPY: 650,
    // Énergie CFD (USOIL : 1000 barils/lot, $0.01 move = $10/lot)
    USOIL: 1000,
    // Crypto (v0.9.190) — multiplier = 1 (qty × delta = P&L direct en USDT/USD)
    BTCUSDT: 1, ETHUSDT: 1, SOLUSDT: 1, BNBUSDT: 1, XRPUSDT: 1,
    ADAUSDT: 1, AVAXUSDT: 1, DOGEUSDT: 1, LINKUSDT: 1, DOTUSDT: 1,
    'BTC-USD': 1, 'ETH-USD': 1, 'SOL-USD': 1, 'XRP-USD': 1, 'AVAX-USD': 1,
  };
  const TICK_SIZE = 0.25;   // fallback historique
  // v0.9.413 — taille du tick PAR instrument (le 0.25 global était faux pour GC/CL/YM/RTY/ZN…).
  // valeur du tick en $ = tickSize × pointValue (POINT_VALUES). Vérifié specs CME.
  const TICK_SIZES = {
    MES1: 0.25, ES1: 0.25, MNQ1: 0.25, NQ1: 0.25,
    MYM1: 1, YM1: 1, M2K1: 0.1, RTY1: 0.1,
    MGC1: 0.1, GC1: 0.1, QO1: 0.025,
    MCL1: 0.01, CL1: 0.01,
    ZN1: 0.015625,   // 1/64
    // v0.9.414 — instruments Lucid (specs CME). tickValue = tickSize × $/point (vérifié).
    NKD1: 5,
    SI1: 0.005, SIL1: 0.005, PL1: 0.1, HG1: 0.0005,
    QM1: 0.025, NG1: 0.001, QG1: 0.005,
    '6E1': 0.00005, '6B1': 0.0001, '6J1': 0.0000005, '6C1': 0.00005, '6A1': 0.0001, '6S1': 0.0001, '6N1': 0.0001,
    ZS1: 0.25, ZC1: 0.25, ZW1: 0.25, ZL1: 0.01, ZM1: 0.1, HE1: 0.025, LE1: 0.025,
    // v0.9.416 — instruments Topstep supplémentaires (specs CME)
    MHG1: 0.0005,
    M6E1: 0.0001, M6B1: 0.0001, M6A1: 0.0001, E71: 0.0001, '6M1': 0.00001,
    MNG1: 0.001, RB1: 0.0001, HO1: 0.0001,
    ZB1: 0.03125, ZF1: 0.0078125, ZT1: 0.00390625, UB1: 0.03125, TN1: 0.015625,
  };
  function tickSize(instrument) { return TICK_SIZES[instrument] != null ? TICK_SIZES[instrument] : TICK_SIZE; }
  // Valeur d'un tick en $ pour l'instrument (= tickSize × $/point).
  function tickValue(instrument) { return tickSize(instrument) * (POINT_VALUES[instrument] || 0); }

  const CFD_INSTRS = new Set(['US30','US100','US500','GER40','UK100','XAUUSD','EURUSD','GBPUSD','USDJPY','USOIL']);
  const CRYPTO_INSTRS = new Set([
    'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT',
    'BTC-USD','ETH-USD','SOL-USD','XRP-USD','AVAX-USD',
  ]);
  function isCFD(instrument)    { return CFD_INSTRS.has(instrument); }
  function isCrypto(instrument) { return CRYPTO_INSTRS.has(instrument); }

  // Règles Apex par taille de compte (EOD)
  const ACCOUNT_RULES = {
    25000:  { drawdown: 1250, safetyNet: 1350 },
    50000:  { drawdown: 2000, safetyNet: 2100 },
    100000: { drawdown: 3000, safetyNet: 3100 },
    150000: { drawdown: 4500, safetyNet: 4600 },
  };

  function pointValue(instrument) {
    return POINT_VALUES[instrument] || 5;
  }

  function trade(t) {
    const pv     = pointValue(t.instrument);
    const isLong = t.direction === 'long';

    // Garde-fou : si entry/sl/tp1 manquants ou invalides, retourner des zeros
    // (anti-NaN propagés dans les stats : un trade `open` créé sans entry doit
    // compter 0$ partout au lieu de pourrir totalPnL/winrate/equity).
    const ent  = (typeof t.entry === 'number' && isFinite(t.entry)) ? t.entry : null;
    const slP  = (typeof t.sl    === 'number' && isFinite(t.sl))    ? t.sl    : null;
    const tp1P = (typeof t.tp1   === 'number' && isFinite(t.tp1))   ? t.tp1   : null;
    if (ent == null || slP == null || tp1P == null) {
      return {
        riskPts: 0, rewardPts: 0, rr: 0,
        riskUSD: 0, rewardUSD: 0, netRewardUSD: 0, riskPct: 0,
        riskTicks: 0, rewardTicks: 0,
        pv, feePerSide: t.feePerSide != null ? t.feePerSide : 2.14,
        commFees: 0, spreadFees: 0, totalFees: 0,
        pnl: null, netPnl: null, estimated: false,
        hasPartial: false, partialPercent: null, partialPrice: null,
        apexOk: true, apexWarn: false,
        invalid: true,  // flag pour signaler un trade incomplet
      };
    }

    const riskPts   = isLong ? ent - slP : slP - ent;
    const rewardPts = isLong ? tp1P - ent : ent - tp1P;
    const rr        = riskPts > 0 ? rewardPts / riskPts : 0;

    const riskUSD   = riskPts   * pv * t.contracts;
    const rewardUSD = rewardPts * pv * t.contracts;
    const riskPct   = t.capital > 0 ? (riskUSD / t.capital) * 100 : 0;

    const _ts          = tickSize(t.instrument);
    const riskTicks   = isCFD(t.instrument) ? 0 : Math.round(riskPts   / _ts);
    const rewardTicks = isCFD(t.instrument) ? 0 : Math.round(rewardPts / _ts);

    // Commissions aller-retour (entry + exit)
    // v0.9.190 : pour crypto, fees = % du notional (qty × prix moyen × feeTakerPct% × 2 sides)
    const feePerSide = t.feePerSide != null ? t.feePerSide : 2.14;
    let commFees;
    if (isCrypto(t.instrument) && t.feeTakerPct != null && t.feeTakerPct > 0) {
      // Approximation : fee = avg_price × qty × feePct% × 2 (entry + exit, pessimiste taker)
      const avgPrice = tp1P ? (ent + tp1P) / 2 : ent;
      commFees = avgPrice * t.contracts * (t.feeTakerPct / 100) * 2;
    } else {
      commFees = feePerSide * t.contracts * 2;
    }

    // Spread bid/ask à l'entrée (négligeable sur crypto liquide)
    const spreadPerContract = t.spreadCost != null ? t.spreadCost : 0;
    const spreadFees        = spreadPerContract * t.contracts;

    const totalFees = commFees + spreadFees;

    // Reward net prévu (pour la planification avant clôture)
    const netRewardUSD = rewardUSD - totalFees;

    // P&L : manualPnl saisi par l'utilisateur > exitPrice explicite > outcome estimé > TP1 potentiel
    let pnl    = null;
    let netPnl = null;
    let estimated = false;
    // manualPnl ne s'applique QUE sur un trade fermé (sinon il fausse les stats
    // globales : un trade open ne doit pas compter dans le P&L réalisé)
    const hasManualPnl = t.manualPnl != null && t.manualPnl !== '' && !isNaN(Number(t.manualPnl)) && t.outcome !== 'open';

    // v0.9.250 : Sorties partielles multiples (scale-out). Deux formats supportés :
    //   1. NOUVEAU : t.partials = [{ price, lots }]  → N sorties, lots retirés
    //      au fur et à mesure, le runner restant sort à resolvedExit.
    //   2. LEGACY  : t.partialPercent + t.partialPrice → 1 sortie en %.
    //      Conservé pour les anciens trades (rétro-compat lecture).
    const cleanPartials = _normalizePartials(t.partials, t.contracts);
    const hasPartials = cleanPartials.length > 0;
    const hasLegacyPartial = !hasPartials
                    && t.partialPercent != null
                    && t.partialPrice   != null
                    && t.partialPercent > 0
                    && t.partialPercent < 100;

    // Détail par tranche (pour l'affichage : P&L de chaque sortie partielle)
    let partialBreakdown = null;

    if (hasManualPnl) {
      // L'utilisateur a saisi un P&L net : il prime sur tout calcul
      netPnl    = Number(t.manualPnl);
      pnl       = netPnl + totalFees; // brut reconstitué (info uniquement)
      estimated = false;
    } else {
      const resolvedExit = t.exitPrice != null ? t.exitPrice
        : t.outcome === 'win'  ? t.tp1
        : t.outcome === 'loss' ? t.sl
        : t.outcome === 'be'   ? t.entry
        : t.tp1;   // open : P&L potentiel si TP atteint
      if (resolvedExit != null && resolvedExit !== undefined) {
        if (hasPartials) {
          // Somme du P&L de chaque tranche partielle + runner restant.
          let gross    = 0;
          let lotsSold = 0;
          partialBreakdown = [];
          for (const p of cleanPartials) {
            const pts  = isLong ? p.price - t.entry : t.entry - p.price;
            const tPnl = pts * pv * p.lots;
            gross    += tPnl;
            lotsSold += p.lots;
            partialBreakdown.push({ price: p.price, lots: p.lots, pnl: tPnl });
          }
          const runnerLots = Math.max(0, +(t.contracts - lotsSold).toFixed(6));
          if (runnerLots > 0) {
            const pts  = isLong ? resolvedExit - t.entry : t.entry - resolvedExit;
            const rPnl = pts * pv * runnerLots;
            gross += rPnl;
            partialBreakdown.push({ price: resolvedExit, lots: runnerLots, pnl: rPnl, runner: true });
          }
          pnl = gross;
        } else if (hasLegacyPartial) {
          // P&L pondéré : partial% × (partialPrice - entry) + (1-partial%) × (resolvedExit - entry)
          const pFrac     = t.partialPercent / 100;
          const partialPts = isLong ? t.partialPrice - t.entry : t.entry - t.partialPrice;
          const restPts    = isLong ? resolvedExit - t.entry  : t.entry - resolvedExit;
          pnl = (partialPts * pFrac + restPts * (1 - pFrac)) * pv * t.contracts;
        } else {
          const pts = isLong ? resolvedExit - t.entry : t.entry - resolvedExit;
          pnl = pts * pv * t.contracts;
        }
        netPnl   = pnl - totalFees;
        estimated = t.exitPrice == null;
      }
    }

    return {
      riskPts, rewardPts,
      rr, riskUSD, rewardUSD, netRewardUSD, riskPct,
      riskTicks, rewardTicks,
      pv, feePerSide, commFees, spreadFees, totalFees,
      pnl, netPnl, estimated,
      hasPartial: hasPartials || hasLegacyPartial,
      hasPartials,
      partials: hasPartials ? cleanPartials : null,
      partialBreakdown,
      partialPercent: t.partialPercent || null,
      partialPrice:   t.partialPrice   || null,
      apexOk:   riskPct <= 2.0,
      apexWarn: riskPct > 1.5 && riskPct <= 2.0,
    };
  }

  // v0.9.250 : normalise + valide un array de sorties partielles.
  // Filtre les entrées invalides (price/lots non numériques ou ≤ 0),
  // cap le nombre total de lots à `contracts` (le runner ne peut pas être négatif).
  function _normalizePartials(partials, contracts) {
    if (!Array.isArray(partials) || !partials.length) return [];
    const maxLots = (typeof contracts === 'number' && contracts > 0) ? contracts : Infinity;
    const out = [];
    let cumulative = 0;
    for (const p of partials) {
      if (!p) continue;
      const price = Number(p.price);
      let   lots  = Number(p.lots);
      if (!isFinite(price) || price <= 0) continue;
      if (!isFinite(lots)  || lots  <= 0) continue;
      // Ne pas dépasser le total de lots dispo (clamp la dernière tranche)
      if (cumulative + lots > maxLots) lots = +(maxLots - cumulative).toFixed(6);
      if (lots <= 0) break;
      out.push({ price, lots });
      cumulative += lots;
      if (cumulative >= maxLots) break;
    }
    return out;
  }

  // Live preview depuis le formulaire
  function fromForm(direction, entry, sl, tp1, instrument, contracts, capital, feePerSide = 2.14, spreadCost = 0, exitPrice = null) {
    return trade({
      direction, entry, sl, tp1,
      instrument, contracts, capital,
      feePerSide, spreadCost,
      exitPrice,
    });
  }

  function rrColor(rr) {
    if (rr >= 2) return 'var(--green)';
    if (rr >= 1) return 'var(--amber)';
    return 'var(--red)';
  }

  function rrLabel(rr) {
    if (rr >= 2)   return 'Excellent';
    if (rr >= 1.5) return 'Bon';
    if (rr >= 1)   return 'Limite';
    return 'Insuffisant';
  }

  function riskColor(pct) {
    if (pct <= 1.5) return 'var(--green)';
    if (pct <= 2)   return 'var(--amber)';
    return 'var(--red)';
  }

  function pnlColor(pnl) {
    return pnl >= 0 ? 'var(--green)' : 'var(--red)';
  }

  function formatPnL(pnl) {
    return (pnl >= 0 ? '+' : '-') + '$' + Math.abs(pnl).toFixed(0);
  }

  // Calcul du plancher trailing (EOD) pour un compte funded
  // Trailing : Apex, Topstep, FTMO 1-Step, Lucid → max des soldes EOD - drawdown
  // Statique : FTMO 2-Step (classique), Funding Pips → solde initial - drawdown figé
  // v0.9.189 : retourne null pour les comptes Personal/Crypto (pas de notion de drawdown prop firm)
  function trailingFloor(acc, accTrades) {
    // Comptes hors prop firm : pas de trailing/safety net applicable
    if (acc.accountType && acc.accountType !== 'prop') {
      const cumPnL = (acc.pnlOffset || 0) + accTrades.reduce((s, t) => {
        const c = trade(t);
        return c.estimated ? s : s + (c.netPnl || 0);
      }, 0);
      return {
        floor:             null,
        balance:           (acc.capital || 0) + cumPnL,
        drawdownConsumed:  null,
        safetyNetReached:  null,
        isStatic:          false,
        notApplicable:     true,  // flag pour l'UI : skip cette section
      };
    }
    const startBalance = acc.capital || 50000;
    const rules        = ACCOUNT_RULES[startBalance] || {};
    const drawdown     = acc.maxDrawdown || rules.drawdown || 2000;
    const safetyNet    = rules.safetyNet || (drawdown + 100);

    // Drawdown statique : pas de trailing, juste le plancher initial
    const STATIC_FIRMS = new Set(['ftmo', 'fpips']);
    if (STATIC_FIRMS.has(acc.firmKey)) {
      const cumPnL = (acc.pnlOffset || 0) +
        accTrades.reduce((s, t) => {
          const c = trade(t);
          return c.estimated ? s : s + (c.netPnl || 0);
        }, 0);
      return {
        floor:             startBalance - drawdown,
        balance:           startBalance + cumPnL,
        drawdownConsumed:  Math.max(0, -cumPnL),
        safetyNetReached:  cumPnL >= safetyNet,
        isStatic:          true,
      };
    }

    // Cumul P&L par jour (trades fermés uniquement)
    const byDay = {};
    accTrades.forEach(t => {
      const c = trade(t);
      if (c.estimated) return;
      const d = (t.date || '').split('T')[0];
      if (!d) return;
      byDay[d] = (byDay[d] || 0) + (c.netPnl || 0);
    });

    const pnlOffset = acc.pnlOffset || 0;
    const days = Object.keys(byDay).sort();
    let cumPnL = pnlOffset;
    let hwm    = startBalance + Math.max(0, pnlOffset); // HWM déjà relevé si offset positif

    days.forEach(d => {
      cumPnL += byDay[d];
      const eod = startBalance + cumPnL;
      if (eod > hwm) hwm = eod;
    });

    const currentBalance = startBalance + cumPnL;
    const profit         = Math.max(0, cumPnL);
    const safetyReached  = profit >= safetyNet;

    // Plancher trailing : jamais sous le plancher initial
    let floor = Math.max(hwm - drawdown, startBalance - drawdown);
    // Safety Net atteint → plancher bloqué au solde initial
    if (safetyReached) floor = Math.max(floor, startBalance);

    const distanceToFloor = currentBalance - floor;
    const drawdownConsumed = drawdown - distanceToFloor;

    return {
      startBalance,
      currentBalance,
      hwm,
      floor,
      drawdown,
      safetyNet,
      safetyReached,
      distanceToFloor,
      drawdownConsumed: Math.max(0, drawdownConsumed),
      drawdownUsedPct: drawdown > 0
        ? Math.max(0, Math.min(100, (Math.max(0, drawdownConsumed) / drawdown) * 100))
        : 0,
      profit,
      byDay,
    };
  }

  return {
    trade, fromForm, trailingFloor,
    rrColor, rrLabel, riskColor, pnlColor, formatPnL,
    pointValue, tickSize, tickValue, isCFD, isCrypto, ACCOUNT_RULES,
    normalizePartials: _normalizePartials,
  };
})();
