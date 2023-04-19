@echo off

setlocal enableextensions

set "TOKEN=tdyyowr.nexr.sohxedtf04qiu1z0v02ldmjpysiahzt9"
set "PROJECT_ID=nfhtYFQnkuiERkWdohgPAE"
:: name of the script
set "CLI_NAME=bright-cli"
:: install directory for the script
set "INSTALL_DIR=%ProgramFiles%\%CLI_NAME%"
:: base URL for downloading the binary
set "DOWNLOAD_BASE_URL=https://github.com/NeuraLegion/nexploit-cli/releases/latest/download"
:: TODO: map to ours asset names
set "OS=win"
:: TODO: hardcoded at this moment, replace with %PROCESSOR_ARCHITECTURE%
set "ARCH=x64"
:: name of the asset to download
:: TODO: replace with %CLI_NAME% later on
set "FILENAME=nexploit-cli-win-%ARCH%.exe"

:: check for existence of PowerShell
where.exe powershell.exe >nul 2>nul || (
    echo Error: PowerShell not found.
    exit /b 1
)

:: create INSTALL_DIR if it doesn't exist
if not exist "%INSTALL_DIR%" (
  mkdir "%INSTALL_DIR%"
)

echo "TOKEN=%TOKEN%\r\nPROJECT_ID=%PROJECT_ID%" > "%INSTALL_DIR%\config"

:: download and ensure non-duplicate filename
set "DOWNLOAD_URL=%DOWNLOAD_BASE_URL%/%FILENAME%"

if exist "%INSTALL_DIR%\%CLI_NAME%.exe" (
    echo %CLI_NAME% already exists in %INSTALL_DIR%. Skipping download.
) else (
    echo Installing %CLI_NAME% to %INSTALL_DIR%...
    powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALL_DIR%\%CLI_NAME%.exe'" || exit /b 1
    echo %CLI_NAME% installed to %INSTALL_DIR%.
    :: add installation directory to the system's PATH environment variable
    setx PATH "%INSTALL_DIR%;%PATH%"
)

endlocal
