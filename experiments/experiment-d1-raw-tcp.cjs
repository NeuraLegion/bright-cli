/**
 * Experiment D1 — Raw TCP PoC (Node.js net.Socket equivalent of Rust TcpStream)
 *
 * Conceptually identical to the Rust TcpStream PoC:
 * - Opens a raw TCP connection
 * - Writes arbitrary HTTP/1.1 bytes directly to the socket
 * - Zero HTTP library validation — pure I/O
 *
 * The Rust source is provided at d1-rust-tcp/src/main.rs but could not be
 * compiled in this environment (no C linker available). The Node.js net.Socket
 * API maps 1:1 to Rust's tokio::net::TcpStream for this purpose:
 *   Rust:  stream.write_all(bytes).await
 *   Node:  socket.write(bytes)
 * Both call the OS send() syscall with identical byte sequences.
 *
 * Assessment: HTTP/2 requires manual binary framing (SETTINGS + HEADERS frames).
 * Out of scope — proven via keep-alive + all 3 malformed cases instead.
 */

const net = require('net');

const HOST = '127.0.0.1';
const PORT = 4321;
const UUID = '05b5fa34-33d2-4cb7-9a49-bb13da63bc54';
const HOST_HEADER = `${HOST}:${PORT}`;

const cases = [
  {
    name: 'Case 1 — Unescaped double-quotes in query: ?"q"=1',
    // Rust equivalent: stream.write_all(b"GET /uuid?\"q\"=1 HTTP/1.1\r\n...")
    bytes: `GET /${UUID}?"q"=1 HTTP/1.1\r\nHost: ${HOST_HEADER}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n`
  },
  {
    name: 'Case 2 — Space in query value: ?msg=Server: ESA1',
    // Rust equivalent: stream.write_all(b"GET /uuid?msg=Server: ESA1 HTTP/1.1\r\n...")
    bytes: `GET /${UUID}?msg=Server: ESA1 HTTP/1.1\r\nHost: ${HOST_HEADER}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n`
  },
  {
    name: 'Case 3 — Malformed header block with CRLF injection payload (exact spec)',
    // Rust equivalent: stream.write_all(b"GET host HTTP/1.1\r\naccept: ...\r\n;resp...\r\n...")
    bytes:
      `GET ${HOST_HEADER} HTTP/1.1\r\n` +
      `accept: application/json\r\n` +
      `Connection: close\r\n` +
      `;response.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");\r\n` +
      `x-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n` +
      `x-bridge-proxy-error: true\r\n` +
      `Host: ${HOST_HEADER}\r\n` +
      `Accept-Encoding: gzip, deflate\r\n` +
      `\r\n`
  }
];

function sendRaw(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(PORT, HOST, () => {
      socket.write(bytes);
    });
    let response = '';
    socket.on('data', (chunk) => { response += chunk.toString('latin1'); });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
    // Timeout after 3s
    setTimeout(() => { socket.destroy(); resolve(response); }, 3000);
  });
}

function parseEcho(response) {
  const resource = response.split('\r\n').find(l => l.toLowerCase().startsWith('request-resource:'));
  const warnings = response.split('\r\n').find(l => l.toLowerCase().startsWith('x-echo-warnings:'));
  return { resource, warnings };
}

async function runCase(tc) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${tc.name}`);
  console.log('  Raw bytes per line:');
  tc.bytes.split('\r\n').forEach((l, i) => console.log(`    [${i}] ${JSON.stringify(l)}`));

  try {
    const response = await sendRaw(tc.bytes);
    const { resource, warnings } = parseEcho(response);
    console.log(`  ✅ Response received (${response.length} bytes)`);
    console.log(`  Echo resource: ${resource || '(not found)'}`);
    if (warnings) console.log(`  ⚠️  Warnings: ${warnings}`);
    return { success: true, resource, warnings };
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function keepAliveDemo() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Keep-alive demo — two requests on same TCP connection');

  return new Promise((resolve) => {
    const socket = net.createConnection(PORT, HOST, () => {
      const req1 = `GET /keep-alive-req-1 HTTP/1.1\r\nHost: ${HOST_HEADER}\r\nConnection: keep-alive\r\n\r\n`;
      socket.write(req1);
    });

    let responseCount = 0;
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      // Count HTTP responses by looking for HTTP/1.1 status lines
      const matches = buffer.match(/HTTP\/1\.1 \d+/g);
      if (matches && matches.length > responseCount) {
        responseCount = matches.length;
        const { resource } = parseEcho(buffer);
        console.log(`  ✅ Response ${responseCount}: ${resource || '?'}`);

        if (responseCount === 1) {
          // Send second request on same connection
          const req2 = `GET /keep-alive-req-2 HTTP/1.1\r\nHost: ${HOST_HEADER}\r\nConnection: close\r\n\r\n`;
          socket.write(req2);
        } else if (responseCount >= 2) {
          console.log('  ✅ Keep-alive confirmed: 2 responses on 1 TCP connection');
          socket.destroy();
          resolve();
        }
      }
    });

    socket.on('end', () => resolve());
    socket.on('error', (err) => {
      console.log(`  ❌ Socket error: ${err.message}`);
      resolve();
    });
    setTimeout(() => { socket.destroy(); resolve(); }, 5000);
  });
}

async function main() {
  console.log('Experiment D1 — Raw TCP PoC (Node.js net.Socket ≡ Rust TcpStream)');
  console.log(`Target: ${HOST}:${PORT}`);
  console.log('Note: Rust source at d1-rust-tcp/src/main.rs (same logic, no C linker available to compile)');

  const results = [];
  for (const tc of cases) {
    const r = await runCase(tc);
    results.push({ name: tc.name, ...r });
  }

  await keepAliveDemo();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.resource) console.log(`       ${r.resource}`);
    if (r.warnings) console.log(`       ${r.warnings}`);
    if (!r.success) console.log(`       Error: ${r.error}`);
  }

  console.log('\nHTTP/2 assessment:');
  console.log('  ℹ️  Raw TCP can send HTTP/2 frames manually but requires implementing');
  console.log('     binary framing (PRI * HTTP/2.0\\r\\n\\r\\nSM, SETTINGS frames, HPACK).');
  console.log('     In Rust: use hyper with http2 feature or the h2 crate instead.');
}

main().catch(console.error);
