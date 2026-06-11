// ─── LANDING I18N (FR/EN) — v1.0.4 ─────────────────────────────────────────
// Bilingue FR/EN. Le FR est dans le HTML (défaut + SEO) ; le dictionnaire fournit
// l'EN (et le FR pour restaurer après une bascule). Une clé absente => texte HTML
// conservé (dégradation gracieuse).
//   data-i18n="cle"      -> textContent
//   data-i18n-html="cle" -> innerHTML
//   data-i18n-ph="cle"   -> placeholder
//   data-i18n-aria="cle" -> aria-label
// Toggle : boutons .lang-btn[data-lang]. Persistance ?lang= + localStorage.
(function () {
  'use strict';

  const DICT = {
    // Tabs
    'tab.produit': { fr: 'Produit',    en: 'Product' },
    'tab.tarifs':  { fr: 'Tarifs',     en: 'Pricing' },
    'tab.faq':     { fr: 'FAQ',        en: 'FAQ' },
    'tab.equipe':  { fr: 'Équipe',     en: 'Team' },

    // Nav
    'nav.produit': { fr: 'Produit',    en: 'Product' },
    'nav.faq':     { fr: 'FAQ',        en: 'FAQ' },
    'nav.equipe':  { fr: 'Équipe',     en: 'Team' },
    'nav.firms':   { fr: 'Prop firms', en: 'Prop firms' },
    'nav.demo':    { fr: 'Démo',       en: 'Demo' },
    'nav.calc':    { fr: 'Calc EOD',   en: 'EOD calc' },
    'nav.about':   { fr: 'À propos',   en: 'About' },
    'nav.pricing': { fr: 'Tarifs',     en: 'Pricing' },
    'nav.updates': { fr: 'Nouveautés', en: "What's new" },
    'nav.login':   { fr: 'Connexion',  en: 'Log in' },
    'nav.signup':  { fr: "Lancer l'app →", en: 'Launch the app →' },

    // Status bar + promo
    'sb.launch':   { fr: 'EN LIGNE · MADE IN FRANCE 🇫🇷', en: 'ONLINE · MADE IN FRANCE 🇫🇷' },
    'promo.text':  { fr: "🔥 Lancement : −40% sur Funded & Elite + essai 14 jours", en: '🔥 Launch: −40% on Funded & Elite + 14-day trial' },
    'promo.copy':  { fr: 'copier', en: 'copy' },
    'promo.aria':  { fr: 'Copier le code promo ZELD40', en: 'Copy promo code ZELD40' },

    // Hero
    'hero.eyebrow': { fr: 'POUR LES TRADERS PROP FIRM · CRYPTO · FONDS PROPRES', en: 'FOR PROP FIRM · CRYPTO · PERSONAL FUNDS TRADERS' },
    'hero.headline': {
      fr: '<span class="word-reveal"><span>Arrête</span></span> <span class="word-reveal"><span>de</span></span> <span class="word-reveal"><span>cramer</span></span><br><span class="word-reveal"><span>tes</span></span> <span class="word-reveal"><span>comptes</span></span> <span class="word-reveal"><span class="accent">funded.</span></span>',
      en: '<span class="word-reveal"><span>Stop</span></span> <span class="word-reveal"><span>blowing</span></span><br><span class="word-reveal"><span>your</span></span> <span class="word-reveal"><span>funded</span></span> <span class="word-reveal"><span class="accent">accounts.</span></span>',
    },
    'hero.lead': {
      fr: "<b>Colle ton screenshot TradingView → l'IA remplit tout.</b> Drawdown EOD au tick près sur Apex, FTMO, Topstep. Multi-comptes : un trade saisi, tout se réplique.",
      en: "<b>Paste your TradingView screenshot → AI fills everything.</b> Tick-accurate EOD drawdown on Apex, FTMO, Topstep. Multi-account: log once, replicates everywhere.",
    },
    'hero.cta.signup': { fr: 'Tester ZeldTrade — c\'est gratuit', en: 'Try ZeldTrade — it\'s free' },
    'hero.cta.demo':   { fr: '▶ Tester la démo', en: '▶ Try the live demo' },
    'pricing.billed':  { fr: 'facturé', en: 'billed' },
    'pricing.slashyr': { fr: '/an', en: '/yr' },
    'pricing.propready': { fr: '✅ Prêt pour Apex · FTMO · Topstep · Lucid · FP', en: '✅ Ready for Apex · FTMO · Topstep · Lucid · FP' },
    'hero.cta.nocard': { fr: 'Sans carte bancaire', en: 'No credit card' },
    'hero.usercount':  { fr: 'traders nous font déjà confiance', en: 'traders already trust us' },
    'hero.live':       { fr: '· en direct', en: '· live' },
    'dash.dd':         { fr: 'EOD Trailing Drawdown', en: 'EOD Trailing Drawdown' },

    // Split
    'split.eyebrow': { fr: '// AVANT / APRÈS', en: '// BEFORE / AFTER' },
    'split.title': { fr: 'Deux trajectoires de compte funded. <span class="accent">Une seule survit.</span>', en: 'Two funded-account paths. <span class="accent">Only one survives.</span>' },
    'split.sub':   { fr: "Le trailing drawdown EOD ne pardonne aucune approximation. La différence n'est pas dans ton edge — elle est dans ton tracking.", en: 'EOD trailing drawdown forgives nothing. The difference isn\'t your edge — it\'s your tracking.' },
    'split.before.tag':  { fr: 'SANS OUTIL · J+14', en: 'NO TOOL · DAY 14' },
    'split.before.head': { fr: 'Compte Apex 150K · cramé', en: 'Apex 150K account · blown' },
    'split.before.sub':  { fr: 'Trailing dépassé de $87 sur un trade gagnant non clôturé en EOD.', en: 'Trailing breached by $87 on a winning trade left open at EOD.' },
    'split.before.1': { fr: 'Calcul EOD approximatif → breach surprise', en: 'Rough EOD math → surprise breach' },
    'split.before.2': { fr: 'Trades notés sur papier ou Excel', en: 'Trades logged on paper or Excel' },
    'split.before.3': { fr: 'Aucun signal avant le coup fatal', en: 'No signal before the fatal trade' },
    'split.after.tag':  { fr: 'AVEC ZELDTRADE · J+90', en: 'WITH ZELDTRADE · DAY 90' },
    'split.after.head': { fr: 'Compte Apex 150K · payé', en: 'Apex 150K account · paid out' },
    'split.after.sub':  { fr: 'Buffer EOD remonté en temps réel après chaque trade. Aucun breach.', en: 'EOD buffer recomputed in real time after each trade. No breach.' },
    'split.after.1': { fr: 'EOD précis, signal avant chaque trade risqué', en: 'Precise EOD, alert before every risky trade' },
    'split.after.2': { fr: 'IA Vision lit entry/SL/TP en 1 screenshot', en: 'AI Vision reads entry/SL/TP from 1 screenshot' },
    'split.after.3': { fr: 'Multi-comptes synchronisés en temps réel', en: 'Multi-account synced in real time' },

    // Firms
    'firms.title': { fr: 'Les 5 prop firms majeures. <span class="accent">Leurs règles exactes.</span>', en: 'The 5 major prop firms. <span class="accent">Their exact rules.</span>' },
    'firms.sub':   { fr: "Pas une moyenne. Pas une approximation. Chaque firm a son propre moteur de règles, codé à la main et vérifié par les bêta testeurs.", en: 'No average. No approximation. Each firm has its own rules engine, hand-coded and verified by beta testers.' },
    'firms.none':   { fr: 'Aucune', en: 'None' },
    'firms.mindays':{ fr: 'Jours de trading min.', en: 'Min trading days' },
    'firms.trailing':  { fr: 'Trailing', en: 'Trailing' },
    'firms.dailyloss': { fr: 'Perte journalière', en: 'Daily loss' },
    'firms.split':     { fr: 'Partage des gains', en: 'Profit split' },
    'firms.rules.apex': { fr: 'Voir les règles Apex Trader Funding', en: 'View Apex Trader Funding rules' },
    'firms.rules.ftmo': { fr: 'Voir les règles FTMO Challenge', en: 'View FTMO Challenge rules' },
    'firms.rules.tps':  { fr: 'Voir les règles Topstep Combine', en: 'View Topstep Combine rules' },
    'firms.rules.lcd':  { fr: 'Voir les règles Lucid Trading', en: 'View Lucid Trading rules' },
    'firms.rules.fnp':  { fr: 'Voir les règles Funding Pips', en: 'View Funding Pips rules' },
    'firms.apex.split': { fr: "100% jusqu'à $25k", en: '100% up to $25k' },
    'firms.static': { fr: 'Statique · 10%', en: 'Static · 10%' },
    'firms.staticshort': { fr: 'Statique', en: 'Static' },
    'firms.yes':    { fr: 'Oui', en: 'Yes' },
    'firms.upto90': { fr: "Jusqu'à 90%", en: 'Up to 90%' },
    'firms.disclaimer': { fr: "Les marques mentionnées (Apex Trader Funding, FTMO, Topstep, Lucid Trading, Funding Pips) appartiennent à leurs propriétaires respectifs. ZeldTrade n'est ni affilié, ni sponsorisé, ni approuvé par ces sociétés.", en: 'The brands mentioned (Apex Trader Funding, FTMO, Topstep, Lucid Trading, Funding Pips) belong to their respective owners. ZeldTrade is not affiliated with, sponsored by, or endorsed by these companies.' },

    // Demo
    'demo.title': { fr: 'Un trade saisi. <span class="accent">Tout réplique.</span>', en: 'One trade logged. <span class="accent">Everything replicates.</span>' },
    'demo.sub':   { fr: "Drop un screen TradingView, l'IA Vision détecte entry, SL, TP et taille. Le trade se propage sur tous tes comptes groupés avec les bons ratios. Le journal s'écrit tout seul — prop firm, crypto ou fonds propres.", en: 'Drop a TradingView screenshot, AI Vision detects entry, SL, TP and size. The trade propagates to all your grouped accounts with the right ratios. The journal writes itself — prop firm, crypto or personal funds.' },
    'demo.today':   { fr: "Journal · Aujourd'hui", en: 'Journal · Today' },
    'demo.price':   { fr: 'Évolution prix · 1m', en: 'Price action · 1m' },
    'demo.winrate': { fr: 'Win rate', en: 'Win rate' },
    'demo.sb.accounts': { fr: 'COMPTES', en: 'ACCOUNTS' },
    'demo.sb.journal':  { fr: 'JOURNAL', en: 'JOURNAL' },
    'demo.sb.tools':    { fr: 'OUTILS',  en: 'TOOLS' },
    'demo.sb.today':    { fr: "Aujourd'hui · 3 trades", en: 'Today · 3 trades' },
    'demo.sb.week':     { fr: 'Semaine · 14 trades', en: 'Week · 14 trades' },
    'demo.sb.archive':  { fr: 'Archive PDF', en: 'PDF archive' },
    'demo.sb.calc':     { fr: 'Calc. EOD', en: 'EOD calc' },
    'demo.sb.import':   { fr: 'Import TradingView', en: 'TradingView import' },

    // Calc
    'calc.title': { fr: 'Calc. EOD drawdown. <span class="accent">Essaye-la.</span>', en: 'EOD drawdown calc. <span class="accent">Try it.</span>' },
    'calc.sub':   { fr: "Le même moteur que celui qui tourne dans l'app. Joue avec les curseurs et regarde le buffer évoluer en temps réel.", en: 'The same engine that runs inside the app. Play with the sliders and watch the buffer move in real time.' },
    'calc.params':     { fr: 'Paramètres compte', en: 'Account parameters' },
    'calc.params.sub': { fr: 'Ajuste les valeurs · le buffer réagit en live.', en: 'Adjust the values · the buffer reacts live.' },
    'calc.firm':    { fr: 'Prop firm', en: 'Prop firm' },
    'calc.size':    { fr: 'Taille compte initial', en: 'Initial account size' },
    'calc.hwm':     { fr: 'Equity au plus haut (HWM)', en: 'High water mark (HWM)' },
    'calc.openpnl': { fr: 'P&L ouvert', en: 'Open P&L' },
    'calc.risk':    { fr: 'Risque trade prévu', en: 'Planned trade risk' },
    'calc.safe':    { fr: 'SAFE · trade autorisé', en: 'SAFE · trade allowed' },
    'calc.bufafter':{ fr: '// buffer EOD après ce trade', en: '// EOD buffer after this trade' },
    'calc.floor':   { fr: 'Plancher EOD', en: 'EOD floor' },
    'calc.equity':  { fr: 'Equity actuelle', en: 'Current equity' },
    'calc.buffer':  { fr: 'Buffer actuel', en: 'Current buffer' },
    'calc.dist':    { fr: 'Distance au breach', en: 'Distance to breach' },

    // About
    'about.title': { fr: 'Fait par un trader, <span class="accent">pour les traders.</span>', en: 'Built by a trader, <span class="accent">for traders.</span>' },
    'about.sub':   { fr: "Pas d'équipe. Pas d'investisseur. Juste un dev qui trade et qui code.", en: 'No team. No investor. Just a dev who trades and codes.' },
    'about.photo': { fr: '[ Photo ]<br>indé · France', en: '[ Photo ]<br>indie · France' },
    'about.p1': { fr: "Salut, c'est <strong>l'équipe ZeldTrade</strong> (enfin… surtout une personne). Dev qui trade sur prop firm depuis 2023.", en: "Hi, this is the <strong>ZeldTrade team</strong> (well… mostly one person). A dev trading prop firms since 2023." },
    'about.p2': { fr: "La première année, deux comptes Apex cramés faute d'avoir compris le trailing drawdown EOD. Aucun outil ne traitait vraiment les règles d'une prop firm. Du coup, celui que j'aurais voulu utiliser dès le début a été codé — et élargi à la crypto et aux fonds propres.", en: 'The first year, two Apex accounts blown for not understanding EOD trailing drawdown. No tool truly handled a prop firm\'s rules. So the one I wished I\'d had got built — then extended to crypto and personal funds.' },
    'about.p3': { fr: "Dev solo, bêta testeurs, zéro pub, zéro investisseur. <strong>Si tu écris, c'est une vraie personne qui répond.</strong>", en: 'Solo dev, beta testers, zero ads, zero investors. <strong>If you write, a real person answers.</strong>' },
    'about.loc': { fr: 'France 🇫🇷 · <b>indé · hébergé en Europe</b>', en: 'France 🇫🇷 · <b>indie · hosted in Europe</b>' },
    'about.changelog': { fr: 'Nouveautés', en: "What's new" },

    // FAQ
    'faq.title': { fr: 'Les questions que tu te poses.', en: 'The questions you\'re asking.' },
    'faq.sub':   { fr: "Réponses honnêtes. Si la tienne n'est pas listée, écris sur Discord ou via le formulaire en bas.", en: 'Honest answers. If yours isn\'t listed, write on Discord or via the form below.' },
    'faq.q1': { fr: "C'est quoi le « EOD trailing drawdown » et pourquoi c'est piégeux ?", en: 'What is "EOD trailing drawdown" and why is it tricky?' },
    'faq.a1': { fr: "Sur Apex (et d'autres firms) le drawdown se calcule en fin de journée, pas en intraday. Ton equity ouvert compte. Un trade gagnant non clôturé peut faire monter ton high watermark — et baisser ton trailing floor d'autant. La majorité des breach viennent de là : tu pensais avoir $3 000 de buffer, en réalité $400.", en: 'On Apex (and other firms) drawdown is computed end-of-day, not intraday. Your open equity counts. A winning trade left open can raise your high watermark — and lower your trailing floor by the same amount. Most breaches come from this: you thought you had $3,000 of buffer, you really had $400.' },
    'faq.q2': { fr: "L'IA Vision lit vraiment mes screens TradingView ?", en: 'Does AI Vision really read my TradingView screenshots?' },
    'faq.a2': { fr: "Oui — colle l'image (Ctrl+V) ou dépose-la, le moteur extrait entry, SL, TP, taille et symbole en quelques secondes. Tu valides ou corriges en un clic. Marche sur tes captures TradingView, MT4/MT5, crypto…", en: 'Yes — paste the image (Ctrl+V) or drop it, the engine extracts entry, SL, TP, size and symbol in seconds. You confirm or fix in one click. Works on TradingView, MT4/MT5, crypto screenshots…' },
    'faq.q3': { fr: 'Je peux grouper plusieurs comptes en un seul trade ?', en: 'Can I group several accounts into one trade?' },
    'faq.a3': { fr: "Oui — tu écris une fois, ZeldTrade dispatche selon la taille de chaque compte (ratios persos possibles). Prop firm, crypto ou fonds propres : tout se synchronise.", en: 'Yes — you write once, ZeldTrade dispatches based on each account\'s size (custom ratios possible). Prop firm, crypto or personal funds: everything syncs.' },
    'faq.q4': { fr: 'Ça marche aussi pour la crypto et les fonds propres ?', en: 'Does it work for crypto and personal funds too?' },
    'faq.a4': { fr: "Oui. ZeldTrade gère prop firm, comptes crypto (Binance, Coinbase) et fonds propres dans un seul journal, avec les bons calculs pour chaque type de compte.", en: 'Yes. ZeldTrade handles prop firm, crypto accounts (Binance, Coinbase) and personal funds in one journal, with the right calculations for each account type.' },
    'faq.q5': { fr: 'Pourquoi c\'est si peu cher ?', en: 'Why is it so cheap?' },
    'faq.a5': { fr: "Projet indé, déjà développé. Pas de levée, pas de budget marketing. Le prix couvre l'infra (l'IA Vision tape sur des APIs payantes) et un revenu raisonnable.", en: 'Indie project, already built. No funding round, no marketing budget. The price covers infra (AI Vision hits paid APIs) and a reasonable income.' },
    'faq.q6': { fr: 'Où sont mes données ?', en: 'Where is my data?' },
    'faq.a6': { fr: 'Hébergées en Europe, RGPD-natif. Export JSON intégral et suppression du compte en un clic. Détails : <a href="/privacy">confidentialité</a> et <a href="/legal">mentions légales</a>.', en: 'Hosted in Europe, GDPR-native. Full JSON export and one-click account deletion. Details: <a href="/privacy">privacy</a> and <a href="/legal">legal notice</a>.' },

    // Pricing
    'pricing.title': { fr: 'Simple. <span class="accent">Honnête.</span>', en: 'Simple. <span class="accent">Honest.</span>' },
    'pricing.sub':   { fr: 'Essai 14 jours, sans carte bancaire. Si tu pars, tu emportes tes données.', en: '14-day free trial, no credit card. If you leave, you take your data.' },
    'midcta.label': { fr: 'Le tracking qui t\'empêche de cramer le suivant.', en: 'The tracking that stops you blowing the next one.' },
    'midcta.cta':   { fr: 'Commencer gratuitement — sans CB →', en: 'Start for free — no card →' },
    'pricing.badge':    { fr: '✦ Recommandé', en: '✦ Recommended' },
    'pricing.reassure': { fr: 'Essai 14 j · sans CB · annulation en 1 clic', en: '14-day trial · no card · cancel anytime' },
    'pricing.monthly': { fr: 'Mensuel', en: 'Monthly' },
    'pricing.yearly':  { fr: 'Annuel <span class="save">−2 mois</span>', en: 'Yearly <span class="save">−2 months</span>' },
    'pricing.forever': { fr: '/ pour toujours', en: '/ forever' },
    'pricing.month':   { fr: '/ mois', en: '/ mo' },
    'pricing.year':    { fr: '/ an', en: '/ yr' },
    'pricing.discount':{ fr: 'LANCEMENT −40% · CODE ZELD40 · essai 14 jours', en: 'LAUNCH −40% · CODE ZELD40 · 14-day trial' },
    'pricing.curnote': { fr: 'Affichage indicatif · facturé en euros', en: 'Indicative display · billed in euros' },
    'pricing.trader.desc':  { fr: 'Commence gratuitement. Upgrade quand tu es prêt.', en: 'Start free. Upgrade when ready.' },
    'pricing.trader.f1':    { fr: '1 compte (prop / crypto / perso)', en: '1 account (prop / crypto / personal)' },
    'pricing.trader.f2':    { fr: '2 analyses IA / semaine', en: '2 AI analyses / week' },
    'pricing.trader.f3':    { fr: 'Journal · dashboard · analytics · calc EOD', en: 'Journal · dashboard · analytics · EOD calc' },
    'pricing.trader.f4':    { fr: 'Export RGPD JSON', en: 'GDPR JSON export' },
    'pricing.trader.lock1': { fr: 'Multi-comptes groupés', en: 'Grouped multi-accounts' },
    'pricing.trader.lock2': { fr: 'Archive PDF par trade', en: 'PDF archive per trade' },
    'pricing.trader.cta':   { fr: 'Commencer — c\'est gratuit →', en: 'Start — it\'s free →' },
    'pricing.funded.desc': { fr: 'Drawdown EOD au tick près · 10 comptes multi-groupes · archive PDF par trade.', en: 'Tick-accurate EOD drawdown · 10 multi-group accounts · PDF archive per trade.' },
    'pricing.funded.f1': { fr: '10 comptes · multi-groupes', en: '10 accounts · multi-group' },
    'pricing.funded.f2': { fr: '7 analyses IA / semaine', en: '7 AI analyses / week' },
    'pricing.funded.f3': { fr: 'Drawdown EOD précis', en: 'Precise EOD drawdown' },
    'pricing.funded.f4': { fr: 'Archive PDF par trade', en: 'PDF archive per trade' },
    'pricing.funded.f5': { fr: 'Support prioritaire', en: 'Priority support' },
    'pricing.funded.cta':{ fr: 'Essai 14 jours →', en: '14-day trial →' },
    'pricing.elite.desc': { fr: 'Tu gères 10+ comptes ou tu coaches des traders. Aucune limite.', en: 'Managing 10+ accounts or coaching traders. Zero limits.' },
    'pricing.elite.f1': { fr: 'Comptes & groupes illimités', en: 'Unlimited accounts & groups' },
    'pricing.elite.f2': { fr: 'Analyses IA illimitées · Claude Sonnet', en: 'Unlimited AI analyses · Claude Sonnet' },
    'pricing.elite.f3': { fr: 'Vote décisif sur la roadmap', en: 'Decisive vote on the roadmap' },
    'pricing.elite.f4': { fr: 'Accès bêta aux nouvelles features', en: 'Beta access to new features' },
    'pricing.elite.f5': { fr: 'Support prioritaire 24h', en: 'Priority 24h support' },
    'pricing.elite.cta':{ fr: 'Tout débloquer — 14 j offerts →', en: 'Unlock everything — 14-day trial →' },

    // Discord
    'discord.title': { fr: 'Le Discord. Là où ça parle vraiment trading.', en: 'The Discord. Where trading is actually discussed.' },
    'discord.sub':   { fr: 'Channels par prop firm, partage de setups, revue de trades, entraide crypto et fonds propres. Pas d\'abonnement requis pour rejoindre.', en: 'Channels per prop firm, setup sharing, trade reviews, crypto and personal-funds help. No subscription required to join.' },
    'discord.cta':   { fr: 'Rejoindre le Discord', en: 'Join the Discord' },

    // Contact
    'contact.title':      { fr: 'Une question ?', en: 'A question?' },
    'contact.sub':        { fr: 'Écris directement. Anonyme, sans email requis — une vraie personne répond.', en: 'Write directly. Anonymous, no email required — a real person answers.' },
    'contact.name':       { fr: 'Pseudo', en: 'Name' },
    'contact.name.ph':    { fr: 'Ton pseudo', en: 'Your name' },
    'contact.message':    { fr: 'Message', en: 'Message' },
    'contact.message.ph': { fr: "Une question, une suggestion, une demande d'accès…", en: 'A question, a suggestion, an access request…' },
    'contact.send':       { fr: 'Envoyer →', en: 'Send →' },
    'contact.success':    { fr: '✓ Message envoyé. Réponse rapide, promis.', en: '✓ Message sent. Quick reply, promise.' },

    // Footer + cookie
    'footer.brand':         { fr: 'Journal de trading IA pour prop firm, crypto et fonds propres. Indépendant, hébergé en Europe, RGPD-natif. Made in France.', en: 'AI trading journal for prop firm, crypto and personal funds. Independent, hosted in Europe, GDPR-native. Made in France.' },
    'footer.product':       { fr: 'Produit', en: 'Product' },
    'footer.community':     { fr: 'Communauté', en: 'Community' },
    'footer.contact':       { fr: 'Contact', en: 'Contact' },
    'footer.legal':         { fr: 'Légal', en: 'Legal' },
    'footer.legalmentions': { fr: 'Mentions légales', en: 'Legal notice' },
    'footer.privacy':       { fr: 'Confidentialité', en: 'Privacy' },
    'footer.cgu':           { fr: 'CGU', en: 'Terms' },
    'footer.copy':          { fr: '© 2026 ZELDTRADE · INDÉPENDANT · HÉBERGÉ EN EUROPE', en: '© 2026 ZELDTRADE · INDEPENDENT · HOSTED IN EUROPE' },
    'cookie.text':          { fr: 'Cookies essentiels (session, sécurité). Avec ton accord, on ajoute un cookie de mesure publicitaire (Meta) pour améliorer nos pubs. Tu peux refuser.', en: 'Essential cookies (session, security). With your consent, we add an advertising measurement cookie (Meta) to improve our ads. You can decline.' },
    'cookie.accept':        { fr: 'Accepter', en: 'Accept' },
    'cookie.refuse':        { fr: 'Refuser', en: 'Decline' },
    'cookie.ok':            { fr: "J'ai compris", en: 'Got it' },
  };

  // ── Méta traduisibles (<title>, description) ────────────────────────────────
  const META = {
    fr: {
      title: 'ZeldTrade · Journal de trading prop firm, crypto et fonds propres',
      description: 'Journal de trading français pour tous tes comptes : prop firm (Apex, FTMO, Topstep, Lucid, Funding Pips), crypto (Binance, Coinbase) et fonds propres. IA Vision pour analyser tes charts TradingView, multi-comptes, RGPD natif. Made in France',
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
      if (t && t[lang] != null) {
        el.innerHTML = t[lang];
        // v1.0.4 : force le restart des animations CSS sur les .word-reveal > span après
        // remplacement du innerHTML (le browser peut ne pas re-déclencher l'animation sans reflow).
        if (el.querySelector('.word-reveal')) {
          el.querySelectorAll('.word-reveal > span').forEach(function(s) {
            s.style.animation = 'none';
            void s.offsetHeight; // force reflow
            s.style.animation = '';
          });
        }
      }
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

    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    // F-05 — propage la langue choisie vers l'app (/app, /app?signup=1) via ?lang=
    document.querySelectorAll('a[href^="/app"]').forEach(function (a) {
      try {
        const u = new URL(a.getAttribute('href'), location.origin);
        u.searchParams.set('lang', lang);
        a.setAttribute('href', u.pathname + u.search);
      } catch (e) {}
    });

    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('zt:langchange', { detail: { lang: lang } })); } catch (e) {}
  }

  function switchWithLoader(next) {
    if (next !== 'fr' && next !== 'en') return; // v1.0.4 : guard contre data-lang absent/null
    const ov = document.getElementById('langLoader');
    if (!ov) { applyLang(next); return; }
    ov.style.display = 'flex';
    requestAnimationFrame(function () { ov.style.opacity = '1'; });
    setTimeout(function () { applyLang(next); }, 90);
    setTimeout(function () { ov.style.opacity = '0'; setTimeout(function () { ov.style.display = 'none'; }, 360); }, 780);
  }

  function init() {
    applyLang(getInitialLang());
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        const l = b.getAttribute('data-lang');
        if (l && document.documentElement.lang !== l) switchWithLoader(l); // v1.0.4 : guard l null (theme-toggle a aussi class lang-btn)
        // F-09 — referme le menu mobile après le choix de langue
        const links = document.getElementById('navLinks');
        const toggle = document.getElementById('navToggle');
        if (links) links.classList.remove('open');
        if (toggle) { toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
