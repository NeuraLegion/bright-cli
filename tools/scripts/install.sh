#!/usr/bin/env bash

# ensure the entire script has been downloaded
{
  # install directory for the script
  INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
  # name of the script
  CLI_NAME=bright-cli
  # name of the asset to download
  FILENAME=$CLI_NAME
  # base URL for downloading the binary
  DOWNLOAD_BASE_URL=https://github.com/NeuraLegion/$FILENAME/releases/latest/download
  # TODO: map to ours asset names
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  # TODO: hardcoded at this moment, replace with $(uname -m) later on
  ARCH=x64
  # possible profile files
  PROFILE_FILES=("$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.profile")

  # check for existence of curl or wget
  if command -v curl > /dev/null; then
    DOWNLOAD_COMMAND="curl -fsSL"
  elif command -v wget > /dev/null; then
    DOWNLOAD_COMMAND="wget -qO-"
  else
    echo "Error: curl or wget not found."
    exit 1
  fi

  # download and ensure non-duplicate filename
  if [[ "$OS" == "linux-gnu"* ]]; then
    FILENAME+="-linux-$ARCH"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    FILENAME+="-macos-$ARCH"
  else
    echo "Error: unknown OS type."
    exit 1
  fi

  # create INSTALL_DIR if it doesn't exist
  if [ ! -d "$INSTALL_DIR" ] ; then
    mkdir -p "$INSTALL_DIR"
  fi

  # download and ensure non-duplicate filename
  DOWNLOAD_URL="$DOWNLOAD_BASE_URL/$FILENAME"
  if [ -f "$INSTALL_DIR/$CLI_NAME" ]; then
    echo "$CLI_NAME already exists in $INSTALL_DIR. Removing the existing version."
    rm -f "$INSTALL_DIR/$CLI_NAME"
  fi

  echo "Installing $CLI_NAME to $INSTALL_DIR..."
  $DOWNLOAD_COMMAND "$DOWNLOAD_URL" > "$INSTALL_DIR/$CLI_NAME" && chmod +x "$INSTALL_DIR/$CLI_NAME"
  echo "$CLI_NAME installed to $INSTALL_DIR."

  # loop over profile files and update PATH if they exist
  for PROFILE_FILE in "${PROFILE_FILES[@]}"
  do
      if [ -f "$PROFILE_FILE" ]; then
          if ! grep -q "$INSTALL_DIR" "$PROFILE_FILE"; then
              echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$PROFILE_FILE"
              source "$PROFILE_FILE"
              # change the PATH right now
              PATH="$PATH:$HOME/.local/bin"
          fi
      fi
  done
}
