// ─── LANDING CONTACT FORM (v0.9.172) ──────────────────────────────────────────
// Form contact anonyme sur la landing page. Appelle la CF `sendContactMessage`
// en mode non-authentifié (juste pseudo + message). Pas de captcha, pas d'email.
// Throttle 60s côté client + 60s/IP côté serveur.

(function () {
  // Init Firebase (clé API publique — sécurité via Firestore rules + CFs)
  firebase.initializeApp({
    apiKey:            'AIzaSyCX5AWqdFyunxpYV9LgaacHU1osXQDbEss',
    authDomain:        'zeldtrade.firebaseapp.com',
    projectId:         'zeldtrade',
    storageBucket:     'zeldtrade.firebasestorage.app',
    messagingSenderId: '356908373821',
    appId:             '1:356908373821:web:4af7d3be51018b56ef1754',
  });
  const fn = firebase.app().functions('europe-west1');

  // v0.9.278 : compteur de visites cookieless — 1 ping par session (landing).
  (function pingVisit() {
    try {
      if (sessionStorage.getItem('zeld_visit_ping')) return;
      sessionStorage.setItem('zeld_visit_ping', '1');
      fn.httpsCallable('recordVisit')().catch(() => {});
    } catch (e) { /* silencieux */ }
  })();

  // v0.9.252 : compteur d'inscrits dynamique dans le hero.
  // Appelle getPublicStats (callable anonyme) → anime un count-up de 0 → N.
  (function loadUserCount() {
    const box = document.getElementById('heroUserCount');
    const num = document.getElementById('heroUserCountNum');
    if (!box || !num) return;
    fn.httpsCallable('getPublicStats')()
      .then((res) => {
        const target = Math.max(0, parseInt(res && res.data && res.data.userCount, 10) || 0);
        // v0.9.322 : seuil abaissé à 5 (le compteur exclut désormais les comptes
        // perso/test → vrai nombre d'externes, ~8). En dessous de 5 on garde juste
        // le badge « Bêta ouverte » (un trop petit chiffre = signal social faible).
        if (target < 5) return;
        box.style.display = 'inline-flex';
        // Count-up animé (~900ms, ease-out)
        const duration = 900;
        const start = performance.now();
        function tick(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          num.textContent = Math.round(eased * target).toLocaleString('fr-FR');
          if (t < 1) requestAnimationFrame(tick);
          else num.textContent = target.toLocaleString('fr-FR');
        }
        requestAnimationFrame(tick);
      })
      .catch(() => { /* fail-soft : on n'affiche simplement pas le compteur */ });
  })();

  // v0.9.253 : bannière cookies RGPD. Affichée tant que pas acquittée.
  // Clé partagée `zt_cookie_ok` avec l'app → un seul acquittement pour les 2.
  (function cookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const accept = document.getElementById('cookieAcceptBtn');
    if (!banner || !accept) return;
    try {
      if (!localStorage.getItem('zt_cookie_ok')) banner.style.display = 'flex';
    } catch { banner.style.display = 'flex'; }
    accept.addEventListener('click', () => {
      try { localStorage.setItem('zt_cookie_ok', '1'); } catch {}
      banner.style.display = 'none';
    });
  })();

  const form    = document.getElementById('lcForm');
  const success = document.getElementById('lcSuccess');
  const nameEl  = document.getElementById('lcName');
  const msgEl   = document.getElementById('lcMessage');
  const honey   = document.getElementById('lcWebsite');
  const errEl   = document.getElementById('lcError');
  const btn     = document.getElementById('lcSend');

  if (!btn) {
    console.warn('[landing-contact] DOM elements missing — section #contact absente ?');
    return;
  }

  let _lastSubmit = 0;

  // v0.9.328 : messages JS du formulaire contact adaptés à la langue active de la landing.
  const L = (fr, en) => (document.documentElement.lang === 'en' ? en : fr);

  async function submit() {
    errEl.textContent = '';
    const name    = (nameEl.value || '').trim().replace(/[\r\n]/g, '').slice(0, 100);
    const message = (msgEl.value  || '').trim().slice(0, 5000);

    // Honeypot
    if (honey && honey.value) {
      _lastSubmit = Date.now();
      form.style.display    = 'none';
      success.style.display = 'block';
      return;
    }
    if (Date.now() - _lastSubmit < 60000) {
      errEl.textContent = L('Merci de patienter 60 secondes avant de renvoyer un message.', 'Please wait 60 seconds before sending another message.');
      return;
    }
    if (name.length < 2)    { errEl.textContent = L('Pseudo trop court (min 2 caractères).', 'Name too short (min 2 characters).'); return; }
    if (message.length < 5) { errEl.textContent = L('Message trop court (min 5 caractères).', 'Message too short (min 5 characters).'); return; }

    btn.disabled    = true;
    btn.textContent = L('Envoi…', 'Sending…');
    try {
      const callable = fn.httpsCallable('sendContactMessage');
      const res      = await callable({ name, message });
      if (res.data && res.data.ok) {
        _lastSubmit = Date.now();
        form.style.display    = 'none';
        success.style.display = 'block';
      } else {
        throw new Error('Échec d\'envoi');
      }
    } catch (e) {
      console.error('[landing-contact] submit error', e);
      const code = e.code || '';
      const msg  = e.message || '';
      if (code === 'functions/resource-exhausted' || code === 'resource-exhausted') {
        errEl.textContent = msg;
      } else if (code === 'functions/invalid-argument' || code === 'invalid-argument') {
        errEl.textContent = msg || L('Données invalides.', 'Invalid data.');
      } else {
        errEl.textContent = L('Erreur d\'envoi — réessaie dans un instant.', 'Send error — try again in a moment.');
      }
      btn.disabled    = false;
      btn.textContent = L('Envoyer →', 'Send →');
    }
  }

  btn.addEventListener('click', submit);
  msgEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  });
})();
