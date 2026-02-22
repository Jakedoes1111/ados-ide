#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const THEIA_APP_DIR = path.resolve(__dirname, '..');
const EXTENSIONS_DIR = path.join(THEIA_APP_DIR, 'theia-extensions');
const YARN = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: THEIA_APP_DIR,
      stdio: 'inherit',
      env: process.env,
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

async function main() {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    throw new Error(`Missing extensions directory: ${EXTENSIONS_DIR}`);
  }

  const extensionDirs = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  if (extensionDirs.length === 0) {
    throw new Error('No extensions found in theia-extensions/');
  }

  for (const extension of extensionDirs) {
    const extensionPath = path.join(EXTENSIONS_DIR, extension);
    if (!fs.existsSync(path.join(extensionPath, 'package.json'))) {
      continue;
    }
    console.log(`Building extension: ${extension}`);
    await run(YARN, ['--cwd', extensionPath, 'build']);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
