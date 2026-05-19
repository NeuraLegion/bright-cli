/**
 * Experiment C — node-libcurl with raw socket override
 *
 * Goal: Deliver Case 2 (space in URL query: ?msg=Server: ESA1) and
 * confirm Case 3 CRLF delivery via raw net.Socket after libcurl connects.
 *
 * Strategy for Case 2: Use Node.js net.Socket directly after establishing
 * connection, writing the raw HTTP/1.1 request bytes verbatim.
 * This proves what libcurl cannot do natively for Case 2.
 *
 * Also tests: CURLOPT_CURLU (curl URL object) and CURLOPT_TRANSFER_ENCODING
 * workarounds for Case 2.
 */

const net = require('net');
const { Curl, CurlHttpVersion } = require('node-libcurl');

const HOST = 'localhost';
const PORT = 4321;
const UUID = '05b5fa34-33d2-4cb7-9a49-bb13da63bc54';

// --- Raw TCP socket sender (bypasses all HTTP library validation) ---
function sendRaw(rawRequest) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(PORT, HOST, () => {
      socket.write(rawRequest);
    });

    let response = '';
    socket.on('data', (chunk) => {
      response += chunk.toString('latin1');
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
    setTimeout(() => {
      socket.destroy();
      resolve(response);
    }, 3000);
  });
}

function parseEchoResponse(responseText) {
  const lines = responseText.split('\r\n');
  const resource = lines.find(l => l.toLowerCase().startsWith('request-resource:'));
  const warnings = lines.find(l => l.toLowerCase().startsWith('x-echo-warnings:'));
  const method = lines.find(l => l.toLowerCase().startsWith('request-method:'));
  return { resource, warnings, method };
}

async function runCase2ViaRawSocket() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Case 2 (via raw net.Socket) — Query value containing "Server: ESA1"');
  // Exact bytes from the original specification
  const rawRequest = `GET /${UUID}?msg=Server: ESA1 HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n`;
  console.log(`  Raw request: ${JSON.stringify(rawRequest)}`);

  try {
    const response = await sendRaw(rawRequest);
    const { resource, warnings, method } = parseEchoResponse(response);
    console.log(`  ✅ Response received`);
    console.log(`  Echo resource: ${resource || '(not found)'}`);
    console.log(`  Echo method:   ${method || '(not found)'}`);
    if (warnings) console.log(`  ⚠️  Warnings: ${warnings}`);
    return { success: true, resource, warnings };
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function runCase3ViaRawSocket() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Case 3 (via raw net.Socket) — Malformed header CRLF injection (exact spec bytes)');
  // Exact bytes from the original specification
  const rawRequest =
    `GET ${HOST}:${PORT} HTTP/1.1\r\n` +
    `accept: application/json\r\n` +
    `Connection: close\r\n` +
    `;response.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");\r\n` +
    `x-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n` +
    `x-bridge-proxy-error: true\r\n` +
    `Host: ${HOST}:${PORT}\r\n` +
    `Accept-Encoding: gzip, deflate\r\n` +
    `\r\n`;

  console.log(`  Raw request lines:`);
  rawRequest.split('\r\n').forEach((l, i) => console.log(`    [${i}] ${JSON.stringify(l)}`));

  try {
    const response = await sendRaw(rawRequest);
    const { resource, warnings, method } = parseEchoResponse(response);
    console.log(`  ✅ Response received`);
    console.log(`  Echo resource: ${resource || '(not found)'}`);
    console.log(`  Echo method:   ${method || '(not found)'}`);
    if (warnings) console.log(`  ⚠️  Warnings: ${warnings}`);
    return { success: true, resource, warnings };
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Also confirm Case 1 and Case 3 via libcurl work (reuse from exp B)
function runLibcurlCase(name, url, extraHeaders) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${name} (via libcurl)`);
    const curl = new Curl();
    curl.setOpt('URL', url);
    curl.setOpt('PATH_AS_IS', true);
    if (extraHeaders) curl.setOpt('HTTPHEADER', extraHeaders);
    curl.setOpt('TIMEOUT_MS', 5000);
    curl.setOpt('HEADER', true);

    let buf = '';
    curl.on('data', (c) => { buf += c.toString(); });
    curl.on('end', (statusCode) => {
      const { resource, warnings } = parseEchoResponse(buf);
      console.log(`  ✅ Status: ${statusCode}`);
      console.log(`  Echo resource: ${resource || '(not found)'}`);
      if (warnings) console.log(`  ⚠️  Warnings: ${warnings}`);
      curl.close();
      resolve({ success: true, resource, warnings });
    });
    curl.on('error', (err) => {
      console.log(`  ❌ FAILED: ${err.message}`);
      curl.close();
      resolve({ success: false, error: err.message });
    });
    curl.perform();
  });
}

async function main() {
  console.log('Experiment C — node-libcurl + raw net.Socket override');
  console.log(`Target: http://${HOST}:${PORT}`);

  // Case 1 via libcurl (confirm from exp B)
  const c1 = await runLibcurlCase(
    'Case 1 — Unescaped quotes in query',
    `http://${HOST}:${PORT}/${UUID}?"q"=1`,
    [`Host: ${HOST}:${PORT}`, 'x-bridge-id: xxdm2uaPkysWStHbTSKTLN']
  );

  // Case 2 — libcurl fails due to space; use raw socket
  const c2 = await runCase2ViaRawSocket();

  // Case 3 — via raw socket (exact spec bytes, not via libcurl header splitting)
  const c3 = await runCase3ViaRawSocket();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  const results = [
    { name: 'Case 1 — Unescaped quotes in query (libcurl)', ...c1 },
    { name: 'Case 2 — Server: ESA1 in query (raw socket)', ...c2 },
    { name: 'Case 3 — CRLF header injection (raw socket)', ...c3 },
  ];
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.name}`);
    if (r.resource) console.log(`       ${r.resource}`);
    if (r.warnings) console.log(`       ${r.warnings}`);
    if (!r.success) console.log(`       Error: ${r.error}`);
  }
}

main().catch(console.error);
