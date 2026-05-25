// ─── LANDING I18N (FR/EN) ──────────────────────────────────────────────────
// v0.9.321 (LANDING-EN) : bilingue FR/EN pour la landing. Externalisé (CSP
// script-src 'self'). La VF reste dans le HTML (défaut + SEO) ; l'anglais vit
// dans le dictionnaire ci-dessous. Une clé absente => on garde le texte FR du
// HTML (dégradation gracieuse : la page n'est jamais cassée pendant le build).
//
// Marquage dans le HTML :
//   data-i18n="cle"        -> remplace textContent
//   data-i18n-html="cle"   -> remplace innerHTML (texte avec <strong>, <br>…)
//   data-i18n-ph="cle"     -> attribut placeholder
//   data-i18n-aria="cle"   -> attribut aria-label
//
// Toggle : bouton #langToggle (haut droite). Persistance : ?lang= + localStorage.
// À la bascule : overlay #langLoader (écran de chargement) le temps de la transition.

(function () {
  'use strict';

  // ── Dictionnaire { cle : { fr, en } } ───────────────────────────────────────
  // (rempli section par section ; voir aussi META plus bas pour <title>/description)
  const DICT = {
    // Nav
    'nav.demo':     { fr: 'Aperçu',          en: 'Preview' },
    'nav.features': { fr: 'Fonctionnalités', en: 'Features' },
    'nav.vs':       { fr: 'Comparer',        en: 'Compare' },
    'nav.value':    { fr: 'ROI',             en: 'ROI' },
    'nav.pricing':  { fr: 'Tarifs',          en: 'Pricing' },
    'nav.updates':  { fr: 'Nouveautés',      en: "What's new" },
    'nav.login':    { fr: 'Connexion',       en: 'Log in' },
    'nav.signup':   { fr: 'Créer un compte', en: 'Sign up' },

    // Hero
    'hero.badge':   { fr: 'Bêta ouverte',    en: 'Open beta' },
    'hero.title.1': { fr: 'Journalise.',     en: 'Journal it.' },
    'hero.title.2': { fr: 'Analyse.',        en: 'Analyze.' },
    'hero.title.3': { fr: 'Performe.',       en: 'Perform.' },
    'hero.sub':     {
      fr: 'Le journal de trading pensé pour les <strong>prop firms</strong>. Trailing drawdown au tick près (Apex, FTMO, Topstep, Lucid, Funding Pips), l\'IA lit tes screenshots TradingView, multi-comptes, crypto &amp; fonds propres — dans un seul outil.',
      en: 'The trading journal built for <strong>prop firms</strong>. Tick-accurate trailing drawdown (Apex, FTMO, Topstep, Lucid, Funding Pips), AI reads your TradingView screenshots, multi-account, crypto &amp; personal funds — all in one tool.',
    },
    'hero.cta.signup':  { fr: 'Créer un compte gratuit', en: 'Create a free account' },
    'hero.cta.preview': { fr: "Voir l'aperçu",           en: 'See the preview' },
    'hero.usercount':   { fr: 'traders nous font déjà confiance', en: 'traders already trust us' },
    'hero.beta':        { fr: 'Bêta privée — accès limité', en: 'Private beta — limited access' },
    'hero.chip.1':  { fr: '100 % gratuit pour démarrer',          en: '100% free to start' },
    'hero.chip.2':  { fr: "L'IA lit tes screenshots TradingView", en: 'AI reads your TradingView screenshots' },
    'hero.chip.3':  { fr: 'Made in France · RGPD natif',          en: 'Made in France · GDPR-native' },

    // Stats strip
    'stats.firms':  { fr: 'Prop firms supportées', en: 'Supported prop firms' },
    'stats.trades': { fr: 'Trades illimités',      en: 'Unlimited trades' },
    'stats.data':   { fr: 'Données en Europe',     en: 'Data stored in Europe' },
    'stats.free':   { fr: 'Pendant la beta',       en: 'During the beta' },

    // Firms strip
    'firms.label':      { fr: 'Compatible avec les principales prop firms', en: 'Compatible with the major prop firms' },
    'firms.disclaimer': {
      fr: 'Les marques mentionnées (Apex Trader Funding, FTMO, Topstep, Lucid Trading, Funding Pips) appartiennent à leurs propriétaires respectifs. ZeldTrade n\'est ni affilié, ni sponsorisé, ni approuvé par ces sociétés.',
      en: 'The brands mentioned (Apex Trader Funding, FTMO, Topstep, Lucid Trading, Funding Pips) belong to their respective owners. ZeldTrade is not affiliated with, sponsored by, or endorsed by these companies.',
    },

    // How it works
    'how.eyebrow':  { fr: 'Comment ça marche',                en: 'How it works' },
    'how.title':    { fr: 'Journaliser un trade en 30 secondes', en: 'Log a trade in 30 seconds' },
    'how.sub':      { fr: 'Le flow le plus rapide du marché. Pas d\'Excel, pas de saisie manuelle, pas de copie-collage interminable.', en: 'The fastest flow on the market. No Excel, no manual entry, no endless copy-pasting.' },
    'how.1.title':  { fr: 'Capture ton chart', en: 'Capture your chart' },
    'how.1.desc':   { fr: 'Screenshot ton setup sur TradingView puis <kbd>Ctrl</kbd>+<kbd>V</kbd> directement dans ZeldTrade. Drag &amp; drop ou paste — peu importe.', en: 'Screenshot your setup on TradingView then <kbd>Ctrl</kbd>+<kbd>V</kbd> straight into ZeldTrade. Drag &amp; drop or paste — your call.' },
    'how.2.title':  { fr: "L'IA fait le boulot", en: 'AI does the work' },
    'how.2.desc':   { fr: "L'IA Vision détecte automatiquement entry, stop-loss et take-profit sur ton graphique. Les niveaux sont pré-remplis en 2 secondes.", en: 'AI Vision automatically detects entry, stop-loss and take-profit on your chart. Levels are pre-filled in 2 seconds.' },
    'how.3.title':  { fr: 'Stats temps réel', en: 'Real-time stats' },
    'how.3.desc':   { fr: 'R:R, risque %, P&L net (fees/spreads inclus), drawdown prop firm. Tout calculé en live, multi-comptes synchronisés.', en: 'R:R, risk %, net P&L (fees/spreads included), prop firm drawdown. All computed live, multi-account synced.' },

    // Features — 3 piliers
    'feat.eyebrow': { fr: '3 piliers', en: '3 pillars' },
    'feat.title':   { fr: 'Ce que ZeldTrade fait <span class="title-accent">mieux que tous les autres</span>', en: 'What ZeldTrade does <span class="title-accent">better than everyone else</span>' },
    'feat.sub':     { fr: 'Pas une liste de 50 features. 3 choses bien faites qui te font économiser 1h par jour et éviter des breaches.', en: 'Not a list of 50 features. 3 things done well that save you an hour a day and keep you from breaching.' },
    'feat.1.title': { fr: 'IA Vision qui lit tes charts', en: 'AI Vision that reads your charts' },
    'feat.1.desc':  { fr: '<strong>Ctrl+V</strong> ton screenshot TradingView → l\'IA détecte entry, SL et TP en <strong>2 secondes</strong>. Modèle <strong>IA standard</strong> en cascade pour Trader, et <strong>IA avancée</strong> en fallback automatique sur les charts complexes pour Funded et Elite.', en: '<strong>Ctrl+V</strong> your TradingView screenshot → AI detects entry, SL and TP in <strong>2 seconds</strong>. <strong>Standard AI</strong> for Trader, with <strong>advanced AI</strong> auto-falling back on complex charts for Funded and Elite.' },
    'feat.1.b1':    { fr: 'Trader : 1 analyse / jour (IA)', en: 'Trader: 1 analysis / day (AI)' },
    'feat.1.b2':    { fr: 'Funded : 5 / jour (IA + IA avancée)', en: 'Funded: 5 / day (AI + advanced AI)' },
    'feat.1.b3':    { fr: 'Elite : illimité (IA + IA avancée)', en: 'Elite: unlimited (AI + advanced AI)' },
    'feat.2.title': { fr: 'Règles prop firms calculées au tick', en: 'Prop firm rules computed to the tick' },
    'feat.2.desc':  { fr: '<strong>Trailing drawdown EOD précis</strong> pour Apex, Topstep, Lucid (Flex/Pro/Direct), Funding Pips. Static pour FTMO 2-Step. Safety net, daily loss limit, max contracts intégrés. Tu vois le risque <strong>en temps réel</strong> dans le dashboard.', en: '<strong>Accurate EOD trailing drawdown</strong> for Apex, Topstep, Lucid (Flex/Pro/Direct), Funding Pips. Static for FTMO 2-Step. Safety net, daily loss limit and max contracts built in. You see your risk <strong>in real time</strong> on the dashboard.' },
    'feat.2.b1':    { fr: '5 prop firms supportées (12+ presets)', en: '5 prop firms supported (12+ presets)' },
    'feat.2.b2':    { fr: 'Distance to floor + Apex risk bar', en: 'Distance to floor + Apex risk bar' },
    'feat.2.b3':    { fr: 'Comptes Crypto (Binance / Coinbase) &amp; Fonds propres', en: 'Crypto accounts (Binance / Coinbase) &amp; personal funds' },
    'feat.3.title': { fr: 'Multi-comptes + groupes en 1 clic', en: 'Multi-account + groups in 1 click' },
    'feat.3.desc':  { fr: '<strong>Comptes illimités sur Elite</strong> (prop / crypto / fonds propres). Crée un groupe, saisis ton trade une fois, il se réplique automatiquement sur tous les comptes du groupe avec la bonne taille / bon levier.', en: '<strong>Unlimited accounts on Elite</strong> (prop / crypto / personal funds). Create a group, enter your trade once, and it replicates automatically across every account in the group with the right size / leverage.' },
    'feat.3.b1':    { fr: '2 comptes (Funded) · illimité (Elite)', en: '2 accounts (Funded) · unlimited (Elite)' },
    'feat.3.b2':    { fr: '50 groupes max, 100 comptes / groupe', en: '50 groups max, 100 accounts / group' },
    'feat.3.b3':    { fr: 'Filtres dashboard par compte ou groupe', en: 'Dashboard filters by account or group' },
    // Features — mini-features (avec <strong>/<br>/<span>)
    'feat.mini.1':  { fr: '<strong>Screenshots à vie</strong><br><span>Stockés chiffrés EU, compression auto</span>', en: '<strong>Screenshots for life</strong><br><span>Encrypted EU storage, auto-compression</span>' },
    'feat.mini.2':  { fr: '<strong>P&amp;L net précis</strong><br><span>Fees, spreads, partial close, scale-out</span>', en: '<strong>Accurate net P&amp;L</strong><br><span>Fees, spreads, partial close, scale-out</span>' },
    'feat.mini.3':  { fr: '<strong>Calendrier coloré</strong><br><span>Par jour, par mois, drawer cliquable</span>', en: '<strong>Color-coded calendar</strong><br><span>By day, by month, clickable drawer</span>' },
    'feat.mini.4':  { fr: '<strong>Goals personnels</strong><br><span>P&amp;L mensuel, winrate, streak, # trades</span>', en: '<strong>Personal goals</strong><br><span>Monthly P&amp;L, win rate, streak, # trades</span>' },
    'feat.mini.5':  { fr: '<strong>Analytics profond</strong><br><span>Par setup, instrument, session, jour</span>', en: '<strong>Deep analytics</strong><br><span>By setup, instrument, session, day</span>' },
    'feat.mini.6':  { fr: '<strong>Export PDF + CSV</strong><br><span>1 page/trade pour coach ou funded app</span>', en: '<strong>PDF + CSV export</strong><br><span>1 page/trade for a coach or funded app</span>' },
    'feat.mini.7':  { fr: '<strong>Calculateur fiscal FR</strong><br><span>Micro-BNC, URSSAF, ACRE intégrés</span>', en: '<strong>French tax calculator</strong><br><span>Micro-BNC, URSSAF, ACRE built in</span>' },
    'feat.mini.8':  { fr: '<strong>Bilingue FR / EN</strong><br><span>Tout le site bascule en 1 clic</span>', en: '<strong>Bilingual FR / EN</strong><br><span>Whole site switches in 1 click</span>' },
    'feat.mini.9':  { fr: '<strong>RGPD natif</strong><br><span>Export JSON complet, suppression 1-clic</span>', en: '<strong>GDPR-native</strong><br><span>Full JSON export, 1-click deletion</span>' },

    // Footer
    'footer.updates': { fr: 'Nouveautés',      en: "What's new" },
    'footer.legal':   { fr: 'Mentions légales', en: 'Legal notice' },
    'footer.cgu':     { fr: 'CGU',             en: 'Terms' },
    'footer.privacy': { fr: 'Confidentialité', en: 'Privacy' },
    'footer.about':   { fr: 'À propos',        en: 'About' },
    'footer.contact': { fr: 'Contact',         en: 'Contact' },

    // Cookie banner
    'cookie.text': {
      fr: 'ZeldTrade utilise uniquement des cookies <strong style="color:#e6edf3">essentiels</strong> : connexion (Firebase Auth), sécurité anti-bot (Cloudflare Turnstile / hCaptcha) et stockage local de tes données. <strong style="color:#e6edf3">Aucun cookie publicitaire, aucun tracking.</strong> <a href="/privacy" style="color:#a78bfa;text-decoration:none">Politique de confidentialité</a>',
      en: 'ZeldTrade uses only <strong style="color:#e6edf3">essential</strong> cookies: login (Firebase Auth), anti-bot security (Cloudflare Turnstile / hCaptcha) and local storage of your data. <strong style="color:#e6edf3">No advertising cookies, no tracking.</strong> <a href="/privacy" style="color:#a78bfa;text-decoration:none">Privacy policy</a>',
    },
    'cookie.btn': { fr: 'J\'ai compris', en: 'Got it' },

    // Démo live
    'demo.eyebrow': { fr: 'Démo live', en: 'Live demo' },
    'demo.title':   { fr: 'Crée ton premier trade en <span class="title-accent">30 secondes</span>', en: 'Create your first trade in <span class="title-accent">30 seconds</span>' },
    'demo.sub':     { fr: 'Aucune saisie manuelle. Capture ton chart TradingView, l\'IA fait le reste.', en: 'No manual entry. Screenshot your TradingView chart, AI does the rest.' },
    'demo.step1':   { fr: 'Capture', en: 'Capture' },
    'demo.step2':   { fr: 'IA fill', en: 'AI fill' },
    'demo.step3':   { fr: 'Sauvegarde', en: 'Save' },
    'demo.paste':   { fr: 'Drag & drop ou Ctrl+V ton screenshot TradingView', en: 'Drag & drop or Ctrl+V your TradingView screenshot' },
    'demo.aitext':  { fr: 'L\'IA Vision analyse ton chart…', en: 'AI Vision is analyzing your chart…' },
    'demo.save':    { fr: '✓ Sauvegarder le trade', en: '✓ Save the trade' },
    'demo.toast':   { fr: '✓ Trade ajouté à ton journal &amp; dashboard mis à jour', en: '✓ Trade added to your journal &amp; dashboard updated' },
    'demo.caption': { fr: 'Animation simplifiée — la vraie app est plus complète (multi-comptes, groupes, partial close, etc.)', en: 'Simplified animation — the real app is more complete (multi-account, groups, partial close, etc.)' },
    'demo.nav.new':      { fr: 'Nouveau trade', en: 'New trade' },
    'demo.nav.goals':    { fr: 'Objectifs', en: 'Goals' },
    'demo.nav.settings': { fr: 'Réglages', en: 'Settings' },

    // Avant / Après
    'ba.eyebrow':      { fr: 'Avant / Après', en: 'Before / After' },
    'ba.title':        { fr: 'Pourquoi tu vas changer d\'outil ce mois-ci', en: 'Why you\'ll switch tools this month' },
    'ba.sub':          { fr: 'Si tu trades en prop firm avec un Excel ou un journal générique, voici ce que tu rates chaque jour.', en: 'If you trade with a prop firm using Excel or a generic journal, here\'s what you miss every day.' },
    'ba.before.title': { fr: 'Sans ZeldTrade', en: 'Without ZeldTrade' },
    'ba.before.1':     { fr: '<span class="ba-x">✗</span> Excel chaotique avec 12 onglets pour 5 comptes différents', en: '<span class="ba-x">✗</span> Chaotic Excel with 12 tabs for 5 different accounts' },
    'ba.before.2':     { fr: '<span class="ba-x">✗</span> Trailing drawdown calculé à la main → erreurs &amp; breach surprise', en: '<span class="ba-x">✗</span> Trailing drawdown computed by hand → errors &amp; surprise breaches' },
    'ba.before.3':     { fr: '<span class="ba-x">✗</span> Screenshots TradingView éparpillés dans 8 dossiers', en: '<span class="ba-x">✗</span> TradingView screenshots scattered across 8 folders' },
    'ba.before.4':     { fr: '<span class="ba-x">✗</span> Saisie manuelle de chaque trade (3-5 min × 20 trades/jour = 1h perdue)', en: '<span class="ba-x">✗</span> Manual entry of every trade (3-5 min × 20 trades/day = 1h lost)' },
    'ba.before.5':     { fr: '<span class="ba-x">✗</span> Calculs P&amp;L approximatifs, frais oubliés', en: '<span class="ba-x">✗</span> Rough P&amp;L calculations, forgotten fees' },
    'ba.before.6':     { fr: '<span class="ba-x">✗</span> Aucune analytics par setup, par session, par instrument', en: '<span class="ba-x">✗</span> No analytics by setup, session or instrument' },
    'ba.before.7':     { fr: '<span class="ba-x">✗</span> Outils anglo-saxons à 30-40 $/mois pas adaptés aux prop firms', en: '<span class="ba-x">✗</span> English-only tools at $30-40/mo not built for prop firms' },
    'ba.after.title':  { fr: 'Avec ZeldTrade', en: 'With ZeldTrade' },
    'ba.after.1':      { fr: '<span class="ba-check">✓</span> <strong>1 journal centralisé</strong> pour tous tes comptes prop / crypto / personnels', en: '<span class="ba-check">✓</span> <strong>1 centralized journal</strong> for all your prop / crypto / personal accounts' },
    'ba.after.2':      { fr: '<span class="ba-check">✓</span> <strong>Trailing drawdown EOD précis</strong> calculé au tick près (Apex/Topstep/Lucid/FP)', en: '<span class="ba-check">✓</span> <strong>Accurate EOD trailing drawdown</strong> computed to the tick (Apex/Topstep/Lucid/FP)' },
    'ba.after.3':      { fr: '<span class="ba-check">✓</span> <strong>Screenshots persistants</strong> stockés à vie dans le cloud (chiffrés EU)', en: '<span class="ba-check">✓</span> <strong>Persistent screenshots</strong> stored for life in the cloud (EU-encrypted)' },
    'ba.after.4':      { fr: '<span class="ba-check">✓</span> <strong>IA Vision</strong> détecte entry/SL/TP en 2 sec (gain de 50 min/jour)', en: '<span class="ba-check">✓</span> <strong>AI Vision</strong> detects entry/SL/TP in 2 sec (saves 50 min/day)' },
    'ba.after.5':      { fr: '<span class="ba-check">✓</span> <strong>P&amp;L net</strong> calculé avec fees + spreads par instrument', en: '<span class="ba-check">✓</span> <strong>Net P&amp;L</strong> computed with fees + spreads per instrument' },
    'ba.after.6':      { fr: '<span class="ba-check">✓</span> <strong>Analytics</strong> par setup, session, instrument, jour, mois', en: '<span class="ba-check">✓</span> <strong>Analytics</strong> by setup, session, instrument, day, month' },
    'ba.after.7':      { fr: '<span class="ba-check">✓</span> <strong>Made in France</strong> à 14,99 €/mois — 50% moins cher que les US', en: '<span class="ba-check">✓</span> <strong>Made in France</strong> at €14.99/mo — 50% cheaper than US tools' },

    // Mockup app preview (aperçu interactif)
    'mk.bartitle':     { fr: 'zeldtrade.app — Aperçu interactif', en: 'zeldtrade.app — Interactive preview' },
    'mk.nav.calendar': { fr: 'Calendrier', en: 'Calendar' },
    'mk.nav.goals':    { fr: 'Objectifs', en: 'Goals' },
    'mk.equity':       { fr: 'Équité (30 j)', en: 'Equity (30d)' },
    'mk.tradestotal':  { fr: 'Trades total', en: 'Total trades' },
    'mk.avgrr':        { fr: 'R:R moyen', en: 'Avg R:R' },
    'mk.perfinstr':    { fr: 'Perf par instrument', en: 'Perf by instrument' },
    'mk.may':          { fr: 'Mai 2026', en: 'May 2026' },
    'mk.activedays':   { fr: '14 j actifs', en: '14 active days' },
    'mk.thisweek':     { fr: 'Cette semaine', en: 'This week' },
    'mk.recenttrades': { fr: 'Trades récents', en: 'Recent trades' },
    'mk.active':       { fr: 'Actifs', en: 'Active' },
    'mk.reached':      { fr: 'Atteints', en: 'Reached' },
    'mk.inprogress':   { fr: 'En cours', en: 'In progress' },
    'mk.monthlyprofit':{ fr: 'Profit mensuel', en: 'Monthly profit' },
    'mk.tradesmonth':  { fr: 'Trades / mois', en: 'Trades / month' },
    'mk.targetwr':     { fr: 'Win rate cible', en: 'Target win rate' },
    'mk.goalreached':  { fr: '✓ Atteint', en: '✓ Reached' },
    'demo.curl':       { fr: 'zeldtrade.com/app · Nouveau trade', en: 'zeldtrade.com/app · New trade' },
    // Mini-calendrier (initiales jours Lun→Dim) + dates du mockup
    'mk.cal.1': { fr: 'L', en: 'M' },
    'mk.cal.2': { fr: 'M', en: 'T' },
    'mk.cal.3': { fr: 'M', en: 'W' },
    'mk.cal.4': { fr: 'J', en: 'T' },
    'mk.cal.5': { fr: 'V', en: 'F' },
    'mk.cal.6': { fr: 'S', en: 'S' },
    'mk.cal.7': { fr: 'D', en: 'S' },
    'mk.date.may14': { fr: '14 mai', en: 'May 14' },
    'mk.date.may13': { fr: '13 mai', en: 'May 13' },
    'mk.date.may12': { fr: '12 mai', en: 'May 12' },

    // Use cases — quelle prop firm ?
    'uc.title':        { fr: 'Tu trades quelle <span class="title-accent">prop firm</span> ?', en: 'Which <span class="title-accent">prop firm</span> do you trade?' },
    'uc.sub':          { fr: 'Chaque firm a ses règles spécifiques. ZeldTrade les connaît toutes — choisis ton compte et configure en 30 secondes.', en: 'Every firm has its own rules. ZeldTrade knows them all — pick your account and set it up in 30 seconds.' },
    'uc.apex.pain':    { fr: 'Trailing drawdown EOD complexe, 4 tailles (25K/50K/100K/150K), eval fees + activation fees PA, max contracts.', en: 'Complex EOD trailing drawdown, 4 sizes (25K/50K/100K/150K), eval fees + PA activation fees, max contracts.' },
    'uc.apex.fix':     { fr: '<strong>ZeldTrade :</strong> 4 presets EOD officiels intégrés, calcul du trailing au tick près, alerte distance to floor, breakdown fees activation.', en: '<strong>ZeldTrade:</strong> 4 official EOD presets built in, tick-accurate trailing calculation, distance-to-floor alert, activation fee breakdown.' },
    'uc.topstep.pain': { fr: 'Trailing drawdown jusqu\'au passage en funded, eval fee mensuel à intégrer au break-even, max contracts par phase.', en: 'Trailing drawdown until you go funded, monthly eval fee to factor into break-even, max contracts per phase.' },
    'uc.topstep.fix':  { fr: '<strong>ZeldTrade :</strong> 3 presets Topstep avec eval fees mensuels, switch automatique funded → trailing fige, dashboard adapté.', en: '<strong>ZeldTrade:</strong> 3 Topstep presets with monthly eval fees, automatic funded switch → trailing freezes, dashboard adapts.' },
    'uc.ftmo.pain':    { fr: 'Static drawdown sur 2-Step (différent du trailing), consistency rule sur certains comptes, profit targets phase 1 vs phase 2.', en: 'Static drawdown on 2-Step (different from trailing), consistency rule on some accounts, phase 1 vs phase 2 profit targets.' },
    'uc.ftmo.fix':     { fr: '<strong>ZeldTrade :</strong> Presets FTMO 1-Step et 2-Step distincts, static drawdown calculé correctement, suivi consistency.', en: '<strong>ZeldTrade:</strong> Distinct FTMO 1-Step and 2-Step presets, static drawdown computed correctly, consistency tracking.' },
    'uc.lucid.pain':   { fr: '3 produits distincts (Flex / Pro / Direct), 4 tailles chacun = 12 configurations. Chacune avec ses propres drawdown, profit target, max contracts.', en: '3 distinct products (Flex / Pro / Direct), 4 sizes each = 12 configurations. Each with its own drawdown, profit target and max contracts.' },
    'uc.lucid.fix':    { fr: '<strong>ZeldTrade :</strong> <strong>12 presets Lucid</strong> ready-to-use — le seul SaaS à les avoir tous distingués correctement.', en: '<strong>ZeldTrade:</strong> <strong>12 ready-to-use Lucid presets</strong> — the only SaaS to tell them all apart correctly.' },
    'uc.fp.pain':      { fr: 'Static drawdown, multi-step evaluation, profit target par phase, payout conditions spécifiques.', en: 'Static drawdown, multi-step evaluation, profit target per phase, specific payout conditions.' },
    'uc.fp.fix':       { fr: '<strong>ZeldTrade :</strong> Preset Funding Pips configurable, static drawdown précis, suivi profit target en temps réel.', en: '<strong>ZeldTrade:</strong> Configurable Funding Pips preset, accurate static drawdown, real-time profit target tracking.' },
    'uc.other.title':  { fr: 'Autre / Fonds propres / Crypto', en: 'Other / Personal funds / Crypto' },
    'uc.other.pain':   { fr: 'Tu trades avec ton propre capital ou sur Binance / Coinbase ? Pas de règles imposées mais besoin d\'un journal aussi rigoureux.', en: 'Trading with your own capital or on Binance / Coinbase? No imposed rules, but you still need an equally rigorous journal.' },
    'uc.other.fix':    { fr: '<strong>ZeldTrade :</strong> Comptes <strong>Personnel</strong> sans règles + comptes <strong>Crypto</strong> (Binance Futures + Coinbase Spot) avec calcul des fees adapté.', en: '<strong>ZeldTrade:</strong> <strong>Personal</strong> accounts with no rules + <strong>Crypto</strong> accounts (Binance Futures + Coinbase Spot) with tailored fee calculation.' },

    // Comparaison (vs)
    'vs.eyebrow':      { fr: 'Comparaison', en: 'Comparison' },
    'vs.title':        { fr: 'Pourquoi pas <span class="title-accent">Edgyx, Tradervue ou Excel</span> ?', en: 'Why not <span class="title-accent">Edgyx, Tradervue or Excel</span>?' },
    'vs.sub':          { fr: 'Les outils généralistes (Edgyx, Tradervue, TradeZella) sont bien faits mais ignorent les contraintes spécifiques des prop firms. Excel demande 30 min de paramétrage par compte.', en: 'Generalist tools (Edgyx, Tradervue, TradeZella) are well built but ignore the specific constraints of prop firms. Excel takes 30 min of setup per account.' },
    'vs.th.criteria':  { fr: 'Critère', en: 'Criteria' },
    'vs.th.edgyx':     { fr: 'Généraliste FR', en: 'Generalist (FR)' },
    'vs.th.excel':     { fr: 'Gratuit', en: 'Free' },
    'vs.r1.crit':      { fr: 'Spécialisation prop firms (Apex, FTMO, Topstep, Lucid, FP)', en: 'Prop firm specialization (Apex, FTMO, Topstep, Lucid, FP)' },
    'vs.r1.us':        { fr: '✓ 20+ presets précis', en: '✓ 20+ precise presets' },
    'vs.r1.edgyx':     { fr: '⚠ Generic prop rules', en: '⚠ Generic prop rules' },
    'vs.r1.zella':     { fr: '⚠ Partiel', en: '⚠ Partial' },
    'vs.r1.excel':     { fr: '✗ Manuel', en: '✗ Manual' },
    'vs.r2.crit':      { fr: 'Trailing drawdown EOD calculé au tick', en: 'Tick-accurate EOD trailing drawdown' },
    'vs.r3.crit':      { fr: 'IA Vision sur screenshot TradingView', en: 'AI Vision on TradingView screenshots' },
    'vs.r3.us':        { fr: '✓ IA + IA avancée (Funded+)', en: '✓ AI + advanced AI (Funded+)' },
    'vs.r3.edgyx':     { fr: '✗ (IA psychologie)', en: '✗ (psychology AI)' },
    'vs.r3.zella':     { fr: '⚠ Add-on payant', en: '⚠ Paid add-on' },
    'vs.r4.crit':      { fr: 'Groupes multi-comptes (1 trade → N comptes)', en: 'Multi-account groups (1 trade → N accounts)' },
    'vs.r4.edgyx':     { fr: '⚠ Manuel', en: '⚠ Manual' },
    'vs.r4.tradervue': { fr: '⚠ Manuel', en: '⚠ Manual' },
    'vs.r4.zella':     { fr: '⚠ Manuel', en: '⚠ Manual' },
    'vs.r5.crit':      { fr: 'Comptes Crypto (Binance + Coinbase)', en: 'Crypto accounts (Binance + Coinbase)' },
    'vs.r5.us':        { fr: '✓ Fees % notional', en: '✓ Notional % fees' },
    'vs.r5.edgyx':     { fr: '⚠ Basique', en: '⚠ Basic' },
    'vs.r5.zella':     { fr: '⚠ Limité', en: '⚠ Limited' },
    'vs.r6.crit':      { fr: 'Interface française', en: 'French interface' },
    'vs.r6.us':        { fr: '✓ FR natif', en: '✓ Native FR' },
    'vs.r6.edgyx':     { fr: '✓ FR natif', en: '✓ Native FR' },
    'vs.r6.tradervue': { fr: '✗ EN only', en: '✗ EN only' },
    'vs.r6.zella':     { fr: '✗ EN only', en: '✗ EN only' },
    'vs.r6.excel':     { fr: '✓ Manuel', en: '✓ Manual' },
    'vs.r7.crit':      { fr: 'Calculateur fiscal FR (micro-BNC)', en: 'French tax calculator (micro-BNC)' },
    'vs.r7.us':        { fr: '✓ Intégré', en: '✓ Built in' },
    'vs.r8.crit':      { fr: 'RGPD natif (export, suppression 1-clic)', en: 'GDPR-native (export, 1-click deletion)' },
    'vs.r8.edgyx':     { fr: '⚠ Partiel', en: '⚠ Partial' },
    'vs.r8.tradervue': { fr: '⚠ Partiel', en: '⚠ Partial' },
    'vs.r8.zella':     { fr: '⚠ Partiel', en: '⚠ Partial' },
    'vs.r9.crit':      { fr: 'Hébergement UE', en: 'EU hosting' },
    'vs.r9.us':        { fr: '✓ Firebase EU', en: '✓ Firebase EU' },
    'vs.r9.edgyx':     { fr: '✓ FR', en: '✓ FR' },
    'vs.r9.tradervue': { fr: '✗ US', en: '✗ US' },
    'vs.r9.zella':     { fr: '✗ US', en: '✗ US' },
    'vs.r9.excel':     { fr: '✓ Local', en: '✓ Local' },
    'vs.r10.crit':     { fr: 'Auto-import MT4 / MT5', en: 'MT4 / MT5 auto-import' },
    'vs.r10.us':       { fr: '✗ <small>(roadmap)</small>', en: '✗ <small>(roadmap)</small>' },
    'vs.r11.crit':     { fr: 'Mobile app native', en: 'Native mobile app' },
    'vs.r11.us':       { fr: '✗ <small>(roadmap)</small>', en: '✗ <small>(roadmap)</small>' },
    'vs.r11.tradervue':{ fr: '⚠ Web only', en: '⚠ Web only' },
    'vs.hint':         { fr: '← Glisse horizontalement pour voir tout le tableau →', en: '← Swipe horizontally to see the whole table →' },
    'vs.conclusion':   { fr: '<strong>ZeldTrade est le seul à calculer ton trailing drawdown EOD prop firm au tick près</strong> — et à intégrer l\'IA Vision sur tes screenshots TradingView pour pré-remplir entry/SL/TP automatiquement.', en: '<strong>ZeldTrade is the only one that computes your prop firm EOD trailing drawdown to the tick</strong> — and that builds AI Vision into your TradingView screenshots to auto-fill entry/SL/TP.' },

    // Roadmap publique
    'rm.eyebrow':      { fr: 'Roadmap publique', en: 'Public roadmap' },
    'rm.title':        { fr: 'Ce qu\'on construit, <span class="title-accent">au grand jour</span>', en: 'What we\'re building, <span class="title-accent">out in the open</span>' },
    'rm.sub':          { fr: 'Transparence totale. Voici ce qui est livré, ce qu\'on bosse, et ce qui arrive. Les utilisateurs Funded et Elite votent sur les priorités.', en: 'Full transparency. Here\'s what\'s shipped, what we\'re working on, and what\'s coming. Funded and Elite users vote on priorities.' },
    'rm.done.title':   { fr: 'Livré', en: 'Shipped' },
    'rm.done.1':       { fr: 'Journal multi-comptes + groupes', en: 'Multi-account journal + groups' },
    'rm.done.2':       { fr: 'IA Vision (standard + IA avancée en fallback)', en: 'AI Vision (standard + advanced AI fallback)' },
    'rm.done.3':       { fr: 'Trailing drawdown EOD précis 5 firms', en: 'Accurate EOD trailing drawdown, 5 firms' },
    'rm.done.4':       { fr: 'Comptes Crypto (Binance + Coinbase)', en: 'Crypto accounts (Binance + Coinbase)' },
    'rm.done.5':       { fr: 'Comptes Fonds propres', en: 'Personal funds accounts' },
    'rm.done.6':       { fr: 'Export PDF / CSV / JSON RGPD', en: 'PDF / CSV / GDPR JSON export' },
    'rm.done.7':       { fr: 'Calculateur fiscal micro-BNC', en: 'Micro-BNC tax calculator' },
    'rm.done.8':       { fr: 'Bilingue FR / EN', en: 'Bilingual FR / EN' },
    'rm.done.9':       { fr: 'Désinscription newsletter 1-clic (RFC 8058)', en: '1-click newsletter unsubscribe (RFC 8058)' },
    'rm.done.10':      { fr: 'Expérience mobile responsive', en: 'Responsive mobile experience' },
    'rm.doing.title':  { fr: 'En cours', en: 'In progress' },
    'rm.doing.1':      { fr: 'Stripe Checkout (Funded / Elite)', en: 'Stripe Checkout (Funded / Elite)' },
    'rm.doing.2':      { fr: 'Onboarding Pro multi-select préférences', en: 'Pro onboarding with multi-select preferences' },
    'rm.next.title':   { fr: 'Planifié', en: 'Planned' },
    'rm.next.1':       { fr: 'Auto-import MT4 / MT5 / cTrader', en: 'MT4 / MT5 / cTrader auto-import' },
    'rm.next.2':       { fr: 'Mobile app (iOS / Android)', en: 'Mobile app (iOS / Android)' },
    'rm.next.3':       { fr: 'Dashboard coach (multi-élèves) — Elite', en: 'Coach dashboard (multi-student) — Elite' },
    'rm.next.4':       { fr: 'Accès API public — Elite', en: 'Public API access — Elite' },
    'rm.next.5':       { fr: 'Backup automatique quotidien', en: 'Automatic daily backup' },
    'rm.next.6':       { fr: 'Export Excel avec formules natives', en: 'Excel export with native formulas' },

    // Le calcul (value / ROI)
    'val.eyebrow':     { fr: 'Le calcul', en: 'The math' },
    'val.title':       { fr: 'Pour <span class="title-accent">0,50 € par jour</span>', en: 'For <span class="title-accent">€0.50 a day</span>' },
    'val.sub':         { fr: 'Moins qu\'un café. Si tu évites <strong>un seul breach</strong> grâce à ZeldTrade, tu rentabilises ton abonnement pour <strong>plusieurs années</strong>.', en: 'Less than a coffee. Avoid <strong>a single breach</strong> thanks to ZeldTrade and your subscription pays for itself for <strong>years</strong>.' },
    'val.daily.head':  { fr: 'Au quotidien', en: 'Everyday spending' },
    'val.daily.1':     { fr: 'Croissant boulangerie', en: 'Bakery croissant' },
    'val.daily.2':     { fr: 'Café à emporter', en: 'Takeaway coffee' },
    'val.daily.3':     { fr: 'Bière au bar', en: 'Beer at the bar' },
    'val.vs.head':     { fr: 'Vs concurrence', en: 'Vs competitors' },
    'val.vs.footnote': { fr: '…et avec les seules règles prop firms FR vraiment intégrées', en: '…and with the only truly built-in FR prop firm rules' },
    'val.roi.head':    { fr: 'ROI d\'un seul breach évité', en: 'ROI of a single avoided breach' },
    'val.roi.num':     { fr: '36 mois', en: '36 months' },
    'val.roi.label':   { fr: 'd\'abonnement Funded payés<br>= 1 breach Apex 50K évité (540 $)', en: 'of Funded subscription paid for<br>= 1 avoided Apex 50K breach ($540)' },
    'val.roi.mini':    { fr: 'Trailing drawdown calculé au tick + alerte distance to floor en temps réel = tu ne te fais plus surprendre.', en: 'Tick-accurate trailing drawdown + real-time distance-to-floor alert = you never get caught off guard again.' },
    'val.bundle.title':{ fr: 'Ce que tu obtiens pour 14,99 €/mois', en: 'What you get for €14.99/mo' },
    'val.bundle.sub':  { fr: 'Si tu devais acheter chaque feature séparément ailleurs…', en: 'If you had to buy each feature separately elsewhere…' },
    'val.bundle.r1.feat':  { fr: 'IA Vision (analyse charts TradingView)', en: 'AI Vision (TradingView chart analysis)' },
    'val.bundle.r1.price': { fr: '~ 20 €/mois ailleurs', en: '~ €20/mo elsewhere' },
    'val.bundle.r2.feat':  { fr: 'Calcul trailing drawdown EOD précis 5 firms', en: 'Accurate EOD trailing drawdown for 5 firms' },
    'val.bundle.r2.price': { fr: 'N\'existe nulle part', en: 'Doesn\'t exist anywhere' },
    'val.bundle.r3.feat':  { fr: 'Journal multi-comptes + groupes', en: 'Multi-account journal + groups' },
    'val.bundle.r3.price': { fr: '~ 15 €/mois', en: '~ €15/mo' },
    'val.bundle.r4.feat':  { fr: 'Export PDF + JSON RGPD + CSV', en: 'PDF + GDPR JSON + CSV export' },
    'val.bundle.r4.price': { fr: '~ 8 €/mois', en: '~ €8/mo' },
    'val.bundle.r5.feat':  { fr: 'Calculateur fiscal micro-entrepreneur FR', en: 'French micro-entrepreneur tax calculator' },
    'val.bundle.r5.price': { fr: '~ 5 €/mois', en: '~ €5/mo' },
    'val.bundle.total.feat':  { fr: '<strong>Total équivalent ailleurs</strong>', en: '<strong>Equivalent total elsewhere</strong>' },
    'val.bundle.total.price': { fr: '<strong>~ 48 €/mois</strong>', en: '<strong>~ €48/mo</strong>' },
    'val.bundle.us.feat':     { fr: '<strong>Tu payes ZeldTrade Funded</strong>', en: '<strong>You pay ZeldTrade Funded</strong>' },
    'val.bundle.us.price':    { fr: '<strong>14,99 €/mois</strong>', en: '<strong>€14.99/mo</strong>' },
    'val.bundle.savings':     { fr: 'Tu économises ~33 €/mois — soit <strong>396 €/an</strong>', en: 'You save ~€33/mo — that\'s <strong>€396/year</strong>' },

    // Témoignages
    'test.eyebrow':    { fr: 'Ils l\'utilisent', en: 'They use it' },
    'test.title':      { fr: 'Ce qu\'en disent <span class="title-accent">les traders</span>', en: 'What <span class="title-accent">traders</span> say' },
    'test.stars':      { fr: '5 étoiles sur 5', en: '5 stars out of 5' },
    'test.q1':         { fr: '« Après plus d\'un an de trading, c\'est clairement le meilleur site que j\'ai utilisé pour tenir un journal de trading. L\'interface est claire, soignée, rapide et surtout efficace. Je n\'ai jamais autant apprécié analyser et journaliser mes trades. »', en: '"After more than a year of trading, this is clearly the best site I\'ve used to keep a trading journal. The interface is clean, polished, fast and, above all, effective. I\'ve never enjoyed analyzing and journaling my trades this much."' },
    'test.q2':         { fr: '« Je trouve le site très complet, une belle interface et facile de compréhension. »', en: '"I find the site really complete, with a great interface that\'s easy to understand."' },
    'test.q3':         { fr: '« Après 3 ans de trading à journaliser sur Notion, ce site est incroyable : il donne envie de journaliser ses trades. L\'interface est propre et rapide. »', en: '"After 3 years of trading and journaling on Notion, this site is incredible — it makes you want to journal your trades. The interface is clean and fast."' },

    // Tarifs (pricing)
    'pr.eyebrow':      { fr: 'Tarifs', en: 'Pricing' },
    'pr.title':        { fr: 'Simple et honnête', en: 'Simple and honest' },
    'pr.sub':          { fr: 'Aucune carte requise pour démarrer. Trader est gratuit pour toujours. Funded et Elite débloquent les outils sérieux.', en: 'No card required to start. Trader is free forever. Funded and Elite unlock the serious tools.' },
    'pr.founding.title': { fr: 'Offre Founding — jusqu\'au 30 juin', en: 'Founding offer — until June 30' },
    'pr.founding.sub':   { fr: 'Accès Funded à vie en échange de feedback honnête.', en: 'Lifetime Funded access in exchange for honest feedback.' },
    'pr.founding.cta':   { fr: 'Candidater →', en: 'Apply →' },
    'pr.billing.aria':    { fr: 'Période de facturation', en: 'Billing period' },
    'pr.billing.monthly': { fr: 'Mensuel', en: 'Monthly' },
    'pr.billing.yearly':  { fr: 'Annuel <span class="lp-billing-save">−2 mois</span>', en: 'Yearly <span class="lp-billing-save">−2 months</span>' },
    'pr.suffix.month':  { fr: '/ mois', en: '/ month' },
    'pr.suffix.year':   { fr: '/ an', en: '/ year' },
    'pr.trader.badge':   { fr: '✓ Gratuit à vie', en: '✓ Free for life' },
    'pr.trader.tagline': { fr: 'Pour découvrir sans engagement.', en: 'To explore with no commitment.' },
    'pr.trader.suffix':  { fr: '/ pour toujours', en: '/ forever' },
    'pr.trader.f1':      { fr: '1 compte (prop / crypto / personnel)', en: '1 account (prop / crypto / personal)' },
    'pr.trader.f2':      { fr: '1 analyse IA par jour', en: '1 AI analysis per day' },
    'pr.trader.f3':      { fr: 'Journal complet — chaque trade documenté', en: 'Full journal — every trade documented' },
    'pr.trader.f4':      { fr: 'Dashboard, Analytics, Goals, Calendrier', en: 'Dashboard, Analytics, Goals, Calendar' },
    'pr.trader.f5':      { fr: 'Calculateurs intégrés (position, R:R, fiscal micro)', en: 'Built-in calculators (position, R:R, micro tax)' },
    'pr.trader.f6':      { fr: 'Export JSON RGPD à tout moment', en: 'GDPR JSON export at any time' },
    'pr.trader.f7':      { fr: 'Bilingue FR / EN', en: 'Bilingual FR / EN' },
    'pr.trader.cta':     { fr: 'Commencer gratuitement →', en: 'Start for free →' },
    'pr.funded.badge':   { fr: '✦ Le plus populaire', en: '✦ Most popular' },
    'pr.funded.tagline': { fr: 'Pour le trader qui pilote ses 2 comptes groupés.', en: 'For the trader running their 2 grouped accounts.' },
    'pr.funded.perday.m':{ fr: 'soit 0,50 €/jour <strong style="color:#4ade80">— 50 % moins cher que Tradervue</strong>', en: 'that\'s €0.50/day <strong style="color:#4ade80">— 50% cheaper than Tradervue</strong>' },
    'pr.funded.perday.y':{ fr: '12,42 €/mois — économie 30 €', en: '€12.42/mo — save €30' },
    'pr.funded.f1':      { fr: '2 comptes (prop / crypto / personnel), groupables', en: '2 accounts (prop / crypto / personal), groupable' },
    'pr.funded.f2':      { fr: 'IA détecte entry/SL/TP depuis ton screenshot TradingView (5×/jour)', en: 'AI detects entry/SL/TP from your TradingView screenshot (5×/day)' },
    'pr.funded.f3':      { fr: '1 trade saisi → répliqué sur tes comptes groupés en 1 sauvegarde', en: '1 trade entered → replicated across your grouped accounts in 1 save' },
    'pr.funded.f4':      { fr: 'Archive PDF 1 page/trade — coaching ou candidature funded', en: '1-page PDF archive per trade — coaching or funded application' },
    'pr.funded.f5':      { fr: 'Trailing drawdown EOD précis — jamais surpris par un breach', en: 'Accurate EOD trailing drawdown — never surprised by a breach' },
    'pr.funded.f6':      { fr: 'Support prioritaire (canal direct)', en: 'Priority support (direct channel)' },
    'pr.funded.f7':      { fr: 'Tout le plan Trader inclus', en: 'Everything in the Trader plan included' },
    'pr.funded.cta':     { fr: 'Gratuit en bêta · puis 14,99 €/mois →', en: 'Free in beta · then €14.99/mo →' },
    'pr.elite.badge':    { fr: '✦ Premium', en: '✦ Premium' },
    'pr.elite.tagline':  { fr: 'Pour les power users multi-comptes ou les coachs.', en: 'For multi-account power users or coaches.' },
    'pr.elite.perday.m': { fr: 'soit 1 €/jour', en: 'that\'s €1/day' },
    'pr.elite.perday.y': { fr: '24,92 €/mois — économie 61 €', en: '€24.92/mo — save €61' },
    'pr.elite.f1':       { fr: 'Comptes illimités — multi-funded ou portefeuille coach', en: 'Unlimited accounts — multi-funded or coach portfolio' },
    'pr.elite.f2':       { fr: 'IA illimitée — valide chaque trade', en: 'Unlimited AI — validate every trade' },
    'pr.elite.f3':       { fr: 'Accès anticipé aux features beta', en: 'Early access to beta features' },
    'pr.elite.f4':       { fr: 'Support 24h via canal direct', en: '24h support via direct channel' },
    'pr.elite.f5':       { fr: 'Votes décisifs sur la roadmap — ta voix compte 5× plus', en: 'Decisive roadmap votes — your voice counts 5× more' },
    'pr.elite.f6':       { fr: 'Tout le plan Funded inclus', en: 'Everything in the Funded plan included' },
    'pr.elite.cta':      { fr: 'Gratuit en bêta · puis 29,99 €/mois →', en: 'Free in beta · then €29.99/mo →' },
    'pr.trust.1':        { fr: '✓ Annulation 1-clic', en: '✓ 1-click cancellation' },
    'pr.trust.2':        { fr: '✓ Garantie 30 jours satisfait ou remboursé', en: '✓ 30-day money-back guarantee' },
    'pr.trust.3':        { fr: '✓ Export complet RGPD à tout moment', en: '✓ Full GDPR export at any time' },
    'pr.trust.4':        { fr: '✓ Aucune CB requise pour démarrer', en: '✓ No card required to start' },

    // À propos / fondateur (v0.9.349)
    'about.eyebrow':   { fr: 'À propos', en: 'About' },
    'about.title':     { fr: 'Fait par un trader, <span class="title-accent">pour les traders</span>', en: 'Built by a trader, <span class="title-accent">for traders</span>' },
    'about.p1':        { fr: 'Je trade sur compte prop firm, et j\'ai longtemps journalisé mes trades à la main dans des tableurs. Le souci : aucun outil ne comprenait vraiment <strong>les règles d\'une prop firm</strong> — drawdown trailing, daily loss, calcul EOD — et tout me prenait un temps fou.', en: 'I trade on prop firm accounts, and for a long time I journaled my trades by hand in spreadsheets. The problem: no tool really understood <strong>prop firm rules</strong> — trailing drawdown, daily loss, EOD calculation — and everything took forever.' },
    'about.p2':        { fr: 'ZeldTrade, c\'est le journal que je voulais utiliser. Tu colles ton screenshot TradingView, <strong>l\'IA remplit le trade en quelques secondes</strong>, et l\'app suit tes règles prop firm automatiquement. Pas d\'usine à gaz : juste ce qu\'il faut pour progresser.', en: 'ZeldTrade is the journal I wanted to use. Paste your TradingView screenshot, <strong>the AI fills the trade in seconds</strong>, and the app tracks your prop firm rules automatically. No bloat — just what you need to improve.' },
    'about.p3':        { fr: 'C\'est un projet <strong>indépendant, hébergé en Europe</strong>, sans pub et sans revente de tes données. Chaque retour que tu m\'envoies façonne directement les prochaines mises à jour.', en: 'It\'s an <strong>independent project, hosted in Europe</strong>, with no ads and no reselling of your data. Every piece of feedback you send directly shapes the next updates.' },
    'about.sign.name': { fr: 'Le fondateur de ZeldTrade', en: 'The founder of ZeldTrade' },
    'about.sign.role': { fr: 'Trader & créateur indépendant', en: 'Independent trader & maker' },

    // FAQ
    'faq.eyebrow':     { fr: 'Questions fréquentes', en: 'Frequently asked questions' },
    'faq.title':       { fr: 'Tout ce qu\'on me demande', en: 'Everything people ask me' },
    'faq.q1':          { fr: 'C\'est gratuit ?', en: 'Is it free?' },
    'faq.a1':          { fr: 'Le plan <strong>Trader</strong> est gratuit pour toujours (1 compte, 1 analyse IA/jour). Le plan <strong>Funded</strong> à 14,99 €/mois débloque 2 comptes, 5 analyses IA/jour, groupes multi-comptes, export PDF, calcul EOD précis. Le plan <strong>Elite</strong> à 29,99 €/mois passe à des comptes illimités, une IA illimitée, accès anticipé aux features beta. Les 5 dernières places Founding offrent un accès Funded à vie en échange de feedback.', en: 'The <strong>Trader</strong> plan is free forever (1 account, 1 AI analysis/day). The <strong>Funded</strong> plan at €14.99/mo unlocks 2 accounts, 5 AI analyses/day, multi-account groups, PDF export and accurate EOD calculation. The <strong>Elite</strong> plan at €29.99/mo goes up to unlimited accounts, unlimited AI and early access to beta features. The last 5 Founding spots grant lifetime Funded access in exchange for feedback.' },
    'faq.q2':          { fr: 'Mes données sont sécurisées ?', en: 'Is my data secure?' },
    'faq.a2':          { fr: 'Oui. Données chiffrées at-rest (Firestore Google EU), accès par règles strictes (chaque user voit uniquement ses propres trades), MFA admin, audit logs immuables. Aucun tracking, aucun cookie tiers, RGPD compliant.', en: 'Yes. Data encrypted at rest (Firestore Google EU), strict access rules (each user only sees their own trades), admin MFA, immutable audit logs. No tracking, no third-party cookies, GDPR compliant.' },
    'faq.q3':          { fr: 'Ça marche avec quelle prop firm ?', en: 'Which prop firms does it work with?' },
    'faq.a3':          { fr: 'Apex Trader Funding, FTMO (1-Step + 2-Step), Topstep, Lucid Trading, Funding Pips. Les règles spécifiques (trailing EOD vs static, safety net, daily loss, max contracts) sont intégrées et configurables par compte.', en: 'Apex Trader Funding, FTMO (1-Step + 2-Step), Topstep, Lucid Trading, Funding Pips. The specific rules (EOD trailing vs static, safety net, daily loss, max contracts) are built in and configurable per account.' },
    'faq.q4':          { fr: 'Combien de comptes je peux gérer ?', en: 'How many accounts can I manage?' },
    'faq.a4':          { fr: '1 compte sur le plan Trader, 2 comptes sur Funded, comptes illimités sur Elite. Les plans Funded et Elite débloquent les <strong>groupes multi-comptes</strong> : 1 trade saisi peut être répliqué sur plusieurs comptes en une seule sauvegarde.', en: '1 account on the Trader plan, 2 accounts on Funded, unlimited accounts on Elite. The Funded and Elite plans unlock <strong>multi-account groups</strong>: one entered trade can be replicated across several accounts in a single save.' },
    'faq.q5':          { fr: 'Je peux récupérer mes données si je quitte ?', en: 'Can I get my data back if I leave?' },
    'faq.a5':          { fr: 'Oui — droit à la portabilité RGPD. Export JSON complet (trades + comptes + groupes + settings) disponible dans les Réglages. Tu peux aussi supprimer ton compte à tout moment (toutes les données sont alors effacées).', en: 'Yes — GDPR right to portability. A full JSON export (trades + accounts + groups + settings) is available in Settings. You can also delete your account at any time (all data is then erased).' },
    'faq.q6':          { fr: 'Qui est derrière ZeldTrade ?', en: 'Who is behind ZeldTrade?' },
    'faq.a6':          { fr: 'L\'équipe ZeldTrade — projet français spécialisé prop firms, conçu par des traders pour des traders. Née du manque de bons outils français adaptés aux règles spécifiques des prop firms. Tout est codé à la main, pas un copier-coller d\'un SaaS US. Pour les détails légaux : voir les <a href="/legal" style="color:var(--accent-l)">mentions légales</a>.', en: 'The ZeldTrade team — a French project specialized in prop firms, built by traders for traders. Born out of the lack of good French tools tailored to the specific rules of prop firms. Everything is hand-coded, not a copy-paste of a US SaaS. For legal details: see the <a href="/legal" style="color:var(--accent-l)">legal notice</a>.' },

    // Contact
    'contact.title':   { fr: 'Une question ?', en: 'A question?' },
    'contact.sub':     { fr: 'Pseudo et message — pas besoin d\'email. Réponse rapide par l\'équipe ZeldTrade.', en: 'Username and message — no email needed. Quick reply from the ZeldTrade team.' },
    'contact.name':    { fr: 'Pseudo', en: 'Username' },
    'contact.name.ph': { fr: 'Ton pseudo Discord ou autre', en: 'Your Discord username or another' },
    'contact.message': { fr: 'Message', en: 'Message' },
    'contact.message.ph': { fr: 'Une question, une suggestion, une demande d\'accès…', en: 'A question, a suggestion, an access request…' },
    'contact.send':    { fr: 'Envoyer →', en: 'Send →' },
    'contact.success.title': { fr: 'Message envoyé !', en: 'Message sent!' },
    'contact.success.sub':   { fr: 'L\'équipe ZeldTrade te répondra rapidement.', en: 'The ZeldTrade team will get back to you quickly.' },
  };

  // ── Méta traduisibles (<title>, description) ────────────────────────────────
  const META = {
    fr: {
      title: 'ZeldTrade · Journal de trading prop firm, crypto et fonds propres',
      description: 'Journal de trading français spécialisé prop firms (Apex, FTMO, Topstep, Lucid, Funding Pips) + comptes crypto (Binance, Coinbase) et fonds propres. IA Vision pour analyser tes charts TradingView, multi-comptes, RGPD natif. Made in France',
    },
    en: {
      title: 'ZeldTrade · Trading journal for prop firms, crypto & personal funds',
      description: 'Trading journal specialized for prop firms (Apex, FTMO, Topstep, Lucid, Funding Pips) + crypto accounts (Binance, Coinbase) and personal funds. AI Vision to analyze your TradingView charts, multi-account, GDPR-native. Made in France',
    },
  };

  const LS_KEY = 'zt_lang';

  function getInitialLang() {
    try {
      const p = new URLSearchParams(location.search).get('lang');
      if (p === 'en' || p === 'fr') return p;
      const ls = localStorage.getItem(LS_KEY);
      if (ls === 'en' || ls === 'fr') return ls;
      // v0.9.334 : traduction EN complète → détection navigateur activée.
      // Navigateur francophone → FR ; tout le reste → EN (le visiteur peut toujours
      // basculer via les drapeaux, choix mémorisé en localStorage + ?lang=).
      return (navigator.language || '').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    } catch (e) { return 'fr'; }
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const t = DICT[el.getAttribute('data-i18n')];
      if (t && t[lang] != null) el.textContent = t[lang];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      const t = DICT[el.getAttribute('data-i18n-html')];
      if (t && t[lang] != null) el.innerHTML = t[lang];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      const t = DICT[el.getAttribute('data-i18n-ph')];
      if (t && t[lang] != null) el.setAttribute('placeholder', t[lang]);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      const t = DICT[el.getAttribute('data-i18n-aria')];
      if (t && t[lang] != null) el.setAttribute('aria-label', t[lang]);
    });

    const m = META[lang];
    if (m) {
      if (m.title) document.title = m.title;
      const d = document.querySelector('meta[name="description"]');
      if (d && m.description) d.setAttribute('content', m.description);
    }

    // v0.9.327 : deux boutons drapeaux (FR / EN) côte à côte ; on surligne l'actif.
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      const on = b.getAttribute('data-lang') === lang;
      b.style.opacity = on ? '1' : '0.4';
      b.style.borderColor = on ? 'var(--accent-l)' : 'rgba(255,255,255,0.18)';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) {}
  }

  // Overlay « écran de chargement » pendant la bascule de langue.
  function switchWithLoader(next) {
    const ov = document.getElementById('langLoader');
    if (!ov) { applyLang(next); return; }
    ov.style.display = 'flex';
    requestAnimationFrame(function () { ov.style.opacity = '1'; });
    setTimeout(function () { applyLang(next); }, 90);           // applique (caché par l'overlay)
    setTimeout(function () {                                     // puis fondu de sortie
      ov.style.opacity = '0';
      setTimeout(function () { ov.style.display = 'none'; }, 360);
    }, 780);
  }

  function init() {
    applyLang(getInitialLang());
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        const l = b.getAttribute('data-lang');
        if (document.documentElement.lang !== l) switchWithLoader(l);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
