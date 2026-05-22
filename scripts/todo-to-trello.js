#!/usr/bin/env node
/**
 * todo-to-trello.js — pousse les items « 🎯 Demandes user » de docs/TODO.md
 * vers un board Trello (listes « 📋 À faire » et « ✅ Fait »).
 *
 * ─ Config (JAMAIS commitée — clés perso) ─────────────────────────────────────
 *   Fichier : ~/.config/zeldtrade/trello   (chmod 600)
 *     key=TA_CLE_API
 *     token=TON_TOKEN
 *     board=ID_OU_URL_DU_BOARD
 *
 *   Obtenir key + token :
 *     1. https://trello.com/power-ups/admin  → crée un "Power-Up" (ou ouvre-en un)
 *        → onglet "API key" → copie ta **API key**.
 *     2. Sur la même page, clique le lien "Token" (ou "manually generate a Token")
 *        → autorise → copie le **token**.
 *   board : l'URL de ton board (https://trello.com/b/XXXXXX/mon-board) — le script
 *           en extrait l'identifiant tout seul.
 *
 * ─ Lancer ────────────────────────────────────────────────────────────────────
 *   node scripts/todo-to-trello.js
 *
 * Idempotent : relançable sans créer de doublons (les cartes sont reconnues par
 * leur préfixe de code, ex. OFF-1). Sync à sens unique : TODO.md → Trello.
 */
'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'zeldtrade', 'trello');
const TODO_PATH   = path.join(__dirname, '..', 'docs', 'TODO.md');
const API         = 'https://api.trello.com/1';

if (typeof fetch !== 'function') {
  console.error('✗ Node 18+ requis (fetch global indisponible). Mets à jour Node.');
  process.exit(1);
}

function die(msg) { console.error('✗ ' + msg); process.exit(1); }

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    die(`Config absente : ${CONFIG_PATH}\n` +
        '  Crée-la :\n' +
        '    mkdir -p ~/.config/zeldtrade\n' +
        '    printf "key=XXX\\ntoken=YYY\\nboard=https://trello.com/b/XXXX/mon-board\\n" > ~/.config/zeldtrade/trello\n' +
        '    chmod 600 ~/.config/zeldtrade/trello');
  }
  const cfg = {};
  for (const line of fs.readFileSync(CONFIG_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
    if (m) cfg[m[1].toLowerCase()] = m[2];
  }
  if (!cfg.key || !cfg.token || !cfg.board) die('Config incomplète : il faut key, token ET board.');
  const m = cfg.board.match(/trello\.com\/b\/([A-Za-z0-9]+)/);
  if (m) cfg.board = m[1];   // extrait l'ID court depuis une URL
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

/** Extrait les items de la section « 🎯 Demandes user » du TODO.md. */
function parseTodos() {
  const md = fs.readFileSync(TODO_PATH, 'utf8');
  const start = md.indexOf('🎯 Demandes user');
  if (start < 0) return [];
  const rest = md.slice(start);
  const nextHeading = rest.indexOf('\n### ', 10);
  const block = nextHeading > 0 ? rest.slice(0, nextHeading) : rest;
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

async function getOrCreateList(cfg, name) {
  const lists = await trello('GET', `/boards/${cfg.board}/lists`, cfg, { fields: 'name' });
  return lists.find(l => l.name === name) || trello('POST', `/boards/${cfg.board}/lists`, cfg, { name });
}

(async () => {
  const cfg   = loadConfig();
  const todos = parseTodos();
  if (!todos.length) die('Aucun item trouvé dans la section « 🎯 Demandes user » de docs/TODO.md.');

  const todoList = await getOrCreateList(cfg, '📋 À faire');
  const doneList = await getOrCreateList(cfg, '✅ Fait');

  // Cartes existantes (indexées par préfixe de code) → anti-doublon + déplacements
  const existing = {};
  for (const l of [todoList, doneList]) {
    const cards = await trello('GET', `/lists/${l.id}/cards`, cfg, { fields: 'name,idList' });
    for (const c of cards) { const cm = c.name.match(/^([A-Z0-9-]+)/); if (cm) existing[cm[1]] = c; }
  }

  let created = 0, moved = 0, unchanged = 0;
  for (const t of todos) {
    const target   = t.done ? doneList : todoList;
    const cardName = `${t.code} — ${t.title}`.slice(0, 250);
    const card     = existing[t.code];
    if (!card) {
      await trello('POST', '/cards', cfg, { idList: target.id, name: cardName, desc: t.desc.slice(0, 16000) });
      created++; console.log('  + ' + cardName);
    } else if (card.idList !== target.id) {
      await trello('PUT', `/cards/${card.id}`, cfg, { idList: target.id });
      moved++; console.log(`  → ${cardName}  (vers « ${t.done ? '✅ Fait' : '📋 À faire'} »)`);
    } else {
      unchanged++;
    }
  }
  console.log(`\n✓ Trello synchronisé : ${created} créée(s), ${moved} déplacée(s), ${unchanged} inchangée(s).`);
})().catch(e => die(e.message));
