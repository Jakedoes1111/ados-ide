#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('@theia/ffmpeg');

const THEIA_APP_DIR = path.resolve(__dirname, '..');
const WORKSPACE_EXTENSIONS_DIR = path.join(THEIA_APP_DIR, 'theia-extensions');
const YARN = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const APP_PACKAGE_PATHS = [
  path.join(THEIA_APP_DIR, 'applications', 'browser', 'package.json'),
  path.join(THEIA_APP_DIR, 'applications', 'electron', 'package.json'),
];
const REQUIRED_NATIVE_BINARIES = [
  { moduleName: 'drivelist', binaryRelativePath: path.join('build', 'Release', 'drivelist.node') },
  { moduleName: 'keytar', binaryRelativePath: path.join('build', 'Release', 'keytar.node') },
  { moduleName: 'node-pty', binaryRelativePath: path.join('build', 'Release', 'pty.node') },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, args, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: THEIA_APP_DIR,
      stdio: 'inherit',
      env,
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function withNodeHeap(baseEnv) {
  const heapMb = baseEnv.NODE_HEAP_MB || '8192';
  const heapFlag = `--max-old-space-size=${heapMb}`;
  const existing = baseEnv.NODE_OPTIONS || '';
  const nodeOptions = existing.includes('--max-old-space-size=') ? existing : (existing ? `${existing} ${heapFlag}` : heapFlag);
  return { ...baseEnv, NODE_OPTIONS: nodeOptions };
}

function collectWorkspaceExtensions() {
  const extensions = new Map();
  if (!fs.existsSync(WORKSPACE_EXTENSIONS_DIR)) {
    return extensions;
  }
  const entries = fs.readdirSync(WORKSPACE_EXTENSIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packagePath = path.join(WORKSPACE_EXTENSIONS_DIR, entry.name, 'package.json');
    if (!fs.existsSync(packagePath)) {
      continue;
    }
    const pkg = readJson(packagePath);
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      extensions.set(pkg.name, packagePath);
    }
  }
  return extensions;
}

function ensureWorkspaceDependencyLinks() {
  const workspaceExtensions = collectWorkspaceExtensions();
  const missingLinks = [];

  for (const appPackagePath of APP_PACKAGE_PATHS) {
    if (!fs.existsSync(appPackagePath)) {
      continue;
    }
    const appPackage = readJson(appPackagePath);
    const deps = appPackage.dependencies || {};

    for (const depName of Object.keys(deps)) {
      if (!workspaceExtensions.has(depName)) {
        continue;
      }
      const linkedPackagePath = path.join(THEIA_APP_DIR, 'node_modules', depName, 'package.json');
      if (!fs.existsSync(linkedPackagePath)) {
        missingLinks.push({
          app: path.relative(THEIA_APP_DIR, appPackagePath),
          depName,
        });
      }
    }
  }

  if (missingLinks.length > 0) {
    const details = missingLinks
      .map(entry => `- ${entry.depName} (required by ${entry.app})`)
      .join('\n');
    throw new Error(
      `Missing linked workspace extension packages in node_modules:\n${details}\n` +
      'Run "yarn install" from theia-app to relink workspaces.\n' +
      'If host-native install is blocked, use "./scripts/build-in-podman.sh".'
    );
  }
}

function ensureNativeBinaryArtifacts() {
  const missing = [];

  for (const dependency of REQUIRED_NATIVE_BINARIES) {
    const moduleDir = path.join(THEIA_APP_DIR, 'node_modules', dependency.moduleName);
    if (!fs.existsSync(moduleDir)) {
      continue;
    }
    const binaryPath = path.join(moduleDir, dependency.binaryRelativePath);
    if (!fs.existsSync(binaryPath)) {
      missing.push({ ...dependency, binaryPath });
    }
  }

  if (missing.length > 0) {
    const details = missing
      .map(item => `- ${item.moduleName}: missing ${path.relative(THEIA_APP_DIR, item.binaryPath)}`)
      .join('\n');
    throw new Error(
      'Missing native module artifacts required by Theia backend bundling:\n' +
      `${details}\n` +
      'Install dependencies with postinstall scripts enabled ("yarn install").\n' +
      'If native toolchain packages are unavailable on host, run "./scripts/build-in-podman.sh".'
    );
  }
}

function seedFfmpegCache() {
  const electronDist = path.resolve(require.resolve('electron/package.json'), '..', 'dist');
  const versionPath = path.join(electronDist, 'version');
  if (!fs.existsSync(versionPath)) {
    console.warn(`Skipping ffmpeg cache seed (missing ${versionPath})`);
    return;
  }

  const electronVersion = fs.readFileSync(versionPath, 'utf8').trim();
  const { name, location } = ffmpeg.ffmpegNameAndLocation({ platform: process.platform });
  const sourcePath = path.resolve(electronDist, location, name);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipping ffmpeg cache seed (missing ${sourcePath})`);
    return;
  }

  const cacheDir = path.join(os.tmpdir(), 'theia-cli', 'cache', `electron-v${electronVersion}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, name);
  fs.copyFileSync(sourcePath, cachePath);
  console.log(`Seeded ffmpeg cache at ${cachePath}`);
}

async function main() {
  const env = withNodeHeap(process.env);
  console.log(`Using NODE_OPTIONS=${env.NODE_OPTIONS}`);
  ensureWorkspaceDependencyLinks();
  ensureNativeBinaryArtifacts();

  await run(process.execPath, [path.join(__dirname, 'build-extensions-direct.js')], env);

  console.log('Building browser app (no rebuild)');
  await run(YARN, ['--cwd', 'applications/browser', 'theia', 'build', '--app-target=browser', '--mode', 'development'], env);

  seedFfmpegCache();

  console.log('Building electron app (no rebuild)');
  await run(YARN, ['--cwd', 'applications/electron', 'theia', 'build', '--app-target=electron', '--mode', 'development'], env);

  console.log('Offline no-rebuild build completed.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
