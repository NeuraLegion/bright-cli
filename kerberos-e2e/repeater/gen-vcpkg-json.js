// gen-vcpkg-json.js
// Generates vcpkg.json for node-libcurl on Linux:
//   - substitutes $$NODE_LIBCURL_VERSION$$ and $$OPENSSL_VERSION$$ placeholders
//   - injects the `gssapi` feature into the curl dependency (absent from template)
// Run from the node-libcurl source root.
'use strict';
const fs = require('fs');
const path = require('path');

const root = '/node-libcurl-gssapi';
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
let tpl = fs.readFileSync(path.join(root, 'vcpkg.template.json'), 'utf8');

tpl = tpl.replace(/\$\$NODE_LIBCURL_VERSION\$\$/g, pkg.version);
tpl = tpl.replace(/\$\$OPENSSL_VERSION\$\$/g, '3.3.2');

const manifest = JSON.parse(tpl);
const curl = manifest.dependencies.find(
  (d) => (typeof d === 'string' ? d : d.name) === 'curl'
);
if (curl && curl.features) {
  // sspi is Windows-only; vcpkg rejects it on Linux
  // ldap and gsasl require autoconf/automake (present, but openldap fails for
  //   other reasons); we don't need them for SPNEGO testing
  // http3 pulls in ngtcp2 which fails to build in the container
  const linuxExclusions = new Set(['sspi', 'ldap', 'gsasl', 'http3']);
  curl.features = curl.features.filter((f) => !linuxExclusions.has(f));
  if (!curl.features.includes('gssapi')) {
    curl.features.push('gssapi');
  }
}

const outPath = path.join(root, 'vcpkg.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('vcpkg.json written to', outPath);
console.log(JSON.stringify(manifest, null, 2));
