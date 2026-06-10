# TODO ZeldTrade — Backlog priorisé (audit 2026-05-12)

> Audit complet 4 axes (sécurité, qualité code, UX, infra) — 150+ findings consolidés.
> **Stratégie budget** : tout à 0€ jusqu'à la 1ère vente. Domaine custom (10€/an) seulement après.
> Source : `docs/CHANGELOG-DEV.md` 2026-05-12 entry.

---

## 💰 Stratégie budget zéro

### Tout est faisable à 0€

Le seul "coût" théorique : PITR Firestore (~0.04€/GB-mois) + backup GCS (~0.01€/GB-mois Nearline) = **~0.10€/mois** vu la volumétrie actuelle (<100 MB). Donc en pratique : **0€ jusqu'à 1000+ users payants**.

### Limitation 0€ sans domaine
Sans domaine `zeldtrade.com` :
- **Solution gratuite optimale** : migrer GitHub Pages → **Firebase Hosting** (free tier 10 GB/mois)
  - URL devient `zeldtrade.web.app` — déjà plus pro que `zeldaron.github.io/zeldtrade`
  - **Vrais headers HTTP** possibles via `firebase.json` (HSTS, CSP réelle, X-Frame-Options)
  - Plus tard : brancher le domaine custom (10€/an) en 5 minutes
- **Alternative** : rester sur GitHub Pages → headers HTTP limités aux `<meta>` (partiellement supportés)

### Quand investir
- **10€/an** dès la 1ère vente : domaine `zeldtrade.com` chez Cloudflare Registrar
- **~30€/mois** post-100 users payants : cyber-assurance Stoik/Hiscox
- **~2-5k€** post-v1.0 stable : pen-test externe avant ouverture grand public

### Score sécurité atteignable à 0€
**~9/10** (vs 7/10 actuellement) — sans dépenser un centime.

---

## ✅ Session 2026-05-16/17 — récap nuit

Session marathon couvrant 7 releases (v0.9.169 → v0.9.175) — état du produit nettement amélioré avant lancement Stripe.

**Sécurité** :
- Audit complet 4 surfaces (rules / CFs / frontend / infra) → score 7.5/10 → **8.5-9/10**
- Anti IP-spoofing renforcé sur `analyzeChart` (parts[length-2] du XFF, v0.9.170)
- Helper `_assertAdmin()` centralisé avec re-auth récente <60min (v0.9.171)
- Rate-limits admin symétriques (delete 5/h, revoke 10/h, markVerified 5/h)
- CORS Storage prod strict (localhost retiré, configs prod/dev séparées)
- `docs/SECURITY.md` refondu intégralement
- Supply chain : nodemailer HIGH éliminée (v8.0.7), 8 LOW transitives documentées

**Features user-facing** :
- Export PDF refondu : 1 page/trade chronologique + screenshots embarqués (v0.9.169)
- Contact form refonte : pseudo + message → Discord, plus d'email/captcha (v0.9.172, B5+B6 fixés)
- Désinscription newsletter 1-clic RGPD-compliant (v0.9.173) : CF `unsubscribeNewsletter` + HMAC SHA-256 + headers RFC 8058 + page de confirmation
- Anonymat dans le contenu public : "Aaron" → "l'équipe ZeldTrade" partout (sauf mentions légales)

**Admin & opérations** :
- Page admin redesignée : stats overview + recherche live + actions icônes compactes (v0.9.174)
- Système d'annonces opérationnel : Discord `#annonces` + newsletter Brevo `news@zeldtrade.com` (DKIM/SPF/DMARC ✅)
- Première annonce envoyée le 2026-05-16 (PDF + Contact + Sécurité) à 2 destinataires opt-in + post Discord
- Fix CORS Firebase Storage (gsutil) pour embedding screenshots dans PDF
- Fix bugs CSS toggle Réglages (spécificité `:not(.switch)`, v0.9.175)
- TODO.md cleanup (B5, B6, F3, I1, I2, I6/S1, S1, I10, I10 alt, I15 statut)

**Restant pour go-live début de semaine** :
- 🟡 Stripe : KYC en cours (24-48h Stripe validation), code prêt, créer Products + Prices + coupon `LAUNCH40` + brancher checkout public
- ~~MFA Firebase Auth admin (I14)~~ ❌ Abandonné 2026-05-17 — non implémenté (TOTP nécessite curl REST API + ~2h code enrollment/challenge). Protections alternatives suffisantes : MFA Gmail + _assertAdmin re-auth 60min + rate-limits + password fort + email_verified.
- 🟡 Smoke test tunnel complet (signup → trade → export)
- 🟢 Service account dédié CFs (I4/S3, post-MVP)
- 🟢 Migration firebase-functions v4→v7 (post-MVP, débloque firebase-admin@13)

---

## 🔴 CRITIQUE — Priorité absolue (15 findings)

### 🛠️ MANUEL — À toi (8 actions, ~3-4h total, 0€)

| # | Action | Console | Effort | Coût |
|---|---|---|---|---|
| **I5a** | Imprimer les 10 backup codes Gmail | https://myaccount.google.com/security | 5 min | 0€ |
| **I5b** | Ajouter 2e Owner GCP (failover si compte admin perdu) | https://console.firebase.google.com/project/zeldtrade/settings/iam | 5 min | 0€ |
| **I5c** | Configurer Inactive Account Manager Google | https://myaccount.google.com/inactive | 5 min | 0€ |
| **I3** | Budget alert GCP 20€/mois (anti-DoS financier) | https://console.cloud.google.com/billing/budgets | 5 min | 0€ |
| ~~**I1**~~ | ~~Activer PITR Firestore (récup data 7j)~~ ✅ 2026-05-16 (activé via Firebase Console) | 2 min | <0.10€/mois |
| ~~**I2**~~ | ~~Scheduled backup GCS hebdo~~ ✅ 2026-05-16 (hebdo + mensuel actifs) | 30 min | <0.10€/mois |
| ~~**I6/S1**~~ | ~~Réparer App Check reCAPTCHA Enterprise~~ ❌ Abandonné v0.9.158 — bug Safari ITP non-fixable. Remplacé par **Cloudflare Turnstile** (anti-bot primaire) + **IP rate-limit fallback** (durci v0.9.170, parts[length-2] du XFF anti-spoofing). Posture sécurité équivalente ou meilleure. | n/a | 0€ |
| **I4/S3** | Créer SA dédié pour Cloud Functions (least privilege) | https://console.cloud.google.com/iam-admin/serviceaccounts | 1-2h | 0€ |

### 🔧 CODE — À moi (7 fixes)

| # | Titre | Effort |
|---|---|---|
| ~~**S1**~~ | ~~Réactiver `enforceAppCheck`~~ ❌ Abandonné v0.9.158 — App Check Firebase abandonné, remplacé par Cloudflare Turnstile + IP rate-limit durci (v0.9.170). 6 CFs admin protégées via `_assertAdmin()` (re-auth < 60min) + rate-limits symétriques (v0.9.171). | n/a |
| ~~**S2**~~ | ~~Remettre check `email_verified` (rules + 4 CFs admin)~~ ✅ 2026-05-12 | 5 min |
| ~~**Q1**~~ | ~~Race condition save trade en mode groupe → batch en 1 seul write Firestore~~ ✅ 2026-05-12 (v0.9.106) | 1h |
| ~~**Q3**~~ | ~~Winrate : compter `c.netPnl > 0` au lieu de `outcome === 'win'`~~ ✅ 2026-05-12 (v0.9.106) | 30 min |
| ~~**Q4-Q5**~~ | ~~Calc.trade : early-return si entry/sl null ou tp1=0~~ ✅ 2026-05-12 (v0.9.106) | 30 min |
| ~~**U1**~~ | ~~Remplacer `confirm()` natif par modale custom~~ ✅ 2026-05-13 (v0.9.107) | 1-2h |
| ~~**U3**~~ | ~~Onboarding nouveau user : empty state "premier lancement" guidé~~ ✅ 2026-05-14 (v0.9.111) — Dashboard empty state avec 3 étapes (U21) + i18n complet (dash.empty.*) v0.9.120 | ✅ Fait |

---

## 🟠 HAUT — Gros impact (25 findings)

### 🛠️ MANUEL (8 actions, ~12-15h total, 0€ sauf domaine optionnel)

| # | Action | Effort | Coût |
|---|---|---|---|
| ~~**I8**~~ | ~~Dependabot config~~ ✅ 2026-05-13 (`.github/dependabot.yml` créé) — il reste juste à cocher "Enable Dependabot alerts" dans GitHub Settings → Code security | 15 min | 0€ |
| ~~**I9**~~ | ~~Migrer Web3Forms → Discord webhooks~~ ✅ 2026-05-14 (v0.9.123) — 2 webhooks setup (#support-tickets + #new-users), helper `_postDiscordWebhook()` avec regex validation, secrets `DISCORD_SUPPORT_WEBHOOK` + `DISCORD_SIGNUP_WEBHOOK` stockés et CFs redéployées | ✅ Fait |
| ~~**I11**~~ | ~~Compléter `privacy.html` : Groq, GitHub Pages, Stripe, Discord avec base légale RGPD~~ ✅ 2026-05-14 (v0.9.128) — 10 trous fixés (Discord, Stripe, Cloud Storage, AuditLogs, Mineurs, etc.) | ✅ Fait |
| ~~**I13**~~ | ~~Sentry / GCP Error Reporting alertes~~ ✅ 2026-05-14 (v0.9.129) — Sentry-lite gratuit via Discord webhook `#dev-logs`, 9 CFs wrappées via `_wrapCF()` + `_reportError()` | ✅ Fait |
| **I15** | Compte Stripe FR + KYC ✅ KYC soumis 2026-05-16, en attente validation 24-48h. Catégorie "Logiciels en tant que service" + libellé bancaire "ZeldTrade" + libellé abrégé "ZT" + Stripe Tax SKIP (franchise TVA art. 293 B). Reste à : créer Products/Prices + coupon LAUNCH40 + webhook + secrets Firebase. | 2-3h + attente | 0€ (no fee sans vente) |
| ~~**I14**~~ | ~~MFA Firebase Auth admin~~ ❌ Abandonné 2026-05-17 — décision user. Activation TOTP nécessite curl REST API (gcloud identity-platform inexistant) + ~2h code enrollment + flow login challenge. Risques : casser les logins users si mal configuré. Protections alternatives suffisantes (MFA Gmail + _assertAdmin re-auth 60min + rate-limits + password fort 10+ chars + email_verified obligatoire). Identity Platform laissé activé sur le projet (gratuit à notre volume). | n/a | 0€ |
| **I7** | Bump `firebase-functions` v4.6 → v6 (EOL) | 2-4h (moi après que tu donnes go) | 0€ |
| ~~**I10**~~ | ~~Domaine + Firebase Hosting~~ ✅ 2026-05-15 (v0.9.145) — **zeldtrade.com** déployé sur Firebase Hosting + headers HTTP stricts (CSP/HSTS/Permissions-Policy/etc.) configurés dans `firebase.json`. | ✅ Fait |
| ~~**I10 alt**~~ | ~~Firebase Hosting `zeldtrade.web.app`~~ ✅ déprécié — couvert par I10 (domaine custom direct). | ✅ Fait |

### 🔧 CODE — 17 fixes

**Sécurité (3)** : S4 CORS (bloqué par I7), ~~S10 captcha vérif serveur~~ ✅ 2026-05-12 (nécessite HCAPTCHA_SECRET manuel), ~~S11 magic bytes serveur~~ ✅ 2026-05-12
**Qualité (10)** : Q6 const fee, Q7 warn instrument inconnu, Q8 USDJPY pip, Q9 UK100 GBP, ~~Q10 retirer QO1~~ ✅ 2026-05-12, Q12-14 memory leaks, Q15 promise chain await-able
**UX (4)** : U2 message clair quota, ~~U4 loading states~~ ✅ 2026-05-12, U6 settings dense, U8 labels accessibility, U10 i18n complet, U12 focus-visible

---

## 🟡 MOYEN — Qualité (45+ findings)

### 🛠️ MANUEL (5)
- **I12** : Audit logs CFs PII (vérifier que rien d'identifiant en clair, doc dans privacy.html)
- **I17** : TTL `auditLogs` Firestore (1 an, RGPD)
- **I18** : CI GitHub Actions pour tests (lance `node test/calc.test.js` automatiquement)
- **I19** : Alertes Cloud Monitoring (erreur CFs > 5%/5min)
- **I20** : SA dédié GitHub Actions deploy

### 🔧 CODE (40)

**Sécurité (10)** : S12 headers HTTP, ~~S13 TTL auditLogs~~ ✅ 2026-05-14 (v0.9.122), ~~S15 plan schema~~ ✅ déjà OK (rules), S16 audit pre-action, ~~S17 Unicode bidi~~ ✅ 2026-05-12, ~~S18 pagination admin~~ ✅ 2026-05-14 (v0.9.122), S19 throttle persisté serveur, ~~S20 email_verified signup~~ ✅ 2026-05-14 (v0.9.122 — analyzeChart), ~~S21 isAdmin bypass myAccounts~~ ✅ 2026-05-14 (v0.9.122), ~~S36 webhook idempotent~~ ✅ 2026-05-14 (v0.9.122), ~~S37 Stripe webhook validation UID+tier+customer/sub~~ ✅ 2026-05-15 (v0.9.140)

**Hardening notés (audit interne 2026-05-15, non-critiques)** :
- S38 CSP `style-src 'unsafe-inline'` à durcir (nonce/hash sur styles inline) — gros chantier (chaque `style="..."` à migrer en classe CSS). Risque XSS résiduel faible avec `escHtml` + `script-src 'self'`. À planifier post-bêta.
- S39 `_verifyHcaptcha` sans `AbortController` timeout (risque DoS lente) — fix 5 min, peu critique tant que hCaptcha API stable.
- S40 Audit logs `auditLogs` exposent `tier` (monthly/yearly/lifetime) en clair — non-critique car logs admin-read uniquement.

**Code (15)** : ~~Q11 date floor~~ ✅ 2026-05-14, Q16 anti-corruption check, ~~Q17 garde-fou null~~ ✅ 2026-05-14, Q18-20 dedup helpers, Q22-23 dead code, Q24/31 perf Calc.trade, Q25-26 no-op functions, Q27 spreadCost fallback, Q43 timezone, ~~Q44 paste handlers~~ ✅ 2026-05-14, ~~Q49 race compression~~ ✅ 2026-05-14, ~~Q52 double escape JSON~~ ✅ 2026-05-14, Q53-55 désynchros sanitize, Q61-62 N+1 queries, Q69 reset aiUsage downgrade

**UX (15)** : U9 undo, U11 pills découvrables, ~~U13 touch targets mobile~~ ✅ 2026-05-13 (v0.9.109), U14 bulle contact mobile, U15 seuil "Meilleure session", U16-17 partial UI, ~~U20 bouton Aujourd'hui calendrier~~ ✅ 2026-05-14 (v0.9.111), ~~U21 dashboard empty~~ ✅ 2026-05-14 (v0.9.111), U22 couleurs harmonisées, U23 filtres combinables, ~~U24 compteur recherche~~ ✅ 2026-05-14 (v0.9.111), ~~U27 groupe visible~~ ✅ 2026-05-14 (v0.9.111), U28 CSV preview, U30 toast queue, ~~U31 mémo wizard~~ ✅ 2026-05-13 (v0.9.108), U32 confirm réanalyse, ~~U34 scroll-to-top~~ ✅ 2026-05-14 (v0.9.111)

**Mobile / Responsive (signalé user 2026-05-16)** :
- **U-MOB1** Audit responsive complet sur téléphone (iPhone + Android petits écrans 360-414px) : alignement cards/tuiles, padding/margins, lisibilité textes, débordements horizontaux, touch targets <44px restants, modales qui débordent
- **U-MOB2** "Truc carré" visuel à fixer (à préciser au moment du fix — user a vu des éléments mal cadrés/proportionnés sur mobile)
- Sections à inspecter en priorité : dashboard, calendrier, settings, modal trade, login/signup, landing page hero
- Effort estimé : 2-4h selon profondeur du fix (CSS responsive + tests)

**Renommage UI "Groq" → "IA d'analyses" (signalé user 2026-05-16)** :
- **U-IA1** Remplacer toutes les mentions user-facing de "Groq" / "Groq Vision" par "IA d'analyses" (plus générique, moins technique pour les bêta-testeurs)
- Périmètre **user-facing** (à renommer) : ~25 occurrences dans `src/app.html` (Settings → section IA, tuto step 3), `src/index.html` (landing hero/features), `src/js/i18n.js` (clés `set.groq.*`, `tuto.s3.*`), `src/js/pages/changelog.js` (entrées historiques optionnel), labels boutons modal IA dans `src/js/modal.js`
- Périmètre **À NE PAS TOUCHER** :
  - `legal.html` + `privacy.html` : la mention "Groq, Inc." reste **obligatoire légalement** (transparence RGPD sur les sous-traitants exacts)
  - Code interne : `_globalGroqKey`, `getGroqKey()`, `GROQ_API_KEY` secret, `config/groq`, etc. — noms internes techniques, garder
- Choix de wording côté user : **"IA d'analyses"** (suggéré par l'user) — alternatives possibles : "IA Vision", "Analyse IA", "Assistant IA"
- Effort estimé : 30-45 min (renommage cross-files + bump i18n + test visuel + release mineure)

---

## ⚪ BAS — Nice-to-have (65+ findings)

Détails dans le CHANGELOG-DEV audit consolidé. Sélection :
- Magic numbers à mettre en const (`Q70-Q73`)
- Refactor modal.js (1167 lignes) et calc.js (240 lignes)
- Tests supplémentaires (`Q70`)
- Mode dark/light toggle (`U45`)
- Status page publique (`I21`)
- Pen-test externe (`I24`, post-v1.0, 2-5k€)
- Cyber-assurance (`I25`, post-100 users, 30-80€/mois)
- Runbook incident détaillé (`I26`)

---

## 🐛 Bugs en cours d'investigation

| # | Bug | Description | Status |
|---|---|---|---|
| ~~**B3**~~ | ~~Rule `userEmails` blocklist trop stricte bloque la recréation du userEmails admin~~ ✅ Résolu 2026-05-13 | Username "Admin" (ou contenant "admin"/"zeldtrade"/etc.) bloquait la rule `userEmails write` introduite en v0.9.95. Le compte admin lui-même ne pouvait plus créer son record `userEmails` après recréation. **Fix** : bypass de la blocklist si `request.auth.token.email == 'zeldtradepro@gmail.com'`. Rule redéployée. | ✅ Résolu |
| ~~**B1**~~ | ~~Activation code Pro échoue pour le compte admin recréé~~ ✅ Résolu 2026-05-12 (Option A) | User a édité manuellement le doc `proCodeHashes/{hash}` dans Firebase Console pour mettre le bon UID. Activation OK confirmée. Cleanup B (suppression artefacts ancien UID) reste pertinent à terme. | ✅ Résolu |
| ~~**B2**~~ | ~~Cloud Function cleanup userEmails orphelins~~ ✅ 2026-05-13 (v0.9.107) — `cleanupOrphanUserEmails` CF + UI admin Config tab (dry-run obligatoire avant suppression). En complément : 4 comptes fantômes existants ont été supprimés en v0.9.125 et fix structurel (création immédiate du doc userEmails au signup) déployé. | ✅ Résolu |
| **B4** | Lot size se reset à 1 quand on rouvre un trade pour le modifier (signalé user 2026-05-16) | Reproduction : créer un trade avec lot 0.2 → sauvegarder → cliquer Modifier sur ce trade → le champ "Lot" affiche 1 au lieu de 0.2. Probable cause : `Number()` ou `parseInt()` au lieu de `parseFloat()` dans le pré-remplissage de la modale, OU input `type="number"` avec `step="1"` par défaut qui arrondit. Fichiers à vérifier : `src/js/modal.js` (fonction de pré-remplissage edit trade) + l'input HTML correspondant dans `src/app.html`. Effort estimé : 15-30 min. | ⏳ À fixer |
| ~~**B5**~~ | ~~Contact form dans l'app cassé~~ ✅ 2026-05-16 (v0.9.172) — Refonte complète : retrait du captcha + email + champ nom. Le user tape juste son message, pseudo récupéré server-side depuis `userEmails/{uid}.username`. Throttle 60s/uid maintenu. | ✅ Fait |
| ~~**B6**~~ | ~~Plus de formulaire de contact sur la landing~~ ✅ 2026-05-16 (v0.9.172) — Nouvelle section `#contact` avec form pseudo + message (sans email, sans captcha). CF `sendContactMessage` accepte les appels anonymes avec throttle 60s/IP (parts[length-2] du XFF). | ✅ Fait |

---

## 🆕 Nouvelles features demandées (hors audit)

| # | Feature | Description | Effort |
|---|---|---|---|
| **F1** | **Type de trading au signup + adaptation UI** | **Multi-choix** au signup : ☐ Fonds propres (capital perso hors prop firm) ☐ Prop firm (Apex/FTMO/etc.). Crypto plus tard (F2). Stocker dans `userEmails/{uid}.tradingTypes: ['fundsOwn'\|'propFirm'][]`. **UI adaptative** : si user a uniquement `fundsOwn` → masquer la section Prop Firms (Apex trailing, drawdown rules, daily loss limit), masquer les presets prop firms dans Settings. Si les 2 → garder l'UI actuelle. **Onboarding rétroactif** : pour les users existants qui n'ont pas encore répondu, afficher une modale bloquante au 1er login après la mise à jour pour qu'ils choisissent. **Détails précis (UX exact, schéma data, flow modale, instruments par défaut, calculs risk adaptés) à fournir par l'user plus tard** | À définir (~4-6h) |
| **F2** | Ajouter Crypto à F1 (futur) | Une fois F1 stable, étendre les choix avec ☐ Crypto. UI : instruments crypto (BTCUSD, ETHUSD, etc.), calculs adaptés. | À définir |
| ~~**F3**~~ | ~~Export PDF des trades — Pro only~~ ✅ 2026-05-16 (v0.9.169) — Refonte complète : page de garde + 1 page par trade en ordre chronologique avec screenshot embarqué (CORS Storage configuré via gsutil + chargement via `<img crossOrigin>` + canvas). Testé OK par user. | ✅ Fait |
| ~~**F4 v1**~~ | ~~Landing page v1 — déployée~~ ✅ 2026-05-14 (v0.9.112) | Page publique à `landing.html` avec hero « Un journal de trading complet fait par un trader pour les traders ». 6 features, pricing stealth, FAQ, footer mentions légales. Design dark cohérent app, responsive. **v2 prévue** : screenshots réels, témoignages, routing auto loggé/non-loggé, branding logo. | ✅ v1 |
| ~~**F4 v2**~~ | ~~Landing page v2 — visuels améliorés~~ ✅ 2026-05-14 (v0.9.117) | Mockup app preview SVG (sidebar + KPIs + chart d'équité), bande stats (5 prop firms / ∞ trades / 100% EU / 0€ beta), grille de fond + glows ambiants, badge pulsant animé, nouveau logo SVG (chart trending up). Tailles réduites encore (body 14px, hero clamp 24-36px, container 880px). | ✅ v2 |
| **F4 v3** | **Landing page v3 — vrais screenshots + témoignages** | Remplacer le mockup SVG par de vraies captures app (Journal, Dashboard, Wizard) avec lazy-loading. Témoignages bêta-testeurs (quand récoltés). Routing automatique : non-loggé sur `/` → reste sur landing, loggé → redirect auto `/app.html`. Animations subtle (fade-in scroll). | ~4-6h |

> Ajouté le 2026-05-12 sur demande user.
> User précisera les détails (UX, schéma data, flow modale, calculs) plus tard avant implémentation.

---

## 🎯 Plan d'attaque cette semaine — 100% GRATUIT

### Lundi matin (30 min)
1. I3 — Budget alert GCP (5 min)
2. I1 — PITR Firestore (2 min)
3. I5a — Imprimer backup codes Gmail (5 min)
4. I5b — Ajouter 2e Owner GCP (5 min)
5. I5c — Inactive Account Manager (5 min)
6. I8 — Dependabot + CodeQL GitHub (15 min)

### Lundi aprem (2-3h)
7. I6 — Réparer App Check reCAPTCHA Enterprise (le plus dur, mais critique)

### Mardi (3-4h)
8. I2 — Scheduled backup GCS (30 min)
9. I9 — Discord webhooks (1h) → donne-moi les 2 URLs après pour migration code (~30 min de mon côté)
10. I4 — Service account CFs dédié (1-2h)

### Mercredi (2-3h)
11. I15 — Compte Stripe FR + KYC (le plus long en attente, à lancer tôt)
12. ~~I14 — MFA Firebase Auth admin~~ ❌ Abandonné 2026-05-17

### Jeudi (3-4h)
13. I10 alt — Migrer vers Firebase Hosting `zeldtrade.web.app` (1h, GRATUIT)
14. I11 — Compléter privacy.html (1-2h)

### Vendredi (2h)
15. I13 — Sentry setup (1h)
16. I8 — Dependabot config dependabot.yml (15 min)

**Une fois ces actions manuelles faites** (toutes 0€), ping-moi → je fais les **fixes code critiques + hauts** dans la foulée (Q1, Q3, Q4-5, S1 réactivation, S2 remise email_verified, U1 confirm modal, etc.).

**Score visé après la semaine** : sécurité **~9/10**, prêt pour ouverture commerciale post-1ère vente.

---

## 🔄 Mise à jour de ce fichier

À chaque action terminée, je rayer (`~~~~`) la ligne et marquer la date. Exemple :
```
- ~~**I3** — Budget alert GCP (5 min)~~ ✅ 2026-05-13
```

Ne pas supprimer les items — historique trace. Quand toute une section est complète, déplacer "🎉 TERMINÉ" en haut.

---

# 🔍 AUDIT EXHAUSTIF 2026-05-16 (v0.9.161)

Audit complet du projet par Explore agent — 46 nouveaux items identifiés, classés par catégorie. Effort total estimé : ~40-50h. Aucun critique immédiat, mais beaucoup de polish + dette technique à attaquer post-beta.

## 🐛 Bugs nouveaux

### B7 — 🟡 MOYEN — Input `type="number"` step=0.01 bug Safari affichage
**Fichier** : `src/app.html:726`, `src/js/modal.js:809`
**Description** : Input `wContracts` a `type="number"` + `step="0.01"`. Safari peut arrondir/afficher différemment les fractionnaires en mode édition. Affecte UX mais pas logique.
**Effort** : 15 min

### B7b — 🟠 HAUT — `parseInt()` au lieu de `parseFloat()` sur lots parsés IA
**Fichier** : `src/js/modal.js:141`
**Description** : `parseInt(lotsM[1])` sur lots extraits par IA via regex. Si screenshot a "0.2 lots", `parseInt("0.2")` = 0. Devrait être `parseFloat()`.
**Effort** : 5 min

## 💾 Dette technique (Code Quality)

### Q25 — 🟡 MOYEN — Refactor modal.js (59KB, 1324 lignes monolithiques)
**Fichier** : `src/js/modal.js`
**Description** : Tout le wizard dans un seul module. Splitter en wizard-step1/2/3.
**Effort** : 4-6h

### Q26 — 🟡 MOYEN — i18n.js trop gros (69KB, 1284 lignes)
**Fichier** : `src/js/i18n.js`
**Description** : Strings FR/EN inline. Splitter en `i18n.fr.json` + `i18n.en.json` + loader.
**Effort** : 2-3h

### Q27 — 🟢 BAS — Changelog.js monstre (167KB, 4700+ lignes)
**Fichier** : `src/js/pages/changelog.js`
**Description** : Historique complet inline depuis v0.9.1. Paginer 20 dernières inline + lazy-load full.
**Effort** : 1-2h

### Q28 — 🟡 MOYEN — settings.js volumineux (56KB)
**Fichier** : `src/js/pages/settings.js`
**Description** : Splitter en `settings-main`, `settings-accounts`, `settings-export`.
**Effort** : 2-3h

### Q29 — 🟢 BAS — Pas de minification JS
**Description** : Tous les `.js` envoyés en clair. ~30% gain possible avec terser.
**Effort** : 1-2h

### Q30 — 🟡 MOYEN — Magic numbers éparpillés sans const
**Fichier** : `src/js/modal.js:89`, `src/js/app.js:198`, `src/js/ui.js`
**Description** : `1000` instrument fees, `50000` default capital, `2.14` default fee, `768` mobile breakpoint, etc. Centraliser en `const` ou config.
**Effort** : 1-2h

### Q31 — 🟡 MOYEN — 172 `addEventListener` vs 4 `removeEventListener`
**Description** : Listeners s'accumulent à chaque modal open/close. Pas un memory leak critique mais pattern mauvais.
**Effort** : 1-2h

## 🎨 UX / Design (nouveaux trouvés)

### U35 — 🟠 HAUT — Pas d'états "loading" visibles sur Dashboard/Analytics/Goals/Calendar
**Fichier** : `src/js/pages/dashboard.js`, `analytics.js`, `goals.js`, `calendar.js`
**Description** : Pages chargent silencieusement (~500ms-1s). User voit blanc → croit que cassé. Ajouter skeleton loader ou spinner.
**Effort** : 1-2h

### U36 — 🟡 MOYEN — Pas d'aria-label sur boutons icônes (~50+ boutons)
**Fichier** : `src/app.html`, `src/index.html`
**Description** : Lecteurs d'écran annoncent juste "button". WCAG A failed.
**Effort** : 1-2h

### U37 — 🟡 MOYEN — Mobile : Wizard étapes trop denses sur 320-414px
**Fichier** : `src/app.html` (wizard), `src/css/style.css` (media queries)
**Description** : Champs s'empilent sans whitespace sur iPhone SE.
**Effort** : 1-2h

### U38 — 🟡 MOYEN — Pas de "No data" empty states sur Analytics/Goals/Calendar
**Description** : 0 trade → graphes vides sans message. Ajouter empty state + CTA.
**Effort** : 1-2h

### U39 — 🟢 BAS — Tooltips manquants sur boutons Outils
**Fichier** : `src/js/pages/outils.js`
**Description** : Icônes Simulateur fiscal / Calculatrice position sans tooltip.
**Effort** : 30 min

### U40 — 🟢 BAS — Topbar titre+version trop petit sur mobile
**Fichier** : `src/css/style.css`
**Description** : "ZeldTrade vX.Y.Z" peu lisible sur <600px.
**Effort** : 15 min

### ~~U41~~ — ✅ FAIT 2026-05-17 (v0.9.180) — Unifier les couleurs entre l'app et la landing page

### U42 — 🟠 HAUT — Audit complet expérience mobile (téléphone)
**Demandé par user 2026-05-17.**
**Description** : vérifier que TOUTE l'app fonctionne et est utilisable sur téléphone (iPhone 12 mini 375px, iPhone 14 Pro 393px, Android Pixel 393px, jusqu'à iPhone Plus 428px) + landscape.

**Pages/zones à vérifier** :
- Landing page (zeldtrade.com) — déjà bien mais re-vérifier après changements récents
- Login / Signup / Forgot password
- Sidebar mobile (hamburger)
- Journal (liste trades + detail panel + swipe back ?)
- Dashboard (4 KPI cards + equity chart + trailing floor + recent trades)
- Analytics (sessions chart, breakdown tables)
- Calendar (grille mensuelle 7 cols cramped < 480px ?)
- Goals (cards evaluation + funded, multi-cols → 1-col)
- Outils (calculateurs, tabs)
- Réglages (Mes Comptes, Prop Firms, Spreads, Général — toutes les sections)
- Offers (cards Basic/Pro/Lifetime)
- Wizard nouveau trade (3 étapes, drop zone, levels grid 3 cols → 2/1 col ?)
- Bulle contact + modal contact
- Modal export PDF + progress
- Modal délétion compte
- Console admin

**Points spécifiques à tester** :
- Touch targets ≥ 44×44px (a11y WCAG)
- Inputs : `font-size: 16px` minimum (anti-zoom iOS)
- Scrollbars qui ne mangent pas du contenu
- Modales : pas de débordement, croix fermeture accessible
- Wizard step 2 : drop zone fonctionnelle au tap (pas juste drag/paste)
- Screenshot : capture depuis l'app caméra mobile possible ?
- Performance (rendering smooth sur device mid-range)
- Landscape : tout reste fonctionnel ou layout cassé ?

**Tests pratiques** :
- Vrai téléphone (pas juste DevTools responsive) — iPhone + Android idéalement
- Tester en mode privé (anti-cache)
- Tester création compte → 1er trade → export PDF complet sur mobile uniquement

**Effort** : 2-4h (audit + fixes des points trouvés)
**Priorité** : 🟠 HAUT — beaucoup de traders consultent leur journal sur mobile en pleine session
**Fichiers** : `src/css/style.css` (variables --accent, --blue, --green, --red, etc.), `src/index.html` (CSS inline avec son propre système de couleurs --accent violet/rose, --accent-l, --pink), `src/admin.html` (CSS inline, mix violet/bleu)
**Description** : Incohérence de marque entre la landing et l'app.
- **Landing** : palette violet/rose (--accent #7c3aed violet, --accent-l rose clair, --pink #f472b6) — moderne, branding fort
- **App** : palette bleu Apple (--blue #0a84ff) mélangée à du violet hérité (--accent #7c3aed) sur les boutons primaires, badges, focus rings → user passe de violet/rose (landing) à bleu (app) = perte de cohérence visuelle
- **Admin** : violet majoritaire mais quelques bleus persistent
**Impact** : perception "branding non terminé" / "deux produits cousus". Important avant ouverture commerciale.
**À décider** :
1. Direction : tout aligner sur le **violet/rose** de la landing (recommandé — branding plus distinctif que le bleu Apple générique) OU tout aligner sur le bleu existant (moins de travail mais plus banal)
2. Liste exhaustive : recenser tous les usages `--blue` dans l'app (probablement ~50+ occurrences) et les remplacer/déprécier
3. Garder bleu pour le sémantique "info" si nécessaire, violet pour primaire/CTA/branding
**Effort** : 2-4h (audit + remplacement + tests visuels sur toutes les pages)
**Note** : faire APRÈS la refonte règles prop firms (priorité fonctionnelle d'abord) sauf si l'utilisateur veut le contraire.

## 🔒 Sécurité (compléments audit récent)

### S41 — 🟡 MOYEN — Pas de CSRF protection complémentaire (X-Request-ID)
**Fichier** : `functions/index.js` (toutes CFs)
**Description** : `httpsCallable()` envoie token Firebase auth → mitigé. Hardening : ajouter X-Request-ID header + validation.
**Effort** : 1-2h

### S42 — 🟡 MOYEN — Audit complet usage `innerHTML` vs `escHtml()`
**Fichier** : `src/js/ui.js`, `src/js/modal.js:31`, partout
**Description** : `esc()` existe mais pas toujours utilisé. Vérifier qu'AUCUN `.innerHTML` n'a de data user non escapée.
**Effort** : 30 min

### S43 — 🟢 BAS — Pas de debounce client sur "Sauvegarder trade"
**Fichier** : `src/js/modal.js` (save button)
**Description** : User pourrait mash bouton → créer 5 trades en 1s. Ajouter debounce 1s.
**Effort** : 15 min

### S44 — 🟡 MOYEN — Pas de SRI (SubResource Integrity) sur certains CDN scripts
**Fichier** : `src/app.html`, `src/index.html`
**Description** : Chart.js et autres sans `integrity=` hash. Si CDN compromis → injection.
**Effort** : 1h

### S45 — 🟢 BAS — Pas de header X-UA-Compatible
**Fichier** : `firebase.json`
**Description** : Mineur, aide vieux navigateurs.
**Effort** : 5 min

### S46 — 🟢 BAS — localStorage data non obfusquée
**Fichier** : `src/js/store.js:141`
**Description** : `lastWizardPrefs`, `_plan`, `aiUsage` en clair. Pas sensible mais obfusquer simple recommandé.
**Effort** : 1h

## 📊 Performance

### P11 — 🟡 MOYEN — Chart.js (~60KB) chargé non-lazy
**Fichier** : `src/app.html:897`, `src/js/pages/dashboard.js`
**Description** : Chart.js chargé même si user reste sur Journal tab. Lazy-load au switch Dashboard.
**Effort** : 1-2h

### P12 — 🟡 MOYEN — Firestore listeners non détachés au switch page
**Fichier** : `src/js/pages/dashboard.js`, `analytics.js`, `goals.js`
**Description** : `onSnapshot()` sans `unsubscribe()` → 10 listeners empilés après 10 switches.
**Effort** : 1-2h

### P13 — 🟡 MOYEN — localStorage écriture sync à chaque trade save
**Fichier** : `src/js/store.js:141`
**Description** : Sur 100+ trades, JSON.stringify + localStorage = 50-100ms lag. Migrer IndexedDB ou debounce.
**Effort** : 2-4h

### P14 — 🟢 BAS — `i18n.t()` appelé sans cache/memoization
**Fichier** : `src/js/i18n.js`
**Description** : Recherche dans 1284 lignes à chaque rendu. Memoization basique = gain perceptible.
**Effort** : 1h

### P15 — 🟠 HAUT — Promise.all() Firestore queries sans timeout
**Fichier** : `src/js/store.js` (`initForUser` ~line 180+)
**Description** : Si Firebase down, page freeze indéfiniment. Ajouter Promise.race(10s timeout).
**Effort** : 30 min

## 📚 Documentation

### D10 — 🟡 MOYEN — ARCHITECTURE.md pas à jour
**Fichier** : `docs/ARCHITECTURE.md`
**Description** : Ne documente pas Stripe webhook, Discord hooks, Groq CF, Storage, Firestore rules complexes.
**Effort** : 1-2h

### D11 — 🟡 MOYEN — Pas de ONBOARDING.md pour nouveau dev
**Description** : Setup local, emulator, env vars, déploiement à documenter.
**Effort** : 2-3h

### D12 — 🟡 MOYEN — `firestore.rules` zéro commentaires
**Description** : 20+ règles complexes sans explication. Ajouter commentaires par rule.
**Effort** : 1h

### D13 — 🟡 MOYEN — Pas de runbook incident
**Description** : Créer `docs/INCIDENT_RESPONSE.md` : que checker, comment rollback, contacts.
**Effort** : 1h

### D14 — 🟢 BAS — `.github/CODEOWNERS` manquant
**Description** : Auto-assign PR reviews si collab future.
**Effort** : 15 min

## 🧪 Tests

### T7 — 🟡 MOYEN — Aucun test pour les Cloud Functions
**Description** : `test/calc.test.js` couvre calc.js. Rien pour CFs. Setup Jest + Firebase emulator.
**Effort** : 3-4h

### T8 — 🟡 MOYEN — Pas de tests E2E (Cypress/Playwright)
**Description** : Smoke test signup → trade → dashboard → export PDF.
**Effort** : 4-6h

### T9 — 🟡 MOYEN — Pas de code coverage report
**Description** : Setup Istanbul/nyc. Actuel ~60% sur calc seulement.
**Effort** : 5-7h total

## ⚙️ Config / DevOps

### I21 — 🟡 MOYEN — Pas de `.env.example`
**Description** : Documenter `HCAPTCHA_SECRET`, `GROQ_API_KEY`, `STRIPE_*`, etc.
**Effort** : 30 min

### I22 — 🟡 MOYEN — firebase.json optimisations manquantes
**Fichier** : `firebase.json`
**Description** : Vérifier `cacheControl` immutable sur assets `?v=`. CSP headers servies côté Firebase ?
**Effort** : 30 min

### I23 — 🟡 MOYEN — Pas de GitHub Actions CI
**Description** : Workflow auto pour `node test/calc.test.js` au push.
**Effort** : 1-2h

### I24 — 🟡 MOYEN — `scripts/release.sh` fragile
**Description** : `git subtree` peut fail silencieusement → tag créé mais pas déployé. Ajouter checks + dry-run flag.
**Effort** : 30 min

## 🌍 i18n / Compliance

### I25 — 🟡 MOYEN — Traductions FR/EN incomplètes
**Fichier** : `src/js/i18n.js`
**Description** : Vérifier qu'AUCUNE clé FR n'est orpheline côté EN et vice-versa.
**Effort** : 1-2h

### I26 — 🟡 MOYEN — Cookie banner manquant (RGPD)
**Description** : Firebase, hCaptcha, Chart.js déposent cookies. Banner "Accepter/Refuser" obligatoire RGPD.
**Effort** : 1-2h

### I27 — 🟠 HAUT — CGU (`src/cgu.html`) trop vagues
**Description** : Placeholder minimaliste. Manque limitation responsabilité, conditions précises, politique remboursement.
**Effort** : 2-3h (rédaction légale)

## 💰 Business / Scaling

### B8 — 🟡 MOYEN — Pas de rate-limiting Firestore côté serveur
**Description** : User pourrait créer 1000 trades en 1 min via API brute. Middleware throttle IP.
**Effort** : 2-3h

### B9 — 🟡 MOYEN — Pas de business metrics / monitoring applicatif
**Description** : Pas de tracking "trades/jour", "users actifs/pays". Setup GA4 events + Data Studio.
**Effort** : 2-3h

### B10 — 🟡 MOYEN — Pas de feature flags runtime
**Description** : Nouvelles features hard-deploy. Ajouter Firestore `/config/features` + toggle runtime.
**Effort** : 1-2h

## 🎯 Demandes user 2026-06-10 (à planifier)
- **ECON-CAL — Ajouter la valeur « actual » au calendrier économique (via FMP).** Le calendrier est en place (ForexFactory via CF `getEconCalendar`, filtres impact/devise/période) mais le feed FF ne fournit PAS l'« actual » (valeur réelle publiée). Le rendu a déjà le slot prêt (s'affiche dès que `e.actual` existe). À faire : brancher une source 0€ qui donne l'actual (piste : FMP free tier 250 req/j → notre cache 30 min suffit largement) et fusionner FF (semaine/prévisions) + actual.

---

## 🎯 Features à terminer / polish

### ECON-CAL — 🟡 MOYEN — Réactiver le calendrier économique (Éco)
**Description** : Le calendrier éco natif (ForexFactory via CF `getEconCalendar`) a été RETIRÉ de
l'onglet Éco le 10/06/2026 car le feed FF ne fournit PAS l'« actual » (valeur réelle), et aucune
source gratuite ne le donne sans clé. Le code est conservé (front `_ecalInit` non appelé + CF
déployée) → réactivation = décommenter le bloc dans `renderEcon` (src/js/app.js) + rappeler
`_ecalInit(el, en)`. **Condition** : trouver une source qui fournit l'actual à 0€ (piste : FMP
free tier 250 req/jour — notre cache 30 min suffit largement) puis fusionner FF (semaine) + actual.
L'onglet Éco ne montre plus que les NEWS pour l'instant.
**Effort** : 2-3h (une fois la source choisie)

### F5 — 🟠 HAUT — Exporteur CSV trades
**Description** : F3 fait PDF, faut aussi CSV pour Excel. Bouton "Exporter CSV".
**Effort** : 1-2h

### F6 — 🟡 MOYEN — Mode hors-ligne fallback IA Groq
**Description** : Si Groq API down, mode dégradé : skip détection IA, user entre manuellement.
**Effort** : 1-2h

### F7 — 🟢 BAS — Fonction "Dupliquer trade"
**Description** : Bouton qui ouvre wizard avec champs pré-remplis.
**Effort** : 1-2h

### F8 — 🟢 BAS — Dark/Light mode toggle
**Description** : Settings → toggle + localStorage persist.
**Effort** : 2-3h

---

## 📊 Récap audit 2026-05-16

| Catégorie | Items | Effort total |
|---|---|---|
| 🐛 Bugs | 2 | 20 min |
| 💾 Dette technique | 7 | 13-19h |
| 🎨 UX | 6 | 5-7h |
| 🔒 Sécu compléments | 6 | 4-5h |
| 📊 Perf | 5 | 5-9h |
| 📚 Docs | 5 | 5-8h |
| 🧪 Tests | 3 | 12-17h |
| ⚙️ DevOps | 4 | 3-5h |
| 🌍 i18n/Compliance | 3 | 4-7h |
| 💰 Business | 3 | 5-8h |
| 🎯 Features | 4 | 5-8h |
| **TOTAL** | **48** | **~60-90h** |

**Priorité ordre d'attaque post-beta** :
1. 🟠 Hauts (~6 items, ~12h) : P15, U35, B7b, I27, F5 + 1-2 autres
2. 🟡 Moyens (~33 items, ~45h) : tout le polish dette+UX+sécu
3. 🟢 Bas (~9 items, ~5h) : nice-to-have post-launch
