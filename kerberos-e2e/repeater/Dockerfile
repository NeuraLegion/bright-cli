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
#   that PR merges and a new prebuilt release is published we must:
#     1. Clone node-libcurl feat/gssapi-support
#     2. Build it from source (this compiles libcurl with GSSAPI via vcpkg)
#     3. Pack it as a local .tgz and install it into bright-cli
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
    libkrb5-dev \
    krb5-user \
    ca-certificates \
    gnupg \
 && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

# ── Kerberos client configuration ─────────────────────────────────────────
COPY krb5.conf /etc/krb5.conf

# ── vcpkg — required by node-libcurl's native C++ build ──────────────────
RUN git clone --depth 1 https://github.com/microsoft/vcpkg.git /vcpkg \
 && /vcpkg/bootstrap-vcpkg.sh -disableMetrics
ENV VCPKG_ROOT=/vcpkg

# ── Build node-libcurl from feat/gssapi-support ───────────────────────────
# This compiles libcurl with GSSAPI via vcpkg (see scripts/vcpkg-setup.js in
# that branch) so that Curl.getVersion() reports "GSS-API" in its feature list.
RUN git clone --depth 1 --branch feat/gssapi-support \
      https://github.com/NeuraLegion/node-libcurl.git /node-libcurl-gssapi

WORKDIR /node-libcurl-gssapi

RUN npm install
# The build script calls vcpkg-setup.js which injects the gssapi feature,
# then compiles the native addon via node-gyp.
RUN npm run build

# Pack to a local tarball so we can npm install it into bright-cli
RUN npm pack --pack-destination /tmp/

# ── Clone and build bright-cli from feat/kerberos-auth ───────────────────
RUN git clone --depth 1 --branch feat/kerberos-auth \
      https://github.com/NeuraLegion/bright-cli.git /app

WORKDIR /app

# Install all dependencies first (uses the published node-libcurl as a base)
RUN npm install

# Override @brightsec/node-libcurl with our GSSAPI-enabled local build
RUN npm install /tmp/brightsec-node-libcurl-*.tgz

# Compile TypeScript → dist/
RUN npm run build

# Quick sanity check: verify GSS-API appears in the libcurl version string
RUN node -e "\
  const { Curl } = require('@brightsec/node-libcurl'); \
  const v = Curl.getVersion(); \
  console.log('libcurl:', v.version); \
  const ok = (v.version || '').includes('GSS-API') || \
              (v.features || []).some(f => f.includes('GSS')); \
  if (!ok) { \
    console.error('GSS-API NOT found in libcurl build — GSSAPI step failed'); \
    process.exit(1); \
  } \
  console.log('GSS-API confirmed in libcurl build'); \
"

ENTRYPOINT ["node", "dist/index.js", "repeater"]
