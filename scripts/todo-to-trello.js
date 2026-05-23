#!/usr/bin/env node
/**
 * todo-to-trello.js — pousse les items « 🎯 Demandes user » de docs/TODO.md
 * vers TON board Trello existant (il n'en crée PAS de nouveau, il utilise tes listes).
 *
 * Comportement :
 *   - Nouvelles tâches actives → déposées dans une liste "backlog" (par défaut la
 *     DERNIÈRE liste du board, ex. « Plus tard »). Tu les remontes ensuite toi-même
 *     dans « Aujourd'hui » / « Cette semaine ».
 *   - Tâches déjà faites (✅) → dans une liste « Fait/Terminé » si tu en as une, sinon ignorées.
 *   - Idempotent : une carte déjà présente N'IMPORTE OÙ sur le board (même déplacée à
 *     la main par toi) n'est PAS recréée → ton tri manuel est respecté.
 *
 * ─ Config (JAMAIS commitée) : ~/.config/zeldtrade/trello  (chmod 600) ──────────
 *     key=TA_CLE_API
 *     token=TON_TOKEN
 *     board=https://trello.com/b/XXXX/ton-board
 *     list=À faire          # (optionnel) liste où déposer les tâches actives
 *     doinglist=En cours    # (optionnel) liste « en cours »
 *     donelist=Terminé      # (optionnel) liste où mettre les tâches faites
 *
 *   key + token : https://trello.com/power-ups/admin → "API key" + lien "Token".
 *
 * ─ Lancer ──────────────────────────────────────────────────────────────────
 *   Synchro TODO.md → board :        node scripts/todo-to-trello.js
 *   Basculer une tâche « En cours » : node scripts/todo-to-trello.js --doing CODE [CODE2 …]
 *     (déplace la carte vers « En cours », ou la crée là si absente du board)
 *   Pousser TOUT le TODO (faits inclus) : node scripts/todo-to-trello.js --all [--dry]
 *     (puces `- **…**` + findings `### CODE …` ; --dry = prévisualise sans créer)
 */
'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'zeldtrade', 'trello');
const TODO_PATH   = path.join(__dirname, '..', 'docs', 'TODO.md');
const API         = 'https://api.trello.com/1';

if (typeof fetch !== 'function') { console.error('✗ Node 18+ requis (fetch global).'); process.exit(1); }
function die(msg) { console.error('✗ ' + msg); process.exit(1); }

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    die(`Config absente : ${CONFIG_PATH}\n` +
        '  mkdir -p ~/.config/zeldtrade\n' +
        '  printf "key=XXX\\ntoken=YYY\\nboard=URL_DU_BOARD\\nlist=Plus tard\\n" > ~/.config/zeldtrade/trello\n' +
        '  chmod 600 ~/.config/zeldtrade/trello');
  }
  const cfg = {};
  for (const line of fs.readFileSync(CONFIG_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
    if (m) cfg[m[1].toLowerCase()] = m[2];
  }
  if (!cfg.key || !cfg.token || !cfg.board) die('Config incomplète : il faut key, token ET board.');
  const m = cfg.board.match(/trello\.com\/b\/([A-Za-z0-9]+)/);
  if (m) cfg.board = m[1];
  return cfg;
}

async function trello(method, endpoint, cfg, params = {}) {
  const url = new URL(API + endpoint);
  url.searchParams.set('key', cfg.key);
  url.searchParams.set('token', cfg.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status} ${(await res.text()).slice(0, 180)}`);
  return res.status === 204 ? null : res.json();
}

/** Items de la section « 🎯 Demandes user » de TODO.md. */
function parseTodos() {
  const md = fs.readFileSync(TODO_PATH, 'utf8');
  const start = md.indexOf('🎯 Demandes user');
  if (start < 0) return [];
  const rest = md.slice(start);
  const next = rest.indexOf('\n### ', 10);
  const block = next > 0 ? rest.slice(0, next) : rest;
  const items = [];
  const re = /^- \*\*([A-Z0-9-]+)\s*—\s*(.+?)\*\*\s*(.*)$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    items.push({
      code:  m[1],
      title: m[2].replace(/\s*\.\s*$/, '').trim(),
      desc:  (m[3] || '').replace(/`/g, '').trim(),
      done:  /✅/.test(m[0]),
    });
  }
  return items;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Nettoie un libellé : enlève ~~, **, `, emojis de statut, ponctuation de tête. */
function cleanText(s) {
  return String(s)
    .replace(/~~/g, '').replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/[✅🔴🟠🟡🟢⚪⏳🛠🔧💡🐛🎯📋💼💰🔒📊📚🧪⚙🌍🆕🔄✨⭐]/gu, ' ')
    .replace(/^[\s—–:\-]+/, '')
    .replace(/\s+/g, ' ').trim();
}
/** Titre nettoyé + sans préfixe de priorité (CRITIQUE/HAUT/MOYEN/BAS) ni date de tête. */
function cleanTitle(s) {
  let t = cleanText(s);
  t = t.replace(/^(CRITIQUE|HAUT|MOYEN|BAS)\b\s*[—–\-:]*\s*/i, '');
  t = t.replace(/^\d{4}-\d{2}-\d{2}[^—–]*[—–]\s*/, '');
  t = t.replace(/^\(v[\d.]+\)\s*[—–\-]?\s*/i, '');
  return t.trim();
}
/** Une ligne est-elle « faite » ? (✅ / barré / FAIT / Résolu / Déjà fait / N/A) */
function isDone(line) { return /✅|~~|\bFAIT\b|Résolu|RÉSOLU|Déjà fait|\bN\/A\b/.test(line); }
/** Clé « code » d'un nom de carte (préfixe OFF-1, Q25, B-NEW-01…). null si pas un vrai code. */
function codeKey(name) {
  const m = String(name).match(/^([A-Z0-9][A-Z0-9/\-]*)/);
  if (!m) return null;
  const k = m[1].toUpperCase();
  return k.length >= 2 ? k : null;
}
/** Clé normalisée (anti-doublon robuste, même pour les items sans code). */
function normKey(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70); }

/** TOUS les items du TODO : puces `- **…**` ET en-têtes de findings `### CODE — …`. */
function parseAllTodos() {
  const lines = fs.readFileSync(TODO_PATH, 'utf8').split('\n');
  const items = [];
  let section = '', sectionDone = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      sectionDone = /✅|\bfaits?\b|résolu|terminé/i.test(h[2]);
      if (h[1] === '##') section = cleanText(h[2]);
      if (h[1] === '###') {
        // finding : ### [~~]CODE[~~] — Title  (CODE doit contenir un chiffre)
        const f = h[2].match(/^(~~)?\s*([A-Za-z][A-Za-z0-9/\-]*\d[A-Za-z0-9/\-]*)\s*(~~)?\s*[—–]\s*(.+)$/);
        if (f) items.push({ code: f[2].toUpperCase(), title: cleanTitle(f[4]), desc: '', section, done: isDone(line) });
      }
      continue;
    }
    const b = line.match(/^- \*\*(.+?)\*\*\s*(.*)$/);
    if (b) {
      const bold = b[1].trim(), rest = b[2] || '';
      let code = null, title = bold;
      const cm = bold.match(/^([A-Za-z0-9][A-Za-z0-9/\-]*)\s*[—–]\s*(.+)$/);
      if (cm && cm[1].length <= 22) { code = cm[1].toUpperCase(); title = cm[2]; }
      items.push({ code, title: cleanTitle(title), desc: cleanText(rest).slice(0, 300), section, done: isDone(line) || sectionDone });
    }
  }
  return items;
}

(async () => {
  const cfg   = loadConfig();
  const todos = parseTodos();

  const lists = await trello('GET', `/boards/${cfg.board}/lists`, cfg, { fields: 'name' });
  if (!lists.length) die('Ce board n\'a aucune liste. Ajoute au moins une liste (ex. « Plus tard »).');

  const findList = (name) => name ? lists.find(l => l.name.toLowerCase().includes(String(name).toLowerCase())) : null;
  // Tâches faites → liste `donelist`, sinon une liste qui ressemble à « fait/terminé/done/✅ », sinon rien
  const doneList   = findList(cfg.donelist) || lists.find(l => /fait|termin|done|✅/i.test(l.name)) || null;
  // Liste « En cours » → `doinglist` de la config, sinon une liste qui ressemble à « en cours/in progress/doing/wip »
  const doingList  = findList(cfg.doinglist) || lists.find(l => /en.?cours|in.?progress|doing|wip/i.test(l.name)) || null;
  // Tâches actives → liste `list` de la config, sinon la 1ʳᵉ liste qui n'est ni « Terminé » ni « En cours », sinon la 1ʳᵉ
  const activeList = findList(cfg.list) || lists.find(l => l !== doneList && l !== doingList) || lists[0];

  // Cartes existantes sur TOUT le board (anti-doublon + respecte ton tri manuel).
  // Indexées par CODE (préfixe) ET par nom normalisé (pour les items sans code).
  const existingByCode = {}, existingByNorm = {};
  for (const l of lists) {
    const cards = await trello('GET', `/lists/${l.id}/cards`, cfg, { fields: 'name' });
    for (const c of cards) {
      const ck = codeKey(c.name); if (ck) existingByCode[ck] = c;
      existingByNorm[normKey(c.name)] = c;
    }
  }

  // ── Mode « --doing CODE [CODE2 …] » : bascule une tâche en « En cours » (la crée si absente) ──
  const args = process.argv.slice(2);
  const di = args.findIndex(a => a === '--doing' || a === '--start');
  if (di >= 0) {
    const codes = args.slice(di + 1).filter(a => !a.startsWith('-')).map(c => c.toUpperCase());
    if (!codes.length) die('Usage : node scripts/todo-to-trello.js --doing CODE [CODE2 …]');
    if (!doingList) die('Aucune liste « En cours » trouvée. Ajoute-la au board, ou mets `doinglist=NomDeLaListe` dans la config.');
    for (const code of codes) {
      const card = existingByCode[code];
      const todo = todos.find(t => t.code === code);
      if (card) {
        await trello('PUT', `/cards/${card.id}`, cfg, { idList: doingList.id });
        console.log(`  → [${doingList.name}] ${card.name} (déplacée)`);
      } else {
        const name = (todo ? `${todo.code} — ${todo.title}` : code).slice(0, 250);
        await trello('POST', '/cards', cfg, { idList: doingList.id, name, desc: (todo ? todo.desc : '').slice(0, 16000) });
        console.log(`  + [${doingList.name}] ${name} (créée)`);
      }
    }
    return;
  }

  // ── Mode « --all » : pousse TOUT le TODO (puces + findings ###), faits inclus ──
  //    --dry pour prévisualiser sans rien créer.
  if (args.includes('--all')) {
    const all = parseAllTodos();
    if (!all.length) die('Aucun item détecté dans docs/TODO.md.');
    const exists = (name, code) => (code && existingByCode[code]) || existingByNorm[normKey(name)];
    const toCreate = [];
    const seen = new Set();
    for (const t of all) {
      const name = (t.code ? `${t.code} — ${t.title}` : t.title).slice(0, 250).trim();
      if (name.length < 3) continue;
      if (exists(name, t.code)) continue;
      const nk = normKey(name);
      if (seen.has(nk)) continue;                 // doublon interne à ce run
      seen.add(nk);
      const target = t.done ? doneList : activeList;
      if (!target) continue;                       // faite mais pas de liste Terminé
      toCreate.push({ name, desc: (t.section ? `[${t.section}]\n\n` : '') + (t.desc || ''), done: t.done, target });
    }
    const nDone = toCreate.filter(c => c.done).length;
    console.log(`TODO : ${all.length} items détectés ; ${toCreate.length} à créer (le reste déjà sur le board).`);
    console.log(`  → ${toCreate.length - nDone} vers « ${activeList.name} »` +
                (doneList ? `, ${nDone} vers « ${doneList.name} »` : `, ${nDone} faite(s) ignorée(s) (pas de liste Terminé)`) + '.\n');
    if (args.includes('--dry')) {
      toCreate.forEach(c => console.log(`  [${c.done ? (doneList && doneList.name) : activeList.name}] ${c.name}`));
      console.log(`\n(DRY-RUN — rien créé. Relance sans --dry pour pousser.)`);
      return;
    }
    let n = 0;
    for (const c of toCreate) {
      await trello('POST', '/cards', cfg, { idList: c.target.id, name: c.name, desc: c.desc.slice(0, 16000) });
      n++; if (n % 15 === 0) console.log(`  … ${n}/${toCreate.length}`);
      await sleep(120);                            // throttle anti rate-limit Trello
    }
    console.log(`\n✓ ${n} carte(s) créée(s).`);
    return;
  }

  // ── Mode normal : synchro TODO.md → board ──
  if (!todos.length) die('Aucun item dans la section « 🎯 Demandes user » de docs/TODO.md.');
  console.log(`Board : ${lists.length} liste(s). Actives → « ${activeList.name} »` +
              (doingList ? `, en cours → « ${doingList.name} »` : '') +
              (doneList ? `, faites → « ${doneList.name} »` : ', faites → ignorées (pas de liste Fait)') + '.\n');

  let created = 0, present = 0, ignoredDone = 0;
  for (const t of todos) {
    if (existingByCode[t.code]) { present++; continue; }      // déjà sur le board → on n'y touche pas
    const target = t.done ? doneList : activeList;
    if (!target) { ignoredDone++; continue; }                 // faite mais pas de liste Fait
    const name = `${t.code} — ${t.title}`.slice(0, 250);
    await trello('POST', '/cards', cfg, { idList: target.id, name, desc: t.desc.slice(0, 16000) });
    created++; console.log(`  + [${target.name}] ${name}`);
  }
  console.log(`\n✓ ${created} créée(s), ${present} déjà présente(s)` +
              (ignoredDone ? `, ${ignoredDone} faite(s) ignorée(s)` : '') + '.');
})().catch(e => die(e.message));
