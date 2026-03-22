# RenovApp – Kostenverfolgung für Renovierungsprojekte

Web-App zur Kostenverfolgung von Renovierungsprojekten. Lokale SvelteKit-Anwendung mit dateibasierter JSON-Speicherung – kein Server, keine Datenbank nötig.

## Features

- **Dashboard** – KPI-Karten: Gesamtbudget, Bezahlt, Frei verfügbar, Verbraucht-%, Burn Rate (Ø 3 Monate), Offene Rechnungen (gelb/amber/rot je nach Fälligkeit), Nächste Fälligkeit mit Countdown, Top-Raum; **Nächste-Zahlungen-Tabelle** mit Fälligkeitsdaten und Dringlichkeits-Farbcodierung; 4 klickbare Charts; **Gewerke-Übersicht** mit Multi-Segment-Fortschrittsbalken (blau = bezahlt, orange = offen, violett = Restauftrag); **Monatsverlauf** (Balken-Chart, Linien-Chart, Tabelle) direkt integriert
- **Ausgaben** – Kostenbuchungen erfassen, bearbeiten, löschen; Volltext-Suche + kombinierbare Filter inkl. Herkunft (direkt / aus Rechnung / aus Lieferung); **Rückbuchungen**; optionales **Tätigkeit**-Feld
- **Aufträge** – KPI-Karten (Gesamtvolumen, Bezahlt, Offen, Restauftrag); **Nächste-Zahlungen-Sektion**; Such-/Filterleiste (Auftragnehmer, Status, Gewerk); **3 Sortieroptionen** (Gewerk, Volumen, Fälligkeit); Stacked Progress Bars pro Gewerk; **Detailseite** mit KPI-Cards, 3-Segment Fortschrittsbalken, Zahlungs-Callout bei Überfälligkeit, **Timeline/Verlauf** aller Vertragsereignisse; Abschlag-Tabelle mit farbigem Statusrand und Countdown; Angebot-Upload; **Zahlungsfrist-Tracking** mit Frühwarnung; **Inline-Bearbeitung**; Lieferungen zuordnen
- **Nachträge** – Genehmigte Mehraufwände (Change Orders) auf Aufträgen erfassen; Gesamtauftrag = Auftragssumme + Σ Nachträge; Fortschrittsbalken berücksichtigt Nachträge
- **Lieferanten** – Materialeinkäufe bei Händlern (Hornbach, Bauhaus etc.) erfassen; Lieferungen mit Belegen und Positionen; **Gutschriften** (negativer Betrag, rot markiert); **automatische PDF-Extraktion** (Datum, Betrag, Rg.-Nr., Positionen); Lieferungen fließen automatisch als Buchung in Ausgaben/Dashboard ein
- **Flexible Ortzuordnung** – Buchungen auf einzelne Räume oder ganze Stockwerke buchen
- **Belege** – Zentrale Dokumentenübersicht mit **Bild-Vorschau** (Thumbnails für JPG/PNG); **Gruppierung wählbar** (nach Monat / Gewerk / Typ); farbige Typ-Badges; Gewerk-Farbdots; **Fehlende-Belege-Anzeige** (Einträge ohne Beleg werden gezählt und hervorgehoben)
- **Prognose** – KPI-Karten (Budget, Bezahlt, Frei verfügbar, Budget-Erschöpfung, Burn Rate, Offene Rechnungen, Restauftrag); Ausgabenverlauf-Chart mit Prognoselinie; **Nächste-Zahlungen-Tabelle**; **Gewerk-Übersicht** mit Budget/Bezahlt/Offen/Restauftrag/Frei und Ampel-Status
- **Budget** – Card-Layout mit **Ampel-Rand** (rot/gelb/grün); **Sortierung nach Status** (kritisch zuerst); Stacked Bars (Bezahlt/Offen/Restauftrag); kompakte Aufträge-Info; Inline-Bearbeitung; **Sammelgewerk-Aufschlüsselung** nach Tätigkeit (einklappbar)
- **Sammelgewerk** – Gewerke (z.B. Generalunternehmer) als "Sammelgewerk" markieren: kein Budget-Alarm, stattdessen Tätigkeit-Aufschlüsselung
- **Gewerke** – Card-Layout mit Farbbalken, **Drag & Drop Sortierung**, KPI-Karten (Anzahl, Gesamtbudget, Verbraucht), Budget-Fortschrittsbalken pro Karte, Links zu Buchungen/Aufträgen; **Standardgewerke** beim Erststart automatisch angelegt
- **Räume** – Card-Layout gruppiert nach Geschoss, **Drag & Drop Sortierung**, KPI-Karten, **Fläche (m²)** mit Kosten/m²-Kennzahl, Gewerk-Farbbalken pro Raum, Geschoss-Kostenübersicht; **Standard-Räume** beim Erststart
- **Bauleiter-Bericht** – Professioneller PDF-Bericht mit Deckblatt, Budget-Übersicht, Kategorien-Analyse, Kosten nach Raum, Auftragsstatus, Monatsverlauf, Prognose und Lieferanten; 7 eingebettete Charts; optionale **KI-Analyse durch Claude** (Zusammenfassung, Risikobewertung, Cashflow, Empfehlungen)
- **Steuer §35a** – Steuerauswertung für den Steuerberater: Arbeitslohn-Buchungen als §35a-fähige Handwerkerleistungen markieren, optional mit Arbeitsanteil bei Mischrechnungen; KPI-Karten (Arbeitslöhne, Steuerersparnis max. 1.200 €/Jahr, Limit-Auslastung); CSV-Export je Steuerjahr; Pflichtangaben-Checkliste direkt in der App
- **Export / Import** – Vollständiges ZIP-Backup aller Daten inkl. Belege und Rechnungen; Restore per Import
- **E-Mail-Import** – Rechnungen aus Thunderbird-Postfach importieren (Anhänge extrahieren und als Belege anlegen)
- **Icons & visuelles Design** – Heroicons (Inline-SVG) auf allen Seiten; sticky Navigation; konsistente Card- und KPI-Styles mit Animations; responsives Layout

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/) – Doughnut- und Balkendiagramme
- [fflate](https://github.com/101arrowz/fflate) – ZIP-Kompression für Export/Import
- [pdfmake](https://pdfmake.github.io/docs/) – PDF-Erzeugung (Bauleiter-Bericht)
- [chartjs-node-canvas](https://github.com/SeanSobey/ChartjsNodeCanvas) – Server-side Chart-Rendering für PDF
- JSON-Dateien als Datenspeicher (kein externes DB)

## Voraussetzungen

- [Node.js](https://nodejs.org/) – LTS-Version von [nodejs.org](https://nodejs.org) herunterladen und installieren
- [Git](https://git-scm.com/) – [git-scm.com](https://git-scm.com/download/win) (Windows) bzw. über Paketmanager (Linux/Mac)

> Git ist für automatische Updates nötig. Ohne Git startet die App trotzdem — nur Updates müssen manuell geholt werden.

## Installation & Start

**Schritt 1:** Repository herunterladen:

```bash
git clone https://github.com/nilsmitc/renovapp.git
```

**Schritt 2:** Starten — je nach Betriebssystem:

| Betriebssystem | Starten |
|----------------|---------|
| **Windows** | Doppelklick auf `start.bat` |
| **Linux** | Doppelklick auf `start.sh` (oder Terminal: `./start.sh`) |
| **Mac** | Terminal: `./start.sh` |

Der Start-Assistent erledigt beim ersten Start alles automatisch:
- Abhängigkeiten installieren (`npm install`)
- Datenordner und leere Startdateien anlegen
- **Standardgewerke** (Rohbau, Elektro, Sanitär, Heizung, Fenster & Türen, Trockenbau, Maler, Boden, Dach, Sonstiges) und **Standard-Räume** (Küche, Wohnzimmer, Bad, Flur, Schlafzimmer) automatisch vorbelegen

App läuft unter `http://localhost:5173`.

## Updates

**Automatisch:** Beim nächsten Start via `start.bat` / `start.sh` — `git pull` läuft automatisch.

**Manuell** (falls kein Git):
```bash
# Neue Version herunterladen und entpacken, dann:
npm install
```

Persönliche Daten in `data/` werden nie überschrieben — nur der Quellcode wird aktualisiert.

## Datenstruktur

Alle Daten liegen in `data/` (nicht im Repository):

| Datei | Inhalt |
|-------|--------|
| `projekt.json` | Gewerke, Räume, Budgets |
| `buchungen.json` | Alle Kostenbuchungen (inkl. auto-erstellter aus Rechnungen und Lieferungen) |
| `rechnungen.json` | Rechnungen mit Abschlägen und Nachträgen |
| `lieferanten.json` | Lieferanten und Lieferungen |
| `summary.json` | Auto-generierte Zusammenfassung |
| `belege/` | Belege pro Buchung (`{buchung-id}/datei`) |
| `rechnungen/` | Belege pro Abschlag (`{rechnung-id}/{abschlag-id}/datei`) + Angebote |
| `lieferungen/` | Belege pro Lieferung (`{lieferung-id}/datei`) |

Geldbeträge werden als **Integer in Cent** gespeichert (`300000` = 3.000,00 €).

## Projektstruktur

```
src/
├── lib/
│   ├── domain.ts       # Typen, Validierung, Aggregation
│   ├── dataStore.ts    # JSON Datei-I/O + Seed-Logik (Standardgewerke/-räume)
│   ├── format.ts       # Währungs- und Datumsformatierung
│   ├── reportData.ts   # Shared Berechnungslogik (BurnRate, Steuer, Finanzübersicht)
│   ├── pdfReport.ts    # PDF-Berichtserstellung (pdfmake)
│   ├── pdfCharts.ts    # Server-side Chart-Rendering für PDF
│   ├── aiAnalyse.ts    # Claude CLI Integration (KI-Analyse)
│   ├── pdfExtract.ts   # PDF-Textextraktion (Lieferungen)
│   └── components/
│       ├── BuchungForm.svelte
│       ├── Charts.svelte
│       └── VerlaufSection.svelte
└── routes/
    ├── +page.svelte          # Dashboard
    ├── buchungen/            # Ausgaben (Liste, Neu, Bearbeiten)
    ├── rechnungen/           # Aufträge mit Abschlägen, Nachträgen, Timeline
    ├── lieferanten/          # Lieferanten-Übersicht und Detailseite
    ├── prognose/             # Prognose (Burn Rate, Budget-Erschöpfung)
    ├── belege/               # Dokumentenverwaltung mit Vorschau + Gruppierung
    ├── budget/               # Budget-Cards mit Ampel-Rand + Sortierung nach Status
    ├── gewerke/              # Gewerke-Cards mit Drag & Drop + Budget-Info
    ├── raeume/               # Räume-Cards nach Geschoss mit Drag & Drop + m²
    ├── steuer/               # §35a EStG Steuerauswertung + CSV-Export
    ├── bericht/              # Bauleiter-Bericht (PDF mit KI-Analyse)
    ├── einstellungen/        # Export / Import / Auto-Update
    └── api/                  # PDF-Bericht, PDF-Analyse, ZIP-Download
```

## NPM Scripts

```bash
npm run dev        # Dev-Server starten
npm run build      # Produktions-Build
npm run preview    # Produktions-Build vorschauen
npm run check      # TypeScript + Svelte prüfen
```

## Lizenz

Privates Projekt – kein offizieller Lizenzrahmen.
