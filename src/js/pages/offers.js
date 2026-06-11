// ─── PAGE OFFRES ──────────────────────────────────────────────────────────────
// v0.9.198 : refonte commerciale — taglines, bénéfices, toggle annuel, trust banner,
// bandeau Founding scarcité, 6 FAQ. Lots 1+2+3+4 du plan marketing.

UI.renderOffers = function () {
  const el   = document.getElementById('offersContent');
  const plan = Store.getPlanInfo();
  // v0.9.211 — Détection du tier actif parmi 4 (trader / funded / elite / beta)
  const tier = plan.tier || (plan.plan === 'pro' ? 'beta' : 'trader');
  const isTrader = tier === 'trader';
  const isFunded = tier === 'funded';
  const isElite  = tier === 'elite';
  const isBeta   = tier === 'beta';
  const pro      = !isTrader; // backward compat — Founding Members et payants
  const t    = k => i18n.t(k);
  const tv   = (k, v) => i18n.t(k, v);
  const isEn = i18n.getLang() === 'en';

  const activatedDate = pro && plan.activatedAt
    ? new Date(plan.activatedAt).toLocaleDateString(i18n.locale(), { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── Status banner ──────────────────────────────────────────────────────────
  const tierLabel = isBeta ? 'VIP' : isElite ? 'Elite' : isFunded ? 'Funded' : 'Trader';
  const statusBanner = pro
    ? `<div class="pro-active-banner">
        <div class="pro-active-icon">${isBeta ? Icons.svg('sparkle',24) : ''}</div>
        <div>
          <div class="pro-active-title">${(t('off.plan.active') || 'Plan %s actif').replace('%s', tierLabel)}</div>
          <div class="pro-active-sub">${activatedDate ? tv('off.pro.active.sub', { date: activatedDate }) : (t('off.pro.active.full') || 'Accès complet à toutes les fonctionnalités')}</div>
        </div>
      </div>`
    : '';

  // ── Founding scarcity banner (uniquement Trader — déjà cible) ──────────────
  const foundingBanner = '';

  // ── Billing toggle (Monthly / Yearly) ──────────────────────────────────────
  const billingToggle = `
    <div class="billing-toggle" role="tablist" aria-label="Billing period">
      <button type="button" class="billing-toggle-btn active" data-billing="monthly" role="tab" aria-selected="true">${t('off.billing.monthly')}</button>
      <button type="button" class="billing-toggle-btn" data-billing="yearly" role="tab" aria-selected="false">${t('off.billing.yearly')} <span class="billing-toggle-save">−2 ${isEn ? 'mo' : 'mois'}</span></button>
    </div>`;

  // ── Plan possédé + CYCLE réel (mensuel/annuel) ─────────────────────────────
  // v0.9.317 (bug "Actif sur l'annuel") : le "Plan actuel / Actif" doit refléter le
  // CYCLE réellement souscrit, pas seulement le palier — sinon on affiche "Actif" sur
  // le prix annuel alors que l'abonné est au mensuel. Le cycle vient de Stripe
  // (getStripeInfo().cycle, persisté par le webhook depuis v0.9.317) ; pour les
  // abonnements antérieurs, fallback heuristique sur la durée jusqu'à currentPeriodEnd.
  const _s2          = (Store.getStripeInfo && Store.getStripeInfo()) || {};
  const ownedTier    = isElite ? 'elite' : (isFunded || isBeta) ? 'funded' : 'trader';
  const isPayingOwned = isFunded || isElite;          // bêta / gratuit : pas de cycle de facturation
  const ownedCycle   = !isPayingOwned ? null
    : (_s2.cycle === 'monthly' || _s2.cycle === 'yearly') ? _s2.cycle
    : (() => {                                         // fallback : déduire du currentPeriodEnd
        const cpe = _s2.currentPeriodEnd;
        if (typeof cpe === 'number' && cpe > 0) {
          const ms = cpe > 1e12 ? cpe : cpe * 1000;    // tolère secondes ou millisecondes
          return ((ms - Date.now()) / 86400000) > 45 ? 'yearly' : 'monthly';
        }
        return 'monthly';
      })();
  const defaultCycle = ownedCycle || 'monthly';        // le toggle s'ouvre sur le cycle réel

  // CTA d'une carte NON possédée (checkout ou « inclus »). OFF-1 : pas de bouton
  // d'upgrade si le palier est déjà couvert (Elite max, ou bêta = accès complet).
  const ctaCheckout = (cardTier) => {
    if (isBeta)               return `<div class="pricing-cta included">${isEn ? 'Included' : 'Inclus'}</div>`;
    // Trader : « Inclus » par défaut ; pour un abonné payant → bouton de retour au gratuit (résiliation).
    if (cardTier === 'trader')return isPayingOwned
      ? `<button type="button" class="pricing-cta ghost" data-cancel-sub>${t('off.cta.downgrade.free')}</button>`
      : `<div class="pricing-cta included">${isEn ? 'Included' : 'Inclus'}</div>`;
    // Funded : abonné Elite → bouton de rétrogradation ; sinon checkout Funded.
    if (cardTier === 'funded')return isElite
      ? `<button type="button" class="pricing-cta ghost" data-checkout-tier="funded">${t('off.cta.downgrade.funded')}</button>`
      : `<button type="button" class="pricing-cta primary" data-checkout-tier="funded">${t('off.cta.funded.btn')}</button>`;
    return `<button type="button" class="pricing-cta ghost-elite" data-checkout-tier="elite">${t('off.cta.elite.btn')}</button>`;
  };

  // Bits "current" d'une carte : classe `.current`, attributs cycle, tag coin, CTA bas.
  // Pour le palier possédé PAYANT, l'état "Actif" suit le cycle affiché (basculé en JS
  // par applyCycle) ; l'autre cycle montre « Tu es au mensuel/annuel » (pas de bouton →
  // évite une 2ᵉ souscription / double facturation).
  const cardBits = (cardTier) => {
    if (cardTier !== ownedTier) return { cls: '', attrs: '', corner: '', cta: ctaCheckout(cardTier) };
    const corner = `<div class="pricing-current-tag">✓ ${t('off.current')}</div>`;
    if (!isPayingOwned)        // Trader gratuit ou bêta → toujours actif (pas de cycle)
      return { cls: ' current', attrs: '', corner,
        cta: `<div class="pricing-cta current">✓ ${isTrader ? t('off.cta.cur') : t('off.cta.act')}</div>` };
    const otherLabel = isEn
      ? (ownedCycle === 'yearly' ? "You're on yearly" : "You're on monthly")
      : (ownedCycle === 'yearly' ? "Tu es à l'annuel" : 'Tu es au mensuel');
    return {
      cls: ' current',
      attrs: ` data-owned-card data-owned-cycle="${ownedCycle}"`,
      corner,
      cta: `<div class="pricing-cta current" data-owned-active>✓ ${t('off.cta.act')}</div>`
         + `<div class="pricing-cta included" data-owned-other style="display:none">${otherLabel}</div>`,
    };
  };
  const bF = cardBits('funded'), bE = cardBits('elite');   // v1.0.5 : carte Trader (gratuit) retirée

  // v1.0.5 : carte TRADER (gratuit) retirée — modèle 100% payant + essai 14j. cardBits('trader')
  // n'est plus appelé ; la résiliation passe par le portail Stripe (Réglages / flow cancel).

  // ── Card : FUNDED (14.99 €/mois — featured) ──────────────────────────────
  const cardFunded = `
    <div class="pricing-card featured${bF.cls}"${bF.attrs}>
      ${bF.corner}
      <div class="pricing-badge-row"><span class="pricing-badge">${t('off.popular')}</span></div>
      <div class="pricing-card-name">Funded</div>
      <p class="pricing-card-tagline">${t('off.funded.tag')}</p>
      <div class="pricing-launch">${t('off.launch')}</div>
      <div class="pricing-card-price">
        <span data-price-monthly><s class="price-old">14,99 €</s> 8,99 €<span class="price-suffix">/ ${t('off.month')}</span></span>
        <span data-price-yearly style="display:none">${t('off.funded.yearly')}</span>
      </div>
      <div class="pricing-card-perday">
        <span style="color:#4ade80;font-weight:600">${t('off.trial')}</span>
      </div>
      <ul class="pricing-features">
        <li>${t('off.funded.f1')}</li>
        <li>${t('off.funded.f2')}</li>
        <li>${t('off.funded.f3')}</li>
        <li>${t('off.funded.f4')}</li>
        <li>${t('off.funded.f5')}</li>
        <li>${t('off.funded.f6')}</li>
        <li>${t('off.funded.f7')}</li>
      </ul>
      ${bF.cta}
    </div>`;

  // ── Card : ELITE (29.99 €/mois) ───────────────────────────────────────────
  const cardElite = `
    <div class="pricing-card elite${bE.cls}"${bE.attrs}>
      ${bE.corner}
      <div class="pricing-badge-row"><span class="pricing-badge-elite">${isBeta ? 'VIP' : 'Premium'}</span></div>
      <div class="pricing-card-name">Elite</div>
      <p class="pricing-card-tagline">${t('off.elite.tag')}</p>
      <div class="pricing-launch">${t('off.launch')}</div>
      <div class="pricing-card-price">
        <span data-price-monthly><s class="price-old">29,99 €</s> 17,99 €<span class="price-suffix">/ ${t('off.month')}</span></span>
        <span data-price-yearly style="display:none">${t('off.elite.yearly')}</span>
      </div>
      <div class="pricing-card-perday">
        <span style="color:#4ade80;font-weight:600">${t('off.trial')}</span>
      </div>
      <ul class="pricing-features">
        <li>${t('off.elite.f1')}</li>
        <li>${t('off.elite.f2')}</li>
        <li>${t('off.elite.f3')}</li>
        <li>${t('off.elite.f4')}</li>
        <li>${t('off.elite.f5')}</li>
        <li>${t('off.elite.f6')}</li>
      </ul>
      ${bE.cta}
    </div>`;

  // ── Trust banner ───────────────────────────────────────────────────────────
  const trustBanner = `
    <div class="trust-banner">
      <span class="trust-item">✓ ${t('off.trust.cancel')}</span>
      <span class="trust-item">✓ ${t('off.trust.trial')}</span>
      <span class="trust-item">✓ ${t('off.trust.export')}</span>
      <span class="trust-item">✓ ${t('off.trust.nocb')}</span>
    </div>`;

  // ── Comparison table ──────────────────────────────────────────────────────
  const perWeek = isEn ? '/week' : '/semaine';
  const rows = [
    { f: t('off.row.journal'),       tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.dashboard'),     tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.calendar'),      tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.goals'),         tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.calculators'),   tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.accounts'),      tr: '1',          fu: '10',    el: '∞' },
    { f: t('off.row.ai'),            tr: '2' + perWeek, fu: '7' + perWeek, el: '∞' },
    { f: t('off.row.groups'),        tr: '✗',          fu: '✓',     el: '✓' },
    { f: t('off.row.pdf'),           tr: '✗',          fu: '✓',     el: '✓' },
    { f: t('off.row.support'),       tr: t('off.row.support.std'),  fu: t('off.row.support.prio'), el: t('off.row.support.elite') },
    { f: t('off.row.beta'),          tr: '✗',          fu: '✗',     el: '✓' },
    { f: t('off.row.roadmap'),       tr: '✗',          fu: t('off.row.roadmap.prio'), el: t('off.row.roadmap.decisive') },
  ];

  const colColor = (v, isEl) => {
    if (v === '✓') return isEl ? '#f59e0b' : 'var(--green)';
    if (v === '✗') return 'var(--muted)';
    return 'var(--amber)';
  };

  const compareRows = rows.map(r => `
    <div class="offer-compare-row">
      <span class="offer-compare-feature">${r.f}</span>
      <span class="offer-compare-pro"   style="color:${colColor(r.fu, false)}">${r.fu}</span>
      <span class="offer-compare-lt"    style="color:${colColor(r.el, true)}">${r.el}</span>
    </div>`).join('');

  // v0.9.384 : section d'activation de code retirée de l'UI publique.
  // Le backend Store.activatePro reste actif pour usage admin via URL `?activatePro=CODE`
  // (handler dans app.js). Permet de filer un accès à un influenceur sans champ public.
  const promoSection = '';

  // ── Render ────────────────────────────────────────────────────────────────
  el.innerHTML = `
    <div class="offers-wrap">
      <div class="offers-header">
        <h1>${t('off.title')}</h1>
        <p>${t('off.sub')}</p>
      </div>

      ${statusBanner}
      ${foundingBanner}

      ${billingToggle}

      <div class="pricing-cards">
        ${cardFunded}
        ${cardElite}
      </div>

      ${trustBanner}

      <div class="lifetime-band">
        <div>
          <div class="lifetime-band-title">${isEn ? 'Or go lifetime' : "Ou l'accès à vie"}</div>
          <div class="lifetime-band-sub">${isEn ? 'Pay once, yours forever — unlimited, no subscription.' : "Tu paies une fois, c'est à toi à vie — illimité, sans abonnement."}</div>
        </div>
        <button type="button" id="lifetimeCta" class="btn-primary lifetime-cta">${isEn ? 'Lifetime — €299.90 →' : 'Lifetime — 299,90 € →'}</button>
      </div>

      ${promoSection}

      <div class="offer-compare">
        <div class="offer-compare-title">${t('off.compare.full')}</div>
        <div class="offer-compare-row offer-compare-header">
          <span>${t('off.compare.feat')}</span>
          <span class="offer-compare-pro">Funded</span>
          <span class="offer-compare-lt">Elite</span>
        </div>
        ${compareRows}
      </div>

      <div class="offers-faq">
        <h3>${t('off.faq.title')}</h3>
        <div class="faq-item"><b>${t('off.faq.1q')}</b><p>${t('off.faq.1a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.2q')}</b><p>${t('off.faq.2a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.4q')}</b><p>${t('off.faq.4a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.5q')}</b><p>${t('off.faq.5a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.6q')}</b><p>${t('off.faq.6a')}</p></div>
      </div>
    </div>
  `;

  // ── Billing toggle logic ──────────────────────────────────────────────────
  // v0.9.316 (OFF-LANDING) : toggle affiché + actif pour TOUT le monde (avant caché aux abonnés).
  // v0.9.317 : applyCycle() met aussi à jour l'état "Actif" de la carte possédée selon le cycle
  // affiché, et le toggle s'ouvre sur le cycle réel de l'abonné (defaultCycle).
  let _billingCycle = 'monthly';   // v0.9.255 : suivi pour le checkout
  const toggleBtns = el.querySelectorAll('.billing-toggle-btn');
  function applyCycle(billing) {
    _billingCycle = billing === 'yearly' ? 'yearly' : 'monthly';
    toggleBtns.forEach(b => {
      const on = b.getAttribute('data-billing') === _billingCycle;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    el.querySelectorAll('[data-price-monthly]').forEach(p => { p.style.display = _billingCycle === 'monthly' ? '' : 'none'; });
    el.querySelectorAll('[data-price-yearly]').forEach(p => { p.style.display = _billingCycle === 'yearly' ? '' : 'none'; });
    // La carte possédée payante n'est "Actif" que si le cycle affiché == cycle souscrit.
    const oc = el.querySelector('[data-owned-card]');
    if (oc) {
      const match = oc.getAttribute('data-owned-cycle') === _billingCycle;
      oc.classList.toggle('current', match);
      const tag = oc.querySelector('.pricing-current-tag'); if (tag) tag.style.display = match ? '' : 'none';
      const act = oc.querySelector('[data-owned-active]'); if (act) act.style.display = match ? '' : 'none';
      const oth = oc.querySelector('[data-owned-other]'); if (oth) oth.style.display = match ? 'none' : '';
    }
  }
  toggleBtns.forEach(btn => btn.addEventListener('click', () => applyCycle(btn.getAttribute('data-billing'))));
  applyCycle(defaultCycle);   // ouvre sur le cycle réel + cale l'état "Actif"

  // ── Checkout Stripe self-service (v0.9.255) ────────────────────────────────
  // v0.9.298 (#bug upgrade) : ce binding était à tort DANS `if (!pro)`, donc le
  // bouton « Choisir Elite » d'un abonné Funded n'avait aucun handler (clic mort,
  // ni console, ni réseau). On le sort : un abonné actif est routé vers le
  // portail client Stripe pour changer de plan ; un visiteur libre va au checkout.
  el.querySelectorAll('[data-checkout-tier]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tier = btn.getAttribute('data-checkout-tier');   // 'funded' | 'elite'
      const plan = `${tier}_${_billingCycle}`;                // ex 'funded_monthly'
      if (typeof _fbFunctions === 'undefined' || !_fbFunctions) {
        UI.toast(t('off.checkout.err') || 'Service de paiement indisponible — recharge la page.', true);
        return;
      }
      // v0.9.381 : force-refresh du token Auth avant l'appel — sinon un user qui vient
      // de vérifier son email garde un token en cache avec email_verified=false et le
      // checkout est refusé alors que la vérification est réellement faite côté serveur.
      try {
        if (typeof _fbAuth !== 'undefined' && _fbAuth && _fbAuth.currentUser) {
          await _fbAuth.currentUser.reload();
          await _fbAuth.currentUser.getIdToken(true);
        }
      } catch (e) { /* non bloquant — on laisse le serveur trancher */ }
      // v0.9.297 (#bug upgrade) : si l'utilisateur a DÉJÀ un abonnement Stripe actif,
      // on NE crée PAS un nouveau checkout (ça créerait une 2e souscription / double
      // facturation, d'où le 503). Un changement de plan (Funded ↔ Elite) passe par
      // le PORTAIL client Stripe (proratisation gérée par Stripe).
      const _s = (Store.getStripeInfo && Store.getStripeInfo()) || {};
      const _hasActiveSub = _s.customerId && _s.subscriptionStatus
        && !['canceled', 'incomplete_expired', 'incomplete'].includes(_s.subscriptionStatus);
      if (_hasActiveSub) {
        const o0 = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try {
          // v0.9.302 : on passe le palier cible → la CF crée une session qui DEEP-LINK
          // direct sur la page Stripe « confirmer le passage à <tier> » (le client voit
          // le montant proratisé avant de payer). Plus besoin de chercher dans le menu.
          const res = await _fbFunctions.httpsCallable('createBillingPortalSession')({ flowToTier: tier });
          if (res && res.data && res.data.url) { window.location.href = res.data.url; return; }
          UI.toast(t('off.changeplan') || 'Pour changer de plan, gère ton abonnement (Réglages → Gérer mon abonnement).', true);
        } catch (e) {
          UI.toast(t('off.changeplan') || 'Pour changer de plan, va dans Réglages → Gérer mon abonnement.', true);
        } finally { btn.disabled = false; btn.textContent = o0; }
        return;
      }
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = '…';
      if (window.Analytics) Analytics.track('checkout_started', { label: plan });
      try {
        const res = await _fbFunctions.httpsCallable('createCheckoutSession')({ plan });
        if (res && res.data && res.data.url) {
          window.location.href = res.data.url;   // redirection vers Stripe Checkout
          return;                                 // pas de reset (on quitte la page)
        }
        UI.toast(t('off.checkout.err') || 'Erreur lors de la création du paiement.', true);
      } catch (e) {
        const code = (e && (e.code || e.message)) || '';
        if (/unauthenticated/.test(code)) {
          UI.toast(t('off.checkout.login') || 'Connecte-toi pour souscrire.', true);
        } else if (/failed-precondition/.test(code)) {
          UI.toast(t('off.checkout.verify') || 'Vérifie ton email avant de souscrire.', true);
        } else {
          UI.toast(t('off.checkout.err') || 'Erreur lors de la création du paiement.', true);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  // ── Retour au gratuit (résiliation) → portail Stripe, flow d'annulation ──────
  el.querySelectorAll('[data-cancel-sub]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (typeof _fbFunctions === 'undefined' || !_fbFunctions) {
        UI.toast(t('off.checkout.err') || 'Service indisponible — recharge la page.', true);
        return;
      }
      const o0 = btn.textContent;
      btn.disabled = true; btn.textContent = '…';
      try {
        const res = await _fbFunctions.httpsCallable('createBillingPortalSession')({ flow: 'cancel' });
        if (res && res.data && res.data.url) { window.location.href = res.data.url; return; }
        UI.toast(t('off.changeplan') || 'Pour résilier, gère ton abonnement (Réglages → Gérer mon abonnement).', true);
      } catch (e) {
        UI.toast(t('off.changeplan') || 'Pour résilier, va dans Réglages → Gérer mon abonnement.', true);
      } finally { btn.disabled = false; btn.textContent = o0; }
    });
  });

  // v1.0.5 — Lifetime : paiement UNIQUE (handler dédié, hors logique abo/portail).
  el.querySelector('#lifetimeCta')?.addEventListener('click', async () => {
    const btn = el.querySelector('#lifetimeCta');
    if (typeof _fbFunctions === 'undefined' || !_fbFunctions) { UI.toast(t('off.checkout.err') || 'Service indisponible — recharge la page.', true); return; }
    const o0 = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try {
      if (typeof _fbAuth !== 'undefined' && _fbAuth && _fbAuth.currentUser) { await _fbAuth.currentUser.reload(); await _fbAuth.currentUser.getIdToken(true); }
    } catch (e) { /* non bloquant */ }
    if (window.Analytics) Analytics.track('checkout_started', { label: 'lifetime' });
    try {
      const res = await _fbFunctions.httpsCallable('createCheckoutSession')({ plan: 'lifetime' });
      if (res && res.data && res.data.url) { window.location.href = res.data.url; return; }
      UI.toast(t('off.checkout.err') || 'Erreur lors de la création du paiement.', true);
    } catch (e) {
      const code = (e && (e.code || e.message)) || '';
      if (/failed-precondition/.test(code)) UI.toast(t('off.checkout.verify') || 'Vérifie ton email avant de payer.', true);
      else UI.toast(t('off.checkout.err') || 'Erreur lors de la création du paiement.', true);
    } finally { btn.disabled = false; btn.textContent = o0; }
  });

  // v0.9.384 : handler `btnFoundingApply` retiré (bannière Founding supprimée).

  // v0.9.384 : handler d'activation retiré (le champ UI n'existe plus). L'activation
  // se fait désormais via le param URL `?activatePro=CODE` géré dans app.js.
};
