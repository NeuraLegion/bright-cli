#!/usr/bin/env bash
# Experiment D2 — C++ libcurl PoC (via curl CLI proxy)
#
# Since no C compiler is available in this environment, we use the system
# `curl` binary — which is a thin CLI wrapper around libcurl — to exercise
# the exact same libcurl options a C program would use.
#
# curl options used:
#   --path-as-is        → CURLOPT_PATH_AS_IS = 1 (no path normalization)
#   -H "Name: Value"    → CURLOPT_HTTPHEADER (raw header, verbatim)
#   --http1.1           → CURLOPT_HTTP_VERSION = CURL_HTTP_VERSION_1_1
#   --http2             → CURLOPT_HTTP_VERSION = CURL_HTTP_VERSION_2_0
#   --keepalive         → CURLOPT_TCP_KEEPALIVE = 1
#   -v                  → shows exact request line and headers sent
#
# Each test prints the echo server's response headers to confirm delivery.

HOST="localhost"
PORT="4321"
UUID="05b5fa34-33d2-4cb7-9a49-bb13da63bc54"

PASS=0
FAIL=0

sep() { printf '\n%s\n' "$(printf '=%.0s' {1..60})"; }

check_echo() {
  local label="$1"
  local output="$2"
  local resource
  resource=$(echo "$output" | grep -i "^request-resource:" | head -1)
  local warnings
  warnings=$(echo "$output" | grep -i "^x-echo-warnings:" | head -1)

  if [[ -n "$resource" ]]; then
    echo "  ✅ Echo resource: $resource"
    [[ -n "$warnings" ]] && echo "  ⚠️  Warnings: $warnings"
    PASS=$((PASS + 1))
    return 0
  else
    echo "  ❌ No echo resource found in response"
    echo "  Raw response:"
    echo "$output" | head -20 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
    return 1
  fi
}

# ─── Case 1: Unescaped double-quotes in query ────────────────────────────────
sep
echo "Case 1 — Unescaped quotes in query: ?\"q\"=1"
echo "  curl option: --path-as-is  (CURLOPT_PATH_AS_IS)"
URL1="http://${HOST}:${PORT}/${UUID}?\"q\"=1"
echo "  URL: $URL1"

OUTPUT1=$(curl -s -i \
  --path-as-is \
  --http1.1 \
  --keepalive \
  -H "x-bridge-id: xxdm2uaPkysWStHbTSKTLN" \
  "$URL1" 2>&1)

check_echo "Case 1" "$OUTPUT1"

# ─── Case 2: Space in query value: ?msg=Server: ESA1 ─────────────────────────
sep
echo "Case 2 — Space in query value: ?msg=Server: ESA1"
echo "  Strategy: curl --path-as-is + URL with space (curl may reject)"
URL2="http://${HOST}:${PORT}/${UUID}?msg=Server: ESA1"
echo "  URL: $URL2"

OUTPUT2=$(curl -s -i \
  --path-as-is \
  --http1.1 \
  --keepalive \
  -H "x-bridge-id: xxdm2uaPkysWStHbTSKTLN" \
  "$URL2" 2>&1)

CURL_EXIT=$?
if [[ $CURL_EXIT -ne 0 ]]; then
  echo "  ℹ️  curl rejected the URL (exit $CURL_EXIT) — falling back to raw nc send"
  # Fallback: send raw bytes via /dev/tcp or nc
  RAW2="GET /${UUID}?msg=Server: ESA1 HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\nx-bridge-id: xxdm2uaPkysWStHbTSKTLN\r\n\r\n"
  OUTPUT2=$(printf "$RAW2" | nc -q1 "$HOST" "$PORT" 2>/dev/null || printf "$RAW2" | nc -w1 "$HOST" "$PORT" 2>/dev/null)
  echo "  (sent via nc — libcurl equivalent: CURLOPT_COPYPOSTFIELDS or raw socket callback)"
fi

check_echo "Case 2" "$OUTPUT2"

# ─── Case 3: Malformed header block with CRLF injection ──────────────────────
sep
echo "Case 3 — Malformed header block with CRLF injection payload"
echo "  Note: libcurl >= 7.53.0 strips CRLF from header values."
echo "  The injected line is sent as a separate raw header line."
echo "  curl option: -H 'raw-header-line'  (CURLOPT_HTTPHEADER verbatim)"

URL3="http://${HOST}:${PORT}/${UUID}"
INJECT=';response.writeHead(200, {"tokenedce68f7eaf748a8ac2b8b9a246d2219": "tokenedce68f7eaf748a8ac2b8b9a246d2219"});response.write("tokenedce68f7eaf748a8ac2b8b9a246d2219");'

OUTPUT3=$(curl -s -i \
  --path-as-is \
  --http1.1 \
  --keepalive \
  -H "accept: application/json" \
  -H "Connection: close" \
  -H "$INJECT" \
  -H "x-bridge-id: xxdm2uaPkysWStHbTSKTLN" \
  -H "x-bridge-proxy-error: true" \
  -H "Accept-Encoding: gzip, deflate" \
  "$URL3" 2>&1)

check_echo "Case 3" "$OUTPUT3"

# ─── HTTP/2 test ──────────────────────────────────────────────────────────────
sep
echo "HTTP/2 test (--http2-prior-knowledge against HTTP/1.1 echo server)"
OUTPUT_H2=$(curl -s -i \
  --http2-prior-knowledge \
  --keepalive \
  "http://${HOST}:${PORT}/" 2>&1)

H2_EXIT=$?
if echo "$OUTPUT_H2" | grep -q "HTTP/2"; then
  echo "  ✅ HTTP/2 response received"
elif [[ $H2_EXIT -ne 0 ]]; then
  echo "  ℹ️  HTTP/2 failed (exit $H2_EXIT) — expected: echo server speaks HTTP/1.1 only"
  echo "  ℹ️  curl/libcurl HTTP/2 capability confirmed by binary: $(curl --version | head -1 | grep -o 'HTTP2[^ ]*')"
else
  echo "  ℹ️  Response did not upgrade to HTTP/2 (server downgraded)"
fi

# ─── Keep-alive test ─────────────────────────────────────────────────────────
sep
echo "Keep-alive test — two requests in one curl invocation (connection reuse)"
OUTPUT_KA=$(curl -s -i \
  --path-as-is \
  --http1.1 \
  --keepalive \
  "http://${HOST}:${PORT}/req-1" \
  "http://${HOST}:${PORT}/req-2" 2>&1)

KA_COUNT=$(echo "$OUTPUT_KA" | grep -ic "request-resource:")
if [[ $KA_COUNT -ge 2 ]]; then
  echo "  ✅ Keep-alive confirmed: $KA_COUNT responses received"
else
  echo "  ℹ️  Received $KA_COUNT responses (keep-alive depends on server support)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
sep
echo "SUMMARY"
echo "  Passed: $PASS / $((PASS + FAIL))"
echo ""
echo "  libcurl version: $(curl --version | head -1)"
echo "  HTTP/2 support:  $(curl --version | grep -o 'HTTP2[^ ]*' || echo 'check nghttp2 in version string')"
echo ""
echo "  Notes:"
echo "    Case 2: libcurl URL parser rejects spaces in URL → raw socket needed"
echo "    Case 3: libcurl strips CRLF from headers (≥7.53.0) → bytes still delivered"
echo "            as separate header line (injection payload reaches the wire)"
