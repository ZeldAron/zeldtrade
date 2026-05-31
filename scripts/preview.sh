#!/bin/bash
# ─── JTRADE PREVIEW ───────────────────────────────────────────────────────────
# Déploie src/ sur un Firebase Hosting PREVIEW CHANNEL → URL temporaire ISOLÉE.
# Ne touche JAMAIS la prod (zeldtrade.com / zeldtrade.web.app).
#
#   • Frontend (HTML/CSS/JS) : isolé sur l'URL preview.
#   • Backend (Firestore / Auth / Functions / Storage) : PARTAGÉ avec la prod
#     (même projet Firebase) → bon pour tester l'UI, PAS pour isoler les données.
#     Pour une isolation totale → projet staging séparé (cf. Trello « env de test »).
#
# Usage : ./scripts/preview.sh            ← channel « test », expire 7 jours
#         ./scripts/preview.sh feat-x     ← channel nommé « feat-x »
#         ./scripts/preview.sh test 30d   ← expiration custom
#
# L'URL d'un channel nommé est STABLE entre deux déploiements du même channel.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHANNEL="${1:-test}"
EXPIRES="${2:-7d}"

echo "─────────────────────────────────────────"
echo "  PREVIEW DEPLOY (prod NON touchée)"
echo "  Channel : $CHANNEL   Expire : $EXPIRES"
echo "─────────────────────────────────────────"

firebase hosting:channel:deploy "$CHANNEL" --expires "$EXPIRES"

echo ""
echo "✓ Preview déployée. Teste l'UI sur l'URL « Channel URL » ci-dessus."
echo "  Promouvoir en prod quand OK :  bash scripts/release.sh vX.Y.Z"
