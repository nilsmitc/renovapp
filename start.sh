#!/bin/bash
cd "$(dirname "$0")"

echo "=============================="
echo "  RenovApp - Starte..."
echo "=============================="
echo ""

# --- Git-Update ---
if command -v git &>/dev/null; then
    echo "Pruefe auf Updates..."
    git pull
    echo ""
else
    echo "Hinweis: Git nicht gefunden - ueberspringe Update-Pruefung."
    echo "         Git installieren fuer automatische Updates: https://git-scm.com"
    echo ""
fi

# --- Node.js pruefen ---
if ! command -v node &>/dev/null; then
    # nvm als Fallback versuchen
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
    elif [ -f "/usr/local/share/nvm/nvm.sh" ]; then
        source "/usr/local/share/nvm/nvm.sh"
    fi
fi

if ! command -v node &>/dev/null; then
    echo "FEHLER: Node.js ist nicht installiert."
    echo ""
    echo "Bitte Node.js installieren:"
    echo "  Linux:  sudo apt install nodejs  (oder: https://nodejs.org)"
    echo "  Mac:    https://nodejs.org  (LTS-Version)"
    echo ""
    read -p "Druecke Enter zum Beenden..."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "Node.js $NODE_VERSION gefunden."

# --- npm install wenn noetig ---
if [ ! -d "node_modules" ]; then
    echo "Installiere Abhaengigkeiten (nur beim ersten Start noetig)..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "FEHLER: npm install fehlgeschlagen."
        read -p "Druecke Enter zum Beenden..."
        exit 1
    fi
    echo ""
else
    # package.json neuer als node_modules? Dann nach Update neu installieren
    if [ "package.json" -nt "node_modules" ]; then
        echo "Neue Abhaengigkeiten nach Update - fuehre npm install aus..."
        npm install
        if [ $? -ne 0 ]; then
            echo ""
            echo "FEHLER: npm install fehlgeschlagen."
            read -p "Druecke Enter zum Beenden..."
            exit 1
        fi
        echo ""
    fi
fi

# --- Datenverzeichnis anlegen ---
if [ ! -d "data" ]; then
    echo "Erstelle Datenverzeichnis..."
    mkdir -p data/belege
    echo '{"gewerke":[],"raeume":[],"budgets":[]}' > data/projekt.json
    echo '[]' > data/buchungen.json
    echo '[]' > data/rechnungen.json
    echo '{"lieferanten":[],"lieferungen":[]}' > data/lieferanten.json
    echo '{"generiert":null,"gesamt":{"ist":0,"budget":0},"gewerke":[],"raeume":[],"letzteBuchungen":[]}' > data/summary.json
    echo "Datenverzeichnis erstellt."
    echo ""
fi

# --- Server starten ---
echo "Server startet unter http://localhost:5173"
echo "Fenster schliessen beendet den Server."
echo ""

# Browser oeffnen (OS-unabhaengig)
if command -v xdg-open &>/dev/null; then
    sleep 2 && xdg-open http://localhost:5173 &
elif command -v open &>/dev/null; then
    sleep 2 && open http://localhost:5173 &
fi

npm run dev
