// check-gssapi.js
// Verifies that the built node-libcurl reports GSS-API in its feature set.
'use strict';
// node-libcurl main entry point is dist/index.js (TypeScript compiled output)
const { Curl } = require('/node-libcurl-gssapi');
const v = Curl.getVersion();
console.log('libcurl version info:', JSON.stringify(v, null, 2));
const hasGss =
  (v.version || '').includes('GSS-API') ||
  (v.features || []).some((f) => /gss/i.test(f));
if (!hasGss) {
  console.error('FATAL: GSS-API NOT present in libcurl build -- aborting');
  process.exit(1);
}
console.log('GSS-API confirmed in libcurl build');
