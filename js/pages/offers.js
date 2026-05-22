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
  const tierLabel = isBeta ? 'Bêta Testeur' : isElite ? 'Elite' : isFunded ? 'Funded' : 'Trader';
  const statusBanner = pro
    ? `<div class="pro-active-banner">
        <div class="pro-active-icon">${isBeta ? Icons.svg('sparkle',24) : '✦'}</div>
        <div>
          <div class="pro-active-title">Plan ${tierLabel} actif</div>
          <div class="pro-active-sub">${activatedDate ? tv('off.pro.active.sub', { date: activatedDate }) : 'Accès complet à toutes les fonctionnalités'}</div>
        </div>
      </div>`
    : '';

  // ── Founding scarcity banner (uniquement Trader — déjà cible) ──────────────
  const foundingBanner = !isTrader ? '' : `
    <div class="founding-banner">
      <div class="founding-banner-text">
        <div class="founding-banner-title">${t('off.founding.title')}</div>
        <div class="founding-banner-sub">${t('off.founding.sub')}</div>
      </div>
      <button type="button" class="founding-banner-cta" id="btnFoundingApply">${t('off.founding.cta')} →</button>
    </div>`;

  // ── Billing toggle (Monthly / Yearly) ──────────────────────────────────────
  const billingToggle = `
    <div class="billing-toggle" role="tablist" aria-label="Billing period">
      <button type="button" class="billing-toggle-btn active" data-billing="monthly" role="tab" aria-selected="true">${t('off.billing.monthly')}</button>
      <button type="button" class="billing-toggle-btn" data-billing="yearly" role="tab" aria-selected="false">${t('off.billing.yearly')} <span class="billing-toggle-save">−2 ${isEn ? 'mo' : 'mois'}</span></button>
    </div>`;

  // ── Card : TRADER (gratuit) ───────────────────────────────────────────────
  const cardTrader = `
    <div class="offer-card ${isTrader ? 'offer-current' : ''}">
      <div class="offer-badge-basic">GRATUIT</div>
      <div class="offer-badge-current" style="opacity:${isTrader ? 1 : 0}">${t('off.current')}</div>
      <div class="offer-name">Trader</div>
      <div class="offer-tag">${t('off.trader.tag')}</div>
      <div class="offer-price-hidden" style="color:var(--green)">0 €<span class="offer-price-suffix"> · ${t('off.forever')}</span></div>
      <div class="offer-perday">&nbsp;</div>
      <ul class="offer-features">
        <li class="ok">${t('off.trader.f1')}</li>
        <li class="ok">${t('off.trader.f2')}</li>
        <li class="ok">${t('off.trader.f3')}</li>
        <li class="ok">${t('off.trader.f4')}</li>
        <li class="ok">${t('off.trader.f5')}</li>
        <li class="limit">${t('off.trader.f6')}</li>
        <li class="limit">${t('off.trader.f7')}</li>
        <li class="no">${t('off.trader.f8')}</li>
        <li class="no">${t('off.trader.f9')}</li>
      </ul>
      <div class="offer-cta offer-cta-current">${!pro ? t('off.cta.cur') : 'Trader'}</div>
    </div>`;

  // ── Card : FUNDED (14.99 €/mois — featured) ──────────────────────────────
  const cardFunded = `
    <div class="offer-card offer-pro ${isFunded ? 'offer-current' : ''}">
      <div class="offer-badge-pro">${isBeta ? 'BÊTA' : t('off.popular')}</div>
      <div class="offer-badge-current" style="opacity:${isFunded ? 1 : 0};color:#a78bfa">${t('off.current')}</div>
      <div class="offer-name" style="color:#a78bfa">Funded</div>
      <div class="offer-tag">${t('off.funded.tag')}</div>
      <div class="offer-price-hidden">
        <span data-price-monthly>14,99 €<span class="offer-price-suffix">/${t('off.month')}</span></span>
        <span data-price-yearly style="display:none">${t('off.funded.yearly')}</span>
      </div>
      <div class="offer-perday">
        <span data-price-monthly>${t('off.funded.perday')}</span>
        <span data-price-yearly style="display:none;color:var(--green);font-weight:600">${t('off.funded.yearly.save')}</span>
      </div>
      <ul class="offer-features">
        <li class="ok">${t('off.funded.f1')}</li>
        <li class="ok"><strong>${t('off.funded.f2')}</strong></li>
        <li class="ok"><strong>${t('off.funded.f3')}</strong></li>
        <li class="ok"><strong>${t('off.funded.f4')}</strong></li>
        <li class="ok">${t('off.funded.f5')}</li>
        <li class="ok">${t('off.funded.f6')}</li>
        <li class="ok">${t('off.funded.f7')}</li>
      </ul>
      ${isFunded || isBeta
        ? `<div class="offer-cta offer-cta-current">${t('off.cta.act')}</div>`
        : isElite
          ? `<div class="offer-cta offer-cta-current" style="background:rgba(255,255,255,0.04)">Inclus dans Elite</div>`
          : `<button type="button" class="offer-cta offer-cta-link offer-cta-pro" data-checkout-tier="funded">${t('off.cta.funded.btn')}</button>`}
    </div>`;

  // ── Card : ELITE (29.99 €/mois) ───────────────────────────────────────────
  const cardElite = `
    <div class="offer-card offer-elite ${isElite ? 'offer-current' : ''}">
      <div class="offer-badge-elite">✦ Premium</div>
      <div class="offer-badge-current" style="opacity:${isElite ? 1 : 0};color:#fbbf24">${t('off.current')}</div>
      <div class="offer-name" style="color:#f59e0b">Elite</div>
      <div class="offer-tag">${t('off.elite.tag')}</div>
      <div class="offer-price-hidden">
        <span data-price-monthly>29,99 €<span class="offer-price-suffix">/${t('off.month')}</span></span>
        <span data-price-yearly style="display:none">${t('off.elite.yearly')}</span>
      </div>
      <div class="offer-perday">
        <span data-price-monthly>${t('off.elite.perday')}</span>
        <span data-price-yearly style="display:none;color:var(--green);font-weight:600">${t('off.elite.yearly.save')}</span>
      </div>
      <ul class="offer-features">
        <li class="ok">${t('off.elite.f1')}</li>
        <li class="ok"><strong>${t('off.elite.f2')}</strong></li>
        <li class="ok"><strong>${t('off.elite.f3')}</strong></li>
        <li class="ok">${t('off.elite.f4')}</li>
        <li class="ok">${t('off.elite.f5')}</li>
        <li class="ok">${t('off.elite.f6')}</li>
      </ul>
      ${isElite || isBeta
        ? `<div class="offer-cta offer-cta-current">${t('off.cta.act')}</div>`
        : `<button type="button" class="offer-cta offer-cta-link offer-cta-elite" data-checkout-tier="elite">${t('off.cta.elite.btn')}</button>`}
    </div>`;

  // ── Trust banner ───────────────────────────────────────────────────────────
  const trustBanner = `
    <div class="trust-banner">
      <span class="trust-item">✓ ${t('off.trust.cancel')}</span>
      <span class="trust-item">✓ ${t('off.trust.guarantee')}</span>
      <span class="trust-item">✓ ${t('off.trust.export')}</span>
      <span class="trust-item">✓ ${t('off.trust.nocb')}</span>
    </div>`;

  // ── Comparison table ──────────────────────────────────────────────────────
  const perDay = isEn ? '/day' : '/jour';
  const rows = [
    { f: t('off.row.journal'),       tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.dashboard'),     tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.calendar'),      tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.goals'),         tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.calculators'),   tr: '✓',          fu: '✓',     el: '✓' },
    { f: t('off.row.accounts'),      tr: '1',          fu: '10',    el: '100' },
    { f: t('off.row.ai'),            tr: '1' + perDay, fu: '20' + perDay, el: '100' + perDay },
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
      <span class="offer-compare-basic" style="color:${colColor(r.tr, false)}">${r.tr}</span>
      <span class="offer-compare-pro"   style="color:${colColor(r.fu, false)}">${r.fu}</span>
      <span class="offer-compare-lt"    style="color:${colColor(r.el, true)}">${r.el}</span>
    </div>`).join('');

  // ── Promo code section (Founding Members) ────────────────────────────────
  const promoSection = pro
    ? `<div class="offer-promo-section">
        <div class="offer-promo-active">✦ &nbsp;${t('off.pro.active.title')} &nbsp;—&nbsp; ${t('off.cta.act')}</div>
      </div>`
    : `<div class="offer-promo-section">
        <div class="offer-promo-title">${t('off.beta.title')}</div>
        <div class="offer-promo-sub">${t('off.beta.sub')}</div>
        <div class="offer-promo-row">
          <input type="text" id="proCodeInput" class="pro-code-input"
            placeholder="${t('off.ph')}" autocomplete="off" spellcheck="false" />
          <button class="offer-cta offer-cta-link offer-cta-pro" id="btnActivatePro">${t('off.activate')}</button>
        </div>
        <div class="pro-code-error" id="proCodeError"></div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">
          ${t('off.no.code')}
          <span style="color:#a78bfa;cursor:pointer;font-weight:600" id="btnGoContact">${t('off.contact.us')}</span>
        </div>
      </div>`;

  // ── Render ────────────────────────────────────────────────────────────────
  el.innerHTML = `
    <div class="offers-wrap">
      <div class="offers-header">
        <h1>${t('off.title')}</h1>
        <p>${t('off.sub')}</p>
      </div>

      ${statusBanner}
      ${foundingBanner}

      ${pro ? '' : billingToggle}

      <div class="offers-cards">
        ${cardTrader}
        ${cardFunded}
        ${cardElite}
      </div>

      ${trustBanner}

      ${promoSection}

      <div class="offer-compare">
        <div class="offer-compare-title">${t('off.compare.full')}</div>
        <div class="offer-compare-row offer-compare-header">
          <span>${t('off.compare.feat')}</span>
          <span class="offer-compare-basic">Trader</span>
          <span class="offer-compare-pro">Funded</span>
          <span class="offer-compare-lt">Elite</span>
        </div>
        ${compareRows}
      </div>

      <div class="offers-faq">
        <h3>${t('off.faq.title')}</h3>
        <div class="faq-item"><b>${t('off.faq.1q')}</b><p>${t('off.faq.1a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.2q')}</b><p>${t('off.faq.2a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.3q')}</b><p>${t('off.faq.3a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.4q')}</b><p>${t('off.faq.4a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.5q')}</b><p>${t('off.faq.5a')}</p></div>
        <div class="faq-item"><b>${t('off.faq.6q')}</b><p>${t('off.faq.6a')}</p></div>
      </div>
    </div>
  `;

  // ── Billing toggle logic ──────────────────────────────────────────────────
  let _billingCycle = 'monthly';   // v0.9.255 : suivi pour le checkout
  if (!pro) {
    const toggleBtns = el.querySelectorAll('.billing-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const billing = btn.getAttribute('data-billing');
        _billingCycle = billing === 'yearly' ? 'yearly' : 'monthly';
        toggleBtns.forEach(b => {
          const isActive = b.getAttribute('data-billing') === billing;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        el.querySelectorAll('[data-price-monthly]').forEach(p => {
          p.style.display = billing === 'monthly' ? '' : 'none';
        });
        el.querySelectorAll('[data-price-yearly]').forEach(p => {
          p.style.display = billing === 'yearly' ? '' : 'none';
        });
      });
    });
  }

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

  // ── Founding apply button → contact bubble ─────────────────────────────────
  const foundingBtn = document.getElementById('btnFoundingApply');
  if (foundingBtn) {
    foundingBtn.addEventListener('click', () => {
      const bubble = document.getElementById('contactBubble');
      if (bubble) bubble.click();
    });
  }

  // ── Activation logic (non-Pro only) ────────────────────────────────────────
  if (!pro) {
    const btn   = document.getElementById('btnActivatePro');
    const input = document.getElementById('proCodeInput');
    const error = document.getElementById('proCodeError');

    btn.addEventListener('click', async () => {
      const code = input.value.trim();
      if (!code) { error.textContent = t('off.err.empty'); return; }
      btn.disabled    = true;
      btn.textContent = '…';
      error.textContent = '';
      const result = await Store.activatePro(code);
      if (result === true) {
        UI.toast(t('off.ok'));
        setTimeout(() => location.reload(), 1200);
      } else if (result === 'throttled') {
        error.textContent = t('off.code.throttled');
        btn.disabled    = false;
        btn.textContent = t('off.activate');
      } else {
        error.textContent = t('off.err.inv');
        btn.disabled    = false;
        btn.textContent = t('off.activate');
      }
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

    const goContact = document.getElementById('btnGoContact');
    if (goContact) {
      goContact.addEventListener('click', () => {
        const bubble = document.getElementById('contactBubble');
        if (bubble) bubble.click();
      });
    }
  }
};
