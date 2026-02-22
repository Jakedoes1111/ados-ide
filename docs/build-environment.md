# Build Environment Notes

## Cross-Platform Build Baseline (v1)

aDOs v1 prioritizes Linux, Windows, and macOS desktop usability. Build and packaging work should keep all three platforms first-class.

General prerequisites across platforms:

- Node.js 20.x
- Yarn 1.x
- Python 3 + native build toolchain for Node native modules
- Platform-specific code-signing/notarization credentials for release artifacts

## Current Host Constraint

On this Fedora host, full native dependency install for Electron builds is blocked without sudo access.
The following development packages are required for full host-native builds:

- `libsecret-devel`
- `libX11-devel`
- `libxkbfile-devel`
- `make`
- `gcc-c++`
- `python3`
- `pkgconf-pkg-config`

Without those packages, `yarn install` and `yarn build:applications:dev` fail on native modules such as `native-keymap`.

## Non-Sudo Build Path (Recommended Here)

Use the containerized build script:

```bash
cd theia-app
./scripts/build-in-podman.sh
```

What it does:

- Runs a rootless `podman` container with Node 20
- Installs required native dev libraries inside the container
- Runs:
  - `yarn install --frozen-lockfile || yarn install`
  - `yarn build:extensions`
  - `yarn build:applications:dev`

## Optional Overrides

```bash
ADOS_PODMAN_IMAGE=docker.io/library/node:20-bookworm NODE_HEAP_MB=8192 ./theia-app/scripts/build-in-podman.sh
```

- `ADOS_PODMAN_IMAGE`: container image to use
- `NODE_HEAP_MB`: webpack/node heap size used during builds

## Local Offline/No-Rebuild Path

When you already have dependencies installed and want a local host build without native rebuild steps:

```bash
cd theia-app
yarn build:no-rebuild:offline
```

What it does:

- Builds each extension directly (`./scripts/build-extensions-direct.js`) without `lerna`/Nx task execution.
- Builds browser app via `theia build --app-target=browser --mode development`.
- Seeds Theia ffmpeg cache from `node_modules/electron/dist/libffmpeg.so` into `/tmp/theia-cli/cache/electron-v<version>/`.
- Builds electron app via `theia build --app-target=electron --mode development`.

Preflight checks now validate:

- local workspace extensions are linked into `node_modules` (for app package resolution)
- required native module artifacts exist (`drivelist`, `keytar`, `node-pty`)

If those artifacts are missing, the script exits early with remediation guidance instead of a generic webpack exit code.

## CI Profiles

- `cross-platform-extension-smoke.yml`
  - Runs on Linux + Windows + macOS
  - Uses `yarn install --ignore-scripts`
  - Validates extension builds and cross-platform script entrypoint behavior
- `linux-no-rebuild-gate.yml`
  - Runs on Ubuntu
  - Installs native build dependencies
  - Runs full `yarn build:no-rebuild:offline`
  - Verifies expected browser/electron build outputs

## Runtime Tuning (Machine-Aware)

Electron startup now applies a machine-aware runtime profile from
`theia-app/applications/electron/scripts/theia-electron-main.js`.

Default behavior:

- `ADOS_GPU_MODE=balanced` (default if not set)
- Enables conservative GPU acceleration switches (`gpu-rasterization`, `zero-copy`, native GPU buffers)
- Sets renderer and raster thread limits based on CPU/RAM
- Sets `UV_THREADPOOL_SIZE` automatically if not already configured

Available GPU modes:

- `ADOS_GPU_MODE=balanced` (recommended default)
- `ADOS_GPU_MODE=performance` (more aggressive; includes `ignore-gpu-blocklist`)
- `ADOS_GPU_MODE=safe` (no extra GPU acceleration switches)
- `ADOS_GPU_MODE=off` (disables hardware acceleration)

Example launch:

```bash
cd theia-app/applications/electron
ADOS_GPU_MODE=performance yarn start
```

## Nx/Lerna False-Failure Note

In this environment, Nx `run-script` tasks fail silently because they use `child_process.execSync`, and `spawnSync` can return `EPERM`.
That causes `lerna` (powered by Nx) to mark extension targets failed even when `tsc -b` succeeds.

To avoid this, extension builds are routed through `scripts/build-extensions-direct.js` instead of `lerna run --scope="theia-ide*ext" build`.
