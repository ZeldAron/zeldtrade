// ─── TESTS Calc — ZeldTrade ──────────────────────────────────────────────────
// Suite de tests pour calc.js — simule des trades réalistes et vérifie
// les calculs P&L, R:R, risk, partial close contre des valeurs attendues.
//
// Source des specs : CME Group officielles + standards CFD MT4/MT5 (FTMO/FundingPips)
//
// Exécution : node test/calc.test.js

const fs = require('fs');
const path = require('path');

// Charge calc.js et l'évalue dans un contexte qui expose Calc
const calcSrc = fs.readFileSync(path.join(__dirname, '../src/js/calc.js'), 'utf8');
const Calc = new Function(calcSrc + '\nreturn Calc;')();

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function approx(a, b, tol = 0.01) {
  if (a === null && b === null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

function check(label, actual, expected, tol = 0.01) {
  const ok = typeof expected === 'number' || expected === null
    ? approx(actual, expected, tol)
    : actual === expected;
  if (ok) {
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + label + ' = ' + actual);
  } else {
    failed++;
    failures.push({ label, actual, expected });
    console.log('  \x1b[31m✗\x1b[0m ' + label + ' = ' + actual + '  \x1b[33m(attendu: ' + expected + ')\x1b[0m');
  }
}

function section(name) {
  console.log('\n\x1b[36m━━ ' + name + ' ━━\x1b[0m');
}

// ─── 1. Futures CME — MES1 (Micro E-mini S&P 500, $5/pt) ─────────────────────
section('MES1 — long simple, outcome=win');
{
  // Long 5000→5020, SL 4990. 1 contrat. fees = 2.14 × 2 = $4.28, spread = $0
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14, spreadCost: 0,
    outcome: 'win',
  });
  check('riskPts',    c.riskPts,    10);
  check('rewardPts',  c.rewardPts,  20);
  check('rr',         c.rr,         2);
  check('riskUSD',    c.riskUSD,    50);     // 10pts × $5 × 1
  check('rewardUSD',  c.rewardUSD,  100);    // 20pts × $5 × 1
  check('riskPct',    c.riskPct,    0.1);    // $50 / $50000 = 0.1%
  check('commFees',   c.commFees,   4.28);
  check('totalFees',  c.totalFees,  4.28);
  check('pnl (win)',  c.pnl,        100);    // gagne le reward
  check('netPnl',     c.netPnl,     95.72);  // 100 - 4.28
  check('estimated',  c.estimated,  true);   // pas d'exitPrice explicite
}

section('MES1 — short simple, outcome=loss');
{
  // Short 5000→SL 5010. 1 contrat
  const c = Calc.trade({
    direction: 'short', entry: 5000, sl: 5010, tp1: 4980,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    outcome: 'loss',
  });
  check('riskPts',   c.riskPts,   10);
  check('rewardPts', c.rewardPts, 20);
  check('rr',        c.rr,        2);
  check('riskUSD',   c.riskUSD,   50);
  check('pnl (loss)', c.pnl,      -50);     // touche SL
  check('netPnl',    c.netPnl,    -54.28);  // -50 - 4.28
}

section('MES1 — BE (sortie au prix d\'entrée)');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    outcome: 'be',
  });
  check('pnl (BE)',  c.pnl,    0);
  check('netPnl',    c.netPnl, -4.28);  // les fees restent dues
}

// ─── 2. Futures CME — ES1 (E-mini S&P 500, $50/pt) ─────────────────────────────
section('ES1 — long 10 points, 2 contrats');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4995, tp1: 5010,
    instrument: 'ES1', contracts: 2, capital: 100000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   5);
  check('rewardPts', c.rewardPts, 10);
  check('riskUSD',   c.riskUSD,   500);   // 5pts × $50 × 2 contrats
  check('rewardUSD', c.rewardUSD, 1000);  // 10pts × $50 × 2
  check('pnl',       c.pnl,       1000);
  check('commFees',  c.commFees,  8.56);  // 2.14 × 2 × 2 contrats
  check('netPnl',    c.netPnl,    991.44);
}

// ─── 3. Futures CME — NQ1 (E-mini Nasdaq, $20/pt) ──────────────────────────────
section('NQ1 — short 50 pts, 1 contrat');
{
  const c = Calc.trade({
    direction: 'short', entry: 18000, sl: 18050, tp1: 17900,
    instrument: 'NQ1', contracts: 1, capital: 50000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   50);
  check('rewardPts', c.rewardPts, 100);
  check('riskUSD',   c.riskUSD,   1000);  // 50 × $20 × 1
  check('rewardUSD', c.rewardUSD, 2000);  // 100 × $20 × 1
  check('rr',        c.rr,        2);
  check('riskPct',   c.riskPct,   2);     // 1000/50000 = 2%
  check('apexOk',    c.apexOk,    true);
}

// ─── 4. Futures CME — MGC1 (Micro Gold, $10/$1) ────────────────────────────────
section('MGC1 — long $5 move, 1 contrat');
{
  const c = Calc.trade({
    direction: 'long', entry: 2400, sl: 2395, tp1: 2410,
    instrument: 'MGC1', contracts: 1, capital: 25000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   5);
  check('rewardPts', c.rewardPts, 10);
  check('riskUSD',   c.riskUSD,   50);   // 5 × $10 × 1
  check('rewardUSD', c.rewardUSD, 100);  // 10 × $10 × 1
}

// ─── 5. Futures CME — GC1 (Gold, $100/$1) ──────────────────────────────────────
section('GC1 — long, $2 move, 1 contrat');
{
  const c = Calc.trade({
    direction: 'long', entry: 2400, sl: 2398, tp1: 2404,
    instrument: 'GC1', contracts: 1, capital: 50000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   200);  // 2 × $100 × 1
  check('rewardUSD', c.rewardUSD, 400);
}

// ─── 6. Futures CME — CL1 (Crude Oil, $1000/$1) ────────────────────────────────
section('CL1 — long $0.50 move, 1 contrat');
{
  const c = Calc.trade({
    direction: 'long', entry: 75, sl: 74.5, tp1: 76,
    instrument: 'CL1', contracts: 1, capital: 100000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   0.5);
  check('rewardPts', c.rewardPts, 1);
  check('riskUSD',   c.riskUSD,   500);   // 0.5 × $1000 × 1
  check('rewardUSD', c.rewardUSD, 1000);  // 1 × $1000 × 1
}

// ─── 7. Futures CME — MCL1 (Micro Crude, $100/$1) ──────────────────────────────
section('MCL1 — long $0.50 move, 2 contrats');
{
  const c = Calc.trade({
    direction: 'long', entry: 75, sl: 74.5, tp1: 76,
    instrument: 'MCL1', contracts: 2, capital: 25000,
    feePerSide: 2.14, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   100);  // 0.5 × $100 × 2
  check('rewardUSD', c.rewardUSD, 200);
}

// ─── 8. CFD — XAUUSD (Gold, $100 par $1) ───────────────────────────────────────
section('XAUUSD — long, $5 move, 0.5 lot');
{
  const c = Calc.trade({
    direction: 'long', entry: 2400, sl: 2395, tp1: 2410,
    instrument: 'XAUUSD', contracts: 0.5, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   5);
  check('rewardPts', c.rewardPts, 10);
  check('riskUSD',   c.riskUSD,   250);  // 5 × $100 × 0.5
  check('rewardUSD', c.rewardUSD, 500);
}

// ─── 9. CFD — US30 (Dow, $1/pt, 1 lot — contract size FTMO = 1 depuis v0.9.416) ─
section('US30 — long 50 pts, 1 lot');
{
  const c = Calc.trade({
    direction: 'long', entry: 38000, sl: 37950, tp1: 38100,
    instrument: 'US30', contracts: 1, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   50);
  check('rewardPts', c.rewardPts, 100);
  check('riskUSD',   c.riskUSD,   50);   // 50 × $1 × 1 (v0.9.416 : US30 5→1, contract size FTMO)
  check('rewardUSD', c.rewardUSD, 100);
}

// ─── 10. CFD — US500 (S&P 500, $1/pt) ─────────────────────────────────────────
section('US500 — short 10 pts, 1 lot');
{
  const c = Calc.trade({
    direction: 'short', entry: 5000, sl: 5010, tp1: 4980,
    instrument: 'US500', contracts: 1, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   10);
  check('rewardUSD', c.rewardUSD, 20);
}

// ─── 11. Forex — EURUSD (1 pip = $10/lot) ──────────────────────────────────────
section('EURUSD — long, 20 pips, 1 lot');
{
  // 1 pip = 0.0001. Move de 20 pips = 0.0020
  const c = Calc.trade({
    direction: 'long', entry: 1.0800, sl: 1.0790, tp1: 1.0820,
    instrument: 'EURUSD', contracts: 1, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskPts',   c.riskPts,   0.001, 0.0001);     // 10 pips = 0.0010
  check('rewardPts', c.rewardPts, 0.002, 0.0001);     // 20 pips = 0.0020
  check('riskUSD',   c.riskUSD,   100, 0.5);          // 0.0010 × 100000 × 1 = $100
  check('rewardUSD', c.rewardUSD, 200, 0.5);
}

// ─── 12. Forex — GBPUSD (1 pip = $10/lot) ──────────────────────────────────────
section('GBPUSD — short, 30 pips, 0.5 lot');
{
  const c = Calc.trade({
    direction: 'short', entry: 1.2600, sl: 1.2620, tp1: 1.2570,
    instrument: 'GBPUSD', contracts: 0.5, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   100, 0.5);  // 0.0020 × 100000 × 0.5 = $100
  check('rewardUSD', c.rewardUSD, 150, 0.5);  // 0.0030 × 100000 × 0.5 = $150
}

// ─── 13. CFD — USOIL (1 lot = 1000 barils) ────────────────────────────────────
section('USOIL — long $0.50 move, 1 lot');
{
  const c = Calc.trade({
    direction: 'long', entry: 75, sl: 74.5, tp1: 76,
    instrument: 'USOIL', contracts: 1, capital: 50000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   500);   // 0.5 × $1000 × 1
  check('rewardUSD', c.rewardUSD, 1000);
}

// ─── 14. Apex risk checks ─────────────────────────────────────────────────────
section('Apex risk — riskPct check ($1000 risk sur $50k = 2%)');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4900, tp1: 5200,
    instrument: 'MES1', contracts: 2, capital: 50000,
    feePerSide: 2.14, outcome: 'open',
  });
  check('riskUSD',   c.riskUSD,  1000);  // 100 × $5 × 2 = $1000
  check('riskPct',   c.riskPct,  2);
  check('apexOk',    c.apexOk,   true);  // 2.0% exactement = ok limit
  check('apexWarn',  c.apexWarn, true);  // > 1.5%
}

section('Apex risk — risk excessif (>2%) → !apexOk');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4500, tp1: 5500,
    instrument: 'MES1', contracts: 2, capital: 50000,
    feePerSide: 2.14, outcome: 'open',
  });
  check('riskUSD',   c.riskUSD,  5000);  // 500 × $5 × 2 = $5000
  check('riskPct',   c.riskPct,  10);
  check('apexOk',    c.apexOk,   false);
}

// ─── 15. ExitPrice explicite ──────────────────────────────────────────────────
section('ExitPrice — sortie partielle au TP1 réel (long, MES1)');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    exitPrice: 5015,  // sortie à mi-chemin du TP1
    outcome: 'win',
  });
  check('pnl',       c.pnl,        75);     // 15 × 5 × 1
  check('netPnl',    c.netPnl,     70.72);  // 75 - 4.28
  check('estimated', c.estimated,  false);
}

// ─── 16. manualPnl override ───────────────────────────────────────────────────
section('manualPnl — override le calcul (-$150 sur perte réelle)');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14, manualPnl: -150,
    outcome: 'loss',
  });
  check('netPnl', c.netPnl, -150);            // l'utilisateur sait
  check('pnl',    c.pnl,    -145.72);         // brut reconstitué -150 + 4.28
}

// ─── 17. PARTIAL CLOSE — 50% à mi-chemin, reste BE ──────────────────────────
section('Partial close — 50% à 5010, reste à BE (long MES1)');
{
  // Long entry 5000, SL 4990, TP 5020
  // Partial : 50% pris à 5010 (mi-chemin) → profit partial = 50% × 10pts × $5 = $25
  // Reste : 50% jusqu'à BE (exitPrice=5000) → profit reste = 50% × 0 = $0
  // Total brut : $25
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    partialPercent: 50, partialPrice: 5010,
    exitPrice: 5000,  // reste sorti à BE
    outcome: 'be',
  });
  check('hasPartial',     c.hasPartial,     true);
  check('partialPercent', c.partialPercent, 50);
  check('partialPrice',   c.partialPrice,   5010);
  check('pnl (partial+BE)', c.pnl,    25);    // 0.5 × 10pts × 5 + 0.5 × 0 = 25
  check('netPnl',         c.netPnl,         20.72);  // 25 - 4.28
}

section('Partial close — 30% à TP1, reste full TP1');
{
  // Long entry 5000, SL 4990, TP 5020
  // Partial : 30% à 5020 (TP1) → 0.3 × 20 × $5 = $30
  // Reste : 70% jusqu'à 5020 (full TP1) → 0.7 × 20 × $5 = $70
  // Total : $100
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    partialPercent: 30, partialPrice: 5020,
    exitPrice: 5020,
    outcome: 'win',
  });
  check('pnl (partial+TP)', c.pnl, 100);  // équivalent à pas de partial
  check('netPnl',           c.netPnl, 95.72);
}

section('Partial close — 70% à BE, reste SL (perte réduite)');
{
  // Short entry 5000, SL 5010, TP 4980
  // Partial : 70% à 5000 (BE) → 0
  // Reste : 30% jusqu'à 5010 (SL) → 0.3 × -10 × $5 = -$15
  // Total : -$15
  const c = Calc.trade({
    direction: 'short', entry: 5000, sl: 5010, tp1: 4980,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14,
    partialPercent: 70, partialPrice: 5000,
    exitPrice: 5010,
    outcome: 'loss',
  });
  check('pnl (partial+SL)', c.pnl, -15);
  check('netPnl',           c.netPnl, -19.28);
}

// ─── 18. Fees + spreads combinés ──────────────────────────────────────────────
section('Fees + spread cost combinés');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 2, capital: 50000,
    feePerSide: 3.5, spreadCost: 1.25,  // par contrat
    outcome: 'win',
  });
  check('commFees',  c.commFees,  14);    // 3.5 × 2 sides × 2 contrats
  check('spreadFees', c.spreadFees, 2.5); // 1.25 × 2 contrats
  check('totalFees', c.totalFees, 16.5);
  check('pnl',       c.pnl,       200);   // 20 × $5 × 2
  check('netPnl',    c.netPnl,    183.5); // 200 - 16.5
}

// ─── 19. Open trade — P&L estimé sur TP1 potentiel ────────────────────────────
section('Open trade — pnl estimé sur tp1');
{
  const c = Calc.trade({
    direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
    instrument: 'MES1', contracts: 1, capital: 50000,
    feePerSide: 2.14, outcome: 'open',
  });
  check('estimated', c.estimated, true);
  check('pnl',       c.pnl,       100);  // estimation TP1
}

// ─── 20. CFD lots fractionnaires ──────────────────────────────────────────────
section('XAUUSD — lot 0.1 (très petit)');
{
  const c = Calc.trade({
    direction: 'long', entry: 2400, sl: 2395, tp1: 2410,
    instrument: 'XAUUSD', contracts: 0.1, capital: 5000,
    feePerSide: 0, outcome: 'win',
  });
  check('riskUSD',   c.riskUSD,   50);   // 5 × 100 × 0.1
  check('rewardUSD', c.rewardUSD, 100);
}

// ─── 21. Trailing floor Apex ──────────────────────────────────────────────────
section('Trailing floor — Apex $50k vide (aucun trade)');
{
  const r = Calc.trailingFloor(
    { capital: 50000, firmKey: 'apex', pnlOffset: 0 },
    []
  );
  check('startBalance',  r.startBalance, 50000);
  check('floor initial', r.floor,        48000);  // 50000 - 2000 drawdown
  check('drawdown',      r.drawdown,     2000);
  check('safetyNet',     r.safetyNet,    2100);
  check('hwm',           r.hwm,          50000);
}

section('Trailing floor — Apex après +$1500 closed → HWM monte');
{
  const trades = [
    {
      direction: 'long', entry: 5000, sl: 4990, tp1: 5020,
      instrument: 'MES1', contracts: 3, capital: 50000,
      feePerSide: 2.14, outcome: 'win',
      exitPrice: 5020,  // pour que c.estimated soit false
      date: '2026-05-01T10:00:00.000Z',
    },
  ];
  // Brut = 20pts × $5 × 3 = $300, net = 300 - (2.14×2×3) = 300 - 12.84 = $287.16
  // Pas $1500 mais OK pour le test
  const r = Calc.trailingFloor(
    { capital: 50000, firmKey: 'apex', pnlOffset: 0 },
    trades
  );
  check('currentBalance', r.currentBalance, 50287.16);
  check('hwm', r.hwm,                       50287.16);
  check('floor (hwm - dd)', r.floor,        48287.16);
}

section('Trailing floor — FTMO 2-Step (static drawdown)');
{
  const r = Calc.trailingFloor(
    { capital: 100000, firmKey: 'ftmo', maxDrawdown: 10000, pnlOffset: 0 },
    []
  );
  check('isStatic',      r.isStatic, true);
  check('floor (static)', r.floor,  90000);    // 100000 - 10000
}

// ─── Synthèse ────────────────────────────────────────────────────────────────
console.log('\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log(`\x1b[32m✓ Passed: ${passed}\x1b[0m  \x1b[31m✗ Failed: ${failed}\x1b[0m  Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n\x1b[31m━━ ÉCHECS ━━\x1b[0m');
  failures.forEach(f => {
    console.log(`  - ${f.label}: got ${f.actual}, expected ${f.expected}`);
  });
  process.exit(1);
} else {
  console.log('\n\x1b[32m🎉 Tous les tests passent !\x1b[0m');
  process.exit(0);
}
