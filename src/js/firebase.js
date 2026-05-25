// ─── FIREBASE INIT ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCX5AWqdFyunxpYV9LgaacHU1osXQDbEss',
  authDomain:        'zeldtrade.firebaseapp.com',
  projectId:         'zeldtrade',
  storageBucket:     'zeldtrade.firebasestorage.app',
  messagingSenderId: '356908373821',
  appId:             '1:356908373821:web:4af7d3be51018b56ef1754',
};

const _fbApp = firebase.initializeApp(firebaseConfig);

// ─── APP CHECK ────────────────────────────────────────────────────────────────
// v0.9.158 : App Check ABANDONNÉ. Bug fondamental Firebase x Safari ITP
// (issue firebase/firebase-js-sdk #9135, ouverte mars 2025, non fixée).
// Remplacé par Cloudflare Turnstile (cf. modal.js + functions/index.js).
// Plus de dépendance reCAPTCHA Enterprise → pas d'init côté client.

const _fbAuth      = firebase.auth();
const _fbDb        = firebase.firestore();
const _fbFunctions = firebase.functions ? firebase.app().functions('europe-west1') : null;
const _fbStorage   = firebase.storage ? firebase.storage() : null;

// ─── ÉMULATEURS LOCAUX (v0.9.348) ─────────────────────────────────────────────
// En local (localhost / 127.0.0.1), branche le client sur la suite d'émulateurs
// Firebase → environnement de test 100 % isolé, ne touche JAMAIS la prod.
// Totalement inerte en prod (le hostname n'y est jamais localhost).
// Lancer l'env de test :  bash scripts/dev.sh   (puis ouvrir http://127.0.0.1:5050)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try {
    _fbAuth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
    _fbDb.useEmulator('127.0.0.1', 8080);
    if (_fbFunctions) _fbFunctions.useEmulator('127.0.0.1', 5001);
    if (_fbStorage)   _fbStorage.useEmulator('127.0.0.1', 9199);
    console.info('%c[Firebase] Émulateurs LOCAUX actifs — données isolées de la prod.', 'color:#a78bfa;font-weight:bold');
  } catch (e) {
    console.warn('[Firebase] Connexion aux émulateurs échouée :', e && e.message);
  }
}
