#!/bin/bash
# KDC container entrypoint
# - Initialises the Kerberos realm database on first boot
# - Creates the principals used by the E2E tests
# - Exports the HTTP service keytab to the shared volume
set -euo pipefail

REALM=EXAMPLE.COM
MASTER_PW=MasterKey1
ADMIN_PW=AdminPass1
SCANNER_PW=ScannerPass1
HTTPD_HOST=www.EXAMPLE.COM
KEYTAB=/keytabs/HTTP.keytab

echo "==> [KDC] Initialising Kerberos realm: ${REALM}"
# krb5_newrealm reads the master key from stdin (twice: set + confirm)
printf '%s\n%s\n' "${MASTER_PW}" "${MASTER_PW}" | krb5_newrealm

echo "==> [KDC] Starting krb5kdc"
krb5kdc

echo "==> [KDC] Starting kadmind"
kadmind

# Give kadmind time to bind its socket before we call kadmin.local
sleep 2

echo "==> [KDC] Creating principals"
kadmin.local -q "addprinc -pw ${ADMIN_PW}   kadmin/admin@${REALM}"
kadmin.local -q "addprinc -pw ${SCANNER_PW} scanner@${REALM}"
kadmin.local -q "addprinc -randkey          HTTP/${HTTPD_HOST}@${REALM}"

echo "==> [KDC] Exporting service keytab to ${KEYTAB}"
mkdir -p "$(dirname "${KEYTAB}")"
kadmin.local -q "ktadd -k ${KEYTAB} HTTP/${HTTPD_HOST}@${REALM}"
# World-readable so that the httpd container (different uid) can copy it
chmod 644 "${KEYTAB}"

echo "==> [KDC] Realm ready. Principals:"
kadmin.local -q "listprincs"

echo "==> [KDC] Tailing KDC log (Ctrl-C to stop stack)"
# Keep the container running; healthcheck polls port 88
tail -f /var/log/krb5kdc.log 2>/dev/null || tail -f /dev/null
