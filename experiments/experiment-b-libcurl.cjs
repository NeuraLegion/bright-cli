/**
 * Experiment B — node-libcurl (standard mode + REQUEST_TARGET for Case 2)
 *
 * Tests whether node-libcurl can deliver all 3 malformed HTTP requests to the
 * echo server. Updated to use CURLOPT_REQUEST_TARGET for Case 2 (space in URL
 * query), which bypasses libcurl's URL parser by setting a safe base URL for
 * connection and overriding the request line verbatim on the wire.
 *
 * Assessment: HTTP/2, keep-alive, malformed request delivery.
 */

const { Curl, CurlFeature, CurlHttpVersion } = require('node-libcurl');

const HOST = 'localhost';
const PORT = 4321;
const UUID = '05b5fa34-33d2-4cb7-9a49-bb13da63bc54';

const cases = [
  {
    name: 'Case 1 — Unescaped quotes in query',
    // Quotes are accepted by libcurl URL parser — no REQUEST_TARGET needed
    url: `http://${HOST}:${PORT}/${UUID}?"q"=1`,
    requestTarget: null,
    headers: [
      `Host: ${HOST}:${PORT}`,
      'x-bridge-id: xxdm2uaPkysWStHbTSKTLN'
    ]
  },
  {
    name: 'Case 2 — Query value containing "Server: ESA1" (space in URL)',
    // libcurl URL parser rejects space → use safe base URL for connection,
    // override request line verbatim via CURLOPT_REQUEST_TARGET.
    // libcurl docs: "passes on the verbatim string without any filter or
    // other safe guards, including white space and control characters."
    url: `http://${HOST}:${PORT}/`,
    requestTarget: `/${UUID}?msg=Server: ESA1`,
    headers: [
      `Host: ${HOST}:${PORT}`,
      'x-bridge-id: xxdm2uaPkysWStHbTSKTLN'
    ]
  },
  {
    name: 'Case 3 — Malformed header with CRLF injection payload',
    url: `http://${HOST}:${PORT}/${UUID}`,
    requestTarget: null,
    headers: [
      `Host: ${HOST}:${PORT}`,
      'accept: application/json',
      'Connection: close',
      // libcurl splits \r\n into two separate wire lines — bytes still reach server
      ';\r\nresponse.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");\r\n',
      'x-bridge-id: xxdm2uaPkysWStHbTSKTLN',
      'x-bridge-proxy-error: true'
    ]
  }
];

function runCase(testCase) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${testCase.name}`);
    console.log(`  URL: ${testCase.url}`);
    if (testCase.requestTarget) {
      console.log(`  REQUEST_TARGET (wire): ${testCase.requestTarget}`);
    }

    const curl = new Curl();

    curl.setOpt('URL', testCase.url);
    curl.setOpt('PATH_AS_IS', true);           // Do not normalize path (no dot-dot squashing)

    // Override request line verbatim when URL contains chars libcurl rejects
    if (testCase.requestTarget) {
      curl.setOpt('REQUEST_TARGET', testCase.requestTarget);
    }

    curl.setOpt('HTTPHEADER', testCase.headers);
    curl.setOpt('VERBOSE', true);
    curl.setOpt('HEADER', true);               // Include response headers in output
    curl.setOpt('FOLLOWLOCATION', false);
    curl.setOpt('TIMEOUT_MS', 5000);

    // Keep-alive: libcurl default is keep-alive; explicitly confirm
    curl.setOpt('TCP_KEEPALIVE', 1);
    curl.setOpt('TCP_KEEPIDLE', 10);
    curl.setOpt('TCP_KEEPINTVL', 5);

    let responseBuffer = '';

    curl.on('data', (chunk) => {
      responseBuffer += chunk.toString();
    });

    curl.on('end', (statusCode, data, headers) => {
      console.log(`  ✅ Response status: ${statusCode}`);

      // Parse echo server headers from response
      const responseText = responseBuffer;
      const lines = responseText.split('\r\n');
      const echoResource = lines.find(l => l.toLowerCase().startsWith('request-resource:'));
      const echoWarnings = lines.find(l => l.toLowerCase().startsWith('x-echo-warnings:'));

      console.log(`  Echo server saw: ${echoResource || '(not found in response)'}`);
      if (echoWarnings) {
        console.log(`  ⚠️  Echo warnings: ${echoWarnings}`);
      }

      // Print all request-* headers echoed back
      lines.filter(l => l.toLowerCase().startsWith('request-')).forEach(l => {
        console.log(`    ${l}`);
      });

      curl.close();
      resolve({ success: true, statusCode, echoResource, echoWarnings });
    });

    curl.on('error', (err) => {
      console.log(`  ❌ FAILED: ${err.message}`);
      curl.close();
      resolve({ success: false, error: err.message });
    });

    try {
      curl.perform();
    } catch (err) {
      console.log(`  ❌ PERFORM FAILED: ${err.message}`);
      curl.close();
      resolve({ success: false, error: err.message });
    }
  });
}

// HTTP/2 test
function testHttp2() {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('HTTP/2 test (HTTP/2 prior knowledge — h2c)');

    const curl = new Curl();
    curl.setOpt('URL', `http://${HOST}:${PORT}/`);
    curl.setOpt('HTTP_VERSION', CurlHttpVersion.V2PriorKnowledge);
    curl.setOpt('TIMEOUT_MS', 3000);
    curl.setOpt('VERBOSE', false);
    curl.setOpt('HEADER', true);

    curl.on('end', (statusCode) => {
      console.log(`  ✅ HTTP/2 response status: ${statusCode}`);
      curl.close();
      resolve({ http2: true });
    });

    curl.on('error', (err) => {
      // h2c likely fails against HTTP/1.1-only echo server — expected
      if (err.message.includes('HTTP/2') || err.message.includes('stream') || err.message.includes('protocol') || err.message.includes('56') || err.message.includes('recv')) {
        console.log(`  ℹ️  H2 failed as expected against HTTP/1.1 server: ${err.message}`);
      } else {
        console.log(`  ❌ H2 error: ${err.message}`);
      }
      curl.close();
      resolve({ http2: false, error: err.message });
    });

    curl.perform();
  });
}

async function main() {
  console.log('Experiment B — node-libcurl (PATH_AS_IS + REQUEST_TARGET for Case 2)');
  console.log(`Target: http://${HOST}:${PORT}`);

  const results = [];
  for (const testCase of cases) {
    const result = await runCase(testCase);
    results.push({ name: testCase.name, ...result });
  }

  await testHttp2();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.name}`);
    if (r.success) {
      console.log(`       ${r.echoResource || '(no echo resource)'}`);
      if (r.echoWarnings) console.log(`       Warnings: ${r.echoWarnings}`);
    } else {
      console.log(`       Error: ${r.error}`);
    }
  }
}

main().catch(console.error);
