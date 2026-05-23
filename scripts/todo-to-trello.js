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

  // Cartes existantes sur TOUT le board (anti-doublon + respecte ton tri manuel)
  const existing = {};
  for (const l of lists) {
    const cards = await trello('GET', `/lists/${l.id}/cards`, cfg, { fields: 'name' });
    for (const c of cards) { const cm = c.name.match(/^([A-Z0-9-]+)/); if (cm) existing[cm[1]] = c; }
  }

  // ── Mode « --doing CODE [CODE2 …] » : bascule une tâche en « En cours » (la crée si absente) ──
  const args = process.argv.slice(2);
  const di = args.findIndex(a => a === '--doing' || a === '--start');
  if (di >= 0) {
    const codes = args.slice(di + 1).filter(a => !a.startsWith('-')).map(c => c.toUpperCase());
    if (!codes.length) die('Usage : node scripts/todo-to-trello.js --doing CODE [CODE2 …]');
    if (!doingList) die('Aucune liste « En cours » trouvée. Ajoute-la au board, ou mets `doinglist=NomDeLaListe` dans la config.');
    for (const code of codes) {
      const card = existing[code];
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

  // ── Mode normal : synchro TODO.md → board ──
  if (!todos.length) die('Aucun item dans la section « 🎯 Demandes user » de docs/TODO.md.');
  console.log(`Board : ${lists.length} liste(s). Actives → « ${activeList.name} »` +
              (doingList ? `, en cours → « ${doingList.name} »` : '') +
              (doneList ? `, faites → « ${doneList.name} »` : ', faites → ignorées (pas de liste Fait)') + '.\n');

  let created = 0, present = 0, ignoredDone = 0;
  for (const t of todos) {
    if (existing[t.code]) { present++; continue; }            // déjà sur le board → on n'y touche pas
    const target = t.done ? doneList : activeList;
    if (!target) { ignoredDone++; continue; }                 // faite mais pas de liste Fait
    const name = `${t.code} — ${t.title}`.slice(0, 250);
    await trello('POST', '/cards', cfg, { idList: target.id, name, desc: t.desc.slice(0, 16000) });
    created++; console.log(`  + [${target.name}] ${name}`);
  }
  console.log(`\n✓ ${created} créée(s), ${present} déjà présente(s)` +
              (ignoredDone ? `, ${ignoredDone} faite(s) ignorée(s)` : '') + '.');
})().catch(e => die(e.message));
