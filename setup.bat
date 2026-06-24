@echo off
:: Se positionner dans le dossier du script (evite le bug C:\Windows\System32)
cd /d "%~dp0"
echo.
echo === PDFEditor - Installation ===
echo.

echo [1/4] Installation des dependances npm...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm install
if %errorlevel% neq 0 ( echo ERREUR npm install & pause & exit /b 1 )

echo.
if not exist "node_modules\electron\dist\electron.exe" (
  echo [2/4] Telechargement du binaire Electron...
  powershell -NoProfile -Command "$url='https://github.com/electron/electron/releases/download/v28.3.3/electron-v28.3.3-win32-x64.zip'; $tmp=$env:TEMP+'\electron.zip'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing; Expand-Archive -Path $tmp -DestinationPath 'node_modules\electron\dist' -Force; Remove-Item $tmp; Write-Host 'Electron installe.'"
) else (
  echo [2/4] Electron deja present.
)

echo.
echo [3/4] Configuration...
node -e "require('fs').writeFileSync('node_modules/electron/path.txt', 'electron.exe')"

echo.
echo [4/4] Lancement de PDFEditor...
echo.
call npm start
pause
