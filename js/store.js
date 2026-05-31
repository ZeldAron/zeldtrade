// ─── STORE ───────────────────────────────────────────────────────────────────
// Persistance double : localStorage (rapide) + Firestore (cross-device)

const Store = (() => {

  // YYYY-MM-DD au fuseau local (évite les bordures de jour UTC)
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── Données statiques (presets, référence) ───────────────────────────────────
  // v0.9.396 :
  //  - selectedFirms : prop firms déclarées par l'user (setup 1er login / Réglages). []=aucune.
  //  - focusScope    : contexte Focus app-wide (dashboard/analytics/calendrier). null=Global (tout),
  //                    'firm:KEY' = une prop firm entière, 'acc:NOM' = un compte, 'grp:ID' = un groupe.
  //  - setupDone     : true une fois le wizard de setup obligatoire complété.
  const DEFAULT_SETTINGS = { capital: 50000, contracts: 1, instrument: 'MES1', tradingTypes: null, favInstruments: [], selectedFirms: [], focusScope: null, setupDone: false };

  // v0.9.275 (F1/F2) — profil de trading utilisateur (multi-choix). null = pas encore répondu.
  const VALID_TRADING_TYPES = ['fundsOwn', 'propFirm', 'crypto'];
  function _sanitizeTradingTypes(v) {
    if (!Array.isArray(v)) return null;
    const out = [...new Set(v.filter(x => VALID_TRADING_TYPES.includes(x)))];
    return out.length ? out : null;
  }

  const DEFAULT_ACCOUNT_TYPES = [
    // ─── Apex Trader Funding 2026 (refonte v0.9.186, simplifié v0.9.187 — EOD uniquement) ───
    // Source : captures officielles apextraderfunding.com (user, 2026-05-17).
    // Drawdown End Of Day (se fige à PT atteint). Min Days To Pass : 1. Consistency 50%.
    { id: 'apex-25k',  firmKey: 'apex', name: 'Apex $25K',  capital:  25000, profitTarget:  1500, maxDrawdown:  1000, dailyLossLimit:   500, maxContracts:  4, feePerSide: 1.99 },
    { id: 'apex-50k',  firmKey: 'apex', name: 'Apex $50K',  capital:  50000, profitTarget:  3000, maxDrawdown:  2000, dailyLossLimit:  1000, maxContracts:  6, feePerSide: 1.99 },
    { id: 'apex-100k', firmKey: 'apex', name: 'Apex $100K', capital: 100000, profitTarget:  6000, maxDrawdown:  3000, dailyLossLimit:  1500, maxContracts:  8, feePerSide: 1.99 },
    { id: 'apex-150k', firmKey: 'apex', name: 'Apex $150K', capital: 150000, profitTarget:  9000, maxDrawdown:  4000, dailyLossLimit:  2000, maxContracts: 12, feePerSide: 1.99 },
    { id: 'topstep-50k',  firmKey: 'topstep', name: 'Topstep $50K',   capital:  50000, profitTarget:  3000, maxDrawdown:  2000, dailyLossLimit:     0, maxContracts:  5, feePerSide: 1.90 },
    { id: 'topstep-100k', firmKey: 'topstep', name: 'Topstep $100K',  capital: 100000, profitTarget:  6000, maxDrawdown:  3000, dailyLossLimit:     0, maxContracts: 10, feePerSide: 1.90 },
    { id: 'topstep-150k', firmKey: 'topstep', name: 'Topstep $150K',  capital: 150000, profitTarget:  9000, maxDrawdown:  4500, dailyLossLimit:     0, maxContracts: 15, feePerSide: 1.90 },
    // FTMO 2-Step Challenge (drawdown statique 10%, daily loss 5%, min 4 jours)
    { id: 'ftmo-10k',     firmKey: 'ftmo',    name: 'FTMO $10K',      capital:  10000, profitTarget:  1000, maxDrawdown:  1000, dailyLossLimit:   500, maxContracts: 10, feePerSide: 2.50 },
    { id: 'ftmo-25k',     firmKey: 'ftmo',    name: 'FTMO $25K',      capital:  25000, profitTarget:  2500, maxDrawdown:  2500, dailyLossLimit:  1250, maxContracts: 20, feePerSide: 2.50 },
    { id: 'ftmo-50k',     firmKey: 'ftmo',    name: 'FTMO $50K',      capital:  50000, profitTarget:  5000, maxDrawdown:  5000, dailyLossLimit:  2500, maxContracts: 30, feePerSide: 2.50 },
    { id: 'ftmo-100k',    firmKey: 'ftmo',    name: 'FTMO $100K',     capital: 100000, profitTarget: 10000, maxDrawdown: 10000, dailyLossLimit:  5000, maxContracts: 50, feePerSide: 2.50 },
    { id: 'ftmo-200k',    firmKey: 'ftmo',    name: 'FTMO $200K',     capital: 200000, profitTarget: 20000, maxDrawdown: 20000, dailyLossLimit: 10000, maxContracts: 50, feePerSide: 2.50 },
    // FTMO 1-Step Challenge (drawdown trailing 10%, daily loss 3%, 0 jours min, 90% split)
    { id: 'ftmo1-10k',    firmKey: 'ftmo1step', name: 'FTMO 1-Step $10K',   capital:  10000, profitTarget:  1000, maxDrawdown:  1000, dailyLossLimit:   300, maxContracts: 10, feePerSide: 2.50 },
    { id: 'ftmo1-25k',    firmKey: 'ftmo1step', name: 'FTMO 1-Step $25K',   capital:  25000, profitTarget:  2500, maxDrawdown:  2500, dailyLossLimit:   750, maxContracts: 20, feePerSide: 2.50 },
    { id: 'ftmo1-50k',    firmKey: 'ftmo1step', name: 'FTMO 1-Step $50K',   capital:  50000, profitTarget:  5000, maxDrawdown:  5000, dailyLossLimit:  1500, maxContracts: 30, feePerSide: 2.50 },
    { id: 'ftmo1-100k',   firmKey: 'ftmo1step', name: 'FTMO 1-Step $100K',  capital: 100000, profitTarget: 10000, maxDrawdown: 10000, dailyLossLimit:  3000, maxContracts: 50, feePerSide: 2.50 },
    { id: 'ftmo1-200k',   firmKey: 'ftmo1step', name: 'FTMO 1-Step $200K',  capital: 200000, profitTarget: 20000, maxDrawdown: 20000, dailyLossLimit:  6000, maxContracts: 50, feePerSide: 2.50 },
    // ─── Lucid Trading 2026 (refonte v0.9.182, naming v0.9.183) ───
    // Lucid Flex — éval 1-phase soft, pas de daily loss, consistency 50% éval only
    { id: 'lucidflex-25k',   firmKey: 'lucid', subType: 'Flex',   name: 'Lucid Flex $25K',   capital:  25000, profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit:    0, maxContracts:  2, feePerSide: 1.75 },
    { id: 'lucidflex-50k',   firmKey: 'lucid', subType: 'Flex',   name: 'Lucid Flex $50K',   capital:  50000, profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit:    0, maxContracts:  4, feePerSide: 1.75 },
    { id: 'lucidflex-100k',  firmKey: 'lucid', subType: 'Flex',   name: 'Lucid Flex $100K',  capital: 100000, profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit:    0, maxContracts:  6, feePerSide: 1.75 },
    { id: 'lucidflex-150k',  firmKey: 'lucid', subType: 'Flex',   name: 'Lucid Flex $150K',  capital: 150000, profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit:    0, maxContracts: 10, feePerSide: 1.75 },
    // Lucid Pro — éval 2-phase strict, daily loss, consistency 40% funded, payout tous les 3j possible
    { id: 'lucidpro-25k',    firmKey: 'lucid', subType: 'Pro',    name: 'Lucid Pro $25K',    capital:  25000, profitTarget: 1250, maxDrawdown: 1000, dailyLossLimit:    0, maxContracts:  2, feePerSide: 1.75 },
    { id: 'lucidpro-50k',    firmKey: 'lucid', subType: 'Pro',    name: 'Lucid Pro $50K',    capital:  50000, profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts:  4, feePerSide: 1.75 },
    { id: 'lucidpro-100k',   firmKey: 'lucid', subType: 'Pro',    name: 'Lucid Pro $100K',   capital: 100000, profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1800, maxContracts:  6, feePerSide: 1.75 },
    { id: 'lucidpro-150k',   firmKey: 'lucid', subType: 'Pro',    name: 'Lucid Pro $150K',   capital: 150000, profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 2700, maxContracts: 10, feePerSide: 1.75 },
    // Lucid Direct — instant funded, pas d'éval, consistency 20%, min 5 qualifying days par cycle
    { id: 'luciddirect-25k', firmKey: 'lucid', subType: 'Direct', name: 'Lucid Direct $25K', capital:  25000, profitTarget:    0, maxDrawdown: 1000, dailyLossLimit:    0, maxContracts:  2, feePerSide: 1.75 },
    { id: 'luciddirect-50k', firmKey: 'lucid', subType: 'Direct', name: 'Lucid Direct $50K', capital:  50000, profitTarget:    0, maxDrawdown: 2000, dailyLossLimit: 1200, maxContracts:  4, feePerSide: 1.75 },
    { id: 'luciddirect-100k',firmKey: 'lucid', subType: 'Direct', name: 'Lucid Direct $100K',capital: 100000, profitTarget:    0, maxDrawdown: 3500, dailyLossLimit: 2100, maxContracts:  6, feePerSide: 1.75 },
    { id: 'luciddirect-150k',firmKey: 'lucid', subType: 'Direct', name: 'Lucid Direct $150K',capital: 150000, profitTarget:    0, maxDrawdown: 5000, dailyLossLimit: 3000, maxContracts: 10, feePerSide: 1.75 },
    { id: 'fpips-10k',    firmKey: 'fpips',   name: 'Funding Pips $10K',  capital:  10000, profitTarget:   800, maxDrawdown:   500, dailyLossLimit:   200, maxContracts:  2,   feePerSide: 0.00 },
    { id: 'fpips-25k',    firmKey: 'fpips',   name: 'Funding Pips $25K',  capital:  25000, profitTarget:  2000, maxDrawdown:  1250, dailyLossLimit:   500, maxContracts:  5,   feePerSide: 0.00 },
    { id: 'fpips-50k',    firmKey: 'fpips',   name: 'Funding Pips $50K',  capital:  50000, profitTarget:  4000, maxDrawdown:  2500, dailyLossLimit:  1000, maxContracts: 10,   feePerSide: 0.00 },
    { id: 'fpips-100k',   firmKey: 'fpips',   name: 'Funding Pips $100K', capital: 100000, profitTarget:  8000, maxDrawdown:  5000, dailyLossLimit:  2000, maxContracts: 20,   feePerSide: 0.00 },
    { id: 'fpips-200k',   firmKey: 'fpips',   name: 'Funding Pips $200K', capital: 200000, profitTarget: 16000, maxDrawdown: 10000, dailyLossLimit:  4000, maxContracts: 40,   feePerSide: 0.00 },
  ];

  const DEFAULT_PROP_FIRMS = {
    // ─── Apex Trader Funding 2026 — refonte v0.9.186, simplifié v0.9.187 ───
    // Source : captures officielles apextraderfunding.com (user, 2026-05-17).
    // Drawdown EOD (se fige quand le profit target est atteint). Min Days To Pass : 1.
    // Consistency Rule : 50% (PA). Max 20 comptes PA. Payouts toutes les 5 trading days.
    apex: { name: 'Apex Trader Funding', accounts: [
      { id:'apex-25k',  size:'25K',  capital:25000,  profitTarget:1500, maxDrawdown:1000, dailyLossLimit:500,  maxContractsEval:4,  maxContractsPA:2,  evalFee:34.90, activationFeePA:119, drawdownType:'Trailing EOD (se fige à PT)', consistency:'≤50% meilleure journée (PA)', minTradingDays:1, payoutConditions:'PA $119 — 5 trading days, max 20 comptes' },
      { id:'apex-50k',  size:'50K',  capital:50000,  profitTarget:3000, maxDrawdown:2000, dailyLossLimit:1000, maxContractsEval:6,  maxContractsPA:4,  evalFee:39.90, activationFeePA:129, drawdownType:'Trailing EOD (se fige à PT)', consistency:'≤50% meilleure journée (PA)', minTradingDays:1, payoutConditions:'PA $129 — 5 trading days, max 20 comptes' },
      { id:'apex-100k', size:'100K', capital:100000, profitTarget:6000, maxDrawdown:3000, dailyLossLimit:1500, maxContractsEval:8,  maxContractsPA:6,  evalFee:59.90, activationFeePA:149, drawdownType:'Trailing EOD (se fige à PT)', consistency:'≤50% meilleure journée (PA)', minTradingDays:1, payoutConditions:'PA $149 — 5 trading days, max 20 comptes' },
      { id:'apex-150k', size:'150K', capital:150000, profitTarget:9000, maxDrawdown:4000, dailyLossLimit:2000, maxContractsEval:12, maxContractsPA:10, evalFee:89.90, activationFeePA:169, drawdownType:'Trailing EOD (se fige à PT)', consistency:'≤50% meilleure journée (PA)', minTradingDays:1, payoutConditions:'PA $169 — 5 trading days, max 20 comptes' },
    ]},
    // ─── Topstep 2026 — refonte v0.9.188 ───
    // Source : help.topstep.com (Trading Combine Parameters + Max Loss Limit + Live Funded).
    // 2 phases : Trading Combine (éval, $49/$99/$149 mensuel) → Express ou Live Funded Account.
    // MLL (Max Loss Limit) = trailing drawdown qui se fige à starting balance + PT.
    // Pas de DLL fixe sur le Combine — Live Funded a un DLL dynamique de base $2K/$3K/$4.5K.
    // Consistency : best day ≤ 50% des profits totaux. 5 jours gagnants min pour 1er payout.
    topstep: { name: 'Topstep', accounts: [
      { id:'topstep-50k',  size:'50K',  capital:50000,  profitTarget:3000, maxDrawdown:2000, dailyLossLimit:0, maxContractsEval:5,  evalFeeMonthly:49,  drawdownType:'Trailing (se fige à PT)', consistency:'Best day ≤50% profits totaux', minTradingDays:5, payoutConditions:'Combine $49/mois — Live Funded DLL $2K — 50% premiers profits jusqu\'à 30j, puis 100% (max $5K), 5j gagnants min' },
      { id:'topstep-100k', size:'100K', capital:100000, profitTarget:6000, maxDrawdown:3000, dailyLossLimit:0, maxContractsEval:10, evalFeeMonthly:99,  drawdownType:'Trailing (se fige à PT)', consistency:'Best day ≤50% profits totaux', minTradingDays:5, payoutConditions:'Combine $99/mois — Live Funded DLL $3K — 50% premiers profits jusqu\'à 30j, puis 100% (max $10K), 5j gagnants min' },
      { id:'topstep-150k', size:'150K', capital:150000, profitTarget:9000, maxDrawdown:4500, dailyLossLimit:0, maxContractsEval:15, evalFeeMonthly:149, drawdownType:'Trailing (se fige à PT)', consistency:'Best day ≤50% profits totaux', minTradingDays:5, payoutConditions:'Combine $149/mois — Live Funded DLL $4.5K — 50% premiers profits jusqu\'à 30j, puis 100% (max $15K), 5j gagnants min' },
    ]},
    ftmo:    { name: 'FTMO (CFD/Forex)', accounts: [
      { id:'ftmo-10k',     size:'10K',  capital:10000,  profitTarget:1000,  maxDrawdown:1000,  dailyLossLimit:500,   drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:4, payoutConditions:'80% split (90% après scaling) — fee remboursé au 1er payout' },
      { id:'ftmo-25k',     size:'25K',  capital:25000,  profitTarget:2500,  maxDrawdown:2500,  dailyLossLimit:1250,  drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:4, payoutConditions:'80% split (90% après scaling) — fee remboursé au 1er payout' },
      { id:'ftmo-50k',     size:'50K',  capital:50000,  profitTarget:5000,  maxDrawdown:5000,  dailyLossLimit:2500,  drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:4, payoutConditions:'80% split (90% après scaling) — fee remboursé au 1er payout' },
      { id:'ftmo-100k',    size:'100K', capital:100000, profitTarget:10000, maxDrawdown:10000, dailyLossLimit:5000,  drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:4, payoutConditions:'80% split (90% après scaling) — fee remboursé au 1er payout' },
      { id:'ftmo-200k',    size:'200K', capital:200000, profitTarget:20000, maxDrawdown:20000, dailyLossLimit:10000, drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:4, payoutConditions:'80% split (90% après scaling) — fee remboursé au 1er payout' },
    ]},
    ftmo1step: { name: 'FTMO 1-Step', accounts: [
      { id:'ftmo1-10k',    size:'10K',  capital:10000,  profitTarget:1000,  maxDrawdown:1000,  dailyLossLimit:300,   drawdownType:'Trailing (1-Step)', consistency:'Best day ≤50% des profits totaux', minTradingDays:0, payoutConditions:'90% split dès le départ — fee remboursé au 1er payout' },
      { id:'ftmo1-25k',    size:'25K',  capital:25000,  profitTarget:2500,  maxDrawdown:2500,  dailyLossLimit:750,   drawdownType:'Trailing (1-Step)', consistency:'Best day ≤50% des profits totaux', minTradingDays:0, payoutConditions:'90% split dès le départ — fee remboursé au 1er payout' },
      { id:'ftmo1-50k',    size:'50K',  capital:50000,  profitTarget:5000,  maxDrawdown:5000,  dailyLossLimit:1500,  drawdownType:'Trailing (1-Step)', consistency:'Best day ≤50% des profits totaux', minTradingDays:0, payoutConditions:'90% split dès le départ — fee remboursé au 1er payout' },
      { id:'ftmo1-100k',   size:'100K', capital:100000, profitTarget:10000, maxDrawdown:10000, dailyLossLimit:3000,  drawdownType:'Trailing (1-Step)', consistency:'Best day ≤50% des profits totaux', minTradingDays:0, payoutConditions:'90% split dès le départ — fee remboursé au 1er payout' },
      { id:'ftmo1-200k',   size:'200K', capital:200000, profitTarget:20000, maxDrawdown:20000, dailyLossLimit:6000,  drawdownType:'Trailing (1-Step)', consistency:'Best day ≤50% des profits totaux', minTradingDays:0, payoutConditions:'90% split dès le départ — fee remboursé au 1er payout' },
    ]},
    // ─── Lucid Trading 2026 — refonte v0.9.182 ───
    // Source : propfirmshop.com + damnpropfirms.com (mars 2026). 3 produits actifs : LucidFlex (1-step soft),
    // LucidPro (2-phase strict), LucidDirect (instant funded). LucidBlack discontinué. LucidMaxx pas encore stable.
    // Profit split universel 90/10 (passé de 80/20 en mars 2026). 100% des premiers $10K au trader.
    // EOD drawdown sur tous. News trading autorisé (NFP/FOMC/CPI). Toutes positions fermées avant 4:45 PM EST.
    lucid: { name: 'Lucid Trading', accounts: [
      // Lucid Flex — DLL : Aucune sur toutes les tailles (éval + funded)
      { id:'lucidflex-25k',   subType:'Flex',   size:'25K',  capital:25000,  profitTarget:1250, maxDrawdown:1000, dailyLossLimit:0,    evalFee:100, drawdownType:'Trailing EOD', consistency:'≤50% best day (éval only, none funded)', minTradingDays:0, payoutConditions:'90/10 split — min 5 profitable days/cycle, min $500 payout, processing 2j' },
      { id:'lucidflex-50k',   subType:'Flex',   size:'50K',  capital:50000,  profitTarget:3000, maxDrawdown:2000, dailyLossLimit:0,    evalFee:130, drawdownType:'Trailing EOD', consistency:'≤50% best day (éval only, none funded)', minTradingDays:0, payoutConditions:'90/10 split — min 5 profitable days/cycle, min $500 payout, processing 2j' },
      { id:'lucidflex-100k',  subType:'Flex',   size:'100K', capital:100000, profitTarget:6000, maxDrawdown:3000, dailyLossLimit:0,    evalFee:225, drawdownType:'Trailing EOD', consistency:'≤50% best day (éval only, none funded)', minTradingDays:0, payoutConditions:'90/10 split — min 5 profitable days/cycle, min $500 payout, processing 2j' },
      { id:'lucidflex-150k',  subType:'Flex',   size:'150K', capital:150000, profitTarget:9000, maxDrawdown:4500, dailyLossLimit:0,    evalFee:315, drawdownType:'Trailing EOD', consistency:'≤50% best day (éval only, none funded)', minTradingDays:0, payoutConditions:'90/10 split — min 5 profitable days/cycle, min $500 payout, processing 2j' },
      // Lucid Pro
      { id:'lucidpro-25k',    subType:'Pro',    size:'25K',  capital:25000,  profitTarget:1250, maxDrawdown:1000, dailyLossLimit:0,    evalFee:135, drawdownType:'Trailing EOD', consistency:'≤40% best day (funded)', minTradingDays:0, payoutConditions:'90/10 split — payout tous les 3 jours possible, one-day pass potential' },
      { id:'lucidpro-50k',    subType:'Pro',    size:'50K',  capital:50000,  profitTarget:3000, maxDrawdown:2000, dailyLossLimit:1200, evalFee:185, drawdownType:'Trailing EOD', consistency:'≤40% best day (funded)', minTradingDays:0, payoutConditions:'90/10 split — payout tous les 3 jours possible, one-day pass potential' },
      { id:'lucidpro-100k',   subType:'Pro',    size:'100K', capital:100000, profitTarget:6000, maxDrawdown:3000, dailyLossLimit:1800, evalFee:285, drawdownType:'Trailing EOD', consistency:'≤40% best day (funded)', minTradingDays:0, payoutConditions:'90/10 split — payout tous les 3 jours possible, one-day pass potential' },
      { id:'lucidpro-150k',   subType:'Pro',    size:'150K', capital:150000, profitTarget:9000, maxDrawdown:4500, dailyLossLimit:2700, evalFee:370, drawdownType:'Trailing EOD', consistency:'≤40% best day (funded)', minTradingDays:0, payoutConditions:'90/10 split — payout tous les 3 jours possible, one-day pass potential' },
      // Lucid Direct (instant funded — pas d'éval, fee = prix d'achat du compte)
      { id:'luciddirect-25k', subType:'Direct', size:'25K',  capital:25000,  profitTarget:0,    maxDrawdown:1000, dailyLossLimit:0,    evalFee:340, drawdownType:'Trailing EOD', consistency:'≤20% best day par cycle', minTradingDays:5, payoutConditions:'90/10 split — instant funded, min $500/cycle, pas de 8j wait' },
      { id:'luciddirect-50k', subType:'Direct', size:'50K',  capital:50000,  profitTarget:0,    maxDrawdown:2000, dailyLossLimit:1200, evalFee:520, drawdownType:'Trailing EOD', consistency:'≤20% best day par cycle', minTradingDays:5, payoutConditions:'90/10 split — instant funded, min $500/cycle, pas de 8j wait' },
      { id:'luciddirect-100k',subType:'Direct', size:'100K', capital:100000, profitTarget:0,    maxDrawdown:3500, dailyLossLimit:2100, evalFee:700, drawdownType:'Trailing EOD', consistency:'≤20% best day par cycle', minTradingDays:5, payoutConditions:'90/10 split — instant funded, min $500/cycle, pas de 8j wait' },
      { id:'luciddirect-150k',subType:'Direct', size:'150K', capital:150000, profitTarget:0,    maxDrawdown:5000, dailyLossLimit:3000, evalFee:840, drawdownType:'Trailing EOD', consistency:'≤20% best day par cycle', minTradingDays:5, payoutConditions:'90/10 split — instant funded, min $500/cycle, pas de 8j wait' },
    ]},
    fpips:   { name: 'Funding Pips (CFD/Forex)', accounts: [
      { id:'fpips-10k',    size:'10K',  capital:10000,  profitTarget:800,   maxDrawdown:500,   dailyLossLimit:200,  drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:3, payoutConditions:'80% split — délai 14j' },
      { id:'fpips-25k',    size:'25K',  capital:25000,  profitTarget:2000,  maxDrawdown:1250,  dailyLossLimit:500,  drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:3, payoutConditions:'80% split — délai 14j' },
      { id:'fpips-50k',    size:'50K',  capital:50000,  profitTarget:4000,  maxDrawdown:2500,  dailyLossLimit:1000, drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:3, payoutConditions:'80% split — délai 14j' },
      { id:'fpips-100k',   size:'100K', capital:100000, profitTarget:8000,  maxDrawdown:5000,  dailyLossLimit:2000, drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:3, payoutConditions:'80% split — délai 14j' },
      { id:'fpips-200k',   size:'200K', capital:200000, profitTarget:16000, maxDrawdown:10000, dailyLossLimit:4000, drawdownType:'Statique (2-Step)', consistency:'Aucune', minTradingDays:3, payoutConditions:'80% split — délai 14j' },
    ]},
  };

  const DEFAULT_SPREADS = { MES1:1.25,ES1:12.50,MNQ1:0.50,NQ1:5.00,MYM1:0.50,YM1:5.00,M2K1:0.50,RTY1:5.00,MGC1:1.00,GC1:10.00,MCL1:1.00,CL1:10.00 };
  // v0.9.391 : Forex + CFD ajoutés aux firms « futures » (apex/topstep/lucid) et
  // au mode fonds propres — l'utilisateur veut pouvoir trader EURUSD / XAUUSD /
  // indices sur n'importe quel type de compte (firm ou personal). Les firms
  // « CFD/Forex » (ftmo/fpips) gardent leurs spreads d'origine.
  const _FUTURES_SPREADS_APEX_TOPSTEP_LUCID = {
    MES1:1.25,ES1:12.50,MNQ1:0.50,NQ1:5.00,MYM1:0.50,YM1:5.00,M2K1:0.50,RTY1:5.00,
    MGC1:1.00,GC1:10.00,MCL1:1.00,CL1:10.00,
  };
  const _CFD_FOREX_SPREADS = {
    US500:0.50,US100:1.50,US30:2.50,GER40:1.50,UK100:1.00,
    XAUUSD:0.35,EURUSD:1.00,GBPUSD:1.20,USDJPY:0.80,USOIL:3.00,
  };
  const DEFAULT_SPREADS_BY_FIRM = {
    apex:    { ..._FUTURES_SPREADS_APEX_TOPSTEP_LUCID, ..._CFD_FOREX_SPREADS },
    topstep: { ..._FUTURES_SPREADS_APEX_TOPSTEP_LUCID, ..._CFD_FOREX_SPREADS, ZN1:15.63 },
    ftmo:      { ..._CFD_FOREX_SPREADS },
    ftmo1step: { ..._CFD_FOREX_SPREADS },
    lucid:   { ..._FUTURES_SPREADS_APEX_TOPSTEP_LUCID, ..._CFD_FOREX_SPREADS },
    fpips:   { US500:0.40,US100:1.20,US30:2.00,GER40:1.20,UK100:0.80,XAUUSD:0.25,EURUSD:0.80,GBPUSD:1.00,USDJPY:0.70,USOIL:2.50 },
  };

  // ── État en mémoire ──────────────────────────────────────────────────────────
  let _uid          = 'default';
  let trades        = [];
  let settings      = { ...DEFAULT_SETTINGS };
  let accountTypes  = DEFAULT_ACCOUNT_TYPES.map(a => ({ ...a }));
  let myAccounts    = [];
  let spreads       = { ...DEFAULT_SPREADS };
  let spreadsByFirm = Object.fromEntries(Object.keys(DEFAULT_SPREADS_BY_FIRM).map(k => [k, { ...DEFAULT_SPREADS_BY_FIRM[k] }]));
  let groups        = [];
  let _plan         = { plan: 'basic', tier: 'trader' };
  let _aiUsage      = { date: '', count: 0 };
  let _stripe       = { customerId: null, subscriptionStatus: null, tier: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, cycle: null };

  // ─── Plans & tiers (v0.9.211) ────────────────────────────────────────────────
  // 4 tiers : trader (gratuit) / funded (14,99 €) / elite (29,99 €) / beta (admin attribué, accès tout)
  const VALID_TIERS = new Set(['trader', 'funded', 'elite', 'beta']);
  // v0.9.246 : maxScreenshots — nombre max d'images conservées par trade.
  // Trader gratuit = 0 (l'IA Vision marche encore pour analyser mais l'image
  // n'est PAS uploadée dans Storage au save). Pro = 3 images max.
  const TIER_LIMITS = {
    trader: { maxAccounts: 1,        maxAiPerDay: 1,        maxScreenshots: 0   },
    funded: { maxAccounts: 3,        maxAiPerDay: 5,        maxScreenshots: 3   },   // v0.9.342 : resserré (2 comptes groupables + 5 IA/j) → pression upsell vers Elite
    elite:  { maxAccounts: Infinity, maxAiPerDay: Infinity, maxScreenshots: 3   },   // illimité = la soupape
    beta:   { maxAccounts: Infinity, maxAiPerDay: Infinity, maxScreenshots: 3   },
  };
  // Matrice features → tiers qui y ont accès. Si non listée = accès libre.
  const TIER_FEATURES = {
    groups:           ['funded', 'elite', 'beta'],
    exportPdf:        ['funded', 'elite', 'beta'],
    exportCsv:        ['funded', 'elite', 'beta'],
    prioritySupport:  ['funded', 'elite', 'beta'],
    betaFeatures:     ['elite', 'beta'],
    decisiveVote:     ['elite', 'beta'],
    partials:         ['funded', 'elite', 'beta'],   // v0.9.251 : sorties partielles = Pro only
  };

  // ── Clés localStorage (cache local) ─────────────────────────────────────────
  const lk = () => ({
    trades:       `ztrade_${_uid}_trades`,
    settings:     `ztrade_${_uid}_settings`,
    myAccounts:   `ztrade_${_uid}_myAccounts`,
    spreadsByFirm:`ztrade_${_uid}_spreadsByFirm`,
    groups:       `ztrade_${_uid}_groups`,
    plan:         `ztrade_${_uid}_plan`,
    aiUsage:      `ztrade_${_uid}_aiUsage`,
  });

  // ── Helpers Firestore ────────────────────────────────────────────────────────
  function userDoc(name) {
    return _fbDb.collection('users').doc(_uid).collection('data').doc(name);
  }

  function fbSet(name, data) {
    userDoc(name).set(data).catch(e => {
      console.warn('[Store] Firestore write error', name, e);
      // v0.9.235 : si l'erreur signale un compte supprimé/désactivé, on déclenche
      // la modale globale "Compte supprimé" qui force le logout.
      if (_isAccountGoneError(e) && typeof window.showAccountDeleted === 'function') {
        try { window.showAccountDeleted(); } catch {}
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('store:saveFailed', {
          detail: { collection: name, error: (e && e.message) || 'unknown' }
        }));
      } catch {}
    });
  }

  // v0.9.235 : helper local pour détecter les codes Firebase signalant
  // qu'un compte n'existe plus (deleteUser admin) ou est désactivé.
  // NB : on N'INCLUT PAS `permission-denied` car c'est aussi le code retourné
  // par les rules pour des refus de validation légitimes (false positives).
  // Le vrai signal "compte supprimé" est `unauthenticated` (Firestore) ou
  // les codes `auth/*` (Firebase Auth client lui-même).
  function _isAccountGoneError(err) {
    if (!err) return false;
    const code = String(err.code || err.message || '');
    return code === 'unauthenticated'
        || code === 'auth/user-not-found'
        || code === 'auth/user-disabled'
        || code === 'auth/user-token-expired'
        || code === 'auth/id-token-revoked'
        || code === 'auth/invalid-user-token'
        || /USER_NOT_FOUND|USER_DISABLED|TOKEN_EXPIRED|TOKEN_REVOKED/i.test(code);
  }

  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  // ── Init & chargement ────────────────────────────────────────────────────────
  function initForUser(userId) {
    _uid           = userId || 'default';
    _plan          = { plan: 'basic' };
    _aiUsage       = { date: '', count: 0 };
    trades        = [];
    settings      = { ...DEFAULT_SETTINGS };
    accountTypes  = DEFAULT_ACCOUNT_TYPES.map(a => ({ ...a }));
    myAccounts    = [];
    spreads       = { ...DEFAULT_SPREADS };
    spreadsByFirm = Object.fromEntries(Object.keys(DEFAULT_SPREADS_BY_FIRM).map(k => [k, { ...DEFAULT_SPREADS_BY_FIRM[k] }]));
    groups        = [];
    // Purge les clés localStorage d'autres uids (anti data-leakage sur device partagé)
    purgeForeignCache();
    _loadFromLocalStorage();
    // Q15 : retourne la promise pour que app-bootstrap puisse await avant le 1er render
    // (évite le flicker UI sur data legacy puis migrée). Backward-compat : si l'appelant
    // n'await pas, le comportement reste identique (load + migrate en arrière-plan).
    return _loadFromFirestore()
      .then(_migrateLegacyData)
      .catch(() => _migrateLegacyData());
  }

  // Migration auto pour les données legacy :
  //  - Comptes FTMO 1-Step créés avant v0.9.89 ont firmKey:'ftmo' au lieu de 'ftmo1step'
  //  - Trades anciens n'ont pas capital/feePerSide stockés → on les hydrate
  //    depuis le compte associé (apex) si présent
  // Tout est wrapped en try/catch pour ne JAMAIS bloquer le login.
  function _migrateLegacyData() {
    try {
      let migrated = false;
      // 1. firmKey legacy pour FTMO 1-Step
      if (Array.isArray(myAccounts)) {
        myAccounts.forEach(a => {
          if (a && a.firmKey === 'ftmo' && /1[-\s]step/i.test(String(a.name || ''))) {
            a.firmKey = 'ftmo1step';
            migrated = true;
          }
        });
      }
      // 1bis. v0.9.189 : migration accountType (par défaut 'prop' si absent)
      if (Array.isArray(myAccounts)) {
        myAccounts.forEach(a => {
          if (a && !a.accountType) {
            a.accountType = 'prop';
            migrated = true;
          }
        });
      }
      // 2. capital + feePerSide manquants sur les trades : hydrater depuis le compte
      if (Array.isArray(trades) && Array.isArray(myAccounts)) {
        const accByName = Object.fromEntries(myAccounts.filter(a => a && a.name).map(a => [a.name, a]));
        trades.forEach(t => {
          if (t && t.apex && (t.capital == null || t.feePerSide == null)) {
            const acc = accByName[t.apex];
            if (acc) {
              if (t.capital    == null) { t.capital    = (acc.capital || 0) + (acc.pnlOffset || 0); migrated = true; }
              if (t.feePerSide == null) { t.feePerSide = (acc.feePerSide != null) ? acc.feePerSide : 2.14; migrated = true; }
            }
          }
        });
      }
      if (migrated) {
        try { _saveMyAccounts(); } catch (e) { console.warn('[Migrate] saveMyAccounts failed', e); }
        try { _saveTrades(); }    catch (e) { console.warn('[Migrate] saveTrades failed', e); }
      }
    } catch (e) {
      console.warn('[Migrate] error (non-blocking)', e);
    }
  }

  function _loadFromLocalStorage() {
    const k = lk();
    const t  = lsGet(k.trades);
    const s  = lsGet(k.settings);
    const ma = lsGet(k.myAccounts);
    const spf = lsGet(k.spreadsByFirm);
    const g  = lsGet(k.groups);
    // SANITIZE au load : empêche un attaquant qui modifie localStorage manuellement
    // d'injecter du contenu non-validé (XSS via instrument, manualPnl absurde, etc.).
    if (Array.isArray(t)) {
      trades = t
        .filter(x => x && typeof x === 'object' && DIRS.has(x.direction) && OUTCOMES.has(x.outcome))
        .map(x => ({ ..._sanitizeTrade(x), id: String(x.id || _newTradeId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || _newTradeId() }))
        .slice(0, 10000);
    }
    if (s) {
      const { groqKey: _gk, ...safeS } = s;
      settings = { ...DEFAULT_SETTINGS, ...safeS };
    }
    if (Array.isArray(ma)) {
      myAccounts = ma
        .filter(x => x && typeof x === 'object' && typeof x.id === 'string')
        .map(x => ({ ..._sanitizeAccount(x), id: String(x.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) }))
        .filter(x => x.id)
        .slice(0, 100);
    }
    if (spf) Object.keys(DEFAULT_SPREADS_BY_FIRM).forEach(fk => {
      if (spf[fk]) spreadsByFirm[fk] = { ...DEFAULT_SPREADS_BY_FIRM[fk], ...spf[fk] };
    });
    if (Array.isArray(g)) {
      groups = g
        .filter(x => x && typeof x === 'object' && typeof x.id === 'string')
        .map(x => ({ ..._sanitizeGroupData(x), id: String(x.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) }))
        .filter(x => x.id)
        .slice(0, 100);
    }
    // _plan and _aiUsage are intentionally NOT loaded from localStorage:
    // always start as Basic/empty so localStorage manipulation cannot grant
    // temporary Pro access (e.g. adding extra accounts) before Firestore syncs.
    _mergeAccountTypeDefaults();
  }

  function _withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('Firestore timeout')), ms))]);
  }

  let _planLoaded = false;   // v0.9.314 : true après la 1ère résolution du plan (Firestore) → évite le flash « BASIC »
  async function _loadFromFirestore() {
    try {
      // Note : config/groq supprimé — la clé Groq vit désormais dans Google
      // Secret Manager côté Cloud Function. Plus aucune lecture client.
      const [tSnap, sSnap, maSnap, spfSnap, gSnap, planSnap, aiSnap, stripeSnap] = await _withTimeout(Promise.all([
        userDoc('trades').get(),
        userDoc('settings').get(),
        userDoc('myAccounts').get(),
        userDoc('spreadsByFirm').get(),
        userDoc('groups').get(),
        userDoc('plan').get(),
        userDoc('aiUsage').get(),
        userDoc('stripe').get(),   // v0.9.255 : info abonnement Stripe (read-only)
      ]), 10000);
      let changed = false;
      // v0.9.255 : info abonnement Stripe (customerId, status). Read-only côté client.
      if (stripeSnap.exists) {
        const sd = stripeSnap.data() || {};
        _stripe = {
          customerId:         typeof sd.customerId === 'string' ? sd.customerId : null,
          subscriptionStatus: typeof sd.subscriptionStatus === 'string' ? sd.subscriptionStatus : null,
          tier:               typeof sd.tier === 'string' ? sd.tier : null,
          currentPeriodEnd:   (typeof sd.currentPeriodEnd === 'number') ? sd.currentPeriodEnd : null,
          cancelAtPeriodEnd:  sd.cancelAtPeriodEnd === true,
          cycle:              (sd.cycle === 'monthly' || sd.cycle === 'yearly') ? sd.cycle : null,  // v0.9.317
        };
      }
      if (tSnap.exists) {
        const remoteTrades = Array.isArray(tSnap.data().items) ? tSnap.data().items : [];
        // Anti-corruption : si la version remote est anormalement réduite par rapport
        // au cache local (>50% perte sur >10 trades existants), on ne remplace PAS
        // et on dispatch un event pour alerter l'UI (modal "conflit de sync").
        const localCount = Array.isArray(trades) ? trades.length : 0;
        if (localCount > 10 && remoteTrades.length < localCount * 0.5) {
          console.warn('[Store] Anomalie sync trades : remote=' + remoteTrades.length + ' << local=' + localCount + '. Pas d\'overwrite.');
          try {
            window.dispatchEvent(new CustomEvent('store:syncConflict', {
              detail: { collection: 'trades', local: localCount, remote: remoteTrades.length }
            }));
          } catch {}
        } else {
          trades = remoteTrades;
        }
        changed = true;
      }
      if (sSnap.exists) {
        const raw = sSnap.data();
        settings = {
          capital:    (typeof raw.capital    === 'number' && isFinite(raw.capital))    ? Math.max(0, Math.min(1e9, raw.capital))    : DEFAULT_SETTINGS.capital,
          contracts:  (typeof raw.contracts  === 'number' && isFinite(raw.contracts))  ? Math.max(0.01, Math.min(999, raw.contracts))  : DEFAULT_SETTINGS.contracts,
          instrument: (typeof raw.instrument === 'string' && raw.instrument.length > 0) ? String(raw.instrument).replace(/[^A-Za-z0-9/. _-]/g, '').slice(0, 20) || DEFAULT_SETTINGS.instrument : DEFAULT_SETTINGS.instrument,
          tradingTypes: _sanitizeTradingTypes(raw.tradingTypes),
          favInstruments: Array.isArray(raw.favInstruments)
            ? [...new Set(raw.favInstruments.filter(x => typeof x === 'string' && x.length <= 20))].slice(0, 100)
            : [],
        };
        changed = true;
      }
      if (maSnap.exists)  { myAccounts  = maSnap.data().items || [];  changed = true; }
      if (spfSnap.exists) {
        const d = spfSnap.data();
        Object.keys(DEFAULT_SPREADS_BY_FIRM).forEach(fk => {
          if (d[fk] && typeof d[fk] === 'object') {
            const safe = { ...DEFAULT_SPREADS_BY_FIRM[fk] };
            Object.keys(DEFAULT_SPREADS_BY_FIRM[fk]).forEach(instr => {
              if (instr in d[fk]) {
                const v = parseFloat(d[fk][instr]);
                if (isFinite(v) && v >= 0) safe[instr] = v;
              }
            });
            spreadsByFirm[fk] = safe;
          }
        });
        changed = true;
      }
      if (gSnap.exists)  { groups = gSnap.data().items || []; changed = true; }
      if (planSnap.exists) {
        const raw = planSnap.data() || {};
        const wasTier = _plan.tier;
        // Whitelist STRICTE des champs lus depuis Firestore (anti-injection si
        // une CF future écrivait des champs arbitraires : isAdmin, unlimited, etc.)
        const planValue = raw.plan === 'pro' ? 'pro' : 'basic';
        // Migration v0.9.211 : ajout du champ `tier` (4 valeurs).
        // - Si tier explicite et valide → garde
        // - Si plan='pro' legacy → tier='beta' (Founding Members = accès tout)
        // - Sinon → tier='trader'
        let tier = (typeof raw.tier === 'string' && VALID_TIERS.has(raw.tier)) ? raw.tier
                 : (planValue === 'pro' ? 'beta' : 'trader');
        _plan = {
          plan:        planValue,
          tier:        tier,
          activatedAt: (typeof raw.activatedAt === 'number' && isFinite(raw.activatedAt)) ? raw.activatedAt : null,
          codeHash:    typeof raw.codeHash === 'string' ? raw.codeHash.slice(0, 128) : null,
        };
        if (_plan.tier !== wasTier) {
          window.dispatchEvent(new CustomEvent('store:planChanged'));
        }
        changed = true;
      }
      if (aiSnap.exists) {
        const aiData = aiSnap.data();
        _aiUsage = {
          date:  (typeof aiData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aiData.date)) ? aiData.date : '',
          count: (typeof aiData.count === 'number' && isFinite(aiData.count)) ? Math.max(0, Math.floor(aiData.count)) : 0,
        };
        changed = true;
      }

      if (changed) {
        const k = lk();
        lsSet(k.trades,        trades);
        lsSet(k.settings,      settings);
        lsSet(k.myAccounts,    myAccounts);
        lsSet(k.spreadsByFirm, spreadsByFirm);
        lsSet(k.groups,        groups);
        window.dispatchEvent(new CustomEvent('store:synced'));
      }
    } catch (e) {
      console.warn('[Store] Firestore read error (mode hors-ligne ?)', e);
    } finally {
      // v0.9.314 : plan « résolu » (succès OU erreur) → l'UI affiche le vrai palier
      // au lieu d'un flash « BASIC » pendant le chargement Firestore.
      _planLoaded = true;
      window.dispatchEvent(new CustomEvent('store:planChanged'));
    }
  }

  function _mergeAccountTypeDefaults() {
    const defaultById = Object.fromEntries(DEFAULT_ACCOUNT_TYPES.map(d => [d.id, d]));
    const storedIds   = new Set(accountTypes.map(x => x.id));
    accountTypes = accountTypes.map(x => x.firmKey ? x : { ...x, firmKey: (defaultById[x.id]?.firmKey || x.id.split('-')[0]) });
    DEFAULT_ACCOUNT_TYPES.forEach(def => { if (!storedIds.has(def.id)) accountTypes.push(def); });
  }

  // ── Trades ───────────────────────────────────────────────────────────────────
  function getTrades()      { return trades; }
  function getTradeById(id) { return trades.find(t => t.id === id) || null; }

  function _saveTrades() {
    lsSet(lk().trades, trades);
    fbSet('trades', { items: trades });
  }

  const DIRS     = new Set(['long', 'short']);
  const OUTCOMES = new Set(['win', 'loss', 'be', 'open']);
  function _safeNum(v, min, max, def) {
    // Accepte virgule décimale (CSV européens) ET valeurs notation scientifique
    // raisonnable. Reject Infinity, NaN, et tout ce qui ne parse pas en finite.
    const s = typeof v === 'string' ? v.replace(',', '.') : v;
    const n = parseFloat(s);
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }
  // Escape HTML : appliqué dès le storage sur les champs libres (setup, notes)
  // → invariant fail-safe : même si un renderer oublie escHtml, pas de XSS stocké.
  function _escHtmlStore(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Inverse de _escHtmlStore — utilisé à l'import JSON pour éviter le double-escape
  // (un export ZeldTrade contient des `&lt;` qui doivent redevenir `<` avant re-escape).
  // Ordre crucial : `&amp;` en DERNIER sinon double-décodage.
  function _unescHtmlStore(s) {
    return String(s || '')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>').replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
  function _sanitizeTrade(raw) {
    // Borne manualPnl en fonction du risque calculable (anti-injection P&L absurde) :
    // si on peut estimer le risk en $, on borne ±50× ce risque ; sinon ±100k$ (1 trade plafond).
    const ctx = (function() {
      const e = _safeNum(raw.entry, -1e7, 1e7, null);
      const s = _safeNum(raw.sl,    -1e7, 1e7, null);
      const c = _safeNum(raw.contracts, 0.01, 999, 1);
      if (e == null || s == null) return 1e5;
      const pts  = Math.abs(e - s);
      const inst = String(raw.instrument || 'MES1');
      const pv   = (typeof Calc !== 'undefined' && Calc.pointValue) ? Calc.pointValue(inst) : 5;
      return Math.max(100, Math.min(1e6, pts * pv * c * 50));
    })();
    const out = {
      instrument: String(raw.instrument || '').replace(/[^A-Za-z0-9/. _-]/g, '').slice(0, 20) || 'MES1',
      direction:  DIRS.has(raw.direction)    ? raw.direction : 'long',
      outcome:    OUTCOMES.has(raw.outcome)  ? raw.outcome   : 'open',
      contracts:  Math.max(0.01, Math.min(999, parseFloat(raw.contracts) || 0.01)),
      // setup/notes : escape HTML au stockage (fail-safe contre future XSS si un renderer oublie escHtml)
      setup:      _escHtmlStore(raw.setup).slice(0, 500),
      notes:      _escHtmlStore(raw.notes).slice(0, 2000),
      apex:       String(raw.apex   || '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 100),
      date:       (() => {
        try {
          const d = new Date(raw.date);
          const now = Date.now();
          // Floor 1990 : couvre 35+ ans de trading. Anti epoch 0 / dates négatives,
          // tout en laissant les traders expérimentés importer leur historique long.
          const floor = new Date('1990-01-01').getTime();
          // Rejette dates futures (>1 jour), dates antérieures à 1990, formats ISO non attendus
          if (isFinite(d)
              && /^\d{4}-\d{2}-\d{2}T/.test(raw.date)
              && d.getTime() <= now + 24*3600*1000
              && d.getTime() >= floor)
            return raw.date;
          return new Date().toISOString();
        } catch { return new Date().toISOString(); }
      })(),
      entry:      raw.entry      != null ? _safeNum(raw.entry,      -1e7, 1e7, null) : null,
      sl:         raw.sl         != null ? _safeNum(raw.sl,         -1e7, 1e7, null) : null,
      tp1:        raw.tp1        != null ? _safeNum(raw.tp1,        -1e7, 1e7, null) : null,
      tp2:        raw.tp2        != null ? _safeNum(raw.tp2,        -1e7, 1e7, null) : null,
      tp3:        raw.tp3        != null ? _safeNum(raw.tp3,        -1e7, 1e7, null) : null,
      exitPrice:  raw.exitPrice  != null ? _safeNum(raw.exitPrice,  -1e7, 1e7, null) : null,
      // manualPnl ne s'applique QU'aux trades fermés (forcé à null si open) + borné par ctx
      manualPnl:  (raw.manualPnl != null && (raw.outcome && raw.outcome !== 'open'))
                    ? _safeNum(raw.manualPnl, -ctx, ctx, null) : null,
      // Partial close (scale-out) — LEGACY : sortir X% de la position à partialPrice.
      // Conservé pour rétro-compat des anciens trades (lecture).
      partialPercent: raw.partialPercent != null ? _safeNum(raw.partialPercent, 1, 99, null) : null,
      partialPrice:   raw.partialPrice   != null ? _safeNum(raw.partialPrice,  -1e7, 1e7, null) : null,
      // v0.9.250 : Sorties partielles multiples [{ price, lots }] (jusqu'à 10).
      // Chaque tranche validée : price > 0, lots > 0. Le runner restant
      // (contracts - Σlots) sort à exitPrice/outcome.
      partials: (() => {
        if (!Array.isArray(raw.partials)) return null;
        const out = raw.partials.slice(0, 10).map(p => {
          if (!p) return null;
          const price = _safeNum(p.price, -1e7, 1e7, null);
          const lots  = _safeNum(p.lots,  0,    999,  null);
          if (price == null || lots == null || lots <= 0) return null;
          return { price, lots };
        }).filter(Boolean);
        return out.length ? out : null;
      })(),
      // Snapshot du compte au moment du trade — préservé pour cohérence historique
      capital:    raw.capital    != null ? _safeNum(raw.capital,     0,    1e9, null) : null,
      feePerSide: raw.feePerSide != null ? _safeNum(raw.feePerSide,  0,    100, null) : null,
      spreadCost: raw.spreadCost != null ? _safeNum(raw.spreadCost,  0,    1000, null) : null,
      pnl:        raw.pnl        != null ? _safeNum(raw.pnl,        -1e7, 1e7, null) : null,
      rr:         raw.rr         != null ? _safeNum(raw.rr,         -100, 100, null) : null,
    };
    // groupId optionnel : utilisé pour lier les trades multi-comptes via groupes
    if (raw.groupId) {
      const safe = String(raw.groupId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (safe) out.groupId = safe;
    }
    // v0.9.247 : helper local pour valider un path Storage de screenshot.
    // Format attendu : `users/{uid}/trades/{tradeId}/screenshot{_N}.(jpg|png|webp)`
    // (slot 0 = screenshot.jpg legacy, slots 1-2 = screenshot_N.jpg)
    function _safeShotPath(p) {
      if (!p || typeof p !== 'string' || !_uid || _uid === 'default') return null;
      const safe = p.replace(/[^a-zA-Z0-9/_.\-]/g, '').slice(0, 200);
      const expectedPrefix = `users/${_uid}/trades/`;
      if (!safe.startsWith(expectedPrefix)) return null;
      // v0.9.249 (S-NEW-19) : slots bornés à 1-2 (slot 0 = screenshot.jpg sans
      // suffixe). Aligné sur la regex de storage.rules — max 3 captures.
      if (!/\/screenshot(_[12])?\.(jpe?g|png|webp)$/.test(safe)) return null;
      return safe;
    }

    // screenshotPath optionnel : path Storage du screenshot slot 0 (legacy compat)
    if (raw.screenshotPath) {
      const safe = _safeShotPath(raw.screenshotPath);
      if (safe) out.screenshotPath = safe;
    }
    // v0.9.247 : screenshotPaths[] (jusqu'à 3 captures, plan Pro).
    // Chaque path validé indépendamment. Cap à 3 pour respecter la limite tier max.
    if (Array.isArray(raw.screenshotPaths)) {
      const cleaned = raw.screenshotPaths
        .slice(0, 3)
        .map(_safeShotPath)
        .filter(Boolean);
      if (cleaned.length) out.screenshotPaths = cleaned;
    }
    return out;
  }

  function _newTradeId() {
    // Anti-collision : timestamp + 6 chars random base36
    // (évite les IDs identiques pour Promise.all en groupe)
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function addTrade(trade) {
    // Si `trade.id` est fourni et bien formé, on le réutilise (utile pour le flow
    // screenshot où on génère l'ID avant l'upload). Sinon ID auto-généré.
    const providedId = trade && trade.id && /^[a-zA-Z0-9_-]{1,64}$/.test(String(trade.id))
                         ? String(trade.id) : null;
    const t = { ..._sanitizeTrade(trade), id: providedId || _newTradeId() };
    if (!t.date) t.date = new Date().toISOString();
    trades.unshift(t);
    _saveTrades();
    if (window.Analytics) Analytics.track('trade_created');
    return t;
  }

  // Ajoute plusieurs trades d'un coup avec UN SEUL write Firestore.
  // Utilisé par le mode groupe (1 trade dupliqué sur N comptes) — sans ça,
  // chaque addTrade() faisait un write Firestore complet = N writes pour rien.
  function addTradesBatch(tradeList) {
    if (!Array.isArray(tradeList) || tradeList.length === 0) return [];
    const created = tradeList.map(trade => {
      const providedId = trade && trade.id && /^[a-zA-Z0-9_-]{1,64}$/.test(String(trade.id))
                           ? String(trade.id) : null;
      const t = { ..._sanitizeTrade(trade), id: providedId || _newTradeId() };
      if (!t.date) t.date = new Date().toISOString();
      return t;
    });
    // Insère tous les nouveaux en tête, puis 1 seul save
    trades = [...created, ...trades];
    _saveTrades();
    return created;
  }

  function updateTrade(id, data) {
    const idx = trades.findIndex(t => t.id === id);
    if (idx < 0) return null;
    // Merge des données partielles AVANT sanitize : on ne perd jamais les
    // champs existants si `data` ne les contient pas (ex : updateTrade(id, { outcome: 'win' })
    // ne doit pas écraser apex/setup/notes/contracts/instrument/etc.).
    const merged = { ...trades[idx], ...data };
    trades[idx] = { ..._sanitizeTrade(merged), id: trades[idx].id };
    _saveTrades();
    return trades[idx];
  }

  function deleteTrade(id) {
    const t = trades.find(tr => tr.id === id);
    // v0.9.247 : supprime TOUTES les captures Storage (slot 0 legacy + extras)
    const toDelete = new Set();
    if (t && t.screenshotPath) toDelete.add(t.screenshotPath);
    if (t && Array.isArray(t.screenshotPaths)) t.screenshotPaths.forEach(p => p && toDelete.add(p));
    toDelete.forEach(p => deleteTradeScreenshot(p).catch(() => null));
    trades = trades.filter(t => t.id !== id);
    _saveTrades();
  }

  // ── Screenshots de trades (Firebase Storage) ────────────────────────────────
  // v0.9.285 : la règle Storage exige `request.auth.token.email_verified == true`
  // (ajoutée le 20/05 avec le gating Pro). Or le claim `email_verified` du token
  // peut être PÉRIMÉ : un user vérifié côté Firebase Auth (ex. marqué par l'admin,
  // ou ayant cliqué le lien de vérif depuis sa boîte mail dans un autre onglet)
  // garde un token cachant `email_verified: false` tant qu'il n'est pas rafraîchi.
  // Résultat : upload refusé (storage/unauthorized) alors que le compte EST vérifié.
  // → On force un refresh du token juste avant l'upload. Throttle 30s pour ne pas
  //   multiplier les appels réseau quand on uploade plusieurs slots d'un coup.
  let _lastTokenRefresh = 0;
  async function _refreshTokenForUpload() {
    try {
      const u = (typeof firebase !== 'undefined') && firebase.auth && firebase.auth().currentUser;
      if (!u) return;
      if (Date.now() - _lastTokenRefresh < 30_000) return;
      await u.getIdToken(true);
      _lastTokenRefresh = Date.now();
    } catch (e) {
      // Non bloquant : si le refresh échoue, le put() échouera proprement ensuite.
      console.warn('[Store] refresh token avant upload échoué', e && e.message);
    }
  }

  // Upload un Blob (image compressée en JPEG) pour un trade donné.
  // v0.9.246 : ajout d'un slot index optionnel pour supporter N screenshots
  // par trade. slot=0 garde le chemin legacy `screenshot.jpg` (rétro-compat),
  // slot>=1 utilise `screenshot_{idx}.jpg`.
  async function uploadTradeScreenshot(tradeId, blob, slot) {
    if (!_fbStorage || !_uid || _uid === 'default') throw new Error('Storage non disponible');
    if (!tradeId || !/^[a-zA-Z0-9_-]{1,64}$/.test(tradeId)) throw new Error('Invalid tradeId');
    if (!(blob instanceof Blob)) throw new Error('Invalid blob');
    if (blob.size > 2 * 1024 * 1024) throw new Error('Image trop grande (>2 MB)');
    const idx = Number.isInteger(slot) && slot >= 0 ? slot : 0;
    if (idx >= getMaxScreenshots()) throw new Error('Limite screenshots du plan atteinte');
    // v0.9.285 : garantit un token frais (claim email_verified à jour) avant l'upload.
    await _refreshTokenForUpload();
    const fileName = idx === 0 ? 'screenshot.jpg' : `screenshot_${idx}.jpg`;
    const path = `users/${_uid}/trades/${tradeId}/${fileName}`;
    const ref  = _fbStorage.ref(path);
    const opts = { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' };
    try {
      await ref.put(blob, opts);
    } catch (e) {
      // v0.9.320 : un storage/unauthorized peut venir d'un token dont le claim
      // email_verified est PÉRIMÉ (compte pourtant vérifié + Pro), ou du throttle 30s
      // qui a fait sauter le refresh préventif. On force un refresh HORS throttle et on
      // retente UNE fois avant d'abandonner.
      if (e && (e.code === 'storage/unauthorized' || /unauthorized/i.test(e.message || ''))) {
        try {
          const u = (typeof firebase !== 'undefined') && firebase.auth && firebase.auth().currentUser;
          if (u) { await u.getIdToken(true); _lastTokenRefresh = Date.now(); }
        } catch (_) { /* ignore */ }
        await ref.put(blob, opts);   // 2ᵉ essai ; si re-throw → remonte à l'appelant
      } else {
        throw e;
      }
    }
    return path;
  }

  // v0.9.246 : nombre max de screenshots par trade selon le tier de l'user.
  // Trader = 0, Funded/Elite/Beta = 3.
  function getMaxScreenshots() {
    return (getLimits() && getLimits().maxScreenshots) || 0;
  }
  function canSaveScreenshots() { return getMaxScreenshots() > 0; }

  // Récupère l'URL signée (téléchargement) du screenshot d'un trade.
  async function getTradeScreenshotUrl(path) {
    if (!_fbStorage || !path) return null;
    try {
      return await _fbStorage.ref(path).getDownloadURL();
    } catch (e) {
      console.warn('[Store] getTradeScreenshotUrl', e && e.message);
      return null;
    }
  }

  // Supprime un screenshot Storage (best-effort).
  async function deleteTradeScreenshot(path) {
    if (!_fbStorage || !path) return;
    try { await _fbStorage.ref(path).delete(); }
    catch (e) {
      // 404 (déjà supprimé) ou permission → on log et on ignore
      if (e && e.code !== 'storage/object-not-found') {
        console.warn('[Store] deleteTradeScreenshot', e && e.message);
      }
    }
  }

  function importTrades(arr) {
    if (!Array.isArray(arr)) return 0;
    // Tous les trades importés passent par _sanitizeTrade — même validation
    // stricte que addTrade/updateTrade : ranges, regex, types, taille.
    // Q52 : on UNESCAPE setup/notes AVANT le sanitize pour éviter le double-escape
    // (un export ZeldTrade contient déjà des `&lt;` ; le sanitize re-escape → `&amp;lt;`).
    const sanitized = arr
      .filter(t => t && typeof t === 'object' && DIRS.has(t.direction) && OUTCOMES.has(t.outcome))
      .map(t => {
        const id = String(t.id || _newTradeId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || _newTradeId();
        const unescaped = {
          ...t,
          setup: typeof t.setup === 'string' ? _unescHtmlStore(t.setup) : t.setup,
          notes: typeof t.notes === 'string' ? _unescHtmlStore(t.notes) : t.notes,
        };
        return { ..._sanitizeTrade(unescaped), id };
      });
    trades = [...sanitized, ...trades].slice(0, 10000);
    _saveTrades();
    return sanitized.length;
  }
  function clearTrades()     { trades = []; _saveTrades(); }
  function exportJSON()      { return JSON.stringify(trades, null, 2); }
  // Export complet RGPD-compatible (droit à la portabilité, art. 20)
  function exportFullJSON() {
    return JSON.stringify({
      exportedAt:     new Date().toISOString(),
      uid:            _uid,
      plan:           { plan: _plan.plan, activatedAt: _plan.activatedAt || null },
      settings,
      trades,
      myAccounts,
      groups,
      spreadsByFirm,
    }, null, 2);
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  function getSettings()        { return { ...settings }; }
  function getTradingTypes()    { return Array.isArray(settings.tradingTypes) ? [...settings.tradingTypes] : null; }
  function getSelectedFirms()   { return Array.isArray(settings.selectedFirms) ? [...settings.selectedFirms] : []; }
  function isSetupDone()        { return !!settings.setupDone; }

  // v0.9.396 — Focus app-wide. Renvoie le scope courant SI l'entité visée existe
  // encore (sinon → null = Global, pour éviter un dashboard vide après suppression).
  const _FIRM_ORDER = ['apex', 'topstep', 'ftmo', 'ftmo1step', 'lucid', 'fpips'];
  function getFocusScope() {
    const f = settings.focusScope;
    if (!f || typeof f !== 'string') return null;
    if (f.startsWith('acc:'))  return getMyAccountByName(f.slice(4)) ? f : null;
    if (f.startsWith('grp:'))  return getGroupById(f.slice(4)) ? f : null;
    if (f.startsWith('firm:')) return getMyFirms().some(x => x.key === f.slice(5)) ? f : null;
    return null;
  }
  function setFocusScope(v)     { updateSettings({ focusScope: (v == null ? null : v) }); }

  // Liste des prop firms « de l'user » : déclarées (selectedFirms) ∪ celles de ses
  // comptes (firmKey). Ordonnées. → alimente le sélecteur Focus + l'onboarding.
  function getMyFirms() {
    const keys = new Set([...(settings.selectedFirms || []), ...myAccounts.map(a => a.firmKey).filter(Boolean)]);
    return _FIRM_ORDER.filter(k => keys.has(k)).map(k => ({ key: k, name: (DEFAULT_PROP_FIRMS[k] && DEFAULT_PROP_FIRMS[k].name) || k }));
  }

  // Trades filtrés par le Focus courant. list optionnelle (défaut = tous les trades).
  function scopedTrades(list) {
    const all = Array.isArray(list) ? list : getTrades();
    const f = getFocusScope();
    if (!f) return all;
    if (f.startsWith('acc:')) { const n = f.slice(4); return all.filter(t => t.apex === n); }
    if (f.startsWith('firm:')) {
      const key = f.slice(5);
      const names = new Set(myAccounts.filter(a => a.firmKey === key).map(a => a.name));
      return all.filter(t => names.has(t.apex));
    }
    if (f.startsWith('grp:')) {
      const g = getGroupById(f.slice(4));
      if (!g) return all;
      const names = new Set((g.accountIds || []).map(id => { const a = getMyAccountById(id); return a && a.name; }).filter(Boolean));
      return all.filter(t => names.has(t.apex));
    }
    return all;
  }
  const SETTINGS_ALLOWED = new Set(['capital','contracts','instrument','tradingTypes','favInstruments','selectedFirms','focusScope','setupDone']);
  const _FIRM_KEYS = new Set(Object.keys(DEFAULT_PROP_FIRMS));
  function updateSettings(data) {
    const safe = Object.create(null);
    for (const [k, v] of Object.entries(data)) {
      if (!SETTINGS_ALLOWED.has(k)) continue;
      if (k === 'capital')         safe.capital    = _safeNum(v, 0, 1e9, 50000);
      else if (k === 'contracts')  safe.contracts  = _safeNum(v, 0.01, 999, 1);
      else if (k === 'instrument') safe.instrument = String(v).replace(/[^A-Za-z0-9/. _-]/g,'').slice(0,20) || 'MES1';
      else if (k === 'tradingTypes') { const tt = _sanitizeTradingTypes(v); if (tt) safe.tradingTypes = tt; }
      else if (k === 'favInstruments') {
        // v0.9.312 : favoris d'instruments (symbols), cap 100, validés strings courtes
        safe.favInstruments = Array.isArray(v)
          ? [...new Set(v.filter(x => typeof x === 'string' && x.length <= 20))].slice(0, 100)
          : [];
      }
      else if (k === 'selectedFirms') {
        // v0.9.396 : prop firms déclarées — uniquement des clés de firm connues.
        safe.selectedFirms = Array.isArray(v)
          ? [...new Set(v.filter(x => _FIRM_KEYS.has(x)))]
          : [];
      }
      else if (k === 'focusScope') {
        // v0.9.396 : null/'' = Global ; sinon string préfixée acc:/grp:/firm: (max 80 car.)
        safe.focusScope = (typeof v === 'string' && /^(acc:|grp:|firm:).+/.test(v)) ? v.slice(0, 80) : null;
      }
      else if (k === 'setupDone') safe.setupDone = !!v;
    }
    settings = { ...settings, ...safe };
    lsSet(lk().settings, settings);
    fbSet('settings', settings);
  }

  // ── Account types (presets statiques) ────────────────────────────────────────
  function getAccountTypes()      { return accountTypes.map(a => ({ ...a })); }
  function getAccountByName(name) { return accountTypes.find(a => a.name === name) || null; }
  function updateAccountTypes(arr){ accountTypes = arr; }

  // ── Prop Firms ───────────────────────────────────────────────────────────────
  function getPropFirms()        { return DEFAULT_PROP_FIRMS; }
  function getPropFirmByKey(key) { return DEFAULT_PROP_FIRMS[key] || null; }

  // ── Mes comptes ───────────────────────────────────────────────────────────────
  // v0.9.366 : getMyAccounts() ne renvoie QUE les comptes actifs (non archivés).
  // Les comptes éval « passés » sont archivés → getArchivedAccounts(). getMyAccountById/
  // ByName cherchent dans TOUS les comptes (résolution des trades historiques incluse).
  function getMyAccounts()          { return myAccounts.filter(a => !a.archived).map(a => ({ ...a })); }
  function getArchivedAccounts()    { return myAccounts.filter(a => a.archived).map(a => ({ ...a })); }
  function getMyAccountById(id)     { return myAccounts.find(a => a.id === id) || null; }
  function getMyAccountByName(name) { return myAccounts.find(a => a.name === name) || null; }

  function _saveMyAccounts() {
    lsSet(lk().myAccounts, myAccounts);
    fbSet('myAccounts', { items: myAccounts });
  }

  function _sanitizeAccountName(name) {
    // Whitelist stricte : alphanumérique + . _ - espace (anti-injection HTML/CSS,
    // anti-formule CSV, anti-bidi Unicode).
    return String(name || '').replace(/[^A-Za-z0-9._\- ]/g, '').trim().slice(0, 50);
  }
  // v0.9.189 (Phase 1) : ajout des champs pour Personal + Crypto
  const VALID_ACCOUNT_TYPES = new Set(['prop', 'personal', 'crypto']);
  const VALID_CRYPTO_PLATFORMS = new Set(['binance', 'coinbase']);
  const VALID_CRYPTO_MODES = new Set(['spot', 'perpetual']);

  function _sanitizeAccount(data) {
    const s = {};
    if (data.name        !== undefined) s.name           = _sanitizeAccountName(data.name);
    if (data.accountType !== undefined) s.accountType    = VALID_ACCOUNT_TYPES.has(data.accountType) ? data.accountType : 'prop';
    if (data.firmKey     !== undefined) s.firmKey        = String(data.firmKey || '').replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    if (data.status      !== undefined) s.status         = ['evaluation','funded'].includes(data.status) ? data.status : 'evaluation';
    if (data.capital     !== undefined) s.capital        = _safeNum(data.capital,       0, 1e9, 0);
    if (data.profitTarget!== undefined) s.profitTarget   = _safeNum(data.profitTarget,  0, 1e7, 0);
    if (data.maxDrawdown !== undefined) s.maxDrawdown    = _safeNum(data.maxDrawdown,   0, 1e7, 0);
    if (data.dailyLossLimit!==undefined)s.dailyLossLimit = _safeNum(data.dailyLossLimit,0, 1e7, 0);
    if (data.maxContracts!== undefined) s.maxContracts   = _safeNum(data.maxContracts,  1, 999, 1);
    if (data.feePerSide  !== undefined) s.feePerSide     = _safeNum(data.feePerSide,    0, 100, 0);
    if (data.pnlOffset   !== undefined) s.pnlOffset      = _safeNum(data.pnlOffset,    -1e7, 1e7, 0);
    // Crypto-specific fields (v0.9.189)
    if (data.cryptoPlatform !== undefined) s.cryptoPlatform = VALID_CRYPTO_PLATFORMS.has(data.cryptoPlatform) ? data.cryptoPlatform : '';
    if (data.cryptoMode     !== undefined) s.cryptoMode     = VALID_CRYPTO_MODES.has(data.cryptoMode) ? data.cryptoMode : 'spot';
    if (data.leverage       !== undefined) s.leverage       = _safeNum(data.leverage,       1, 125, 1);
    if (data.feeMakerPct    !== undefined) s.feeMakerPct    = _safeNum(data.feeMakerPct,    0,   5, 0.02);  // % en valeur (0.02 = 0.02%)
    if (data.feeTakerPct    !== undefined) s.feeTakerPct    = _safeNum(data.feeTakerPct,    0,   5, 0.05);
    // v0.9.366 — cycle de vie éval → financé : un compte éval validé est archivé
    // (`archived`/`passed`) et un compte financé est créé. Champs whitelistés ici pour
    // survivre au re-sanitize au chargement localStorage.
    if (data.archived       !== undefined) s.archived       = !!data.archived;
    if (data.archivedAt     !== undefined) s.archivedAt     = _safeNum(data.archivedAt, 0, 1e15, 0);
    if (data.passed         !== undefined) s.passed         = !!data.passed;
    if (data.fundedFrom     !== undefined) s.fundedFrom     = _sanitizeAccountName(data.fundedFrom);
    return s;
  }
  function _isAccountNameTaken(name, excludeId) {
    const n = String(name || '').trim().toLowerCase();
    return myAccounts.some(a => a.id !== excludeId && String(a.name || '').trim().toLowerCase() === n);
  }

  function addMyAccount(data) {
    // Enforce quota Pro côté Store (l'UI le check aussi, et Firestore en backup)
    if (!canAddAccount()) {
      throw new Error('Quota atteint : passe en Funded ou Elite pour ajouter plus de comptes.');
    }
    const sanitized = _sanitizeAccount(data);
    if (_isAccountNameTaken(sanitized.name)) {
      throw new Error('Un compte avec ce nom existe déjà.');
    }
    // STRICT : on ne spread PAS `data` (sinon n'importe quel champ injecté
    // depuis l'UI/DevTools serait persisté dans Firestore — bypass sanitize).
    const a = { ...sanitized, id: 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) };
    myAccounts.push(a);
    _saveMyAccounts();
    if (window.Analytics) Analytics.track('account_created', { label: a.accountType || 'prop' });
    return a;
  }
  function updateMyAccount(id, data) {
    const i = myAccounts.findIndex(a => a.id === id);
    if (i < 0) return null;
    const sanitized = _sanitizeAccount(data);
    if (sanitized.name && _isAccountNameTaken(sanitized.name, id)) {
      throw new Error('Un autre compte porte déjà ce nom.');
    }
    // STRICT : merge sanitized par-dessus l'existant SEULEMENT (pas de data brut).
    myAccounts[i] = { ...myAccounts[i], ...sanitized };
    _saveMyAccounts();
    return myAccounts[i];
  }
  function deleteMyAccount(id) { myAccounts = myAccounts.filter(a => a.id !== id); _saveMyAccounts(); }

  // ── Passage éval → financé (v0.9.366) ───────────────────────────────────────
  // Quand un compte d'éval prop firm valide son objectif : on ARCHIVE l'éval (il garde
  // son nom → ses trades restent attachés pour l'historique) et on crée le compte
  // FINANCÉ correspondant (règles PA dérivées de la table prop firm), à 0 P&L (nom neuf
  // = aucun trade lié), placé en tête (principal) et pré-sélectionné par défaut.
  function convertEvalToFunded(id) {
    const acc = myAccounts.find(a => a.id === id);
    if (!acc)                  throw new Error('Compte introuvable.');
    if (acc.archived)          throw new Error('Ce compte est déjà archivé.');
    if (acc.status === 'funded') throw new Error('Ce compte est déjà financé.');

    // Dérive les règles du compte financé (PA) depuis DEFAULT_PROP_FIRMS (match par capital).
    const firm   = DEFAULT_PROP_FIRMS[acc.firmKey];
    const preset = (firm && firm.accounts) ? firm.accounts.find(p => p.capital === acc.capital) : null;
    const paContracts = (preset && preset.maxContractsPA) ? preset.maxContractsPA : acc.maxContracts;

    // 1. Archive l'éval (nom conservé → trades historiques restent rattachés).
    acc.archived   = true;
    acc.archivedAt = Date.now();
    acc.passed     = true;

    // 2. Crée le compte financé — nom unique pour démarrer à 0 trade / 0 P&L.
    //    Suffixe whitelist-safe (_sanitizeAccountName retire —, $, accents) → « - Funded ».
    const base = _sanitizeAccountName((acc.name || 'Compte') + ' - Funded');
    let name = base, n = 2;
    while (_isAccountNameTaken(name)) { name = _sanitizeAccountName(base + ' ' + n); n++; }

    const sanitized = _sanitizeAccount({
      name,
      accountType: acc.accountType || 'prop',
      firmKey:     acc.firmKey,
      status:      'funded',
      capital:     acc.capital,
      profitTarget: 0,                  // financé : plus d'objectif à passer
      maxDrawdown:  acc.maxDrawdown,    // conservé (se fige côté prop firm)
      dailyLossLimit: acc.dailyLossLimit,
      maxContracts: paContracts,        // PA : souvent réduit (ex. Apex 50k : 6 → 4)
      feePerSide:   acc.feePerSide,
      pnlOffset:    0,                  // démarre à 0
      fundedFrom:   acc.name,
    });
    const funded = { ...sanitized, id: 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) };
    myAccounts.unshift(funded);         // en tête = principal
    _saveMyAccounts();

    // 3. Devient le compte par défaut (pré-sélectionné dans le wizard / dashboard).
    try { setLastWizardPrefs({ apex: funded.name }); } catch (e) {}
    if (window.Analytics) Analytics.track('eval_converted_funded', { label: acc.firmKey || 'prop' });
    return funded;
  }

  // ── Spreads ───────────────────────────────────────────────────────────────────
  function getSpreads()          { return { ...spreads }; }
  function updateSpreads(data)   { spreads = { ...spreads, ...data }; }

  function getSpreadsByFirm(key) { return { ...(spreadsByFirm[key] || DEFAULT_SPREADS) }; }
  function getAllSpreadsByFirm()  { return JSON.parse(JSON.stringify(spreadsByFirm)); }
  function updateSpreadsByFirm(key, data) {
    spreadsByFirm[key] = { ...(spreadsByFirm[key] || DEFAULT_SPREADS), ...data };
    lsSet(lk().spreadsByFirm, spreadsByFirm);
    fbSet('spreadsByFirm', spreadsByFirm);
  }

  // ── Groupes ───────────────────────────────────────────────────────────────────
  function getGroups()      { return groups.map(g => ({ ...g })); }
  function getGroupById(id) { return groups.find(g => g.id === id) || null; }

  function _saveGroups() {
    lsSet(lk().groups, groups);
    fbSet('groups', { items: groups });
  }

  function _sanitizeGroupName(name) {
    // Whitelist stricte (anti-injection HTML/CSV/bidi). Cohérent avec _sanitizeAccountName.
    return String(name || '').replace(/[^A-Za-z0-9._\- ]/g, '').trim().slice(0, 50);
  }
  function _sanitizeGroupData(data) {
    // STRICT : aucun champ arbitraire n'est passé (anti-injection via DevTools/import).
    const s = {};
    if (data.name !== undefined) s.name = _sanitizeGroupName(data.name);
    if (Array.isArray(data.accountIds)) {
      s.accountIds = data.accountIds
        .filter(id => typeof id === 'string')
        .map(id => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
        .filter(Boolean)
        .slice(0, 100);
    }
    return s;
  }
  function addGroup(data) {
    const clean = _sanitizeGroupData(data);
    const g = { ...clean, id: 'grp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) };
    groups.push(g);
    _saveGroups();
    return g;
  }
  function updateGroup(id, data) {
    const i = groups.findIndex(g => g.id === id);
    if (i < 0) return null;
    const clean = _sanitizeGroupData(data);
    groups[i] = { ...groups[i], ...clean };
    _saveGroups();
    return groups[i];
  }
  function deleteGroup(id) { groups = groups.filter(g => g.id !== id); _saveGroups(); }

  // ── Plan ─────────────────────────────────────────────────────────────────────
  async function _sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getPlanInfo() { return { ..._plan, limits: { ...getLimits() } }; }
  function isPro()       { return _plan.plan === 'pro'; }
  function getStripeInfo() { return { ..._stripe }; }   // v0.9.255 : info abonnement (read-only)
  // v0.9.256 : re-synchronise depuis Firestore (utilisé après un paiement Stripe,
  // le temps que le webhook écrive le doc `stripe`/`plan`). Dispatch store:synced /
  // store:planChanged comme le load initial. Renvoie une promise.
  function resync() { return _loadFromFirestore(); }
  // v0.9.211 — Nouveaux helpers tier-aware
  function getTier()     { return VALID_TIERS.has(_plan.tier) ? _plan.tier : 'trader'; }
  // v0.9.256 — Badge plan par tier (label + classe CSS couleur) pour la sidebar
  const TIER_BADGE = {
    trader: { label: 'TRADER', cls: 'plan-basic'  },
    funded: { label: 'FUNDED', cls: 'plan-funded' },
    elite:  { label: 'ELITE',  cls: 'plan-elite'  },
    beta:   { label: 'BÊTA',   cls: 'plan-beta'   },
  };
  function getTierBadge() { return TIER_BADGE[getTier()] || TIER_BADGE.trader; }
  function getLimits()   { return TIER_LIMITS[getTier()] || TIER_LIMITS.trader; }
  // v0.9.376 (TIER-RECAP) : diff des limites + features entre 2 paliers → liste de ce
  // qu'on gagne / perd au changement de palier. Données seulement (l'UI localise via i18n).
  function getTierRecap(from, to) {
    const lf = TIER_LIMITS[from] || TIER_LIMITS.trader;
    const lt = TIER_LIMITS[to]   || TIER_LIMITS.trader;
    const rank = { trader: 0, funded: 1, elite: 2, beta: 2 };
    const upgrade = (rank[to] || 0) >= (rank[from] || 0);
    const gained = [], lost = [];
    const fmt = n => n === Infinity ? '∞' : String(n);
    const limit = (k, vf, vt) => { if (vt !== vf) (vt > vf ? gained : lost).push({ k, from: fmt(vf), to: fmt(vt) }); };
    limit('accounts', lf.maxAccounts,    lt.maxAccounts);
    limit('ai',       lf.maxAiPerDay,    lt.maxAiPerDay);
    limit('shots',    lf.maxScreenshots, lt.maxScreenshots);
    Object.keys(TIER_FEATURES).forEach(feat => {
      const had = TIER_FEATURES[feat].includes(from);
      const has = TIER_FEATURES[feat].includes(to);
      if (has && !had) gained.push({ k: feat });
      if (!has && had) lost.push({ k: feat });
    });
    return { upgrade, gained, lost };
  }
  // canUseFeature('groups') → true/false selon le tier de l'user
  function canUseFeature(feat) {
    const allowed = TIER_FEATURES[feat];
    if (!allowed) return true; // pas listée = accès libre
    return allowed.includes(getTier());
  }

  let _proAttempts = 0;
  let _proThrottleUntil = 0;
  let _proInFlight = false;
  async function activatePro(code) {
    // Garde-fou type : si code n'est pas une string non-vide, return false direct
    // (sans toucher au throttle/lock, pour ne pas pénaliser un appel programmatique vide)
    if (typeof code !== 'string' || !code.trim()) return false;
    if (Date.now() < _proThrottleUntil) return 'throttled';
    // Lock anti-double-clic : empêche 2 activations parallèles (qui pourraient
    // dispatch 2 events planChanged et désynchroniser l'UI).
    if (_proInFlight) return 'throttled';
    _proInFlight = true;
    try {
      const normalized = code.trim().toUpperCase().replace(/[-\s]/g, '');
      if (!normalized) return false;
      const hash    = await _sha256(normalized);
      const hashDoc = await _fbDb.collection('proCodeHashes').doc(hash).get();
      if (!hashDoc.exists) {
        _proAttempts++;
        if (_proAttempts >= 3) { _proThrottleUntil = Date.now() + 60_000; _proAttempts = 0; }
        return false;
      }
      const hdata = hashDoc.data();
      // Constant-time string equality (défense en profondeur — timing attack théorique)
      const a = String(hdata.uid || ''), b = String(_uid || '');
      let diff = a.length ^ b.length;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
      }
      if (diff !== 0) {
        _proAttempts++;
        if (_proAttempts >= 3) { _proThrottleUntil = Date.now() + 60_000; _proAttempts = 0; }
        return false;
      }
      _proAttempts = 0;
      // v0.9.211 : les codes Pro existants donnent désormais accès `beta` (tier= 'beta')
      // = accès illimité à toutes les features. Workflow Founding Members inchangé côté UX.
      const info = { plan: 'pro', tier: 'beta', activatedAt: Date.now(), codeHash: hash };
      _plan = { ...info };
      await userDoc('plan').set(info);
      window.dispatchEvent(new CustomEvent('store:planChanged'));
      return true;
    } catch (e) {
      // Compte cette tentative comme échec (couvre le cas Firestore PERMISSION_DENIED
      // quand un user tente un code attribué à un autre uid)
      _proAttempts++;
      if (_proAttempts >= 3) { _proThrottleUntil = Date.now() + 60_000; _proAttempts = 0; }
      console.warn('[Store] activatePro error', e);
      return false;
    } finally {
      _proInFlight = false;
    }
  }

  // ── IA usage ─────────────────────────────────────────────────────────────────
  function getAIUsage()      { return { ..._aiUsage }; }
  function canAnalyzeToday() {
    const max = getLimits().maxAiPerDay;
    if (!isFinite(max) || max <= 0) return max > 0; // beta = Infinity = true
    if (max === Infinity) return true;
    const today = localToday();
    if (typeof _aiUsage.date === 'string' && _aiUsage.date > today) return false;
    return _aiUsage.date !== today || _aiUsage.count < max;
  }
  // Refetch aiUsage depuis Firestore (à appeler après une analyse réussie pour
  // que canAnalyzeToday() côté client reste cohérent avec l'état serveur)
  async function refreshAiUsage() {
    try {
      const snap = await userDoc('aiUsage').get();
      if (snap.exists) _aiUsage = snap.data() || _aiUsage;
    } catch {}
  }

  function canAddAccount() {
    const max = getLimits().maxAccounts;
    // v0.9.366 : seuls les comptes ACTIFS comptent dans le quota (un éval archivé/passé ne compte plus).
    const activeCount = myAccounts.filter(a => !a.archived).length;
    return max === Infinity || activeCount < max;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  // Winrate basé sur netPnl > 0 (cohérent avec UI.statsForTrades).
  // Un trade `be` avec partial profitable compte comme gagnant.
  // 1 seul passage par trade (perf : Calc.trade appelé 1 fois au lieu de 2-3).
  function getStats() {
    let closedCount = 0, winsCount = 0, totalPnL = 0, rrSum = 0;
    trades.forEach(t => {
      const c = Calc.trade(t);
      if (c.invalid) return;
      if (Number.isFinite(c.netPnl)) totalPnL += c.netPnl;
      if (Number.isFinite(c.rr))     rrSum    += c.rr;
      if (t.outcome === 'win' || t.outcome === 'loss' || t.outcome === 'be') {
        if (!c.estimated) {
          closedCount++;
          if (Number.isFinite(c.netPnl) && c.netPnl > 0) winsCount++;
        }
      }
    });
    return {
      totalPnL,
      winRate: closedCount ? (winsCount / closedCount) * 100 : null,
      avgRR:   trades.length ? rrSum / trades.length : 0,
      total:   trades.length,
      open:    trades.filter(t => t.outcome === 'open').length,
      wins:    winsCount,
      losses:  closedCount - winsCount,
    };
  }

  function clearLocalCache() {
    if (!_uid || _uid === 'default') return;
    Object.values(lk()).forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
  }

  // ── Wizard preferences (last used apex + instrument) ───────────────────────
  // Persisté en localStorage namespacé par uid. Lecture validée (compte doit
  // toujours exister, instrument doit être dans la whitelist).
  function _lastWizardKey() { return `ztrade_${_uid}_lastWizard`; }

  function getLastWizardPrefs() {
    if (!_uid || _uid === 'default') return null;
    let raw;
    try { raw = JSON.parse(localStorage.getItem(_lastWizardKey())); } catch { return null; }
    if (!raw || typeof raw !== 'object') return null;
    // Validation stricte : apex doit toujours exister dans myAccounts OU être un groupe valide
    let validApex = null;
    if (typeof raw.apex === 'string' && raw.apex.length <= 100) {
      if (raw.apex.startsWith('grp:')) {
        const gid = raw.apex.slice(4);
        if (groups.some(g => g.id === gid)) validApex = raw.apex;
      } else if (myAccounts.some(a => a.name === raw.apex)) {
        validApex = raw.apex;
      }
    }
    // Validation instrument : doit matcher le regex stricte du sanitize
    let validInstr = null;
    if (typeof raw.instrument === 'string' && /^[A-Za-z0-9/. _-]{1,20}$/.test(raw.instrument)) {
      validInstr = raw.instrument;
    }
    return { apex: validApex, instrument: validInstr };
  }

  function setLastWizardPrefs({ apex, instrument }) {
    if (!_uid || _uid === 'default') return;
    const safe = {
      apex:       typeof apex === 'string' ? apex.slice(0, 100) : null,
      instrument: typeof instrument === 'string' ? instrument.slice(0, 20) : null,
    };
    try { localStorage.setItem(_lastWizardKey(), JSON.stringify(safe)); } catch {}
  }

  // Purge toutes les clés ztrade_* d'AUTRES uids (anti data-leakage sur appareil
  // partagé : un user qui se reconnecte ne laisse pas traîner les données de
  // l'utilisateur précédent dans localStorage).
  function purgeForeignCache() {
    if (!_uid || _uid === 'default') return;
    const prefix = `ztrade_${_uid}_`;
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ztrade_') && !k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
    } catch {}
  }

  return {
    initForUser, clearLocalCache, purgeForeignCache,
    getTrades, getTradeById, addTrade, addTradesBatch, updateTrade, deleteTrade, importTrades, clearTrades, exportJSON, exportFullJSON,
    newTradeId: _newTradeId, uploadTradeScreenshot, getTradeScreenshotUrl, deleteTradeScreenshot,
    getMaxScreenshots, canSaveScreenshots,
    getSettings, getTradingTypes, updateSettings,
    getSelectedFirms, isSetupDone, getFocusScope, setFocusScope, getMyFirms, scopedTrades,
    getAccountTypes, getAccountByName, updateAccountTypes,
    getPropFirms, getPropFirmByKey,
    getMyAccounts, getArchivedAccounts, getMyAccountById, getMyAccountByName, addMyAccount, updateMyAccount, deleteMyAccount, convertEvalToFunded,
    getSpreads, updateSpreads, getSpreadsByFirm, getAllSpreadsByFirm, updateSpreadsByFirm,
    getGroups, getGroupById, addGroup, updateGroup, deleteGroup,
    getPlanInfo, isPro, getTier, getTierBadge, getLimits, getTierRecap, canUseFeature, getStripeInfo, resync, TIER_LIMITS, TIER_FEATURES,
    isPlanLoaded: () => _planLoaded,
    activatePro, canAnalyzeToday, refreshAiUsage, canAddAccount,
    getLastWizardPrefs, setLastWizardPrefs,
    getStats,
  };
})();
