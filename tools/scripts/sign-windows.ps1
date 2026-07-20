param (
    [Parameter(Mandatory = $true)]
    [string]$FilePath,                                              # Path to the file to sign (.exe or .msi)
    [string]$Thumbprint = $env:SM_CODE_SIGNING_CERT_SHA1_HASH,     # SHA1 thumbprint of the code signing certificate in DigiCert KeyLocker
    [string]$TimestampUrl = "http://timestamp.digicert.com"        # RFC 3161 timestamp server
)

$ErrorActionPreference = "Stop"

# DigiCert KeyLocker (Software Trust Manager) code signing.
#
# Expected environment variables (consumed by the DigiCert tooling / this script):
#   SM_HOST                         # e.g. https://clientauth.one.digicert.com
#   SM_API_KEY                      # KeyLocker API key
#   SM_CLIENT_CERT_FILE             # Path to the decoded client-auth PKCS#12 file
#   SM_CLIENT_CERT_PASSWORD         # Password for the client-auth PKCS#12 file
#   SM_CODE_SIGNING_CERT_SHA1_HASH  # SHA1 thumbprint of the code signing certificate

# If the signing certificate thumbprint is not available we skip signing completely
# without an error, so local builds on Windows still succeed. In the release
# pipeline the secrets are always present, and the "Verify signature" step below
# guards against silently shipping an unsigned artifact.
if ([string]::IsNullOrWhiteSpace($Thumbprint)) {
    Write-Host "Skipping signing of ""$FilePath"", since SM_CODE_SIGNING_CERT_SHA1_HASH is not available."
    exit 0
}

if (-Not (Test-Path $FilePath)) {
    Write-Host "File to sign not found: $FilePath"
    exit 1
}

# Find the latest x64 signtool.exe from the installed Windows Kits.
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\" -Recurse -Include 'signtool.exe' `
    | Where-Object { $_.FullName -like "*x64*" } `
    | Sort-Object LastWriteTime `
    | Select-Object -Last 1 -ExpandProperty FullName

if (-Not $SIGNTOOL) {
    Write-Host "Unable to locate signtool.exe under the Windows Kits."
    exit 1
}
Write-Host "Using signtool at $SIGNTOOL"

Write-Host "Signing ""$FilePath"" with certificate $Thumbprint"
& $SIGNTOOL sign /sha1 $Thumbprint /tr $TimestampUrl /td SHA256 /fd SHA256 /d "Bright CLI" /du "https://brightsec.com/" /v $FilePath
if ($LASTEXITCODE) {
    Write-Host "signtool sign failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Verifying the signature of ""$FilePath"""
& $SIGNTOOL verify /pa /v $FilePath
if ($LASTEXITCODE) {
    Write-Host "signtool verify failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Done"
