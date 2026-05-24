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
    'how.3.desc':   { fr: 'R:R, risque %, P&amp;L net (fees/spreads inclus), drawdown prop firm. Tout calculé en live, multi-comptes synchronisés.', en: 'R:R, risk %, net P&amp;L (fees/spreads included), prop firm drawdown. All computed live, multi-account synced.' },

    // Features — 3 piliers
    'feat.eyebrow': { fr: '3 piliers', en: '3 pillars' },
    'feat.title':   { fr: 'Ce que ZeldTrade fait <span class="title-accent">mieux que tous les autres</span>', en: 'What ZeldTrade does <span class="title-accent">better than everyone else</span>' },
    'feat.sub':     { fr: 'Pas une liste de 50 features. 3 choses bien faites qui te font économiser 1h par jour et éviter des breaches.', en: 'Not a list of 50 features. 3 things done well that save you an hour a day and keep you from breaching.' },
    'feat.1.title': { fr: 'IA Vision qui lit tes charts', en: 'AI Vision that reads your charts' },
    'feat.1.desc':  { fr: '<strong>Ctrl+V</strong> ton screenshot TradingView → l\'IA détecte entry, SL et TP en <strong>2 secondes</strong>. Modèle <strong>IA standard</strong> en cascade pour Trader, et <strong>IA avancée</strong> en fallback automatique sur les charts complexes pour Funded et Elite.', en: '<strong>Ctrl+V</strong> your TradingView screenshot → AI detects entry, SL and TP in <strong>2 seconds</strong>. <strong>Standard AI</strong> for Trader, with <strong>advanced AI</strong> auto-falling back on complex charts for Funded and Elite.' },
    'feat.1.b1':    { fr: 'Trader : 1 analyse / jour (IA)', en: 'Trader: 1 analysis / day (AI)' },
    'feat.1.b2':    { fr: 'Funded : 20 / jour (IA + IA avancée)', en: 'Funded: 20 / day (AI + advanced AI)' },
    'feat.1.b3':    { fr: 'Elite : 100 / jour (IA + IA avancée)', en: 'Elite: 100 / day (AI + advanced AI)' },
    'feat.2.title': { fr: 'Règles prop firms calculées au tick', en: 'Prop firm rules computed to the tick' },
    'feat.2.desc':  { fr: '<strong>Trailing drawdown EOD précis</strong> pour Apex, Topstep, Lucid (Flex/Pro/Direct), Funding Pips. Static pour FTMO 2-Step. Safety net, daily loss limit, max contracts intégrés. Tu vois le risque <strong>en temps réel</strong> dans le dashboard.', en: '<strong>Accurate EOD trailing drawdown</strong> for Apex, Topstep, Lucid (Flex/Pro/Direct), Funding Pips. Static for FTMO 2-Step. Safety net, daily loss limit and max contracts built in. You see your risk <strong>in real time</strong> on the dashboard.' },
    'feat.2.b1':    { fr: '5 prop firms supportées (12+ presets)', en: '5 prop firms supported (12+ presets)' },
    'feat.2.b2':    { fr: 'Distance to floor + Apex risk bar', en: 'Distance to floor + Apex risk bar' },
    'feat.2.b3':    { fr: 'Comptes Crypto (Binance / Coinbase) &amp; Fonds propres', en: 'Crypto accounts (Binance / Coinbase) &amp; personal funds' },
    'feat.3.title': { fr: 'Multi-comptes + groupes en 1 clic', en: 'Multi-account + groups in 1 click' },
    'feat.3.desc':  { fr: '<strong>Jusqu\'à 100 comptes</strong> (prop / crypto / fonds propres). Crée un groupe, saisis ton trade une fois, il se réplique automatiquement sur tous les comptes du groupe avec la bonne taille / bon levier.', en: '<strong>Up to 100 accounts</strong> (prop / crypto / personal funds). Create a group, enter your trade once, and it replicates automatically across every account in the group with the right size / leverage.' },
    'feat.3.b1':    { fr: '10 comptes (Funded) · 100 comptes (Elite)', en: '10 accounts (Funded) · 100 accounts (Elite)' },
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
    'feat.mini.8':  { fr: '<strong>Bilingue FR / EN</strong><br><span>Switch dynamique sans reload</span>', en: '<strong>Bilingual FR / EN</strong><br><span>Dynamic switch, no reload</span>' },
    'feat.mini.9':  { fr: '<strong>RGPD natif</strong><br><span>Export JSON complet, suppression 1-clic</span>', en: '<strong>GDPR-native</strong><br><span>Full JSON export, 1-click deletion</span>' },

    // Footer
    'footer.updates': { fr: 'Nouveautés',      en: "What's new" },
    'footer.legal':   { fr: 'Mentions légales', en: 'Legal notice' },
    'footer.cgu':     { fr: 'CGU',             en: 'Terms' },
    'footer.privacy': { fr: 'Confidentialité', en: 'Privacy' },
    'footer.contact': { fr: 'Contact',         en: 'Contact' },

    // Cookie banner
    'cookie.text': {
      fr: 'ZeldTrade utilise uniquement des cookies <strong style="color:#e6edf3">essentiels</strong> : connexion (Firebase Auth), sécurité anti-bot (Cloudflare Turnstile / hCaptcha) et stockage local de tes données. <strong style="color:#e6edf3">Aucun cookie publicitaire, aucun tracking.</strong> <a href="/privacy" style="color:#a78bfa;text-decoration:none">Politique de confidentialité</a>',
      en: 'ZeldTrade uses only <strong style="color:#e6edf3">essential</strong> cookies: login (Firebase Auth), anti-bot security (Cloudflare Turnstile / hCaptcha) and local storage of your data. <strong style="color:#e6edf3">No advertising cookies, no tracking.</strong> <a href="/privacy" style="color:#a78bfa;text-decoration:none">Privacy policy</a>',
    },
    'cookie.btn': { fr: 'J\'ai compris', en: 'Got it' },
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
      // v0.9.322 : pendant le build de la traduction EN, défaut FR pour TOUS (on ne
      // montre pas une page mi-FR/mi-EN aux visiteurs non-francophones). Le toggle +
      // ?lang=en + localStorage permettent quand même de prévisualiser l'EN.
      // TODO (EN complet) : rétablir la détection navigateur :
      //   return (navigator.language||'').toLowerCase().indexOf('fr')===0 ? 'fr' : 'en';
      return 'fr';
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

    const tg = document.getElementById('langToggle');
    if (tg) {
      tg.textContent = (lang === 'fr') ? 'EN' : 'FR';
      tg.setAttribute('aria-label', lang === 'fr' ? 'Switch to English' : 'Passer en français');
    }

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
    const tg = document.getElementById('langToggle');
    if (tg) tg.addEventListener('click', function () {
      switchWithLoader(document.documentElement.lang === 'fr' ? 'en' : 'fr');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
