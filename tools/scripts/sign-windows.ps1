param (
    [string]$EXPORT_PATH = "./bin",     # Default export path for the signed executable
    [string]$PRODUCT_NAME = "bright-cli-win-x64.exe"   # Default name of the product (executable)
)

# Expected environment variables
# $env:SIGNING_SECRETS_BINARY="EEE...."      # Base64-encoded PKCS#12 certificate data
# $env:SIGNING_SECRETS_PASSWORD="FFF"        # Passkey for the PKCS#12 certificate

# Define file paths and names
$APP_PATH = Join-Path $EXPORT_PATH $PRODUCT_NAME
$APP_PATH_UNSIGNED = "$APP_PATH.unsigned"
$SIGNING_SECRETS = "secrets.p12"
$SIGNING_SECRETS_B64 = "secrets.b64"

# If the required secrets are not available we skip signing completely without an error to enable local builds on windows. A later issigned check will catch this error in the build pipeline
if (-Not (Test-Path env:SIGNING_SECRETS_BINARY)) {
    Write-Host "Skipping signing, since the required secrets are not available."
    exit
}

Write-Host "Signing ""$APP_PATH"""

# create files as needed
Write-Host "Creating p12 file"
# Save the Base64-encoded PKCS#12 certificate data to a file
$env:SIGNING_SECRETS_BINARY | Set-Content -Path $SIGNING_SECRETS_B64
# Decode the Base64-encoded PKCS#12 certificate data to a binary file
certutil -f -decode $SIGNING_SECRETS_B64 $SIGNING_SECRETS

Write-Host "Signing binary $APP_PATH_UNSIGNED"
# Move the original executable to the .unsigned version (as expected by signtool)
Move-Item -Path $APP_PATH -Destination $APP_PATH_UNSIGNED

# Find the latest version of signtool.exe and use it to sign the executable
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\" -Recurse -Include 'signtool.exe' | Where-Object { $_.FullName -like "*x64*" } | Sort-Object LastWriteTime | Select-Object -Last 1 -ExpandProperty FullName
& $SIGNTOOL sign /fd SHA512 /f $SIGNING_SECRETS /p $env:SIGNING_SECRETS_PASSWORD /d "Bright CLI" /du "https://brightsec.com/" /t "http://timestamp.sectigo.com" /v $APP_PATH_UNSIGNED
if ($LASTEXITCODE) {
    exit $LASTEXITCODE
}

# Move the signed executable back to its original location
Move-Item -Path $APP_PATH_UNSIGNED -Destination $APP_PATH

# Remove temporary files (the .unsigned version and the p12 certificate)
Write-Host "Cleaning up $SIGNING_SECRETS"
Remove-Item -Path $SIGNING_SECRETS
Write-Host "Cleaning up $SIGNING_SECRETS_B64"
Remove-Item -Path $SIGNING_SECRETS_B64

Write-Host "Done"
