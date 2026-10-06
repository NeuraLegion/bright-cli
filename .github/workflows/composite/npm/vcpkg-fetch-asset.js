#!/usr/bin/env node
// vcpkg x-script asset fetcher.
//
// Why this exists: node-libcurl's `preinstall` runs a vcpkg source build, and
// vcpkg's `gsasl` port downloads gsasl-<ver>.tar.gz *only* from ftpmirror.gnu.org
// / ftp.gnu.org. When the GNU FTP network is unreachable (it times out
// intermittently) the whole Windows install fails. The tarball is mirrored
// verbatim on mirrors.kernel.org, so we redirect GNU-FTP asset URLs there and
// fall back to the original URL for everything else. vcpkg verifies the SHA512
// of the result, so a swapped mirror is safe.
//
// Wired in via X_VCPKG_ASSET_SOURCES=x-script,node <this> {url} {sha512} {dst}
// Only native Node.js modules — runs before deps are installed.

const fs = require('fs');
const path = require('path');
const https = require('https');

const [, , url, , dst] = process.argv;

if (!url || !dst) {
  console.error('usage: vcpkg-fetch-asset.js <url> <sha512> <dst>');
  process.exit(2);
}

// Reachable GNU mirror (serves the identical files under the same /gnu/ layout).
const GNU_MIRROR = 'https://mirrors.kernel.org';
const DEAD_GNU_HOSTS = ['ftpmirror.gnu.org', 'ftp.gnu.org'];

function mirrorFor(originalUrl) {
  try {
    const u = new URL(originalUrl);
    if (DEAD_GNU_HOSTS.includes(u.hostname) && u.pathname.startsWith('/gnu/')) {
      return `${GNU_MIRROR}${u.pathname}`;
    }
  } catch {
    /* fall through to original URL */
  }
  return null;
}

function download(fromUrl, toPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    https
      .get(fromUrl, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          const next = new URL(res.headers.location, fromUrl).toString();
          return resolve(download(next, toPath, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${fromUrl}`));
        }
        const file = fs.createWriteStream(toPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  const candidates = [];
  const mirror = mirrorFor(url);
  if (mirror) candidates.push(mirror);
  candidates.push(url);

  let lastErr;
  for (const candidate of candidates) {
    try {
      console.log(`vcpkg-fetch-asset: downloading ${candidate}`);
      await download(candidate, dst);
      return; // success; vcpkg verifies SHA512 afterwards
    } catch (err) {
      lastErr = err;
      console.error(`vcpkg-fetch-asset: ${candidate} failed: ${err.message}`);
    }
  }
  console.error(`vcpkg-fetch-asset: all sources failed for ${url}`);
  process.exit(1);
})();
