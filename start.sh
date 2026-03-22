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

# Aufraemen: alter Update-Marker entfernen
rm -f .restart-after-update

# Browser oeffnen (OS-unabhaengig, nur beim ersten Start)
BROWSER_OPENED=false
if command -v xdg-open &>/dev/null; then
    sleep 2 && xdg-open http://localhost:5173 &
    BROWSER_OPENED=true
elif command -v open &>/dev/null; then
    sleep 2 && open http://localhost:5173 &
    BROWSER_OPENED=true
fi

while true; do
    # Server im Hintergrund starten
    npm run dev &
    SERVER_PID=$!

    # Warten: entweder Server beendet sich oder Marker-Datei erscheint
    while kill -0 $SERVER_PID 2>/dev/null; do
        if [ -f ".restart-after-update" ]; then
            echo ""
            echo "=============================="
            echo "  Update-Marker erkannt – Server wird neu gestartet..."
            echo "=============================="
            # Server-Prozessbaum beenden
            kill -- -$SERVER_PID 2>/dev/null || kill $SERVER_PID 2>/dev/null
            wait $SERVER_PID 2>/dev/null
            break
        fi
        sleep 1
    done

    # Kein Marker = normales Ende (Ctrl+C etc.) → Schleife beenden
    if [ ! -f ".restart-after-update" ]; then
        break
    fi
    rm -f .restart-after-update
    echo ""

    # Dependencies aktualisieren falls noetig
    if [ "package.json" -nt "node_modules" ]; then
        echo "Neue Abhaengigkeiten – fuehre npm install aus..."
        npm install
        if [ $? -ne 0 ]; then
            echo "FEHLER: npm install fehlgeschlagen."
            read -p "Druecke Enter zum Beenden..."
            break
        fi
    fi

    echo "Server startet unter http://localhost:5173"
    echo ""
done
