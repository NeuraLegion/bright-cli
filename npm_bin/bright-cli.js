#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');

const ENTRY = path.join(__dirname, '../dist/index.js');
const FLAG = '--max-http-header-size=32768';

// Prevent infinite recursion when we re-exec
if (process.env.BRIGHT_CLI_NPM_WRAPPER !== '1') {
  const args = [FLAG, ENTRY, ...process.argv.slice(2)];

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, BRIGHT_CLI_NPM_WRAPPER: '1' }
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

  return;
}

// If we’re already re-exec’d, just run the real CLI entry
require(ENTRY);
