# get dirs
$INSTALLER_DIR = ".\tools\msi"
$OUTPUT_DIR = ".\bin"

# get package version number
$VERSION = (Get-Content "package.json" | ConvertFrom-Json).version
$VERSION = $VERSION -replace '([A-Za-z-.])+','.'

# generate the installer
$WIX_DIR="c:\Program Files (x86)\WiX Toolset v3.11\bin"

. "$WIX_DIR\candle.exe" -arch x64 -dProductVersion="$VERSION" -dSourceDir="$OUTPUT_DIR" -dRepoDir="." $INSTALLER_DIR\product.wxs -o $OUTPUT_DIR\ -ext WixUtilExtension  -ext WixUIExtension
. "$WIX_DIR\light.exe" -o $OUTPUT_DIR\nexploit-cli.msi $OUTPUT_DIR\*.wixobj -ext WixUtilExtension  -ext WixUIExtension

# optional digital sign the certificate.
# you have to previously import it.
#. "C:\Program Files (x86)\Microsoft SDKs\Windows\v7.1A\Bin\signtool.exe" sign /n "Auth10" .\output\installer.msi
