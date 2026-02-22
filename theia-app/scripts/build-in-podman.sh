#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
THEIA_APP_DIR="${REPO_ROOT}/theia-app"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required but was not found on PATH." >&2
  exit 1
fi

IMAGE="${ADOS_PODMAN_IMAGE:-docker.io/library/node:20-bookworm}"
NODE_HEAP_MB="${NODE_HEAP_MB:-8192}"

echo "Using image: ${IMAGE}"
echo "Using NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB}"
echo "Workspace: ${THEIA_APP_DIR}"

podman run --rm \
  --user 0 \
  -v "${REPO_ROOT}:/workspace:Z" \
  -w /workspace/theia-app \
  "${IMAGE}" \
  bash -lc "
    set -euo pipefail
    export NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB}
    apt-get update >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 make g++ pkg-config libsecret-1-dev libx11-dev libxkbfile-dev git ca-certificates >/dev/null
    node -v
    yarn -v
    yarn install --frozen-lockfile || yarn install
    yarn build:extensions
    yarn build:applications:dev
  "

echo "Container build completed successfully."
