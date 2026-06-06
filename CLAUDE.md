# CLAUDE.md — ZeldTrade · Contexte complet pour Claude Code

> Lis ce fichier en entier au début de chaque session avant toute modification.
> Mis à jour : 2026-06-06 (v1.0.4 staging)

---

## 1. Projet

**ZeldTrade** — Journal de trading SaaS français pour traders en prop firm (Apex, FTMO, Topstep, Lucid, Funding Pips, Tradeify).  
L'utilisateur journalise ses trades, l'IA lit ses screenshots TradingView (entry/SL/TP), suit le trailing drawdown au tick près, analyse les performances (équité, win rate, R:R, P&L, psychologie).

- **Prod** : https://zeldtrade.com  
- **Staging** : https://zeldtrade-staging.web.app  
- **Admin** : zeldtradepro@gmail.com (unique, hardcodé dans les rules)  
- **Compte démo staging** : demo@gmail.com / Test1234 (tier VIP/beta, 5 comptes, 65 trades)  
- **Statut** : V1.0.0 lancée le 01/06/2026, Stripe LIVE opérationnel depuis le 30/05  
- **Business** : micro-entrepreneur BNC (24,6% cotisations)  
- **Meta Ads** : 1ère campagne live le 04/06 (30€/5j, France + prop firm)

---

## 2. Stack technique

| Couche | Tech |
|---|---|
| Front | Vanilla JS (IIFE modules), aucun framework |
| SDK Firebase | Compat SDK (globals `_fbAuth`, `_fbDb`, `_fbFunctions`, `_fbStorage`, `firebase`) |
| Hébergement | Firebase Hosting (primaire) + GitHub Pages backup (`zeldaron.github.io`) |
| Backend | Cloud Functions Gen2, **europe-west1**, Node 20 → migrer v22 avant 2026-10-30 |
| Base de données | Firestore (natif) |
| Storage | Firebase Storage (screenshots trades) |
| Auth | Firebase Auth (email/password) |
| IA | Groq Vision (tous tiers) + Claude Sonnet fallback auto (Pro) |
| Paiement | Stripe LIVE (depuis 30/05) |
| Email | Brevo SMTP — noreply@zeldtrade.com + news@zeldtrade.com (DKIM/SPF/DMARC) |
| Anti-bot | Cloudflare Turnstile + hCaptcha |
| Graphiques | Chart.js 4.4.1 (dashboard) |
| Gestion projet | Trello (board par jour Lun→Dim) + docs/TODO.md |

---

## 3. Structure du repo

```
JTRADE/
├── src/                        ← Front déployé (Firebase Hosting public dir)
│   ├── pages/
│   │   ├── index.html          ← Landing (CSS inline ~3700 l., bilingue FR/EN)
│   │   ├── app.html            ← App principale (~1200 l., ~23 scripts/CSS ?v=)
│   │   ├── admin.html          ← Interface admin
│   │   └── cgu/legal/privacy/payment/updates.html
│   ├── js/
│   │   ├── firebase.js         ← Init + globals Firebase
│   │   ├── store.js            ← État central (trades, accounts, plan, tier, settings)
│   │   ├── auth.js             ← Login/register/logout/consent RGPD
│   │   ├── modal.js            ← Wizard ajout trade (3 étapes)
│   │   ├── ui.js               ← Rendu trades/KPIs, UI.escHtml (XSS), toasts
│   │   ├── calc.js             ← Calculs trading (P&L, R:R, drawdown, sizing)
│   │   ├── app.js              ← Routing pages, renderEcon (TradingView + news)
│   │   ├── app-bootstrap.js    ← Gates 1er login, checkout Stripe
│   │   ├── i18n.js             ← Traductions FR/EN (~1400+ clés)
│   │   ├── icons.js            ← Icons.svg(name, size) — 25 icônes
│   │   ├── analytics.js        ← Tracking événements
│   │   ├── theme.js            ← Toggle dark/light
│   │   ├── admin.js            ← Interface admin (zt_notrack localStorage)
│   │   ├── admin-fb.js         ← Firebase admin SDK client
│   │   └── pages/
│   │       ├── dashboard.js    ← 15 graphiques Chart.js, analytics avancées
│   │       ├── settings.js     ← Réglages (comptes, journal perso, groupes)
│   │       ├── analytics.js    ← Page analytics détaillée
│   │       ├── calendar.js     ← Calendrier des trades
│   │       ├── goals.js        ← Objectifs
│   │       ├── micro.js        ← Calculateur micro-BNC
│   │       ├── outils.js       ← Outils trading (sizing, drawdown)
│   │       ├── offers.js       ← Page offres / upgrade
│   │       ├── export-pdf.js   ← Export PDF
│   │       └── changelog.js    ← What's new (ENTRIES en tête = plus récent)
│   └── css/
│       └── style.css           ← ~5500 lignes, dark/light vars
├── functions/
│   ├── index.js                ← Toutes les Cloud Functions (~2700 l.)
│   └── emails.js               ← Templates HTML Brevo + envoi SMTP
├── scripts/
│   ├── release.sh              ← Deploy prod (tag git + hosting)
│   ├── staging.sh              ← Deploy staging (zeldtrade-staging)
│   ├── preview.sh              ← Deploy preview channel Firebase
│   ├── dev.sh                  ← Lance émulateurs Firebase locaux (:5050)
│   ├── todo-to-trello.js       ← Sync TODO.md → Trello
│   ├── sprint-to-trello.js     ← Sprint hebdo → Trello
│   └── send-newsletter.js      ← Envoi newsletter Brevo
├── docs/                       ← Ne jamais commiter les .md sauf README !
│   ├── ARCHITECTURE.md         ← Ce fichier (plus détaillé, lire aussi)
│   ├── CHANGELOG-DEV.md        ← Historique dev (ajouter en tête à chaque modif)
│   ├── TODO.md                 ← Backlog (150+ items, section 🎯 Demandes user)
│   ├── SECURITY.md             ← Audit sécurité 2026-05-22 (0 faille critique)
│   └── BUSINESS-PLAN.md
├── firestore.rules
├── storage.rules
├── firebase.json               ← CSP HTTP header (le VRAI CSP, pas le meta tag)
└── test/
    └── calc.test.js            ← Tests unitaires calc.js (relancer si calc.js modifié)
```

---

## 4. Workflow de développement

### Règle absolue
**Coder sur branche `test` → tester en staging → proposer le push prod → l'user valide avant deploy live.**  
Ne jamais auto-déployer en prod sans accord explicite de l'user.

### Commandes
```bash
bash scripts/staging.sh          # Deploy staging (zeldtrade-staging.web.app)
bash scripts/release.sh vX.Y.Z   # Deploy PROD + tag git (APRÈS accord user)
bash scripts/dev.sh               # Émulateurs locaux (app :5050, UI :4000)

firebase deploy --only functions:NOM --project zeldtrade         # CF prod
firebase deploy --only functions:NOM --project zeldtrade-staging # CF staging
firebase deploy --only firestore:rules --project zeldtrade        # Rules prod
```

### Versioning — procédure avant release.sh
1. Ajouter une entrée en tête de `ENTRIES` dans `src/js/pages/changelog.js`
2. Bumper TOUS les `?v=X.Y.Z` dans `src/pages/app.html` (~23 scripts+CSS)
3. Bumper le tag version dans `src/pages/admin.html`
4. Bumper le footer `vX.Y.Z` dans `src/pages/index.html`
5. Ajouter une entrée datée dans `docs/CHANGELOG-DEV.md`
6. `bash scripts/release.sh vX.Y.Z`

> ⚠️ `release.sh` ne bump PAS les `?v=` automatiquement — à faire à la main.

---

## 5. Tiers & gating

### 4 tiers
| Tier | Prix | Label affiché | Limites |
|---|---|---|---|
| `trader` | Gratuit | Trader | 1 compte, 1 IA/j, 0 screenshot |
| `funded` | 14,99€/mois | Funded | 10 comptes, 20 IA/j, 3 screenshots |
| `elite` | 29,99€/mois | Elite | 100 comptes, 100 IA/j, 3 screenshots |
| `beta` | Admin/fondateur | **VIP** | Illimité, toutes features |

### Features gating (TIER_FEATURES dans store.js)
- `groups`, `exportPdf`, `exportCsv`, `partials`, `prioritySupport`, `fjNews` → funded+
- `betaFeatures`, `decisiveVote` → elite+

### Règle critique
- **Client = cosmétique** (canUseFeature = UX uniquement)
- **Serveur = autoritaire** (Firestore rules + CF enforced)
- Escalade tier côté client = impossible (anti-fraude via proCodeHashes)

### Activer VIP sur un compte (staging ou prod)
```javascript
// Via Admin SDK
admin.auth().setCustomUserClaims(uid, { tier: 'beta', pro: true });
db.collection('users').doc(uid).collection('data').doc('plan').set({
  plan: 'pro', tier: 'beta', activatedAt: Date.now()
});
```

---

## 6. Modèle de données Firestore

### Chemin principal
```
users/{uid}/data/{doc}
  trades         → { items: Trade[] }
  settings       → { capital, contracts, instrument, tradingTypes, journalFields }
  myAccounts     → { items: Account[] }
  groups         → { items: Group[] }  (Pro only)
  plan           → { plan:'basic'|'pro', tier:'trader'|'funded'|'elite'|'beta', activatedAt }
  stripe         → { customerId, subscriptionId, tier, currentPeriodEnd }
  aiUsage        → { date, count }
  spreadsByFirm  → { apex, topstep, ftmo, lucid, fpips }
```

### Collections racines (write-deny client, CF Admin SDK only)
`userEmails/{uid}`, `proCodeHashes/{hash}`, `auditLogs`, `publicStats`,
`analyticsEvents`, `emailEvents`, `stripeWebhookEvents`, `deletedUsers`,
`adminRateLimit`, `ipRateLimit`, `emailSendLimits`

### Schéma Trade
```javascript
{
  id, instrument, direction:'long'|'short',
  outcome:'open'|'win'|'loss'|'be',  // 'breakeven' aussi accepté (alias 'be')
  contracts, setup, notes,            // setup/notes échappés HTML (UI.escHtml)
  apex,                               // nom du compte OU 'grp:id'
  date,                               // ISO string
  entry, sl, tp1, tp2, tp3, exitPrice,
  manualPnl, rMultiple,
  pnl, rr, capital, feePerSide, spreadCost,
  groupId?,
  screenshotPath?, screenshotPaths?,  // Storage paths
  partials?: [{price, lots}],         // sorties partielles
  custom?: {                          // champs journal perso
    emotion, planFollowed, confidence, prepQuality, tradeGrade,
    sentiment, marketStructure, macroContext, volatility, session
  }
}
```

### Schéma Account
```javascript
{
  id, name, accountType:'prop'|'personal'|'crypto',
  firmKey,  // 'apex'|'lucid'|'ftmo'|'topstep'|'fpips'|'tradeify'|...
  status:'evaluation'|'funded',
  capital, profitTarget, maxDrawdown, dailyLossLimit,
  maxContracts, feePerSide, pnlOffset,
  archived?, archivedAt?, passed?, fundedFrom?
}
```

### Règles Firestore — points critiques
- Fail-closed par défaut
- `isVerified(uid)` requis sur tous les writes data
- `isAdmin()` = email hardcodé + email_verified
- Whitelist stricte des clés + types + bornes sur chaque collection
- `userEmails` whitelist : `['uid','email','username','lastSeen','termsAccepted','newsletterOptIn','isTestAccount']`

---

## 7. Cloud Functions — Inventaire

Toutes en `europe-west1`, wrappées `_wrapCF` (alert Discord #dev-logs).

| Fonction | Rôle |
|---|---|
| `analyzeChart` | IA (Groq Vision + fallback Claude Sonnet), quota/uid atomique |
| `sendContactMessage` | Formulaire contact (auth ou anon, throttle 60s/IP) |
| `notifyNewSignup` | Discord #new-users au signup |
| `getPublicStats` | Stats publiques landing |
| `recordVisit` | Compteur visites (throttle 20/IP/h, `zt_notrack` skip admin) |
| `sendVerificationEmail` | Email vérif custom Brevo |
| `sendPasswordResetEmail` | Reset password custom Brevo |
| `deleteUserAccount` | Suppression complète (admin, soft-delete 30j) |
| `cleanupOrphanUserEmails` | Maintenance |
| `adminMarkEmailVerified` | Vérifier email manuellement (admin) |
| `adminCreateTestAccount` | Créer compte test (pseudo "test*" only) |
| `adminGrantElite` | Forcer tier Elite (admin) |
| `generateProCode` | Générer code Pro à vie (admin) |
| `revokeProCode` | Révoquer code Pro (admin) |
| `createCheckoutSession` | Checkout Stripe self-service |
| `createBillingPortalSession` | Portail Stripe (changement plan, annulation) |
| `stripeWebhook` | Webhook Stripe (signature + idempotence) |
| `syncProClaim` | Trigger Firestore → sync custom claim `pro` |
| `unsubscribeNewsletter` | Désabonnement HMAC |
| `brevoWebhook` | Bounces/spam → désinscription |
| `getMarketNews` | Proxy RSS → JSON (BBC/CNBC, cache 5min, Funded+) |

### Secrets (Secret Manager)
`GROQ_API_KEY`, `CLAUDE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_FUNDED_MONTHLY`, `STRIPE_PRICE_FUNDED_YEARLY`,
`STRIPE_PRICE_ELITE_MONTHLY`, `STRIPE_PRICE_ELITE_YEARLY`,
`BREVO_SMTP_PASS`, `BREVO_WEBHOOK_TOKEN`, `HCAPTCHA_SECRET`,
`TURNSTILE_SECRET`, `UNSUBSCRIBE_HMAC_KEY`,
`DISCORD_SUPPORT_WEBHOOK`, `DISCORD_SIGNUP_WEBHOOK`, `DISCORD_ERRORS_WEBHOOK`

---

## 8. Pipeline auth & emails

1. Signup → `createUser` → `updateProfile(displayName)` → doc `userEmails` → CF `sendVerificationEmail` → `notifyNewSignup` (Discord)
2. Gate vérif email bloque l'app tant que `emailVerified = false`
3. Gates 1er login (app-bootstrap.js) : vérif email → consent CGU → modale profil trading
4. **NE PAS toucher aux templates Firebase Auth** (verrouillé par Firebase) → tout passe par Brevo
5. Token `email_verified` périmé : `getIdToken(true)` forcé avant upload Storage

---

## 9. Dashboard — Graphiques (15 au total)

### Section Performance
Donut Win/Loss/BE · P&L moyen par jour · Distribution R:R · Performance par heure · Long vs Short · P&L par setup · P&L par instrument

### Section Analyse temporelle
Calendrier heatmap 90j (HTML/CSS) · P&L mensuel 12 mois · P&L hebdo 16 semaines

### Section Analyse avancée
Win rate glissant 15T · Profit factor glissant 15T · Drawdown cumulé % · Scatter R:R prévu vs réalisé · Courbes équité multi-comptes overlay

### Section Psychologie & Contexte
Win rate/PnL par : plan suivi · état émotionnel · confiance 1-5 · préparation · grade A-D · structure marché · session · contexte macro · volatilité

> Graphiques Psychologie affichés uniquement si ≥3 trades ont le champ renseigné.

---

## 10. Journal personnalisable (champs custom)

Configurés dans Réglages → "Personnaliser mon journal" (mode : Masqué / Optionnel / Obligatoire).

### Psychologie
- `emotion` : calm · confident · anxious · fomo · tired · revenge
- `planFollowed` : yes · partial · no
- `confidence` : 1–5 (rating)
- `prepQuality` : done · partial · none
- `tradeGrade` : A · B · C · D

### Contexte marché
- `sentiment` : bullish · bearish · neutral · range
- `marketStructure` : trend · range · chop
- `macroContext` : calm · news · fomc · nfp
- `volatility` : low · normal · high
- `session` : asia · london · overlap · ny · ny-close

---

## 11. CSP — Règle critique

**La vraie CSP est dans `firebase.json` (HTTP header), PAS dans le `<meta>` de app.html.**  
Le meta tag est synchronisé pour info mais n'est pas enforced. Toujours éditer `firebase.json`.

Domaines autorisés notables : `s3.tradingview.com`, `feed.financialjuice.com`,
`platform.twitter.com`, `syndication.twitter.com`, `api.rss2json.com`,
`connect.facebook.net`, `hcaptcha.com`, `challenges.cloudflare.com`

---

## 12. Stripe

- **Mode LIVE** opérationnel depuis 30/05/2026
- Prix (`price_*`) dans Secret Manager, **jamais en dur dans le code**
- `createCheckoutSession` : prix déduits du tier côté serveur (`PLAN_TO_PRICE`), jamais de l'input client
- `createBillingPortalSession` : customerId lu du doc Firestore (pas d'input → pas d'IDOR)
- Changement de plan Funded↔Elite : `flow_data` dans le portail → **doit être configuré dans le Dashboard Stripe**
- Webhook déduit le tier du prix (`price_id` → tier)
- Donnée test résiduelle en prod : purger si nécessaire (`customers.test_*`)

---

## 13. Conventions de code

### JavaScript
- Modules IIFE : `const MonModule = (() => { ... return { ... }; })();`
- Pas de `onclick` inline → `addEventListener` ou `data-cta` (CSP)
- `UI.escHtml()` sur tout input utilisateur affiché dans le DOM
- `i18n.t('clé')` retourne la clé si absente → toujours définir FR + EN
- Globals Firebase : `_fbAuth`, `_fbDb`, `_fbFunctions`, `_fbStorage`
- CF appelées avec `_fbFunctions.httpsCallable('nom')` (région europe-west1 déjà initialisée)

### Nommage IA
- **Client** : toujours « IA » (générique)
- **Serveur (functions/)** : Groq / Claude (providers réels — ne pas génériciser)

### Git
- Branche de travail : `test`
- Branche prod : `main`
- Jamais commiter les `.md` (sauf `README.md` et `CLAUDE.md`)
- Commit message : `type(scope): description` + Co-Authored-By en bas

### Fichiers .md
- `docs/CHANGELOG-DEV.md` : ajouter une entrée datée à chaque modif (jamais écraser)
- `docs/TODO.md` : section `🎯 Demandes user` synchronisée avec Trello via `node scripts/todo-to-trello.js`

---

## 14. Landmines (pièges connus)

| Piège | Détail |
|---|---|
| CSP | Éditer `firebase.json`, pas le meta tag |
| Email Firebase | Verrouillé par Firebase → pipeline Brevo custom uniquement |
| Token email_verified | Périmé → `getIdToken(true)` avant Storage |
| Storage rules | Jamais de lecture cross-service (a cassé tous les uploads en v0.9.321) |
| IP rate-limit | **Avant-dernière** IP du XFF (parts[0] spoofable) |
| JS inline | Interdit (CSP) → event delegation / `data-cta` |
| release.sh | Ne bump PAS les `?v=` automatiquement |
| IA client/serveur | Frontière voulue — ne pas mélanger les nommages |
| Stripe prix | `prod_*` vs `price_*` différents — toujours utiliser les `price_*` |
| Safari ITP | Bloque widgets tiers → utiliser Cloud Functions comme proxy |
| outcome trade | `'be'` ET `'breakeven'` coexistent (alias dans OB_CLASS/OB_LABEL) |
| plan doc | `{ plan:'pro', tier:'beta' }` — `plan:'beta'` est invalide |
| calc.test.js | Relancer avant release si `calc.js` modifié |
| Nouvelle page src/ | Toujours ajouter un rewrite dans `firebase.json` (sinon 404) |
| Zoom Safari | Vérifier Cmd+0 AVANT de toucher au CSS si "tout est trop gros" |

---

## 15. Trello & backlog

- Board organisé par jour (Lun→Dim + Terminée)
- `node scripts/todo-to-trello.js` → sync section `🎯 Demandes user` de TODO.md
- `node scripts/sprint-to-trello.js` → sprint hebdo
- Chaque dimanche soir : basculer les ✅ Fait → Terminée + planifier la semaine

---

## 16. Annonces & publication

Commande `/publie` = diffuser sur 3 canaux simultanément :
1. What's New in-app (`src/js/pages/changelog.js`)
2. Discord #annonces (webhook)
3. Newsletter Brevo (`node scripts/send-newsletter.js`)

---

## 17. Comptes de test utiles

| Env | Email | Password | Tier | Notes |
|---|---|---|---|---|
| Staging | demo@gmail.com | Test1234 | VIP (beta) | 3 Apex + 2 Lucid, 65 trades |
| Prod | — | — | — | Ne pas créer de données test en prod |

Admin : vérifier l'email d'un compte via `adminMarkEmailVerified` (CF) ou la page admin.

---

## 18. Environnements Firebase

| Env | Projet Firebase | Hosting |
|---|---|---|
| Prod | `zeldtrade` | zeldtrade.com |
| Staging | `zeldtrade-staging` | zeldtrade-staging.web.app |
| Local | émulateurs (dev.sh) | localhost:5050 |
