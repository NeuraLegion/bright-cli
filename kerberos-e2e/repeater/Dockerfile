FROM ubuntu:22.04

# ─────────────────────────────────────────────────────────────────────────────
# bright-cli repeater — built from feat/kerberos-auth
#
# Why build from source?
#   The published @brightsec/node-libcurl@5.0.6 does NOT include GSSAPI support
#   in its prebuilt libcurl binary, so CURLAUTH_NEGOTIATE fails with error 67.
#
#   NeuraLegion/node-libcurl#19 (feat/gssapi-support) adds the `gssapi` vcpkg
#   feature that compiles libcurl with --with-gssapi on Linux/macOS.  Until
#   that PR merges and a new prebuilt release is published we must build
#   node-libcurl from source.
#
# Why NOT use node-libcurl's npm preinstall script on Linux?
#   scripts/vcpkg-common.js calls `process.exit(0)` immediately on non-Windows
#   platforms, so `scripts/vcpkg-setup.js` is a complete no-op on Linux.
#   The npm `install` script then falls through to `node-pre-gyp install
#   --fallback-to-build`, which calls `scripts/curl-config.js` -> system
#   `curl-config` (not installed, and wouldn't have GSSAPI anyway).
#
# Build strategy (Linux):
#   1. Clone node-libcurl feat/gssapi-support
#   2. npm install --ignore-scripts  (skip the broken preinstall/install hooks)
#   3. Generate vcpkg.json manually (substitute version/OpenSSL placeholders,
#      inject `gssapi` into curl features -- it is absent from the template)
#   4. vcpkg install --triplet x64-linux  (compiles libcurl + MIT Kerberos GSSAPI)
#   5. node-pre-gyp configure build with explicit --curl_include_dirs /
#      --curl_libraries pointing at vcpkg_installed/ (bypasses curl-config)
#   6. npm pack -> .tgz installed into bright-cli in place of the published pkg
# ─────────────────────────────────────────────────────────────────────────────

ENV DEBIAN_FRONTEND=noninteractive

# ── System build dependencies ─────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    python3 \
    python3-pip \
    make \
    g++ \
    cmake \
    pkg-config \
    zip \
    unzip \
    tar \
    ninja-build \
    autoconf \
    autoconf-archive \
    automake \
    bison \
    flex \
    libtool \
    libkrb5-dev \
    krb5-user \
    ca-certificates \
    gnupg \
 && rm -rf /var/lib/apt/lists/*

# ── Node.js 22 (node-libcurl feat/gssapi-support requires >=22.14) ────────
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

# ── Kerberos client configuration ─────────────────────────────────────────
COPY krb5.conf /etc/krb5.conf

# ── vcpkg ─────────────────────────────────────────────────────────────────
RUN git clone --depth 1 https://github.com/microsoft/vcpkg.git /vcpkg \
 && /vcpkg/bootstrap-vcpkg.sh -disableMetrics
ENV VCPKG_ROOT=/vcpkg

# ── Clone node-libcurl (feat/gssapi-support) ──────────────────────────────
RUN git clone --depth 1 --branch feat/gssapi-support \
      https://github.com/NeuraLegion/node-libcurl.git /node-libcurl-gssapi

WORKDIR /node-libcurl-gssapi

# Skip preinstall (vcpkg-setup.js, Windows-only) and install (node-pre-gyp,
# needs curl-config).  We will run the native build manually after vcpkg.
RUN npm install --ignore-scripts --legacy-peer-deps

# ── Generate vcpkg.json with gssapi feature injected ─────────────────────
# The template lacks `gssapi`; substitute both placeholders and add it.
# OpenSSL 3.3.2 is a recent stable release available in the vcpkg baseline
# used by this version of node-libcurl.
COPY gen-vcpkg-json.js /gen-vcpkg-json.js
RUN node /gen-vcpkg-json.js

# ── Compile libcurl with GSSAPI via vcpkg ────────────────────────────────
RUN ${VCPKG_ROOT}/vcpkg install --triplet x64-linux

# ── Build the native addon ────────────────────────────────────────────────
# vcpkg builds static libraries (x64-linux triplet).  Linking only -lcurl
# leaves transitive GSSAPI/krb5 symbols unresolved.  Use pkg-config --static
# to collect all transitive link flags automatically.
RUN VCPKG_INSTALLED="$(pwd)/vcpkg_installed/x64-linux" \
 && CURL_LIBS=$(PKG_CONFIG_PATH="$VCPKG_INSTALLED/lib/pkgconfig" pkg-config --libs --static libcurl) \
 && ./node_modules/.bin/node-pre-gyp configure build \
      --curl_include_dirs="$VCPKG_INSTALLED/include" \
      --curl_libraries="$CURL_LIBS"

# Compile TypeScript -> dist/ so the package's main entry point is available
RUN npm run build:dist

ENV LD_LIBRARY_PATH=/node-libcurl-gssapi/vcpkg_installed/x64-linux/lib

# ── GSSAPI sanity check ───────────────────────────────────────────────────
COPY check-gssapi.js /check-gssapi.js
RUN node /check-gssapi.js

# ── Pack as a tarball for installation into bright-cli ────────────────────
RUN npm pack --pack-destination /tmp/

# ── Clone and build bright-cli from feat/kerberos-auth ───────────────────
RUN git clone --depth 1 --branch feat/kerberos-auth \
      https://github.com/NeuraLegion/bright-cli.git /app

WORKDIR /app

# Install all dependencies (published @brightsec/node-libcurl as placeholder)
RUN npm install --legacy-peer-deps

# Replace with our GSSAPI-enabled local build.
# Use --ignore-scripts to prevent node-pre-gyp from re-running (it would fail
# without curl-config), then manually copy the pre-built native binary.
RUN npm install --ignore-scripts /tmp/brightsec-node-libcurl-*.tgz \
 && mkdir -p /app/node_modules/@brightsec/node-libcurl/lib/binding \
 && cp /node-libcurl-gssapi/lib/binding/node_libcurl.node \
       /app/node_modules/@brightsec/node-libcurl/lib/binding/node_libcurl.node

# Compile TypeScript -> dist/
RUN npm run build

# ── Copy E2E integration test (run at container runtime, not build time) ──────
COPY kerberos-integration-test.ts /app/kerberos-integration-test.ts

ENTRYPOINT ["node", "dist/index.js", "repeater"]
