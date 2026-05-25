#!/usr/bin/env node
// ─── BACKFILL CUSTOM CLAIM `pro` (FIX-SS-CLAIMS, audit sécu v0.9.336) ──────────
// Pose le custom claim Auth `pro` sur les utilisateurs EXISTANTS, à partir de
// leur doc Firestore `users/{uid}/data/plan` :
//   plan == 'pro' (funded / elite / beta) → pro:true
//   sinon (trader gratuit / pas de doc)   → pro:false
//
// Pourquoi : le trigger `syncProClaim` (functions/index.js) ne se déclenche que
// sur un WRITE du doc plan → les users déjà Pro n'ont pas leur claim tant que leur
// plan n'est pas réécrit. Ce script fait le rattrapage une seule fois.
//
// Usage :
//   node scripts/backfill-pro-claims.js --dry    (preview, ne modifie rien)
//   node scripts/backfill-pro-claims.js          (applique)
//
// Prérequis : ADC (gcloud auth application-default login) ou GOOGLE_APPLICATION_CREDENTIALS,
//             avec les droits Firebase Auth admin + Firestore read sur le projet zeldtrade.
//
// À lancer APRÈS avoir déployé le trigger `syncProClaim`, et AVANT de durcir
// storage.rules (sinon les Pro à token périmé voient un upload refusé puis retenté).

'use strict';

const path  = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

async function main() {
  admin.initializeApp({ projectId: 'zeldtrade' });   // ADC / GOOGLE_APPLICATION_CREDENTIALS
  const db   = admin.firestore();
  const auth = admin.auth();

  let scanned = 0, toUpdate = 0, updated = 0, errors = 0;
  let pageToken;

  console.log(`\n=== Backfill claim "pro" ${DRY ? '[DRY-RUN — aucune écriture]' : '[APPLIQUE]'} ===\n`);

  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      scanned++;
      let isPro = false;
      try {
        const snap = await db.doc(`users/${u.uid}/data/plan`).get();
        isPro = snap.exists && snap.data() && snap.data().plan === 'pro';
      } catch (e) {
        console.warn(`  ⚠ lecture plan échouée uid=${u.uid.slice(0, 8)} : ${e && e.message}`);
      }
      const current = !!(u.customClaims && u.customClaims.pro);
      if (current === isPro) continue;   // déjà à jour

      toUpdate++;
      const label = `${(u.email || u.uid).padEnd(34)} ${current} → ${isPro}`;
      if (DRY) {
        console.log(`  • [dry] ${label}`);
        continue;
      }
      try {
        await auth.setCustomUserClaims(u.uid, Object.assign({}, u.customClaims || {}, { pro: isPro }));
        updated++;
        console.log(`  ✓ ${label}`);
      } catch (e) {
        errors++;
        console.error(`  ✗ ${label}  (${e && e.message})`);
      }
    }
    pageToken = res.pageToken;
  } while (pageToken);

  console.log(`\n=== Résumé ===`);
  console.log(`  Scannés    : ${scanned}`);
  console.log(`  À mettre à jour : ${toUpdate}`);
  if (!DRY) {
    console.log(`  Mis à jour : ${updated}`);
    console.log(`  Erreurs    : ${errors}`);
  } else {
    console.log(`  (dry-run — relance sans --dry pour appliquer)`);
  }
  console.log(`\n  Rappel : les clients propagent le claim via getIdToken(true)`);
  console.log(`  (le retry d'upload sur storage/unauthorized le fait déjà).\n`);

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
