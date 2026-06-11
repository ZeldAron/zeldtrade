# Changelog développement (interne)

> Journal des modifications techniques, décisions d'archi et exceptions sécurité.
> Distinct de `src/js/pages/changelog.js` qui est destiné aux users.
>
> **Règle d'or** : à chaque modification du code, **AJOUTER** une entrée datée ci-dessous (jamais écraser).

---

## 2026-06-11 — v1.0.5 (staging) — FIX : changement de langue ne basculait pas le site

**Type** : fix
**Fichier** : `src/js/app-bootstrap.js`

Bug : cliquer « English » dans le flyout langue ne changeait pas la langue du site. Cause : `i18n.setLang()`
ne fait QUE persister en localStorage (i18n.js:1866) — il ne ré-applique rien, et l'app rend tout son contenu
en JS via `i18n.t()` au moment du rendu (donc un `apply()` ne suffirait pas non plus). Fix : le handler `set-lang`
**recharge la page** (`location.reload()`) après `setLang` → tout le site se re-rend dans la nouvelle langue.
Vérifié staging : clic English → lang fr→en, « Nouveau trade » → « New trade ». Bump bootstrap h=22.

## 2026-06-11 — v1.0.5 (staging) — Pied de sidebar : suppression du vide (retour user)

**Type** : fix UI
**Fichier** : `src/css/style.css`

« L'espace est pas beau » — gros vide entre la pill compte et « Nouveau trade ». Deux causes :
1. **`#btnLogout` stub caché** (gardé pour compat lors du passage au menu compte) : sa classe `.user-logout-btn`
   **écrasait l'attribut `hidden`** → un bouton vide de ~40px s'affichait dans le wrap. → `#btnLogout { display:none !important }`.
2. **`#sidebarUpgrade` (« Voir les offres »)** : redondant (Offres est dans le menu compte) + créait du vide pour les non-pro. → masqué.
Résultat : écart pill → Nouveau trade **60px → 20px**, pied resserré (stats → pill → bouton). Bump style h=28.

## 2026-06-11 — v1.0.5 (staging) — FIX : gate d'inscription bloquait à tort un abonné (plan figé)

**Type** : fix (bug critique)
**Fichier** : `src/js/app-bootstrap.js`

Bug : un user **funded** (abonné via Stripe) voyait la gate « Plus qu'une étape ». Cause : le plan est chargé
**one-shot** (`userDoc('plan').get()`) ; après un checkout, le client pouvait rester figé sur l'ancien plan
`'none'` → la gate (qui s'affiche sur `'none'`) bloquait alors qu'il a payé.
**Garde-fou** : dans `_renderAccessGate`, si `state==='none'` MAIS `Store.getStripeInfo().customerId` existe
(= a déjà payé / un abo) → on **n'affiche PAS la gate** + `Store.resync()` (flag anti-boucle) pour recharger le
vrai plan. La gate ne bloque donc plus que les VRAIS nouveaux inscrits sans aucun moyen de paiement.
Vérifié staging : compte 'none' + customerId → gate non affichée. Bump bootstrap h=21.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : onglet « Paiement » → portail Stripe (demande user)

**Type** : feat UI
**Fichier** : `src/js/app-bootstrap.js`

Remplacement de « Passer à un plan supérieur » par **« Paiement »** (icône carte) pour gérer son paiement (prochaine échéance, changer la carte, factures, résiliation) :
- **Contextuel** : si l'user a un `customerId` Stripe (`Store.getStripeInfo()`) → « Paiement » → `createBillingPortalSession({})` (portail Stripe, loader + erreur gérée). Sinon → « Passer à un plan supérieur » → Offres (les non-abonnés gardent le chemin d'achat).
- Config portail Stripe TEST déjà présente (`bpc_…`). Vérifié staging : portail ouvre (HTTP 200 `billing.stripe.com`), menu affiche « Paiement » pour un customer. Bump bootstrap h=20.
- ⚠️ Go-live : activer/configurer le portail client en mode **LIVE** (Dashboard Stripe) pour que « Paiement » fonctionne en prod.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : retrait des drapeaux emoji (reco ui-ux-pro-max)

**Type** : fix UI (reco `no-emoji-icons`)
**Fichier** : `src/js/app-bootstrap.js`

Application de la reco ui-ux-pro-max `no-emoji-icons` / `icon-style-consistent` : retrait des drapeaux emoji
🇫🇷🇬🇧 du flyout langue (rendus inconsistants sur Windows + clashent avec les icônes SVG du menu). Les items
deviennent « Français (France) » / « English (US) » + ✓ sur l'actif. Vérifié staging (0 drapeau). Bump bootstrap h=19.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : fix alignement flyout (audit ui-ux-pro-max)

**Type** : fix UI
**Fichier** : `src/css/style.css`

Audit ui-ux-pro-max du menu compte + flyout langue. Défaut principal : `.account-menu-item > span { flex:1 }`
ciblait AUSSI le drapeau et la valeur de droite (tous des `<span>`) → texte centré, écart drapeau→texte énorme,
coche ✓ chevauchant le texte. **Fix** : `> span:not([class])` → `flex:1` au LIBELLÉ seul ; le drapeau (`.acct-flag`)
et les valeurs (`.account-menu-right`) reprennent `flex:none`. Corrige aussi l'alignement des valeurs FR/Sombre du menu principal.
Vérifié staging : écart drapeau→texte 11px, ✓ à 11px du bord droit (plus de chevauchement). Bump style h=25.
NB (audit) : drapeaux = emoji (caveat rendu Windows) — gardés pour coller au style Claude ; à passer en SVG/texte si besoin cross-platform.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : flyouts au SURVOL (hover)

**Type** : feat UI (demande user)
**Fichiers** : `src/js/app-bootstrap.js`

Les flyouts Langue/Légal s'ouvrent désormais **au survol** (façon Claude), pas seulement au clic :
- `mouseover` sur le menu → si on pointe « Langue ›»/« Légal ›» → `openFlyout`. Sur le flyout → `cancelClose`. Sur un autre item → `scheduleClose` (200ms, annulable).
- `mouseleave` du menu (+ flyout) → `scheduleClose`. Le **délai de 200ms** évite de perdre le panneau quand la souris traverse l'écart menu↔flyout.
- Clic conservé (ouvre aussi — touch/accessibilité). Bump bootstrap h=18.
- Vérifié staging : survol Langue → flyout ouvert ; survol Thème → flyout fermé.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : sous-menus en FLYOUT latéral (façon Claude)

**Type** : feat UI (demande user)
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`

Langue/Légal passent du « drill-in » (remplacement de contenu) au **flyout latéral** (panneau à droite du menu, façon Claude) :
- `openFlyout(kind, anchor)` / `closeFlyout()` : panneau `.account-flyout` ajouté au menu, `left:calc(100%+6px)`, `top` aligné sur l'item cliqué (clampé), **bascule à gauche** si débordement droite (petit écran). Toggle au re-clic.
- **Langue** : 🇫🇷 Français (France) + 🇬🇧 English (US) avec ✓ (les 2 seules langues traduites — FR+EN). Choix → `i18n.setLang` + re-render principal.
- **Légal** : CGU/Mentions légales/Confidentialité (liens nouvel onglet).
- ⚠️ Fix : `.account-menu` repassé en `overflow:visible` (l'`overflow-y:auto` rognait le flyout). `.account-flyout` min-width 244 + nowrap (« Français (France) » sur 1 ligne). Bump bootstrap h=17 + style h=24.
- Vérifié staging : flyout à droite (flyLeft 267 > menuRight 262), FR/EN + ✓, 1 ligne.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : compact + aligné (retour user « trop long »)

**Type** : polish UI
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`

- **Sous-menu « Légal › »** : CGU + Mentions légales + Confidentialité regroupées (3 lignes → 1), façon « En savoir plus › » de Claude. `legalHTML()` + vue `legal` dans `show()` + handler `legal`/`legal-back`.
- **Resserrage** : item padding 9→7px, gap 12→11, icônes 18→17, sep margins 6→4, padding popover 6→5, email aligné à 11px comme les items. → hauteur du menu **~600px → 324px**.
- Vérifié staging : 8 lignes au principal, sous-menus Langue/Légal OK, alignement uniforme. Bump bootstrap h=16 + style h=21.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : fixes UX (fermeture / réouverture / focus)

**Type** : fix
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`

- **Fermeture intempestive au choix de langue** : le re-render `show('main')` détachait l'élément cliqué → le handler document « clic dehors » (`wrap.contains(target)` faux) fermait le menu. Fix : `e.stopPropagation()` sur les clics internes `[data-acct]`.
- **Réouverture sur le sous-menu langue** : `openM()` force désormais `show('main')` → rouvre toujours sur la vue principale.
- **Contour de focus moche au clic** (la pill est un `<button>`) : `:focus:not(:focus-visible) → outline:none` (propre souris, conservé clavier).
- `.account-menu` : `max-height:calc(100dvh-92px)` + `overflow-y:auto` (anti-débordement sur petit écran). Bump bootstrap h=15 + style h=20.
- Vérifié staging : choix langue = reste ouvert sur principal (valeur MAJ) ; clic dehors ferme ; réouverture = principal.

## 2026-06-11 — v1.0.5 (staging) — Menu compte : sélecteur de langue (sous-menu)

**Type** : feat UI (demande user)
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`

L'item « Langue » du menu compte (avant : toggle FR↔EN au clic) devient un **sous-menu** façon Claude :
- Vue principale ↔ vue langue via `show('main'|'lang')` (swap de `menu.innerHTML`). « Langue › » (chevron) ouvre la liste : « ‹ Langue » (retour) + 🇫🇷 Français + 🇬🇧 English, avec ✓ sur la langue active.
- Clic langue → `i18n.setLang()` + retour au menu principal (re-rendu dans la nouvelle langue, menu reste ouvert). Thème idem (toggle + re-render). Fix : libellé du thème (Sombre/Clair ↔ Dark/Light) recalcule la langue courante.
- CSS `.acct-chevr` / `.acct-check` / `.acct-flag` / `.account-menu-back`. Bump bootstrap h=14 + style h=19. Vérifié staging (Français ✓ / English).

## 2026-06-11 — v1.0.5 (staging) — Menu compte bas-gauche (façon Claude) + désencombrement sidebar

**Type** : feat UI (demande user)
**Fichiers** : `src/pages/app.html`, `src/js/app-bootstrap.js`, `src/css/style.css`

Regroupe le secondaire dans un **popover de compte** (style claude.ai) ouvert depuis la pill en bas de sidebar :
- **app.html** : `.user-pill` → bouton `#accountBtn` (avatar+nom+badge+chevron) dans `.account-wrap` ; ancien `#btnLogout` conservé caché (compat). Réglages + Offres + leur divider marqués `.acct-moved` (cachés de la sidebar mais gardés dans le DOM → routing intact).
- **app-bootstrap.js** : `_initAccountMenu()` (appelé dans `_doReveal`) injecte le popover : email + Paramètres · Langue (toggle FR/EN) · Thème (toggle clair/sombre) · Aide · ─ · Offres · Nouveautés · ─ · CGU/Mentions légales/Confidentialité · ─ · Déconnexion. Actions : routing via `[data-page].click()`, `i18n.setLang`, `Theme.set`, `Auth.logout`. Ferme sur clic-dehors + Échap.
- **style.css** : `.account-menu`/`-item`/`-sep`/`-email`, `.acct-moved`, chevron rotatif. Bump bootstrap h=13 + style h=18.
- Vérifié staging : menu affiché (style Claude), sidebar sans Réglages/Offres.

## 2026-06-11 — v1.0.5 (staging) — Gate « carte obligatoire à l'inscription »

**Type** : feat (le dernier morceau du modèle carte-obligatoire)
**Fichiers** : `functions/index.js`, `src/js/app-bootstrap.js`, `src/css/style.css`, `src/pages/app.html`

- **`notifyNewSignup`** : ne pose **PLUS** de `trialEnd` in-app aux nouveaux inscrits (pivot). → nouvel inscrit = `getAccessState()==='none'`.
- **`_renderAccessGate`** : nouveau cas **`'none'` → gate d'inscription bloquante** (`#onboardGate`, overlay) : « Plus qu'une étape · essai 14 j · carte requise · annulable, aucun prélèvement avant J15 » + 3 formules (Funded/Elite/Lifetime) → `_gateCheckout(plan)` (createCheckoutSession + loader + redirect Stripe). Seules issues : checkout ou logout. CSS `.onboard-plans`/`.onboard-plan(-reco)`. Bump bootstrap h=12, style h=17.
- Vérifié staging : compte mis en `'none'` → gate affichée (3 formules), aucune autre gate ; trialing/paid non affectés.
- ⚠️ **SÉQUENÇAGE GO-LIVE** : lancer la migration `migrateFreeToTrial` (pose trialEnd aux gratuits existants → 'trialing') **AVANT** de pousser cette gate en prod, sinon les gratuits existants (sans trialEnd) seraient bloqués comme des nouveaux.

## 2026-06-11 — v1.0.5 (staging) — Retrait des mentions « bêta » (l'app est en V1)

**Type** : copie (demande user — l'app n'est plus en bêta)
**Fichiers** : `landing-i18n.js`, `i18n.js`, `index.html`, `cgu.html`, `legal.html`, `equipe.html`, `produit.html`, `faq.html`, `app.html`

Reformulation de toutes les mentions VISIBLES de « bêta » (l'identifiant technique interne du tier `beta`=VIP est conservé, non affiché) :
- Landing/sous-pages : `firms.sub` (« vérifié par les bêta testeurs » → « vérifié au tick près »), `about.p3` (retrait « bêta testeurs »), `pricing.elite.f4` (« Accès bêta » → « Accès anticipé aux nouvelles fonctionnalités »), + fallbacks index/equipe/produit + og:description equipe.
- App : `off.elite.f4`, `off.row.beta`, `off.faq.5a` (FR+EN) → « accès anticipé » sans « beta ».
- CGU/legal : retrait des clauses « phase bêta » / « en période de bêta » (l'app est fournie « en l'état »).
- Bump landing-i18n h=11 (uniformisé sur toutes les pages) + i18n h=7. Vérifié déployé : 0 mention visible.

## 2026-06-11 — v1.0.5 (staging) — CGU/CGV : alignées sur le nouveau modèle

**Type** : legal (contenu)
**Fichier** : `src/pages/cgu.html`

Mise à jour des CGV pour le modèle payant + essai carte requise :
- **Art. 11 & 12** : essai 7 j → **14 j** + **moyen de paiement requis dès l'inscription** + prélèvement auto à J14 sauf résiliation (divulgation claire, droit conso).
- **Art. 9 (grille)** : retrait du tier « Gratuit » permanent, ajout carte **Lifetime 299,90 €**.
- **Art. 10 bis** : résiliation / échec de paiement → l'accès prend fin (plus de « repasse au gratuit ») ; **données conservées + exportables**.
- **Art. 12 bis** (Lifetime : paiement unique, usage raisonnable, non remboursable) + **12 ter** (comptes gratuits existants : **préavis 30 j** → pause → suppression après notif, export toujours possible).
- Art. 6 bis (plafond resp.) reformulé ; date → 11 juin 2026. Vérifié staging (/cgu).
- ⚠️ Texte rédigé par Claude — **à faire relire par un pro** avant prod (rappel à l'user).

## 2026-06-11 — v1.0.5 (staging) — Migration ex-gratuits (préavis 30j) + email de préavis

**Type** : feat (transition commerciale, choix user : « préavis généreux » + email)
**Fichiers** : `functions/index.js`, `src/js/app-bootstrap.js`, `scripts/email-preavis-gratuits.html`, `src/pages/app.html`

- **CF `migrateFreeToTrial`** (admin only) : pose `trialEnd = now + graceDays` (défaut **30 j** = préavis généreux) sur tous les comptes GRATUITS. **DRY-RUN par défaut** (compte seulement) — n'écrit que si `{ apply:true }`. Idempotent (saute pro/lifetime + ceux déjà en essai). merge → trigger syncProClaim. Déployée staging.
  - ⚠️ **Invocation publique non accordée** (classifier a bloqué le `run.invoker allUsers`) → à autoriser avant de pouvoir l'appeler (cf. les autres CF callable qui l'ont). À lancer au go-live (dry-run puis apply).
- **Email de préavis** `scripts/email-preavis-gratuits.html` : annonce passage payant + 30 j gratuits + ajoute carte pour garder compte/données + export toujours possible + offre ZELD40/-40% & lifetime + CTA. Prêt pour Brevo (merge `{{contact.PRENOM}}`).
- **Copie** : avertissement → retiré « essai 14 j » (embrouillait, les existants ont 30 j de grâce) → « abonnement ou accès à vie ». Bump bootstrap h=11.

## 2026-06-11 — v1.0.5 (staging) — Paywall : bouton « Exporter toutes mes données » (garde-fou RGPD)

**Type** : feat (conformité RGPD art. 20)
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`, `src/pages/app.html`

Pour ne jamais retenir les données « en otage » quand l'accès est bloqué : bouton `#paywallExport` sur le mur de fin d'essai → `Store.exportFullJSON()` (export COMPLET : exportedAt, uid, plan, settings, trades, myAccounts, groups, spreadsByFirm) téléchargé en JSON. Réutilise l'export RGPD existant (store.js:1051) + le pattern download. CSS `.paywall-export` (bouton secondaire bordé). Bump style h=16, bootstrap h=10.
Vérifié E2E (staging) : essai forcé expiré → paywall → clic → JSON complet téléchargé (2 comptes + settings).

## 2026-06-11 — v1.0.5 (staging) — Avertissement ex-gratuits (transition payant + perte de données)

**Type** : feat (demande user)
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`, `src/pages/app.html`

Objectif : que les ex-gratuits SACHENT qu'ils doivent ajouter une carte pour garder accès + données. **Suppression MANUELLE choisie** (aucune CF auto qui supprime).
- **Écran d'explication** `_maybeShowTrialNotice` (1×/session, ex-gratuits en essai) : « ZeldTrade passe en payant · X j d'essai · ajoute ta carte pour garder toutes tes données · sans carte = accès bloqué puis compte supprimé ». CTA Voir les offres / Plus tard. Réutilise `.paywall-overlay/.paywall-card`.
- **Bannière** enrichie : « Essai · X j restants · ajoute ta carte pour garder tes données » + classe `.trial-banner-urgent` (rouge) si ≤3 j.
- **Paywall** (expiré) : avertit la suppression + données (`.paywall-warn` ambre).
- CSS `.paywall-warn` + `.trial-banner-urgent`. Bump style h=15, bootstrap h=9.
- **RESTE (go-live)** : migration `trialEnd=now+14j` pour TOUS les ex-gratuits (CF one-shot) + prod. Sans migration, l'avertissement ne s'affiche que pour les comptes ayant déjà un trialEnd.

## 2026-06-11 — v1.0.5 (staging) — Fix retour Stripe staging→prod + bouton lifetime + loader checkout

**Type** : fix + feat
**Fichiers** : `functions/index.js`, `src/css/style.css`, `src/js/pages/offers.js`, `src/js/app-bootstrap.js`, `src/pages/app.html`

- **FIX retour Stripe** : `PUBLIC_SITE_URL` codé en dur sur la prod → depuis staging, le retour après checkout (success/cancel) + liens emails pointaient vers zeldtrade.com. Rendu **dépendant de l'environnement** (`process.env.GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT === 'zeldtrade-staging'`). Vérifié : success/cancel_url = zeldtrade-staging.web.app.
- **Bouton lifetime** : était gris (`.pricing-cta` nu) → variante `.pricing-cta.lifetime` (dégradé violet #7c3aed→#a78bfa, texte blanc).
- **Loader checkout** : `ZTLoader` exposé en `window.ZTLoader` → handlers checkout (abo + lifetime) affichent le loader plein écran pendant la création de session. Bump style h=14, offers h=4, bootstrap h=8.

## Format des entrées

```markdown
## YYYY-MM-DD — vX.Y.Z — Titre court

**Type** : feat | fix | security | refactor | infra | docs | revert
**Fichiers** : `src/js/store.js`, `functions/index.js`...
**Versions impactées** : front (vX.Y.Z), CFs (vX.Y.Z)

### Contexte
Pourquoi cette modif, quelle était le problème.

### Changements
- Liste précise de ce qui a été modifié

### Impact
- UX : ce qui change pour l'user
- Sécu : impact sur la posture
- Perf : impact perf si pertinent

### À surveiller
- Tests à refaire
- Régressions possibles

### Liens
- Commit hash, audit ref, etc.
```

---

## 2026-06-11 — v1.0.5 (staging) — Lifetime = vraie 3ᵉ CARTE (à côté de Funded/Elite)

**Type** : feat (UI, demande user)
**Fichiers** : `src/js/pages/offers.js`, `src/css/style.css`, `src/pages/index.html`, `src/js/landing-i18n.js`, `src/pages/app.html`

User voulait le lifetime en **carte à côté des offres**, pas en bande dessous. Remplacé la bande par une 3ᵉ carte :
- **App (offers.js)** : `cardLifetime` (badge « À VIE » violet, 299,90 €/une fois, « Sans abonnement · illimité »,
  features Elite-à-vie, CTA `#lifetimeCta`). Grille `.pricing-cards` 2→3 colonnes (max-width 1100). Bande supprimée. CSS `.pricing-badge-lifetime` + `.lifetime-card` (bordure violette).
- **Landing (index.html)** : 3ᵉ `.price-card` lifetime (mirroir d'Elite, prix unique, badge violet). La grille landing.css était déjà `repeat(3,1fr)` → 0 CSS à toucher. Bande supprimée. Clés `pricing.lifetime.*` (badge/unit/tagline/desc/f1-5, FR+EN) ; cta → « Accès à vie ». Bump offers.js h=3 + style.css h=13 + landing-i18n h=10.

### Vérifié (staging)
App + landing → 3 cartes [Funded · Elite · Lifetime], lifetime 299,90 €/une fois, badge violet, layout propre.

## 2026-06-11 — v1.0.5 (staging) — Lifetime sur la landing + purge copie « no card » (pivot)

**Type** : feat + fix copie
**Fichiers** : `src/pages/index.html`, `src/js/landing-i18n.js`, `src/js/i18n.js`, `src/pages/app.html`

- **Landing** : ajout de la **bande lifetime** (sous les cartes Funded/Elite) → « Ou l'accès à vie · 299,90 € · à vie · sans abonnement », CTA `/app?signup=1&plan=lifetime`. Styles inline (la landing a son CSS à part). Clés `pricing.lifetime.*` (FR+EN) dans landing-i18n.js.
- **FIX contradiction du pivot** : le modèle est passé en CARTE OBLIGATOIRE, mais la copie disait encore
  « sans CB / no credit card / sans carte » (faux + risqué légalement). Purgé partout → « annulation en 1 clic /
  sans engagement / cancel anytime » : `pricing.sub`, `pricing.reassure`, `hero.cta.nocard`, `midcta.cta`
  (landing-i18n + fallbacks index.html), `off.trust.nocb` (app i18n FR+EN), JSON-LD. Bump landing-i18n h=9 + i18n h=6.

### Vérifié (staging)
Landing : bande lifetime affichée, sous-titre « Essai 14 jours. Annulation en 1 clic… », **0 mention « no card »**.

## 2026-06-11 — v1.0.5 (staging) — Lifetime 299,90€ (one-shot) + Stripe TEST câblé

**Type** : feat
**Fichiers** : `functions/index.js`, `src/js/pages/offers.js`, `src/css/style.css`, `src/pages/app.html`

### Lifetime (paiement unique)
- **`createCheckoutSession`** : branche `plan==='lifetime'` → Stripe `mode:'payment'` (one-shot), prix
  `STRIPE_PRICE_LIFETIME`, **sans coupon ZELD** (`allow_promotion_codes:false` — réservé aux abos). Vérifié : session mode=payment, 299,90€, aucun abonnement.
- **`stripeWebhook` checkout.session.completed** : si `mode==='payment'` (ou `metadata.kind==='lifetime'`)
  → accès À VIE = `plan:pro, tier:beta, lifetime:true` (illimité ; marqueur pour fair-use 300 IA/mois à venir).
- **Offres** (`offers.js`) : bande lifetime « 299,90 € · à vie · sans abonnement » + handler dédié (one-shot, hors logique abo/portail). CSS `.lifetime-band`. Bump offers.js h=2 + style.css h=11.

### Stripe TEST staging (câblé, via API avec la clé TEST de l'user)
- `STRIPE_SECRET_KEY` v2 (clé TEST réelle). 4 prix TEST créés (Funded 14,99/89 · Elite 29,99/179) + `STRIPE_PRICE_LIFETIME` (299,90). Webhook TEST créé (6 events) + secret posé (ancien doublon supprimé).
- Vérifié : 4 plans abo → checkout 200 (essai 14j) ; lifetime → checkout 200 (one-shot 299,90€).

## 2026-06-10 — v1.0.5 (staging) — Essai 14j · copie i18n (7j→14j, retrait « gratuit à vie »)

**Type** : copy/i18n
**Fichiers** : `src/js/landing-i18n.js`, `src/js/i18n.js`, `src/pages/index.html`, `src/pages/app.html`

Mise en cohérence de toute la copie avec le modèle (essai 14j, plus de gratuit) :
- **landing-i18n.js** (FR+EN) : promo.text, pricing.sub (« gratuit à vie » → « essai 14j sans CB »),
  pricing.reassure/discount/funded.cta/elite.cta → « 14 jours / 14-day ».
- **i18n.js** (app, FR+EN) : off.trial + off.trust.trial → 14j ; off.funded.f1 « Tout le plan Trader inclus »
  → « Toutes les bases : journal, dashboard, analytics ».
- **index.html** : fallbacks hardcodés 7j→14j + sous-titre ; **JSON-LD : offre Trader 0€ retirée** (SEO).
- Bump landing-i18n h=8 + i18n h=5. (Clés `pricing.trader.*` devenues mortes — inoffensives, laissées.)

### Vérifié (staging)
Landing FR/EN + app offers → « 14 jours / 14-day » partout, 0 mention « gratuit à vie / 7 jours ».

## 2026-06-10 — v1.0.5 (staging) — Essai 14j · M4 (2/2) : retrait STRUCTUREL du tier gratuit

**Type** : feat
**Fichiers** : `src/js/pages/offers.js`, `src/pages/index.html`, `src/css/style.css`, `src/pages/app.html`

- **offers.js** (app) : carte TRADER retirée (`bT`/`cardTrader` supprimés), grille 3→2 cartes
  (Funded + Elite). Colonne « Trader » retirée du tableau comparatif (header + lignes).
  Résiliation toujours possible via portail Stripe (Réglages). 
- **index.html** (landing) : carte `[TRADER]` (0 €) retirée de `.pricing-grid` (suppression sûre par
  plage vérifiée). Reste 2 cartes.
- **CSS** : `.pricing-cards` repeat(3)→repeat(2) max-width 1080→760 ; `.offer-compare-row` 4→3 colonnes.
  Bump offers.js h=1 + style.css h=10.
- Le tier `trader` reste EN INTERNE = état « expiré/verrouillé » derrière le paywall (jamais offert).

### Vérifié (staging)
App offers + landing → 2 cartes (Funded/Elite), comparatif 3 colonnes, layout centré propre.

### Reste (copie + migration)
- **i18n** (FR+EN) : « Trader gratuit à vie » (pricing.sub), « 7 jours/7-day/1 semaine » → **14 jours**
  (pricing.discount/reassure/cta, off.trial…), « Tout le plan Trader inclus » (off.funded.f1), JSON-LD Trader (index.html:100).
- **M5** : migration des gratuits existants (CF : trialEnd = J+14).

## 2026-06-10 — v1.0.5 (staging) — Essai 14j · M4 (1/2) : inscription→essai + retrait essai Stripe 7j

**Type** : feat
**Fichiers** : `functions/index.js`

- **`notifyNewSignup`** : pose `trialEnd = +14j` sur le doc plan à l'inscription (après le flag
  d'idempotence + la vérif creationTime < 5 min → 1× par compte ; idempotent : ne touche pas si déjà
  pro/trialEnd). CF-only (Admin SDK) → le client ne peut pas s'octroyer un essai. syncProClaim → claim pro.
- **`createCheckoutSession`** : retrait de `trial_period_days: 7` (l'essai 14j sans CB le remplace ;
  sinon converti = 14+7 = 21j gratuits). `allow_promotion_codes` conservé (coupon ZELD).

### Vérifié (staging)
Compte frais → notifyNewSignup → plan.trialEnd = +14j, claim pro=true. (Reste M4 2/2 : retrait visuel du gratuit offers/landing.)

## 2026-06-10 — v1.0.5 (staging) — Essai 14j · M3 : mur de fin d'essai + bannière

**Type** : feat
**Fichiers** : `src/js/app-bootstrap.js`, `src/css/style.css`, `src/pages/app.html`

### M3 — UX essai/expiré
- `_renderAccessGate()` (app-bootstrap) : idempotent, appelé au reveal + à chaque `store:planChanged`.
  - `getAccessState()==='trialing'` → **bannière** « Essai gratuit · X jour(s) restant(s) · Voir les offres » (insérée sous la topbar).
  - `getAccessState()==='expired'` → **mur** plein écran (overlay z-5000, blur) : « Ton essai est terminé », CTA rempli « Voir les offres » + « Se déconnecter ». Données conservées.
  - sinon → retire bannière/mur.
- Remplace le bloc MORT `expireAffiliateTrial` (l.395 — la CF n'existe pas, appel avalé par .catch ; `trialEnd` n'était posé nulle part). FR/EN inline (pattern Éco).
- CSS `.trial-banner` + `.paywall-*` (vars thème ; CTA `background:var(--accent);color:var(--on-accent)` → rempli/lisible dans les 2 thèmes). Bump app-bootstrap h=7 + style.css h=9.

### Landmines rencontrées
- `if (!window.Store ...)` sortait tôt : `Store` est un global lexical (`const`), pas `window.Store` → garde corrigé en `typeof Store`.
- CTA d'abord invisible (`color:#fff` en dur sur `--accent` blanc) puis contouré → fixé via `var(--on-accent)`.

### Vérifié (staging)
gratuit + essai actif → bannière 14j ; gratuit + trialEnd passé → mur plein écran, CTA rempli (bg #fff, texte #000 en dark). 0 erreur.

## 2026-06-10 — v1.0.5 (staging) — Audit UI/UX + fix cibles tactiles (🔴 du go-live)

**Type** : fix (accessibilité / tactile)
**Fichiers** : `src/css/style.css`, `src/pages/app.html`

Audit UI/UX complet (Playwright, desktop+mobile, compte VIP). Bons fondamentaux (0 h-scroll, zoom
autorisé, 0 img sans alt, 0 bouton-icône sans label). Fix du seul point 🔴 (cibles tactiles <44px) :
- `.new-trade-btn` 39→44px (`min-height`) · `.focus-scope-select` 33→40px · `.user-logout-btn` 19→40×40px
  (padding+min-dims+center) · `.hamburger-btn` 32→44px. Vérifié staging. Bump style.css h=6.
- Reporté (non bloquant) : micro-labels 9px (motif design, bump risqué), bulle support flottante mobile.
Étude complète (inachevés + gaps concurrents + checklist go-live) sauvegardée → mémoire project_golive_roadmap.

## 2026-06-10 — v1.0.5 (staging, WIP) — Essai 14j sans CB · Milestone 1 : fondation client

**Type** : feat (chantier modèle commercial — décision : 100% payant + essai 14j, suppression du gratuit)
**Fichiers** : `src/js/store.js`, `src/pages/app.html`

### Contexte
Passage au modèle 100% payant + essai 14j sans carte (cf. [[project_launch_offers]]). Build par
milestones sur staging, Stripe TEST, validation E2E avant toute prod.

### M1 — fondation client (additive, NON cassante)
- `store.js` : parse `trialEnd` (ms) dans le doc `plan` (whitelist). Helpers : `isTrialActive()`,
  `trialDaysLeft()`, `getAccessState()` ('paid'|'trialing'|'expired'|'none'), `_effectiveTier()`.
- Un essai ACTIF → tier effectif = `funded` → `getLimits()`/`canUseFeature()` accordent Funded ;
  badge « ESSAI ». `getTier()` reste = tier stocké (vérité serveur). Exporté + bump store.js h=6.

### Vérifié (staging)
gratuit@test.com + trialEnd+14j → access=trialing, badge=ESSAI, maxAccounts=10, econCal/groups=true,
tier reste 'trader'. demo (VIP) inchangé. Users sans trialEnd = comportement identique à avant.

### Reste (prochains milestones)
M2 ✅ **CF fait** (helper `_effectiveTier`/`_trialActive` → analyzeChart quota+Claude + getEconCalendar accordent Funded si essai actif ; vérifié staging : gratuit+essai → getEconCalendar 200/75 events) . **Rules ✅** : helper `planEntitled(userId)` (pro OU essai actif via `trialEnd`) appliqué aux comptes (≤100) + groupes ; `syncProClaim` pose le claim `pro` si essai actif → uploads storage OK (les storage.rules ne lisent pas Firestore). Vérifié staging : essai écrit 2 comptes (200) + claim pro=true. **M2 COMPLET.** · M3 paywall fin d'essai + bannière jours restants ·
M4 retrait tier gratuit (signup/offers/landing) + retrait essai Stripe 7j-CB · M5 migration existants
(trialEnd=cutover+14j) · M6 E2E Stripe TEST → puis proposer prod.

## 2026-06-10 — v1.0.4 (staging) — FIX calendrier + heatmap cassés (collision de classe .cal-cell)

**Type** : fix (bug visuel, présent en prod)
**Fichiers** : `src/js/pages/dashboard.js`, `src/css/style.css`, `src/pages/app.html`

### Bug
Page Calendrier ET heatmap P&L du Dashboard s'affichaient en **barres verticales** (cellules
~18×72px au lieu de cases). Cause : **collision de classe** — le calendrier des trades
(`.cal-cell { min-height:72px }`, ligne ~3246) et la heatmap dashboard
(`.cal-cell { width:14px; height:14px }`, ligne ~5690) partageaient la même classe `.cal-cell`.
La cascade contaminait les deux : `min-height:72px` rendait les cases heatmap hautes, et
`width:14px` écrasait la largeur des cases du calendrier (grille repeat(7,1fr) cassée).

### Fix
Classes heatmap renommées pour les découpler : `.cal-cell`/`.cal-cell-empty` → `.cal-hm-cell`/
`.cal-hm-cell-empty` (dashboard.js rendu + style.css). Couleurs heatmap = style inline → non
affectées. Le calendrier des trades garde `.cal-cell` (intact). Bump dashboard.js h=1 + style.css h=5.

### Vérifié (staging)
Calendrier : cellule 164×72px (était 18×72) — month grid correct, jours colorés. Heatmap : 14×14px. 0 erreur.

### ⚠️ Prod
Bug présent en prod (même lignée de code). Fix prêt sur `recover-prod-landing`, **non déployé** (attend go user).

## 2026-06-10 — v1.0.4 (staging) — Calendrier natif : colonnes alignées (refonte affichage valeurs)

**Type** : style/UX
**Fichiers** : `src/js/app.js`, `src/css/style.css`, `src/pages/app.html`

### Contexte
Les valeurs Prév/Préc flottaient à droite avec labels inline (`.ecal-fx`/`.fxi`) → rien ne
s'alignait d'une ligne à l'autre (« brouillon »).

### Changements
- `.ecal-row` (+ nouvelle `.ecal-head`) passent en **CSS grid** colonnes fixes :
  `48px 12px 40px minmax(0,1fr) 78px 92px` (time · dot · devise · event · Prév · Préc).
- Ligne d'**en-têtes** (PRÉV / PRÉC) alignée sur la même grille. Valeurs `.ecal-val`
  right-aligned + `tabular-nums` → alignement vertical parfait. Labels inline supprimés.
- `renderEcon`/`_ecalInit` : rendu en 2 cellules valeur (fcst/prev) au lieu des segments `.fxi`.
- Mobile (≤640px) : colonnes resserrées (au lieu de masquer les valeurs). Bump app.js h=15 + style.css h=4.

### Vérifié (staging)
En-tête présent, 75 lignes, **colonne Préc alignée (1 seule position left = 1316px)**, 0 erreur.
Slot « Réel » (actual) à ajouter comme 3ᵉ colonne quand source payante.

## 2026-06-10 — v1.0.4 (staging) — Retour au calendrier natif (widget TradingView parké)

**Type** : revert (décision user)
**Fichiers** : `src/js/app.js`, `src/pages/app.html`

### Contexte
Recherche actuals (cf. entrée suivante) : aucune API gratuite, les payantes = 22-60 $/mois
(FMP Starter / EODHD confirmé). Décision user : rester sur le calendrier NATIF (notre design)
sans actuals en attendant d'avoir du budget pour une API payante.

### Changements
- `renderEcon` (Funded+) : revient au rendu natif (`_ecalInit` : impact/Prév/Préc, filtres
  période/impact/devise). Le widget TradingView (`_tvEconInit`) est PARKÉ (non appelé, conservé
  pour revival). CSP `www.tradingview-widget.com` gardée (revival sans re-toucher la CSP).
- Gating Funded+ inchangé (free → upsell). Bump app.js h=14.

### Vérifié (staging)
VIP → calendrier natif 16 lignes, pas de widget TV, 0 erreur · gratuit → upsell, 0 calendrier.

### Plus tard (actuals)
Brancher FMP Starter (22 $/mois, à confirmer que le calendrier y est) ou EODHD (60 $/mois,
confirmé : actual/estimate/previous) dans `getEconCalendar` → le slot « Réel » s'affiche. ~2-3 h.

## 2026-06-10 — v1.0.4 (staging) — Calendrier éco : widget TradingView (ACTUALS en temps réel)

**Type** : feat
**Fichiers** : `src/js/app.js`, `firebase.json`, `src/pages/app.html`

### Contexte
User voulait l'« actual » (valeur réelle) comme sur investing.com. Aucune source gratuite ne le
donne en API (FMP/Finnhub/TE = payant ; JBlanked free = 1 req/jour → actual décalé d'un jour).
Décision user (AskUserQuestion) : **widget tiers (live)**. Choix du widget : TradingView (thème
sombre raccord à l'app, domaines déjà en CSP) plutôt qu'investing.com (clair + nouvelle CSP).

### Changements
- **app.js `renderEcon`** : pour Funded+, le calendrier natif est remplacé par le widget
  « events » TradingView (`_tvEconInit`) — actual/forecast/previous en temps réel, color-codés,
  thème suivant `data-theme`, locale FR/EN, countryFilter G10+CN, importance medium+high.
  Le loader (`s3.tradingview.com/external-embedding/embed-widget-events.js`) est créé via
  `createElement` (innerHTML n'exécute pas les `<script>`). Le rendu natif `_ecalInit` +
  CF `getEconCalendar` sont CONSERVÉS mais non appelés (revival possible).
- **CSP** (firebase.json + meta app.html) : ajout `https://www.tradingview-widget.com` au
  `frame-src` (domaine de l'iframe du widget). `script-src s3.tradingview.com` déjà présent.
- Gating inchangé : widget réservé Funded+ (free → upsell). Gating front (le widget est un
  embed public TradingView, aucune ressource serveur à protéger → pas besoin d'enforce serveur).

### Vérifié (staging, Chromium)
- iframe chargée depuis `www.tradingview-widget.com`, **0 violation CSP, 0 erreur console**.
- Events affichés avec 3 valeurs : ex. « Core CPI MM 0,2 % / 0,3 % / 0,4 % » = **identique à
  investing.com** (actual 0,2 % en rouge). Thème sombre, locale FR.
- ⚠️ NON testé sur Safari (Playwright = Chromium) → landmine ITP widgets tiers : à confirmer par l'user.

## 2026-06-10 — v1.0.4 (staging) — Calendrier éco = perk PAYANT (Funded+), plus d'accès gratuit

**Type** : feat (gating)
**Fichiers** : `functions/index.js`, `src/js/store.js`, `src/js/i18n.js`, `src/js/app.js`, `src/pages/app.html`

### Contexte
Demande user : le tier gratuit (Trader) ne doit PLUS avoir accès au calendrier économique.
La feature `fjNews` était orpheline depuis le retrait des news → renommée `econCal` et
repurposée pour gater le calendrier.

### Changements
- **store.js** : `fjNews` → `econCal` dans TIER_FEATURES (`['funded','elite','beta']`).
- **i18n.js** (FR+EN) : `tier.feat.fjNews` (« Financial Juice News ») → `tier.feat.econCal`
  (« Calendrier économique » / « Economic calendar »).
- **app.js** : `econCal` ajouté à la map du tier-recap (apparaît comme perk Funded+) ;
  `renderEcon` gate le calendrier → gratuit voit un upsell 🔒 « réservé Funded/Elite »
  (bouton → offres), Funded+ voit le calendrier. `_ecalInit` appelé QUE si `canUseFeature('econCal')`.
- **getEconCalendar** (CF) : gate serveur autoritaire
  `if (!['funded','elite','beta','admin'].includes(tier)) → permission-denied`.

### Vérifié (staging, 2 niveaux)
- CF : `gratuit@test.com` → **403 Upgrade required** · `demo@gmail.com` (VIP) → **200, 75 events**.
- Front : gratuit → upsell 🔒, **aucun appel getEconCalendar ne fuit** (gate avant l'appel) ;
  VIP → calendrier 16 lignes, 0 erreur console.

## 2026-06-10 — v1.0.4 (staging) — Onglet Éco = calendrier seul (news marchés retirées, demande user)

**Type** : feat
**Fichiers** : `src/js/app.js`, `src/pages/app.html`

### Contexte
La section « News marchés » plantait (« Impossible de charger ») sur le compte Admin de l'user
alors qu'elle marchait sur demo@gmail.com (cache app.js ou spécificité compte). L'user a décidé
de la RETIRER. L'onglet Éco = calendrier économique seul désormais.

### Changements
- `renderEcon` : section News supprimée (heading + filtres + host + upsell). Le calendrier
  économique (filtres période/impact/devise, vue Aujourd'hui défaut) reste. Code conservé :
  `_newsInit` (front) + CF `getMarketNews` (déployée, résiliente) → réactivation triviale.
- Feature gating `fjNews` et CF inchangés (juste plus rendus dans Éco).

### Vérifié
Calendrier 16 lignes · aucune section/titre news · 0 erreur console.

## 2026-06-10 — v1.0.4 (staging) — News marchés résilientes (fallback stale) + calendrier retiré

**Type** : fix + feat
**Fichiers** : `functions/index.js`, `src/js/app.js`, `src/pages/app.html`, `docs/TODO.md`

### Contexte
QA : « Impossible de charger les news » côté user, alors que la CF répondait 200 et que le rendu
marchait en navigateur frais → cache app.js périmé côté user. MAIS vrai trou : `getMarketNews`
n'avait aucun fallback — si BBC ET CNBC hoquettent en même temps (ou cold start + timeout),
l'utilisateur voyait l'erreur.

### Changements
- **`getMarketNews`** : cache 3 niveaux comme `getEconCalendar` — mémoire instance (5 min) →
  Firestore `publicStats/marketNews` (5 min, partagé/persistant) → fetch RSS. Sources RSS KO →
  sert le stale Firestore ≤ 24 h au lieu de throw 'unavailable'. Plus de « Impossible de charger »
  sur un hoquet transitoire des sources.
- **Calendrier économique retiré** de l'onglet Éco (demande user — feed FF sans « actual »,
  pas de source gratuite). Code conservé (`_ecalInit` non appelé + CF `getEconCalendar` déployée).
  Trello : ECON-CAL pour réactivation. L'onglet Éco = news seules pour l'instant.

### Vérifié
getMarketNews 200 · 30 items · écriture Firestore confirmée (cache partagé). News rendues 30/30
en navigateur, 0 erreur. Calendrier absent (0 élément).

## 2026-06-10 — v1.0.4 (staging) — Onglet Éco : calendrier économique natif + news filtrables

**Type** : feat
**Fichiers** : `functions/index.js`, `src/js/app.js`, `src/css/style.css`, `src/pages/app.html`

### Contexte
Refonte du module Éco : le calendrier était un widget TradingView tiers (non filtrable, script
externe) et les news une liste plate sans filtres (titres injectés NON échappés — XSS potentielle
depuis le flux RSS, corrigée ici).

### Choix de la source (recherche 2026)
- **Calendrier : feed JSON hebdo ForexFactory** (`nfs.faireconomy.media/ff_calendar_thisweek.json`)
  — gratuit, SANS clé API, champs impact (High/Medium/Low/Holiday) + devise + prévision/précédent.
  ⚠️ Limite éditeur : 2 téléchargements / 5 min / IP → cache serveur agressif obligatoire.
  Écartés : Alpha Vantage (25 req/jour), Polygon/Massive (payant), Finnhub (calendrier = premium).
- **News : RSS BBC/CNBC conservés** (sans clé) + tagging marché côté serveur.

### Changements
- **CF `getEconCalendar`** (tous tiers — le calendrier reste libre) : cache 3 niveaux —
  mémoire d'instance 30 min → Firestore `publicStats/econCalendar` 30 min (partagé, survit aux
  cold starts) → fetch FF. Détection de la page « Request Denied » (HTML ≠ JSON). Feed KO →
  sert le stale Firestore ≤ 8 jours. Normalisation + strip tags côté serveur.
- **CF `getMarketNews`** : décodage entités + strip tags serveur, liens https only, et `tags`
  marché par item (usd/eur/indices/gold/energy/crypto, regex sur titre). Gating Funded+ inchangé.
- **Front `renderEcon` réécrit** : calendrier natif groupé par jour (heure locale, aujourd'hui
  surligné, passé grisé, dots impact rouge/ambre/gris), filtres impact (segmented) + devise
  (select, options issues des données), persistés en localStorage. News : chips de filtre par
  marché + tags par item. TOUT contenu externe échappé (`UI.escHtml`). Widget TradingView et
  loader FinancialJuice supprimés (plan B = revert git si le feed FF meurt).
- CSS `.ecal-*` / `.news-tag` (vars existantes, dark/light), responsive ≤ 640 px.
- **Vue « Aujourd'hui » par défaut** (demande user) : filtre période Aujourd'hui/Toute la semaine
  (segmented, persisté `zt_ecal_day`), message vide contextuel qui suggère la vue semaine.

### Vérifié (smoke E2E staging)
75 événements · filtre High = 13/13 cohérent · filtre USD = USD/ALL only · 30 news, filtre
marché OK · 0 erreur console · 0 violation CSP.

## 2026-06-10 — v1.0.4 (staging) — Corrections revue finale GO/NO-GO (7 findings QA)

**Type** : fix
**Fichiers** : `functions/index.js`, `src/js/pages/settings.js`, `src/js/ui.js`, `src/js/app.js`, `src/js/store.js`, `src/js/modal.js`, `src/js/i18n.js`, `src/js/landing-contact.js`, `src/pages/index.html`, `src/pages/faq.html`, `src/pages/app.html`, `test/calc.test.js`, `scripts/setup-stripe-staging.js`

### Changements (1 commit par problème)
1. 🔴 **Checkout Stripe staging 500** : diagnostic = STRIPE_SECRET_KEY staging est un placeholder
   (`sk_test_*E_ME`) — PAS un bug de code (prod LIVE fonctionne). Au passage : `_wrapCF` loggue
   désormais TOUJOURS dans Cloud Logging (avant, Discord KO = erreur invisible).
   → `scripts/setup-stripe-staging.js` (clé TEST + 4 prix TEST + secrets) à lancer par l'user.
2. 🟠 **Export CSV non gaté Trader** : même verrou que le PDF (`canUseFeature('exportCsv')`) +
   clés i18n `set.export.csv.pro.only` FR/EN.
3. 🟠 **Le Journal ignorait le Focus** : `getFiltered()`/compteur/sélection post-suppression passent
   par `scopedTrades()` ; re-render au changement de Focus ; tooltip mis à jour.
4. 🟡 **Double-échappement notes/setup à la ré-édition** : `_sanitizeTrade` fait unescape→escape
   (idempotent) + le prefill d'édition dé-échappe (`Store.unescHtmlStore` exporté).
5. 🟡 **Test calc US30 périmé** : attendait l'ancien $5/pt — aligné sur v0.9.416 ($1/pt FTMO). 103/103 ✓.
6. 🟡 **Prix barré EN « / mois »** : wrappé `data-i18n="pricing.month"` (« / mo » en EN).
7. 🟡 **Badge « quota du jour »** → « quota de la semaine » (FR/EN) + fallback settings.js.
8. ℹ️ **landing-contact.js initialisait la PROD en dur** → staging pingait recordVisit/getPublicStats
   sur la prod (pollution stats). Détection staging ajoutée (même pattern que firebase.js).
9. ℹ️ Objectifs en lecture seule = by design (tracker auto des règles prop firm), pas un bug.

### À surveiller
- Stripe staging : lancer `STRIPE_TEST_KEY=sk_test_xxx node scripts/setup-stripe-staging.js` puis
  redéployer createCheckoutSession+stripeWebhook staging.
- Bug groupes (multi-sélection) toujours ouvert — tâche dédiée.

## 2026-06-10 — v1.0.4 (staging) — Fix faux « Compte supprimé » sur token expiré + langue FR/EN

**Type** : fix
**Fichiers** : `src/js/auth.js`, `src/js/i18n.js`, `src/pages/app.html`

### Contexte
QA (10/06) : après création rapide de comptes, la session a affiché « Compte supprimé » puis
logout — alors que le compte était bien vivant (vérifié via Admin SDK staging). Faux positif.

### Changements
- **auth.js** `isAccountGoneError()` : `auth/user-token-expired` (+ `TOKEN_EXPIRED` regex) RETIRÉ
  de la liste « compte supprimé ». Un token expiré = re-login normal, pas un écran alarmant
  « 🚫 Compte supprimé ». On ne garde que user-not-found / user-disabled / id-token-revoked /
  invalid-user-token.
- **i18n.js** (commit précédent même jour) : `?lang=` consommé one-shot (retiré de l'URL) —
  corrige le mélange FR/EN (badge/messages réanalyse).

### À surveiller
- Si un user signale encore un faux « Compte supprimé », regarder `invalid-user-token`/`id-token-revoked`.
- ⚠️ DEUX copies de la logique account-gone : `auth.js` (isAccountGoneError) ET `store.js`
  (_isAccountGoneError, fired par `fbSet` sur erreur d'écriture). Les deux corrigées (token-expired
  retiré) — onglet Réglages→Général déclenchait la modale via la copie store.js. À dédupliquer un jour.

## 2026-06-09 — v1.0.4 (staging) — Recovery prod→git + refonte offres (quota IA hebdo) + fixes IA/CSP

**Type** : recover + feat + fix
**Fichiers** : `src/js/store.js`, `functions/index.js`, `src/js/modal.js`, `src/js/ui.js`, `src/js/app.js`, `src/js/i18n.js`, `src/js/landing-i18n.js`, `src/js/pages/offers.js`, `src/js/pages/settings.js`, `src/js/app-bootstrap.js`, `src/pages/app.html`, `src/pages/index.html`, `firebase.json`
**Versions impactées** : front (v1.0.4 staging), CF `analyzeChart` + `adminGetMetrics` (staging)

### Contexte
Découverte critique : la prod servait v1.0.4 alors que git s'arrêtait à v1.0.3 — des semaines de
travail uncommitted ont été perdues localement par un `git restore` (08/06). Le site live restait
la seule copie. ⚠️ Dégât collatéral : les entrées CHANGELOG-DEV de mi-mai → 06/06 (non commitées)
ont été effacées par ce restore — irrécupérables.

### Changements
- **recover** : tout le déployable prod re-téléchargé depuis zeldtrade.com et commité
  (landing + 13 fichiers JS/CSS/HTML + 2 pages jamais trackées partner/partenaires).
  `firebase.json` reconstitué à la main (6 hashes CSP inline, domaines Trustpilot, 5 rewrites).
- **feat(offers)** : quota IA passe de /jour à /SEMAINE (clé = lundi, reset auto) —
  trader 2/sem · funded 7/sem · elite ∞. Funded 3→10 comptes. `AI_WEEKLY_CAP` serveur +
  `localWeekStart()`/`aiUsedThisWeek()` client. Copie alignée FR+EN partout (landing, offres,
  modale essai 7j, upsell J+2, FAQ, settings). Decoy pricing : Elite = carte featured.
- **fix(ia)** : ordre d'affichage SL → Entry → TP1 (pastilles détection + détail trade).
  Maverick retiré (déprécié Groq 20/02/2026 → 404 intermittent) ; Scout seul modèle vision,
  whitelist serveur purgée. Badge quota rafraîchi en live après analyse.
- **infra QA** : 3 comptes de test par tier (gratuit/funded/elite @test.com, staging),
  `scripts/create-tier-test-accounts.js`, chart de test outil position longue TV
  (`scripts/tests/assets/tv-chart-long.png`), script AB test fiabilisé (networkidle→domcontentloaded,
  tour/cookies neutralisés, vrais sélecteurs).

### À surveiller
- Release v1.0.4 prod (vendredi) : bump TOUS les ?v= + changelog public + procédure §4 CLAUDE.md.
- Abonnés Funded existants : 5 IA/j → 7/sem = baisse IA (mais +7 comptes) — grandfathering à trancher si abonnés actifs.
- Le quota hebdo serveur utilise la semaine UTC, le client la semaine locale (écart bénin de quelques heures au changement de semaine).

### Liens
- Branche `recover-prod-landing` (9+ commits), QA validé de bout en bout sur staging (rapports 09/06).

## 2026-05-16 — v0.9.173 — Désinscription newsletter 1-clic (RGPD) + fix toggle Réglages

**Type** : feature + fix
**Fichiers** : `functions/index.js` (CF unsubscribeNewsletter), `firebase.json` (rewrite /unsubscribe), `scripts/send-newsletter.js` (tokens HMAC + List-Unsubscribe headers), `scripts/news-v0.9.172.html` (placeholder {{UNSUB_URL}}), `src/css/style.css` (.switch flex fix), `src/app.html`, `src/index.html`, `src/js/pages/changelog.js`
**Versions impactées** : Cloud Function (v0.9.173 nouvelle `unsubscribeNewsletter`), front (v0.9.173), Hosting rewrite, Secret Manager (UNSUBSCRIBE_HMAC_KEY)

### Contexte
La désinscription newsletter actuelle renvoyait vers `zeldtrade.com/app` (page de login) → friction max + non-compliant avec RFC 8058 (one-click natif Gmail/Outlook). User signale aussi un bug visuel : le toggle "Notifications email" dans Réglages est étiré sur toute la ligne au lieu d'être un toggle compact 44×24px.

### Changements

**Désinscription 1-clic** (RGPD-compliant) :
- Nouveau secret Firebase `UNSUBSCRIBE_HMAC_KEY` (32 bytes hex random) pour signer les liens de désinscription.
- Nouvelle Cloud Function `unsubscribeNewsletter` (`onRequest`, public, `cors:true`) :
  - GET `?u=<uid>&t=<hmac>` → vérifie HMAC en temps constant, flip `userEmails/{uid}.newsletterOptIn = false`, retourne page HTML de confirmation
  - POST (RFC 8058 one-click) → idem, réponse 200 vide pour bouton natif Gmail/Outlook
  - Validation regex stricte : `uid` `[A-Za-z0-9]{1,128}`, `t` `[a-f0-9]{64}`
  - Audit log écrit (`newsletterUnsubscribe`)
  - Idempotent
- Rewrite Hosting : `/unsubscribe` → CF `unsubscribeNewsletter(europe-west1)`. URL finale propre : `https://zeldtrade.com/unsubscribe?u=...&t=...`
- Page HTML auto-suffisante (CSS inline, pas de JS, pas de fonts externes) avec design cohérent du site (carte centrée + icône ✓/✕ + CTA retour).

**Script `send-newsletter.js`** :
- Lit le secret HMAC depuis `~/.config/zeldtrade/unsubscribe_hmac` (chmod 600, doit matcher la valeur du secret Firebase).
- Helper `unsubUrlFor(uid)` génère le lien personnalisé par destinataire.
- Remplace `{{UNSUB_URL}}` dans le HTML par le lien personnalisé avant envoi.
- Ajoute les headers SMTP `List-Unsubscribe` (avec URL + mailto fallback) et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058).

**Template newsletter `news-v0.9.172.html`** :
- Lien footer "Se désinscrire" → utilise `{{UNSUB_URL}}` (remplacé par le script à l'envoi).
- Texte simplifié : "Se désinscrire en 1 clic".

**Fix toggle CSS** (`style.css:1588`) :
- Avant : `.switch { width: 44px; flex-shrink: 0 }` — mais `.settings-row label { flex: 1 }` matchait aussi `<label class="switch">` → `flex-grow: 1` hérité → toggle étiré.
- Après : `.switch { flex: 0 0 44px }` — explicit override de `flex-grow: 0` pour bloquer le stretch.

### Impact
- **RGPD** : conformité art. 7 (consentement révocable facilement) + ePrivacy (mécanisme de désinscription en 1 action). Aussi conforme au CASL canadien et au CAN-SPAM Act US si jamais on a des opt-ins de ces juridictions.
- **Délivrabilité** : les clients mail modernes (Gmail, Outlook, Apple Mail) affichent désormais un bouton natif "Désinscrire" → +1 sur le score de réputation expéditeur (Brevo + Gmail Postmaster).
- **Sécu** : impossible de désinscrire quelqu'un d'autre sans connaître le secret HMAC server-side.
- **UX Réglages** : toggle compact 44×24px au lieu d'un slider énorme.

### À surveiller
- Premier vrai test de la CF en prod : envoi d'un email à zeldtradepro@gmail.com + clic sur le lien de désinscription dans l'email → doit afficher la page de confirmation + flip Firestore.
- Si Gmail/Outlook affiche bien le bouton "Désinscrire" natif (peut prendre quelques jours pour que la réputation expéditeur soit assez bonne pour que les clients le proposent).
- Secret `UNSUBSCRIBE_HMAC_KEY` : la valeur doit être identique côté Firebase et côté `~/.config/zeldtrade/unsubscribe_hmac` sinon les tokens générés par le script seront rejetés par la CF.

### Liens
- RFC 8058 : https://datatracker.ietf.org/doc/html/rfc8058
- Release v0.9.173 via `bash scripts/release.sh v0.9.173` + `firebase deploy --only functions:unsubscribeNewsletter`.

---

## 2026-05-16 — v0.9.172 — Contact form refonte simple (B5 fixé + B6 ajouté)

**Type** : fix + feature
**Fichiers** : `functions/index.js` (sendContactMessage refactor), `src/js/contact.js` (refonte), `src/app.html` (form simplifié), `src/index.html` (section contact + Firebase SDK + JS inline), `src/js/pages/changelog.js`
**Versions impactées** : Cloud Function `sendContactMessage` (v0.9.172), front (v0.9.172)

### Contexte
Demande user explicite : refonte du contact dans l'app + ajout sur landing page. **Pas d'email, pas de captcha, juste pseudo + message → Discord**. Le contact form app était cassé depuis v0.9.161 (hCaptcha fail-closed) → B5. La landing n'avait que des `mailto:` → B6.

### Changements

**`functions/index.js`** :
- `_reserveContactSlot(docPath)` — généralisé pour accepter un chemin Firestore arbitraire (au lieu d'un uid). Permet bucketing par uid (auth) ou par IP (anonyme).
- `sendContactMessage` refactor complet — 2 modes :
  - **AUTH** : message lu, pseudo récupéré depuis `userEmails/{uid}.username` (fallback `User XXXXXX` si missing), throttle `users/{uid}/data/contactThrottle`, footer Discord `UID: ...`.
  - **ANONYME** (depuis landing) : `request.auth === null` accepté, pseudo dans `request.data.name` (validé `length >= 2`), IP bucketed via `parts[length-2]` du XFF (cf. v0.9.170), throttle `contactThrottleAnon/{ipId}`, footer Discord `IP: ...`.
- Retrait `HCAPTCHA_SECRET` des secrets du onCall (captcha supprimé). hCaptcha verifier conservé dans le code pour `notifyNewSignup` qui l'utilise encore.
- Pas d'email dans le payload, pas d'email dans l'embed Discord, pas d'email_verified check sur le mode anonyme.
- Embed Discord avec couleur différenciée : `BRAND` (violet) pour app, `INFO` (bleu) pour landing.

**`src/js/contact.js`** :
- Refonte complète. Plus de `cName`/`cEmail`/captcha. Juste lit `cMessage`, appelle `httpsCallable('sendContactMessage')({ message })`.
- Honeypot conservé (faux succès si rempli).
- Throttle client-side 60s gardé (UX, server-side primaire).

**`src/app.html`** :
- Form contact réduit à juste un textarea message + honeypot + bouton.
- Retirée la 2ème instance du widget `<div class="h-captcha">` qui était dans le form contact.

**`src/index.html`** (landing) :
- Nouvelle section `<section id="contact">` entre FAQ et footer — pseudo + message + bouton + état succès.
- CSS inline pour `.contact-box`, `.field`, `.send-btn`, `.success` (cohérent avec le design landing).
- CSP meta élargie : ajout `https://www.gstatic.com` dans `script-src` et tous les endpoints Firebase nécessaires dans `connect-src` (la CSP server-side de firebase.json reste plus stricte/autoritative en prod).
- Ajout Firebase SDK 10.12.4 `firebase-app-compat.js` + `firebase-functions-compat.js` depuis gstatic.
- Script inline : init Firebase + handler submit form (validation pseudo/message, throttle 60s client, appel CF, gestion erreurs).
- Liens "Demander un accès →" (pricing) et "Contact" (footer) pointent maintenant vers `#contact` au lieu de `mailto:`.

### Impact
- **Sécu** : pas de régression. Throttle 60s + maxInstances=5 + IP anti-spoofing (XFF parts[-2]) + honeypot = barrière anti-spam suffisante pour un volume MVP. Sans captcha = un peu plus exposé au bot spam que avant, mais Aaron juge le compromis OK (simplicité user prime).
- **UX** : contact passe de "remplir 3 champs + cocher captcha + envoyer" à "écrire message + clic envoyer" (1 champ pour l'app, 2 pour la landing). Réduit massivement la friction.
- **Légal** : pas d'email collecté = pas de traitement de donnée perso supplémentaire = simplifie compliance. Pseudo libre saisi par le user.
- **B5** : fixé (le hCaptcha qui était le bug est retiré).
- **B6** : fixé (form contact présent sur landing).

### À surveiller
- Spam sur le mode anonyme : si volume excessif, restaurer un captcha minimal (Turnstile invisible) ou serrer le throttle (passer à 5min/IP).
- Discord webhook `DISCORD_SUPPORT_WEBHOOK` doit être configuré (déjà OK car en place pour app contact pré-v0.9.172).
- `contactThrottleAnon/{ip}` : nouvelle collection Firestore. Pas de rules explicites — admin SDK bypass. Documenter quand on aura le temps.

### Liens
- B5/B6 dans `docs/TODO.md` (lignes 147-148).
- Release v0.9.172 via `bash scripts/release.sh v0.9.172` + `firebase deploy --only functions:sendContactMessage`.

---

## 2026-05-16 — v0.9.171 — Hardening admin (re-auth récente + rate-limits symétriques + CORS prod strict + SECURITY.md refonte)

**Type** : security
**Fichiers** : `functions/index.js`, `scripts/storage-cors-prod.json` (nouveau), `scripts/storage-cors-dev.json` (nouveau), `scripts/storage-cors.json` (supprimé), `docs/SECURITY.md` (refonte complète), `src/app.html`, `src/index.html`, `src/js/pages/changelog.js`
**Versions impactées** : Cloud Functions (v0.9.171), front (v0.9.171), Storage bucket CORS (config prod appliquée via gsutil)

### Contexte
Suite à l'audit complet 4 surfaces (rules / CFs / frontend / infra) de cet après-midi, traitement des findings 🟠 ÉLEVÉS :
- Pas de re-auth récente sur CFs admin destructives → fenêtre d'attaque longue si token volé.
- Rate-limit asymétrique : seul `generateProCode` était rate-limité (10/h), les autres CFs admin étaient illimitées.
- CORS Storage contenait `localhost` même en prod (faiblesse mineure, évitable).
- `docs/SECURITY.md` obsolète (parlait encore d'App Check abandonné v0.9.158, score 7.5/10 daté du 2026-05-14).

### Changements

**`functions/index.js`** :
- Helper centralisé `_assertAdmin(request, opts)` (constante `ADMIN_MAX_TOKEN_AGE_MIN = 60`) :
  - vérifie `request.auth` présent
  - vérifie `email === ADMIN_EMAIL && email_verified`
  - vérifie `(Date.now() - auth_time*1000) <= maxAgeMin * 60_000` → rejette si session > 60 min avec `permission-denied` "Session expirée"
- Helper `_assertAdminRateLimit(action, max)` : transaction Firestore atomique sur `adminRateLimit/{action}` (déduplique le pattern qui existait inline pour `generateProCode`).
- Application aux 6 CFs admin :
  - `deleteUserAccount` : `_assertAdmin` + rate-limit **5/h**
  - `generateProCode` : `_assertAdmin` + rate-limit **10/h** (helper remplace l'inline existant)
  - `revokeProCode` : `_assertAdmin` + rate-limit **10/h**
  - `createCheckoutSession` : `_assertAdmin` (pas de rate-limit explicite, déjà maxInstances=5)
  - `cleanupOrphanUserEmails` : `_assertAdmin` (manuel rare, pas de rate-limit nécessaire)
  - `adminMarkEmailVerified` : `_assertAdmin` + rate-limit **5/h**

**Storage CORS** :
- Suppression de `scripts/storage-cors.json` (config ambiguë dev/prod mixée).
- Création `scripts/storage-cors-prod.json` — 5 origines strict prod (zeldtrade.com, www., web.app, firebaseapp.com, github.io), méthodes GET/HEAD, maxAge 3600.
- Création `scripts/storage-cors-dev.json` — ajoute `http://localhost:5000` et `http://localhost:8080` pour dev local (à appliquer manuellement quand besoin via gsutil).
- Config prod appliquée : `gsutil cors set scripts/storage-cors-prod.json gs://zeldtrade.firebasestorage.app` → vérifié OK.

**`docs/SECURITY.md`** :
- Refonte complète. Ancien doc supprimait beaucoup d'éléments obsolètes (App Check, exceptions résolues, score périmé).
- Nouveau doc : modèle de menace inchangé, défenses tabulées par domaine (auth, autorisation, anti-injection, anti-abuse, RGPD, CFs hardening, infra), exceptions et trade-offs documentés (App Check abandonné, repo public, email admin hardcodé, firebase-functions@4, SA default Editor, logs Discord UIDs).
- Score sécu : 7.5/10 → **8.5-9/10**.

### Impact
- **Sécu** : ferme la fenêtre d'attaque longue durée sur les CFs admin (auth_time check). Limite la destruction de masse (rate-limits symétriques). Réduit la surface CORS prod. Posture admin chain : 7.5/10 → 9/10.
- **UX admin** : si la session admin a > 60 min, les actions destructives demandent un re-login. Solution : Firebase Console → reset password, ou logout/login. Non-bloquant pour usage normal (l'admin re-login souvent).
- **Dev local** : le dev local ne pourra plus lire les screenshots Storage tant que la config dev n'est pas réappliquée. Solution : `gsutil cors set scripts/storage-cors-dev.json gs://zeldtrade.firebasestorage.app` avant session de dev local.

### À surveiller
- Les 4 docs `adminRateLimit/{action}` vont apparaître dans Firestore (createCheckoutSession exclu, généré on-demand par les helpers).
- Si un admin reçoit "Session expirée (>60min)" alors qu'il vient juste de login : vérifier que `auth_time` du token est bien à jour (potentiel bug Firebase Auth iOS/Safari).
- Faux positifs sur `auth_time` : si `request.auth.token.auth_time` est `undefined` (cas anormal), le check `authTimeMs > 0` skip la validation → fail-open. Acceptable car les autres checks (email + email_verified) restent stricts.

### Liens
- Audit complet : conversation 2026-05-16 (4 agents Explore parallèles).
- Release v0.9.171 via `bash scripts/release.sh v0.9.171` + `firebase deploy --only functions`.

---

## 2026-05-16 — Supply chain audit : nodemailer HIGH fixé, 8 LOW bloqués upstream

**Type** : security
**Fichiers** : `scripts/package.json`, `functions/package.json`, `functions/package-lock.json`, `.gitignore`
**Versions impactées** : aucun bump release (changements deps internes uniquement)

### Contexte
GitHub Dependabot signalait 5 vulnérabilités sur le repo (1 HIGH, 2 moderate, 2 low). Audit local via `npm audit` dans les 2 codebases :
- `scripts/` : **1 HIGH** sur `nodemailer < 8.0.4` (4 CVE incluant SMTP command injection via envelope.size + via CRLF in transport name)
- `functions/` : **8 LOW** transitives via `firebase-admin@12 → @google-cloud/storage@7 → teeny-request@9 → http-proxy-agent@5 → @tootallnate/once@2.0.1` (CVSS 3.3, "Incorrect Control Flow Scoping", AV:L = local only)

### Changements
- **`scripts/package.json`** : `nodemailer ^6.9.0` → `^8.0.7`. API stable entre v6 et v8 sur `createTransport()` + `sendMail()` (notre seul usage). 0 vulns après upgrade.
- **`functions/package.json`** : bumped `firebase-admin ^12.0.0` → `^12.7.0` (npm install auto, version mineure). Tentative `firebase-admin@13.10.0` ANNULÉE — conflit peer dep `firebase-functions@4.9.0` requiert `firebase-admin ^10 || ^11 || ^12`. Le déploiement avec @13 a échoué proprement (Cloud Build npm install rejected), aucune fonction modifiée en prod. Reverté à @12.
- **`.gitignore`** : ajout `firebase-debug.log` + `firebase-debug.*.log` (générés par `firebase deploy` en cas d'échec, ne pas commit).

### Impact
- **Sécu** : HIGH résolue (newsletter SMTP injection blocked). 8 LOW restent — risque concret quasi nul :
  - Severity LOW (CVSS 3.3), exploitable seulement en attaque locale (AV:L), pas via réseau.
  - Notre code ne fait aucun appel direct à `@tootallnate/once` ou `http-proxy-agent` (transitives uniquement, utilisées par `@google-cloud/storage` pour des proxies HTTP que nous n'utilisons pas — nous lisons Storage via Firebase SDK qui passe par HTTPS direct).
  - Exécution serveur dans une sandbox Cloud Run isolée (pas de filesystem partagé exploitable).
- **Pas de breaking change client/serveur** : `firebase-admin@12.7.0` API identique à @12.0.0 (patch versions).

### Plan de remédiation des 8 LOW (futur)
Bloqué par `firebase-functions@4` (deprecated, EOL). Pour pouvoir bumper `firebase-admin → @13` (qui éliminerait la chaîne vulnérable), il faut :
1. Migrer `firebase-functions@4.9.0` → `@7.x` (major bump avec breaking changes : imports, callable API, secrets binding).
2. Tester intégralement toutes les CFs (`analyzeChart`, `sendContactMessage`, `notifyNewSignup`, `deleteUserAccount`, `generateProCode`, `revokeProCode`, `createCheckoutSession`, `stripeWebhook`, `adminMarkEmailVerified`, `cleanupOrphanUserEmails`).
3. Bumper `firebase-admin → @13`.
À planifier comme tâche dédiée post-MVP (3-4h estimé), pas critique.

### Liens
- HIGH advisory : https://github.com/advisories/GHSA-c7w3-x93f-qmm8 (nodemailer SMTP command injection)
- LOW advisory : https://github.com/advisories/GHSA-vpq2-c234-7xj6 (@tootallnate/once)
- Pas de release frontend (pas de changement user-facing).

---

## 2026-05-16 — v0.9.170 — Anti IP-spoofing renforcé sur analyzeChart

**Type** : security + fix
**Fichiers** : `functions/index.js`, `src/app.html`, `src/index.html`, `src/js/pages/changelog.js`
**Versions impactées** : Cloud Functions (v0.9.170), front (v0.9.170)

### Contexte
Audit sécurité post-v0.9.169 (4 agents parallèles) a identifié comme finding **CRITIQUE** que le fallback IP rate-limit sur `analyzeChart` était contournable. L'ancien code (`v0.9.161`) faisait `ip = parts[0]` du header `X-Forwarded-For`. Or `parts[0]` est entièrement contrôlable par le client : un attaquant peut envoyer un XFF custom avec une IP différente à chaque requête, ce qui crée un bucket différent dans Firestore `ipRateLimit/{ip}` et **bypass le quota de 5 min**.

Sur Firebase Functions Gen 2 (Cloud Run derrière Google HTTPS LB), le format réel du XFF reçu côté CF est :
```
<client-spoofable>, <proxies-spoofables>, <google-lb-ip>
```
- La **dernière** IP est ajoutée par le LB Google côté infra → trustée mais inutile (toujours la même).
- L'**avant-dernière** est l'IP que le LB Google a vue se connecter à lui → **vraie IP client** (ou son dernier proxy public), **non forgeable** par le client.
- Les premières peuvent être forgées librement.

### Changements
- `functions/index.js:121-133` : nouvelle logique
  ```js
  if (parts.length >= 2) {
    ip = parts[parts.length - 2];  // IP trustée (vue par LB Google)
  } else if (parts.length === 1) {
    ip = parts[0];  // fallback cas anormal
  }
  ```
- Commentaire détaillé ajouté pour documenter le rationale (anti-régression).
- Bump version 0.9.169 → 0.9.170 sur tout le front (cache-bust + Settings + footer + changelog.js).

### Impact
- **Sécu** : ferme un bypass anti-DoS sur l'endpoint Groq (le plus coûteux financièrement). Combiné aux défenses existantes (Turnstile primaire, quotas per-user, email_verified, auth Firebase), la surface d'abus sur Groq devient ~nulle pour un attaquant non-authentifié.
- **UX** : aucun changement visible côté user. Les vrais utilisateurs continuent d'être bucketés correctement.
- **Faux positifs** : un user derrière un proxy résidentiel ou VPN sera bucketé sur l'IP du proxy/VPN (comportement normal d'un rate-limit IP).

### À surveiller
- Cas edge : si Google LB change un jour le format XFF (peu probable), le rate-limit reverrait sur 'unknown' pour tous → toléré (best-effort).
- Si on voit des `[analyzeChart] suspect X-Forwarded-For chain length` en logs : à investiguer (mais désormais le bucket dépend de parts[-2], donc pas un bypass).

### Liens
- Audit complet : conversation 2026-05-16 (4 agents Explore parallèles, 4 surfaces : rules / CFs / frontend / infra).
- Release v0.9.170 via `bash scripts/release.sh v0.9.170` + `firebase deploy --only functions`.

---

## 2026-05-16 — v0.9.169 — Export PDF : 1 page par trade chronologique + fix CORS Storage

**Type** : feat + fix
**Fichiers** : `src/js/pages/export-pdf.js`, `scripts/storage-cors.json` (nouveau), `src/app.html`, `src/index.html`, `src/js/pages/changelog.js`
**Versions impactées** : front (v0.9.169), Storage bucket CORS (appliqué via gsutil)

### Contexte
Depuis l'ajout des screenshots dans le PDF (v0.9.166-168), deux problèmes restaient :
1. Firebase Storage bucket sans config CORS → `img.crossOrigin = 'anonymous'` échouait → screenshots non embarqués (séparateur affiché mais aucune page screenshot derrière).
2. User demandait une structure plus simple : 1 page par trade dans l'ordre chronologique, screenshot intégré quand présent, plutôt qu'une liste compacte + section screenshots séparée.

### Changements
- **CORS Storage** : créé `scripts/storage-cors.json` avec whitelist (`zeldtrade.com`, `www.zeldtrade.com`, `*.web.app`, `*.firebaseapp.com`, `zeldaron.github.io`, `localhost:5000`, `localhost:8080`), méthodes `GET`/`HEAD`, `Content-Type` + `Access-Control-Allow-Origin` exposés, maxAge 3600. Appliqué via `gsutil cors set scripts/storage-cors.json gs://zeldtrade.firebasestorage.app`.
- **Refonte PDF** (`export-pdf.js`) :
  - Suppression de `_drawTradesPage()` (liste compacte ~6 trades/page).
  - Suppression de la page séparateur "Screenshots des trades".
  - Renommage `_drawTradeScreenshotPage` → `_drawTradeDetailPage` qui gère `imgDataUrl === null` (affiche "Aucun screenshot pour ce trade.").
  - Ajout argument `indexLabel` au header : "Trade N/total".
  - Tri changé : `_tradeMs(a) - _tradeMs(b)` (chronologique ascendant, du plus ancien au plus récent) au lieu de descendant.
  - Nouvelle boucle dans `generate()` : pour chaque trade, fetch optionnel du screenshot puis 1 page détail. `progress({ phase: 'trades', current, total })` au lieu de `screenshots`.
- Bump version 0.9.168 → 0.9.169 (`src/app.html` cache-busts + version Settings, `src/index.html` footer, entrée changelog.js).

### Impact
- **UX** : PDF plus lisible — 1 page par trade avec toutes les infos (date, instrument, direction, levels, P&L, R:R, setup, notes, screenshot) au lieu de devoir naviguer entre une liste compacte et une section screenshot séparée. Ordre chronologique respecte l'usage attendu d'un journal de trading.
- **Sécu** : pas d'impact négatif. CORS sur Storage limite les origines à notre domaine + dev → empêche d'autres sites de hotlinker les screenshots des users (n'était pas une protection avant car URLs signées, mais ça réduit la surface).
- **Perf** : potentiellement plus de pages dans le PDF si beaucoup de trades (1 page chacun au lieu de 6/page). Fetch screenshot reste séquentiel — un user avec 50 trades + screenshots verrait ~50s d'attente sur connexion moyenne. À monitorer.

### À surveiller
- Cas avec 100+ trades : taille PDF + temps de génération.
- Trades sans screenshot : la page affiche bien le fallback texte.
- Cache navigateur : forcer `Cmd+Shift+R` après deploy car bump `?v=` ne couvre pas les images Storage.

### Liens
- Commit à venir, release v0.9.169 via `bash scripts/release.sh v0.9.169`.

---

## 2026-05-15 — v0.9.147 — URLs propres (cleanUrls Firebase Hosting)

**Type** : ux / polish
**Fichiers** : `firebase.json` (cleanUrls: true), `src/*.html` (href update), `src/js/pages/offers.js`, `src/js/app.js`, `src/js/pages/settings.js`, `src/robots.txt`, `src/js/pages/changelog.js`, bump v=0.9.147

### Contexte
User : "comment faire pour que quand je clique sur un onglet ça ne me met pas .html derrière les fichiers ?". Firebase Hosting supporte `cleanUrls: true` qui strippe le `.html` des URLs servies + redirige `.html` → clean.

### Changements
- **`firebase.json`** : `cleanUrls: false` → `true`
- **Tous les `href`** mis à jour via `sed` cross-fichier :
  - `href="index.html"` → `href="/"`
  - `href="app.html"` → `href="/app"`
  - `href="admin.html"` → `href="/admin"`
  - `href="cgu.html"` → `href="/cgu"`
  - `href="legal.html"` → `href="/legal"`
  - `href="privacy.html"` → `href="/privacy"`
  - `href="payment.html"` → `href="/payment"`
- **JS routing** : `location.href = 'index.html'` → `location.href = '/'` (app.js logout x2, settings.js delete account)
- **`og:url`** app.html : `/app.html` → `/app`
- **`robots.txt`** : conserve les 2 patterns par défense en profondeur :
  ```
  Disallow: /admin
  Disallow: /admin.html
  Disallow: /payment
  Disallow: /payment.html
  ```

### Impact
- **UX** : URLs partage propres (`zeldtrade.com/app` vs `zeldtrade.com/app.html`).
- **SEO** : élimine le contenu dupliqué `.html` / clean (Firebase 301 → canonique clean).
- **Perf** : liens internes pointent direct → pas de hop redirect (gain ~50-100ms par nav).
- **Réversibilité** : les anciens bookmarks `.html` continuent à marcher (301 redirect).

### À surveiller
- Re-tester logout (app.js:122, :206) et delete account (settings.js:1172) → redirect doit aller à `/`, pas une page 404.
- Tester partage de lien sur réseaux sociaux (og:url canonique).
- Vérifier que `robots.txt` est bien servi sur `zeldtrade.com/robots.txt`.

### Liens
- v0.9.145 (firebase.json hosting section)
- Firebase Hosting docs : https://firebase.google.com/docs/hosting/full-config#clean_urls

---

## 2026-05-15 — v0.9.146 — Login : fond stylé (grid + glow) + retrait croix fermeture

**Type** : ui / polish
**Fichiers** : `src/app.html` (-1 ligne croix), `src/js/app-bootstrap.js` (-5 lignes handler), `src/css/style.css` (~+40 lignes pseudo-elements), `src/js/pages/changelog.js`, bump v=0.9.146
**Versions impactées** : front v0.9.146

### Contexte
User : "j'ai un problème quand je me connecte sur l'application et bien ça met un fond bizarre (...) créer un fond stylé s'il te plaît et enlève la croix en haut de la fenêtre". Le fond de la modale de login était un `rgba(0,0,0,0.65)` + `backdrop-filter: blur(6px)` — fonctionnel mais inesthétique (rien derrière la modale puisqu'`app.html` est vide tant que pas authentifié). La croix ✕ ne menait à rien (cliquer pour fermer la modale = retomber sur page blanche, no exit).

### Changements
- **`src/app.html`** : suppression de `<button class="auth-modal-close" id="authModalClose">✕</button>`.
- **`src/js/app-bootstrap.js`** : suppression du `addEventListener` sur `#authModalClose` (5 lignes) + du handler `authModalBackdrop` click (le backdrop devient inert).
- **`src/css/style.css`** :
  - `.auth-modal::before` : grid pattern violet `linear-gradient` 56×56px avec mask radial pour fade aux bords (même technique qu'`index.html`).
  - `.auth-modal::after` : 2 radial gradients violet (#7c3aed) + rose (#f472b6) avec `filter: blur(40px)` et animation `authGlowDrift` 14s ease-in-out alternate (translate + scale subtile).
  - `.auth-modal` : `background: var(--bg)` (couleur app de base).
  - `.auth-modal-backdrop` : `pointer-events: none` (inert).
  - Suppression de `.auth-modal-close` styles.

### Impact
- **UX** : page de connexion identique en feel à la landing page (`index.html`) → cohérence visuelle. Plus de croix trompeuse.
- **Perf** : 2 pseudo-elements + 1 animation CSS, tout sur GPU (`filter`, `transform`). Aucun impact mesurable.
- **Sécu** : aucun. Le backdrop inert ne crée pas de vulnérabilité — l'auth reste contrôlée par Firebase Auth.
- **Accessibility** : retrait de la croix = un raccourci d'escape en moins, mais comme il ne menait nulle part de toute façon, no regression. `Escape` keyboard shortcut peut être ajouté plus tard si demandé.

### À surveiller
- Tester sur mobile (animation drift visible ?)
- Tester avec `prefers-reduced-motion` — l'animation tourne quand même actuellement, on pourrait l'arrêter (TODO mineur).

### Liens
- v0.9.145 (migration Firebase Hosting, où cette modale est maintenant servie via `zeldtrade.com`)
- `src/index.html` : source du pattern de fond (lignes 75-104)

---

## 2026-05-15 — v0.9.145 — Migration Firebase Hosting + domaine custom + headers HTTPS

**Type** : infra / security
**Fichiers** : `firebase.json` (+ section hosting), `scripts/release.sh` (refactor), `functions/index.js` (ALLOWED_ORIGINS + PUBLIC_SITE_URL), `src/{index,app}.html` (og:url), `src/js/pages/export-pdf.js` (footer), `scripts/announce-{update,maintenance}.js` (avatar), `src/js/pages/changelog.js`, `docs/README.md`, bump v=0.9.145
**Versions impactées** : front v0.9.145, CFs : 10 CFs redéployées (ALLOWED_ORIGINS, PUBLIC_SITE_URL)

### Contexte
Migration de GitHub Pages vers Firebase Hosting pour avoir :
1. Un domaine custom propre : `zeldtrade.com` (acheté Namecheap, ~10€/an avec promo NEWCOM679)
2. Des headers HTTPS server-side (S12 du TODO) — impossible sur GH Pages qui ne permet aucun header custom
3. Préparation pour Brevo SMTP + DKIM/SPF/DMARC sur le domaine custom (livraison email)

### Changements

**`firebase.json` — section hosting ajoutée**
- `public: "src"` (même répertoire que la branche gh-pages)
- 6 headers de sécurité sur tous les `*.html` :
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS 1 an, sans preload pour réversibilité)
  - `X-Frame-Options: DENY` (server-side cette fois, frame-ancestors none du CSP n'était pas effectif via meta tag)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (toutes APIs sensibles blocked)
  - `Content-Security-Policy` server-side (identique au meta, mais maintenant `frame-ancestors 'none'` fonctionne vraiment)
- Cache assets statiques : `Cache-Control: public, max-age=31536000, immutable` (1 an) — sûr car cache-busting `?v=X.Y.Z` déjà en place
- Cache HTML : `no-cache, no-store, must-revalidate` (bump version visible instant)

**`scripts/release.sh` refactor**
- Deploy primaire : `firebase deploy --only hosting --non-interactive`
- Deploy backup : `git push gh-pages` (legacy, gardé ~1 semaine, skip via `--no-backup`)
- Print final : URLs Firebase primaire + auto + gh-pages backup

**`functions/index.js` — origines + URL publique**
- `ALLOWED_ORIGINS` (CORS) enrichi : `zeldtrade.com`, `www.zeldtrade.com`, `zeldtrade.web.app`, `zeldtrade.firebaseapp.com` + legacy `zeldaron.github.io`
- `PUBLIC_SITE_URL` → `https://zeldtrade.com` (impacte Stripe success_url/cancel_url)
- `avatar_url` Discord bot → `https://zeldtrade.com/favicon.png`

**URLs hardcodées migrées (cosmétique mais cohérence)**
- `src/index.html:13` + `src/app.html:39` : og:url
- `src/js/pages/export-pdf.js:141` : footer PDF
- `scripts/announce-update.js` : avatar + footer Discord
- `scripts/announce-maintenance.js` : avatar Discord

### DNS configuration (manuel, hors code)
Namecheap → Advanced DNS :
- `A @ → 199.36.158.100` (Firebase Hosting edge)
- `TXT @ → hosting-site=zeldtrade` (vérification ownership)
- `CNAME www → zeldtrade.web.app` (redirige www → apex via Firebase)

Firebase Console :
- Custom domain `zeldtrade.com` ajouté (Quick setup)
- Custom domain `www.zeldtrade.com` ajouté (Redirect → zeldtrade.com)

### Impact
- **UX** : domain propre, URLs `zeldtrade.com` (plus pro que `zeldaron.github.io/zeldtrade`)
- **Sécu** : S12 ✅ done. CSP server-side rend `frame-ancestors none` effective (impossible en meta tag). HSTS force HTTPS pour les 12 prochains mois sur tout sous-domaine.
- **Perf** : Firebase CDN edge Paris (`x-served-by: cache-par-lfpb1150034-PAR`) — latence FR plus faible que GH Pages (qui sert depuis US East).
- **Réversibilité** : gh-pages reste actif comme backup. Pour rollback, suffit de pointer DNS apex vers GH Pages IPs.

### À surveiller
- **SSL provisioning** : 1-24h après vérification ownership Firebase. Tant que pas fait, `https://zeldtrade.com` retourne SSL error (404 sur HTTP, normal). Statut visible dans Firebase Console → Hosting.
- **HSTS preload** : NON activé. Si besoin futur, ajouter `preload` à la directive et soumettre à hstspreload.org. Une fois preload, c'est IRRÉVERSIBLE — donc à faire seulement quand on est sûr.
- **CSP duplication** : meta tag CSP reste dans les HTML PLUS la CSP server-side. Pas de conflit (browsers intersectent les CSPs = plus restrictif gagne). Nettoyage meta tags possible dans une release future.

### Plan post-migration
1. Attendre SSL prêt sur `zeldtrade.com` (1-24h)
2. Annonce Discord #annonces "Site live sur zeldtrade.com"
3. Demain : Brevo SMTP + DKIM/SPF/DMARC sur zeldtrade.com pour la deliverability email (résout le problème spam Firebase Auth)
4. ~Une semaine après confirmation : retirer ALLOWED_ORIGINS `zeldaron.github.io`, supprimer branche gh-pages, retirer flag `--no-backup` du release.sh (gh-pages deviendra le default off)

### Liens
- v0.9.142 (UI Settings → Renvoyer email)
- v0.9.143 (modale post-signup + log)
- v0.9.144 (admin bulk verify — workaround temporaire jusqu'à Brevo)
- TODO I10 (domaine custom + Firebase Hosting) ✅
- TODO S12 (headers HTTP) ✅

---

## 2026-05-15 — v0.9.144 — Admin : forcer email_verified (workaround deliverability)

**Type** : admin / fix
**Fichiers** : `functions/index.js` (+ 132 lignes), `src/js/admin.js` (+ 90 lignes), `src/admin.html` (style btn), `src/js/pages/changelog.js`, bump v=0.9.144
**Versions impactées** : front v0.9.144, CFs : ajout `adminMarkEmailVerified`

### Contexte
Malgré les fixes v0.9.142 (UI Settings → Renvoyer email) et v0.9.143 (modale post-signup + log erreurs), un bêta-testeur supplémentaire signale qu\'après avoir cliqué "Renvoyer l\'email" il ne reçoit toujours RIEN — même en spam. Cause probable : Firebase Auth rate-limite `sendEmailVerification` à ~5/h/user, et certains providers (free.fr, Hotmail entreprises) peuvent bloquer 100% des emails Firebase quand le domaine `firebaseapp.com` est sur leur blacklist interne.

Solution court terme avant migration Brevo+DKIM/SPF : outil admin pour flipper manuellement `email_verified=true` côté Firebase Auth, soit user-par-user, soit en bulk pour la base existante.

### Changements
- **`functions/index.js`** : nouvelle CF `adminMarkEmailVerified`
  - Mode single : `{ uid }` → valide format UID (regex `^[A-Za-z0-9]{1,128}$`), check `admin.auth().getUser(uid)`, call `updateUser(uid, {emailVerified: true})`. Retourne `{alreadyVerified|verified, uid, email}`.
  - Mode bulk : `{ all: true }` → `admin.auth().listUsers(1000)`, itère, call `updateUser` sur tous les non-vérifiés. Retourne `{verified, skipped, errors, truncated, message}`.
  - Sécurité : `isAdmin()` strict (email + `email_verified` token), audit log Firestore avant/après avec TTL 1 an (`expireAt`), `enforceAppCheck:false` (App Check encore désactivé — TODO I6/S1).
- **`src/js/admin.js`** :
  - Onglet **Outils** → 3e bloc "Forcer la vérification email" avec bouton `#btnVerifyAll` (confirm obligatoire + résultat dans pre-formatted box).
  - Onglet **Utilisateurs** → chaque ligne reçoit un bouton `.btn-verify-email` (style bleu) qui appelle `markUserVerified(uid, email, btn)`.
- **`src/admin.html`** : styles CSS `.btn-verify-email` (couleurs bleu pour distinguer des actions destructives rouges/violettes).

### Impact
- **UX bêta** : pain point déblocable immédiatement par l\'admin via bouton — pas besoin que le bêta-testeur reçoive l\'email. L\'IA Groq redevient utilisable dans la seconde après le clic.
- **Sécu** : tradeoff documenté ↓. Contourne S20 (email_verified comme contrôle anti-abus sur `analyzeChart`). Mitigation : `isAdmin()` strict + audit log immuable. À retirer post-Brevo (~1 semaine).
- **Perf** : bulk mode listUsers 1000 + N updateUser = ~5-10s pour 50 users (séquentiel). Acceptable pour one-shot. Si la base grossit, paralléliser avec `Promise.all`.

### À surveiller
- Tester bulk sur compte admin perso d\'abord (dry-run mental — pas de mode dry-run dans le bulk).
- Vérifier audit log Firestore après chaque action : `auditLogs` doc avec `action: adminMarkEmailVerified`, `mode: bulk|single`, `verifiedCount`, etc.
- Si tu dépasses 1000 users (très peu probable en beta), le `truncated: true` apparaît dans la réponse → relance jusqu\'à ce que verified=0.

### Plan de retrait
Quand Brevo+DKIM/SPF en place (post-domaine, ~1 semaine) :
1. Vérifier que 100% des nouveaux signups reçoivent l\'email en INBOX (test sur Gmail, free.fr, Hotmail).
2. Désactiver/supprimer la CF `adminMarkEmailVerified`.
3. Retirer les boutons admin (3 lignes admin.js + 1 ligne CSS).
4. Garder l\'historique audit log pour traçabilité.

### Liens
- v0.9.122 (S20 — origine du check email_verified)
- v0.9.142 (UI Settings → Renvoyer email)
- v0.9.143 (modale post-signup + await sendEmailVerification)

---

## 2026-05-14 — v0.9.143 — Fix signup : modale post-création + log erreurs email

**Type** : fix
**Fichiers** : `src/js/auth.js`, `src/js/app-bootstrap.js`, `src/js/ui.js`, `src/js/pages/changelog.js`, `src/index.html`, `src/app.html` (bump v=)
**Versions impactées** : front v0.9.143, CFs inchangées

### Bug
Bêta-testeur signale : "je n'ai rien dans ma boîte mail quand je crée un compte". Reproduit le même jour. Causes identifiées :
1. **Erreur silencieuse** : `auth.js:73` faisait `cred.user.sendEmailVerification().catch(() => {})` — toute erreur (rate-limit Firebase, quota Spark, problème SMTP) était avalée sans aucun log ni feedback front. Impossible de savoir si l'email était même tenté.
2. **Spam filtering** : même quand `sendEmailVerification` réussit, le mail est expédié depuis `noreply@<project>.firebaseapp.com`. Sur Gmail / free.fr / Hotmail, ces emails finissent quasi systématiquement en spam. L'user pense donc que le système est cassé alors qu'il faut juste vérifier le dossier spam.
3. **Aucune signalisation post-signup** : le flow allait directement `register() → showLoader(1.1s) → launchApp()` sans aucune indication sur l'email envoyé ni la nécessité de le vérifier.

### Changements
- **`src/js/auth.js`** :
  - `register()` await maintenant `sendEmailVerification()` et capture le résultat dans `emailSent: bool` + `emailError: code|null` + `email: string` (retour étendu).
  - Logs `console.warn('[register] sendEmailVerification failed:', code, msg)` si l'envoi échoue.
  - Nouveau helper exporté `Auth.resendVerification()` qui appelle `currentUser.sendEmailVerification()` avec gestion d'erreurs propre. Utilisé dans la modale et réutilisable.
- **`src/js/ui.js`** : `UI.confirmModal` étendu pour supporter `cancelText: false` (ou `null`) → cache le bouton secondaire et focus auto sur le bouton primaire. Permet d'utiliser confirmModal comme modale info pure (1 bouton "OK").
- **`src/js/app-bootstrap.js`** : insère un `await UI.confirmModal({...cancelText: false})` entre `register()` et `showLoader()`. Le message :
  - si `emailSent=true` → "Email envoyé à X. VÉRIFIE TES SPAMS (Gmail/free.fr/Hotmail filtrent). Sans ça, l'IA ne fonctionne pas. Redirection Réglages → Vérification email si besoin."
  - si `emailSent=false` → "Compte créé mais l'envoi a échoué (code: X). Va dans Réglages → Vérification email pour le renvoyer."

### Impact
- **UX** : l'user comprend tout de suite (1) qu'un email a été envoyé, (2) où vérifier (spams), (3) comment renvoyer si besoin. Le bêta-testeur qui pensait "rien reçu" verra maintenant la modale et ira vérifier ses spams en premier réflexe.
- **Sécu** : aucun changement de surface. `sendEmailVerification` reste rate-limité par Firebase Auth (~5 emails/h/user). La modale ne révèle aucune info sensible.
- **Perf** : négligeable (modale rendue ~1× par signup).
- **Tracking** : les erreurs `sendEmailVerification` apparaissent maintenant en `console.warn` (visible dans DevTools + propagé à Sentry-lite côté CFs si jamais l'erreur survient côté serveur dans un futur flow). On peut maintenant diagnostiquer pourquoi un envoi échoue, là où avant on était aveugle.

### À surveiller
- Tester signup avec un nouvel email Gmail → la modale doit apparaître AVANT le loader.
- Tester escape/clic-overlay sur la modale → doit fermer mais NE PAS déclencher un comportement secondaire (puisque cancel est caché).
- Si Firebase Auth rate-limite (signups en boucle), vérifier que le code d'erreur remonte bien dans `emailError`.

### Pourquoi pas configurer un SMTP custom (Mailgun / SendGrid) ?
- Spark plan gratuit limite mais ne casse pas le système.
- Configurer un SMTP custom nécessite un domaine custom + DKIM/SPF/DMARC + service tiers (Mailgun gratuit 100 mails/jour, SendGrid 100/jour). Migration future possible.
- Pour l'instant (budget zéro, prélaunch, < 50 bêta-testeurs), la modale + le resend depuis Settings suffisent à dégoupiller le pain point.

### Liens
- Bêta-testeur ayant rapporté le bug (privé Discord)
- v0.9.141 (cause indirecte : message "email non vérifié" sans piste de remédiation)
- v0.9.142 (Settings → Vérification email : la modale renvoie vers cette section)

---

## 2026-05-14 — v0.9.142 — UI Settings : renvoyer email de vérification (auto-service bêta-testeurs)

**Type** : feat
**Fichiers** : `src/app.html`, `src/js/pages/settings.js`, `src/js/i18n.js` (FR + EN), `src/js/pages/changelog.js`, `src/index.html` (footer), bump cache busting v=0.9.142
**Versions impactées** : front v0.9.142, CFs inchangées

### Contexte
Depuis v0.9.122 (sécu S20), la CF `analyzeChart` exige `email_verified = true` côté token Firebase Auth. Plusieurs bêta-testeurs se sont retrouvés bloqués sur l'analyse IA sans moyen évident de renvoyer l'email de vérification — l'email automatique lors du signup peut atterrir en spam, expirer, ou être supprimé par mégarde. Le message d'erreur côté CF (corrigé en v0.9.141) explique maintenant la cause, mais il n'y avait pas de remédiation client-side.

### Changements
- **`src/app.html`** : nouveau bloc `#emailVerifySection` dans Réglages → onglet Général, entre la section Spreads et la section Données. Affiche un `<p id="emailVerifyStatus">` + 2 boutons cachés par défaut (`#btnResendVerify`, `#btnCheckVerify`).
- **`src/js/pages/settings.js`** :
  - Fonction top-level `_refreshEmailVerifyStatus()` : lit `firebase.auth().currentUser.emailVerified`, affiche un état coloré (vert ✅ / orange ⚠) et show/hide les boutons.
  - Event delegation sur `document.body` pour `#btnResendVerify` (appelle `user.sendEmailVerification()` avec gestion `auth/too-many-requests`) et `#btnCheckVerify` (appelle `user.reload()` puis refresh).
  - Appel de `_refreshEmailVerifyStatus()` au début de `UI.initSettings` (à chaque render, pas seulement first bind).
- **`src/js/i18n.js`** : 14 nouvelles clés (FR + EN) : `set.email.verify.title/label/resend/check/unauth/ok/pending/sending/sent/toomany/err/checking/confirmed/notyet`. Le pattern `{email}` est interpolé côté JS via `.replace()`.
- **`src/js/pages/changelog.js`** : entrée v0.9.142 avec champ `user:` (sera annoncée sur Discord #zeldtrade-updates via `scripts/announce-update.js`).

### Impact
- **UX** : un bêta-testeur bloqué peut maintenant débloquer l'analyse IA sans contacter le support en 2 clics (Renvoyer → cliquer lien dans mail → J'ai vérifié).
- **Sécu** : aucun changement côté serveur. `sendEmailVerification` est rate-limité par Firebase Auth (~5 emails/heure/user). Pas de nouvelle surface d'attaque — la vérification email reste un état contrôlé par Firebase, pas par le client.
- **Perf** : négligeable. `_refreshEmailVerifyStatus` est lu depuis `currentUser` (déjà en mémoire), pas d'appel réseau.

### À surveiller
- Tester sur un compte non vérifié : le bloc doit apparaître avec les 2 boutons.
- Tester sur compte vérifié : le bloc doit afficher ✅ sans boutons.
- Tester déconnexion → reconnexion : `_refreshEmailVerifyStatus` est appelé à chaque `UI.initSettings`, donc l'état doit toujours être à jour.
- Vérifier toast d'erreur si `auth/too-many-requests` (rate limit Firebase) — peu probable en usage normal.

### Liens
- Origin : feedback bêta-testeur qui a reçu "Vérifie ton email avant d'utiliser l'IA" (message v0.9.141) mais ne savait pas comment relancer la vérification.
- Pattern : event delegation déjà utilisée pour `#btnExportPdf` (v0.9.135).

---

## 2026-05-14 — v0.9.133 — Fix Export PDF : check isPro() à chaque render

**Type** : fix
**Fichiers** : `src/js/pages/settings.js`, `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.133

### Bug
User signale : son compte admin **est bien Pro** mais le bouton "Exporter PDF" dans Réglages → Général → Données n'apparaît pas. Investigation : le check `rowExportPdf.style.display = Store.isPro() ? '' : 'none'` était placé APRÈS `_settingsBound = true` → exécuté UNE SEULE FOIS au first render Settings.

### Cause racine
Quand l'user navigue dans l'app au démarrage :
1. App boot → `Auth.onAuthReady(user)` confirme la session
2. Store charge depuis Firestore : `users/{uid}/data/plan`, `trades`, etc. — c'est ASYNCHRONE
3. L'user clique sur "Réglages" très vite après le boot → `initSettings()` s'exécute
4. À cet instant, `Store.isPro()` retourne `false` car le doc plan n'est pas encore arrivé
5. Mon check `_settingsBound = true` est posé → ligne masquée pour TOUJOURS
6. Même après que le plan soit chargé et que `isPro()` retourne `true`, le bouton reste invisible

### Fix
Déplacer le check **avant** le `if (_settingsBound) return` :
```js
UI.initSettings = function () {
  try { renderGroupsSettings(); } ...
  try { renderSpreadsSettings(); } ...

  // ← Check ici, exécuté à CHAQUE render Settings
  const _rowPdf = document.getElementById('rowExportPdf');
  if (_rowPdf) _rowPdf.style.display = (Store.isPro && Store.isPro()) ? '' : 'none';

  if (_settingsBound) { updateGroqStatus(); return; }
  _settingsBound = true;
  ...
};
```

Maintenant à chaque fois que l'user clique sur Réglages, la visibilité du bouton est re-calculée. Pattern cohérent avec le rendu Basic/Pro chips qui font la même chose (visible dans `renderMyAccountsSettings`).

### Garde Pro toujours intacte
Le `Store.isPro()` est re-checké :
1. Au render Settings (visibilité)
2. Au click du bouton (toast d'erreur si bypass DevTools)
3. Dans `ExportPDF.generate()` (exception thrown si bypass)

→ 3 niveaux de défense en profondeur.

### Bump version
- `src/app.html` : `?v=0.9.132` → `?v=0.9.133` (22 refs)
- `src/index.html` : footer

---

## 2026-05-14 — v0.9.132 — F3 : Export PDF des trades (Pro only)

**Type** : feat / pro
**Fichiers** : `src/js/lib/jspdf.umd.min.js` (nouveau, 357 KB), `src/js/pages/export-pdf.js` (nouveau), `src/js/pages/settings.js` (handler + modal), `src/app.html` (bouton + scripts), `src/js/i18n.js` (15 clés FR+EN), bump v=
**Versions impactées** : front v0.9.132 (uniquement client, pas de CFs)

### Contexte
User : « F3 — Export PDF des trades Pro (Recommandé, autonome) ». Feature majeure du TODO depuis 2026-05-12. Gros chantier en ~3h (Phases 1-3 + 5-6, sans Phase 4 screenshots — gardée pour itération 2 si retour user positif).

### Architecture
- **Lib** : jsPDF v3.0.1 (357 KB minifié, MIT license), téléchargé depuis unpkg, **bundlé localement** dans `src/js/lib/jspdf.umd.min.js` (respect CSP `script-src 'self'`)
- **Module** : `src/js/pages/export-pdf.js` — IIFE `ExportPDF` avec une seule API publique `generate({ startMs, endMs, accountId })`
- **UI** : bouton dans Settings > Données (masqué si non-Pro), au click ouvre une modal créée dynamiquement (pas de pollution permanente du DOM)
- **Génération** : 100% client-side. Aucun appel CF. Aucune donnée envoyée à un tiers.

### Composants du PDF

**Page de garde** :
- Header violet brand avec "ZeldTrade" + nom user
- Titre "Rapport de trades"
- Période : "Du X → Au Y"
- Compte (si filtré)
- **6 KPIs en grille 2×3** : Trades total / Clôturés / Ouverts / P&L total / Win rate / R:R moyen
- Détails : Wins/Losses/BE
- Section "Extrêmes" : Meilleur trade + Pire trade (avec instrument et date)
- Note bas de page : "Rapport généré localement par ZeldTrade. Aucune donnée transmise à un serveur tiers."

**Pages trades** (6 par page) :
- Cadre par trade avec bord arrondi
- Ligne 1 : Date | Instrument | badge LONG/SHORT (vert/rouge) | P&L (couleur selon signe)
- Ligne 2 : Entry / SL / TP1 | R:R à droite
- Ligne 3 : Setup (tronqué 60 chars) + Notes (tronqué 90 chars)

**Footer (toutes pages)** :
- Ligne séparatrice
- "ZeldTrade — Journal de trading prop firm — zeldaron.github.io/zeldtrade"
- Pagination "Page X / Y"

### Sécurité
1. **Double garde Pro** :
   - Visuelle : `rowExportPdf.style.display = Store.isPro() ? '' : 'none'` au render Settings
   - Logique : `Store.isPro()` re-checké au click du bouton ET dans `ExportPDF.generate()` (anti DevTools bypass où un user désactiverait le `display:none` via inspecteur)
2. **CSP intacte** : `script-src 'self'` respectée (jsPDF bundlé, pas de CDN)
3. **Aucune fuite réseau** : `doc.save()` télécharge via blob URL local, pas de fetch externe
4. **PII** : les données sont déjà chez l'user, aucune nouvelle transmission
5. **HTML escape** : tous les inputs user passent par `UI.escHtml()` dans la modal pour éviter XSS

### Modal date range
- Inputs `<input type="date">` natifs (pas de lib externe)
- Default : 30 derniers jours
- Sélecteur compte : `<select>` avec option "Tous les comptes" + liste des comptes user
- Validation côté client :
  - Les deux dates doivent être renseignées
  - Date début ≤ date fin
- Bouton "Générer" devient "Génération…" et disabled pendant l'opération
- Erreurs affichées dans une zone rouge non-bloquante
- Fermeture : ESC, click hors modal, bouton "Annuler"

### Format de sortie
- A4 portrait, 21×29.7 cm
- Filename : `zeldtrade-export-YYYY-MM-DD.pdf` (date du jour, pas la période)
- Taille typique : ~50 KB pour 20 trades, ~200 KB pour 100 trades (sans screenshots)

### Limites v1 (à itérer si demandé)
- **Pas de screenshots embarqués** (Phase 4 reportée — nécessite fetch Cloud Storage + html2canvas ou conversion base64 + gestion de la taille). À ajouter en v2 si le user en a besoin.
- **Pas de filtre par outcome** (win/loss/be) — on filtre uniquement par période + compte
- **Pas de tri custom** (toujours plus récent d'abord)
- **Pagination fixée à 6 trades/page** — pas configurable

### Test (à faire post-deploy)
1. Compte Pro → Réglages → Données → "Exporter PDF"
2. Modal s'ouvre avec dates par défaut (30 derniers jours)
3. Click "Générer PDF" → download auto
4. Ouvrir le PDF → vérifier page de garde + pages trades + footer
5. Compte Basic → bouton invisible (settings-row masquée)
6. Compte Basic + DevTools `document.getElementById('rowExportPdf').style.display=''` puis click → toast d'erreur "Export PDF réservé aux utilisateurs Pro." (double garde fonctionnelle)

### Bump version
- `src/app.html` : `?v=0.9.131` → `?v=0.9.132` (22 refs maintenant : +1 pour export-pdf.js)
- `src/js/lib/jspdf.umd.min.js` : `?v=3.0.1` (version de la lib jsPDF, pas la version app — la lib est stable)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.132 avec champ `user:` (annonce user-facing)

### Itération 2 future (Phase 4 — Screenshots)
Si retour user positif sur la v1, on pourra ajouter les screenshots :
1. Pour chaque trade avec `screenshotPath` : fetch image depuis Cloud Storage via download URL
2. Convertir en base64 (jsPDF accepte JPEG/PNG)
3. Embedder en 80×50mm à droite de chaque trade (ou en grande taille en page dédiée)
4. Limite : éviter de dépasser 10 MB total (warning si > 50 trades avec screenshots)

---

## 2026-05-14 — v0.9.131 — Limite IA Pro 200 → 20 / jour (anti-abus avant bêta)

**Type** : security / pricing
**Fichiers** : `functions/index.js` (analyzeChart), `src/js/i18n.js` (×2 EN+FR), `src/app.html` (sidebar copy + bump v=), `src/index.html` (FAQ + footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.131 + CF `analyzeChart` redéployée

### Contexte
User : « tu peux pas limiter l'appel à l'ia à 20 par jours c'est large asser pour un utilisateurs ? ». Préparation à l'ouverture bêta : 20 analyses/jour est largement suffisant pour un trader normal (600/mois) et limite l'exposition Groq en cas d'abus.

### Changements

#### `functions/index.js` — `analyzeChart`
```js
const BASIC_CAP   = 1;
const PRO_CAP     = 20;   // ← était 200
const cap         = isPro ? PRO_CAP : BASIC_CAP;
```
Le message d'erreur utilise déjà `${PRO_CAP}` interpolé → mis à jour automatiquement : `"Limite Pro de 20 analyses/jour atteinte. Réessaie demain."`.

#### Copy aligné (sinon promesse trompeuse)
- `src/js/i18n.js` ligne 495 (FR) : `'off.pro.f3': 'Analyses IA illimitées'` → `'Jusqu\'à 20 analyses IA/jour'`
- `src/js/i18n.js` ligne 1065 (EN) : `'off.pro.f3': 'Unlimited AI analyses'` → `'Up to 20 AI analyses/day'`
- `src/app.html:228` : sidebar upgrade hint "comptes illimités et l'IA sans limite" → "comptes illimités et 20 analyses IA/jour"
- `src/index.html:1339` (FAQ landing) : "Pro débloque les analyses illimitées, multi-comptes..." → "Pro débloque 20 analyses IA/jour, multi-comptes..."

### Impact business
- **Pro** : avant 200/jour (illimité de fait), maintenant 20/jour. **Ratio Basic:Pro** reste fort : 1 vs 20 = ×20 d'incitation
- **Coût Groq** : un Pro maxant son quota = 20 appels/jour × $0.005/appel ≈ $0.10/jour → $3/mois par user actif. 100 users Pro maxant = $300/mois. Avec 200/jour c'était $3000/mois théorique.
- **Anti-abus** : un attacker auth peut DoS via 20 appels/jour seulement, pas 200. Réduction d'1 ordre de grandeur.

### Aucun user impacté en bêta
On a 7 users en prod actuellement. Probabilité qu'un fasse 20+/jour = quasi nulle (la valeur médiane historique est probablement < 5/jour). Aucun support à anticiper.

### Bump version
- `src/app.html` : `?v=0.9.130` → `?v=0.9.131` (20 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.131 avec champ `user:` pour annonce Discord (transparence sur le changement)

### À surveiller
- Si un user Pro hit le cap 20/jour régulièrement → considérer remontée à 30 ou tier "Pro+" à $19/mois pour les heavy traders
- Monitor les events `resource-exhausted` côté Discord `#dev-logs`

---

## 2026-05-14 — v0.9.130 — Retrait de la page "Mises à jour" de l'app (remplacée par Discord)

**Type** : refactor / ux
**Fichiers** : `src/app.html` (-3 blocks), `src/js/app.js` (-3 refs), `src/js/i18n.js` (-4 keys), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js` (entrée 0.9.130)
**Versions impactées** : front v0.9.130. CFs et rules inchangées.

### Contexte
User : « la page discord suffit tu peux retirer et fait bien attention que cela ne casse rien pour tout le reste ». Le canal Discord public `#mises-à-jour` (v0.9.127) est validé et opérationnel. On peut donc retirer la page Mises à jour de l'app (cohérent avec l'engagement initial : "quand ça sera bon tu enlève l'onglet mises à jour dans zeldtrade").

### Changements

#### `src/app.html` (3 retraits)
1. **Sidebar nav-item** (ligne ~190) : suppression du `<div class="nav-item" data-page="changelog">...Mises à jour</div>`
2. **DOM page** (ligne ~442) : suppression de `<div class="page" id="page-changelog"></div>`
3. **Script src** (ligne ~799) : suppression de `<script src="js/pages/changelog.js?v=X.Y.Z"></script>`

#### `src/js/app.js` (3 retraits)
1. **PAGE_KEYS** : retrait de `changelog: 'page.changelog',`
2. **switchPage()** : retrait de `if (page === 'changelog') Changelog.renderChangelog();`
3. **VALID_PAGES Set** : retrait de `'changelog'` (utilisé par ztGoto sessionStorage redirect)

#### `src/js/i18n.js` (4 clés retirées)
- FR : `nav.changelog`, `page.changelog`
- EN : `nav.changelog`, `page.changelog`

#### `src/js/pages/changelog.js` — **NON TOUCHÉ**
Le fichier reste sur disque avec :
- `const ENTRIES = [...]` (66+ entrées, incrémenté à chaque release)
- `function renderChangelog(...)` (dead code côté browser, mais pas grave)
- `return { renderChangelog, getEntries: () => ENTRIES }`

C'est nécessaire car `scripts/announce-update.js` (script Node admin) parse ce fichier en sandbox VM pour récupérer la dernière entrée et générer l'embed Discord.

### Validation anti-régression
Plusieurs checks effectués pour s'assurer que rien ne casse :

1. ✅ `grep "Changelog\.\|nav.changelog\|page.changelog\|page-changelog\|changelog.js"` dans `src/` : **0 résultats** (hors `pages/changelog.js` lui-même et `docs/`)
2. ✅ `node -e "...sandbox VM..."` charge `pages/changelog.js` et retourne **68 entries** + dernière version v0.9.129 — script announce-update.js continue à fonctionner
3. ✅ Tests `node test/calc.test.js` : 103/103
4. ✅ Aucune autre dépendance dans `src/js/` (les autres pages : dashboard, analytics, calendar, etc. ne référencent jamais Changelog)
5. ✅ La page `tutorial` reste intacte (proche dans la sidebar, parfois confusion)
6. ✅ Le `sessionStorage.ztGoto` cleanup (cas où un user aurait sauvegardé `ztGoto=changelog`) : maintenant invalide via `VALID_PAGES.has(_goto)` → fall-through vers `journal` par défaut, no crash

### Impact
- **UX users** : un onglet en moins dans la sidebar, légèrement plus net
- **UX users avancés** : redirige naturellement vers Discord pour rester informé (acquisition communauté)
- **Bundle** : -1 fichier JS chargé (`pages/changelog.js`) — gain minime (~10 KB minifiés)
- **Admin** : workflow inchangé (release.sh → choix grosse maj → `node scripts/announce-update.js`)

### Bump version
- `src/app.html` : `?v=0.9.129` → `?v=0.9.130` (20 refs maintenant car -1 script)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.130 avec champ `user:` (annonce le retrait)

### À surveiller
- Si un user a bookmarké `/app.html#changelog` ou similaire, le `VALID_PAGES.has('changelog')` retourne false → fall-through normal vers journal. Pas de crash, juste pas de redirection bookmark.
- Si quelqu'un re-ajoute par erreur un appel à `Changelog.X` dans le futur sans recharger le script, il aura un `Changelog is not defined`. La var est complètement absente du browser maintenant.

---

## 2026-05-14 — v0.9.129 — Error reporting CFs → Discord #dev-logs (Sentry-lite gratuit)

**Type** : infra / security
**Fichiers** : `functions/index.js` (helpers + secret + 9 CFs wrapped), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.129 + 9 CFs redéployées + 1 nouveau secret

### Contexte
User : « Bonus optionnel : ajouter #dev-logs avec error reporting CFs (Sentry-lite gratuit) ». Objectif : être alerté en temps réel quand une CF crashe en prod sans avoir à ouvrir GCP Logs.

### Architecture

#### 1. Nouveau canal Discord `#dev-logs`
Créé dans la catégorie `🔧 ADMIN` (privé Fondateur). Webhook `ZeldTrade Errors` configuré. Reçoit des embeds rouges (color `0xf85149`).

#### 2. Secret Firebase
`DISCORD_ERRORS_WEBHOOK` stocké dans Secret Manager (chiffré, jamais en clair) via `firebase functions:secrets:set DISCORD_ERRORS_WEBHOOK --data-file -`. Attaché aux 9 CFs critiques.

#### 3. Helper `_reportError(ctx)` (`functions/index.js`)
```js
async function _reportError(ctx) {
  try {
    const url = DISCORD_ERRORS_WEBHOOK.value();
    if (!url) return;  // pas configuré → skip silent
    const embed = {
      title: `🔥 Erreur dans \`${ctx.fn}\``,
      description: '```\n' + ctx.message + ctx.stack + '\n```',
      color: 0xf85149,
      fields: [
        { name: 'Code',   value: ctx.code,   inline: true },
        { name: 'UID',    value: ctx.uid,    inline: true },
        { name: 'Région', value: 'europe-west1', inline: true },
      ],
      footer: { text: 'ZeldTrade Errors · Sentry-lite' },
      timestamp: new Date().toISOString(),
    };
    await _postDiscordWebhook(url, embed);
  } catch (e) {
    // Defensive : ne JAMAIS faire échouer une CF à cause du reporting
    console.error('[_reportError] silent fail:', e && e.message);
  }
}
```

#### 4. Wrapper `_wrapCF(name, handler)`
```js
function _wrapCF(name, handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (e) {
      // HttpsError = erreur métier attendue, on ne report pas (sinon spam)
      if (e && e.httpErrorCode) throw e;
      // Vraie erreur serveur → report Discord + re-throw 'internal' au client
      await _reportError({
        fn:      name,
        uid:     request.auth && request.auth.uid,
        code:    (e && e.code) || '500',
        message: (e && e.message) || String(e),
        stack:   e && e.stack,
      });
      throw new HttpsError('internal', 'Erreur serveur — réessaie dans un instant.');
    }
  };
}
```

#### 5. 9 CFs wrappées
| CF | Wrapper |
|---|---|
| `analyzeChart` | `_wrapCF('analyzeChart', ...)` |
| `sendContactMessage` | `_wrapCF('sendContactMessage', ...)` |
| `notifyNewSignup` | `_wrapCF('notifyNewSignup', ...)` |
| `deleteUserAccount` | `_wrapCF('deleteUserAccount', ...)` |
| `generateProCode` | `_wrapCF('generateProCode', ...)` |
| `revokeProCode` | `_wrapCF('revokeProCode', ...)` |
| `createCheckoutSession` | `_wrapCF('createCheckoutSession', ...)` |
| `stripeWebhook` | (onRequest — pas wrap via _wrapCF qui est pour onCall, géré par try/catch existant) |
| `cleanupOrphanUserEmails` | `_wrapCF('cleanupOrphanUserEmails', ...)` |

`secrets: [DISCORD_ERRORS_WEBHOOK]` ajouté à chaque tableau secrets des CFs.

### Sécurité

**Anti-spam** :
- HttpsError filtrées (validations user normales = pas reportées)
- Discord rate-limit 30 req/min/webhook → si dépassé, 429 et erreur perdue (acceptable, mieux que DoS)

**Anti-PII** :
- Pas d'email loggué (juste UID)
- Pas de token loggué
- Pas de payload request (qui pourrait contenir un message support, une capture d'écran, etc.)
- Truncation 1800 chars sur message + 1500 chars sur 6 lignes de stack

**Anti-cascade** :
- `_reportError` est elle-même dans un try/catch — si elle plante (réseau, Discord 5xx, etc.), elle log mais ne re-throw pas
- Le client reçoit toujours une réponse `HttpsError('internal', ...)` — le reporting est transparent pour lui

### Test de validation
Curl direct au webhook avec un payload de test fictif → HTTP 204 confirmé → embed visible dans `#dev-logs`. Le format final est identique à ce qu'enverra `_reportError`. Test live "réel" : surviendra naturellement à la prochaine vraie erreur de CF (qu'on espère ne pas voir trop souvent !).

### Impact
- **Monitoring** : alertes temps réel sur ton phone Discord, plus besoin d'ouvrir GCP Logs
- **Coût** : 0 €. Sentry coûte $26/mois pour 50k events, Discord webhook = gratuit illimité (sauf rate-limit)
- **Perf** : +~50 ms sur une erreur (post HTTP). Aucun impact sur le path nominal (try réussit)
- **Compat** : aucun breaking change pour les clients (l'API des CFs est inchangée)

### À surveiller
- Si volume d'erreurs > 30/min → Discord rate-limit, certaines erreurs perdues. À ce moment-là, passer sur Sentry vrai ou un système de dedup côté serveur.
- Si stack trace contient des données sensibles (ne devrait pas arriver, à monitorer)

### Bump version
- `src/app.html` : `?v=0.9.128` → `?v=0.9.129` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.129 (sans champ `user:` car infra admin pure, pas user-facing)

---

## 2026-05-14 — v0.9.128 — Privacy : refonte RGPD complète

**Type** : privacy / docs
**Fichiers** : `src/privacy.html` (refonte), `src/legal.html` (sous-traitants), `src/cgu.html` (date), `src/js/contact.js` (commentaire), `src/app.html` (2 commentaires + bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.128

### Contexte
User : « C — Compléter privacy.html (RGPD) ». Page legale existante (v du 30 avril) avec plusieurs trous identifiés par audit :

1. **Date obsolète** : 30 avril 2026 → 14 mai 2026
2. **Web3Forms** encore mentionné comme sous-traitant alors qu'il a été retiré en v0.9.123 (migration Discord)
3. **Discord absent** comme sous-traitant (webhooks reçoivent pseudo + email vérifié dans #support-tickets privé)
4. **Stripe absent** (paiements Pro/Lifetime à venir, info légale obligatoire à publier avant lancement)
5. **Captures d'écran** : info **inexacte** ("non conservées") alors qu'elles sont en réalité dans `users/{uid}/screenshots/` Cloud Storage tant que le compte existe
6. **AuditLogs** manquants alors qu'ils ont une TTL 1 an (v0.9.122)
7. **Cloud Storage Firebase** noyé dans "Firebase" → séparé pour clarté
8. **Cloud Functions Gen 2** non mentionné comme sous-traitant
9. **Google Fonts** non mentionné (CDN externe → IP transmise)
10. **Section Mineurs** absente (trading interdit aux <18 ans, recommandation ARMF/AMF)

### Changements

#### `src/privacy.html` (refonte complète, 221 → 252 lignes)
- Date : 30 avril → 14 mai 2026
- Statut ajouté : "Micro-entrepreneur (profession libérale)"
- Tableau données collectées : ajout "Mot de passe" (haché), "Statut d'abonnement", "Logs d'audit administrateur" (TTL 1 an), "Logs techniques Firebase" (90j)
- Captures d'écran : durée corrigée (avant : "non conservées", après : "tant que le compte existe")
- Section Sous-traitants entièrement réécrite avec 10 blocks :
  - Firebase Auth & Firestore (region europe-west1)
  - Cloud Storage Firebase (separated, region europe-west1)
  - Cloud Functions Gen 2 (region europe-west1)
  - Groq, Inc. (analyse IA, consentement)
  - **Discord, Inc.** (nouveau — notifs admin via webhooks, distinction privé/public)
  - **Stripe Payments Europe Ltd.** (nouveau, tag "à venir, non actif aujourd'hui")
  - hCaptcha
  - Google reCAPTCHA Enterprise
  - GitHub Pages
  - **Google Fonts** (nouveau)
- Web3Forms : retiré complètement
- Section 5 ajoutée : Conservation et suppression (détail soft-delete 30j + TTL auditLogs 1 an)
- Section 8 ajoutée : Mineurs (<18 ans interdit)
- Bases légales explicitées avec articles RGPD (art. 6.1.b, 6.1.a, 6.1.f, art. 9, 12.3, 15-21, 26, 37)
- Cookies : précision (pas de tracking, juste localStorage + session Firebase)
- Note transferts hors UE : EU-US Data Privacy Framework (10/07/2023) pour Google, CCT pour les autres, Stripe en Irlande (UE)

#### `src/legal.html`
- Date : 30 avril → 14 mai 2026
- Section sous-traitants : 2 entrées (Firebase + Groq) → **9 entrées** (alignement avec privacy.html) + renvoi vers privacy pour les détails

#### `src/cgu.html`
- Date : 30 avril → 14 mai 2026

#### Cleanup commentaires Web3Forms résiduels
- `src/js/contact.js:2` : "clé Web3Forms côté serveur" → "Discord webhook (depuis v0.9.123)"
- `src/app.html:116` : "Web3Forms partage la sitekey" → "sitekey publique pour anti-bot"
- `src/app.html:862` : "clé publique partagée par Web3Forms" → "clé publique pour anti-bot"

### Conformité RGPD post-modif
| Critère | Statut |
|---|---|
| Identité responsable du traitement (art. 13.1.a) | ✅ |
| Finalités + bases légales explicites (art. 13.1.c) | ✅ |
| Destinataires / sous-traitants (art. 13.1.e) | ✅ (10 blocks) |
| Transferts hors UE (art. 13.1.f) | ✅ (EU-US DPF + CCT) |
| Durée de conservation (art. 13.2.a) | ✅ |
| Droits utilisateur (art. 13.2.b, 15-21) | ✅ |
| CNIL contact (art. 13.2.d) | ✅ |
| Protection mineurs (art. 8) | ✅ (interdit <18 ans) |
| Politique cookies (Loi RGPD française) | ✅ (aucun cookie tracking) |
| DPO (art. 37) | ✅ (justification absence) |

### Impact
- **Légal** : alignement avec la réalité technique (Discord, Stripe à venir, AuditLogs), pré-requis avant ouverture publique
- **UX** : utilisateurs informés clairement de qui voit quoi
- **Sécurité** : aucun changement (page statique, CSP inchangée)

### Bump version
- `src/app.html` : `?v=0.9.127` → `?v=0.9.128` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.128 avec champ `user` (pour annoncer aux users que la politique est mise à jour — bonne pratique RGPD)

---

## 2026-05-14 — v0.9.127 — Annonces Discord pour les mises à jour user-facing

**Type** : feat / integration
**Fichiers** : `scripts/announce-update.js` (créé), `src/js/pages/changelog.js` (+ export `getEntries` + entrée user-facing), `~/.config/zeldtrade/updates_webhook` (hors repo, chmod 600), `src/app.html` (bump v=), `src/index.html` (footer)
**Versions impactées** : front v0.9.127

### Contexte
User : « non je veux que cela soit pour les utilisateurs pour les grosses maj genre a chaque modificatiion tu me demande si c'est une grosse maj et si je dis oui tu envoie au webhook mais je veux que ça soit comme le truc que j'ai dans les mises à jour sur zeldtrade et quand ça sera bon tu enlève l'onglet mises à jour dans zeldtrade ».

Pivot par rapport au workflow initial : pas de notifs admin pour `#déploiements`, mais des annonces **côté utilisateurs** dans un canal public, avec un format **simplifié sans jargon** (« Changement côté API » au lieu de « S36 — Stripe webhook idempotency »).

### Architecture

#### 1. Canal Discord public `#mises-à-jour`
Créé dans `👋 ACCUEIL` (catégorie publique), visible par `@everyone`, écriture interdite sauf webhook. Permet d'avoir un fil d'annonces type "newsfeed" lisible par tous les visiteurs du serveur.

#### 2. Webhook + secret
Créé : `ZeldTrade Updates`. URL stockée dans `~/.config/zeldtrade/updates_webhook` (chmod 600, hors repo). Format URL validé par regex stricte côté script (anti SSRF/injection).

#### 3. Schéma changelog enrichi (`src/js/pages/changelog.js`)
Chaque entrée peut désormais avoir un champ optionnel :
```js
user: {
  title: 'Titre simple sans jargon',
  items: [
    { type: 'feat', text: 'Description user-friendly en français.' },
    ...
  ],
}
```
**Règle d'or** : si l'entrée a `user`, elle est annoncée sur Discord. Sinon → ignorée. Garantit que seules les vraies nouveautés user-facing remontent.

Export ajouté : `return { renderChangelog, getEntries: () => ENTRIES };` — permet au script Node de parser le changelog en sandbox VM. La page Mises à jour de l'app continue de fonctionner exactement comme avant.

#### 4. Script `scripts/announce-update.js`
```bash
node scripts/announce-update.js v0.9.X
```
- Lit l'URL webhook depuis `~/.config/zeldtrade/updates_webhook`
- Vérifie chmod 600 (refuse si trop permissif)
- Valide format URL Discord (regex)
- Charge changelog.js en sandbox VM (lecture seule, timeout 2s)
- Cherche l'entrée par version
- **Si pas de champ `user`** → exit 1 avec message clair
- Sinon construit l'embed :
  - Titre : `🚀 vX.Y.Z — {user.title}`
  - Description : bullets avec emojis selon type (`✨ feat`, `🐛 fix`, `🔒 security`, `♻️ refactor`, `🧹 cleanup`, etc.)
  - Couleur brand `#6366f1`
  - Footer "ZeldTrade · zeldaron.github.io/zeldtrade"
  - Timestamp ISO
- POST avec timeout 8s, gestion propre des codes HTTP (200-299 = OK, sinon log + exit 1)

### Workflow opérationnel

À chaque modif :
1. Code + bump version + add entry dans `src/js/pages/changelog.js`
2. **Si user-facing** : ajouter `user: { title, items: [...] }` dans l'entrée (français simple, sans jargon)
3. `bash scripts/release.sh vX.Y.Z` (inchangé)
4. Demander à l'user : "grosse maj ?" — si oui : `node scripts/announce-update.js vX.Y.Z`

Pour les modifs purement techniques (refactor, cleanup, sécu invisible, etc.) : pas de section `user` → pas d'annonce Discord → pas de bruit pour les utilisateurs.

### Style de rédaction `user.items`

À écrire en français simple, sans jargon. Exemples de bons remplacements :

| Technique | User-facing |
|---|---|
| « S36 — Stripe webhook idempotency : `event.id` stocké atomiquement, anti-replay 30 jours via TTL » | « Sécurité paiements renforcée — plus de risque de double-activation en cas de problème réseau » |
| « `_storeUserEmail()` appelé maintenant directement après `createUserWithEmailAndPassword` » | « Création de compte plus fiable » |
| « Clés i18n manquantes (cal.today, confirm.*.title) » | « Quelques textes corrigés (« Aujourd'hui » dans le calendrier, titres de modales) » |
| « TTL `auditLogs` 1 an via champ `expireAt` » | « Les logs admin sont auto-supprimés au bout d'1 an (conformité RGPD) » |
| « Migration Web3Forms → Discord webhooks server-side » | « Tes messages de contact arrivent maintenant instantanément à l'admin via Discord » |

### Futur (post-validation user)

Quand l'user confirmera que tout marche bien, on retirera la page « Mises à jour » de l'app (3 modifs : `app.html` nav-item, `app.js` routing, `pages/changelog.js` → garder uniquement pour le parser, retirer le rendu). Le canal Discord devient la source publique unique.

### Sécurité
- URL webhook = secret Google-style chmod 600 hors repo (jamais commité)
- Validation regex côté script (anti corruption fichier)
- Sandbox VM avec timeout 2s (anti boucle infinie si changelog.js corrompu)
- Timeout HTTPS 8s (anti blocage si Discord down)
- Pas de PII dans les logs (le script lit du changelog public, pas de données user)

### Bump version
- `src/app.html` : `?v=0.9.126` → `?v=0.9.127` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.127 avec champ `user` exemplaire (sera la 1ère annonce du canal)

---

## 2026-05-14 — v0.9.126 — Code cleanup (5 clés i18n + dead code retiré)

**Type** : refactor / cleanup
**Fichiers** : `src/js/i18n.js`, `src/js/store.js`, `functions/index.js`, `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.126 (CFs inchangées comportementalement, redeploy optionnel pour sync source)

### Contexte
User : « je veux que tu fasses en sorte que le projet (niveau code) soit entièrement propre mais que tout fonctionne comme actuellement ». Audit complet du code via Explore agent — verdict : codebase déjà très propre (0 finding critique). Cleanup réalisé sur les 3 items pertinents.

### Cleanup #1 — 5 clés i18n manquantes

Script d'audit Python : extrait toutes les clés du `dict.fr`/`dict.en` de `i18n.js` (regex `'foo.bar':`) et compare aux usages `t('xxx')` / `i18n.t('xxx')` / `data-i18n="xxx"` dans `src/**/*.js` + `src/**/*.html`. Résultat :
- **536 clés** dans dict
- **499 clés** utilisées dans le code
- **6 missing** (dont 1 faux positif `ob.` qui est une interpolation `t('ob.' + outcome)`, vrais : 5)
- **43 unused** (non touchées — risque d'interpolation, audit cas par cas requis)

**5 clés ajoutées** (FR + EN) :
| Clé | Code FR | Code EN | Lieu d'usage |
|---|---|---|---|
| `cal.today` | `Aujourd'hui` | `Today` | `calendar.js:216` bouton retour mois courant |
| `confirm.trade.title` | `Supprimer le trade` | `Delete trade` | `ui.js:369` modale confirm |
| `confirm.acc.title` | `Supprimer le compte` | `Delete account` | `settings.js:285` modale confirm |
| `confirm.grp.title` | `Supprimer le groupe` | `Delete group` | `settings.js:608` modale confirm |
| `ui.trades.lbl` | `trades` | `trades` | `ui.js:121` compteur "X / N trades" |

**Bug racine** : le code utilise `t('xxx') || 'fallback'` mais `t()` retourne la clé elle-même si non trouvée (string truthy) → le `||` ne déclenche jamais. Voir précédent fix `dash.empty.*` en v0.9.120. **Le pattern fallback inline est dangereux** — à supprimer progressivement (toutes les clés doivent exister dans i18n.js).

### Cleanup #2 — Suppression de `Store.recordAnalysis()`

Dans `src/js/store.js:818-822`, fonction no-op exportée :
```js
// recordAnalysis() est désormais géré exclusivement par la Cloud Function...
function recordAnalysis() { /* no-op — handled server-side */ }
```
Exportée ligne 934 mais **0 appel** dans tout le repo (vérifié via `grep -rn "Store.recordAnalysis\|.recordAnalysis(" src/`). Suppression de la fonction + retrait du return. Pas de breaking change.

### Cleanup #3 — Suppression de la déclaration `WEB3FORMS_KEY`

Dans `functions/index.js:16-19`, secret déclaré mais détaché de toutes les CFs depuis v0.9.123 (migration Discord webhooks). Suppression de `defineSecret('WEB3FORMS_KEY')` + commentaire de doc qui explique que le secret peut être destroy manuellement via `firebase functions:secrets:destroy WEB3FORMS_KEY` côté CLI.

### Non cleanups (intentionnel)

- **`payment.html` + `payment.js`** : page "En cours de construction" pour le mode stealth Stripe (référencée par `offers.js:65,81`). **Garde** — sera supprimée quand Stripe sera branché.
- **43 clés i18n unused** : risque trop élevé de casser une interpolation (`t('off.basic.' + variant)`). À auditer cas par cas plus tard.
- **`.DS_Store`** : déjà dans `.gitignore`, pas tracké par git. Fichier OS macOS — pas notre problème.
- **Commentaires "DEPRECATED" / "App Check" / "localhost"** : doc technique utile, pas dead code.

### Validation
- Tests `node test/calc.test.js` : 103/103 ✅
- Audit i18n re-lancé : 0 missing après fix
- Aucune CF redéployée (`functions/index.js` ne change que la déclaration d'un secret inutilisé, pas de logique)

### Bump version
- `src/app.html` : `?v=0.9.125` → `?v=0.9.126` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.126

### À faire (cleanup futur, non prioritaire)
1. Audit cas par cas des 43 clés i18n unused (vérifier interpolation) — gain ~5% bundle i18n
2. Supprimer le pattern `t('xxx') || 'fallback'` partout (forcer toutes les clés dans le dict)
3. Quand Stripe sera branché : supprimer `payment.html` + `payment.js` (rediriger vers Stripe checkout direct)
4. Refactor `modal.js` (1253 lignes) en sous-modules

---

## 2026-05-14 — v0.9.125 — Fix bug comptes fantômes (userEmails timing)

**Type** : fix / bug
**Fichiers** : `src/js/auth.js`, `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.125

### Contexte
User signale qu'un compte test créé pour Discord n'apparaît pas dans la console admin. Investigation : 11 comptes Firebase Auth en prod, mais seulement 7 docs `userEmails` côté Firestore. **4 comptes fantômes** identifiés :
- `aaronptn35@gmail.com` (test) — last_login: JAMAIS
- `basic@prout.com` (basic) — last_login: JAMAIS
- `larijames133@gmail.com` (Nino) — last_login: JAMAIS
- `tuvaspasmevolermonemail@gmail.com` (Ludo) — last_login: JAMAIS

Tous ont `last_login: JAMAIS` → ils ont créé un compte mais n'ont jamais réussi à compléter le 1er login (onglet fermé trop vite).

### Cause racine
Dans `src/js/auth.js`, `_storeUserEmail()` créait le doc `userEmails/{uid}` uniquement via `onAuthStateChanged` :
```js
function onAuthReady(cb) {
  _fbAuth.onAuthStateChanged(user => {
    if (user) _storeUserEmail(user);  // ← appelé seulement quand auth state change
    cb(...);
  });
}
```

Or `register()` ne déclenche PAS forcément `onAuthStateChanged` immédiatement — c'est asynchrone et peut arriver plusieurs ms/secondes après `createUserWithEmailAndPassword` succès. Si l'utilisateur fermait l'onglet entre ces 2 events, le doc n'était jamais créé. Comme `_storeUserEmail` est wrappé dans `.catch(() => {})`, l'erreur passe silencieusement.

### Fix
Dans `register()` (auth.js), création directe et `await`-ée du doc `userEmails` juste après `updateProfile()` :
```js
const cred = await _fbAuth.createUserWithEmailAndPassword(safeEmail, password);
await cred.user.updateProfile({ displayName: safeName });

// v0.9.125 : crée immédiatement le doc userEmails (anti-race)
try {
  await _fbDb.collection('userEmails').doc(cred.user.uid).set({
    uid:      cred.user.uid,
    email:    safeEmail,
    username: safeName,
    lastSeen: Date.now(),
  });
} catch (e) {
  console.warn('[register] storeUserEmail failed', e && e.code);
}
```

Le `await` garantit que le doc est confirmé écrit AVANT que `register()` retourne. Même si l'utilisateur ferme l'onglet juste après → le doc existe.

### Idempotence
Si `onAuthStateChanged` se redéclenche plus tard (1er login post-signup), `_storeUserEmail()` est ré-appelé et le doc est juste réécrit avec les mêmes valeurs (+ `lastSeen` mis à jour). Pas de conflit.

### Action de cleanup
Les 4 comptes fantômes existants sont supprimés via Firebase Admin SDK (ou Firebase Console manuel) — voir section "Cleanup ad-hoc" plus bas.

### Impact
- **UX admin** : tous les nouveaux signups apparaissent maintenant dans la console admin immédiatement, sans skip
- **Cohérence data** : plus de mismatch entre `Auth` et `Firestore.userEmails`
- **Sécu** : neutre (pas de changement de surface d'attaque)
- **Perf** : +1 round-trip Firestore au signup (~50 ms), négligeable

### Cleanup ad-hoc (post-deploy)
Les 4 comptes fantômes existants doivent être supprimés manuellement (à l'admin de choisir). Méthode rapide via firebase-admin standalone après `gcloud auth application-default login` :
```js
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'zeldtrade' });
const uids = ['Fjzn5A7T8DZPGnJmcrmJrF0a37c2', 'HjJctlIvtnQ7pcnNlB4yfd218Uz2', 'UUCnJzENc6aLuVYLPLEILZJLZoj2', 'Zc1v8oyifPW4EUY2pC7EXOEb2MG2'];
for (const uid of uids) {
  await admin.auth().deleteUser(uid);
  await admin.firestore().recursiveDelete(admin.firestore().doc('users/' + uid));
  await admin.firestore().doc('userEmails/' + uid).delete().catch(() => {});
}
```
(Le script `_tmp_delete_ghosts.js` peut être recréé temporairement dans `functions/` puis supprimé.)

### Bump version
- `src/app.html` : `?v=0.9.124` → `?v=0.9.125` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.125

---

## 2026-05-14 — v0.9.124 — Privacy : retrait email + UID dans #new-users public

**Type** : privacy / fix
**Fichiers** : `functions/index.js` (notifyNewSignup), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.124 + CF `notifyNewSignup` redéployée

### Contexte
User : « je veux quand il y a un nouvel utilisateurs vu que c'est vu par tout le monde je veux pas que l'on voit le mail ». Le canal Discord `#new-users` est visible par tout le serveur (effet "social proof"), il ne doit donc pas exposer d'email ou d'identifiant privé.

### Changements (`functions/index.js` — `notifyNewSignup`)

**Avant** :
```js
const name  = _sanitizeText(token.name || token.email || '', 100);
const email = _sanitizeText(token.email || '', 254);
embed.fields = [
  { name: '👤 Pseudo', value: name },
  { name: '📧 Email',  value: email },   // PII en clair dans canal public ❌
];
embed.footer = { text: `UID: ${uid}` };  // UID en clair ❌
```

**Après** :
```js
const localPart = (token.email || '').split('@')[0] || 'Anonyme';
const name      = _sanitizeText(token.name || localPart, 100);
// Plus de field email, plus de footer UID
embed.description = `Bienvenue à **${name}** dans la communauté ZeldTrade ! 🎯`;
```

### Privacy
- **Email** : retiré complètement de l'embed public
- **Local-part fallback** : si `token.name` absent, on prend `aaron` (pour `aaron@gmail.com`) au lieu de l'email complet — évite la fuite indirecte
- **UID** : retiré aussi (info technique, non pertinente publiquement, faciliterait une éventuelle énumération)
- **`#support-ticket` (privé) inchangé** : si l'admin a besoin de l'email/UID pour le support, ça arrive toujours dans le canal privé via `sendContactMessage`

### Bonus UX
Le message devient plus accueillant : `Bienvenue à **Aaron** dans la communauté ZeldTrade ! 🎯` au lieu d'une fiche froide pseudo + email.

### Impact
- **Privacy** : RGPD-friendly. Les emails de nouveaux inscrits ne sont plus visibles publiquement par les autres membres
- **UX** : meilleur "social proof" — la communauté voit grandir sans intrusion privée
- **Support admin** : 0 régression (l'info reste dans le canal privé via le formulaire de contact)
- **Coût** : neutre

### Bump version
- `src/app.html` : `?v=0.9.123` → `?v=0.9.124` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.124

---

## 2026-05-14 — v0.9.123 — Migration Web3Forms → Discord webhooks

**Type** : infra / integration
**Fichiers** : `functions/index.js` (helpers + 2 CFs), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`, `docs/TODO.md`
**Versions impactées** : front v0.9.123 + 2 CFs redéployées + 2 secrets ajoutés

### Contexte
Web3Forms gratuit n'autorise PAS les appels server-side (Pro plan $10/mois requis). Migration vers Discord webhooks : gratuit, illimité (rate-limit 30 req/min/webhook), notifs mobile/desktop instantanées via l'app Discord. Le serveur ZeldTrade HQ a déjà la structure (Carl-bot, rôles, canaux) — il restait juste à câbler.

### Setup user (Discord)
1. Catégorie privée `🔧 ADMIN` créée
2. Canaux `#support-tickets` (privé) et `#new-users` (public — choix user pour visibilité communauté des inscriptions) créés
3. 2 webhooks créés (`ZeldTrade Support` + `ZeldTrade Signups`)
4. URLs transmises + stockées dans Secret Manager :
   - `DISCORD_SUPPORT_WEBHOOK`
   - `DISCORD_SIGNUP_WEBHOOK`

### Changements code (`functions/index.js`)

#### Nouveaux helpers
- **`_sanitizeMessage(s, max)`** — variante de `_sanitizeText` qui préserve `\n` et `\r` (pour la lisibilité du message support dans l'embed Discord). Strip uniquement les vrais control chars + Unicode bidi.
- **`_postDiscordWebhook(url, embed)`** — helper générique pour POST vers Discord. Sécurité :
  - Regex `DISCORD_WEBHOOK_RE` valide le format `^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/<id 15-25>/<token 40-128>$`
  - Timeout 8s via `AbortController`
  - Logs sans PII (Discord embeds peuvent contenir name/email/message → on log uniquement le code HTTP)
  - User-Agent custom : `ZeldTrade Bot` + avatar `favicon.png`
  - Retourne `{ ok, reason }` (pas de throw — laisse le caller décider)

#### `sendContactMessage`
- `secrets`: `WEB3FORMS_KEY` → `DISCORD_SUPPORT_WEBHOOK`
- `_sanitizeText(message)` → `_sanitizeMessage(message)` (pour préserver les sauts de ligne)
- Suppression du `fetch('https://api.web3forms.com/submit', ...)` remplacé par construction d'embed + `_postDiscordWebhook()` :
  - Titre : `📩 Message de {name}` (couleur brand `#6366f1`)
  - Description : message complet (tronqué à 3900 chars, limite Discord embed.description = 4096)
  - Fields : Pseudo / Email / Plan
  - Footer : `UID: {uid}` + timestamp ISO

#### `notifyNewSignup`
- `secrets`: `WEB3FORMS_KEY` → `DISCORD_SIGNUP_WEBHOOK`
- Suppression du `fetch web3forms` remplacé par embed Discord :
  - Titre : `🎉 Nouvel utilisateur inscrit` (couleur green `#3fb950`)
  - Fields : Pseudo / Email
  - Footer : `UID: {uid}` + timestamp ISO
- Le post Discord est `non-critique` : si le webhook échoue, on log et on retourne quand même `{ok: true}` (le signup ne doit pas échouer juste parce que la notif est tombée à l'eau)

### Sécurité
- **URLs webhooks = secrets** (Google Secret Manager, chiffrés at-rest, jamais exposés au client)
- **Regex de validation** sur l'URL avant tout fetch (défense en profondeur)
- **No PII dans les logs** côté serveur
- **Captcha hCaptcha toujours actif** côté CF (préservation du flow anti-bot existant)
- **Email vérifié toujours requis** sur `sendContactMessage` (v0.9.106)
- **Idempotency `signupNotified`** préservée sur `notifyNewSignup` (anti-double notif)
- **CSP frontend inchangée** : seul le serveur (CF) parle à Discord, le client ne voit jamais l'URL webhook

### Rotation préconisée
Les URLs ont été transmises en clair dans la conversation. Recommandation : régénérer les 2 webhooks dans Discord (panel webhook → "Régénérer l'URL") puis re-set les secrets via `firebase functions:secrets:set NAME --data-file -` (stdin). Coût : 1 min.

### Cleanup futur
- Le secret `WEB3FORMS_KEY` reste déclaré (`defineSecret`) mais n'est plus attaché à aucune CF — pas d'impact. À retirer plus tard avec `firebase functions:secrets:destroy WEB3FORMS_KEY` (libère 1 secret slot)
- Pas de modification frontend nécessaire : les CFs gardent la même API (`name`, `message`, `plan`, `captchaToken`)

### Test
1. **Support** : `/contact` dans l'app → remplir form → envoyer → embed doit apparaître dans `#support-tickets`
2. **Signup** : créer un compte test → embed doit apparaître dans `#new-users`

### Impact
- **UX admin** : notifs Discord temps réel (mobile + desktop) au lieu d'emails → meilleure réactivité
- **Coût** : -$10/mois (Web3Forms Pro évité)
- **Sécu** : neutre / légèrement positive (validation regex en plus, mais Discord webhooks acceptent par défaut n'importe quel POST signé → on dépend de la confidentialité du secret comme avec Web3Forms)
- **Compat** : pas de breaking change client

### À surveiller
- Si Discord change le format d'URL webhook (improbable mais possible) → le regex `DISCORD_WEBHOOK_RE` devra être mis à jour
- Rate-limit Discord (30 req/min par webhook) → improbable pour un usage normal mais à monitorer si on ouvre largement

---

## 2026-05-14 — v0.9.122 — Pack sécu CODE (5 fixes : S36, S13, S20, S18, S21)

**Type** : security
**Fichiers** : `functions/index.js` (4 sites), `firestore.rules` (1 site), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.122 + CFs redéployées + rules redéployées

### Contexte
User : « vazy fait les trucs sécu on fera app check plus tard ». Pack de 5 fixes CODE faisables sans actions manuelles bloquantes, ciblant les findings sécu prioritaires du `docs/TODO.md`.

### Changements

#### S36 — Stripe webhook idempotency (`functions/index.js:902-930`)
Stripe peut retransmettre le même event jusqu'à 3 jours en cas d'échec de réception. Avant ce fix, chaque retry ré-activait Pro sur le user → risque de quotas faussés, double-comptabilisation Stripe.
**Solution** : avant le `switch(event.type)`, créer le doc `stripeWebhookEvents/{eventId}` via `.create()` (qui échoue si déjà existant). Si erreur `ALREADY_EXISTS` → retour 200 sans traitement. Sinon → on continue le switch normalement.
- TTL 30 jours via champ `expireAt` (TTL policy à activer côté console)
- Sanitization de `event.id` (regex `[A-Za-z0-9_]` pour pas écrire un path control char)
- Si autre erreur Firestore (rare), on log et on continue le traitement (mieux qu'un faux positif où Stripe retry indéfiniment)

#### S13 — TTL auditLogs (1 an, RGPD) (`functions/index.js:422-438`)
`_writeAuditLog()` (helper utilisé par toutes les CFs admin) ajoute désormais un champ :
```js
expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 365 * 24 * 60 * 60 * 1000)
```
**Action manuelle requise** : activer la TTL policy dans Firebase Console → Firestore → TTL → collection `auditLogs`, champ `expireAt`. Une fois activé, Firestore supprime auto les docs après leur `expireAt`.
**Impact RGPD** : rétention max 1 an des logs admin (suppression auto-déclenchée). Pas besoin de CF cron.

#### S20 — email_verified avant analyzeChart (`functions/index.js:70-73`)
Avant : un user pouvait créer un compte (email pas vérifié) et consommer immédiatement son quota IA (Groq Vision = $$$). Maintenant :
```js
if (!request.auth.token.email_verified) {
  throw new HttpsError('failed-precondition', 'Email verification required');
}
```
Insertion juste après `if (!request.auth)`. Pas de breaking change pour les users légitimes (Firebase envoie l'email de vérif automatiquement).

#### S18 — Pagination admin cleanupOrphanUserEmails (`functions/index.js:1073-1082`)
Avant : `db.collection('userEmails').get()` retournait TOUS les docs → risque timeout / exhaustion si la collection grossit.
Maintenant : `.limit(1000)` + champ `truncated: true` dans la réponse si la limite est atteinte. Si jamais on dépasse 1000 userEmails, l'admin doit relancer (rare en beta privée).

#### S21 — Retrait `isAdmin()` bypass myAccounts (`firestore.rules:98-117`)
Avant :
```
allow write: if isAdmin() || (request.auth.uid == userId && ...)
```
Maintenant :
```
allow write: if request.auth.uid == userId && ...
```
**Raison** : l'admin n'a pas besoin d'écrire les `myAccounts` d'un autre user (vérifié — aucun code dans `src/js/admin.js` ne fait ça). Le seul cas légitime (support) doit passer par une CF avec audit log immuable (traçabilité forcée). Si jamais un attaquant compromet le compte admin (XSS, token volé, MFA bypassé), il ne peut plus corrompre les `myAccounts` d'autres users via les rules client.

### Faux positif écarté
**Q12-14 memory leaks calendar.js** : l'Explore agent a signalé des `addEventListener` sans cleanup, mais `renderCalendar()` fait `el.innerHTML = '...'` à chaque render → les anciens DOM nodes (avec leurs listeners attachés) sont détachés et garbage-collected automatiquement par le browser. Pas de fuite réelle.

### Déploiement
- **Frontend** : `bash scripts/release.sh v0.9.122` (cache-bust `?v=` + footer)
- **CFs** : `firebase deploy --only functions:analyzeChart,functions:stripeWebhook,functions:cleanupOrphanUserEmails` (les 3 CFs touchées + `_writeAuditLog` utilisé par toutes les autres CFs admin → en pratique redéploiement total recommandé : `firebase deploy --only functions`)
- **Rules** : `firebase deploy --only firestore:rules`

### Action manuelle post-deploy
1. **Activer la TTL policy** dans [Firebase Console → Firestore → TTL](https://console.cloud.google.com/firestore/databases/-default-/ttl) :
   - Collection : `auditLogs`, champ : `expireAt`
   - Collection : `stripeWebhookEvents`, champ : `expireAt`
2. Tester la déconnexion + reconnexion + 1 analyse IA pour vérifier que `email_verified` ne bloque pas le compte admin
3. Si jamais `cleanupOrphanUserEmails` retournait `truncated: true` → relancer en boucle

### Impact
- **Sécu** : 5 findings clos, score sécu monte (subjectivement de 7 à 8/10 hors App Check)
- **UX** : neutre. Si un nouveau user oublie de vérifier son email → message explicite "Email verification required" au lieu d'une erreur quota cryptique
- **Perf** : neutre. La transaction d'idempotency ajoute ~50 ms par webhook Stripe → négligeable
- **Coût** : 2 nouvelles collections (`stripeWebhookEvents` + `expireAt` partout) → volume négligeable

### À surveiller
- Logs CF Stripe webhook : si on voit beaucoup de `duplicate event ignored` → ça confirme que l'idempotency capture bien les retries
- Vérifier que la TTL Firestore est active (Console GCP)

---

## 2026-05-14 — v0.9.121 — Fix logout : redirige vers la landing (index.html)

**Type** : fix / ux
**Fichiers** : `src/js/app.js` (2 sites), `src/js/pages/settings.js` (1 site), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.121

### Contexte
User signale : **« par contre quand je me déconnecte ça me met pas sur la landing page »**. Depuis le renommage v0.9.113 (`index.html` → `app.html`, `landing.html` → `index.html`), la déconnexion utilisait toujours `location.reload()` ce qui restait sur `/app.html` et re-déclenchait le modal de login. L'utilisateur s'attendait à être renvoyé sur la landing publique.

### Changements
Remplacement de `location.reload()` par `location.href = 'index.html'` aux 3 endroits qui déclenchent un logout :

1. **`src/js/app.js:124`** — bouton "Déconnexion" dans la sidebar/settings
   ```js
   // Avant
   Auth.logout();
   location.reload();
   // Après
   Auth.logout().finally(() => { location.href = 'index.html'; });
   ```
   (Avantage : `.finally()` garantit la redirection même si `signOut()` échoue — l'user atteint la landing dans tous les cas)

2. **`src/js/app.js:208`** — déconnexion auto après idle timeout (30 min sans activité)
   ```js
   Auth.logout().finally(() => { location.href = 'index.html'; });
   ```

3. **`src/js/pages/settings.js:945`** — après suppression définitive de compte
   ```js
   window.location.href = 'index.html';
   ```

### Sécurité
- `location.href = 'index.html'` est un **chemin relatif littéral**, pas d'interpolation utilisateur → **aucun risque d'open redirect**
- Même origine (`zeldaron.github.io/zeldtrade/`) → pas de cross-origin
- Le navigateur charge `index.html` proprement (nouvelle page), purge le state Firebase Auth en mémoire et le state Store
- `localStorage` clear déjà fait avant (`Store.clearLocalCache()`)
- Pour la suppression de compte : le `signOut()` Firebase se déclenche automatiquement côté SDK après `user.delete()`, et notre redirect garantit qu'aucun écran "blanc" / "loading" ne s'affiche

### Pourquoi `.finally()` au lieu de `.then()`
Si `Auth.logout()` rejette (erreur réseau, déjà signed-out, etc.), avec `.then()` la redirection ne s'exécuterait pas et l'user resterait bloqué sur l'app dans un état incohérent. `.finally()` garantit la sortie quoi qu'il arrive. C'est défensif — en pratique signOut() ne devrait quasi jamais échouer mais on couvre le cas.

### Impact
- **UX** : flow de déconnexion correct, l'utilisateur retourne à la landing publique d'où il peut se reconnecter ou explorer le contenu marketing
- **Sécu** : aucun risque ajouté (chemin littéral)
- **Compat** : `location.href` est universel, fonctionne tous navigateurs

### Bump version
- `src/app.html` : `?v=0.9.120` → `?v=0.9.121` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.121

### À surveiller
- Si le logout depuis admin.html doit aussi rediriger → vérifier `src/js/admin.js` (probablement déjà OK car page séparée)
- Penser à l'inverse en F4 v3 (TODO) : si user loggé arrive sur `index.html`, rediriger auto vers `app.html`

---

## 2026-05-14 — v0.9.120 — Revert sizing v0.9.119 + fix i18n manquantes (dash.empty.*)

**Type** : fix / revert
**Fichiers** : `src/css/style.css` (revert), `src/js/i18n.js` (+6 clés × 2 langues), `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.120

### Contexte
User envoie screenshot du Dashboard avec **les clés i18n brutes affichées en texte** (`dash.empty.title`, `dash.empty.text`, `dash.empty.step1/2/3`, `dash.empty.cta`). Ces clés sont utilisées dans `src/js/pages/dashboard.js` (U21 onboarding empty state, v0.9.111) avec `t('dash.empty.X') || 'fallback'` MAIS comme `t()` retourne la clé elle-même quand non trouvée (`(dict[lang] || dict.fr)[key] || (dict.fr[key] || key)` ligne 1145 de `i18n.js`), le `||` ne déclenche jamais. Résultat : les clés s'affichent en clair.

User demande aussi de **revert les tailles** : « reveins à la version d'avant pour la grosseur avant que tu fasses les modifs pour le téléphone ».

### Changements

#### 1. Fix i18n (`src/js/i18n.js`)
Ajout de 6 clés en FR + 6 en EN dans les dictionnaires `dict.fr` et `dict.en`, insérées après `'dash.in.progress'` pour grouper avec les autres `dash.*` :

```js
'dash.empty.title':  'Bienvenue sur ZeldTrade' / 'Welcome to ZeldTrade'
'dash.empty.text':   'Ajoute ton premier trade pour voir tes stats...' / 'Add your first trade to see your stats...'
'dash.empty.step1':  'Configure ton compte prop firm dans Réglages' / 'Set up your prop firm account in Settings'
'dash.empty.step2':  'Clique sur « + Nouveau trade » en bas de la sidebar' / 'Click « + New trade » at the bottom of the sidebar'
'dash.empty.step3':  'Suis le wizard 3 étapes (direction → screenshot → détails)' / 'Follow the 3-step wizard (direction → screenshot → details)'
'dash.empty.cta':    '+ Créer mon premier trade' / '+ Create my first trade'
```

#### 2. Revert sizing (`src/css/style.css`)
Toutes les valeurs modifiées en v0.9.119 reviennent aux valeurs d'avant :

| Élément | v0.9.119 | v0.9.120 (revert) |
|---|---|---|
| `.sidebar` width | 200 / 180 (<1280) | **220** / 200 (<1280) |
| `.logo` padding | `16 16 14` | **`22 20 18`** |
| `.logo-mark` | 24×24 | **28×28** |
| `.logo-text` | 13px | **15px** |
| `.nav` padding | 8px | **10px** |
| `.nav-item` font / padding | 12 / `6 9` | **13 / `8 10`** |
| `.nav-item svg` | 13×13 | **15×15** |
| `.sidebar-stats` | `10 12` | **`14 16`** |
| `.stat-label`, `.stat-val` | 10px | **11px** |
| `.new-trade-btn` | font 12 / pad 7 | **font 13 / pad 9** |
| `.topbar` height | 44 / 40 (<1280) | **52** |
| `.topbar-title` | 13px | **14px** |
| `.search-wrap` width | 200 / 180 (<1280) | **220** |
| `.trade-list` width | 280 / 260 (<1280) | **310** |
| `.chip` font / padding | 10.5 / `3 9` | **11 / `4 10`** |
| `.trade-item` padding | `9 12` | **`11 14`** |
| Media <1280px | très aggressif | **minimaliste** (juste sidebar 200 + nav-item 13) |

### Pourquoi ne pas avoir prévu le i18n manquant
v0.9.111 (Pack A U21) a ajouté l'empty state dans `dashboard.js` avec des clés `t('dash.empty.X') || 'fallback'`. Pattern correct EN APPARENCE car le `||` semble protéger. Sauf que la fonction `t()` retourne `key` (le nom de la clé) en dernier recours, qui est truthy. Le `||` ne déclenche donc jamais.

**Leçon** : à chaque nouvelle clé i18n ajoutée dans un fichier JS, ajouter immédiatement la clé dans `i18n.js`. Idéalement, écrire un test qui vérifie que toutes les `t('xxx')` du codebase ont une entrée dans `dict.fr` et `dict.en`.

**Mitigation possible (future)** : modifier `t()` pour retourner empty string `''` au lieu de `key` quand introuvable, OU logger en console les clés manquantes en dev. À mettre dans TODO.

### Impact
- **UX** : l'empty state du Dashboard affiche enfin du français/anglais correct
- **Sécu** : aucun impact. Les chaînes i18n sont littérales, statiques, échappées via `escHtml` quand passées dans innerHTML (`<h2>` reçoit du texte interpolé déjà)
- **Compat** : sizing revient exactement à v0.9.118. Pas de régression sur le responsive ou le wizard

### Bump version
- `src/app.html` : `?v=0.9.119` → `?v=0.9.120` (21 refs)
- `src/index.html` : footer
- `src/js/pages/changelog.js` : entrée 0.9.120

### À surveiller
- Si user signale d'autres clés i18n raw → grep `t('` dans `src/js/**/*.js` et vérifier chaque clé existe dans `i18n.js`
- Ajouter à TODO un test de cohérence i18n (script `node test/i18n-check.js` qui compare les `t('...')` aux clés du dict)

---

## 2026-05-14 — v0.9.119 — App : réduction globale ~12 % (compact mode)

**Type** : ui / compact
**Fichiers** : `src/css/style.css`, `src/app.html` (bump v=), `src/index.html` (footer), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.119

### Contexte
User signale **« tout est trop gros putain remet comme avant »** sur l'app (Journal page). Après dialogue : viewport laptop 13-14" (768-1280px CSS), souhait de réduction globale ~10-15 %. Le contraste avec la landing compacte (body 14px, mockup nav 12px) faisait paraître l'app proportionnellement trop massive.

### Changements (`src/css/style.css`)

**Base styles (toutes tailles d'écran)** :
- `.sidebar` : width 220 → **200px**
- `.logo` : padding `22 20 18` → **`16 16 14`**, gap 10 → 9
- `.logo-mark` : 28×28 → **24×24**, border-radius 7 → 6
- `.logo-mark svg` : 14×14 → **12×12**
- `.logo-text` : 15 → **13px**, letter-spacing 0.08em → 0.06em
- `.nav` : padding 10 → **8px**
- `.nav-item` : padding `8 10` → **`6 9`**, font 13 → **12px**, gap 9 → 8, margin-bottom 2 → 1
- `.nav-item svg` : 15×15 → **13×13**
- `.nav-divider` : margin `8 0` → `6 0`
- `.sidebar-stats` : padding `14 16` → **`10 12`**, gap 8 → 5
- `.stat-label` / `.stat-val` : 11 → **10px**
- `.new-trade-btn` : margin `12 12 16` → **`8 8 12`**, padding `9 0` → **`7 0`**, font 13 → **12px**
- `.topbar` : height 52 → **44px**, padding `0 24` → **`0 18`**, gap 12 → 10
- `.topbar-title` : 14 → **13px**
- `.search-wrap` : width 220 → **200px**, padding `6 12` → `5 10`, font 12 → **11px**
- `.trade-list` : width 310 → **280px**
- `.list-filters` : padding `10 10 8` → `8 10 6`, gap 5 → 4
- `.chip` : padding `4 10` → **`3 9`**, font 11 → **10.5px**
- `.trade-item` : padding `11 14` → **`9 12`**, gap 10 → 9

**Media query <1280px (laptops 13-14")** — désormais plus aggressive (avant : juste sidebar 200 + nav-item 13) :
- `.sidebar` : 180px de large
- `.logo-text` : 12px
- `.nav-item` : 11.5px font, padding `5 8`
- `.nav-item svg` : 12×12
- `.new-trade-btn` : font 11px, padding `6 0`
- `.sidebar-stats` : `8 10` padding
- `.stat-label` / `.stat-val` : 9.5px
- `.topbar` : 40px de haut, padding `0 14`
- `.topbar-title` : 12px
- `.search-wrap` : 180px width
- `.trade-list` : 260px
- `.chip` : 10px font, padding `3 8`
- `.trade-item` : padding `8 11`

### Préservé intact
- **Touch targets a11y (<768px)** : toutes les règles `min-height: 44px` (v0.9.109, U13) sont conservées. Sur mobile/tablette tactile, les boutons grandissent toujours à 44px min pour respecter les recommandations WCAG / Apple HIG
- **Responsive <480px / <360px** (v0.9.116) : règles inchangées
- **Stats, KPI, charts, modals, wizard** : non touchés (pas de régression sur ces zones)

### Pourquoi ne pas baisser plus
- À 11px on commence à pénaliser la lisibilité sur écran standard
- Touch a11y < 768px doit rester ≥ 44px (donc le compact mode ne s'applique qu'aux écrans pointeur fin)

### Impact
- **UX** : l'app respire dans le sens "moins est plus" et s'aligne visuellement avec la landing. Plus de contenu visible sans scroll
- **Sécu** : aucun impact, changements purement CSS de tailles. Pas de JS, pas de CSP, pas de nouvelle surface
- **Compat** : a11y mobile préservée (touch targets), `prefers-reduced-motion` toujours respecté

### Bump version
- `src/app.html` : `?v=0.9.118` → `?v=0.9.119` (21 refs)
- `src/index.html` : footer `v0.9.118` → `v0.9.119`
- `src/js/pages/changelog.js` : entrée 0.9.119 en tête de `ENTRIES`

### À surveiller
- Si l'user dit "trop petit maintenant" → augmenter d'1 cran (nav-item 12.5px, etc.)
- Si l'user dit "encore trop gros" → encore -1 cran (nav-item 11.5px, sidebar 180px de base)
- Tester sur écran >1280px (juste pour vérifier que la base est OK sans la media query)

---

## 2026-05-14 — v0.9.118 — Landing : mockup interactif 5 onglets (CSS-only, zéro JS)

**Type** : feat / ux / security
**Fichiers** : `src/index.html` (+~350 lignes), `src/app.html` (bump v=), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.118 (CFs inchangées)

### Contexte
User demande **« je veux pouvoir accèder au bouton et pouvoir avoir un petit apperçu pour chaque bouton c'est possible ? »** sur le mockup d'aperçu de l'app. Réponse : oui, en CSS pur (radio + `:checked ~` sibling combinator), donc aucun JS ajouté → aucun impact CSP / surface d'attaque.

### Pourquoi CSS-only et pas JS
- **CSP stricte** : `script-src 'self'` ne permet pas d'inline scripts. Pour ajouter du JS il faudrait soit créer `js/landing.js` (cache-busting + maintenance) soit relâcher la CSP avec un nonce/hash — surcoût pour rien
- **Zéro surface d'attaque ajoutée** : pas de listener click, pas d'état JS, pas de fetch
- **Fonctionne même JS désactivé** (les radios sont natifs)
- **A11y native** : tab + flèches naviguent dans le radio group, screen readers reconnaissent le pattern
- **Perf** : 0 ms d'init, 0 ko de JS, animations en compositor

### Pattern technique (radio + sibling)
```html
<div class="mockup-wrap">
  <input type="radio" name="mockup-tab" id="mt-dashboard" checked>
  <input type="radio" name="mockup-tab" id="mt-analytics">
  ... 3 autres
  <div class="mockup">
    <label for="mt-dashboard" class="mockup-nav-item">Dashboard</label>
    <label for="mt-analytics">Analytics</label>
    ...
    <div class="mockup-pane" data-pane="dashboard">...</div>
    <div class="mockup-pane" data-pane="analytics">...</div>
    ...
  </div>
</div>
```
```css
.mockup-wrap > input[type="radio"] { /* visually hidden but focusable */
  position: absolute;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  width: 1px; height: 1px;
}
.mockup-pane { display: none; }
#mt-dashboard:checked ~ .mockup .mockup-pane[data-pane="dashboard"] { display: block; }
#mt-dashboard:checked ~ .mockup label[for="mt-dashboard"] { /* active style */ }
/* idem pour 4 autres */
```

Le radio coché reste cliquable par son label (n'importe où sur la page peut linker un label à un input via `for=...`). Le `~` sibling combinator + `[data-pane="..."]` cible le pane correspondant. C'est un pattern bien éprouvé (utilisé par des sites majeurs pour navigation sans JS).

### Contenu des 5 panes

1. **Dashboard** (par défaut) — inchangé : 3 KPIs (Balance / P&L Net / Win rate) + graphe d'équité SVG dégradé violet→rose
2. **Analytics** — 3 KPIs (Trades total / R:R moyen / Profit factor) + bar chart "Perf par instrument" : 5 instruments (MNQ +1240, MES +860, MGC +540, CL +180, NQ -120) avec barres dégradé violet/rose ou rouge/orange
3. **Calendrier** — 3 KPIs (Mai 2026 / Best day / Worst day) + grille calendar 7×5 avec cellules colorées (4 niveaux : winx/win/loss/empty)
4. **Journal** — 3 KPIs (Cette semaine / Wins / Losses) + liste 6 trades (date, instrument, badge LONG/SHORT, P&L)
5. **Objectifs** — 3 KPIs (Actifs / Atteints / En cours) + 3 progress bars (Profit mensuel 78%, Trades/mois 70%, Win rate ✓ atteint)

### Changements CSS
- Nouvelles classes : `.mockup-pane`, `.mockup-block` (frame générique avec label/val absolus), `.mockup-bars`/`.mockup-bar-row`/`.mockup-bar-track`/`.mockup-bar-fill`, `.mockup-cal-grid`/`.mockup-cal-day` (win/winx/loss/empty), `.mockup-trades`/`.mockup-trade*`, `.mockup-goals`/`.mockup-goal*`
- `.mockup-nav-item` devient `<label>` cliquable (cursor: pointer, user-select: none, hover state)
- Animation `paneFade` (250ms ease-out) sur changement d'onglet
- `.mockup-main { min-height: 340px }` → garde une hauteur consistante entre les 5 panes
- Mobile (`<768px`) : `.mockup-sidebar` devient `display: flex; overflow-x: auto` → onglets en barre horizontale scrollable
- Mobile (`<640px`) : `.mockup-trade` et `.mockup-bar-row` réajustent leurs grilles

### Sécurité — bilan exhaustif (user a demandé « comment je fais pour que cela n'ai aucune faille »)
| Vecteur | Statut | Détail |
|---|---|---|
| CSP `script-src 'self'` | ✅ Inchangée | Zéro JS ajouté |
| CSP `connect-src 'none'` | ✅ Inchangée | Page reste sans fetch |
| CSP `img-src` / `font-src` | ✅ Inchangées | Tous SVG inline, aucun asset |
| XSS via radio names/ids | ✅ Safe | IDs `mt-*` sont littéraux, jamais interpolés |
| Form action | ✅ Safe | Radios pas dans un `<form>`, pas de soumission possible |
| Clickjacking | ✅ Inchangé | `X-Frame-Options: DENY`, `frame-ancestors 'none'` |
| Cookies / storage | ✅ Aucun | La page n'écrit/lit rien (le state radio est purement DOM) |
| A11y trap | ✅ OK | Radio group + arrow keys natif, focus visible géré par navigateur |
| Prefers-reduced-motion | ✅ Respecté | Animation `paneFade` désactivée si user préfère |

### Impact
- **UX** : la sidebar devient un vrai téaser interactif — l'utilisateur explore avant de cliquer "Accéder à l'app"
- **Perf** : +~350 lignes HTML/CSS, mais page reste un seul fichier statique ; tout est servi en 1 round-trip GitHub Pages. Le rendu de pane caché coûte 0 (display:none = pas de layout)
- **Bundle** : 0 ko JS ajouté
- **SEO** : tous les panes sont dans le DOM dès le départ → indexable même si Google ne simule pas les clics

### Bump version
- `src/app.html` : `?v=0.9.117` → `?v=0.9.118` (20 scripts + 1 CSS + 1 settings)
- `src/index.html` : footer `v0.9.117` → `v0.9.118`
- `src/js/pages/changelog.js` : entrée 0.9.118 en tête de `ENTRIES`

### À surveiller
- Comportement clavier : Tab amène sur le radio group, Arrow keys (Left/Right) doivent changer la sélection. Tester sur macOS Safari (qui a parfois des particularités sur radios visuellement cachés)
- Si un user signale que sur mobile la barre d'onglets horizontale n'est pas évidente, ajouter un indicateur visuel de scroll horizontal

---

## 2026-05-14 — v0.9.117 — Landing v2 : tailles réduites + visuels (mockup, stats, grid)

**Type** : feat / ux
**Fichiers** : `src/index.html`, `src/app.html` (bump v=), `src/js/pages/changelog.js`
**Versions impactées** : front v0.9.117 (CFs inchangées)

### Contexte
v0.9.115/116 : utilisateur signale encore que la landing est trop grosse sur grand écran et demande **« vraiment réduit c'est beaucoup trop gros et améliore la landing page peut-être avec des visuels cool »**. Il faut à la fois (a) réduire encore d'un cran les tailles globales, (b) ajouter des éléments visuels qui rendent la page plus engageante sans dépendre de captures externes (CSP stricte oblige, et on n'a pas encore de vraies UI screenshots presentables).

### Changements
- **Typographies réduites d'un cran** :
  - body : 15 → **14px**
  - hero-title : `clamp(26, 3.4vw, 42px)` → **`clamp(24, 2.6vw, 36px)`**
  - hero-sub : `clamp(14, 1.4vw, 17px)` → **`clamp(13, 1.1vw, 15px)`**
  - section-title : `clamp(22, 2.6vw, 30px)` → **`clamp(20, 2vw, 26px)`**
  - feature-title : 15 → **14px**, feature-desc : 13 → **12.5px**
  - pricing-title : 19 → **17px**
  - container max-width : 960 → **880px**, hero max-width : 760px
- **Visuels ajoutés (tout statique, aucun asset externe)** :
  - **Grille de fond** subtile via `body::before` (pattern 56×56px, opacité 2.5 %, masquée en radial pour fade vers le bas)
  - **Glows ambiants** via `body::after` (deux radiaux violet + rose, blur 40px) — atmosphère sans charger d'image
  - **Bande stats** 4 cellules : « 5 / Prop firms supportées », « ∞ / Trades illimités », « 100% / Données en Europe », « 0 € / Pendant la beta »
  - **Mockup app preview** complet : barre macOS (3 dots), titre `zeldtrade.app — Dashboard`, sidebar (5 nav items avec icônes SVG inline : Dashboard / Analytics / Calendrier / Journal / Objectifs), KPI row (Balance / P&L / Win rate), **graphe d'équité SVG** avec dégradé violet→rose + dégradé d'aire + grille pointillée + dot pulsant final
  - **Badge hero** avec dot pulsant (`@keyframes pulse`)
  - **Nouveau logo SVG** : chart trending up (au lieu du « Z » texte) — toujours dans un carré 28×28px avec gradient violet
  - Boutons primaires avec **dégradé violet** + box-shadow douce, hover translateY-1px + shadow plus marquée
  - Cartes feature : top accent line (linéaire violet) qui apparaît en hover + translateY-3px + shadow violette
  - Pricing : top accent line dégradé violet→rose
- **Responsive du mockup** :
  - <768px : sidebar masquée, mockup compacte (KPIs en row), chart 140px
  - <640px : nav links cachés, hero CTAs en colonne, padding réduits
  - <380px : stats en 1 colonne
- **Accessibilité** : `@media (prefers-reduced-motion: reduce)` désactive toutes les animations (pulse badge, transitions hover, smooth scroll)

### Impact
- **UX** : page beaucoup plus dense + plus « produit » (le mockup donne une idée concrète de l'app sans devoir naviguer)
- **Sécu** : ZÉRO changement de surface d'attaque
  - CSP inchangée : `script-src 'self'`, `img-src 'self' data:`, `connect-src 'none'`, `frame-src 'none'`
  - Aucune ressource externe ajoutée (tous SVG sont inline, aucun `<img>`, aucun lien CDN)
  - Aucune fonction JS ajoutée (page reste 100 % statique)
  - Pas de stockage local, pas de cookies, pas de fetch → pas de fuite de données possible
- **Perf** : HTML passe de ~570 → ~770 lignes (+35 %), mais reste un seul fichier statique servi par GitHub Pages. SVG inline = pas de round-trip. Grid + glows en `position: fixed` = repaints négligeables (transformés, pas reflowés)
- **Compat** : `backdrop-filter` + `mask-image` ont des fallbacks gracieux (le contenu reste lisible si le navigateur ne les supporte pas — testé Safari 14, Firefox 90, Chrome 90)

### Bump version
- `src/app.html` : tous les `?v=0.9.116` → `?v=0.9.117` (20 scripts + 1 CSS) + texte affiché `0.9.116` → `0.9.117`
- `src/index.html` : footer `v0.9.116` → `v0.9.117`
- `src/js/pages/changelog.js` : nouvelle entrée 0.9.117 en tête de `ENTRIES`

### À surveiller
- Si un user signale encore que « c'est trop gros » → option : passer body à 13px et hero clamp(22, 2.2vw, 32px) — mais à ce stade on risque de pénaliser la lisibilité mobile
- Si un user signale l'inverse (« c'est trop petit ») → augmenter container à 920px et body à 14.5px
- Le mockup est une représentation, pas une vraie capture. À remplacer par un screenshot réel quand l'app aura des données démo crédibles (F4 v2 dans TODO)

---

## 2026-05-14 — v0.9.116 — Responsive complet (5 breakpoints + print + a11y motion)

**Type** : feat / mobile / a11y
**Fichiers** : `src/css/style.css` (+~180 lignes en fin de fichier)

### Contexte
User demande "que toute l'application soit responsive selon l'écran". Avant : seul breakpoint 768px (mobile) + quelques 900px/500px isolés. Manquait : tablet, petit mobile, très petit mobile, print, accessibility motion.

### Changements

**Protection générique anti-overflow** (toujours appliquée) :
- `html, body { overflow-x: hidden; max-width: 100vw }`
- `img, video, iframe, canvas, svg { max-width: 100%; height: auto }`
- `.trade-setup, .trade-item-meta, .info-val, .feature-desc, .pricing-text, .faq-item p { word-wrap: break-word }`
- `.trade-item-body, .trade-item-meta, .info-row { min-width: 0 }` (flex children peuvent shrinker)
- Wrapper tables : `width: 100%; max-width: 100%`

**Breakpoints ajoutés** (en plus du 768px existant) :
- **1280px** (large tablet / 13" laptop) : sidebar 200px, nav-item 13px
- **1024px** (tablet portrait / petit laptop) : kpi-grid 2col, form-grid 1col, admin-table compact, modals 90vw
- **480px** (mobile portrait) : kpi-grid 1col, levels-row 2col, tables horizontal scroll, modals full-width, contact-bubble 48px
- **360px** (iPhone SE) : ultra-compact (padding 8px, font 10-12px, sidebar 200px)

**Media queries spéciaux** :
- `(max-width: 900px) and (orientation: landscape) and (max-height: 500px)` — landscape mobile (smartphones en mode paysage)
- `@media print` — sidebar/topbar/contact-bubble cachés, fond blanc, texte noir → pour impression journal
- `@media (prefers-reduced-motion: reduce)` — toutes animations forcées à 0.01ms → accessibility OS setting

### Analyse sécurité
- CSS uniquement, aucune surface JS
- `overflow-x: hidden` sur body peut techniquement empêcher du contenu de déborder qui devrait l'être — vérifié : pas de cas où on veut overflow horizontal sur body
- `word-wrap: break-word` peut couper des URLs longues en plein milieu — acceptable (déjà escape côté escHtml)

### Tests
- `node test/calc.test.js` : 103/103 ✓ (CSS pas concerné)
- Visual : à valider user-side sur différents devices

### À surveiller
- iPhone SE 1ère gen (320×568) : tester que rien ne déborde
- iPad portrait (768×1024) : tablet breakpoint actif, vérifier sidebar
- Tables admin avec beaucoup de users : scroll horizontal sur mobile fonctionne
- Charts Chart.js : `max-width: 100%` les contraint
- Print preview : tester avec Cmd+P sur le journal

### Évolutions futures possibles
- Container queries (modern CSS) pour responsive basé sur le container parent au lieu du viewport
- Dark/light theme toggle (actuellement forcé dark)
- Layout grid plus moderne (CSS Grid template areas par breakpoint)

---

## 2026-05-14 — v0.9.115 — Landing : ajustement tailles (anti gigantesque)

**Type** : fix / ux
**Fichiers** : `src/index.html` (landing)

### Contexte
User signale sur screenshot écran ~2000px de large que tout paraît hyper gros (titre hero 52px clamp, sub 19px, etc.). Sur écran < 1280px tailles OK, sur grand écran disproportionné.

### Changements
| Élément | Avant | Après |
|---|---|---|
| body | 16px | 15px |
| hero-title | clamp(28px, 5vw, 52px) | clamp(26px, 3.4vw, 42px) |
| hero-sub | clamp(15px, 2vw, 19px) | clamp(14px, 1.4vw, 17px) |
| section-title | clamp(24px, 4vw, 36px) | clamp(22px, 2.6vw, 30px) |
| section-sub | 16px | 14px |
| feature-title | 17px | 15px |
| feature-desc | 14px | 13px |
| pricing-title | 22px | 19px |
| pricing-text | 15px | 13px |
| faq summary | 15px | 14px |
| nav-brand | 18px | 17px |
| container max-width | 1100px | 960px |
| hero padding-top | 90px | 70px |
| letter-spacing hero | -1.5px | -0.8px |
| letter-spacing section | -0.8px | -0.5px |

### Impact
- Sur 2560px screen : hero plus mesuré (~42px au lieu de 52px)
- Sur 1440px screen : taille moyenne, équilibrée
- Sur 768px et moins : tailles min du clamp utilisées, lisibles
- Pas d'impact fonctionnel — uniquement CSS

### Tests
- `node test/calc.test.js` : 103/103 ✓ (pas concerné)
- Visual : à vérifier user-side

---

## 2026-05-14 — v0.9.114 — Fix flash ancien landingScreen au login

**Type** : fix / ux
**Fichiers** : `src/app.html` (suppression block 222 lignes), `src/js/app-bootstrap.js`

### Contexte
User signale qu'en cliquant "Se connecter" depuis la nouvelle landing publique (`/`), il voit brièvement (~200ms) l'ancien `landingScreen` interne d'`app.html` (hero "Le journal de trading pensé pour traders prop firm", preview, CTAs, FAQ) avant que Firebase Auth résolve et que le modal login apparaisse. Mauvaise UX double-landing.

### Cause root
`app.html` (ex-`index.html`) contenait un bloc `<div id="landingScreen">` (lignes 55-274) avec sa propre landing intégrée (créée avant qu'on ait la vraie landing externe). Au chargement de `app.html` :
1. HTML parse → `landingScreen` affiché par défaut
2. JS charge → Firebase Auth check (~300-800ms)
3. Si user loggé → fade-out landingScreen + lance app
4. Si pas loggé → landingScreen reste visible + user doit cliquer un de ses CTAs internes pour ouvrir le modal

Maintenant qu'on a une vraie landing à `/index.html`, le double-landing crée un flash visuel + confusion.

### Changements

**`src/app.html`** :
- Supprimé lignes 55-274 (`<!-- ══ LANDING PAGE -->` + `<div id="landingScreen">...</div>`) — 222 lignes total
- Ajouté `<style>html,body{background:#0d1117}</style>` inline avant `</head>` pour forcer le background dark avant que `style.css` charge (anti flash blanc)

**`src/js/app-bootstrap.js`** :
- Retiré `const landing = $('landingScreen')` (référence morte)
- Commenté les `bindOpen()` qui ciblaient les boutons inside landingScreen (btnNavLogin/btnNavRegister/btnHeroCta/btnHeroLogin/btnLandingFree/btnLandingPro/btnLandingLifetime)
- `launchApp()` : retiré le fade-out de `landing.style`, garde seulement le fade-out du loader
- `Auth.onAuthReady()` : ajouté `else { openModal('login'); }` — si pas loggé, ouvre directement le modal login au lieu d'afficher l'ancien landingScreen

### Analyse sécurité
- Pas de surface nouvelle créée
- Suppression de DOM mort → réduit la surface XSS potentielle (moins de markup, moins de strings)
- Pas de breaking change sur les flows existants (les boutons supprimés sont inside un bloc supprimé)
- `bindOpen()` est safe-on-missing-element (vérifie `if (!el) return`) — donc les `bindOpen` commentés étaient déjà no-op après la suppression du DOM

### Vérification
- `node -c src/js/app-bootstrap.js` : syntax OK
- `node test/calc.test.js` : 103/103 ✓ (impact data integrity pas Calc)
- File size : `app.html` passé de 1180 lignes à 958 lignes (-19%)

### Comportement utilisateur

| Cas | Avant v0.9.114 | Après v0.9.114 |
|---|---|---|
| Visiteur clique "Se connecter" sur landing | Flash de l'ancien landingScreen → puis modal login | Modal login direct (clean) |
| User loggé arrive sur `/app.html` direct | Flash de l'ancien landingScreen → puis app | Loader → app (clean) |
| User déconnecté arrive sur `/app.html` direct | Voit l'ancien landingScreen (page entière) | Modal login affiché directement sur fond dark |

### À surveiller
- Si le user a un bookmark `/app.html` direct et veut juste voir une page d'accueil avant login, il tombe maintenant sur le modal login (cohérent — pour la marketing il y a `/`)
- F4 v2 prévu : routing auto (loggé sur `/` → redirect vers `/app.html`) — pas encore implémenté

---

## 2026-05-14 — v0.9.113 — Landing devient la page d'accueil principale

**Type** : feat / refactor
**Fichiers** : `src/index.html` (ex-landing.html), `src/app.html` (ex-index.html), `src/js/pages/changelog.js`, `docs/README.md`

### Contexte
User veut que `/zeldtrade/` affiche la landing (au lieu de l'écran de login de l'app). Avant : `index.html` = app SPA. Après : `index.html` = landing marketing.

### Changements
- `git mv src/index.html src/app.html` (préserve l'historique)
- `git mv src/landing.html src/index.html`
- Nouveau `index.html` (ex-landing) : tous les `href="index.html"` (Se connecter, Accéder à l'app) → `href="app.html"`
- `og:url` mis à jour : `/landing.html` → `/`
- `nav-brand` href : `landing.html` → `index.html`
- `payment.html`, `legal.html`, `cgu.html`, `privacy.html` : les `href="index.html"` (Retour à ZeldTrade) restent valides — pointent maintenant vers la landing (cohérent avec "Retour à la page d'accueil")

### Vérification déploiement
- `curl https://zeldaron.github.io/zeldtrade/` → 200 + contenu landing ✅
- `curl https://zeldaron.github.io/zeldtrade/app.html` → 200 ✅
- Pas de 404 sur les autres pages

### Analyse sécurité
- Pas de changement fonctionnel — juste rename + redirection des liens
- CSP de chaque page inchangée (les CSPs sont définies dans chaque .html)
- Les bookmarks existants `zeldaron.github.io/zeldtrade/` montrent maintenant la landing — comportement attendu

### À surveiller
- Users existants qui ont bookmark `/zeldtrade/` verront la landing au lieu de l'app au prochain visit — non disruptif (1 clic vers "Accéder à l'app")
- Si on veut migrer plus tard vers Firebase Hosting, le mapping `/ → index.html` et `/app.html → app.html` est natif
- **F4 v2** prévu : routing automatique (si Firebase Auth user loggé → redirect vers app.html, sinon affiche landing) — pas encore implémenté

---

## 2026-05-14 — v0.9.112 — Landing page v1 (F4)

**Type** : feat
**Fichiers** : `src/landing.html` (nouveau)

### Contexte
User demande F4 — page d'accueil publique. Spec validée du hero : « Un journal de trading complet fait par un trader pour les traders ». v1 minimaliste mais propre, déployable en l'état.

### Changements
- Nouveau fichier `src/landing.html` (770 lignes — HTML + CSS inline auto-contenu)
- 100% statique : aucun JS Firebase, aucun script externe, CSS inline (pas de dépendance à style.css pour isoler la page)
- CSP ultra-stricte : `default-src 'self'; script-src 'self'; connect-src 'none'; frame-src 'none'`
- Sections : nav sticky → hero + badge bêta + 2 CTAs → 6 features → pricing stealth → FAQ 6 questions → footer
- Design cohérent app (palette dark, accent violet, font-family système)
- Responsive : breakpoint 640px (CTAs en stack vertical, nav allégée)
- Liens internes : index.html (app), legal.html, cgu.html, privacy.html — déjà présents dans /src/
- Mailto direct vers zeldtradepro@gmail.com pour demande d'accès

### Analyse sécurité

| Vecteur | Mitigation |
|---|---|
| XSS via params URL | Aucun JS dynamique, aucune lecture de query/hash params |
| Tracking pixels | `connect-src 'none'` empêche toute requête externe |
| Clickjacking | `X-Frame-Options DENY` + `frame-ancestors 'none'` |
| Mailto malicieux | mailto fixe vers zeldtradepro@gmail.com hardcoded |
| Liens externes opener | Pas de `target="_blank"` externes (uniquement liens internes /src/*.html) |
| Police externe / fonts | font-family système uniquement, pas de Google Fonts |
| Cookies tiers | Aucun JS, donc aucun cookie créé par cette page |
| SEO leak (mention v0.9.112) | Footer affiche version — acceptable, déjà publique |

### Décisions design
- **Pas de routing automatique** entre landing.html et index.html dans cette v1 (pour ne pas casser index.html). À ajouter en v2 : si user loggé sur index → laisser ; si non loggé → optional redirect to landing.
- **Pas de screenshots** dans v1 (placeholder design suggéré par sections vides). À ajouter quand on aura de vrais screens propres de l'app.
- **Mailto plutôt que form contact** : évite la dépendance à `sendContactMessage` CF et au captcha. Direct = simple.

### Déploiement
- v0.9.112 push GitHub Pages
- Accessible : https://zeldaron.github.io/zeldtrade/landing.html
- Note : pas encore branché à la racine — user peut soit linker manuellement depuis ses canaux de promo, soit configurer GitHub Pages pour servir landing.html en page d'index.

### Évolutions v2 prévues
- Screenshots réels de l'app (Journal, Dashboard, Wizard) lazy-loaded
- Témoignages bêta-testeurs (quand récoltés)
- Routing auto : non-loggé → landing, loggé → app
- Branding plus poussé (logo SVG custom, palette affinée)
- Animations subtles (fade-in scroll, hover sur features cards)

---

## 2026-05-14 — v0.9.111 — Pack A : 5 quick wins UX (U34+U21+U24+U20+U27)

**Type** : feat + ux
**Fichiers** : `src/js/app.js`, `src/js/ui.js`, `src/js/pages/dashboard.js`, `src/js/pages/calendar.js`, `src/js/modal.js`, `src/css/style.css`

### Contexte
Pack A demandé par user — 5 fixes UX rapides à fort impact sur l'expérience.

### Changements

**U34** — Scroll-to-top au switchPage
- `app.js switchPage()` : `window.scrollTo({top: 0, behavior: 'instant'})` après l'activation de page
- Scroll aussi le `<main>` si présent (selon le layout)

**U21** — Dashboard empty state
- `pages/dashboard.js renderDashboard()` : early-return avec markup empty si `Store.getTrades().length === 0`
- 3 étapes guidées + CTA intelligent (redirect Settings si pas de compte, sinon ouvre wizard)
- CSS `.dash-empty*` ajouté

**U24** — Compteur résultats journal
- `ui.js renderList()` : `<div class="list-counter">X / N trades</div>` en sticky top si `filtered.length < total`
- Échappe les nombres via interpolation simple (number type uniquement, pas user-controlled)
- CSS `.list-counter` sticky top

**U20** — Bouton "Aujourd'hui" calendrier
- `pages/calendar.js` : nouveau `<button id="calToday">` entre les chevrons prev/next
- Handler : reset `calMonth + calYear` au mois/année courant
- CSS `.cal-today-btn` hover violet

**U27** — Groupe wizard visible
- `modal.js populateApexSelect()` : option groupe affiche `⬡ Nom (N comptes)` au lieu de juste `⬡ Nom`
- Nouveau hint `wGroupHint` injecté lazy sous le select au change
- Affiche "Ce groupe va créer N trades" avec escape strict du nom (regex anti-XSS)
- Si groupe vide : warning rouge "Groupe vide — aucun trade ne sera créé"

### Analyse sécurité (par fix)

| Fix | Vecteur potentiel | Mitigation |
|---|---|---|
| U34 | `window.scrollTo` n'a pas de surface XSS | N/A |
| U21 | Texte i18n statique, pas d'interpolation | Strings via `i18n.t()` ou littéraux |
| U24 | Compteur = nombre de filtered.length / total.length | Pas de string user-controlled |
| U20 | Click handler reset state | N/A |
| U27 | Nom du groupe injecté dans hint via innerHTML | Escape regex inline `<>"'&` AVANT innerHTML |

### Tests
- `node test/calc.test.js` : 103/103 ✓
- `node -c` syntax check : app.js, ui.js, modal.js, dashboard.js, calendar.js — OK

### Déploiement
- v0.9.111 push GitHub Pages (live)

### À surveiller
- Empty state Dashboard : si user ajoute son 1er trade puis le supprime, l'empty state réapparaît (comportement attendu)
- Compteur recherche : sticky top peut overlap si scroll très rapide (acceptable)
- Bouton "Aujourd'hui" : à tester sur écrans étroits — peut wrap si label long
- Hint groupe : si nom de groupe contient des emojis multibytes, l'escape inline les laisse passer (OK, emojis pas dangereux)

---

## 2026-05-14 — v0.9.110 — Pack C robustesse data (Q11+Q15+Q17+Q44+Q49+Q52)

**Type** : fix + security
**Fichiers** : `src/js/store.js`, `src/js/modal.js`

### Contexte
Pack C demandé par user. 6 fixes silencieux de robustesse data, sans changement UX visible.

### Changements détaillés

**Q11** — `_sanitizeTrade` date floor : 2010-01-01 → 1990-01-01
- Anti epoch 0 / dates négatives conservé
- Mais accepte les imports d'archives 15+ ans

**Q17** — `activatePro()` garde-fou type
- Early-return false si `typeof code !== 'string' || !code.trim()` AVANT le throttle
- Évite crash sur appel programmatique sans code
- Pas de pénalité throttle pour un input vide

**Q52** — Import JSON double-escape
- Nouveau helper `_unescHtmlStore(s)` inverse de `_escHtmlStore` (ordre crucial : `&amp;` en dernier)
- Dans `importTrades`, on unescape setup/notes AVANT le `_sanitizeTrade`
- Idempotence restaurée : export → import = état stable

**Q49** — Race compression screenshots
- Token incrémental `_shotCompressionToken` dans `modal.js`
- À chaque check après await : `if (myToken !== _shotCompressionToken) return;`
- Seul le DERNIER paste écrit l'UI (les précédents abandonnés silencieusement)

**Q44** — Paste handlers dédupliqués
- Avant : 3 handlers (1 step 2 document.addEventListener + 1 step 3 document.addEventListener + 1 shotZone.addEventListener)
- Après : 1 seul handler document qui route selon `wp2/wp3` visible
- Logic step 3 préservée : si focus dans input texte + clipboard a du texte, on laisse passer

**Q15** — `initForUser` await-able
- Retourne maintenant la Promise (au lieu de fire-and-forget)
- Backward-compat : `app-bootstrap.js launchApp` continue d'appeler sans await
- Permet aux futurs callers d'await pour éviter le flicker UI au 1er render

### Analyse sécurité (par fix)

| Fix | Risque potentiel | Mitigation |
|---|---|---|
| Q11 | Dates négatives ou epoch 0 acceptées | Floor 1990 + check isFinite + regex ISO stricte |
| Q17 | activatePro(0/false) bypass throttle | Check `typeof === 'string'` strict |
| Q52 | _unescHtmlStore mal ordonnée → re-encode | Tests : `'&amp;lt;'` → `'<'` (vérifié manuellement) |
| Q49 | Token reset au close modal | OK : token global session, reset implicite à chaque paste |
| Q44 | Step 2/3 mal détectés → mauvais handler | Check `.style.display !== 'none'` strict, fallback `return` si ni step 2 ni step 3 |
| Q15 | Breaking change si caller attendait sync return | Retourne Promise, le pattern fire-and-forget reste valide |

### Tests
- `node test/calc.test.js` : 103/103 ✓ (impacts data integrity pas Calc)

### À surveiller
- Si user paste 3 images rapidement, vérifier que la 3ème s'affiche (pas la 1ère)
- Si user fait export JSON → import JSON, vérifier que `setup` reste identique
- Sur mobile, vérifier que le paste step 2 (IA chart) marche toujours après dédupliquage

---

## 2026-05-13 — v0.9.109 — Touch targets mobile ≥ 44×44 px (U13)

**Type** : feat / a11y
**Fichiers** : `src/css/style.css`

### Contexte
Pack E demandé par user. Tous les éléments interactifs (boutons, chips, croix, nav, calendrier, inputs) faisaient parfois <30 px sur mobile → mistaps fréquents.

### Analyse sécurité
| Vecteur | Mitigation |
|---|---|
| Casser layout desktop | `@media (max-width: 768px)` uniquement |
| Touch trop large = clics accidentels | 44×44 est le standard WCAG/Apple HIG, pas plus |
| Régression composants | `min-height/min-width` au lieu de `height/width` fixe (préserve contenu) |

### Changements
- `src/css/style.css` : bloc `@media (max-width: 768px)` ajouté en fin de fichier avec règles min 44×44 px sur :
  - `.chip` (filtres journal)
  - `.btn-ghost/.btn-primary/.btn-secondary/.btn-gen/.btn-delete/.btn-stripe/.btn-revoke/.btn-copy`
  - `.wiz-close/.wi-clear-btn` (croix wizard, étaient 12×12 px)
  - `.user-pill` (sidebar 56 px)
  - `.nav-item`
  - `.detail-back-btn`
  - `.dir-btn` (LONG/SHORT, 56 px car action principale)
  - `.wiz-pill` (pills éditables step 2)
  - `.cal-day` (calendar)
  - `.admin-tab/.stats-tab`
  - `.cookie-banner button`
  - `.modal-actions button`
  - `.contact-bubble` (56 px)
  - **Inputs : `font-size: 16px`** (évite le zoom auto iOS lors du focus, comportement par défaut < 16px)

### Impact
- Mobile UX : énorme gain — plus de touch frustrations
- Desktop : aucun changement (média query)
- iOS focus zoom : éliminé

### À surveiller
- Tester sur device réel iOS / Android pour valider qu'aucun composant ne déborde
- Si user ouvre un trade dont le détail panel est en `bottom sheet` mobile, vérifier que tous les boutons sont scrollables

---

## 2026-05-13 — Features F3 (export PDF Pro) + F4 (landing page) ajoutées à la TODO

**Type** : docs (TODO)

### Contexte
User demande 2 features à planifier :
1. **F3** Export PDF des trades sur une période donnée (avec screenshots, valeurs) — **Pro only**
2. **F4** Landing page clean pour visiteurs non-loggés

### Specs validées
- **F3** : période sélectionnable, PDF complet (screenshot inclus pour chaque trade), stats globales en page de garde, lib client-side (jsPDF + html2canvas) — pas de CF nécessaire
- **F4** : design cohérent app (dark), responsive, sections hero/features/screenshots/pricing/FAQ/footer

### Changements
- `docs/TODO.md` : F3 + F4 ajoutées dans section "Nouvelles features demandées"

### À surveiller
- F3 : attention à la taille du PDF si user a 1000+ trades sur la période — paginer ou limiter
- F3 : screenshots Firebase Storage doivent être convertis en base64 (CORS-aware) pour l'embed PDF
- F4 : SEO important si on veut attirer du trafic organique plus tard (meta tags, OG, robots.txt actuellement noindex)

---

## 2026-05-13 — v0.9.108 — Wizard mémorise dernier compte + instrument (U31)

**Type** : feat
**Fichiers** : `src/js/store.js`, `src/js/modal.js`

### Contexte
Demande user (TODO U31) : éviter de re-sélectionner manuellement le même compte + instrument à chaque trade quand on trade toujours le même setup.

### Analyse sécurité avant implémentation

| Vecteur | Mitigation |
|---|---|
| XSS via valeur stockée injectée | Pré-sélection via `select.value` (si pas dans options, ignoré) ; aucun innerHTML ✅ |
| Cross-user leak | Clé localStorage namespacée `ztrade_${_uid}_lastWizard` + `purgeForeignCache` au login ✅ |
| Compte supprimé persistant | Validation au read : `myAccounts.some(a => a.name === raw.apex)` sinon ignore ✅ |
| Groupe supprimé persistant | Validation au read : `groups.some(g => g.id === gid)` sinon ignore ✅ |
| Instrument retiré (ex QO1) | Regex stricte `/^[A-Za-z0-9/. _-]{1,20}$/` + tronqué 20 chars ✅ |
| Manipulation localStorage par DevTools | Pré-sélection visuelle uniquement, sanitize stricte à la save trade ✅ |

### Changements
- `store.js` : nouveaux helpers `getLastWizardPrefs()` + `setLastWizardPrefs({apex, instrument})` avec clé namespacée + validation stricte au read
- `modal.js open()` mode création : lit les prefs, pré-sélectionne le compte (ou groupe) + l'instrument via `parsedTrade.instrument` qui sera consommé par `fillStep3FromParsed`
- `modal.js save()` mode création (pas édition) : appelle `setLastWizardPrefs` avec data.apex + data.instrument

### Tests
- `node test/calc.test.js` : 103/103 ✓ (pas d'impact sur calc)

### Impact
- UX : gain de temps significatif pour les traders qui trade toujours le même compte/instrument (cas le plus courant)
- Sécu : aucun risque introduit, validation stricte protège contre les manipulations DevTools

### À surveiller
- Si user a 2 comptes "Apex 50K" et "Apex 50K bis" : la pref garde le dernier exact utilisé
- Pas de migration nécessaire (clé localStorage absente = comportement actuel = fallback default)

---

## 2026-05-13 — v0.9.107 — Modale confirm custom + cleanup orphelins + Dependabot

**Type** : security + feat + admin + docs
**Fichiers** : `src/js/ui.js`, `src/js/admin.js`, `src/js/pages/settings.js`, `functions/index.js`, `.github/dependabot.yml`, `docs/HOSTING_MIGRATION.md`, `src/js/pages/changelog.js`

### Contexte
Sprint demandé par user pour atteindre "sécurisé et fonctionnel un minimum" sans dépendance manuelle. Approche paranoïaque : pour chaque ajout, lister les vecteurs d'attaque et les mitiger.

### Changements

**U1 — Modale confirm custom** :
- `ui.js confirmModal({title, message, confirmText, cancelText, danger}) → Promise<bool>`
- DOM API pure (`createElement` + `textContent`) — zéro `innerHTML` user-interpolé (anti-XSS fail-safe)
- Focus par défaut sur **Cancel** (anti clic réflexe destructif)
- Escape = cancel (UX standard, safer que confirm)
- Single-modal : si une modale est déjà ouverte, on l'annule (résolve false)
- Anti memory leak : `closeConfirmModal()` retire le keyboard handler global
- Remplace `confirm()` natif dans : `ui.js` (delete trade), `settings.js` (delete account + delete group), `admin.js` (confirme uniquement le bouton supprime orphelins, on garde le natif intentionnellement pour la confirmation finale destructive)

**B2 — cleanupOrphanUserEmails Cloud Function** :
- Admin only (email + email_verified + isAdmin chain)
- App Check enforced (anti-bot)
- maxInstances=1 (admin solo, pas de raison de paralléliser)
- Mode DRY-RUN obligatoire (`data.confirm:false`) avant vraie suppression
- Audit log "in_progress" écrit AVANT toute action destructive (traçabilité même en crash)
- Détecte les `userEmails` orphelins via `admin.auth().getUser(uid)` → catch `auth/user-not-found`
- Si confirm:true : supprime `userEmails/{uid}` + `proCodeHashes` where uid + `users/{uid}/data/*` + `users/{uid}` (best effort)
- UI admin (Config tab) : 2 boutons "Analyser" puis "Supprimer", le bouton Supprimer est désactivé jusqu'à dry-run réussi
- Construction UI via DOM API (createElement + textContent) — pas d'innerHTML user-interpolé

**I8 — Dependabot config** :
- `.github/dependabot.yml` : weekly schedule (lundi 08:00 Europe/Paris)
- `open-pull-requests-limit: 5` (anti spam)
- `ignore` major updates sur firebase-functions, firebase-admin, stripe (review manuel obligatoire avant breaking migration)
- Audit /functions (npm) + /  (github-actions)
- Security updates restent prioritaires (Dependabot les sort même si major ignored)

**Préparation Firebase Hosting** :
- `docs/HOSTING_MIGRATION.md` créé avec :
  - Config `firebase.json` complète prête à coller (8 headers strict)
  - HSTS max-age 2 ans + preload
  - CSP réelle (vs meta partiellement ignoré)
  - COOP same-origin + CORP same-origin (anti spectre/cross-origin attacks)
  - Permissions-Policy exhaustive
  - Cache headers (HTML no-cache, assets 1h)
  - X-Robots-Tag noindex sur `/admin.html`
  - Plan en 9 étapes + rollback rapide
  - Score sécurité attendu : Mozilla Observatory A+, SSL Labs A+
- **Non déployé** — attend que user fasse `firebase init hosting` (interactif)

### Sécurité — analyse vecteurs d'attaque mitigés

| Vecteur | Mitigation |
|---|---|
| XSS via message confirmModal interpolé | textContent only, jamais innerHTML |
| Memory leak handlers keyboard | removeEventListener dans closeConfirmModal |
| Multiple modales superposées | _activeConfirmResolve unique, cancel l'ancien |
| Clic réflexe destructif | Focus par défaut sur Cancel |
| cleanupOrphanUserEmails appelé en boucle | maxInstances=1 + admin check + audit log |
| Suppression user actif par erreur | DRY-RUN obligatoire + button désactivé après init |
| getUser() throw autre erreur que not-found | check explicite `e.code === 'auth/user-not-found'` |
| Dependabot PR malicieuse cassante | ignore major updates sur paquets critiques |

### Tests
- `node test/calc.test.js` : 103/103 ✓
- `node -c` syntaxe : ui.js + admin.js + settings.js OK

### Déploiement
- Cloud Function `cleanupOrphanUserEmails` créée et déployée
- Site v0.9.107 sur GitHub Pages

### À surveiller / Activations manuelles user
- Dependabot ne sera actif qu'après push sur GitHub (auto-discovery par GitHub)
- Firebase Hosting attend `firebase init hosting` puis copy/paste du config
- Bouton "Cleanup orphelins" admin testable maintenant (mode dry-run safe)

---

## 2026-05-13 — B3 fix critique : rule userEmails blocklist bloquait l'admin

**Type** : security fix
**Fichiers** : `firestore.rules`

### Contexte
La blocklist username (`admin|zeldtrade|zeldaron|support|staff|moderator|root|system`) introduite en v0.9.95 bloquait également le compte admin lui-même. Quand l'admin a recréé son compte et tenté de se relogger sur l'app principale, `auth.js _storeUserEmail` essayait d'écrire `userEmails/{uid}` avec username "Admin" → rule rejette → admin.html n'affichait plus la ligne admin → impossible de générer un nouveau code Pro pour le bon UID.

### Changements
- `firestore.rules` `userEmails write` : ajout d'un bypass de la blocklist pour `request.auth.token.email == 'zeldtradepro@gmail.com'`. Le check whitelist caractères (`^[A-Za-z0-9._\- ]+$`) reste actif.

### Impact
- ✅ Admin peut maintenant recréer son `userEmails` au login
- ✅ Bonus : prévient le bug à l'avenir si le user supprime/recrée son compte
- ⚠️ Léger risque si l'email admin est compromis : il pourrait écrire un username "admin" (mais ça n'a pas de conséquence — il EST admin de toute façon)

### À surveiller
- User doit se relogger sur l'app principale après ce deploy pour que `_storeUserEmail` se déclenche
- Vérifier que `userEmails/jGJReBgxVKMqe7bWkFi3mm7lMB22` existe ensuite dans Firestore
- Refresh admin.html → ligne admin réapparaît

---

## 2026-05-12 — B1 diagnostiqué : code Pro orphelin après recréation admin

**Type** : bug investigation

### Contexte
User a recréé son compte admin `zeldtradepro@gmail.com` via Firebase Console (suite à la perte de password). Les artefacts Firestore de l'ancien UID (`UfnQrAQNPDU8DAffxzXVYT8AyDN2`) n'ont pas été nettoyés. Du coup `userEmails` contient 2 entrées pour le même email. Quand l'admin a généré un code Pro via admin.html, il a cliqué la mauvaise ligne (l'ancienne) → code attribué à l'ancien UID → `Match UIDs: NON` à l'activation.

### Diagnostic technique
- Hash code `ZELD-MW2N-MWAT-KN7U` normalisé : `532de3ebfb28258c55343d3466268dbccae27a12c1e72caf917d0efa6319b455`
- `proCodeHashes/{hash}.uid` = `UfnQrAQNPDU8DAffxzXVYT8AyDN2` (ancien)
- `firebase.auth().currentUser.uid` = `jGJReBgxVKMqe7bWkFi3mm7lMB22` (nouveau)
- Rule `users/{userId}/data/plan` exige `get(proCodeHashes/{hash}).data.uid == request.auth.uid` → rejet

### Solution proposée
- Manuel immédiat : modifier le doc `proCodeHashes/{hash}` dans Firebase Console pour mettre le bon UID, OU supprimer tous les artefacts orphelins
- Long terme (B2) : ajouter détection des `userEmails` orphelins dans admin.html (badge ⚠ doublon)

### À noter
- La Cloud Function `deleteUserAccount` aurait nettoyé tout proprement (`userEmails` + `proCodeHashes` + `users/{uid}/data/*` + soft-delete archive). Le bug vient de la suppression manuelle via Firebase Console qui bypass la CF.
- À documenter : si on doit recréer un compte admin à l'avenir, **toujours** passer par `deleteUserAccount` CF d'abord (ou faire le cleanup Firestore manuel).

---

## 2026-05-12 — Features F1 + F2 ajoutées à la roadmap : type de trading au signup

**Type** : docs (TODO)

### Contexte
User demande au signup de demander quel type de trader (multi-choix). MVP : Fonds propres / Prop firm. Crypto plus tard (F2).

### Spécifications validées
- **Choix multiples** : un user peut cocher Fonds propres ET Prop firm
- **"Fonds propres"** = capital personnel hors prop firm
- **UI adaptative** : si uniquement fonds propres → masquer toute la section Prop Firms (Apex trailing, drawdown rules, daily loss limit, presets). Si les 2 → UI actuelle.
- **Onboarding rétroactif** : modal bloquante au 1er login pour les users existants qui n'ont pas répondu (vu petit pool, faisable)
- **Détails techniques à venir** : user précisera schéma data, flow exact modale, instruments par défaut, calculs risk adaptés

### Changements
- `docs/TODO.md` : F1 + F2 dans section "🆕 Nouvelles features demandées"

### Impact
- Roadmap claire pour la prochaine grosse feature
- Pertinent aussi pour pricing futur (offres différenciées fonds propres vs prop firm)

### À surveiller
- Avant implémentation : attendre les specs détaillées du user
- Migration : schéma `userEmails` doit accepter le nouveau champ `tradingTypes`
- Tester l'onboarding rétroactif sur un compte existant qui n'a pas le champ

---

## 2026-05-12 — v0.9.106 — Sprint sécu + stats correctes + perf groupe

**Type** : security + fix + perf
**Fichiers** : `src/js/calc.js`, `src/js/ui.js`, `src/js/store.js`, `src/js/modal.js`, `src/js/i18n.js`, `src/js/pages/outils.js`, `functions/index.js`

### Contexte
Sprint demandé par user pour atteindre "site sécurisé et fonctionnel un minimum" sans dépendre des actions manuelles. 6 fixes faisables en code direct.

### Changements

**Q4-Q5 — NaN dans Calc.trade** :
- `calc.js` : early-return zeros + flag `invalid:true` si entry/sl/tp1 manquants ou non-finite. Anti propagation NaN dans totalPnL/winrate/equity. Tous les renderers qui font `c.netPnl || 0` étaient compromis silencieusement.

**Q3 — Winrate cohérent** :
- `ui.js statsForTrades` + `store.js getStats` : winrate basé sur `c.netPnl > 0` au lieu de `outcome === 'win'`. Un trade `outcome=be` avec partial profitable compte maintenant comme gagnant. Inclut aussi BE dans le pool des trades fermés pour le winrate (cohérent).
- Bonus perf : 1 seul passage `Calc.trade(t)` au lieu de 2-3 (anciens reduce séparés).

**U4 — Loading state** :
- `modal.js save` : bouton "Enregistrer" → "Enregistrement…" pendant la sauvegarde, restauré à la fin via `finally`.
- `i18n.js` : ajout `wiz.saving` FR/EN.

**Q10 — Retirer QO1** :
- Retiré de `store.js DEFAULT_SPREADS` et `DEFAULT_SPREADS_BY_FIRM` (4 firms)
- Retiré de `pages/outils.js` (instruments du calculateur)
- Retiré de `modal.js INSTR_CAT`
- **Conservé** dans `calc.js POINT_VALUES` + `modal.js VALID_INSTRS` + `pages/settings.js` pour rétro-compat trades historiques.

**S10 — hCaptcha serveur** :
- `functions/index.js` : nouvelle fonction `_verifyHcaptcha(token)` qui POST vers `api.hcaptcha.com/siteverify`.
- Mode dégradé : si `HCAPTCHA_SECRET` est absent ou `placeholder`, on log warning et on accepte. Permet déploiement sans bloquer.
- Appelé dans `sendContactMessage` et `notifyNewSignup` AVANT l'envoi Web3Forms.
- Nouveau secret `HCAPTCHA_SECRET` (placeholder pour l'instant — à setter avec vraie valeur côté hCaptcha dashboard).

**S11 — Magic bytes serveur** :
- `analyzeChart` : décode `imageB64.slice(0, 24)` en buffer, vérifie signatures PNG / JPEG / WebP / GIF. Reject sinon avec `invalid-argument`. Rollback quota.
- Anti MIME-spoofing : un attaquant qui appelle directement la CF avec un PDF/exécutable encodé en base64 est bloqué.

**S17 — Unicode bidi strip** :
- `_sanitizeText` : strip caractères Unicode bidi (`U+200B`-`U+200F`, `U+202A`-`U+202E`, `U+2066`-`U+2069`, `U+FEFF`) en plus des control chars. Anti-spoofing emails admin (U+202E RLO peut renverser visuellement un nom).

**Q1 — Batch writes mode groupe** :
- `store.js` : nouvelle fonction `addTradesBatch(tradeList)` qui ajoute tous les trades en mémoire puis fait **1 seul `_saveTrades()`** au lieu de N.
- `modal.js save` mode groupe : utilise `addTradesBatch` au lieu de `grp.accountIds.map(Store.addTrade)`.
- Perf : groupe de 10 comptes = 1 write Firestore au lieu de 10 → 10× plus rapide, 10× moins de coût.

### Tests
- `node test/calc.test.js` : **103/103 ✓** (aucune régression sur les calculs)

### Déploiement
- Cloud Functions : `analyzeChart`, `sendContactMessage`, `notifyNewSignup` redéployées
- Site : v0.9.106 sur GitHub Pages
- Nouveau secret `HCAPTCHA_SECRET` (placeholder) — à activer manuellement quand le user voudra la vérif hCaptcha stricte

### Impact
- Stats : enfin justes (winrate ne ment plus, NaN éliminés)
- Perf groupe : 10× pour les users multi-comptes
- Sécu CFs : 3 couches supplémentaires (magic bytes, hCaptcha, bidi strip)
- UX save : feedback clair

### À surveiller
- Si user voit "100% winrate" surprise → vérifier qu'aucun trade n'a `outcome: be` + manualPnl positif inattendu
- Migration HCAPTCHA_SECRET (manuel) : à faire dans hCaptcha dashboard → copier la "Secret key" → `firebase functions:secrets:set HCAPTCHA_SECRET`
- Mode groupe : tester sur un compte réel avec 2-3 comptes (perf perceptible si >5)

---

## 2026-05-12 — email_verified remis dans isAdmin() (rules + 4 CFs admin)

**Type** : security
**Fichiers** : `firestore.rules`, `functions/index.js`

### Contexte
User a vérifié son email admin (`zeldtradepro@gmail.com`) via `sendEmailVerification()` côté client. Reset de l'exception temporaire #2 documentée dans SECURITY.md.

### Changements
- `firestore.rules` `isAdmin()` : retire le commentaire temporaire, remet `&& request.auth.token.email_verified == true`
- `functions/index.js` : remet `|| !request.auth.token.email_verified` dans :
  - `deleteUserAccount` (ligne 394)
  - `generateProCode` (ligne 578)
  - `revokeProCode` (ligne 665)
  - `createCheckoutSession` (ligne 762)
- Deploy : rules + 3 CFs admin (`createCheckoutSession` pas redeploy car placeholders Stripe — sera reset au prochain deploy global)

### Impact
- ✅ Couche supplémentaire d'auth admin restaurée (un password volé seul ne suffit plus pour appeler les CFs admin)
- ✅ SECURITY.md exception #2 résolue → score auth admin +1
- ⚠️ Si un autre user veut un jour devenir admin, il devra vérifier son email avant

### À surveiller
- Vérifier que admin.html marche toujours (login + renderUsers + renderCodes + actions)
- Token client se rafraîchit à chaque login → si bug persiste = forcer logout/login

---

## 2026-05-12 — Audit consolidé 4 axes + docs/TODO.md créé

**Type** : docs
**Fichiers** : `docs/TODO.md` (nouveau), `docs/CHANGELOG-DEV.md`

### Contexte
Audit complet via 4 agents parallèles (sécu, qualité code, UX, infra) — 150+ findings consolidés. User veut bosser à budget zéro jusqu'à 1ère vente.

### Changements
- Création de `docs/TODO.md` : liste priorisée (15 CRITIQUE / 25 HAUT / 45 MOYEN / 65 BAS) avec distinction code vs manuel + plan d'attaque semaine 100% gratuit
- Stratégie validée : tout faisable à 0€ jusqu'à 1ère vente
- Recommandation infra : Firebase Hosting `zeldtrade.web.app` (free tier) au lieu de domaine custom payant
- Score sécurité visé : 9/10 sans dépenser un centime

### Impact
- Le user a une roadmap claire pour la semaine
- Future Claude (moi en session suivante) pourra reprendre le suivi via [docs/TODO.md](TODO.md)

### À surveiller
- Mettre à jour `TODO.md` à chaque action terminée (rayer + date)
- Findings critiques manuels (I1, I3, I5a/b/c, I6) sont prerequis pour activer les fixes code critiques (S1, S2 surtout)

---

## 2026-05-12 — v0.9.105 — Admin access débloqué + CSP fix

**Type** : fix + security
**Fichiers** : `firestore.rules`, `src/admin.html`
**Versions** : front 0.9.105, rules deployées

### Contexte
Le user a complètement perdu l'accès à `admin.html`. Diagnostic :
1. Rules Firestore exigeaient `email_verified == true` dans `isAdmin()` → bloquait toutes les lectures admin (renderUsers, renderCodes)
2. CSP admin.html n'autorisait pas `https://apis.google.com` (chargé par Firebase Auth pour reCAPTCHA invisible)

### Changements
- `firestore.rules` : `isAdmin()` retire le check `email_verified == true` (gardé email check uniquement)
- `src/admin.html` : `script-src` + `connect-src` ajoutent `https://apis.google.com` + `https://*.run.app`
- Cloud Functions admin (deleteUserAccount, generateProCode, revokeProCode, createCheckoutSession) : retire `|| !request.auth.token.email_verified`

### Impact
- ✅ Admin redevient accessible (login + actions)
- ⚠️ Sécurité légèrement dégradée (email_verified plus enforce) — acceptable car l'email admin est unique côté Firebase Auth
- À réactiver dès que `email_verified` du compte admin est `true` (cf SECURITY.md exception 2)

### À surveiller
- Le user a recréé manuellement le compte `zeldtradepro@gmail.com` (l'ancien UID est perdu)
- Vérifier que les codes Pro générés avant ne pointent plus vers cet ancien UID (sinon orphelins)

---

## 2026-05-12 — v0.9.104 — App Check init désactivé côté client

**Type** : fix
**Fichiers** : `src/js/firebase.js`

### Contexte
reCAPTCHA Enterprise retournait 401 → App Check SDK ne pouvait pas obtenir de token → cascade d'erreurs sur tous les appels Firebase (Auth signup/signin, Firestore reads, etc.).

### Changements
- `firebase.js` : commente le bloc `firebase.appCheck().activate(...)` → le SDK n'essaie plus d'obtenir de token
- Doc dans les commentaires sur comment réactiver (3 vérifs reCAPTCHA Enterprise key + App Check Apps + IAM role)

### Impact
- ✅ Les appels Firebase ne sont plus pollués par les tokens App Check invalides
- ⚠️ Plus de protection anti-bot au niveau App Check
- Mitigation : auth Firebase + isAdmin() + rate-limits Firestore restent en place

### À surveiller
- Côté Firebase Console App Check : Authentication doit rester en "Monitoring" (pas "Enforce") sinon les requêtes seront rejetées par le serveur

---

## 2026-05-12 — v0.9.103 — Backend Stripe stealth

**Type** : feat
**Fichiers** : `functions/index.js`, `functions/package.json`, `src/admin.html`, `src/js/admin.js`, `firestore.rules`

### Contexte
Préparation pour passage commercial. User a validé pricing : 19.90€/mois, 179€/an, 399€ lifetime (50 places). Veut **prix non publics** : seul l'admin envoie des liens checkout personnalisés aux bêta-testeurs.

### Changements

**Backend** :
- `functions/package.json` : ajout `stripe@^16.0.0`
- `functions/index.js` :
  - Nouvelle CF `createCheckoutSession` (admin only) — génère un Checkout link Stripe pour un user donné
  - Nouvelle CF `stripeWebhook` (`onRequest`, signature obligatoire) — gère `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`
  - 5 secrets `STRIPE_*` ajoutés en `defineSecret`
- `firestore.rules` : nouvelle collection `users/{uid}/data/stripe` (read owner, write CF only)

**Admin UI** :
- `src/admin.html` : modale Stripe (sélecteur tier, génération lien, copy URL)
- `src/js/admin.js` : `openStripeModal`, `doGenerateStripeLink`, `copyStripeUrl`
- Nouveau bouton `💳 Lien Stripe` dans la liste users

**Frontend public** : **AUCUN changement** (modèle stealth — rien de visible côté user)

### Impact
- UX user : zéro changement (par design — bêta-testeurs et nouveaux comptes voient exactement la même app)
- UX admin : nouveau bouton pour générer des liens checkout perso
- Sécurité : `stripeWebhook` valide signature HMAC obligatoirement, secrets en Secret Manager

### À surveiller / À FAIRE manuellement par le user
- Créer compte Stripe FR + 3 produits + récupérer prix_ids + webhook secret
- Setter les 5 secrets : `firebase functions:secrets:set STRIPE_SECRET_KEY` etc.
- Deploy : `firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook`

---

## 2026-05-12 — v0.9.102 — Hardening post-audit

**Type** : security + fix
**Fichiers** : `functions/index.js`, `src/js/store.js`, `src/js/modal.js`, `src/js/ui.js`, `src/js/auth.js`

### Contexte
Audit complet (4 agents parallèles) après v0.9.101. Trouvé plusieurs bugs critiques.

### Changements

**CRITIQUE — flow admin débloqué** :
- `enforceAppCheck` désactivé sur `deleteUserAccount`, `generateProCode`, `revokeProCode` (App Check cassé bloquait le flow admin "Activer Pro")

**CRITIQUE — cross-tenant** :
- `store.js _sanitizeTrade` : `screenshotPath` validé STRICTEMENT contre `_uid` courant (regex `users/${_uid}/trades/...`)
- Anti DevTools injection : un trade ne peut plus référencer le screenshot d'un autre user

**CRITIQUE — RGPD** :
- `auth.js deleteAccount` : supprime TOUS les screenshots Storage (`trades.filter(t => t.screenshotPath)`) avant `user.delete()`
- Sans ça les images restaient à vie dans le bucket → violation article 17

**HAUTS** :
- `modal.js handleShotFromBlob` : validation magic bytes (anti MIME-spoofing) + garde-fou taille 10 MB raw
- `ui.js openLightbox` : reconstruction via `createElement` + `src=` setter (plus d'`innerHTML` avec URL interpolée)
- `modal.js partial close` : rejet strict [1, 99]% (avant : 100% accepté à tort)
- `ui.js renderDetail` : affiche "(ignoré — P&L manuel)" si manualPnl override le partial

### Impact
- ✅ Score posture XSS/injection passe à 9.5/10
- ✅ Conformité RGPD article 17 (effacement)
- ⚠️ Score Cloud Functions à 7/10 (3 CFs sans App Check)

---

## 2026-05-12 — v0.9.101 — Sortie partielle (scale-out)

**Type** : feat
**Fichiers** : `src/js/store.js`, `src/js/calc.js`, `src/index.html`, `src/js/modal.js`, `src/js/ui.js`

### Contexte
Retour d'un bêta-testeur : besoin de tracker les trades où on prend 50% à mi-chemin puis on déplace le SL à BE. Aujourd'hui marqué BE mais le P&L réel est positif.

### Changements
- `_sanitizeTrade` : ajout `partialPercent` (1-99) et `partialPrice`
- `calc.trade()` : si `hasPartial` → P&L pondéré `pFrac × (partialPrice - entry) + (1-pFrac) × (resolvedExit - entry)`
- `index.html` : nouveau toggle "Sortie partielle (scale-out)" au step 3 du wizard
- `modal.js` : handlers du toggle + champs + intégration dans `save` et `wRecalc`
- `ui.js renderDetail` : ligne "Partial close: X% à Y" dans l'info card

### Impact
- UX : nouvelle feature, optionnelle (toggle off par défaut)
- Stats : un trade avec partial+BE pour l'outcome `be` mais P&L positif compte dans les stats. **À discuter** : devrait-il compter comme "win" pour winrate ? Pour l'instant non.

### À surveiller
- Tests `node test/calc.test.js` couvrent 3 variantes partial (BE/TP/SL) → tous passent

---

## 2026-05-11 — v0.9.100 — Lightbox screenshot dans détail trade

**Type** : feat
**Fichiers** : `src/js/ui.js`

### Contexte
User demandait que le screenshot soit visible **instantanément** quand on clique sur un trade dans le journal (pas seulement en édition).

### Changements
- `ui.js renderDetail` : nouvelle section "📸 Screenshot" qui charge async depuis Firebase Storage
- Click sur l'image → lightbox plein écran (overlay rgba 0.92, X de fermeture, Escape support)

### Impact
- UX : screenshot visible direct sur le panel détail
- Perf : charge async (placeholder "Chargement…")

---

## 2026-05-11 — v0.9.98 — Screenshots persistants (Firebase Storage)

**Type** : feat
**Fichiers** : `src/index.html`, `src/js/modal.js`, `src/js/store.js`, `src/js/firebase.js`, `functions/index.js`, `storage.rules`, `firebase.json`

### Contexte
User demandait : "quand je fais Ctrl+V un screenshot du trade, qu'il reste en stockage pour l'user et reste enregistré à vie sauf si on supprime le profil".

### Décision archi
- **Firebase Storage** (pas Firestore base64, pas localStorage) → 5GB free tier, sync cross-device, RGPD EU
- Path : `users/{uid}/trades/{tradeId}/screenshot.jpg`
- Compression client-side avant upload : JPEG max 1920×1080, qualité 0.85 → 0.4 si nécessaire (target <2 MB)

### Changements
- `firebase.json` : ajout section `storage`
- `storage.rules` : owner only + size 2MB max + content-type whitelist
- `src/index.html` : SDK firebase-storage-compat + CSP `firebasestorage.googleapis.com` + `*.firebasestorage.app` + zone screenshot UI au step 3
- `firebase.js` : init `_fbStorage`
- `store.js` :
  - `_sanitizeTrade` accepte `screenshotPath`
  - Helpers `uploadTradeScreenshot`, `getTradeScreenshotUrl`, `deleteTradeScreenshot`
  - `deleteTrade` supprime aussi le screenshot Storage
  - `addTrade` accepte `id` pré-généré (pour upload AVANT save)
- `modal.js` :
  - State : `shotBlob`, `shotExistingPath`, `shotPendingDelete`, `pendingTradeId`
  - Handlers : paste, drag&drop, file picker, replace, delete
  - Compression : `compressImage(blob, maxDim, quality)` via canvas
  - Save : upload puis attache `screenshotPath`
- `functions/index.js` `deleteUserAccount` : supprime aussi `users/{uid}/` du bucket Storage

### Impact
- 🟢 Feature majeure UX
- 🟢 RGPD : effacement Storage géré (cleanup à delete trade ET delete account)

---

## Versions précédentes (synthèse rapide)

Avant 0.9.98, les modifications suivantes ont été faites (cf `src/js/pages/changelog.js` pour le détail user-facing) :

- **0.9.95-0.9.97** : 5 ultraréview sécurité (rules hardening, Cloud Functions hardening, RGPD privacy.html, soft-delete users)
- **0.9.93** : Fix critique activation Pro (rule plan create→write)
- **0.9.94** : Suppression utilisateur admin (Cloud Function `deleteUserAccount` initiale)
- **0.9.89-0.9.92** : Premiers audits ultraréview (CSP, magic bytes, quota AI atomique, etc.)
- **< 0.9.89** : Itérations early-stage (cf changelog.js user)

---

## Conventions pour ajouter une entrée

À chaque nouvelle release ou modification non-trivial :

1. **Ajouter** une nouvelle section EN HAUT (juste sous "Format des entrées"), avec la date et la version
2. Utiliser le format ci-dessus avec **Contexte / Changements / Impact / À surveiller**
3. Ne **jamais** modifier les anciennes entrées (sauf typo correction marquée par `[edit YYYY-MM-DD]`)
4. Si une modification annule une précédente : type `revert` + référencer l'entrée annulée

Cela permet à Claude (et à toi) de retrouver le contexte d'une décision, même 6 mois après.
