// ─── BOOTSTRAP AUTH ───────────────────────────────────────────────────────────
// Extrait de index.html pour permettre une Content-Security-Policy sans unsafe-inline

// Anti-framing
if (window.top !== window.self) { window.top.location.replace(window.self.location.href); }

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  i18n.apply();
  Contact.init();

  // landingScreen retiré en v0.9.114 (la landing publique est sur /index.html maintenant).
  // Quand l'user arrive sur app.html : si pas loggé, on ouvre direct le modal login.
  const authModal = $('authModal');
  const loader    = $('loginLoader');
  let appLaunched = false;

  // ── Modal auth ──────────────────────────────────────────────────────────────
  // v0.9.419 (F-04) — filet anti « hCaptcha absent » : le widget est en auto-render,
  // donc s'il était masqué/0px au chargement il peut ne jamais apparaître. À l'affichage
  // du form signup, on le rend explicitement s'il manque (pas de double-render : on ne
  // touche pas s'il a déjà une iframe), sinon on le reset.
  function _ensureCaptcha(tries) {
    tries = tries || 0;
    const el = document.querySelector('#registerFormEl .h-captcha');
    if (!el) return;
    if (typeof hcaptcha === 'undefined') {            // API pas encore chargée (async) → réessaie
      if (tries < 20) setTimeout(() => _ensureCaptcha(tries + 1), 250);
      return;
    }
    try {
      if (el.dataset.hcaptchaWidgetId) {
        hcaptcha.reset(el.dataset.hcaptchaWidgetId);  // déjà rendu explicitement → reset propre
      } else if (!el.querySelector('iframe')) {       // auto-render a échoué → rend explicitement
        const hl = (typeof i18n !== 'undefined' && i18n.getLang) ? i18n.getLang() : 'fr';
        const id = hcaptcha.render(el, { sitekey: el.dataset.sitekey, theme: 'dark', size: 'compact', hl: hl });
        el.dataset.hcaptchaWidgetId = String(id);
      }
    } catch (e) { /* déjà rendu par l'auto-render → on laisse */ }
  }

  function showForm(mode) {
    ['loginFormEl','registerFormEl','forgotFormEl'].forEach(id => {
      $(id).style.display = (id === mode + 'FormEl') ? '' : 'none';
    });
    ['loginError','registerError','forgotError'].forEach(id => {
      if ($(id)) $(id).textContent = '';
    });
    const focus = { login: 'loginUsername', register: 'regUsername', forgot: 'forgotEmail' };
    setTimeout(() => { if ($(focus[mode])) $(focus[mode]).focus(); }, 60);
    if (mode === 'register') setTimeout(() => _ensureCaptcha(), 80);
  }
  function openModal(mode) {
    showForm(mode);
    authModal.style.display = 'flex';
  }
  // v0.9.288 : intention venant de la landing. « Créer un compte » pointe vers
  // /app?signup=1 → on ouvre directement le formulaire d'inscription (avant, tout
  // atterrissait sur la connexion). « Connexion » reste sur /app (login par défaut).
  function _initialAuthMode() {
    try {
      const p = new URLSearchParams(location.search);
      // Invitation bêta : ?invite=TOKEN → stocker pour activation post-signup
      const invite = p.get('invite');
      if (invite && /^[\w-]{10,60}$/.test(invite)) {
        try { sessionStorage.setItem('zt_invite', invite); } catch (e) {}
      }
      if (p.get('signup') === '1' || p.get('invite') || location.hash === '#signup' || location.hash === '#register') {
        // Mémoriser l'intention de plan si présente (?plan=funded|elite → pré-sélection offre d'essai)
        const plan = p.get('plan');
        if (plan === 'funded' || plan === 'elite') {
          try { sessionStorage.setItem('zt_plan_intent', plan); } catch (e) {}
        }
        return 'register';
      }
    } catch (e) { /* ignore */ }
    return 'login';
  }
  function closeModal() {
    // Early return si déjà fermée → évite de vider les champs par erreur (Escape global, etc.)
    if (authModal.style.display === 'none' || authModal.style.display === '') return;
    authModal.style.display = 'none';
    // Vide les champs sensibles à la fermeture
    ['loginPassword','regPassword','regPasswordConfirm','forgotEmail','loginUsername','regUsername','regEmail'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    ['loginError','registerError','forgotError'].forEach(id => {
      const el = $(id); if (el) { el.textContent = ''; el.style.color = ''; }
    });
    // v0.9.238 : reset visual validation cues sur les inputs du signup
    ['regEmail','regPassword','regPasswordConfirm','regUsername'].forEach(id => {
      const el = $(id); if (el) el.classList.remove('input-valid', 'input-invalid');
    });
    // v0.9.287 : masque la barre de force du mot de passe
    const pwdStrengthBox = $('pwdStrength'); if (pwdStrengthBox) pwdStrengthBox.style.display = 'none';
  }

  // v0.9.238 — validation temps réel sur signup (visuel uniquement, le check
  // côté serveur reste autoritaire). Borde vert si valide, rouge si invalide.
  function _setupLiveValidation() {
    function mark(el, valid) {
      if (!el) return;
      el.classList.toggle('input-valid',   valid === true);
      el.classList.toggle('input-invalid', valid === false);
      // v0.9.286 : accessibilité — annonce l'état invalide aux lecteurs d'écran (#audit)
      if (valid === false) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
    const emailEl = $('regEmail');
    if (emailEl && !emailEl.dataset.liveBound) {
      emailEl.dataset.liveBound = '1';
      emailEl.addEventListener('input', () => {
        const v = emailEl.value.trim();
        if (!v) return mark(emailEl, null);
        mark(emailEl, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
      });
    }
    const userEl = $('regUsername');
    if (userEl && !userEl.dataset.liveBound) {
      userEl.dataset.liveBound = '1';
      userEl.addEventListener('input', () => {
        const v = userEl.value.trim();
        if (!v) return mark(userEl, null);
        mark(userEl, /^[a-zA-Z0-9_-]{2,30}$/.test(v));
      });
    }
    const pwdEl = $('regPassword');
    const pwdConfEl = $('regPasswordConfirm');

    // v0.9.287 (#audit) : politique = 8 caractères min + minuscule + MAJUSCULE +
    // chiffre. La barre de force récompense la longueur et les caractères spéciaux.
    function _pwdChecks(v) {
      return {
        len:     v.length >= 8,
        lower:   /[a-z]/.test(v),
        upper:   /[A-Z]/.test(v),
        digit:   /\d/.test(v),
        special: /[^a-zA-Z0-9]/.test(v),
      };
    }
    function _pwdValid(c) { return c.len && c.lower && c.upper && c.digit; }
    function _renderPwdMeter(v) {
      const box = $('pwdStrength'), label = $('pwdStrengthLabel'),
            reqs = $('pwdStrengthReqs'), fill = $('pwdStrengthFill');
      const c = _pwdChecks(v);
      const valid = _pwdValid(c);
      if (!box || !label || !reqs || !fill) return valid;
      if (!v) { box.style.display = 'none'; return false; }
      box.style.display = '';
      let score = 0;
      if (c.len) score++;
      if (v.length >= 12) score++;
      if (c.lower && c.upper) score++;
      if (c.digit) score++;
      if (c.special) score++;            // bonus caractères spéciaux (@ & ! …)
      if (v.length >= 16) score++;
      let level = 1;
      if (valid && score >= 5) level = 3;
      else if (valid && score >= 4) level = 2;
      box.setAttribute('data-level', String(level));
      fill.className = 'lvl' + level;
      const labels = { 1: 'Faible', 2: 'Fort', 3: 'Très fort' };
      const colors = { 1: '#ef4444', 2: '#f59e0b', 3: '#22c55e' };
      label.textContent = labels[level];
      label.style.color = colors[level];
      const miss = [];
      if (!c.len)   miss.push('8 caractères');
      if (!c.upper) miss.push('1 majuscule');
      if (!c.lower) miss.push('1 minuscule');
      if (!c.digit) miss.push('1 chiffre');
      if (miss.length)        reqs.innerHTML = '<span class="pwd-req-miss">Manque : ' + miss.join(', ') + '</span>';
      else if (!c.special)    reqs.innerHTML = '<span class="pwd-req-ok">✓ Valide</span> · un caractère spécial (@ ! &) le renforce';
      else                    reqs.innerHTML = '<span class="pwd-req-ok">✓ Mot de passe solide</span>';
      return valid;
    }
    _setupLiveValidation._renderPwdMeter = _renderPwdMeter;

    if (pwdEl && !pwdEl.dataset.liveBound) {
      pwdEl.dataset.liveBound = '1';
      pwdEl.addEventListener('input', () => {
        const v = pwdEl.value;
        if (!v) { mark(pwdEl, null); _renderPwdMeter(''); return; }
        mark(pwdEl, _renderPwdMeter(v));
        if (pwdConfEl && pwdConfEl.value) {
          mark(pwdConfEl, pwdConfEl.value === v);
        }
      });
    }
    if (pwdConfEl && !pwdConfEl.dataset.liveBound) {
      pwdConfEl.dataset.liveBound = '1';
      pwdConfEl.addEventListener('input', () => {
        const v = pwdConfEl.value;
        if (!v) return mark(pwdConfEl, null);
        mark(pwdConfEl, pwdEl && v === pwdEl.value);
      });
    }
  }
  _setupLiveValidation();

  // Helper unifié : preventDefault + stopPropagation + open
  function bindOpen(id, mode, before) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (before) before();
      openModal(mode);
    });
  }

  // bindOpen retirés pour les boutons inside landingScreen (supprimé en v0.9.114).
  // bindOpen() est safe-on-missing-element, donc les laisser commentés est OK pour
  // backward-compat si un jour on remet une landing interne. Pour l'instant on s'en passe.
  // bindOpen('btnNavLogin', 'login');
  // bindOpen('btnNavRegister', 'register');
  // bindOpen('btnHeroCta', 'register');
  // bindOpen('btnHeroLogin', 'login');
  // bindOpen('btnLandingFree', 'register');
  // bindOpen('btnLandingPro', 'login', () => sessionStorage.setItem('ztGoto', 'offers'));
  // bindOpen('btnLandingLifetime', 'login', () => sessionStorage.setItem('ztGoto', 'offers'));

  // v0.9.146 : croix de fermeture retirée — accès au journal nécessite forcément
  // une connexion, fermer la modale ne menait à rien (page vide derrière).
  // Le backdrop reste cliquable techniquement mais ne ferme plus rien.

  // v0.9.149 : toggle visibilité mot de passe (login + signup).
  // Event delegation sur document.body pour gérer les 3 boutons (loginPassword,
  // regPassword, regPasswordConfirm) en une seule fois, robuste au re-render.
  document.body.addEventListener('click', function (e) {
    const btn = e.target.closest('.pwd-toggle');
    if (!btn) return;
    const targetId = btn.dataset.pwdTarget;
    const input = document.getElementById(targetId);
    if (!input) return;
    const eye   = btn.querySelector('.pwd-icon-eye');
    const slash = btn.querySelector('.pwd-icon-slash');
    if (input.type === 'password') {
      input.type = 'text';
      if (eye)   eye.style.display   = 'none';
      if (slash) slash.style.display = 'block';
      btn.setAttribute('aria-label', 'Masquer le mot de passe');
    } else {
      input.type = 'password';
      if (eye)   eye.style.display   = 'block';
      if (slash) slash.style.display = 'none';
      btn.setAttribute('aria-label', 'Afficher le mot de passe');
    }
  });
  // Escape : ne ferme que si la modal est réellement ouverte
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && authModal.style.display === 'flex') closeModal();
  });

  // ── Loader animé (LOADER-UI v0.9.318) ────────────────────────────────────────
  // Progression « perçue » : la barre s'approche par étapes jusqu'à ~92 %, puis
  // reste là jusqu'au signal « données prêtes » (finish → snap 100 % + fondu).
  // Un seul rAF qui ease vers `target` → pas de tweens concurrents.
  const ZTLoader = (() => {
    const tr = (fr, en) => (i18n.getLang && i18n.getLang() === 'en') ? en : fr;
    const STAGES = [
      { pct: 8,  at: 0,    fr: 'Initialisation…',                          en: 'Initializing…' },
      { pct: 24, at: 420,  fr: 'Connexion sécurisée TLS…',                 en: 'Secure TLS connection…' },
      { pct: 45, at: 950,  fr: 'Synchronisation des comptes…',            en: 'Syncing accounts…' },
      { pct: 66, at: 1550, fr: 'Application des règles prop firms…',       en: 'Applying prop firm rules…' },
      { pct: 84, at: 2200, fr: 'Calcul des KPIs (R:R, DD, win rate)…',     en: 'Computing KPIs (R:R, DD, win rate)…' },
      { pct: 92, at: 2850, fr: 'Préparation du journal…',                 en: 'Preparing your journal…' },
    ];
    let bar, pctEl, statusEl, current = 0, target = 0, raf = 0, running = false, activeNode = null, timers = [];
    function loop() {
      current += (target - current) * 0.08;
      if (Math.abs(target - current) < 0.25) current = target;
      if (bar)   bar.style.width = current.toFixed(1) + '%';
      if (pctEl) pctEl.textContent = Math.round(current) + '%';
      if (running) raf = requestAnimationFrame(loop);
    }
    function setStatus(label, withCheck) {
      if (!statusEl) return;
      const node = document.createElement('div');
      node.className = 'status-text';
      if (withCheck) {
        node.innerHTML = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 8"/></svg>';
        node.appendChild(document.createTextNode(label));
      } else {
        node.textContent = label;
      }
      statusEl.appendChild(node);
      requestAnimationFrame(() => {
        if (activeNode) { const old = activeNode; old.classList.remove('is-active'); setTimeout(() => old.remove(), 340); }
        node.classList.add('is-active');
        activeNode = node;
      });
    }
    function start(username) {
      bar = $('ztLoaderBar'); pctEl = $('ztLoaderPct'); statusEl = $('ztLoaderStatus');
      try {
        const v = window.Changelog && Changelog.getEntries && Changelog.getEntries()[0];
        if (v) {
          const ve = $('ztLoaderVer');     if (ve) ve.textContent = 'v' + v.version;
          const av = $('appVersionLabel'); if (av) av.textContent = 'v' + v.version;   // v0.9.355 : footer Réglages = même source. v0.9.368 : préfixe « v » pour cohérence avec loader/footer.
        }
      } catch (e) {}
      const eb = $('ztLoaderEyebrow'); if (eb && username) eb.textContent = tr('Bon retour, ', 'Welcome back, ') + username;
      // v0.9.319 : lancé une 1ʳᵉ fois au boot (avant l'auth) pour couvrir l'app shell ;
      // les appels suivants (showLoader après login) ne réinitialisent PAS la barre.
      if (running) return;
      timers.forEach(clearTimeout); timers = [];
      current = 0; target = 0; activeNode = null;
      if (statusEl) statusEl.innerHTML = '';
      if (bar) bar.style.width = '0%';
      if (pctEl) pctEl.textContent = '0%';
      running = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      STAGES.forEach(s => timers.push(setTimeout(() => { target = s.pct; setStatus(tr(s.fr, s.en), false); }, s.at)));
    }
    function finish(cb) {
      timers.forEach(clearTimeout); timers = [];
      target = 100;
      setStatus(tr('Prêt — bon trade.', 'Ready — happy trading.'), true);
      if (loader) loader.classList.add('done');
      timers.push(setTimeout(() => { running = false; cancelAnimationFrame(raf); if (cb) cb(); }, 700));
    }
    function stop() { running = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; }
    return { start, finish, stop };
  })();
  window.ZTLoader = ZTLoader;   // v1.0.5 : exposé pour réutilisation (loader plein écran au checkout depuis offers.js)

  function showLoader(username) {
    closeModal();
    if (loader) { loader.classList.remove('done'); loader.style.opacity = ''; loader.style.transition = ''; loader.style.display = 'flex'; }
    ZTLoader.start(username);
  }

  // v0.9.319 : démarre l'animation du loader IMMÉDIATEMENT (déjà visible via display:flex
  // dans le HTML) → couvre l'app shell dès le 1er paint, avant que l'auth soit résolue.
  ZTLoader.start();

  // ── Launch app ──────────────────────────────────────────────────────────────
  // v1.0.5 — Gate d'accès essai/payant : bannière (essai actif) + mur (essai expiré).
  // Idempotent : appelé au reveal + à chaque store:planChanged. Le serveur (M2) reste
  // autoritaire ; ceci n'est que l'UX (info essai + invitation à s'abonner). FR/EN inline.
  function _renderAccessGate() {
    if (typeof Store === 'undefined' || !Store.getAccessState) return;
    const en = (typeof i18n !== 'undefined' && i18n.getLang && i18n.getLang() === 'en');
    const state = Store.getAccessState();

    const goOffers = () => { const o = document.querySelector('[data-page="offers"]'); if (o) o.click(); };

    // Bannière persistante « X jours restants — ajoute ta carte pour garder tes données »
    let banner = document.getElementById('trialBanner');
    if (state === 'trialing') {
      const n = (Store.trialDaysLeft && Store.trialDaysLeft()) || 0;
      const daysTxt = en ? `${n} day${n > 1 ? 's' : ''} left` : `${n} jour${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`;
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'trialBanner';
        banner.className = 'trial-banner';
        const tb = document.querySelector('.topbar');
        if (tb && tb.parentElement) tb.parentElement.insertBefore(banner, tb.nextSibling);
      }
      banner.classList.toggle('trial-banner-urgent', n <= 3);
      banner.innerHTML = `<span>${en ? 'Free trial' : 'Essai gratuit'} · <b>${daysTxt}</b> · ${en ? 'add a card to keep your data' : 'ajoute ta carte pour garder tes données'}</span>`
        + `<button type="button" id="trialBannerCta">${en ? 'See plans' : 'Voir les offres'}</button>`;
      const cta = document.getElementById('trialBannerCta');
      if (cta) cta.onclick = goOffers;
      _maybeShowTrialNotice(en, n, goOffers);   // écran d'explication complet, 1×/session
    } else if (banner) {
      banner.remove();
    }

    // Mur de fin d'essai (bloque l'app ; données conservées ; avertit la suppression)
    let wall = document.getElementById('paywallOverlay');
    if (state === 'expired') {
      if (!wall) {
        wall = document.createElement('div');
        wall.id = 'paywallOverlay';
        wall.className = 'paywall-overlay';
        wall.innerHTML = `<div class="paywall-card">
            <div class="paywall-icon">🔒</div>
            <h2>${en ? 'Your free access has ended' : 'Ton accès gratuit est terminé'}</h2>
            <p>${en ? 'Add a card to keep your account and all your data.' : 'Ajoute ta carte pour garder ton compte et toutes tes données.'}</p>
            <p class="paywall-warn">${en ? '⚠️ Without a card your account may be deleted. Your data is still here — subscribe to keep it.' : '⚠️ Sans carte, ton compte pourra être supprimé. Tes données sont encore là — abonne-toi pour les conserver.'}</p>
            <button class="btn-primary" id="paywallCta" type="button">${en ? 'See plans →' : 'Voir les offres →'}</button>
            <button class="paywall-export" id="paywallExport" type="button">${en ? '⤓ Export all my data' : '⤓ Exporter toutes mes données'}</button>
            <button class="paywall-logout" id="paywallLogout" type="button">${en ? 'Log out' : 'Se déconnecter'}</button>
          </div>`;
        document.body.appendChild(wall);
        const cta = document.getElementById('paywallCta');
        if (cta) cta.onclick = () => { wall.remove(); goOffers(); };
        // RGPD (art. 20) : l'export reste TOUJOURS possible, même bloqué → pas de données « en otage ».
        const ex = document.getElementById('paywallExport');
        if (ex) ex.onclick = () => {
          try {
            const blob = new Blob([Store.exportFullJSON()], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'zeldtrade-export-' + ((typeof UI !== 'undefined' && UI.localToday) ? UI.localToday() : new Date().toISOString().slice(0, 10)) + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
            if (typeof UI !== 'undefined' && UI.toast) UI.toast(en ? 'Your data has been exported.' : 'Tes données ont été exportées.');
          } catch (e) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(en ? 'Export failed — try again.' : "Échec de l'export — réessaie.", true); }
        };
        const lo = document.getElementById('paywallLogout');
        if (lo) lo.onclick = () => { try { Auth.logout(); } catch (e) {} };
      }
    } else if (wall) {
      wall.remove();
    }
  }

  // v1.0.5 : "page" d'avertissement complète pour les ex-gratuits en essai (1×/session).
  // Explique la transition payant + la timeline + le risque de perte de données.
  function _maybeShowTrialNotice(en, n, goOffers) {
    try { if (sessionStorage.getItem('zt_trial_notice')) return; } catch (e) {}
    if (document.getElementById('trialNotice')) return;
    const m = document.createElement('div');
    m.id = 'trialNotice';
    m.className = 'paywall-overlay';
    m.innerHTML = `<div class="paywall-card">
        <div class="paywall-icon">⏳</div>
        <h2>${en ? 'ZeldTrade is now paid' : 'ZeldTrade passe en payant'}</h2>
        <p>${en ? `Your free account has <b>${n} day${n > 1 ? 's' : ''}</b> of trial left.` : `Ton compte gratuit a encore <b>${n} jour${n > 1 ? 's' : ''}</b> d'essai.`}</p>
        <p>${en ? 'To keep your account and <b>all your data</b>, add your card — 14-day trial, subscription or lifetime.' : "Pour garder ton compte et <b>toutes tes données</b>, ajoute ta carte — essai 14 j, abonnement ou accès à vie."}</p>
        <p class="paywall-warn">${en ? 'Without a card: access is locked when the trial ends, then your account may be deleted.' : "Sans carte : accès bloqué à la fin de l'essai, puis ton compte pourra être supprimé."}</p>
        <button class="btn-primary" id="trialNoticeCta" type="button">${en ? 'See plans →' : 'Voir les offres →'}</button>
        <button class="paywall-logout" id="trialNoticeLater" type="button">${en ? 'Later' : 'Plus tard'}</button>
      </div>`;
    document.body.appendChild(m);
    try { sessionStorage.setItem('zt_trial_notice', '1'); } catch (e) {}
    const cta = document.getElementById('trialNoticeCta');
    if (cta) cta.onclick = () => { m.remove(); goOffers(); };
    const later = document.getElementById('trialNoticeLater');
    if (later) later.onclick = () => m.remove();
  }

  async function launchApp(user) {
    if (appLaunched) return;

    // v0.9.150 : RGPD consent gate — bloque le lancement de l'app si l'user n'a
    // pas encore accepté les CGU/Privacy (cas des users existants pre-v0.9.150).
    // La modale consent doit être validée avant de continuer.
    try {
      const consent = await Auth.getConsentStatus();
      if (consent && consent.needsConsent) {
        await _showConsentModal(consent.currentNewsletter);
      }
    } catch (e) {
      console.warn('[launchApp] consent check failed:', e && e.message);
      // En cas d'erreur réseau, on laisse passer (best-effort) — l'audit RGPD
      // est protégé par la rule Firestore qui block sans termsAccepted valide.
    }

    appLaunched = true;
    if (window.Analytics && Analytics.pingVisit) Analytics.pingVisit();
    // v1.0.x : on capture la promesse de chargement (Firestore) pour ne décider de
    // l'affichage du wizard de setup qu'APRÈS l'arrivée des réglages serveur.
    const _settingsLoaded = Store.initForUser(user.id);
    $('userPillName').textContent = user.username;
    $('userAvatar').textContent   = user.username[0].toUpperCase();
    initApp();   // rend l'app DERRIÈRE le loader plein écran (encore visible) → invisible

    // v0.9.315 : on GARDE le loader plein écran jusqu'à ce que les données soient
    // chargées (Firestore résolu) → fini le dashboard à moitié rempli pendant ~1 s.
    // Avant : le loader disparaissait à 450 ms, bien avant l'arrivée des données.
    // store:planChanged fire TOUJOURS (finally du Store, même hors-ligne/erreur) ; on
    // double avec store:synced + un fallback timeout pour ne jamais bloquer le loader.
    const _loaderT0 = Date.now();
    let _appRevealed = false;
    function _doReveal() {
      if (_appRevealed) return;
      _appRevealed = true;
      try {
        UI.renderList();
        UI.updateStats();
        UI.initSettings();
        const planBadge = document.getElementById('planBadge');
        if (planBadge) {
          const b = Store.getTierBadge();
          planBadge.textContent = b.label;
          planBadge.className   = 'plan-badge ' + b.cls;
        }
        // Invitation bêta : racheter le token en attente (signup via lien unique)
        try {
          const _invTok = sessionStorage.getItem('zt_invite');
          if (_invTok && typeof _fbFunctions !== 'undefined') {
            _fbFunctions.httpsCallable('redeemInviteToken')({ token: _invTok })
              .then(res => {
                try { sessionStorage.removeItem('zt_invite'); } catch (e) {}
                if (res && res.data && res.data.ok && Store.resync) Store.resync();
              })
              .catch(() => { try { sessionStorage.removeItem('zt_invite'); } catch (e) {} });
          }
        } catch (e) {}
        // v1.0.5 : gate d'accès essai/payant (bannière si essai actif, mur si expiré).
        try { _renderAccessGate(); } catch (e) {}
      } catch {}
      // v0.9.318 : on termine l'animation (snap 100 % + « Prêt ») PUIS fondu de sortie.
      ZTLoader.finish(() => {
        if (loader) {
          loader.style.transition = 'opacity 0.45s ease';
          loader.style.opacity    = '0';
          setTimeout(() => { loader.style.display = 'none'; loader.classList.remove('done'); loader.style.opacity = ''; }, 450);
        }
      });
      // v1.0.x : la décision d'afficher le wizard attend le chargement Firestore des
      // réglages (sinon, sur un nouvel appareil/onglet, `setupDone` n'est pas encore
      // arrivé du serveur → le wizard se redemandait à tort à chaque reconnexion).
      // On gate sur `setupDone` (flag canonique du setup complété), lu depuis Firestore.
      Promise.resolve(_settingsLoaded).then(() => {
        let _tpmShown = false;
        try {
          const s = (Store.getSettings && Store.getSettings()) || {};
          if (!s.setupDone) {
            _showTradingProfileModal();
            const m = document.getElementById('tradingProfileModal');
            _tpmShown = !!(m && m.style.display === 'flex');
          }
        } catch {}
        // Visite guidée au 1er login : si la modale profil vient de s'afficher, on
        // attend sa validation (store:profileChanged) pour ne pas empiler deux overlays.
        try {
          if (window.ZTTour) {
            if (_tpmShown) window.addEventListener('store:profileChanged', () => { try { ZTTour.maybeAuto(); } catch (e) {} }, { once: true });
            else ZTTour.maybeAuto();
          }
        } catch (e) {}
      }).catch(() => {});
    }
    function revealApp() {
      // min 700 ms d'affichage (évite un flash de loader si Firestore répond très vite)
      const elapsed = Date.now() - _loaderT0;
      if (elapsed < 700) { setTimeout(revealApp, 700 - elapsed); return; }
      _doReveal();
    }
    window.addEventListener('store:planChanged', revealApp, { once: true });
    window.addEventListener('store:planChanged', _renderAccessGate);  // v1.0.5 : MAJ bannière/mur à chaque changement de plan
    window.addEventListener('store:synced',      revealApp, { once: true });
    setTimeout(revealApp, 5000);   // fallback : ne jamais laisser le loader bloqué
  }

  // v0.9.275 (F1/F2) — modale « profil de trading » (1er login, nouveaux + existants).
  // Stocke tradingTypes dans le doc settings → adapte l'UI (masque prop firm / crypto).
  // v0.9.396 — setup OBLIGATOIRE au 1er login : wizard 3 étapes.
  //   1) profil de trading (prop/fonds propres/crypto)
  //   2) prop firms (uniquement si « prop firm » coché)
  //   3) instruments tradés (alimente favInstruments)
  // Sauvegarde groupée + setupDone=true à la fin. Les comptes restent créés ensuite,
  // quand l'user veut (pas de friction de création forcée).
  function _showTradingProfileModal() {
    const modal = document.getElementById('tradingProfileModal');
    if (!modal) return;
    // Ne pas empiler avec une autre modale bloquante (vérif email / consent RGPD) :
    // elle se ré-affichera au prochain chargement une fois celle-ci résolue.
    const isUp = el => el && el.style.display && el.style.display !== 'none';
    if (isUp(document.getElementById('verifyEmailGate')) || isUp(document.getElementById('consentModal'))) return;

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const en = i18n.getLang() === 'en';
    const T = {
      pickType:  en ? 'Pick at least one option.'        : 'Choisis au moins une option.',
      pickFirm:  en ? 'Pick at least one prop firm.'     : 'Sélectionne au moins une prop firm.',
      pickInstr: en ? 'Pick at least one instrument.'    : 'Sélectionne au moins un instrument.',
      firmsTtl:  en ? 'Your prop firms'                  : 'Tes prop firms',
      firmsIntro:en ? 'Select the prop firms you use. You can add more in Settings.' : 'Sélectionne les prop firms que tu utilises. Tu pourras en ajouter dans les Réglages.',
      instrTtl:  en ? 'Your instruments'                 : 'Tes instruments',
      instrIntro:en ? 'Pick the instruments you trade. Only these appear when logging a trade (editable in Settings).' : 'Choisis les instruments que tu trades. Seuls ceux-ci apparaîtront au moment de saisir un trade (modifiable dans les Réglages).',
      back:      en ? 'Back'     : 'Retour',
      cont:      en ? 'Continue' : 'Continuer',
      finish:    en ? 'Finish'   : 'Terminer',
    };

    // ── état du wizard (pré-rempli si l'user avait déjà des données) ──
    let types  = (Store.getTradingTypes && Store.getTradingTypes()) || [];
    const firms  = new Set((Store.getSelectedFirms && Store.getSelectedFirms()) || []);
    const instrs = new Set((Store.getSettings && Store.getSettings().favInstruments) || []);

    const $id = id => document.getElementById(id);
    const step1 = $id('tpmStep1'), step2 = $id('tpmStep2'), step3 = $id('tpmStep3');
    const prog  = $id('tpmProgress');

    function hasProp() { return types.includes('propFirm'); }

    function renderProgress(cur) {
      if (!prog) return;
      const total = hasProp() ? 3 : 2;
      const idx = (cur === 3 && !hasProp()) ? 2 : cur;  // étape 3 = 2/2 si pas de firms
      prog.innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i < idx ? 'on' : ''}"></span>`).join('');
    }

    function show(step) {
      if (step1) step1.style.display = step === 1 ? '' : 'none';
      if (step2) step2.style.display = step === 2 ? '' : 'none';
      if (step3) step3.style.display = step === 3 ? '' : 'none';
      renderProgress(step);
    }

    // ── étape 2 : pills de firms ──
    function buildFirmPills() {
      const wrap = $id('tpmFirmPills');
      if (!wrap) return;
      const all = (Store.getPropFirms && Store.getPropFirms()) || {};
      const order = ['apex', 'topstep', 'ftmo', 'ftmo1step', 'lucid', 'fpips', 'tradeify'];
      wrap.innerHTML = order.filter(k => all[k]).map(k =>
        `<button type="button" class="instr-pill${firms.has(k) ? ' on' : ''}" data-firm="${k}">${esc(all[k].name || k)}</button>`).join('');
      wrap.querySelectorAll('.instr-pill').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.firm;
        if (firms.has(k)) { firms.delete(k); b.classList.remove('on'); }
        else { firms.add(k); b.classList.add('on'); }
        const e2 = $id('tpmError2'); if (e2) e2.textContent = '';
      }));
    }

    // ── étape 3 : pills d'instruments (catalogue partagé avec les Réglages) ──
    function buildInstrPills() {
      const wrap = $id('tpmInstrCats');
      if (!wrap) return;
      // UI est un `const` top-level (ui.js), PAS window.UI → tester la référence directe,
      // sinon le catalogue est vide → aucun instrument affiché (= étape 3 bloquée).
      const cat = (typeof UI !== 'undefined' && UI.INSTRUMENT_CATALOG) || [];
      wrap.innerHTML = cat.map(g => {
        const pills = g.items.map(sym =>
          `<button type="button" class="instr-pill${instrs.has(sym) ? ' on' : ''}" data-sym="${esc(sym)}">${esc(sym)}</button>`).join('');
        return `<div class="instr-cat"><div class="instr-cat-label">${esc(en ? g.cat.en : g.cat.fr)}</div><div class="instr-pills">${pills}</div></div>`;
      }).join('');
      wrap.querySelectorAll('.instr-pill').forEach(b => b.addEventListener('click', () => {
        const sym = b.dataset.sym;
        if (instrs.has(sym)) { instrs.delete(sym); b.classList.remove('on'); }
        else { instrs.add(sym); b.classList.add('on'); }
        const e3 = $id('tpmError3'); if (e3) e3.textContent = '';
      }));
    }

    function finish() {
      const e3 = $id('tpmError3');
      if (!instrs.size) { if (e3) e3.textContent = T.pickInstr; return; }
      const btn = $id('tpmFinish'); if (btn) btn.disabled = true;
      try {
        Store.updateSettings({
          tradingTypes:   types,
          selectedFirms:  hasProp() ? [...firms] : [],
          favInstruments: [...instrs],
          setupDone:      true,
        });
      } catch (e) {}
      modal.style.display = 'none';
      try { UI.initSettings(); } catch {}
      try { if (UI.refreshFocusScope) UI.refreshFocusScope(); } catch {}
      try { window.dispatchEvent(new CustomEvent('store:profileChanged')); } catch {}
      // v1.0.2 : juste après le setup, propose l'essai 7j avec CB (1×, skippable).
      try { _showTrialOffer(); } catch (e) {}
    }

    // localise les titres/boutons (steps 2-3 construits hors i18n auto)
    const setTxt = (id, v) => { const e = $id(id); if (e) e.textContent = v; };
    setTxt('tpmTitle2', T.firmsTtl); setTxt('tpmIntro2', T.firmsIntro);
    setTxt('tpmTitle3', T.instrTtl); setTxt('tpmIntro3', T.instrIntro);
    setTxt('tpmBack2', T.back); setTxt('tpmNext2', T.cont);
    setTxt('tpmBack3', T.back); setTxt('tpmFinish', T.finish);

    // affiche + (re)initialise à l'étape 1
    modal.style.display = 'flex';
    show(1);

    // bindings une seule fois
    if (!modal.dataset.bound) {
      modal.dataset.bound = '1';
      $id('tpmNext1') && $id('tpmNext1').addEventListener('click', () => {
        types = [...modal.querySelectorAll('.tp-choice:checked')].map(c => c.value);
        const e1 = $id('tpmError');
        if (!types.length) { if (e1) e1.textContent = T.pickType; return; }
        if (e1) e1.textContent = '';
        if (hasProp()) { buildFirmPills(); show(2); }
        else { buildInstrPills(); show(3); }
      });
      $id('tpmBack2') && $id('tpmBack2').addEventListener('click', () => show(1));
      $id('tpmNext2') && $id('tpmNext2').addEventListener('click', () => {
        if (!firms.size) { const e2 = $id('tpmError2'); if (e2) e2.textContent = T.pickFirm; return; }
        buildInstrPills(); show(3);
      });
      $id('tpmBack3') && $id('tpmBack3').addEventListener('click', () => show(hasProp() ? 2 : 1));
      $id('tpmFinish') && $id('tpmFinish').addEventListener('click', finish);
    }
  }

  // v1.0.2 — Offre d'essai 7j (avec CB) proposée UNE FOIS après le setup wizard.
  // On garde le plan gratuit : « Continuer en gratuit » reste dispo. Si l'user a
  // déjà un abonnement actif ou a déjà vu l'offre → on ne (re)montre rien.
  function _showTrialOffer() {
    const modal = document.getElementById('trialOfferModal');
    if (!modal) return;
    try {
      const s = (Store.getSettings && Store.getSettings()) || {};
      if (s.trialOfferSeen) return;
      const st = (Store.getStripeInfo && Store.getStripeInfo()) || {};
      if (st.customerId && st.subscriptionStatus &&
          !['canceled', 'incomplete_expired', 'incomplete'].includes(st.subscriptionStatus)) return;
    } catch (e) {}
    try { Store.updateSettings({ trialOfferSeen: true }); } catch (e) {}  // 1× seulement

    // Lire l'intention de plan (?plan=funded|elite depuis la landing → pré-sélection)
    let planIntent = 'funded';
    try { planIntent = sessionStorage.getItem('zt_plan_intent') || 'funded'; } catch (e) {}
    const isElite = planIntent === 'elite';

    const en = i18n.getLang() === 'en';
    const $id = id => document.getElementById(id);
    const setTxt = (id, v) => { const e = $id(id); if (e) e.textContent = v; };
    const setHtml = (id, v) => { const e = $id(id); if (e) e.innerHTML = v; };

    if (isElite) {
      if (en) {
        setTxt('tofTitle', '🚀 Start your Elite 7-day trial');
        setHtml('tofIntro', 'Go <strong>Elite</strong>: unlimited accounts, unlimited AI Vision, early access to features, 24h support.');
        setHtml('tofFine', '7 days free, then <strong>€17.99/mo</strong> with code <strong>ZELD40</strong> (−40%). Card required · cancel in 1 click · charged only on day 7.');
        setTxt('tofStart', 'Start Elite trial →');
        setTxt('tofSkip', 'Continue for free');
      } else {
        setTxt('tofTitle', '🚀 Démarre ton essai Elite 7 jours');
        setHtml('tofIntro', 'Passe en <strong>Elite</strong> : comptes illimités, IA Vision illimitée, accès anticipé features, support 24h.');
        setHtml('tofFine', '7 jours gratuits, puis <strong>17,99 €/mois</strong> avec le code <strong>ZELD40</strong> (−40%). Carte requise · annulable en 1 clic · prélevé seulement à J+7.');
        setTxt('tofStart', "Démarrer l'essai Elite →");
        setTxt('tofSkip', 'Continuer en gratuit');
      }
    } else if (en) {
      setTxt('tofTitle', '🚀 Start your 7-day trial');
      setHtml('tofIntro', 'Go <strong>Funded</strong>: 10 accounts · multi-group, 7 AI analyses/week, precise EOD drawdown, PDF archive per trade.');
      setHtml('tofFine', '7 days free, then <strong>€8.99/mo</strong> with code <strong>ZELD40</strong> (−40%). Card required · cancel in 1 click · charged only on day 7.');
      setTxt('tofStart', 'Start 7-day trial →');
      setTxt('tofSkip', 'Continue for free');
    }

    modal.style.display = 'flex';
    if (!modal.dataset.bound) {
      modal.dataset.bound = '1';
      $id('tofSkip') && $id('tofSkip').addEventListener('click', () => { modal.style.display = 'none'; });
      $id('tofStart') && $id('tofStart').addEventListener('click', _startTrialCheckout);
    }
  }

  async function _startTrialCheckout() {
    const btn = document.getElementById('tofStart');
    const err = document.getElementById('tofError');
    if (err) err.textContent = '';
    if (typeof _fbFunctions === 'undefined' || !_fbFunctions) {
      if (err) err.textContent = (i18n.t && i18n.t('off.checkout.err')) || 'Service de paiement indisponible — recharge la page.';
      return;
    }
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    // Force-refresh du token (email tout juste vérifié → évite un refus checkout)
    try {
      if (typeof _fbAuth !== 'undefined' && _fbAuth && _fbAuth.currentUser) {
        await _fbAuth.currentUser.reload();
        await _fbAuth.currentUser.getIdToken(true);
      }
    } catch (e) {}
    try {
      let _planIntent = 'funded';
      try { _planIntent = sessionStorage.getItem('zt_plan_intent') || 'funded'; } catch (e) {}
      const _plan = _planIntent === 'elite' ? 'elite_monthly' : 'funded_monthly';
      if (window.Analytics) Analytics.track('checkout_started', { label: `${_plan}_trialoffer` });
      const res = await _fbFunctions.httpsCallable('createCheckoutSession')({ plan: _plan });
      if (res && res.data && res.data.url) { window.location.href = res.data.url; return; }
      if (err) err.textContent = (i18n.t && i18n.t('off.checkout.err')) || 'Erreur lors de la création du paiement — réessaie.';
    } catch (e) {
      if (err) err.textContent = (i18n.t && i18n.t('off.checkout.err')) || 'Erreur lors de la création du paiement — réessaie.';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  }

  // v0.9.150 — Affiche la consent modal et attend que l'user soumette le form.
  // Retourne une Promise qui se résout dès que `Auth.recordConsent` réussit.
  function _showConsentModal(currentNewsletter) {
    return new Promise((resolve) => {
      const modal = document.getElementById('consentModal');
      const form  = document.getElementById('consentFormEl');
      const cbTerms = document.getElementById('consentAcceptTerms');
      const cbNews  = document.getElementById('consentNewsletter');
      const btn     = document.getElementById('btnConsentSubmit');
      const errEl   = document.getElementById('consentError');
      if (!modal || !form) return resolve();
      // Pré-remplir la checkbox newsletter si user en avait déjà opt-in avant
      if (cbNews) cbNews.checked = !!currentNewsletter;
      if (cbTerms) cbTerms.checked = false;
      errEl.textContent = '';
      // Cacher le loader pour pas le voir derrière le modal pendant l'attente
      if (loader) loader.style.display = 'none';
      ZTLoader.stop();
      modal.style.display = 'flex';

      async function onSubmit(e) {
        e.preventDefault();
        errEl.textContent = '';
        if (!cbTerms.checked) {
          errEl.textContent = i18n.t('auth.err.terms') || 'Tu dois accepter les CGU pour continuer.';
          return;
        }
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '…';
        const r = await Auth.recordConsent({
          acceptedTerms:   true,
          newsletterOptIn: !!cbNews.checked,
        });
        btn.disabled = false;
        btn.textContent = originalText;
        if (r && r.ok) {
          modal.style.display = 'none';
          form.removeEventListener('submit', onSubmit);
          resolve();
        } else {
          errEl.textContent = 'Erreur : ' + (r && r.error || 'inconnue');
        }
      }
      form.addEventListener('submit', onSubmit);
    });
  }

  // ── Firebase Auth state ─────────────────────────────────────────────────────
  // landingScreen retiré en v0.9.114 : si non loggé, on ouvre direct le modal login
  // (l'user arrive depuis index.html landing qui a déjà fait le pitch marketing).
  let _wasLoggedIn = false;
  Auth.onAuthReady(async user => {
    if (user) {
      _wasLoggedIn = true;
      // v0.9.233 : gate vérification email AVANT de lancer l'app.
      // Si non vérifié, on affiche un overlay bloquant tant que l'user n'a pas
      // cliqué sur le lien Firebase + confirmé via "J'ai vérifié".
      const v = await Auth.checkEmailVerified();
      // v0.9.235 : si checkEmailVerified a détecté que le user n'existe plus
      // côté Firebase (deleteUser admin), on bascule sur la modale "compte supprimé".
      if (v.accountGone) {
        _showAccountDeletedGate();
        return;
      }
      if (!v.verified) {
        _showVerifyEmailGate(v.email || '');
        return;
      }
      showLoader(user.username);
      setTimeout(() => launchApp(user), 1200);
    } else {
      // v0.9.235 : si l'user vient d'être logged-in PUIS passe à null sans
      // logout volontaire (= admin a delete son compte / revoke token),
      // on affiche la modale dédiée au lieu du flux login normal.
      const voluntary = Auth._wasVoluntary ? Auth._wasVoluntary() : true;
      if (_wasLoggedIn && !voluntary) {
        _showAccountDeletedGate();
        _wasLoggedIn = false;
        return;
      }
      _wasLoggedIn = false;
      // v0.9.319 : pas loggé → on coupe le loader de boot et on ouvre le modal.
      ZTLoader.stop();
      if (loader) { loader.style.transition = ''; loader.style.opacity = ''; loader.style.display = 'none'; }
      // Pas loggé → ouvre le modal. Mode = inscription si on vient d'un CTA
      // « Créer un compte » (/app?signup=1), sinon connexion. (#bug landing)
      openModal(_initialAuthMode());
    }
  });

  // v0.9.235 : modale "compte supprimé" — exposée globalement pour que les
  // wrappers d'erreurs Firestore/CFs puissent la déclencher quand ils détectent
  // un signal d'account-gone (auth/user-not-found, user-disabled, etc.).
  function _showAccountDeletedGate() {
    const gate = document.getElementById('accountDeletedGate');
    if (!gate) return;
    if (loader) loader.style.display = 'none';
    ZTLoader.stop();
    // Masque tout overlay résiduel (verify email gate, login modal, etc.)
    const overlays = ['verifyEmailGate', 'loginModal', 'consentModal'];
    overlays.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    gate.style.display = 'flex';
    const btnLogout = document.getElementById('adgBtnLogout');
    if (btnLogout) {
      btnLogout.onclick = async () => {
        try { await Auth.logout(); } catch {}
        gate.style.display = 'none';
        window.location.reload();
      };
    }
  }
  // Expose globalement pour que store.js/ui.js puissent le déclencher
  window.showAccountDeleted = _showAccountDeletedGate;

  // ── Verify email gate (v0.9.233) ────────────────────────────────────────────
  // Overlay plein-écran qui bloque l'app tant que l'email n'est pas vérifié.
  // Atténue le risque de faux emails et aligne avec le check `email_verified`
  // côté rules Firestore (v0.9.230) et Cloud Functions.
  function _showVerifyEmailGate(email) {
    const gate    = document.getElementById('verifyEmailGate');
    const emailEl = document.getElementById('vegEmail');
    const status  = document.getElementById('vegStatus');
    const btnCheck  = document.getElementById('vegBtnCheck');
    const btnResend = document.getElementById('vegBtnResend');
    const btnLogout = document.getElementById('vegBtnLogout');
    if (!gate) return;

    if (loader) loader.style.display = 'none';
    ZTLoader.stop();
    if (emailEl) emailEl.textContent = email || '—';
    status.textContent = '';
    gate.style.display = 'flex';

    btnCheck.onclick = async () => {
      btnCheck.disabled = true;
      const original = btnCheck.textContent;
      btnCheck.textContent = (i18n.t && i18n.t('veg.checking')) || 'Vérification…';
      status.textContent = '';
      const v = await Auth.checkEmailVerified();
      if (v.verified) {
        // v0.9.234 fix : reload full au lieu de relancer manuellement launchApp().
        // L'ancien flow appelait launchApp() avec un user fake → freeze car
        // appLaunched déjà true depuis la session précédente / state incohérent.
        status.style.color = 'var(--green)';
        status.textContent = (i18n.t && i18n.t('veg.success')) || '✓ Email vérifié — chargement…';
        setTimeout(() => { window.location.reload(); }, 400);
      } else {
        btnCheck.disabled = false;
        btnCheck.textContent = original;
        status.style.color = 'var(--amber)';
        status.textContent = (i18n.t && i18n.t('veg.notyet')) || 'Pas encore vérifié — clique sur le lien dans ta boîte mail (vérifie les spams).';
      }
    };

    btnResend.onclick = async () => {
      btnResend.disabled = true;
      const original = btnResend.textContent;
      btnResend.textContent = (i18n.t && i18n.t('veg.sending')) || 'Envoi…';
      status.textContent = '';
      const r = await Auth.resendVerification();
      btnResend.disabled = false;
      btnResend.textContent = original;
      if (r && r.ok) {
        status.style.color = 'var(--green)';
        status.textContent = (i18n.t && i18n.t('veg.resent')) || 'Email renvoyé. Vérifie ta boîte (et les spams).';
      } else if (r && r.error === 'already-verified') {
        // Edge case : l'email a été vérifié entre temps → on relance le check
        btnCheck.click();
      } else if (r && r.error === 'auth/too-many-requests') {
        status.style.color = 'var(--red)';
        status.textContent = (i18n.t && i18n.t('veg.toomany')) || 'Trop de tentatives — attends 1-2 min.';
      } else {
        status.style.color = 'var(--red)';
        status.textContent = (i18n.t && i18n.t('veg.error')) || 'Erreur — réessaie dans quelques minutes.';
      }
    };

    btnLogout.onclick = async () => {
      try { await Auth.logout(); } catch {}
      gate.style.display = 'none';
      openModal('login');
    };
  }

  // ── Rate-limiting ───────────────────────────────────────────────────────────
  let _loginAttempts = 0;
  let _loginLockedUntil = 0;
  let _lastRegister = 0;
  let _lastForgot = 0;

  // ── Login ───────────────────────────────────────────────────────────────────
  $('loginFormEl').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginError').textContent = '';
    if (Date.now() < _loginLockedUntil) {
      const wait = Math.ceil((_loginLockedUntil - Date.now()) / 1000);
      $('loginError').textContent = `Trop de tentatives — réessayez dans ${wait}s.`;
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const user = await Auth.login($('loginUsername').value.trim().slice(0, 254), $('loginPassword').value);
    btn.disabled = false;
    if (!user) {
      _loginAttempts++;
      if (_loginAttempts >= 5) {
        _loginLockedUntil = Date.now() + 60_000;
        _loginAttempts = 0;
      }
      $('loginError').textContent = i18n.t('auth.err.login');
      return;
    }
    _loginAttempts = 0;
    showLoader(user.username);
    setTimeout(() => launchApp(user), 1200);
  });

  // ── Register ────────────────────────────────────────────────────────────────
  $('registerFormEl').addEventListener('submit', async e => {
    e.preventDefault();
    $('registerError').textContent = '';
    // Honeypot — si rempli, c'est un bot. On feint le succès sans rien faire.
    const honey = $('regWebsite');
    if (honey && honey.value) {
      $('registerError').style.color = 'var(--green)';
      $('registerError').textContent = '✓';
      return;
    }
    // Rate-limit : 1 inscription / 30s
    if (Date.now() - _lastRegister < 30_000) {
      $('registerError').textContent = 'Merci de patienter avant de réessayer.';
      return;
    }
    const username = $('regUsername').value.trim().slice(0, 30);
    const email    = $('regEmail').value.trim().slice(0, 254);
    const password = $('regPassword').value;
    const passwordConfirm = $('regPasswordConfirm').value;
    if (username.length < 2 || username.length > 30) { $('registerError').textContent = i18n.t('auth.err.username.length') || 'Le pseudo doit faire entre 2 et 30 caractères.'; return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(username))          { $('registerError').textContent = i18n.t('auth.err.username.chars')  || 'Le pseudo ne peut contenir que lettres, chiffres, _ et -.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('registerError').textContent = i18n.t('auth.err.email') || 'Email invalide.'; return; }
    if (password !== passwordConfirm)  { $('registerError').textContent = i18n.t('auth.err.mismatch'); return; }
    // v0.9.287 (#audit) : 8 caractères min + minuscule + MAJUSCULE + chiffre.
    if (password.length < 8 || password.length > 128) { $('registerError').textContent = 'Le mot de passe doit faire entre 8 et 128 caractères.'; return; }
    if (!/[a-z]/.test(password)) { $('registerError').textContent = 'Le mot de passe doit contenir au moins une minuscule.'; return; }
    if (!/[A-Z]/.test(password)) { $('registerError').textContent = 'Le mot de passe doit contenir au moins une majuscule.'; return; }
    if (!/\d/.test(password))    { $('registerError').textContent = 'Le mot de passe doit contenir au moins un chiffre.'; return; }
    // Rejet des mots de passe trop communs (top breachs)
    const COMMON_PASSWORDS = new Set([
      'password1','password12','password123','12345678910','azerty12345','qwerty12345',
      'motdepasse1','iloveyou12','abc123456','admin12345','welcome123','letmein123',
      'monkey12345','dragon12345','baseball12','football12','superman12'
    ]);
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      $('registerError').textContent = 'Ce mot de passe est trop commun — choisis-en un autre.';
      return;
    }
    // hCaptcha — token depuis le widget du form register
    const captchaToken = document.querySelector('#registerFormEl [name="h-captcha-response"]')?.value || '';
    if (!captchaToken) {
      $('registerError').textContent = 'Merci de cocher la case anti-bot.';
      return;
    }
    // v0.9.150 : RGPD consent — CGU obligatoire, newsletter optionnel
    const acceptedTerms   = $('regAcceptTerms').checked;
    const newsletterOptIn = $('regNewsletter').checked;
    if (!acceptedTerms) {
      $('registerError').textContent = i18n.t('auth.err.terms') || 'Tu dois accepter les CGU et la Politique de confidentialité pour créer un compte.';
      return;
    }
    _lastRegister = Date.now();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const result = await Auth.register(username, password, email, captchaToken, { acceptedTerms, newsletterOptIn });
    btn.disabled = false;
    if (result.error) {
      // Reset hCaptcha pour permettre un nouvel essai
      try {
        const widget = document.querySelector('#registerFormEl .h-captcha');
        if (widget && typeof hcaptcha !== 'undefined' && widget.dataset.hcaptchaWidgetId !== undefined) {
          hcaptcha.reset(widget.dataset.hcaptchaWidgetId);
        }
      } catch {}
      $('registerError').textContent = result.error;
      return;
    }
    // Meta Pixel : inscription réussie → conversion top-funnel (optimisation des ads)
    try { if (window.ztTrack) window.ztTrack('CompleteRegistration'); } catch (e) {}

    // v0.9.143 : modale info post-signup — informer l'user sur l'email de
    // vérification (souvent en spam sur Gmail / free.fr / Hotmail car expédié
    // depuis noreply@<project>.firebaseapp.com). Avant : aucun feedback, l'user
    // pensait que le système était cassé. Le resend reste accessible depuis
    // Réglages → Vérification email (shipped v0.9.142).
    const targetEmail = result.email || email;
    const msg = result.emailSent
      ? 'Un email de vérification vient d\'être envoyé à ' + targetEmail + '.\n\n'
        + '⚠ IMPORTANT : vérifie ta boîte de réception ET tes SPAMS. '
        + 'Gmail / free.fr / Hotmail filtrent souvent les emails Firebase.\n\n'
        + 'Sans cette vérification, l\'analyse IA des graphes ne fonctionnera pas. '
        + 'Si tu ne le trouves pas, tu peux le renvoyer depuis Réglages → Vérification email.'
      : 'Ton compte est créé, mais l\'envoi automatique de l\'email de vérification a échoué ('
        + (result.emailError || 'inconnu') + ').\n\n'
        + 'Va dans Réglages → Vérification email après connexion pour le renvoyer.';
    await UI.confirmModal({
      title: 'Compte créé ✓',
      message: msg,
      confirmText: 'OK, j\'ai compris',
      cancelText: false,  // modale info pure — pas de bouton "Annuler"
    });

    showLoader(result.user.username);
    setTimeout(() => launchApp(result.user), 1200);
  });

  // ── Mot de passe oublié ─────────────────────────────────────────────────────
  $('forgotFormEl').addEventListener('submit', async e => {
    e.preventDefault();
    $('forgotError').textContent = '';
    // Rate-limit : 1 demande / 60s
    if (Date.now() - _lastForgot < 60_000) {
      $('forgotError').textContent = 'Merci de patienter 60 secondes avant de réessayer.';
      return;
    }
    const email = $('forgotEmail').value.trim().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      $('forgotError').textContent = i18n.t('auth.err.email') || 'Email invalide.';
      return;
    }
    _lastForgot = Date.now();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const result = await Auth.resetPassword(email);
    btn.disabled = false;
    if (result.error) { $('forgotError').textContent = result.error; return; }
    $('forgotError').style.color = 'var(--green)';
    $('forgotError').textContent = 'Si cet email est associé à un compte, un lien de réinitialisation a été envoyé.';
  });

  // ── Toggle formulaires ──────────────────────────────────────────────────────
  $('showRegister').addEventListener('click',        () => showForm('register'));
  $('showLogin').addEventListener('click',           () => showForm('login'));
  $('showForgot').addEventListener('click',          () => showForm('forgot'));
  $('showLoginFromForgot').addEventListener('click', () => showForm('login'));

  // ── Bandeau de CONSENTEMENT RGPD (Accepter / Refuser) ───────────────────────
  // v1.0.x : le choix `zt_consent` pilote le Meta Pixel (window.ztConsent) — le pixel
  // ne se charge QUE si l'user accepte. Clé partagée avec la landing.
  const cookieBanner = $('cookieBanner');
  if (cookieBanner) {
    let decided = false;
    try { decided = !!localStorage.getItem('zt_consent'); } catch (e) {}
    if (!decided) cookieBanner.style.display = 'flex';
    const decide = (granted) => {
      if (window.ztConsent) window.ztConsent(granted);
      else { try { localStorage.setItem('zt_consent', granted ? 'granted' : 'denied'); } catch (e) {} }
      cookieBanner.style.display = 'none';
    };
    const acc = $('cookieAcceptBtn'); if (acc) acc.addEventListener('click', () => decide(true));
    const ref = $('cookieRefuseBtn'); if (ref) ref.addEventListener('click', () => decide(false));
  }
});
