#!/usr/bin/env bash
set -euo pipefail

# Expected environment variables
#APPLE_ID=AAA
#APPLE_APP_PASSWORD=BBB
#APPLE_TEAM_ID=CCC
#APPLE_SIGNING_IDENTITY="DDD"
#APPLE_SIGNING_SECRETS_BINARY=EEE....
#APPLE_SIGNING_SECRETS_PASSWORD=FFF

EXPORT_PATH=${1:-./bin}
PRODUCT_NAME=${2:-bright-cli-macos-x64}
KEYCHAIN_PROFILE=AC_PASSWORD
APP_PATH="$EXPORT_PATH/$PRODUCT_NAME"
ZIP_PATH="$EXPORT_PATH/$PRODUCT_NAME.zip"
DMG_PATH="$EXPORT_PATH/$PRODUCT_NAME.dmg"
APPLE_SIGNING_SECRETS="AppleCodeSigningSecrets.p12"
KEYCHAIN_NAME=CodeSigningChain
KEYCHAIN_PASSWORD=123456
KEYCHAIN_FILE="$HOME/Library/Keychains/$KEYCHAIN_NAME-db"
OLD_KEYCHAIN_NAMES=$(security list-keychains | sed -E -e ':a' -e 'N' -e '$!ba' -e 's/\n//g' -e 's/ //g' -e 's/""/" "/g')

echo "Signing & notarizing \"$APP_PATH\""

if [[ "$OSTYPE" != *"darwin"* ]]; then
  echo "ERROR! This script needs to be run on macOS!"
  exit 1
fi

echo "Creating p12 file"
echo "$APPLE_SIGNING_SECRETS_BINARY" | base64 --decode > "$APPLE_SIGNING_SECRETS"

echo "Adding temporary keychain"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"
security list-keychains -s "$KEYCHAIN_NAME"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

echo "Importing p12 file into temporary keychain"
security import "$APPLE_SIGNING_SECRETS" -P "$APPLE_SIGNING_SECRETS_PASSWORD" -k "$KEYCHAIN_NAME" -T /usr/bin/codesign
rm $APPLE_SIGNING_SECRETS
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

# Wait for security commands to finish before running codesign
sleep 10

echo "Signing binary $APP_PATH"
codesign -s "$APPLE_SIGNING_IDENTITY" -v "$APP_PATH" --timestamp --options runtime

echo "Creating zip file $ZIP_PATH"
/usr/bin/ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "Preparing notarization"
xcrun notarytool store-credentials "$KEYCHAIN_PROFILE" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --keychain "$KEYCHAIN_FILE"

# Notarize & wait
echo "Running notarization"
xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# Create dmg
echo "Creating DMG file $DMG_PATH"
hdiutil create -volname "$PRODUCT_NAME" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# Staple .dmg
xcrun stapler staple "$DMG_PATH"

# Cleanup
echo "Cleaning up"
security list-keychains -s "$OLD_KEYCHAIN_NAMES"
security delete-keychain "$KEYCHAIN_NAME"
rm "$ZIP_PATH"
