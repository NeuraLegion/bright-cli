#!/usr/bin/env node
/**
 * Ensures node-libcurl's `dist/` folder exists after installation.
 *
 * When node-libcurl is installed from a GitHub commit the `dist/` folder
 * (compiled TypeScript output) is absent because the git repo's .npmignore
 * excludes TypeScript sources and tsconfig, making an in-place build
 * impossible. Instead we install the matching published npm version into a
 * temporary directory (which includes the pre-built `dist/`) and copy it
 * across.
 *
 * This script is idempotent: if `dist/index.js` already exists it exits
 * immediately.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const libcurlRoot = path.resolve(__dirname, '../../node_modules/node-libcurl');
const distIndex = path.join(libcurlRoot, 'dist', 'index.js');

if (fs.existsSync(distIndex)) {
  process.exit(0);
}

const pkgJson = JSON.parse(
  fs.readFileSync(path.join(libcurlRoot, 'package.json'), 'utf8')
);
const version = pkgJson.version;

console.log(
  `[postinstall] node-libcurl dist/ missing – installing v${version} from npm to obtain pre-built dist/…`
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'node-libcurl-'));
try {
  // Install only the published package, skipping its lifecycle scripts so we
  // just get the files without triggering a native rebuild.
  execSync(
    `npm install --prefix "${tmp}" node-libcurl@${version} --ignore-scripts --no-save`,
    { stdio: 'pipe' }
  );

  const srcDist = path.join(tmp, 'node_modules', 'node-libcurl', 'dist');
  const destDist = path.join(libcurlRoot, 'dist');

  fs.cpSync(srcDist, destDist, { recursive: true });
  console.log('[postinstall] node-libcurl dist/ restored successfully.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
