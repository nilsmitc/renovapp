@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title RenovApp
color 0F

cd /d "%~dp0"

echo ==============================
echo   RenovApp - Starte...
echo ==============================
echo.

:: --- Git-Update ---
where git >nul 2>&1
if not errorlevel 1 (
    echo Pruefe auf Updates...
    git pull
    echo.
) else (
    echo Hinweis: Git nicht gefunden - ueberspringe Update-Pruefung.
    echo          Git installieren fuer automatische Updates: https://git-scm.com
    echo.
)

:: --- Node.js pruefen ---
where node >nul 2>&1
if errorlevel 1 goto :nonode
goto :nodeok

:nonode
echo FEHLER: Node.js ist nicht installiert.
echo.
echo Bitte Node.js installieren:
echo   https://nodejs.org  (LTS-Version herunterladen)
echo.
pause
exit /b 1

:nodeok
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo Node.js %NODE_VERSION% gefunden.

:: --- npm install wenn noetig ---
if not exist "node_modules\" goto :npminstall
node -e "const fs=require('fs'); const pkg=fs.statSync('package.json').mtimeMs; const mod=fs.statSync('node_modules').mtimeMs; process.exit(pkg>mod?1:0);" >nul 2>&1
if errorlevel 1 goto :npminstall
goto :npmok

:npminstall
echo Installiere Abhaengigkeiten...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo FEHLER: npm install fehlgeschlagen.
    pause
    exit /b 1
)
echo.

:npmok
:: --- Datenverzeichnis anlegen ---
if not exist "data\" (
    echo Erstelle Datenverzeichnis...
    mkdir data
    mkdir data\belege
    node -e "require('fs').writeFileSync('data/projekt.json', '{\"gewerke\":[],\"raeume\":[],\"budgets\":[]}')"
    node -e "require('fs').writeFileSync('data/buchungen.json', '[]')"
    node -e "require('fs').writeFileSync('data/rechnungen.json', '[]')"
    node -e "require('fs').writeFileSync('data/lieferanten.json', '{\"lieferanten\":[],\"lieferungen\":[]}')"
    node -e "require('fs').writeFileSync('data/summary.json', '{\"generiert\":null,\"gesamt\":{\"ist\":0,\"budget\":0},\"gewerke\":[],\"raeume\":[],\"letzteBuchungen\":[]}')"
    echo Datenverzeichnis erstellt.
    echo.
)

:: --- Aufraumen ---
if exist ".restart-after-update" del ".restart-after-update"

:: --- Server starten ---
echo ==============================
echo   Server laeuft unter:
echo   http://localhost:5173
echo.
echo   Dieses Fenster NICHT schliessen!
echo   Fenster schliessen = Server stoppen
echo ==============================
echo.

:loop
call npm run dev -- --open
set EXIT_CODE=%errorlevel%

:: Pruefen ob Update-Neustart angefordert
if not exist ".restart-after-update" goto :noloop
del ".restart-after-update"
echo.
echo ==============================
echo   Update installiert - Neustart...
echo ==============================
echo.

:: Dependencies aktualisieren falls noetig
node -e "const fs=require('fs'); const pkg=fs.statSync('package.json').mtimeMs; const mod=fs.statSync('node_modules').mtimeMs; process.exit(pkg>mod?1:0);" >nul 2>&1
if errorlevel 1 (
    echo Neue Abhaengigkeiten - fuehre npm install aus...
    call npm install
)

echo Server startet unter http://localhost:5173
echo.
goto loop

:noloop
:: Normales Ende oder Fehler
echo.
if %EXIT_CODE% neq 0 (
    echo ==============================
    echo   Server wurde mit Fehler beendet.
    echo   Fehlercode: %EXIT_CODE%
    echo ==============================
) else (
    echo Server wurde beendet.
)
echo.
pause
