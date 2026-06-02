// check-gssapi.js
// Verifies that the built node-libcurl has Kerberos/SPNEGO/GSSAPI support.
'use strict';
// node-libcurl main entry point is dist/index.js (TypeScript compiled output)
const { Curl } = require('/node-libcurl-gssapi');
const v = Curl.getVersion();
console.log('libcurl version info:', JSON.stringify(v, null, 2));

// getVersion() may return a plain string or an object with .version / .features
const versionStr = typeof v === 'string' ? v : v.version || '';
const features = Array.isArray(v.features) ? v.features : [];

// Accept any of these as evidence of Kerberos/GSSAPI/SPNEGO capability:
//   - "mit-krb5" or "heimdal" in version string (library linked)
//   - "GSS-API", "SPNEGO", "GSS-Negotiate", "GSSNEGOTIATE" in version string or features
const hasGss =
  /mit-krb5|heimdal/i.test(versionStr) ||
  /gss|spnego|negotiate/i.test(versionStr) ||
  features.some((f) => /gss|spnego|negotiate|kerberos|krb/i.test(f));

if (!hasGss) {
  console.error(
    'FATAL: No Kerberos/GSSAPI/SPNEGO support detected in libcurl build -- aborting'
  );
  process.exit(1);
}
console.log('Kerberos/GSSAPI confirmed in libcurl build');
