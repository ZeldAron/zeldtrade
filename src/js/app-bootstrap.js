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
  }

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

  // ── Loader ──────────────────────────────────────────────────────────────────
  function showLoader(username) {
    closeModal();
    loader.style.display = 'flex';
    $('loaderUser').textContent = username;
    const fill = $('loaderFill');
    fill.style.transition = 'none'; fill.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = 'width 1.1s cubic-bezier(0.4,0,0.2,1)';
      fill.style.width = '100%';
    }));
  }

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
    Store.initForUser(user.id);
    $('userPillName').textContent = user.username;
    $('userAvatar').textContent   = user.username[0].toUpperCase();
    // Fade-out du loader uniquement (landingScreen supprimé v0.9.114)
    if (loader) {
      loader.style.transition = 'opacity 0.45s ease';
      loader.style.opacity    = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 450);
    }
    initApp();
    window.addEventListener('store:synced', () => {
      try {
        UI.renderList();
        UI.updateStats();
        UI.initSettings();
        const planBadge = document.getElementById('planBadge');
        if (planBadge) {
          planBadge.textContent = Store.isPro() ? 'PRO' : 'BASIC';
          planBadge.className   = 'plan-badge ' + (Store.isPro() ? 'plan-pro' : 'plan-basic');
        }
      } catch {}
    }, { once: true });
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
  Auth.onAuthReady(async user => {
    if (user) {
      // v0.9.233 : gate vérification email AVANT de lancer l'app.
      // Si non vérifié, on affiche un overlay bloquant tant que l'user n'a pas
      // cliqué sur le lien Firebase + confirmé via "J'ai vérifié".
      const v = await Auth.checkEmailVerified();
      if (!v.verified) {
        _showVerifyEmailGate(v.email || '');
        return;
      }
      showLoader(user.username);
      setTimeout(() => launchApp(user), 1200);
    } else {
      // Pas loggé → ouvre direct le modal login (pas de flash sur ancien content)
      openModal('login');
    }
  });

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
    if (password.length < 10 || password.length > 128) { $('registerError').textContent = 'Le mot de passe doit faire entre 10 et 128 caractères.'; return; }
    if (!/\d/.test(password))  { $('registerError').textContent = 'Le mot de passe doit contenir au moins un chiffre.'; return; }
    if (!/[a-zA-Z]/.test(password)) { $('registerError').textContent = 'Le mot de passe doit contenir au moins une lettre.'; return; }
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
        + '⚠️ IMPORTANT : vérifie ta boîte de réception ET tes SPAMS. '
        + 'Gmail / free.fr / Hotmail filtrent souvent les emails Firebase.\n\n'
        + 'Sans cette vérification, l\'analyse IA des graphes ne fonctionnera pas. '
        + 'Si tu ne le trouves pas, tu peux le renvoyer depuis Réglages → Vérification email.'
      : 'Ton compte est créé, mais l\'envoi automatique de l\'email de vérification a échoué ('
        + (result.emailError || 'inconnu') + ').\n\n'
        + 'Va dans Réglages → Vérification email après connexion pour le renvoyer.';
    await UI.confirmModal({
      title: 'Compte créé ✅',
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
