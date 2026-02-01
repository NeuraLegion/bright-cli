#!/usr/bin/env node
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawn } = require('child_process');

const ENTRY = path.join(__dirname, '../dist/index.js');
const FLAG = '--max-http-header-size=32768';

const args = [FLAG, ENTRY, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
