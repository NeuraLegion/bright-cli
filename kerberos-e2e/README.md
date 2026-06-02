# Kerberos/SPNEGO E2E Test Harness

Self-contained Docker Compose environment to validate end-to-end Kerberos/SPNEGO authentication in the bright-cli repeater.

Covers [PR #751 — feat: Add Kerberos/SPNEGO authentication support for repeater](https://github.com/NeuraLegion/bright-cli/pull/751) and its dependency [node-libcurl PR #19 — feat: Add GSSAPI/Kerberos (SPNEGO) support to libcurl build](https://github.com/NeuraLegion/node-libcurl/pull/19).

---

## Architecture

```
┌──────────────────┐   Kerberos (UDP/TCP 88)   ┌────────────────────────┐
│  KDC             │◄─────────────────────────►│  Apache httpd          │
│  MIT krb5        │                            │  mod_auth_gssapi       │
│  172.30.0.2      │  keytab (shared volume)    │  172.30.0.3  :80       │
└──────────────────┘──────────────────────────►└───────────┬────────────┘
                                                            │ HTTP + SPNEGO
                                               ┌────────────▼────────────┐
                                               │  bright-cli repeater    │
                                               │  feat/kerberos-auth     │
                                               │  node-libcurl+gssapi    │
                                               │  172.30.0.4             │
                                               └─────────────────────────┘
```

| Container  | Image base                               | Role                                                     |
| ---------- | ---------------------------------------- | -------------------------------------------------------- |
| `kdc`      | Ubuntu 22.04 + krb5-kdc                  | MIT KDC: creates realm, principals, exports keytab       |
| `httpd`    | Ubuntu 22.04 + Apache2 + mod_auth_gssapi | SPNEGO-protected HTTP service                            |
| `repeater` | Ubuntu 22.04 + Node 20                   | bright-cli built from source with GSSAPI-enabled libcurl |

All containers share a private bridge network (`172.30.0.0/24`) with static IPs and FQDNs. Kerberos requires real hostnames — IP-only addressing will not work.

---

## Prerequisites

| Requirement       | Minimum version | Check                                 |
| ----------------- | --------------- | ------------------------------------- |
| Docker Engine     | 24.0            | `docker --version`                    |
| Docker Compose v2 | 2.20            | `docker compose version`              |
| Disk space        | ~4 GB free      | vcpkg + libcurl build cache           |
| Internet access   | required        | Clone repos, apt-get, vcpkg downloads |

> **First build takes 15–25 minutes** because vcpkg downloads and compiles
> libcurl from source with GSSAPI support. Subsequent builds use the Docker
> layer cache and complete in under a minute.

---

## Quick start

```bash
# 1. Check out this branch
git clone git@github.com:NeuraLegion/bright-cli.git bright-cli
cd bright-cli
git checkout kerberos-e2e

# 2. Enter the test directory
cd kerberos-e2e

# 3. (Optional) supply Bright platform credentials for step 7
export BRIGHT_TOKEN="your-bright-api-token"
export REPEATER_ID="your-repeater-uuid"

# 4. Run the test suite
chmod +x test.sh
./test.sh

# 5. Clean up when done
docker compose -p kerberos-e2e down -v
```

---

## File layout

```
kerberos-e2e/
├── docker-compose.yml       Main Compose file
├── test.sh                  Automated smoke-test runner (7 steps)
│
├── kdc/                     MIT Kerberos KDC
│   ├── Dockerfile
│   ├── krb5.conf            Kerberos client/library config (realm, KDC address)
│   ├── kdc.conf             KDC daemon config (enctypes, ACL path)
│   ├── kadm5.acl            Admin ACL: grants kadmin/admin full permissions
│   └── entrypoint.sh        Initialises realm, creates principals, exports keytab
│
├── httpd/                   Apache httpd with SPNEGO
│   ├── Dockerfile
│   ├── krb5.conf            (identical to kdc/krb5.conf)
│   └── spnego.conf          Apache VirtualHost: /protected requires Kerberos auth
│
└── repeater/                bright-cli repeater
    ├── Dockerfile           Builds from feat/kerberos-auth + node-libcurl gssapi branch
    └── krb5.conf            (identical to kdc/krb5.conf)
```

---

## Test steps explained

`test.sh` runs 7 steps in order. Each step is independent and prints **PASS / FAIL / SKIP**.

### Step 1 — Stack startup

Runs `docker compose up --build`. Waits for the KDC container to pass its healthcheck (port 88 accepting connections), then waits 5 s for the keytab to be written to the shared volume.

Expected output:

```
[1/7] Building and starting Docker Compose stack
      PASS: Stack started; KDC is healthy
```

### Step 2 — GSSAPI in node-libcurl

Runs a one-liner inside the repeater container to call `Curl.getVersion()` and
assert that `"GSS-API"` appears in the libcurl feature list.

This is the key prerequisite: if the `feat/gssapi-support` branch of
node-libcurl was not built correctly, this step fails and all subsequent
Kerberos tests are meaningless.

Expected output:

```
[2/7] Verifying GSS-API support in node-libcurl
      libcurl version: libcurl/8.x.y OpenSSL/... GSS-API ...
      GSS-API is present
      PASS
```

### Step 3 — kinit smoke test

Runs `kinit scanner@EXAMPLE.COM` inside the KDC container (where `krb5-user`
and the KDC itself are both present). Verifies that the KDC is issuing tickets
for the `scanner` principal.

Expected output:

```
[3/7] Testing kinit inside the KDC container
      Ticket cache: FILE:/tmp/krb5cc_0
      Default principal: scanner@EXAMPLE.COM
      ...
      PASS: kinit succeeded
```

### Step 4 — Direct curl SPNEGO baseline

Runs `curl --negotiate -u : http://www.EXAMPLE.COM/protected/` inside the KDC
container (which has `krb5-user` + system `curl`). This establishes that the
full Kerberos stack — KDC → keytab → Apache `mod_auth_gssapi` — works before
the repeater is involved.

> **Note**: The system `curl` in the KDC container may not have been compiled
> with GSSAPI support. If it returns a non-200 status the step logs a warning
> but does not fail the test run — the repeater image is the one that matters.

### Step 5 — `Connection: close` regression check

Inspects the compiled `HttpRequestExecutor.js` inside the repeater container
to determine whether the `Connection: close` injection is guarded against
Kerberos requests.

**Background**: `applyCurlHeaders` appends `Connection: close` when
`reuseConnection` is `false` (the default). When Kerberos is active, the
executor correctly activates the shared Multi handle for TCP keepalive — but if
`Connection: close` is also sent at the HTTP layer, the server tears down the
connection after the 401 challenge, aborting the SPNEGO multi-round-trip.

This step detects the known bug described in the code review and reports it
clearly without blocking the test run. Once the PR is fixed, this step
confirms the guard is present.

### Step 6 — `CURLGSSAPI_DELEGATION_FLAG` value check

Verifies two things:

1. The `CurlGssApi` enum from node-libcurl has `DelegationFlag = 2`
   (unconditional delegation) and `PolicyFlag = 1` (policy-gated delegation).

2. The compiled `HttpRequestExecutor.js` uses value `2` (not `1`) for
   `CURLGSSAPI_DELEGATION_FLAG`.

**Background**: PR #751 sets the constant to `1`, which silently activates
policy-based delegation instead of unconditional delegation. When `--kerberos-delegation`
is passed, users expect unconditional delegation (`DelegationFlag = 2`).

### Step 7 — Repeater platform registration (optional)

Starts the repeater with real `BRIGHT_TOKEN` + `REPEATER_ID` environment
variables, waits 20 s, and dumps the repeater logs. You then verify in the
Bright platform UI that the repeater shows as connected.

This step is skipped when either variable is not set.

---

## Manual verification

After `./test.sh` completes (or at any point while the stack is running):

### Verify Kerberos ticket issuance

```bash
# Get a ticket manually inside the KDC container
docker compose -p kerberos-e2e exec kdc bash -c "
  printf 'ScannerPass1\n' | kinit scanner@EXAMPLE.COM
  klist
"
```

### Hit the SPNEGO-protected endpoint directly

```bash
# From the KDC container (if system curl supports GSSAPI)
docker compose -p kerberos-e2e exec kdc bash -c "
  printf 'ScannerPass1\n' | kinit scanner@EXAMPLE.COM
  curl -v --negotiate -u : http://www.EXAMPLE.COM/protected/
"

# From your host (if MIT Kerberos is installed locally)
KRB5_CONFIG=kdc/krb5.conf kinit scanner@EXAMPLE.COM  # password: ScannerPass1
curl --negotiate -u : http://localhost:8880/protected/
```

Expected response headers include:

```
HTTP/1.1 200 OK
X-Authenticated-User: scanner@EXAMPLE.COM
WWW-Authenticate: Negotiate <token>
```

### Inspect Apache SPNEGO logs

```bash
docker compose -p kerberos-e2e logs -f httpd
# Look for:
#   [auth_gssapi:debug] ... Acquiring credentials for HTTP/www.EXAMPLE.COM@EXAMPLE.COM
#   [auth_gssapi:debug] ... GSSAPI authentication successful
```

### Inspect repeater logs

```bash
docker compose -p kerberos-e2e logs -f repeater
# Look for:
#   Applying Kerberos/SPNEGO authentication for URL "http://www.EXAMPLE.COM/..."
```

### List all Kerberos principals

```bash
docker compose -p kerberos-e2e exec kdc kadmin.local -q "listprincs"
```

---

## Realm details

| Item                            | Value                                     |
| ------------------------------- | ----------------------------------------- |
| Realm                           | `EXAMPLE.COM`                             |
| KDC hostname                    | `kdc.EXAMPLE.COM` (172.30.0.2)            |
| KDC port                        | `88`                                      |
| Admin server                    | `kdc.EXAMPLE.COM:749`                     |
| Master password                 | `MasterKey1`                              |
| Admin principal                 | `kadmin/admin@EXAMPLE.COM` / `AdminPass1` |
| Test user                       | `scanner@EXAMPLE.COM` / `ScannerPass1`    |
| HTTP service                    | `HTTP/www.EXAMPLE.COM@EXAMPLE.COM`        |
| Keytab path (inside containers) | `/keytabs/HTTP.keytab` (shared volume)    |
| Protected URL                   | `http://www.EXAMPLE.COM/protected/`       |
| Health URL                      | `http://www.EXAMPLE.COM/health`           |

---

## Known issues being tested (open PRs)

These bugs were identified in the code review of PR #751. Steps 5 and 6 of
`test.sh` detect them automatically.

### Bug 1 — Wrong `CURLGSSAPI_DELEGATION_FLAG` value

**File**: `src/RequestExecutor/HttpRequestExecutor.ts:26`

```ts
// Current (wrong):
private readonly CURLGSSAPI_DELEGATION_FLAG = 1;  // = CURLGSSAPI_DELEGATION_POLICY_FLAG

// Correct:
private readonly CURLGSSAPI_DELEGATION_FLAG = 2;  // = CURLGSSAPI_DELEGATION_FLAG (unconditional)
// or better — use the typed enum:
import { CurlGssApi } from '@brightsec/node-libcurl';
curl.setOpt('GSSAPI_DELEGATION', CurlGssApi.DelegationFlag);  // = 2
```

### Bug 2 — `Connection: close` breaks SPNEGO handshake

**File**: `src/RequestExecutor/HttpRequestExecutor.ts:263`

```ts
// Current (buggy) — no guard for Kerberos:
if (!this.options.reuseConnection && !this.hasHeader(request, 'connection')) {
  curlHeaders.push('Connection: close');
}

// Fixed:
if (
  !this.options.reuseConnection &&
  !this.shouldApplyKerberos(request) && // ← add this guard
  !this.hasHeader(request, 'connection')
) {
  curlHeaders.push('Connection: close');
}
```

---

## Troubleshooting

| Symptom                                               | Likely cause                                        | Resolution                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CURLE_AUTH_ERROR (67)` in repeater logs              | libcurl built without GSSAPI                        | Step 2 of test.sh will catch this. Rebuild repeater image: `docker compose build --no-cache repeater`                                   |
| `kinit: Cannot contact any KDC for realm EXAMPLE.COM` | KDC hostname not resolvable                         | All containers must use the Docker Compose network. Do not run kinit on the host without adding `kdc.EXAMPLE.COM` to `/etc/hosts`.      |
| `Server not found in Kerberos database (7)`           | HTTP service principal missing                      | KDC entrypoint failed. Check: `docker compose logs kdc` and verify `HTTP/www.EXAMPLE.COM@EXAMPLE.COM` in `kadmin.local -q "listprincs"` |
| `Clock skew too great`                                | Container clocks drifted                            | Restart Docker daemon. All containers on the same host share the system clock and should stay in sync.                                  |
| httpd stuck at `Waiting for keytab...`                | KDC slow to start or entrypoint failed              | Wait longer or check `docker compose logs kdc` for errors during `krb5_newrealm`.                                                       |
| First build takes >30 min                             | vcpkg compiling libcurl + dependencies from scratch | Normal on first run. Subsequent builds use Docker layer cache.                                                                          |
| `npm ERR! … brightsec-node-libcurl-*.tgz` not found   | npm pack failed                                     | Check `docker compose logs repeater` during build for node-libcurl compile errors. Usually a missing `libkrb5-dev`.                     |
| Repeater exits immediately                            | Missing `BRIGHT_TOKEN` or `REPEATER_ID`             | These are required for step 7. Set them or skip step 7.                                                                                 |

---

## Dependency on unmerged PRs

This test harness is designed to work with **both PRs in their current
unmerged state**:

| PR                                                                                     | Status | How this harness handles it                                                                                                  |
| -------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [bright-cli #751](https://github.com/NeuraLegion/bright-cli/pull/751) — Kerberos CLI   | Open   | `repeater/Dockerfile` clones `feat/kerberos-auth` branch directly                                                            |
| [node-libcurl #19](https://github.com/NeuraLegion/node-libcurl/pull/19) — GSSAPI build | Open   | `repeater/Dockerfile` clones `feat/gssapi-support`, builds from source, packs as local `.tgz`, then installs into bright-cli |

Once both PRs merge and a new `@brightsec/node-libcurl` prebuilt release is
published, the `repeater/Dockerfile` can be simplified to:

```dockerfile
RUN npm i -g @brightsec/cli@<version-with-kerberos>
ENTRYPOINT ["bright", "repeater"]
```
