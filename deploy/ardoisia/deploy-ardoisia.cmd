@echo off
rem Raccourci Windows pour deploy-ardoisia.sh : lance le script avec Git Bash, quel que soit le dossier courant.
rem Usage (PowerShell ou invite de commandes) :   .\deploy\ardoisia\deploy-ardoisia.cmd
cd /d "%~dp0..\.."
"C:\Program Files\Git\bin\bash.exe" deploy/ardoisia/deploy-ardoisia.sh
