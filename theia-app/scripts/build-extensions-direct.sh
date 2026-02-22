#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEIA_APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[deprecated] scripts/build-extensions-direct.sh -> scripts/build-extensions-direct.js"
exec node "${THEIA_APP_DIR}/scripts/build-extensions-direct.js" "$@"
