/// Experiment D1 — Rust raw TcpStream PoC
///
/// Proves that a raw TCP connection can deliver all 3 malformed HTTP/1.1
/// requests to the echo server without any HTTP library validation standing
/// in the way.
///
/// Cases:
///   1. Unescaped double-quotes in query:  ?"q"=1
///   2. Space in query value:              ?msg=Server: ESA1
///   3. Malformed header block with CRLF injection + code payload
///
/// HTTP/2 note: raw TcpStream requires manual binary framing (SETTINGS +
/// HEADERS frames) to speak HTTP/2. This is intentionally out of scope for
/// this PoC — we prove HTTP/1.1 raw delivery only.
///
/// Keep-alive: demonstrated by reusing the same TcpStream across two
/// requests on the same connection.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 4321;
const UUID: &str = "05b5fa34-33d2-4cb7-9a49-bb13da63bc54";

struct TestCase {
    name: &'static str,
    raw_request: String,
}

fn cases() -> Vec<TestCase> {
    let host_header = format!("{}:{}", HOST, PORT);
    vec![
        TestCase {
            name: "Case 1 — Unescaped double-quotes in query: ?\"q\"=1",
            raw_request: format!(
                "GET /{}?\"q\"=1 HTTP/1.1\r\nHost: {}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n",
                UUID, host_header
            ),
        },
        TestCase {
            name: "Case 2 — Space in query value: ?msg=Server: ESA1",
            raw_request: format!(
                "GET /{}?msg=Server: ESA1 HTTP/1.1\r\nHost: {}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n",
                UUID, host_header
            ),
        },
        TestCase {
            name: "Case 3 — Malformed header block with CRLF injection payload",
            raw_request: format!(
                "GET {}:{} HTTP/1.1\r\naccept: application/json\r\nConnection: close\r\n;response.writeHead(200, {{\"tokenedce68f7eaf748a8ac2b8b9a246d2219\": \"tokenedce68f7eaf748a8ac2b8b9a246d2219\"}});response.write(\"tokenedce68f7eaf748a8ac2b8b9a246d2219\");\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\nx-bridge-proxy-error: true\r\nHost: {host}\r\nAccept-Encoding: gzip, deflate\r\n\r\n",
                HOST, PORT, host = host_header
            ),
        },
    ]
}

fn parse_echo_response(response: &str) -> (Option<String>, Option<String>) {
    let resource = response
        .lines()
        .find(|l| l.to_lowercase().starts_with("request-resource:"))
        .map(|l| l.to_string());
    let warnings = response
        .lines()
        .find(|l| l.to_lowercase().starts_with("x-echo-warnings:"))
        .map(|l| l.to_string());
    (resource, warnings)
}

async fn send_and_receive(stream: &mut TcpStream, raw_request: &str) -> Result<String, Box<dyn std::error::Error>> {
    stream.write_all(raw_request.as_bytes()).await?;

    let mut response = Vec::new();
    let read_fut = async {
        let mut buf = [0u8; 4096];
        loop {
            let n = stream.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            response.extend_from_slice(&buf[..n]);
            // Stop after we've received the end of headers (for keep-alive connections)
            if response.windows(4).any(|w| w == b"\r\n\r\n") {
                break;
            }
        }
        Ok::<(), std::io::Error>(())
    };

    timeout(Duration::from_secs(3), read_fut).await??;
    Ok(String::from_utf8_lossy(&response).into_owned())
}

async fn run_case(case: &TestCase) -> bool {
    println!("\n{}", "=".repeat(60));
    println!("Running: {}", case.name);
    println!("  Raw request bytes ({} bytes):", case.raw_request.len());
    for (i, line) in case.raw_request.split("\r\n").enumerate() {
        println!("    [{}] {:?}", i, line);
    }

    let addr = format!("{}:{}", HOST, PORT);
    match TcpStream::connect(&addr).await {
        Err(e) => {
            eprintln!("  ❌ CONNECT FAILED: {}", e);
            return false;
        }
        Ok(mut stream) => {
            match send_and_receive(&mut stream, &case.raw_request).await {
                Err(e) => {
                    eprintln!("  ❌ SEND/RECV FAILED: {}", e);
                    false
                }
                Ok(response) => {
                    let (resource, warnings) = parse_echo_response(&response);
                    println!("  ✅ Response received ({} bytes)", response.len());
                    println!("  Echo resource: {}", resource.as_deref().unwrap_or("(not found)"));
                    if let Some(w) = &warnings {
                        println!("  ⚠️  Warnings: {}", w);
                    }
                    true
                }
            }
        }
    }
}

/// Keep-alive demo: send two requests on the same connection using
/// Connection: keep-alive (HTTP/1.1 default).
async fn keep_alive_demo() {
    println!("\n{}", "=".repeat(60));
    println!("Keep-alive demo — two requests on same TCP connection");

    let addr = format!("{}:{}", HOST, PORT);
    match TcpStream::connect(&addr).await {
        Err(e) => {
            eprintln!("  ❌ CONNECT FAILED: {}", e);
            return;
        }
        Ok(mut stream) => {
            // Request 1 (keep-alive)
            let req1 = format!(
                "GET /keep-alive-req-1 HTTP/1.1\r\nHost: {}:{}\r\nConnection: keep-alive\r\n\r\n",
                HOST, PORT
            );
            match send_and_receive(&mut stream, &req1).await {
                Ok(r) => {
                    let (resource, _) = parse_echo_response(&r);
                    println!("  ✅ Request 1 — {}", resource.as_deref().unwrap_or("?"));
                }
                Err(e) => eprintln!("  ❌ Request 1 failed: {}", e),
            }

            // Request 2 (on same connection)
            let req2 = format!(
                "GET /keep-alive-req-2 HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
                HOST, PORT
            );
            match send_and_receive(&mut stream, &req2).await {
                Ok(r) => {
                    let (resource, _) = parse_echo_response(&r);
                    println!("  ✅ Request 2 (same connection) — {}", resource.as_deref().unwrap_or("?"));
                    println!("  ✅ Keep-alive confirmed: two responses on one TCP connection");
                }
                Err(e) => eprintln!("  ❌ Request 2 failed: {}", e),
            }
        }
    }
}

#[tokio::main]
async fn main() {
    println!("Experiment D1 — Rust raw TcpStream PoC");
    println!("Target: {}:{}", HOST, PORT);

    let mut results = Vec::new();
    for case in cases() {
        let ok = run_case(&case).await;
        results.push((case.name, ok));
    }

    keep_alive_demo().await;

    println!("\n{}", "=".repeat(60));
    println!("SUMMARY");
    for (name, ok) in &results {
        let icon = if *ok { "✅" } else { "❌" };
        println!("  {} {}", icon, name);
    }

    println!("\nHTTP/2 assessment:");
    println!("  ℹ️  Raw TcpStream can send HTTP/2 frames manually, but requires");
    println!("     implementing the binary framing protocol (SETTINGS + HEADERS).");
    println!("     Out of scope for this PoC. Use hyper or h2 crate for HTTP/2.");
}
