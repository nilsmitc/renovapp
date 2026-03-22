# RenovApp – Kostenverfolgung für Renovierungsprojekte

## Was ist das?

SvelteKit-Webapp zur Kostenverfolgung eines Altbau-Umbaus. **Zwei Interfaces** auf dieselben JSON-Daten:
1. **Webapp** (SvelteKit) — Dateneingabe im Browser unter `http://localhost:5173`
2. **Claude Code** (CLI) — Analyse, Beratung, Bulk-Operationen via Read/Write auf JSON-Dateien

Starten: `cd ~/Altbau && ./start.sh` oder Doppelklick "RenovApp" im App-Menü.

---

## Datendateien

Alle Daten liegen in `/home/nils/Altbau/data/`:

| Datei | Inhalt | Wann lesen? |
|-------|--------|-------------|
| `summary.json` | Auto-generierte Zusammenfassung (~1-2 KB) | **Immer zuerst!** Spart Tokens |
| `projekt.json` | Stammdaten: Gewerke, Räume, Budgets | Bei Stammdaten-Fragen |
| `buchungen.json` | Alle Kostenbuchungen (wächst) | Nur bei Detail-/Filterfragen |
| `rechnungen.json` | Rechnungen mit Abschlägen und Nachträgen | Bei Rechnungsfragen |
| `lieferanten.json` | Lieferanten + Lieferungen (Händlerrechnungen) | Bei Lieferanten-/Materialfragen |
| `ai-analyse.json` | KI-Analyse für PDF-Bericht (von Claude Code geschrieben) | Bei "erstelle Analyse" / Bericht-Fragen |

**Wichtig:** `summary.json` wird automatisch bei jedem Schreibvorgang neu generiert (von der Webapp und manuell). Sie enthält Summen pro Gewerk, Gesamt-Ist/Budget, die letzten 5 Buchungen und offene Abschläge.

---

## Geldbeträge — CENTS (Integer)

**Alle Beträge sind Integer in Cents.** Niemals Floats verwenden!

| Cents | Bedeutung |
|-------|-----------|
| `234500` | 2.345,00 € |
| `50` | 0,50 € |
| `1000000` | 10.000,00 € |

Umrechnung: `Euro × 100 = Cents`. Also 3.000 € → `300000`.

---

## Datenformat im Detail

### IDs
- **Gewerke/Räume:** slugified Strings → `"elektro"`, `"bad-eg"`, `"fenster-tueren"`
- **Buchungen:** UUID v4 → `"d07ab890-61d1-45ef-86f9-72671e8e52d8"`
- Slugify-Regeln: Kleinbuchstaben, Umlaute → ae/oe/ue/ss, Sonderzeichen → Bindestrich

### Kategorien (exakt diese 3 Werte)
- `"Material"` — Baumaterial, Werkzeug, Verbrauchsmaterial
- `"Arbeitslohn"` — Handwerker, Dienstleistungen
- `"Sonstiges"` — Genehmigungen, Miete, Transport, etc.

### projekt.json
```json
{
  "gewerke": [
    { "id": "elektro", "name": "Elektro", "farbe": "#3B82F6", "sortierung": 1, "pauschal": true }
  ],
  "raeume": [
    { "id": "bad-eg", "name": "Bad", "geschoss": "EG", "sortierung": 2 }
  ],
  "budgets": [
    { "gewerk": "elektro", "geplant": 800000, "notiz": "" }
  ]
}
```

- `farbe`: Hex-Farbcode für Charts
- `sortierung`: Reihenfolge in Listen (0-basiert)
- `pauschal`: optional, `true` bei Sammelgewerken (GU die mehrere Gewerke abdecken) → unterdrückt Budget-Ampel
- `budgets[].gewerk`: Referenz auf `gewerke[].id`
- Jedes Gewerk hat genau einen Budget-Eintrag

### buchungen.json
```json
[
  {
    "id": "d07ab890-61d1-45ef-86f9-72671e8e52d8",
    "datum": "2026-02-14",
    "betrag": 300000,
    "gewerk": "sonstiges",
    "raum": null,
    "kategorie": "Arbeitslohn",
    "beschreibung": "Abschlagzahlung Schweizer Taschenmesserjungs",
    "rechnungsreferenz": "",
    "taetigkeit": "Fliesen Bad",
    "belege": ["rechnung.pdf"],
    "erstellt": "2026-02-14T18:06:59.500Z",
    "geaendert": "2026-02-14T18:06:59.500Z"
  }
]
```

- `betrag`: Integer in Cents. **Negativ bei Rückbuchungen** (`-5000` = −50,00 € Gutschrift)
- `taetigkeit`: optional, Freitext für Tätigkeitsbeschreibung; besonders bei Sammelgewerken z.B. `"Fliesen Bad"`, `"Dämmung Dach"` – erscheint in der Budget-Aufschlüsselung
- `lieferungId`: optional, gesetzt wenn Buchung auto-erstellt aus einer Lieferung
- `rechnungId`: optional, gesetzt wenn Buchung auto-erstellt aus bezahltem Abschlag
- `raum`: drei mögliche Werte:
  - `null` — kein Ort (allgemeine Kosten)
  - `"bad-eg"` etc. — Einzelraum-ID
  - `"@EG"` / `"@OG"` / `"@KG"` — Stockwerk-Buchung (Präfix `@`, Geschoss wird aus Räumen abgeleitet)
- `rechnungsreferenz`: optional, leerer String wenn nicht vorhanden
- `belege`: Array von Dateinamen, z.B. `["rechnung.pdf"]`. Leeres Array `[]` wenn keine Belege. Dateien liegen in `data/belege/{buchung-id}/`
- `datum`: ISO-Datumsstring `YYYY-MM-DD`
- `erstellt`/`geaendert`: ISO-Zeitstempel mit Zeitzone

### summary.json (auto-generiert)
```json
{
  "generiert": "2026-02-14T18:06:59.500Z",
  "gesamt": { "ist": 300000, "budget": 9800000 },
  "gewerke": [
    { "id": "elektro", "name": "Elektro", "ist": 0, "budget": 800000, "differenz": 800000, "anzahl": 0 }
  ],
  "raeume": [
    { "id": "bad-eg", "name": "Bad", "geschoss": "EG", "ist": 45000 }
  ],
  "letzteBuchungen": [
    { "datum": "2026-02-14", "betrag": 300000, "gewerk": "sonstiges", "beschreibung": "..." }
  ]
}
```

- `differenz`: `budget - ist` (positiv = unter Budget, negativ = über Budget)
- `raeume`: nur Räume mit `ist > 0` (Räume ohne Buchungen werden ausgelassen)
- `letzteBuchungen`: die 5 neuesten, sortiert nach Erstellungszeitpunkt

### lieferanten.json
```json
{
  "lieferanten": [
    { "id": "hornbach", "name": "Hornbach", "notiz": "Kundennr. 12345", "erstellt": "...", "geaendert": "..." }
  ],
  "lieferungen": [
    {
      "id": "uuid-v4",
      "lieferantId": "hornbach",
      "datum": "2026-02-20",
      "beschreibung": "Fliesen Bad EG",
      "rechnungsnummer": "RG-2026-001",
      "lieferscheinnummer": "LS-001",
      "betrag": 85000,
      "gewerk": "fliesen",
      "positionen": [
        { "beschreibung": "Bodenfliesen 30×30", "menge": "20 m²", "betrag": 60000 }
      ],
      "belege": ["rechnung.pdf"],
      "notiz": "",
      "buchungId": "uuid-der-auto-buchung",
      "erstellt": "...",
      "geaendert": "..."
    }
  ]
}
```

- `lieferant.id`: slugified Name (`"hornbach"`, `"bauhaus"`)
- `lieferung.betrag`: Rechnungsbetrag laut Händlerrechnung in Cents (optional); **negativ bei Gutschriften** (z.B. `-50503` = −505,03 € Gutschrift) → rot in der UI, Gesamtsumme wird korrekt reduziert
- `lieferung.gewerk`: Gewerk-Zuordnung für auto-Buchung (optional)
- `lieferung.buchungId`: Link zur auto-erstellten Buchung in `buchungen.json` — gesetzt sobald `betrag` + `gewerk` vorhanden sind
- `lieferung.positionen`: aus PDF extrahierte Einzelpositionen (optional, nur Info)
- **Auto-Buchung:** Sobald `betrag` + `gewerk` gesetzt sind, wird automatisch eine Buchung mit `kategorie = "Material"` in `buchungen.json` angelegt. Diese erscheint in Ausgaben und fließt ins Dashboard ein. Beim Bearbeiten wird synchronisiert; beim Löschen der Lieferung wird die auto-Buchung mitgelöscht.

---

## Claude Code: Daten lesen

### Schnellübersicht (empfohlen)
```
→ Read data/summary.json
```
Enthält: Gesamtkosten, Budget-Stand pro Gewerk, letzte 5 Buchungen. Reicht für die meisten Fragen.

### Detailabfragen
```
→ Read data/buchungen.json
```
Dann filtern/aggregieren nach Bedarf. Beispiele:
- Alle Buchungen eines Gewerks: `.filter(b => b.gewerk === "elektro")`
- Alle Buchungen eines Raums: `.filter(b => b.raum === "bad-eg")`
- Kosten pro Kategorie: gruppieren nach `kategorie`, Summe von `betrag`
- Zeitraum: filtern nach `datum`

### Stammdaten
```
→ Read data/projekt.json
```
Für: aktuelle Gewerke-Liste, Räume, Budget-Werte, Farben.

---

## Claude Code: Daten schreiben

Die Webapp liest bei **jedem Request** von der Platte (kein Cache). Änderungen über Claude Code sind sofort in der Webapp sichtbar (nach Seiten-Reload).

### Neue Buchung(en) eintragen
1. `Read data/buchungen.json`
2. Array um neue Einträge erweitern
3. **Pflichtfelder pro Buchung:**
   - `id`: neues UUID v4 generieren (z.B. `crypto.randomUUID()` Format)
   - `datum`: `"YYYY-MM-DD"`
   - `betrag`: Integer in Cents
   - `gewerk`: muss eine gültige Gewerk-ID sein
   - `raum`: gültige Raum-ID oder `null`
   - `kategorie`: exakt `"Material"`, `"Arbeitslohn"` oder `"Sonstiges"`
   - `beschreibung`: Freitext
   - `rechnungsreferenz`: String (kann leer sein `""`)
   - `erstellt`: ISO-Zeitstempel
   - `geaendert`: ISO-Zeitstempel (= erstellt bei neuen Einträgen)
4. `Write data/buchungen.json` (komplettes Array, formatiert)
5. **summary.json manuell aktualisieren** — wird nur automatisch von der Webapp aktualisiert, nicht bei direktem File-Write!

### Buchung bearbeiten
1. `Read data/buchungen.json`
2. Eintrag per `id` finden, Felder ändern, `geaendert` auf aktuelle Zeit setzen
3. `Write data/buchungen.json`

### Buchung löschen
1. `Read data/buchungen.json`
2. Eintrag per `id` rausfiltern
3. `Write data/buchungen.json`

### Budget ändern
1. `Read data/projekt.json`
2. In `budgets[]` den Eintrag mit passendem `gewerk` finden, `geplant` ändern
3. `Write data/projekt.json`

### Gewerk/Raum hinzufügen
1. `Read data/projekt.json`
2. Neuen Eintrag zu `gewerke[]` oder `raeume[]` hinzufügen
3. Bei neuem Gewerk: auch `budgets[]`-Eintrag anlegen (`geplant: 0`)
4. `Write data/projekt.json`

### Summary nach manuellem Schreiben aktualisieren
Da `summary.json` nur von der Webapp automatisch aktualisiert wird, nach direktem File-Write am besten:
- Entweder summary.json selbst neu berechnen und schreiben
- Oder einmal die Webapp aufrufen (beliebige Seite), das triggert bei Form-Actions die Neuberechnung

---

## Claude Code: Daten interpretieren

### Budget-Ampel
| Verbrauch | Bedeutung | Webapp-Farbe |
|-----------|-----------|-------------|
| < 80% | Im Rahmen | Grün |
| 80–100% | Aufpassen | Gelb |
| > 100% | Überschritten | Rot |

Berechnung: `ist / budget × 100`. Wenn `budget = 0`, keine Ampel.

### Differenz lesen
- `differenz > 0` → unter Budget (gut), z.B. `differenz: 500000` = noch 5.000 € übrig
- `differenz = 0` → Budget genau aufgebraucht
- `differenz < 0` → über Budget (schlecht), z.B. `differenz: -200000` = 2.000 € drüber

### Typische Analyse-Fragen und Antworten

**"Wie viel haben wir insgesamt ausgegeben?"**
→ `summary.json` → `gesamt.ist` (in Cents, ÷ 100 für Euro)

**"Wie steht Gewerk X?"**
→ `summary.json` → `gewerke[]` → Eintrag mit passender `id` → `ist`, `budget`, `differenz`

**"Welcher Raum ist am teuersten?"**
→ `summary.json` → `raeume[]` → nach `ist` sortieren

**"Aufschlüsselung Material vs. Arbeitslohn für Gewerk X?"**
→ `buchungen.json` → filtern nach `gewerk`, gruppieren nach `kategorie`, summieren `betrag`

**"Monatliche Ausgaben?"**
→ `buchungen.json` → gruppieren nach `datum` (Monat extrahieren), summieren

**"Welche Gewerke sind über Budget?"**
→ `summary.json` → `gewerke.filter(g => g.differenz < 0)`

**"Welche Gewerke sind Sammelgewerke?"**
→ `projekt.json` → `gewerke.filter(g => g.pauschal === true)`

**"Welche Tätigkeiten hat ein Sammelgewerk?"**
→ `buchungen.json` → filtern nach `gewerk`, gruppieren nach `taetigkeit`, summieren `betrag`

---

## Projektstruktur

```
Altbau/
├── data/                           # JSON-Daten (gemeinsam für Webapp + Claude Code)
│   ├── projekt.json                # Gewerke, Räume, Budgets
│   ├── buchungen.json              # Alle Buchungen (inkl. auto-erstellter)
│   ├── rechnungen.json             # Rechnungen mit Abschlägen und Nachträgen
│   ├── lieferanten.json            # Lieferanten + Lieferungen
│   ├── ai-analyse.json            # KI-Analyse (von Claude Code geschrieben)
│   ├── dokumente-texte.json       # Extrahierte PDF-Texte (von /api/dokumente-extrakt)
│   ├── email-scan-cache.json      # E-Mail-Import-Cache (Thunderbird-Scan)
│   ├── belege/                     # Beleg-Dateien pro Buchung
│   ├── rechnungen/                 # Belege pro Abschlag ({rechnungId}/{abschlagId}/)
│   ├── lieferungen/                # Belege pro Lieferung ({lieferungId}/)
│   ├── email-scan/                 # Gescannte E-Mail-Anhänge (PDFs)
│   └── summary.json                # Auto-generiert
├── src/
│   ├── lib/
│   │   ├── domain.ts               # Types, Factories, Validierung, Aggregation
│   │   ├── dataStore.ts            # JSON Datei-I/O (server-only, synchron)
│   │   ├── format.ts               # formatCents(), parseCentsFromInput(), formatDatum()
│   │   ├── pdfExtract.ts           # PDF-Textextraktion via pdf-parse v2 (für Lieferungen)
│   │   ├── pdfReport.ts            # PDF-Berichtserstellung (pdfmake, A4, 11 Abschnitte)
│   │   ├── pdfCharts.ts            # Server-side Chart-Rendering (chartjs-node-canvas → base64 PNG)
│   │   ├── reportData.ts           # Shared Berechnungslogik (Finanz, BurnRate, Steuer, Zahlungen)
│   │   ├── aiAnalyse.ts            # KI-Analyse lesen (leseAnalyse() → data/ai-analyse.json)
│   │   └── components/
│   │       ├── BuchungForm.svelte   # Wiederverwendbares Buchungs-Formular
│   │       ├── Charts.svelte        # Doughnut + Bar Chart (Chart.js)
│   │       └── VerlaufSection.svelte # Monatsverlauf-Component (Bar, Line, Tabelle) – im Dashboard eingebunden
│   └── routes/
│       ├── +page.svelte             # Dashboard (KPIs, Charts, Warnungen, Top-Raum, letzte Buchungen, Monatsverlauf)
│       ├── buchungen/
│       │   ├── +page.svelte         # Liste mit Filtern + Volltext-Suche
│       │   ├── neu/+page.svelte     # Neue Buchung
│       │   └── [id]/+page.svelte    # Bearbeiten/Löschen
│       ├── verlauf/
│       │   ├── +page.svelte         # Monatsverlauf (direkt erreichbar, aber nicht im Nav)
│       │   └── +page.server.ts      # Monats-Aggregation
│       ├── prognose/
│       │   ├── +page.svelte         # Prognose (Burn Rate, Budget-Erschöpfung, Gewerk-Hochrechnung)
│       │   └── +page.server.ts      # Prognose-Berechnung (Burn Rate, Chart-Datenpunkte, Tätigkeit-Summaries)
│       ├── lieferanten/
│       │   ├── +page.svelte         # Lieferanten-Übersicht (CRUD)
│       │   ├── +page.server.ts      # Lieferant anlegen/löschen
│       │   └── [id]/
│       │       ├── +page.svelte     # Lieferant-Detail: Lieferungen + Belege + Edit
│       │       └── +page.server.ts  # Actions: Lieferung CRUD + Beleg-Upload + syncBuchung
│       ├── lieferungen/[id]/[dateiname]/+server.ts  # Lieferungs-Belege ausliefern
│       ├── belege/[buchungId]/[dateiname]/+server.ts  # Buchungs-Belege ausliefern
│       ├── gewerke/+page.svelte     # Gewerke CRUD
│       ├── raeume/+page.svelte      # Räume CRUD (nach Geschoss gruppiert)
│       ├── budget/+page.svelte      # Budget-Tabelle mit Ampel + Inline-Edit + Notizen
│       ├── bericht/
│       │   ├── +page.svelte         # Bericht-Seite (PDF-Download mit KI-Option)
│       │   └── +page.server.ts      # Claude-Verfügbarkeit prüfen, Summary-Daten laden
│       ├── einstellungen/+page.svelte  # Export / Import / Auto-Update
│       └── api/
│           ├── bericht/+server.ts           # GET: PDF-Bericht (optional ?ai=true)
│           ├── export/+server.ts            # GET: ZIP-Download aller Daten
│           ├── pdf-analyse/+server.ts       # POST: PDF → Datum/Betrag/Rg-Nr./Positionen
│           ├── dokumente-extrakt/+server.ts # GET: PDF-Texte extrahieren → dokumente-texte.json
│           └── update-status/+server.ts     # GET: git fetch + Update-Verfügbarkeit prüfen
├── start.sh                         # Dev-Server mit Auto-Restart-Schleife + Browser öffnen
├── altbau-kosten.desktop            # Desktop-Shortcut
├── CLAUDE.md                        # Diese Datei
├── package.json
├── svelte.config.js
└── vite.config.ts
```

### Architektur-Kurzübersicht
- **Speicher:** JSON auf Platte (kein DB)
- **Server I/O:** Synchron (fs.readFileSync/writeFileSync) — Single-User, kleine Dateien
- **Mutations:** SvelteKit Form Actions (kein separater API-Layer)
- **Styling:** Tailwind CSS v4
- **Charts:** Chart.js (Doughnut für Kostenanteile, Bar für Budget vs. Ist, Bar für Monatsverlauf)
- **PDF-Bericht:** pdfmake 0.3.x (deklaratives JSON → PDF) + chartjs-node-canvas (server-side Chart-Rendering)
- **KI-Analyse:** Claude CLI (`claude -p`) als Subprozess — kein API-Key nötig, nutzt bestehende Auth
- **Node:** v22 via nvm (`source ~/.nvm/nvm.sh`)

### URL-Filter
Alle Filter funktionieren über URL-Parameter – kombinierbar, browser-back-fähig:
- `/buchungen?gewerk=elektro&raum=bad-eg&kategorie=Material&suche=Rechnung`
- `/buchungen?monat=2026-02` (vom Monatsverlauf-Link)
- `/buchungen?raum=@EG` — nur Stockwerk-Buchungen EG
- `/buchungen?geschoss=EG` — alle EG-Buchungen (Einzelräume + `@EG` kombiniert)

---

## Erweiterungen (22.03.2026) — Bericht, KI-Analyse, Auto-Update, Backup

### PDF-Bericht modernisiert
Komplette Überarbeitung des Bauleiter-Berichts (`pdfReport.ts`, ~700 Zeilen):
- **Deckblatt**: 8 KPIs statt 4 (+ Burn Rate 3-Mo., Fest eingeplant, Offene Rechnungen, Nächste Fälligkeit)
- **Fortschrittsbalken**: gestapelt (Bezahlt blau + Offen orange + Restauftrag violett) mit Legende
- **Budget-Tabelle**: 8 Spalten (Bezahlt/Offen/Restauftrag/Puffer/Frei/Status) statt 6
- **Neuer Stacked-Bar-Chart** (`renderBudgetStackedChart` in `pdfCharts.ts`): Budget vs. Bindung pro Gewerk
- **Sammelgewerk-Aufschlüsselung**: Tätigkeits-Breakdown nach Budget-Tabelle
- **Auftragsstatus**: Nachträge-Spalte (Ursprüngl./Nachträge/Gesamt) + Unterabschnitt "Nächste Zahlungen" (Top 10)
- **Steuer §35a**: Neuer konditionaler Abschnitt (pro Steuerjahr KPIs + Buchungstabelle)
- **Prognose**: 3-Monats-Burn-Rate, Simulation mit bekannten Zahlungsterminen, Gewerk-Prognose-Tabelle
- **Lieferanten**: Zahlungsart-Spalte ergänzt

### Shared Berechnungslogik (`reportData.ts`)
Neue Datei `src/lib/reportData.ts` — extrahierte Logik aus Dashboard, Prognose, Steuer:
- `berechneFinanzuebersicht()` → offen/restauftrag/puffer/frei pro Gewerk
- `berechneNaechsteZahlungen()` → sortierte offene Abschläge
- `berechneMonatsDaten()` + `berechneBurnRate()` → 3-Monats-Rolling-Average
- `berechneSteuerDaten()` → §35a pro Jahr
- Genutzt von: `+page.server.ts` (Dashboard), `steuer/+page.server.ts`, `pdfReport.ts`

### KI-Analyse mit Dokumenten-Extraktion
- **Neuer Endpoint**: `GET /api/dokumente-extrakt` — extrahiert Text aus allen Angebots-/Rechnungs-PDFs via `extrahierePdfDaten()`, schreibt `data/dokumente-texte.json`
- **Button auf `/bericht`**: "Dokumente für KI-Analyse vorbereiten" mit Status-Anzeige
- **Neues Analyse-Feld**: `dokumentenAnalyse?: string` in `BauAnalyse`-Interface
- **PDF-Bericht**: zeigt "Dokumentenanalyse"-Abschnitt im KI-Teil (falls vorhanden)
- **CLAUDE.md**: Anweisungen für Analyse erweitert (Angebots-Positionen, Zahlungsbedingungen, Förder-Klauseln, Angebot-vs-Rechnung)

### Auto-Update-Mechanismus
- **`start.sh`**: Server läuft im Hintergrund, Shell-Schleife überwacht Marker-Datei `.restart-after-update` (1-Sekunden-Poll). Bei Marker → Server-Prozessbaum killen → npm install falls nötig → Neustart
- **`GET /api/update-status`**: `git fetch` + Vergleich HEAD vs. origin/master, Commit-Liste
- **`POST /einstellungen?/update`**: `git stash` → `git pull` → `git stash pop` → Marker schreiben
- **UI auf `/einstellungen`**: 4 Zustände (nicht geprüft → aktuell → Update verfügbar → Neustart läuft), Auto-Reload mit Retry-Logik
- **Versionsanzeige**: Git-Commit-Hash unten auf Einstellungen-Seite

### Backup aktualisiert
- **Export ergänzt**: `email-scan-cache.json` + `email-scan/`-Verzeichnis
- **Import-Bug behoben**: `dokumente-texte.json` wurde exportiert aber nicht wiederhergestellt
- **Import ergänzt**: `dokumente-texte.json` + `email-scan-cache.json` + `email-scan/`-Verzeichnis

---

## Erweiterungen (23.02.2026) — Dashboard & Aufträge

### Dashboard: Verplante Kosten in Gewerke-Übersicht
- Gewerke-Übersicht zeigt jetzt neben `ist` und `budget` auch die **verplanten Kosten** aus Aufträgen
- Verplant = ausstehende Abschläge (offen/überfällig) + gebundene Mittel (Vertragssumme nicht fakturiert) — pro Gewerk aufgeschlüsselt
- Gestapelter Fortschrittsbalken: blau (bezahlt) + violett (`violet-500`, Dark-Reader-tauglich) für verplant
- Legende im Header; `+ X,XX € verplant`-Anzeige in amber/violett (nur wenn > 0)
- Berechnung: `verplantPerGewerk: Record<string, number>` in `+page.server.ts`

### Aufträge: Zahlungsfrist-Tracking & Frühwarnung
- Neue Felder auf `Abschlag`: `eingangsdatum?: string` + `zahlungsziel?: number`
- Formular berechnet `faelligkeitsdatum` automatisch aus `eingangsdatum + zahlungsziel` (JS, überschreibbar)
- Neuer computed Status `bald_faellig`: Fälligkeit innerhalb 7 Tage → amber-Badge + Countdown
- Dashboard-KPI „Ausstehend" hat 3 Zustände: orange (offen) → amber (bald fällig) → rot (überfällig)
- `abschlagEffektivStatus()` in `domain.ts` entsprechend erweitert

### Aufträge: Inline-Bearbeitung von Abschlägen
- Bleistift-Button in jeder Abschlag-Zeile (auch bei bezahlten Abschlägen)
- Klappt inline als blaue Zeile auf (analog zu Bezahlen-Formular)
- Editierbare Felder: Rechnungsnummer, Rechnungseingang, Zahlungsziel, Fälligkeit, Notiz
- Nicht editierbar: Typ, Betrag, Status, Bezahlt-Datum (Zahlungshistorie bleibt unverändert)
- Neue Server-Action: `abschlagBearbeiten` in `rechnungen/[id]/+page.server.ts`

---

## Erweiterungen (21.02.2026) — Bauleiter-Bericht

### PDF-Bericht mit KI-Analyse (`/bericht`)
Professioneller PDF-Bericht für den Bauleiter mit allen Finanzdaten, Charts und optionaler KI-Einschätzung.

**Technische Umsetzung:**
- `pdfmake` 0.3.x: deklaratives JSON → PDF (A4 Portrait, Roboto-Schrift aus vfs_fonts als base64-Buffer)
- `chartjs-node-canvas`: Chart.js server-side → base64 PNG (800×400px, `animation: false`)
- KI-Analyse: datei-basiert via `data/ai-analyse.json` (von Claude Code geschrieben, von der Webapp gelesen)
- API: `GET /api/bericht` (ohne KI) / `GET /api/bericht?ai=true` (mit KI aus Datei)

**PDF-Inhalt (8–10 Seiten):**
1. **Deckblatt** — Kernzahlen (Budget, Ausgaben, Verbleibend, %), Fortschrittsbalken
2. **KI-Einschätzung** (nur mit `?ai=true`) — Zusammenfassung, Risikobewertung, Cashflow, Empfehlungen
3. **Budget-Übersicht** — Doughnut + Bar Chart (volle Breite), Gewerk-Tabelle mit Ampel-Farben
4. **Kategorien-Analyse** — Doughnut (Material/Arbeitslohn/Sonstiges) + Stacked Bar nach Gewerk
5. **Kosten nach Raum** — Tabelle gruppiert nach Geschoss
6. **Auftragsstatus** — Tabelle mit offenen/überfälligen Rechnungen, Status: Überfällig/Offen/Ausstehend/Teilw. bezahlt/Bezahlt
7. **Monatsverlauf** — Bar + Linienchart (volle Breite), Monatstabelle
8. **Prognose** — Burn Rate, Erschöpfungsdatum, Prognose-Linienchart, Gewerk-Hochrechnung
9. **Lieferanten-Übersicht** — Tabelle mit Anzahl Lieferungen und Gesamtbeträgen

**Dateien:**
- `src/lib/pdfReport.ts` — PDF-Dokumentaufbau (pdfmake docDefinition, 9 Abschnitte)
- `src/lib/pdfCharts.ts` — 7 Chart-Render-Funktionen (portiert aus Charts.svelte/VerlaufSection.svelte)
- `src/lib/aiAnalyse.ts` — `leseAnalyse()`, `BauAnalyse`-Interface, `BauAnalyseDatei`-Interface
- `src/routes/api/bericht/+server.ts` — GET-Endpoint, liest Analyse-Datei, liefert PDF
- `src/routes/bericht/+page.svelte` — UI mit Projektinfo, KI-Checkbox, Download-Button
- `src/routes/bericht/+page.server.ts` — Prüft ob Analyse-Datei existiert, lädt Summary-Daten

**Hinweise zu pdfmake 0.3.x:**
- Import: `import PdfPrinter from 'pdfmake/js/Printer'` (nicht aus Haupt-Entry)
- Konstruktor: `new PdfPrinter.default(fonts)` (nicht `new PdfPrinter(fonts)`)
- Fonts: `Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64')` (nicht Dateipfade)
- `createPdfKitDocument()` ist async (returns Promise) — `await` nötig

---

## Claude Code: Bauleiter-Analyse erstellen

Wenn der User sagt "erstelle Bauleiter-Analyse", "analysiere die Baudaten", "aktualisiere die KI-Analyse" oder ähnlich:

### Schritt 1: Daten lesen
```
→ Read data/summary.json          ← Immer zuerst (Gesamtübersicht)
→ Read data/rechnungen.json       ← Aufträge mit Abschlägen, offene Beträge
→ Read data/buchungen.json        ← Detail-Buchungen für Zeitreihen, Kategorien
→ Read data/lieferanten.json      ← Lieferanten und Materialkosten
→ Read data/projekt.json          ← Gewerke, Räume, Budgets (Stammdaten)
→ Read data/dokumente-texte.json  ← Extrahierte Texte aus Angeboten/Rechnungsbelegen (falls vorhanden)
```

**Dokumente-Texte:** Die Datei `data/dokumente-texte.json` enthält die aus PDFs extrahierten Volltexte aller hinterlegten Angebote und Rechnungsbelege. Sie wird über den Button "Dokumente vorbereiten" auf `/bericht` erzeugt. Falls die Datei nicht existiert, die Analyse ohne Dokumententexte erstellen.

### Schritt 2: Analysieren als erfahrener Bauleiter/Baukostenberater
- Konkrete Zahlen und Eurobeträge nennen
- Prozentsätze und Vergleiche (Budget vs. Ist)
- Trends erkennen (Burn Rate, Monatsentwicklung)
- Risiken identifizieren (Gewerke nahe/über Budget, große offene Aufträge)
- Cashflow bewerten (offene Rechnungen, gebundene Mittel, Zahlungstermine)

**Falls Dokumententexte vorhanden, zusätzlich prüfen:**
- **Angebots-Positionen**: Optionale Leistungen ("Bedarf", "auf Wunsch"), Aufpreise, Alternativpositionen
- **Zahlungsbedingungen**: Skonto-Fristen, Zahlungsziele, Vorauszahlungen
- **Förder-Klauseln**: KfW, BAFA, aufschiebende Bedingungen, Förderfähigkeit
- **Angebot vs. Rechnung**: Abweichungen zwischen Angebotssumme und tatsächlichen Abrechnungen erkennen
- **Vertragliche Risiken**: Pauschalpreise vs. Aufmaß, Nachtragsklauseln, fehlende Leistungsbeschreibungen

### Schritt 3: Datei schreiben
```
→ Write data/ai-analyse.json
```

**Exaktes JSON-Format** (die Webapp liest diese Struktur):
```json
{
  "erstellt": "2026-02-21T18:30:00.000Z",
  "analyse": {
    "zusammenfassung": "3-5 Sätze zum aktuellen Projektstatus mit konkreten Zahlen. Budget, Ausgaben, Verbrauch in %, Burn Rate, wie viele Gewerke aktiv.",
    "risikobewertung": "Welche Gewerke sind kritisch? Wo drohen Budgetüberschreitungen? Konkrete Zahlen und Prozente. Große unbezahlte Aufträge benennen.",
    "cashflowBewertung": "Offene Rechnungen beziffern, gebundene Mittel, Zahlungstermine, Liquiditätsprognose. Burn Rate und Restbudget-Reichweite.",
    "empfehlungen": [
      "Erste konkrete Empfehlung mit Zahlen",
      "Zweite konkrete Empfehlung",
      "Dritte konkrete Empfehlung",
      "Weitere falls nötig"
    ],
    "dokumentenAnalyse": "Optional: Erkenntnisse aus Angeboten und Rechnungsbelegen. Einzelpositionen, optionale Leistungen, Zahlungsbedingungen, Förder-Klauseln, Abweichungen Angebot↔Rechnung. Nur wenn dokumente-texte.json vorhanden war."
  }
}
```

**Wichtig:**
- `erstellt`: aktueller ISO-Timestamp (`new Date().toISOString()`)
- `zusammenfassung`: Fließtext, 3-5 Sätze
- `risikobewertung`: Fließtext, Gewerke mit % und €-Beträgen
- `cashflowBewertung`: Fließtext, offene Beträge, Termine, Reichweite
- `empfehlungen`: Array von Strings, jede Empfehlung ein eigener Eintrag, 3-6 Stück
- `dokumentenAnalyse`: optional, Fließtext mit Erkenntnissen aus den extrahierten Dokumenten (nur wenn `data/dokumente-texte.json` gelesen wurde)
- Alle Felder außer `dokumentenAnalyse` sind Pflicht, alle müssen nicht-leere Strings/Arrays sein
- Die Webapp zeigt diese Daten 1:1 im PDF an — Qualität zählt

### Schritt 4: User informieren
> "Analyse geschrieben. PDF unter `/bericht` herunterladen — die KI-Checkbox ist jetzt automatisch aktiv."

---

## Erweiterungen (20.02.2026) — Lieferanten

### Lieferanten + Lieferungen (`/lieferanten`)
Neues Feature: Materialeinkäufe bei Händlern (Hornbach, Bauhaus etc.) erfassen.
- Lieferant anlegen (Name slugified als ID) + Notiz/Kundennummer
- Lieferungen pro Lieferant: Datum, Beschreibung, Betrag, Gewerk, Rechnungs-/Lieferscheinnummer
- Beleg-Upload pro Lieferung (PDF/JPG/PNG, max 10 MB), secure Fileserver unter `/lieferungen/[id]/[datei]`
- **Auto-Buchung**: Sobald `betrag` + `gewerk` gesetzt → Buchung in `buchungen.json` (kategorie = `"Material"`) → erscheint in Ausgaben + Dashboard. `lieferung.buchungId` ↔ `buchung.lieferungId` verknüpfen bidirektional.
- **syncLieferungBuchung()**: Helper in `[id]/+page.server.ts` — erstellt/aktualisiert/löscht die auto-Buchung bei jeder Mutation
- Badge "In Ausgaben" (grün) wenn buchungId gesetzt, "Kein Gewerk – nicht in Ausgaben" (gelb) wenn betrag aber kein gewerk
- Löschen der Lieferung löscht auto-Buchung mit; manuell verknüpfte Buchungen (lieferungId gesetzt, aber nicht die auto-Buchung) blockieren Löschen
- **PDF-Extraktion**: Beleg-Upload → POST `/api/pdf-analyse` → KI-gestützte Extraktion von Datum, Betrag, Rg.-Nr., Einzelpositionen (via pdf-parse v2 + Regex-Heuristik)
- Neue Datei: `data/lieferanten.json` mit `{ lieferanten: [], lieferungen: [] }`
- Neue Dateipfade: `data/lieferungen/{lieferungId}/datei`

### Ausgaben — Herkunft Lieferung
- Filter `herkunft`: ergänzt um `aus Lieferung`
- Badge "Lieferant" auf auto-erstellten Zeilen (klickbar → Lieferant-Detailseite)

---

## Erweiterungen (20.02.2026) — Rechnungen

### Rechnungen + Abschläge (`/rechnungen`)
Neues Feature: Auftragnehmer-Rechnungen mit mehreren Abschlagszahlungen. Datenmodell:
- `Rechnung` → mehrere `Abschlag[]` → Bezahlen auto-erstellt `Buchung` mit `rechnungId`-Link
- `Abschlag.typ`: `'abschlag' | 'schlussrechnung' | 'nachtragsrechnung'`
- `Abschlag.status` (gespeichert): `'ausstehend' | 'offen' | 'bezahlt'`; computed via `abschlagEffektivStatus()`: `'bald_faellig'` (offen + ≤7 Tage) / `'ueberfaellig'` (offen + Fälligkeit überschritten)
- `Abschlag.eingangsdatum?: string` — Rechnungseingang (YYYY-MM-DD)
- `Abschlag.zahlungsziel?: number` — Zahlungsfrist in Tagen; zusammen mit `eingangsdatum` auto-berechnet `faelligkeitsdatum`
- Beleg-Upload pro Abschlag; secure Dateiserver unter `/rechnungen/[id]/[abschlagId]/[datei]`
- Neue Datei: `data/rechnungen.json`

### Nachträge auf Rechnungen
- `Nachtrag` = genehmigter Mehraufwand (Change Order), getrennt vom Zahlungsvorgang
- `Rechnung.nachtraege[]` mit Beschreibung + Betrag + optionalem Datum/Notiz
- Gesamtauftrag = `auftragssumme + Σnachtraege` → Basis für Fortschrittsbalken
- CRUD auf Rechnungs-Detailseite

### Ausgaben (ehemals Buchungen)
- Nav-Label "Buchungen" → "Ausgaben"
- `Buchung.rechnungId?: string` — gesetzt wenn auto-erstellt aus bezahltem Abschlag
- Herkunft-Filter: `[Alle] [Direkt] [Aus Rechnung]`
- Rechnung-Badge mit Backlink auf auto-erstellten Zeilen

### Prognose: Gebundene Mittel
- Offene Abschläge aus Rechnungen als "gebundene Mittel" sichtbar
- Neue KPI-Karte (orange, nur wenn > 0) + "nach Bindung"-Subtext im Restbudget-KPI
- Neue Spalte "Gebunden" in der Gewerk-Prognose-Tabelle

### Datumsformat-Fix
- `format.ts:formatDatum()` nutzt jetzt String-Slicing statt `toLocaleDateString('de-DE')` (ICU-unabhängig)

---

## Erweiterungen (19.02.2026)

### Prognose-Seite (`/prognose`)
Neue Seite mit Burn-Rate-Projektion, Budget-Erschöpfungsdatum, Linienchart (Ist + Prognose + Budget) und Gewerk-Hochrechnungstabelle. Konfidenz-Banner warnt bei geringer Datenbasis.

### Sammelgewerk-Konzept
Gewerke können als `pauschal: true` markiert werden (Checkbox in `/gewerke`). Auswirkungen:
- Dashboard: kein Budget-Alarm für dieses Gewerk
- Budget-Seite: "Sammelgewerk"-Badge statt Ampel; Tätigkeit-Aufschlüsselung eingeklappt
- Prognose-Seite: "Sammelgewerk"-Badge statt Risikoampel

### Tätigkeit-Feld auf Buchungen
Neues optionales Feld `taetigkeit?: string` auf jeder Buchung. Im Buchungsformular unter "Beschreibung", max. 80 Zeichen. Erscheint in der Buchungsliste kursiv als Subtext. Sammelgewerke zeigen Hinweis-Text wenn aktiv.

---

## UI-Verbesserungen (17.02.2026)

### Visuelles Aufhübschen
**Durchgeführt von:** software-team-lead → frontend-ui-craftsman

**Styling (app.css + alle Routes):**
- Sticky Navigation mit Shadow, aktiver Zustand: `bg-blue-600 text-white`
- Neue Utility-Klassen: `.card`, `.thead-row` für konsistentes Tabellen-/Card-Styling
- KPI-Labels: `uppercase tracking-wide text-xs`
- Zahlen mit `tabular-nums`, Fortschrittsbalken mit `transition-all duration-500`

**Icons (Heroicons 24 Outline, Inline-SVG, keine neue Dependency):**
- Seitenheader auf jeder Seite, KPI-Karten, Buttons (Plus/Check/X/Trash/Pencil/Download/Upload)
- Alerts (Warn-Dreieck/X-Kreis/Check-Kreis), Statusbadges Planung (Clock/Play/Check)
- Suchfeld (Lupe), Empty States

**Unicode-Fix:**
- Agent hatte `\u00fc` statt `ü` etc. in Svelte-HTML-Templates geschrieben
- In HTML-Template-Kontext werden `\uXXXX`-Escapes nicht interpretiert → sichtbar als Rohtext
- Fix: Python `re.sub(r'\\u([0-9a-fA-F]{4})', ...)` über 9 betroffene `.svelte`-Dateien

---

## Code-Qualität & bekannte Einschränkungen

### Behobene Sicherheitsprobleme (15.02.2026)
| Datei | Problem | Fix |
|-------|---------|-----|
| `belege/[buchungId]/[dateiname]/+server.ts` | Path Traversal – Dateiname nicht gegen `buchung.belege` validiert | Whitelist-Check + RFC-konformer Content-Disposition Header |
| `format.ts:10` | `replace('.')` ersetzte nur ersten Tausenderpunkt | `replaceAll('.')` |
| `dataStore.ts` | `JSON.parse()` ohne try-catch | try-catch mit klarer Fehlermeldung |
| `buchungen/neu/+page.server.ts` | File-Upload ohne Größen-/Typ-Limit | Max 10 MB, Whitelist: PDF/JPG/PNG |
| `BuchungForm.svelte:121` | `target="_blank"` ohne `rel="noopener noreferrer"` | Attribut ergänzt |
| `buchungen/+page.svelte:20` | `window.location.search` direkt (SSR-crash) | SSR-sicherer Guard |
| `budget/+page.server.ts` | Gewerk-ID und `parseCentsFromInput` nicht validiert | Existenz-Check + NaN-Check |

### Behobene Bugs (15.02.2026 – zweiter Review)
| Datei | Problem | Fix |
|-------|---------|-----|
| `buchungen/+page.server.ts` | `rechnungsreferenz` crash bei null in Suche | `?? ''` Fallback |
| `buchungen/+page.svelte` | Suche feuerte erst beim Blur | `oninput` statt `onchange` |
| `verlauf/+page.svelte` | `gesamt` nicht reaktiv (Svelte 5) | `$derived()` |
| `budget/+page.svelte` | Notiz-Feld hatte kein `value` (wurde beim Speichern geleert) | `value={data.notizen[...]}` |

### Bekannte offene Punkte (nicht kritisch)
- Keine Loading-States während Form-Submissions
- `confirm()` in Gewerke/Räume nicht barrierefrei (kein Keyboard-Support)
- Mehrere fehlende `aria-label` Attribute (Accessibility)
- `gewerke/+page.server.ts` validiert Hex-Farbe nicht
- `buchungen/[id]/+page.svelte` nutzt `(form as any)` Cast
- Keine Audit-Logs bei Mutationen

---

## Features (Stand 22.03.2026, aktualisiert)

### Dashboard (`/`)
- KPI-Karten (je nach Datenlage 4–8): Budget · Ausgaben · Verbleibend · Verbraucht% · Top-Raum (klickbar) · **Ausstehend/Bald fällig/Überfällig** (3 Zustände: gelb/amber/rot) · **Gebunden** (Vertragssummen noch nicht fakturiert, blau) · **Burn Rate** (Ø/Monat + Hochrechnung Restbudget)
- Budget-Warnungen: gelbe/rote Badges für Gewerke ≥80% (nur sichtbar wenn relevant)
- Charts (alle klickbar → navigieren zu gefilterten Buchungen):
  - Doughnut: Kostenanteile nach Gewerk
  - Bar: Budget vs. Ausgaben nach Gewerk
  - Doughnut: Kostenverteilung nach Kategorie (Material / Arbeitslohn / Sonstiges)
  - Gestapelter Balken: Kategorien nach Gewerk
- Letzte Buchungen (10 Einträge)
- **Gewerke-Übersicht** mit gestapeltem Fortschrittsbalken (blau = bezahlt, violett = verplant aus Aufträgen) + Legende; `+ X verplant`-Anzeige pro Gewerk
- **Monatsverlauf** direkt integriert (via `VerlaufSection.svelte`): Balken-Chart + Linien-Chart + Tabelle

### Ausgaben (`/buchungen`)
- Volltext-Suche in Beschreibung + Rechnungsreferenz
- Filter: Gewerk, Raum, Kategorie, Herkunft (Direkt / Aus Rechnung / Aus Lieferung), Geschoss (kombinierbar, URL-Parameter)
- CRUD: Erstellen, Bearbeiten, Löschen
- **Rückbuchungen**: Checkbox im Formular → negativer `betrag`, rot markiert in Liste
- **Flexible Ortzuordnung**: Einzelraum, Stockwerk (`@EG`) oder kein Ort
- Belege anhängen (PDF/JPG/PNG, max 10 MB)
- Sortierung: neueste Buchungen oben; letztes Gewerk wird vorausgefüllt
- Rechnung-Badge auf auto-erstellten Einträgen (klickbar → Rechnungs-Detailseite)

### Prognose (`/prognose`)
- Konfidenz-Banner: Hinweis auf Datenbasis (Anzahl Monate / Buchungen)
- KPI-Karten: Burn Rate · Budget-Erschöpfungsdatum · Restbudget (inkl. "nach Bindung") · Bisherige Ausgaben · **Gebundene Mittel** (offene Abschläge, nur wenn > 0)
- Linienchart: historische Ist-Kurve (blau) + Prognose-Verlängerung gestrichelt (orange) + Budget-Deckellinie (rot)
- Gewerk-Prognose-Tabelle: proportionale Hochrechnung + **Gebunden**-Spalte (offene Abschläge je Gewerk)

### Budget (`/budget`)
- Übersicht: Budget vs. Ist pro Gewerk mit Ampel-Farben
- Inline-Edit: Budget-Betrag + Notiz pro Gewerk
- **Sammelgewerke** (`pauschal: true`): kein Ampel-Badge, stattdessen "Sammelgewerk"-Badge + ausgeklappte Tätigkeit-Aufschlüsselung (gruppiert nach `taetigkeit`-Feld der Buchungen)

### Belege (`/belege`)
- Übersicht **aller** hochgeladenen Dokumente aus allen 3 Quellen:
  - Buchungs-Belege (`data/belege/{buchungId}/`) → Link zu Buchung bearbeiten
  - Abschlag-Belege (`data/rechnungen/{rId}/{aId}/`) → Link zu Auftrags-Detail
  - Lieferungs-Belege (`data/lieferungen/{lId}/`) → Link zu Lieferant-Detail
- Typ-Badge (Buchung / Abschlag / Lieferung) auf jeder Karte
- Filter nach Gewerk; direkter Download/Anzeige per Link

### Gewerke & Räume (`/gewerke`, `/raeume`)
- CRUD für Stammdaten
- Räume gruppiert nach Geschoss
- Gewerke: Checkbox **"Sammelgewerk – kein Budget-Alarm"** (`pauschal: true`) für GU die mehrere Gewerke abdecken

### Aufträge (`/rechnungen`)
- Auftragnehmer-Rechnungen mit mehreren **Abschlägen** (Abschlagszahlungen, Schlussrechnung, Nachtrag)
- **Nachträge**: genehmigte Mehraufwände (Change Orders) separat von Zahlungsvorgängen
- Bezahlen eines Abschlags → auto-erstellt Buchung mit Link (`rechnungId`)
- Beleg-Upload pro Abschlag (PDF/JPG/PNG, max 10 MB)
- Abschlag-Status: `ausstehend` / `offen` / `bezahlt`; computed: `bald_faellig` (≤7 Tage, amber) / `ueberfaellig` (rot)
- **Zahlungsfrist-Tracking**: `eingangsdatum` + `zahlungsziel` (Tage) → `faelligkeitsdatum` wird automatisch berechnet, manuell überschreibbar
- **Countdown** in der Abschlag-Tabelle: „in X Tagen" bei offenen/bald fälligen Abschlägen
- **Inline-Bearbeitung** bestehender Abschläge (Rg.-Nr., Eingang, Zahlungsziel, Fälligkeit, Notiz) über Bleistift-Button
- Fortschrittsbalken: Basis = Auftragssumme + Σ Nachträge
- Nav-Label: **"Aufträge"** (URL bleibt `/rechnungen`)

### Ausgaben (`/buchungen`) — Herkunfts-Filter
- Alle Buchungen inkl. auto-erstellter aus Rechnungen und Lieferungen
- Filter `herkunft`: `direkt` / `aus Rechnung` / `aus Lieferung` — unterscheidet manuelle von auto-Buchungen
- Badge "📄 Rechnung" auf Zeilen aus Rechnungen (klickbar → Rechnung)
- Badge "Lieferant" auf Zeilen aus Lieferungen (klickbar → Lieferant-Detailseite)

### Lieferanten (`/lieferanten`)
- Händler (Hornbach, Bauhaus etc.) anlegen mit Name + optionaler Notiz/Kundennummer
- Lieferungen pro Lieferant mit Datum, Beschreibung, Betrag, Gewerk, Rg.-/Lieferscheinnummer
- Beleg-Upload pro Lieferung (PDF/JPG/PNG) + **automatische PDF-Extraktion** (Datum, Betrag, Rg.-Nr., Positionen)
- **Gutschriften**: Checkbox "Gutschrift / Rückbuchung" → negatives `betrag`, rot markiert, Gesamtsumme wird korrekt reduziert
- Auto-Buchung: sobald `betrag` + `gewerk` vorhanden → Buchung in Ausgaben + Dashboard; bei Gutschriften negative Buchung
- Badge "In Ausgaben" (grün) / "Kein Gewerk" (gelb) zeigt Buchungs-Status je Lieferung
- Inline-Bearbeitung bestehender Lieferungen

### Bauleiter-Bericht (`/bericht`)
- Professioneller PDF-Bericht mit allen Finanzdaten und Charts (10–14 Seiten)
- **Deckblatt**: 8 KPIs (Budget, Ausgaben, Frei verfügbar, Verbraucht%, Fest eingeplant, Burn Rate 3-Mo., Offene Rechnungen, Nächste Fälligkeit) + gestapelter Fortschrittsbalken (Bezahlt/Offen/Restauftrag)
- **Budget-Übersicht**: Erweiterte Tabelle (Bezahlt/Offen/Restauftrag/Puffer/Frei/Status) + Stacked-Bar-Chart (Budget vs. Bindung) + Sammelgewerk-Aufschlüsselung nach Tätigkeit
- **Auftragsstatus**: Nachträge-Spalte (Ursprüngl./Nachträge/Gesamt) + **Nächste Zahlungen** (Top 10 mit Countdown und Farbmarkierung)
- **Steuer §35a** (konditional): Pro Steuerjahr KPIs + Buchungstabelle (nur wenn steuerrelevante Buchungen vorhanden)
- **Prognose**: 3-Monats-Burn-Rate (statt Gesamtdurchschnitt), Simulation mit bekannten Zahlungsterminen, Gewerk-Prognose-Tabelle
- **KI-Analyse** (optional): Claude Code schreibt Analyse nach `data/ai-analyse.json`, Webapp liest sie ein
- **Dokumentenanalyse** (optional): Neues Feld `dokumentenAnalyse` — Erkenntnisse aus extrahierten Angebots-/Rechnungs-PDFs
- **Dokumenten-Vorbereitung**: Button extrahiert Text aus allen hinterlegten PDFs → `data/dokumente-texte.json`
- 7 server-side gerenderte Charts + Stacked-Bar-Chart für Budget-Bindung
- Download als `bauleiter-bericht-YYYY-MM-DD.pdf`
- Shared Berechnungslogik in `src/lib/reportData.ts` (genutzt von Dashboard, Prognose, Steuer und PDF-Bericht)

### Einstellungen (`/einstellungen`)
- **Auto-Update**: Button "Nach Updates suchen" prüft via `git fetch` auf neue Commits; "Jetzt aktualisieren" → `git pull` + automatischer Server-Neustart via `start.sh`-Überwachungsschleife + Auto-Reload im Browser
- **Export**: ZIP-Download mit allen Daten (projekt.json, buchungen.json, rechnungen.json, lieferanten.json, ai-analyse.json, dokumente-texte.json, email-scan-cache.json, alle Belege inkl. email-scan/)
- **Import**: ZIP hochladen → vollständiges Restore (ersetzt alle Daten, inkl. dokumente-texte.json und E-Mail-Scan-Cache)
- **Versionsanzeige**: Git-Commit-Hash unten auf der Seite
