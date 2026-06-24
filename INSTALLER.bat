@echo off
title PDFEditor Pro - Installeur

echo.
echo ================================================
echo   PDFEditor Pro - Creation de l'installeur
echo ================================================
echo.

:: -- Etape 1 : Verifier Node.js --
echo Etape 1/3 : Verification de Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERREUR : Node.js n'est pas installe sur ce PC.
    echo.
    echo Vous devez l'installer avant de continuer :
    echo   1. Ouvrez https://nodejs.org
    echo   2. Telechargez la version LTS (recommandee)
    echo   3. Installez-la, puis relancez ce script
    echo.
    echo Ouverture du navigateur...
    start https://nodejs.org/fr/download
    pause
    exit /b 1
)

node --version
echo Node.js OK.
echo.

:: -- Etape 2 : Installer les dependances --
echo Etape 2/3 : Installation des dependances npm...
echo (Peut prendre 3-5 minutes la premiere fois)
echo.
call npm install 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERREUR lors de npm install.
    echo Verifiez votre connexion internet et relancez.
    pause
    exit /b 1
)
echo.
echo Dependances installees.
echo.

:: -- Etape 3 : Compiler --
echo Etape 3/3 : Compilation Windows (electron-builder)...
echo.
call npm run dist:win 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERREUR lors de la compilation.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   SUCCES ! Fichiers dans le dossier dist\
echo   - PDFEditor Pro Setup.exe  (installeur)
echo   - PDFEditor Pro.exe        (portable)
echo ================================================
echo.
if exist dist\ explorer dist
pause
