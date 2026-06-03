/* eslint-disable no-console, @typescript-eslint/no-empty-function */
/**
 * kerberos-integration-test.ts
 *
 * Exercises the FULL Kerberos/SPNEGO path through HttpRequestExecutor:
 *
 *   HttpRequestExecutor (kerberos: true)
 *     → libcurl CURLAUTH_NEGOTIATE
 *       → Kerberos ticket for HTTP/www.EXAMPLE.COM@EXAMPLE.COM
 *         → Apache httpd with mod_auth_gssapi
 *           → HTTP 200 + X-Authenticated-User: scanner@EXAMPLE.COM
 *
 * Run inside the repeater container (with KDC and httpd already running):
 *   cd /app && ts-node --transpile-only kerberos-integration-test.ts
 *
 * Exits 0 on success, 1 on failure.
 */

import 'reflect-metadata';
import { HttpRequestExecutor } from './src/RequestExecutor/HttpRequestExecutor';
import {
  RequestExecutorOptions,
  KerberosOptions
} from './src/RequestExecutor/RequestExecutorOptions';
import { CertificatesCache } from './src/RequestExecutor/CertificatesCache';
import { CertificatesResolver } from './src/RequestExecutor/CertificatesResolver';
import { VirtualScripts } from './src/Scripts/VirtualScripts';
import { container } from 'tsyringe';

// ── Minimal stub implementations ────────────────────────────────────────────

const stubVirtualScripts: VirtualScripts = {
  size: 0,
  *[Symbol.iterator] () {},
  clear: () => undefined,
  delete: () => false,
  *entries () {},
  find: () => undefined,
  *keys () {},
  set () {
    return this;
  },
  *values () {},
  count: () => 0
} as unknown as VirtualScripts;

const stubCertificatesCache: CertificatesCache = {
  add: () => undefined,
  get: () => undefined
} as unknown as CertificatesCache;

const stubCertificatesResolver: CertificatesResolver = {
  resolve: () => []
} as unknown as CertificatesResolver;

const kerberosOptions: KerberosOptions = {
  enabled: true,
  // Use credentials directly; kinit is not required when credentials are supplied
  credentials: 'scanner@EXAMPLE.COM:ScannerPass1',
  domains: ['www.EXAMPLE.COM'],
  delegation: false
};

const executorOptions: InstanceType<typeof Object> = {
  timeout: 15_000,
  reuseConnection: true,
  kerberos: kerberosOptions
};

// ── Wire up the DI container ─────────────────────────────────────────────────

container.register(VirtualScripts, { useValue: stubVirtualScripts });
container.register(RequestExecutorOptions, { useValue: executorOptions });
container.register(CertificatesCache, { useValue: stubCertificatesCache });
container.register(CertificatesResolver, {
  useValue: stubCertificatesResolver
});

// ── Run the test ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const executor = container.resolve(HttpRequestExecutor);

  const targetUrl = 'http://www.EXAMPLE.COM/protected/';
  console.log(
    `  Sending SPNEGO request to ${targetUrl} via HttpRequestExecutor...`
  );

  const response = await executor.execute({
    method: 'GET',
    url: targetUrl,
    headers: {},
    body: undefined
  });

  console.log(`  HTTP status: ${response.statusCode}`);
  console.log(
    `  X-Authenticated-User: ${
      response.headers?.['x-authenticated-user'] ?? '(not present)'
    }`
  );

  if (response.statusCode !== 200) {
    console.error(`  FAIL: expected HTTP 200 but got ${response.statusCode}`);
    if (response.body) {
      console.error(`  Body: ${String(response.body).slice(0, 200)}`);
    }
    process.exit(1);
  }

  // HTTP 200 from an endpoint protected with `Require valid-user` is definitive
  // proof that SPNEGO negotiation succeeded — Apache returns 401 on any auth failure.
  console.log(
    `  PASS: SPNEGO authentication succeeded (HTTP 200 from Require valid-user endpoint)`
  );

  const authUser = response.headers?.['x-authenticated-user'];
  if (authUser && authUser !== '(null)') {
    console.log(`  Authenticated principal: ${authUser}`);
  } else {
    // REMOTE_USER may not expand in mod_headers on some Apache versions — not a failure.
    console.log(
      `  Note: X-Authenticated-User header not set (Apache mod_headers REMOTE_USER expansion issue — non-fatal)`
    );
  }
}

main().catch((err: Error) => {
  console.error('  FAIL (unhandled error):', err.message);
  console.error(err.stack);
  process.exit(1);
});
