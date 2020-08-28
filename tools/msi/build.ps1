# get dirs
$installer_dir = ".\tools\msi"
$output_dir = ".\bin\win"

# get package version number
$version = (Get-Content "package.json" | ConvertFrom-Json).version

# generate the installer
$wix_dir="c:\Program Files (x86)\WiX Toolset v3.11\bin"

. "$wix_dir\candle.exe" -arch x64 -dProductVersion="$version" $installer_dir\product.wxs -o $output_dir\ -ext WixUtilExtension  -ext WixUIExtension
. "$wix_dir\light.exe" -o $output_dir\nexploit-cli.msi $output_dir\*.wixobj -ext WixUtilExtension  -ext WixUIExtension

# optional digital sign the certificate.
# you have to previously import it.
#. "C:\Program Files (x86)\Microsoft SDKs\Windows\v7.1A\Bin\signtool.exe" sign /n "Auth10" .\output\installer.msi
