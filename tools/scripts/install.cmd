@echo off

setlocal enableDelayedExpansion

set "ErrorActionPreference=Stop"

:: check for existence of PowerShell
echo Checking for existence of powershell.exe
where.exe powershell.exe >nul 2>nul || (
    echo Error: PowerShell not found.
    exit /b 1
)

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
  echo Running with administrative privileges...
) else (
  echo Relaunching script with administrative privileges...
  echo Please grant administrative access when prompted.
    pause
  cd /d "%~dp0"
  cmd.exe /k "%~dpnx0" %*
  exit /b
)

:: name of the script
set "CLI_NAME=bright-cli"
:: install directory for the script
set "INSTALL_DIR=%ProgramFiles%\%CLI_NAME%"
:: TODO: map to ours asset names
set "OS=win"
:: TODO: hardcoded at this moment, replace with $env:PROCESSOR_ARCHITECTURE
set "ARCH=x64"
:: name of the asset to download
set "FILENAME=%CLI_NAME%-%OS%-%ARCH%.exe"
:: Download and ensure non-duplicate filename
set "DOWNLOAD_URL=https://github.com/NeuraLegion/%CLI_NAME%/releases/latest/download/%FILENAME%"

:: Create INSTALL_DIR if it doesn't exist
if not exist "%INSTALL_DIR%" (
    echo Creating %INSTALL_DIR% folder
    mkdir "%INSTALL_DIR%"
)

if exist "%INSTALL_DIR%\%CLI_NAME%.exe" (
    echo %CLI_NAME% already exists in %INSTALL_DIR%. Removing the existing version.
    del /f "%INSTALL_DIR%\%CLI_NAME%.exe"
)

echo Installing %CLI_NAME% to %INSTALL_DIR%...
powershell -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALL_DIR%\%CLI_NAME%.exe'" || exit /b 1

:: add installation directory to the system's PATH environment variable
echo Patching PATH env variable...
echo %PATH%|find /i "%INSTALL_DIR%">nul || setx PATH "%INSTALL_DIR%;%PATH%" /M>nul

endlocal
