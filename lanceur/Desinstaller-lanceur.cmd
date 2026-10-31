@echo off
chcp 65001 >nul
echo Désinstallation du lanceur PDFEdit Or (web)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1" -Desinstaller
echo.
pause
