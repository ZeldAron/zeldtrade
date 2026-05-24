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
  function showForm(mode) {
    ['loginFormEl','registerFormEl','forgotFormEl'].forEach(id => {
      $(id).style.display = (id === mode + 'FormEl') ? '' : 'none';
    });
    ['loginError','registerError','forgotError'].forEach(id => {
      if ($(id)) $(id).textContent = '';
    });
    const focus = { login: 'loginUsername', register: 'regUsername', forgot: 'forgotEmail' };
    setTimeout(() => { if ($(focus[mode])) $(focus[mode]).focus(); }, 60);
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
      if (p.get('signup') === '1' || location.hash === '#signup' || location.hash === '#register') {
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
      try { const v = window.Changelog && Changelog.getEntries && Changelog.getEntries()[0]; const ve = $('ztLoaderVer'); if (v && ve) ve.textContent = 'v' + v.version; } catch (e) {}
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

  function showLoader(username) {
    closeModal();
    if (loader) { loader.classList.remove('done'); loader.style.opacity = ''; loader.style.transition = ''; loader.style.display = 'flex'; }
    ZTLoader.start(username);
  }

  // v0.9.319 : démarre l'animation du loader IMMÉDIATEMENT (déjà visible via display:flex
  // dans le HTML) → couvre l'app shell dès le 1er paint, avant que l'auth soit résolue.
  ZTLoader.start();

  // ── Launch app ──────────────────────────────────────────────────────────────
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
    Store.initForUser(user.id);
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
      } catch {}
      // v0.9.318 : on termine l'animation (snap 100 % + « Prêt ») PUIS fondu de sortie.
      ZTLoader.finish(() => {
        if (loader) {
          loader.style.transition = 'opacity 0.45s ease';
          loader.style.opacity    = '0';
          setTimeout(() => { loader.style.display = 'none'; loader.classList.remove('done'); loader.style.opacity = ''; }, 450);
        }
      });
      // v0.9.275 (F1/F2) : profil de trading non renseigné → modale 1er login
      let _tpmShown = false;
      try {
        if (Store.getTradingTypes && !Store.getTradingTypes()) {
          _showTradingProfileModal();
          const m = document.getElementById('tradingProfileModal');
          _tpmShown = !!(m && m.style.display === 'flex');
        }
      } catch {}
      // v0.9.335 : visite guidée au 1er login (flag localStorage zt_tour_done).
      // Si la modale profil de trading vient de s'afficher, on attend sa validation
      // (store:profileChanged) pour ne pas empiler deux overlays sur l'écran d'accueil.
      try {
        if (window.ZTTour) {
          if (_tpmShown) window.addEventListener('store:profileChanged', () => { try { ZTTour.maybeAuto(); } catch (e) {} }, { once: true });
          else ZTTour.maybeAuto();
        }
      } catch (e) {}
    }
    function revealApp() {
      // min 700 ms d'affichage (évite un flash de loader si Firestore répond très vite)
      const elapsed = Date.now() - _loaderT0;
      if (elapsed < 700) { setTimeout(revealApp, 700 - elapsed); return; }
      _doReveal();
    }
    window.addEventListener('store:planChanged', revealApp, { once: true });
    window.addEventListener('store:synced',      revealApp, { once: true });
    setTimeout(revealApp, 5000);   // fallback : ne jamais laisser le loader bloqué
  }

  // v0.9.275 (F1/F2) — modale « profil de trading » (1er login, nouveaux + existants).
  // Stocke tradingTypes dans le doc settings → adapte l'UI (masque prop firm / crypto).
  function _showTradingProfileModal() {
    const modal = document.getElementById('tradingProfileModal');
    const form  = document.getElementById('tradingProfileForm');
    const err   = document.getElementById('tpmError');
    if (!modal || !form) return;
    // Ne pas empiler avec une autre modale bloquante (vérif email / consent RGPD) :
    // elle se ré-affichera au prochain chargement une fois celle-ci résolue.
    const isUp = el => el && el.style.display && el.style.display !== 'none';
    if (isUp(document.getElementById('verifyEmailGate')) || isUp(document.getElementById('consentModal'))) return;
    modal.style.display = 'flex';
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const checked = [...modal.querySelectorAll('.tp-choice:checked')].map(c => c.value);
      if (!checked.length) {
        if (err) err.textContent = i18n.getLang() === 'en' ? 'Pick at least one option.' : 'Choisis au moins une option.';
        return;
      }
      const btn = document.getElementById('btnTradingProfileSubmit');
      if (btn) btn.disabled = true;
      try { Store.updateSettings({ tradingTypes: checked }); } catch {}
      modal.style.display = 'none';
      try { UI.initSettings(); } catch {}
      try { window.dispatchEvent(new CustomEvent('store:profileChanged')); } catch {}
    });
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

  // ── Cookie banner ───────────────────────────────────────────────────────────
  const cookieBanner = $('cookieBanner');
  if (cookieBanner && !localStorage.getItem('zt_cookie_ok')) {
    cookieBanner.style.display = 'flex';
  }
  const cookieBtn = $('cookieAcceptBtn');
  if (cookieBtn) cookieBtn.addEventListener('click', () => {
    cookieBanner.style.display = 'none';
    localStorage.setItem('zt_cookie_ok', '1');
  });
});
