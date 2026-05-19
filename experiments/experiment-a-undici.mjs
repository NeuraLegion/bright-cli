/**
 * Experiment A — undici with raw path
 *
 * Tests whether undici can deliver 3 malformed HTTP requests to the echo server:
 *   Case 1: Unescaped quotes in query string:  ?"q"=1
 *   Case 2: Query value containing "Server: ESA1" (ambiguous token in request line)
 *   Case 3: Malformed/injected header value containing CRLF + code injection
 *
 * Echo server: raw TCP Python server on localhost:4321
 * Assessment criteria: HTTP/2, keep-alive, malformed request delivery
 */

import { Client } from 'undici';

const HOST = 'http://localhost:4321';
const UUID = '05b5fa34-33d2-4cb7-9a49-bb13da63bc54';

const cases = [
  {
    name: 'Case 1 — Unescaped quotes in query',
    // Raw path with unescaped double-quotes
    path: `/${UUID}?"q"=1`,
    method: 'GET',
    headers: {
      'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN'
    },
    body: null
  },
  {
    name: 'Case 2 — Query value containing "Server: ESA1" (ambiguous request line)',
    // The value "Server: ESA1" looks like an HTTP header inside the query string
    path: `/${UUID}?msg=Server: ESA1`,
    method: 'GET',
    headers: {
      'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN'
    },
    body: null
  },
  {
    name: 'Case 3 — Malformed header with CRLF injection payload',
    // Attempt to inject a CRLF + code payload into a header value
    path: `/${UUID}`,
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Connection': 'close',
      // The injection payload — undici is expected to block \r\n here
      'x-injected': ';\r\nresponse.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");\r\n',
      'x-bridge-id': 'xxdm2uaPkysWStHbTSKTLN',
      'x-bridge-proxy-error': 'true'
    },
    body: null
  }
];

// --- Keep-alive test: reuse a single Client across all requests ---
const client = new Client(HOST, {
  pipelining: 1,         // keep-alive, no pipelining
  keepAliveTimeout: 10000,
});

async function runCase(testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${testCase.name}`);
  console.log(`  Path: ${testCase.path}`);
  console.log(`  Headers: ${JSON.stringify(testCase.headers, null, 2)}`);

  try {
    const { statusCode, headers: respHeaders, body } = await client.request({
      path: testCase.path,
      method: testCase.method,
      headers: testCase.headers,
      body: testCase.body ?? undefined,
    });

    let responseText = '';
    for await (const chunk of body) {
      responseText += chunk.toString();
    }

    console.log(`  ✅ Response status: ${statusCode}`);
    console.log(`  Response headers:`);
    for (const [k, v] of Object.entries(respHeaders)) {
      console.log(`    ${k}: ${v}`);
    }
    if (responseText) {
      console.log(`  Response body: ${responseText}`);
    }

    // Verify echo server received the resource correctly
    const echoResource = respHeaders['request-resource'];
    console.log(`  Echo server saw resource: ${echoResource}`);
    const warnings = respHeaders['x-echo-warnings'];
    if (warnings) {
      console.log(`  ⚠️  Echo server warnings: ${warnings}`);
    }

    return { success: true, statusCode, echoResource, warnings };
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// --- HTTP/2 test with a separate client ---
async function testHttp2() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('HTTP/2 keep-alive test (h2c — cleartext)');
  // Note: echo server is HTTP/1.1 only; h2c requires server support.
  // We test that undici can be configured for h2c — connection failure is expected
  // against an HTTP/1.1 only server; what we confirm is the option is accepted.
  const h2Client = new Client(HOST, {
    allowH2: true,
  });
  try {
    const { statusCode } = await h2Client.request({ path: '/', method: 'GET' });
    console.log(`  ✅ HTTP/2 response status: ${statusCode}`);
  } catch (err) {
    if (err.message.includes('No ALPN') || err.message.includes('h2') || err.message.includes('connect') || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.log(`  ℹ️  H2 negotiation failed (expected — echo server is HTTP/1.1 only): ${err.message}`);
    } else {
      console.log(`  ❌ H2 error: ${err.message}`);
    }
  } finally {
    await h2Client.close();
  }
}

async function main() {
  console.log('Experiment A — undici');
  console.log(`Target: ${HOST}`);

  const results = [];
  for (const testCase of cases) {
    const result = await runCase(testCase);
    results.push({ name: testCase.name, ...result });
  }

  await testHttp2();
  await client.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.name}`);
    if (r.success) {
      console.log(`       Echo resource: ${r.echoResource}`);
      if (r.warnings) console.log(`       Warnings: ${r.warnings}`);
    } else {
      console.log(`       Error: ${r.error}`);
    }
  }
}

main().catch(console.error);
