@echo off
chcp 65001 >nul
echo Installation du lanceur PDFEdit Or (web)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"
echo.
pause
