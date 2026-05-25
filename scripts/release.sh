#!/bin/bash
# ─── JTRADE RELEASE ───────────────────────────────────────────────────────────
# Déploie la version actuelle de src/ sur :
#   1. Firebase Hosting (primaire, depuis v0.9.145) → https://zeldtrade.com
#   2. GitHub Pages (backup pendant la migration) → https://zeldaron.github.io/zeldtrade
#
# Usage : ./scripts/release.sh v0.5.1
#         ./scripts/release.sh          ← reprend le dernier tag
#         ./scripts/release.sh v0.5.1 --no-backup   ← skip gh-pages
#         ./scripts/release.sh v0.5.1 --dry-run     ← simule sans déployer

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Args
VERSION=""
SKIP_BACKUP=false
DRY_RUN=false
for arg in "$@"; do
    case "$arg" in
        --no-backup) SKIP_BACKUP=true ;;
        --dry-run)   DRY_RUN=true ;;
        -*) echo "Flag inconnu : $arg" ; exit 1 ;;
        *)  VERSION="$arg" ;;
    esac
done

# Helper : execute ou simule selon DRY_RUN
run() {
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] $*"
    else
        eval "$@"
    fi
}

if [ -z "$VERSION" ]; then
    VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$VERSION" ]; then
        echo "Usage : ./scripts/release.sh v0.5.1 [--no-backup]"
        exit 1
    fi
    echo "Aucune version précisée — utilise le dernier tag : $VERSION"
fi

# Format attendu : vX.Y.Z
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Format invalide. Utilise : vX.Y.Z  (ex: v0.5.1)"
    exit 1
fi

echo ""
echo "======================================="
if [ "$DRY_RUN" = true ]; then
    echo "  Release JTRADE $VERSION [DRY-RUN]"
else
    echo "  Release JTRADE $VERSION"
fi
echo "======================================="

# 0. Unifie tous les cache-busters ?v= sur la version courante (fix B-02 — anti stale-mix).
#    ?v= n'est qu'une query string de cache : le chemin du fichier ne change jamais,
#    donc réécrire la valeur ne peut PAS provoquer de 404. Garantit qu'un visiteur
#    qui hard-reload reçoit TOUT le code de la même version (plus de mix ancien/nouveau).
VNUM="${VERSION#v}"   # v0.9.359 → 0.9.359
echo ""
echo "  → Unification des cache-busters ?v= → $VNUM"
if [ "$DRY_RUN" = true ]; then
    echo "  [DRY-RUN] sed ?v=… → ?v=$VNUM dans src/**/*.html + libellés version"
else
    # Tous les ?v=<num.num...> des HTML servis (src/ + src/pages/) → version courante
    find src -name '*.html' -type f -exec \
        sed -i '' -E "s/\?v=[0-9][0-9.]*/?v=$VNUM/g" {} +
    # Libellés de version affichés (splash loader + Réglages) — app.html est dans src/pages/
    sed -i '' -E "s/(id=\"ztLoaderVer\"[^>]*>)v[0-9][0-9.]*/\1v$VNUM/" src/pages/app.html
    sed -i '' -E "s/(id=\"appVersionLabel\"[^>]*>)[0-9][0-9.]*/\1$VNUM/" src/pages/app.html
fi
echo "  ✓  Cache-busters + libellés unifiés sur $VNUM."

# 1. Tag de version (si pas encore créé)
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo "  Tag $VERSION déjà existant."
else
    run "git tag \"$VERSION\""
    run "git push origin \"$VERSION\""
    echo "  Tag $VERSION créé et poussé."
fi

# 2. Vérifie que src/ est propre — auto-commit si besoin
if [ -n "$(git status --porcelain src/)" ]; then
    echo ""
    echo "  ⚠  Modifications non commitées dans src/ — commit automatique..."
    run "git add src/"
    run "git commit -m \"chore: release $VERSION — sync src/\""
    echo "  ✓  Committé."
fi

# 3. Deploy primaire : Firebase Hosting
echo ""
echo "  → Déploiement sur Firebase Hosting..."
run "firebase deploy --only hosting --non-interactive"
echo "  ✓  Firebase Hosting déployé."

# 4. Deploy backup : GitHub Pages (sauf si --no-backup)
if [ "$SKIP_BACKUP" = false ]; then
    echo ""
    echo "  → Déploiement backup sur GitHub Pages..."
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] git subtree split --prefix src HEAD && git push origin <commit>:refs/heads/gh-pages --force"
    else
        COMMIT=$(git subtree split --prefix src HEAD)
        if git push origin "${COMMIT}:refs/heads/gh-pages" --force --quiet; then
            echo "  ✓  GitHub Pages déployé."
        else
            echo "  ⚠  Échec push gh-pages (non bloquant — Firebase reste primaire)."
        fi
    fi
else
    echo ""
    echo "  ⏭  Skip backup gh-pages (--no-backup)."
fi

echo ""
echo "======================================="
echo "  Primaire (live)     : https://zeldtrade.com"
echo "  Firebase auto       : https://zeldtrade.web.app"
if [ "$SKIP_BACKUP" = false ]; then
    echo "  Backup (gh-pages)   : https://zeldaron.github.io/zeldtrade"
fi
echo "  Version             : $VERSION"
echo "======================================="
echo ""
