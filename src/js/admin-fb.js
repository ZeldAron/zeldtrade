// ─── FIREBASE ADMIN — SDK MODULAIRE + SHIM COMPAT (v0.9.393) ─────────────────
// Pourquoi : le SDK *compat* n'expose PAS TotpMultiFactorGenerator → impossible
// d'enrôler/vérifier une 2FA TOTP. On charge donc le SDK *modulaire* (qui le
// supporte) et on reconstruit des objets `_fbAuth` / `_fbDb` / `_fbFunctions`
// à l'API « compat » pour que admin.js reste quasi inchangé.
//
// ISOLÉ À LA PAGE ADMIN : l'app principale (index.html) garde firebase.js compat.
// Ce fichier est chargé en <script type="module"> → exécuté APRÈS le parse,
// AVANT DOMContentLoaded (qui déclenche Admin.init()). Il pose les globals sur
// `window` que admin.js lit en référence libre.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  multiFactor, TotpMultiFactorGenerator, getMultiFactorResolver,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs,
  query as fsQuery, where, orderBy, limit, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import {
  getFunctions, httpsCallable, connectFunctionsEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js';

// v0.9.394 : multi-environnement par hostname (même logique que firebase.js).
const _FB_PROD = {
  apiKey:            'AIzaSyCX5AWqdFyunxpYV9LgaacHU1osXQDbEss',
  authDomain:        'zeldtrade.firebaseapp.com',
  projectId:         'zeldtrade',
  storageBucket:     'zeldtrade.firebasestorage.app',
  messagingSenderId: '356908373821',
  appId:             '1:356908373821:web:4af7d3be51018b56ef1754',
};
const _FB_STAGING = {
  apiKey:            'AIzaSyDrhhUvHG01ayM5zhxX4kDqAE7OOpTEIJs',
  authDomain:        'zeldtrade-staging.firebaseapp.com',
  projectId:         'zeldtrade-staging',
  storageBucket:     'zeldtrade-staging.firebasestorage.app',
  messagingSenderId: '396896715351',
  appId:             '1:396896715351:web:7a7cb7b0267637d3a61912',
};
const _IS_STAGING = /(^|\.)zeldtrade-staging\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
const firebaseConfig = _IS_STAGING ? _FB_STAGING : _FB_PROD;

const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const functions = getFunctions(app, 'europe-west1');

// ── Émulateurs locaux (parité avec firebase.js de l'app) ─────────────────────
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.info('%c[admin-fb] Émulateurs LOCAUX actifs.', 'color:#a78bfa;font-weight:bold');
  } catch (e) { console.warn('[admin-fb] connexion émulateurs échouée :', e && e.message); }
}

// ── Shim Firestore : reconstruit l'API chaînée compat sur le SDK modulaire ───
function wrapDocSnap(s) {
  // `exists` est une PROPRIÉTÉ en compat (méthode en modulaire) → on l'aplatit.
  return { exists: s.exists(), id: s.id, data: () => s.data(), ref: s.ref };
}
function wrapQuerySnap(s) {
  return {
    size:    s.size,
    empty:   s.empty,
    docs:    s.docs.map(wrapDocSnap),
    forEach: (cb) => s.docs.forEach(d => cb(wrapDocSnap(d))),
  };
}
function _collRef(segments, constraints) {
  constraints = constraints || [];
  return {
    doc(id) {
      const parts = String(id).split('/').filter(Boolean);
      return _docRef(segments.concat(parts));
    },
    where(f, op, v) { return _collRef(segments, constraints.concat([where(f, op, v)])); },
    orderBy(f, dir) { return _collRef(segments, constraints.concat([orderBy(f, dir)])); },
    limit(n)        { return _collRef(segments, constraints.concat([limit(n)])); },
    async get() {
      const c = collection(db, segments[0], ...segments.slice(1));
      const q = constraints.length ? fsQuery(c, ...constraints) : c;
      return wrapQuerySnap(await getDocs(q));
    },
  };
}
function _docRef(segments) {
  return {
    collection(name) { return _collRef(segments.concat([name])); },
    async get() {
      const d = doc(db, segments[0], ...segments.slice(1));
      return wrapDocSnap(await getDoc(d));
    },
  };
}
const _fbDb = {
  collection(name) { return _collRef([name]); },
  doc(path)        { return _docRef(String(path).split('/').filter(Boolean)); },
};

// ── Shim Auth ────────────────────────────────────────────────────────────────
const _fbAuth = {
  get currentUser() { return auth.currentUser; },
  signInWithEmailAndPassword: (e, p) => signInWithEmailAndPassword(auth, e, p),
  signOut:            () => signOut(auth),
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
};

// ── Shim Functions ─────────────────────────────────────────────────────────
const _fbFunctions = {
  httpsCallable: (name) => {
    const fn = httpsCallable(functions, name);
    return (data) => fn(data);   // renvoie une promesse → { data }
  },
};

// ── Helpers MFA modulaires exposés à admin.js (TOTP) ─────────────────────────
window._mfaApi = {
  multiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver: (err) => getMultiFactorResolver(auth, err),
};

// ── Globals lus par admin.js (références libres → window) ────────────────────
window._fbAuth      = _fbAuth;
window._fbDb        = _fbDb;
window._fbFunctions = _fbFunctions;
window._fbReady     = true;
