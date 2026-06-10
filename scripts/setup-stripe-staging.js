#!/usr/bin/env node
/**
 * Configure Stripe TEST sur le projet STAGING (zeldtrade-staging).
 * - Crée les produits/prix TEST (Funded 14,99/mois · 149,90/an ; Elite 29,99/mois · 299,90/an)
 * - Pousse la clé + les 4 price IDs dans Secret Manager (staging UNIQUEMENT)
 *
 * Usage :
 *   1. Stripe Dashboard → activer « Mode test » (toggle en haut à droite)
 *   2. Développeurs → Clés API → copier la clé secrète TEST (sk_test_…)
 *   3. STRIPE_TEST_KEY=sk_test_xxx node scripts/setup-stripe-staging.js
 *   4. firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook --project zeldtrade-staging
 *
 * Sécurité : refuse toute clé non-TEST. Ne touche JAMAIS au projet prod.
 */
'use strict';
const { execFileSync } = require('child_process');
const Stripe = require('../functions/node_modules/stripe');

const PROJECT = 'zeldtrade-staging';
const KEY = process.env.STRIPE_TEST_KEY || '';

if (!KEY.startsWith('sk_test_') || KEY.length < 30) {
  console.error('✗ STRIPE_TEST_KEY manquante ou invalide — il FAUT une clé TEST (sk_test_…).');
  console.error('  Une clé sk_live_ est REFUSÉE par sécurité.');
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2024-06-20' });

function setSecret(name, value) {
  execFileSync('gcloud', ['secrets', 'versions', 'add', name, '--data-file=-', '--project', PROJECT],
    { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`  ✓ secret ${name} mis à jour`);
}

(async () => {
  console.log('▶ Création des produits/prix TEST sur Stripe…');
  const funded = await stripe.products.create({ name: 'ZeldTrade Funded (TEST staging)' });
  const elite  = await stripe.products.create({ name: 'ZeldTrade Elite (TEST staging)' });

  const fm = await stripe.prices.create({ product: funded.id, currency: 'eur', unit_amount: 1499,  recurring: { interval: 'month' } });
  const fy = await stripe.prices.create({ product: funded.id, currency: 'eur', unit_amount: 14990, recurring: { interval: 'year'  } });
  const em = await stripe.prices.create({ product: elite.id,  currency: 'eur', unit_amount: 2999,  recurring: { interval: 'month' } });
  const ey = await stripe.prices.create({ product: elite.id,  currency: 'eur', unit_amount: 29990, recurring: { interval: 'year'  } });
  console.log(`  funded_monthly = ${fm.id}\n  funded_yearly  = ${fy.id}\n  elite_monthly  = ${em.id}\n  elite_yearly   = ${ey.id}`);

  console.log('▶ Mise à jour des secrets (staging)…');
  setSecret('STRIPE_SECRET_KEY',           KEY);
  setSecret('STRIPE_PRICE_FUNDED_MONTHLY', fm.id);
  setSecret('STRIPE_PRICE_FUNDED_YEARLY',  fy.id);
  setSecret('STRIPE_PRICE_ELITE_MONTHLY',  em.id);
  setSecret('STRIPE_PRICE_ELITE_YEARLY',   ey.id);

  console.log('\n✓ Terminé. Dernière étape (les CF lisent les secrets au déploiement) :');
  console.log('  firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook --project zeldtrade-staging');
})().catch(e => { console.error('ERREUR Stripe:', e.message); process.exit(1); });
