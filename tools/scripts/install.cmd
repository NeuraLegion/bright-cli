@echo off

setlocal enableextensions

:: check for existence of PowerShell
echo Checking for existence of powershell.exe
where.exe powershell.exe >nul 2>nul || (
    echo Error: PowerShell not found.
    exit /b 1
)

:: Checking for admin rights
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo You need to run this script as an administrator. Please right-click the script and select "Run as administrator".
    echo.
    pause
    goto :eof
)

:: name of the script
set "CLI_NAME=bright-cli"
:: install directory for the script
set "INSTALL_DIR=%ProgramFiles%\%CLI_NAME%"
:: base URL for downloading the binary
set "DOWNLOAD_BASE_URL=https://github.com/NeuraLegion/%CLI_NAME%/releases/latest/download"
:: TODO: map to ours asset names
set "OS=win"
:: TODO: hardcoded at this moment, replace with %PROCESSOR_ARCHITECTURE%
set "ARCH=x64"
:: name of the asset to download
set "FILENAME=%CLI_NAME%-%OS%-%ARCH%.exe"

:: create INSTALL_DIR if it doesn't exist
if not exist "%INSTALL_DIR%" (
    echo Creating a folder %INSTALL_DIR%
    mkdir "%INSTALL_DIR%"
    echo %INSTALL_DIR% folder created.
)

:: download and ensure non-duplicate filename
set "DOWNLOAD_URL=%DOWNLOAD_BASE_URL%/%FILENAME%"

if exist "%INSTALL_DIR%\%CLI_NAME%.exe" (
    echo %CLI_NAME% already exists in %INSTALL_DIR%. Removing the existing version.
    del /f "%INSTALL_DIR%\%CLI_NAME%.exe"
)

echo Installing %CLI_NAME% to %INSTALL_DIR%...
powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALL_DIR%\%CLI_NAME%.exe'" || exit /b 1
echo %CLI_NAME% installed to %INSTALL_DIR%.
echo Patching PATH env variable...
:: add installation directory to the system's PATH environment variable
if "!path:%INSTALL_DIR%=!" equ "%PATH%" (
   setx PATH "%INSTALL_DIR%;%PATH%"
)

echo.
pause

endlocal
