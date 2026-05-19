/**
 * Experiment A (v2) — undici with raw path + custom interceptor for Case 2
 *
 * Case 2 (?msg=Server: ESA1) fails because undici's Request constructor
 * validates path against:
 *
 *   const invalidPathRegex = /[^\u0021-\u00ff]/   (lib/core/request.js:27)
 *
 * Space (0x20 = \u0020) is below \u0021 — so it is rejected with
 * "invalid request path" before any socket work begins.
 *
 * The wire write is at lib/dispatcher/client-h1.js:1112:
 *   let header = `${method} ${path} HTTP/1.1\r\n`
 * It reads `request.path` directly from the Request object.
 *
 * Execution order inside writeH1:
 *   1. request.onConnect(abort)   ← line 1076  — our hook fires here
 *   2. let header = `${method} ${path}...`  ← line 1112  — reads request.path
 *
 * Strategy — custom interceptor using Dispatcher.compose():
 *
 *   1. Before dispatch, replace disallowed chars in opts.path with a safe
 *      placeholder so the Request constructor accepts it.
 *
 *   2. Temporarily patch Request.prototype.onConnect. When client-h1.js
 *      calls request.onConnect(abort), `this` is the Request instance.
 *      We restore request.path to the original value there, then hand off
 *      to the original onConnect. The patch is immediately reversed.
 *
 *   3. client-h1.js reads request.path at line 1112 → original value
 *      (including space) goes on the wire verbatim.
 */

import { createRequire } from 'module';
import { Client } from 'undici';

const require = createRequire(import.meta.url);
const Request = require('/workspace/frontend/bright-cli/node_modules/undici/lib/core/request.js');

const HOST = 'http://localhost:4321';
const UUID = '05b5fa34-33d2-4cb7-9a49-bb13da63bc54';

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * rawPathInterceptor — allows sending paths containing characters that undici's
 * Request constructor rejects (specifically space \u0020, and anything outside
 * \u0021–\u00ff).
 *
 * Technique:
 *  - Replace each offending char with placeholder \u00fe (passes validation)
 *    so Request constructor does not throw.
 *  - Temporarily patch Request.prototype.onConnect so that when client-h1.js
 *    calls request.onConnect(abort) at line 1076 — which happens BEFORE
 *    request.path is read for the wire write at line 1112 — `this` is the
 *    Request instance. We restore request.path to the original value, then
 *    delegate to the real onConnect. The prototype patch is immediately reversed.
 */
function rawPathInterceptor(dispatch) {
  return function RawPathDispatch(opts, handler) {
    const originalPath = opts.path;

    // Check if path contains any char that fails invalidPathRegex
    // i.e. any char outside \u0021–\u00ff (space \u0020 is the common case)
    const needsPatch = /[^\u0021-\u00ff]/.test(originalPath);

    if (!needsPatch) {
      return dispatch(opts, handler);
    }

    // Replace offending chars with \u00fe (Latin small letter thorn).
    // Must be within \u0021–\u00ff to pass the regex, and unlikely in real paths.
    const PLACEHOLDER = '\u00fe';
    const safePath = originalPath.replace(/[^\u0021-\u00ff]/g, PLACEHOLDER);
    const patchedOpts = { ...opts, path: safePath };

    // Temporarily override Request.prototype.onConnect.
    // client-h1.js:1076 calls request.onConnect(abort) with `this` = Request instance.
    // We restore request.path to the original before the wire write at line 1112,
    // then immediately un-patch the prototype so only this one request is affected.
    const originalOnConnect = Request.prototype.onConnect;

    Request.prototype.onConnect = function patchedOnConnect(abort) {
      if (this.path === safePath) {
        this.path = originalPath;
      }
      // Restore prototype immediately — single-use, not permanent
      Request.prototype.onConnect = originalOnConnect;
      return originalOnConnect.call(this, abort);
    };

    return dispatch(patchedOpts, handler);
  };
}

// ─── Test cases ──────────────────────────────────────────────────────────────

const cases = [
  {
    name: 'Case 1 — Unescaped quotes in query (no interceptor needed)',
    path: `/${UUID}?"q"=1`,
    headers: { 'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN' }
  },
  {
    name: 'Case 2 — Space in query: ?msg=Server: ESA1 (via rawPathInterceptor)',
    path: `/${UUID}?msg=Server: ESA1`,
    headers: { 'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN' }
  },
  {
    name: 'Case 3 — CRLF header injection (blocked by undici header validation)',
    path: `/${UUID}`,
    headers: {
      'accept': 'application/json',
      'x-injected': ';\r\nresponse.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");\r\n',
      'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN',
    }
  }
];

async function runCase(client, testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${testCase.name}`);
  console.log(`  Path: ${JSON.stringify(testCase.path)}`);

  try {
    const { statusCode, headers: respHeaders, body } = await client.request({
      path: testCase.path,
      method: 'GET',
      headers: testCase.headers,
    });

    for await (const _ of body) {}

    const echoResource = respHeaders['request-resource'];
    const echoWarnings = respHeaders['x-echo-warnings'];

    console.log(`  ✅ Status: ${statusCode}`);
    console.log(`  Echo resource: ${echoResource}`);
    if (echoWarnings) console.log(`  ⚠️  Warnings: ${echoWarnings}`);

    return { success: true, echoResource, echoWarnings };
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('Experiment A (v2) — undici + rawPathInterceptor');
  console.log(`Target: ${HOST}`);

  const client = new Client(HOST, { pipelining: 1, keepAliveTimeout: 10000 })
    .compose(rawPathInterceptor);

  const results = [];
  for (const tc of cases) {
    const r = await runCase(client, tc);
    results.push({ name: tc.name, ...r });
  }

  await client.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.echoResource) console.log(`       Wire resource: ${r.echoResource}`);
    if (r.echoWarnings) console.log(`       Warnings: ${r.echoWarnings}`);
    if (!r.success) console.log(`       Error: ${r.error}`);
  }
}

main().catch(console.error);
