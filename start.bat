@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title RenovApp

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
if errorlevel 1 (
    echo FEHLER: Node.js ist nicht installiert.
    echo.
    echo Bitte Node.js installieren:
    echo   https://nodejs.org  ^(LTS-Version herunterladen^)
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo Node.js %NODE_VERSION% gefunden.

:: --- npm install wenn noetig ---
if not exist "node_modules\" (
    echo Installiere Abhaengigkeiten ^(nur beim ersten Start noetig^)...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo FEHLER: npm install fehlgeschlagen.
        pause
        exit /b 1
    )
    echo.
) else (
    :: package.json neuer als node_modules? Node.js prueft das zuverlaessig
    node -e "const fs=require('fs'); const pkg=fs.statSync('package.json').mtimeMs; const mod=fs.statSync('node_modules').mtimeMs; process.exit(pkg>mod?1:0);" >nul 2>&1
    if errorlevel 1 (
        echo Neue Abhaengigkeiten nach Update - fuehre npm install aus...
        npm install
        if errorlevel 1 (
            echo.
            echo FEHLER: npm install fehlgeschlagen.
            pause
            exit /b 1
        )
        echo.
    )
)

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

:: --- Server starten ---
echo Server startet unter http://localhost:5173
echo Fenster schliessen beendet den Server.
echo.
npm run dev -- --open
