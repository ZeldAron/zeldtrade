// ─── AUTH (Firebase) ──────────────────────────────────────────────────────────

const Auth = (() => {

  function _safeUsername(user) {
    if (user.displayName) return user.displayName;
    if (user.email && user.email.includes('@')) return user.email.split('@')[0];
    return 'user';
  }

  function getCurrentUser() {
    return _fbAuth.currentUser
      ? { id: _fbAuth.currentUser.uid, username: _safeUsername(_fbAuth.currentUser) }
      : null;
  }

  function _storeUserEmail(user) {
    if (!user) return;
    // v0.9.150 : merge:true pour ne PAS écraser termsAccepted / newsletterOptIn
    // (RGPD consent fields écrits au signup ou via consent modal). Sans merge,
    // chaque login wipait ces fields → user devait re-accepter à chaque fois.
    _fbDb.collection('userEmails').doc(user.uid).set({
      uid:      user.uid,
      email:    user.email || '',
      username: String(user.displayName || '').replace(/[<>"'`]/g, '').trim().slice(0, 50),
      lastSeen: Date.now(),
    }, { merge: true }).catch(() => {});
  }

  // Appelé par l'app pour attendre que Firebase confirme la session
  function onAuthReady(cb) {
    _fbAuth.onAuthStateChanged(user => {
      if (user) _storeUserEmail(user);
      cb(user ? { id: user.uid, username: _safeUsername(user) } : null);
    });
  }

  async function login(email, password) {
    try {
      const cred = await _fbAuth.signInWithEmailAndPassword(email, password);
      const user  = cred.user;
      return { id: user.uid, username: _safeUsername(user) };
    } catch (e) {
      return null;
    }
  }

  // v0.9.150 : version actuelle des CGU/Privacy — bumper si modif majeure des conditions
  // pour forcer re-acceptation des users existants
  const TERMS_VERSION = 'v1.0';

  async function register(username, password, email, captchaToken, opts) {
    const name = username.trim();
    if (!name || !password || !email) return { error: i18n.t('auth.err.required') };
    // Sanitize strict (mêmes règles qu'au form HTML : alphanum + _ + -)
    const safeName  = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    if (safeName.length < 2) return { error: i18n.t('auth.err.username.chars') || 'Pseudo invalide.' };
    const safeEmail = String(email).replace(/[\s]/g, '').slice(0, 254);
    // v0.9.150 : RGPD — acceptation CGU/Privacy obligatoire
    const acceptedTerms   = !!(opts && opts.acceptedTerms);
    const newsletterOptIn = !!(opts && opts.newsletterOptIn);
    if (!acceptedTerms) return { error: i18n.t('auth.err.terms') || 'Tu dois accepter les CGU pour créer un compte.' };
    try {
      const cred = await _fbAuth.createUserWithEmailAndPassword(safeEmail, password);
      await cred.user.updateProfile({ displayName: safeName });

      // v0.9.125 : créer immédiatement le doc userEmails (anti-race).
      // v0.9.150 : inclut termsAccepted + newsletterOptIn pour RGPD trail.
      try {
        await _fbDb.collection('userEmails').doc(cred.user.uid).set({
          uid:      cred.user.uid,
          email:    safeEmail,
          username: safeName,
          lastSeen: Date.now(),
          termsAccepted:   { version: TERMS_VERSION, acceptedAt: Date.now() },
          newsletterOptIn: newsletterOptIn,
        });
      } catch (e) {
        // Non bloquant : si rules refusent, onAuthStateChanged retentera au prochain login
        console.warn('[register] storeUserEmail failed', e && e.code);
      }

      // v0.9.143 : Email de vérification — on AWAIT et on remonte le statut
      // au caller pour informer l'user (ex: vérifier les spams). Avant le fix,
      // le .catch(()=>{}) avalait toutes les erreurs silencieusement → user
      // confus de ne rien recevoir, sans aucun signal côté front.
      let emailSent = false;
      let emailError = null;
      try {
        await cred.user.sendEmailVerification();
        emailSent = true;
      } catch (e) {
        emailError = (e && e.code) || 'unknown';
        console.warn('[register] sendEmailVerification failed:', emailError, e && e.message);
      }

      // Notif admin via Cloud Function (Discord webhook → #new-users public)
      try {
        if (_fbFunctions && captchaToken) {
          const callable = _fbFunctions.httpsCallable('notifyNewSignup');
          callable({ captchaToken }).catch(() => {});
        }
      } catch {}

      return {
        user: { id: cred.user.uid, username: safeName },
        emailSent,
        emailError,
        email: safeEmail,
      };
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') return { error: i18n.t('auth.err.taken') };
      if (e.code === 'auth/invalid-email')        return { error: i18n.t('auth.err.email') };
      if (e.code === 'auth/weak-password')        return { error: i18n.t('auth.err.weak') };
      return { error: i18n.t('auth.err.unknown') };
    }
  }

  // v0.9.143 : helper pour renvoyer l'email de vérification post-signup.
  // Utilisé depuis la modale "Compte créé" en app-bootstrap.js.
  async function resendVerification() {
    const user = _fbAuth.currentUser;
    if (!user) return { error: 'not-authenticated' };
    if (user.emailVerified) return { error: 'already-verified' };
    try {
      await user.sendEmailVerification();
      return { ok: true };
    } catch (e) {
      return { error: (e && e.code) || 'unknown' };
    }
  }

  // v0.9.233 : force-refresh du token Firebase pour récupérer la valeur fraîche
  // de `emailVerified`. Le state cached côté client peut être stale (Firebase
  // ne pousse pas l'update en temps réel). Utilisé par la gate post-login.
  async function checkEmailVerified() {
    const user = _fbAuth.currentUser;
    if (!user) return { verified: false, error: 'not-authenticated' };
    try {
      await user.reload();
      // Force le refresh du ID token avec les claims à jour
      await user.getIdToken(true);
    } catch (e) {
      // Si le reload échoue (offline, token expired), on retourne l'état actuel
      console.warn('[checkEmailVerified] reload failed:', e && e.code);
    }
    return { verified: !!user.emailVerified, email: user.email || '' };
  }

  async function resetPassword(email) {
    try {
      await _fbAuth.sendPasswordResetEmail(email);
    } catch {
      // Ne pas révéler si l'email existe ou non
    }
    return { ok: true };
  }

  function logout() {
    return _fbAuth.signOut();
  }

  async function deleteAccount(email, password) {
    const user = _fbAuth.currentUser;
    if (!user) return { error: 'Non connecté' };
    try {
      const cred = firebase.auth.EmailAuthProvider.credential(email, password);
      await user.reauthenticateWithCredential(cred);

      // Supprime d'abord toutes les données Firestore — si une suppression échoue,
      // l'utilisateur conserve son compte et peut réessayer (pas d'état orphelin).
      const dataRef = _fbDb.collection('users').doc(user.uid).collection('data');
      const snap    = await dataRef.get();
      await Promise.all(snap.docs.map(d => d.ref.delete()));
      await _fbDb.collection('userEmails').doc(user.uid).delete().catch(() => {});

      // RGPD : supprime aussi les proCodeHashes attribués à cet uid (sinon
      // l'email reste dans la base après suppression du compte).
      try {
        const codesSnap = await _fbDb.collection('proCodeHashes').where('uid', '==', user.uid).get();
        await Promise.all(codesSnap.docs.map(d => d.ref.delete().catch(() => null)));
      } catch (e) { console.warn('[Auth] deleteAccount proCodeHashes', e); }

      // RGPD : supprime tous les screenshots Storage des trades du user
      // (sans ça, les images restent à vie dans le bucket → violation art. 17)
      try {
        const trades = Store.getTrades();
        await Promise.allSettled(
          trades
            .filter(t => t.screenshotPath)
            .map(t => Store.deleteTradeScreenshot(t.screenshotPath))
        );
      } catch (e) { console.warn('[Auth] deleteAccount screenshots', e); }

      // Nettoie le cache local
      try { Store.clearLocalCache(); } catch {}

      // Supprime le compte Firebase Auth en dernier (point de non-retour)
      await user.delete();
      return { ok: true };
    } catch(e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
        return { error: i18n.t('auth.err.login') };
      if (e.code === 'auth/invalid-email')
        return { error: i18n.t('auth.err.email') };
      if (e.code === 'auth/user-mismatch')
        return { error: i18n.t('auth.err.mismatch') };
      return { error: i18n.t('auth.err.unknown') };
    }
  }

  // Compat shim — plus utilisé mais évite les erreurs si appelé ailleurs
  function touchSession() {}

  // ────────────────────────────────────────────────────────────────────────────
  // v0.9.150 — RGPD CONSENT helpers
  // ────────────────────────────────────────────────────────────────────────────

  // Vérifie si l'user courant a accepté la version actuelle des CGU.
  // Retourne :
  //   { needsConsent: false, currentNewsletter: bool }  → tout est OK
  //   { needsConsent: true,  currentNewsletter: bool }  → afficher modal consent
  //   { error: 'not-authenticated' | 'lookup-failed' }
  async function getConsentStatus() {
    const user = _fbAuth.currentUser;
    if (!user) return { error: 'not-authenticated' };
    try {
      const snap = await _fbDb.collection('userEmails').doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;
      const accepted = data && data.termsAccepted;
      const newsletter = !!(data && data.newsletterOptIn);
      // Pas de doc, pas de termsAccepted, ou version obsolète → consent requis
      const needs = !accepted || accepted.version !== TERMS_VERSION;
      return { needsConsent: needs, currentNewsletter: newsletter };
    } catch (e) {
      console.warn('[Auth] getConsentStatus failed:', e && e.message);
      return { error: 'lookup-failed' };
    }
  }

  // Enregistre l'acceptation des CGU (et l'opt-in newsletter) pour l'user courant.
  // Utilisé par la consent modal pour les users existants OU par le toggle Réglages.
  async function recordConsent(opts) {
    const user = _fbAuth.currentUser;
    if (!user) return { error: 'not-authenticated' };
    const acceptedTerms   = !!(opts && opts.acceptedTerms);
    const newsletterOptIn = !!(opts && opts.newsletterOptIn);
    if (!acceptedTerms) return { error: 'terms-required' };
    try {
      await _fbDb.collection('userEmails').doc(user.uid).set({
        termsAccepted:   { version: TERMS_VERSION, acceptedAt: Date.now() },
        newsletterOptIn: newsletterOptIn,
      }, { merge: true });
      return { ok: true };
    } catch (e) {
      console.warn('[Auth] recordConsent failed:', e && e.code, e && e.message);
      return { error: (e && e.code) || 'write-failed' };
    }
  }

  // Toggle newsletter uniquement (depuis Réglages — pas besoin de re-accepter CGU)
  async function setNewsletterOptIn(value) {
    const user = _fbAuth.currentUser;
    if (!user) return { error: 'not-authenticated' };
    try {
      await _fbDb.collection('userEmails').doc(user.uid).set({
        newsletterOptIn: !!value,
      }, { merge: true });
      return { ok: true };
    } catch (e) {
      console.warn('[Auth] setNewsletterOptIn failed:', e && e.code);
      return { error: (e && e.code) || 'write-failed' };
    }
  }

  return { login, register, logout, getCurrentUser, onAuthReady, resetPassword, resendVerification, checkEmailVerified, touchSession, deleteAccount,
           getConsentStatus, recordConsent, setNewsletterOptIn };
})();
