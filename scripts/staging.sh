#!/bin/bash
# ─── JTRADE STAGING ───────────────────────────────────────────────────────────
# Déploie sur le projet Firebase de TEST « zeldtrade-staging » (100% isolé de la
# prod). À utiliser pour valider en conditions réelles AVANT la prod.
#
#   bash scripts/staging.sh             ← hosting + rules (rapide, défaut)
#   bash scripts/staging.sh --full      ← + functions (nécessite les secrets staging)
#
# Prod = projet « zeldtrade » via scripts/release.sh. JAMAIS mélangé : ce script
# force « -P staging » → impossible de toucher la prod par erreur.
#
# URL de test : https://zeldtrade-staging.web.app

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FULL=false
[ "$1" = "--full" ] && FULL=true

echo "═════════════════════════════════════════════"
echo "  DÉPLOIEMENT STAGING (projet zeldtrade-staging)"
echo "  Prod NON touchée."
echo "═════════════════════════════════════════════"

if $FULL; then
  echo "→ hosting + rules + functions"
  firebase deploy -P staging --only hosting,firestore:rules,storage,functions --non-interactive
else
  echo "→ hosting + rules (sans functions)"
  firebase deploy -P staging --only hosting,firestore:rules,storage --non-interactive
fi

echo ""
echo "✓ Staging déployé → https://zeldtrade-staging.web.app"
echo "  Promouvoir en prod quand validé :  bash scripts/release.sh vX.Y.Z"
