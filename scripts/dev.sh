#!/bin/bash
# ─── ENV DE TEST LOCAL — Émulateurs Firebase (v0.9.348) ───────────────────────
# Lance Firestore + Auth + Storage + Functions + Hosting en LOCAL, 100 % isolé
# de la prod. Aucune donnée ne touche zeldtrade (le projet cloud).
#
#   bash scripts/dev.sh
#
# Puis ouvrir :
#   App / site   → http://127.0.0.1:5050   (sert src/, comme la prod : /admin, /app…)
#   Console UI   → http://127.0.0.1:4000   (voir/éditer Firestore, Auth, Storage…)
#
# (port hosting = 5050 et non 5000 : sur macOS le port 5000 est pris par AirPlay)
#
# Les données sont sauvegardées dans .emulator-data/ à la sortie (Ctrl-C) et
# rechargées au prochain lancement → tes comptes/trades de test persistent.
#
# Prérequis : Java (émulateurs Firestore/Auth/Storage). Géré automatiquement si
#   openjdk est installé via Homebrew (brew install openjdk).
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Java : si absent du PATH, on tente le openjdk Homebrew (keg-only → pas lié au
# PATH par défaut, mais installable sans sudo).
if ! command -v java >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix openjdk 2>/dev/null)/bin/java" ]; then
    export JAVA_HOME="$(brew --prefix openjdk)"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi
if ! command -v java >/dev/null 2>&1; then
  echo "✗ Java introuvable — requis par les émulateurs."
  echo "  Installe-le :  brew install openjdk     (ou: brew install --cask temurin)"
  exit 1
fi

mkdir -p .emulator-data

# --import seulement si un export existe déjà (sinon l'émulateur refuse de démarrer)
IMPORT_ARG=""
if [ -f ".emulator-data/firebase-export-metadata.json" ]; then
  IMPORT_ARG="--import=./.emulator-data"
  echo "→ Reprise des données de test (.emulator-data/)"
else
  echo "→ Premier lancement : base de test vierge (sera sauvée dans .emulator-data/ à la sortie)"
fi

# --config firebase.emulator.json = en-têtes locaux SANS HSTS/CSP (firebase.json reste prod)
exec firebase --config firebase.emulator.json emulators:start $IMPORT_ARG --export-on-exit=./.emulator-data
