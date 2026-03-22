# RenovApp – Kostenverfolgung für Renovierungsprojekte

SvelteKit-Webapp zur Kostenverfolgung eines Altbau-Umbaus. Zwei Interfaces auf dieselben JSON-Daten:
1. **Webapp** — Dateneingabe im Browser unter `http://localhost:5173`
2. **Claude Code** — Analyse, Beratung, Bulk-Operationen via Read/Write auf JSON-Dateien

Starten: `cd ~/Altbau && ./start.sh`

---

## Datendateien (`data/`)

| Datei | Inhalt | Wann lesen? |
|-------|--------|-------------|
| `summary.json` | Auto-generierte Zusammenfassung | **Immer zuerst!** Spart Tokens |
| `projekt.json` | Gewerke, Räume, Budgets | Bei Stammdaten-Fragen |
| `buchungen.json` | Alle Kostenbuchungen | Nur bei Detail-/Filterfragen |
| `rechnungen.json` | Rechnungen mit Abschlägen und Nachträgen | Bei Rechnungsfragen |
| `lieferanten.json` | Lieferanten + Lieferungen | Bei Lieferanten-/Materialfragen |
| `ai-analyse.json` | KI-Analyse für PDF-Bericht | Bei "erstelle Analyse" / Bericht-Fragen |
| `dokumente-texte.json` | Extrahierte PDF-Texte | Bei Dokumenten-Analyse |

`summary.json` wird bei jedem Webapp-Schreibvorgang neu generiert, **nicht** bei direktem File-Write durch Claude Code.

---

## Geldbeträge — CENTS (Integer)

**Alle Beträge sind Integer in Cents. Niemals Floats!**
`234500` = 2.345,00 € · `300000` = 3.000,00 € · Umrechnung: `Euro × 100`
Negativ bei Rückbuchungen/Gutschriften.

---

## Datenformat

### IDs
- **Gewerke/Räume:** slugified → `"elektro"`, `"bad-eg"`, `"fenster-tueren"` (Umlaute → ae/oe/ue/ss)
- **Buchungen:** UUID v4

### Kategorien (exakt diese 3)
`"Material"` · `"Arbeitslohn"` · `"Sonstiges"`

### buchungen.json – Felder
```
id (UUID v4), datum (YYYY-MM-DD), betrag (cents, negativ = Rückbuchung),
gewerk, raum, kategorie, beschreibung, rechnungsreferenz ("" wenn leer),
taetigkeit? (optional, für Sammelgewerke), belege ([] oder ["datei.pdf"]),
erstellt, geaendert (ISO-Timestamps),
lieferungId? / rechnungId? (gesetzt bei auto-erstellten Buchungen)
```
- `raum`: `null` | `"bad-eg"` | `"@EG"` / `"@OG"` / `"@KG"` (Stockwerk-Buchung)
- Belege liegen in `data/belege/{buchung-id}/`

### projekt.json – Felder
```
gewerke[]: id, name, farbe (#hex), sortierung, pauschal? (true = Sammelgewerk → kein Budget-Alarm)
raeume[]:  id, name, geschoss (EG/OG/KG/DG), sortierung, flaeche? (m², Dezimalzahl)
budgets[]: gewerk (→ gewerke.id), geplant (cents), notiz
```
Jedes Gewerk hat genau einen Budget-Eintrag.

### summary.json – Felder
```
gesamt: { ist, budget }
gewerke[]: { id, name, ist, budget, differenz (= budget - ist), anzahl }
raeume[]: { id, name, geschoss, ist }  (nur Räume mit ist > 0)
letzteBuchungen[]: { datum, betrag, gewerk, beschreibung }  (5 neueste)
```
`differenz > 0` = unter Budget · `differenz < 0` = über Budget

### lieferanten.json – Felder
```
lieferanten[]: { id (slugified), name, notiz, erstellt, geaendert }
lieferungen[]: { id, lieferantId, datum, beschreibung, betrag? (cents, negativ = Gutschrift),
                 gewerk?, rechnungsnummer, positionen[], belege[], buchungId?, erstellt, geaendert }
```
Auto-Buchung: wenn `betrag` + `gewerk` gesetzt → `kategorie = "Material"` auto in buchungen.json.

### rechnungen.json – Datenmodell
`Rechnung` → `abschlaege[]` → Bezahlen → auto-Buchung mit `rechnungId`
`Rechnung.nachtraege[]` = genehmigte Mehraufwände; Gesamtauftrag = `auftragssumme + Σnachtraege`

Abschlag-Felder: `typ` (abschlag/schlussrechnung/nachtragsrechnung) · `status` (ausstehend/offen/bezahlt) ·
`eingangsdatum?` · `zahlungsziel?` (Tage) → `faelligkeitsdatum` auto-berechnet.
Computed Status via `abschlagEffektivStatus()`: `bald_faellig` (offen + ≤7 Tage) · `ueberfaellig`

Belege: `data/rechnungen/{rechnungId}/{abschlagId}/`

---

## Claude Code: Daten lesen

```
→ Read data/summary.json     # Immer zuerst — reicht für die meisten Fragen
→ Read data/buchungen.json   # Für Detail-/Filterabfragen
→ Read data/projekt.json     # Für Stammdaten (Gewerke, Räume, Budgets)
```

Filter-Beispiele:
- Gewerk: `.filter(b => b.gewerk === "elektro")`
- Raum: `.filter(b => b.raum === "bad-eg")`
- Monat: `.filter(b => b.datum.startsWith("2026-02"))`
- Kategorie: gruppieren nach `kategorie`, summieren `betrag`
- Gewerke über Budget: `summary.gewerke.filter(g => g.differenz < 0)`

Budget-Ampel: `ist/budget < 0.8` = grün · `0.8–1.0` = gelb · `≥ 1.0` = rot. Wenn `budget = 0`, keine Ampel.

---

## Claude Code: Daten schreiben

Webapp liest bei jedem Request von Platte (kein Cache) → Änderungen sofort sichtbar nach Reload.

### Neue Buchung
1. `Read data/buchungen.json` → Array erweitern → `Write data/buchungen.json`
2. Pflichtfelder: `id` (UUID v4), `datum`, `betrag` (cents), `gewerk`, `raum`, `kategorie`, `beschreibung`, `rechnungsreferenz` (`""`), `belege` (`[]`), `erstellt`, `geaendert`
3. **summary.json danach manuell aktualisieren** — oder einmal die Webapp aufrufen (beliebige Seite)

### Buchung bearbeiten
`id` finden → Felder ändern → `geaendert` auf aktuelle Zeit setzen → `Write`

### Budget ändern
`projekt.json` → `budgets[]` → `geplant` ändern → `Write`

### Gewerk/Raum hinzufügen
`projekt.json` → `gewerke[]`/`raeume[]` → bei Gewerk auch `budgets[]`-Eintrag (`geplant: 0`) → `Write`

---

## Projektstruktur

```
data/                           # Alle JSON-Daten + Belege
  projekt.json, buchungen.json, rechnungen.json, lieferanten.json
  ai-analyse.json, dokumente-texte.json, email-scan-cache.json, summary.json
  belege/{buchungId}/           # Buchungs-Belege
  rechnungen/{rId}/{aId}/       # Abschlags-Belege
  lieferungen/{lId}/            # Lieferungs-Belege
  email-scan/                   # Gescannte E-Mail-Anhänge

src/lib/
  domain.ts         # Types, Factories, Validierung, Aggregation
  dataStore.ts      # JSON Datei-I/O (synchron, server-only)
  format.ts         # formatCents(), parseCentsFromInput(), formatDatum()
  pdfReport.ts      # PDF-Bericht (pdfmake, ~700 Zeilen, 11 Abschnitte)
  pdfCharts.ts      # Server-side Chart-Rendering (chartjs-node-canvas → base64 PNG)
  reportData.ts     # Shared Berechnungslogik (BurnRate, Steuer, Zahlungen, Finanzübersicht)
  aiAnalyse.ts      # leseAnalyse() → data/ai-analyse.json
  pdfExtract.ts     # PDF-Textextraktion (pdf-parse v2)
  components/       # BuchungForm.svelte, Charts.svelte, VerlaufSection.svelte

src/routes/
  +page.svelte                    # Dashboard (KPIs, Charts, Monatsverlauf, Gewerke-Übersicht)
  buchungen/                      # Ausgaben: Liste+Filter, Neu, [id] Bearbeiten/Löschen
  rechnungen/[id]/                # Aufträge: Abschläge, Nachträge, Bezahlen, Inline-Edit
  lieferanten/[id]/               # Lieferanten + Lieferungen + PDF-Extraktion
  prognose/                       # Burn Rate, Budget-Erschöpfung, Gewerk-Hochrechnung
  verlauf/                        # Monatsverlauf (auch direkt erreichbar)
  budget/                         # Budget-Cards mit Ampel-Rand, Inline-Edit, Sortierung nach Status
  bericht/                        # PDF-Bericht + KI-Analyse + Dokumenten-Vorbereitung
  belege/                         # Belege-Übersicht mit Vorschau, Gruppierung, fehlende Belege
  gewerke/                        # Gewerke-Cards mit Drag & Drop, Budget-Info, Seed-Logik
  raeume/                         # Räume-Cards nach Geschoss, Drag & Drop, m², Kosten/m²
  einstellungen/
  api/
    bericht/+server.ts            # GET: PDF-Bericht (?ai=true für KI-Analyse)
    export/+server.ts             # GET: ZIP-Download aller Daten
    pdf-analyse/+server.ts        # POST: PDF → Datum/Betrag/Rg-Nr./Positionen
    dokumente-extrakt/+server.ts  # GET: PDF-Texte extrahieren → dokumente-texte.json
    update-status/+server.ts      # GET: git fetch + Update-Verfügbarkeit prüfen
```

**Architektur:** JSON auf Platte · synchrones I/O (readFileSync/writeFileSync) · SvelteKit Form Actions · Tailwind CSS v4 · Chart.js · pdfmake 0.3.x · Node v22 (nvm)

**Erststart:** Bei fehlender `projekt.json` werden automatisch 10 Standard-Gewerke (Rohbau, Elektro, Sanitär, Heizung, Fenster & Türen, Trockenbau, Maler, Boden, Dach, Sonstiges) und 5 Standard-Räume (Küche, Wohnzimmer, Bad, Flur, Schlafzimmer EG) angelegt.

**pdfmake 0.3.x Gotchas:**
- Import: `import PdfPrinter from 'pdfmake/js/Printer'`
- Konstruktor: `new PdfPrinter.default(fonts)` (nicht `new PdfPrinter(fonts)`)
- Fonts: `Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64')`
- `createPdfKitDocument()` ist async → `await` nötig

**URL-Filter:** `/buchungen?gewerk=elektro&raum=bad-eg&kategorie=Material&suche=Text&monat=2026-02&geschoss=EG`
`/buchungen?raum=@EG` (nur Stockwerk) · `/buchungen?geschoss=EG` (Einzelräume + @EG kombiniert)

---

## Claude Code: Bauleiter-Analyse erstellen

Trigger: "erstelle Bauleiter-Analyse", "analysiere die Baudaten", "aktualisiere die KI-Analyse"

### Schritt 1: Alle Daten lesen
```
→ Read data/summary.json          # Gesamtübersicht
→ Read data/rechnungen.json       # Aufträge, offene Abschläge
→ Read data/buchungen.json        # Zeitreihen, Kategorien
→ Read data/lieferanten.json      # Materialkosten
→ Read data/projekt.json          # Stammdaten
→ Read data/dokumente-texte.json  # Extrahierte PDF-Texte (falls vorhanden)
```

### Schritt 2: Analysieren als erfahrener Bauleiter/Baukostenberater
- Konkrete €-Beträge, Prozentsätze, Budget vs. Ist, Burn Rate
- Risiken: Gewerke nahe/über Budget, große offene Aufträge
- Cashflow: offene Rechnungen, gebundene Mittel, Liquiditätsprognose

Falls `dokumente-texte.json` vorhanden, zusätzlich prüfen:
- **Angebots-Positionen**: optionale Leistungen, Aufpreise, Alternativen
- **Zahlungsbedingungen**: Skonto-Fristen, Zahlungsziele, Vorauszahlungen
- **Förder-Klauseln**: KfW, BAFA, aufschiebende Bedingungen
- **Angebot vs. Rechnung**: Abweichungen erkennen
- **Vertragliche Risiken**: Pauschalpreise vs. Aufmaß, Nachtragsklauseln

### Schritt 3: Schreiben nach `data/ai-analyse.json`
```json
{
  "erstellt": "<ISO-Timestamp>",
  "analyse": {
    "zusammenfassung": "3-5 Sätze: Projektstatus, Budget/Ausgaben/%, Burn Rate, aktive Gewerke",
    "risikobewertung": "Kritische Gewerke mit % und €, große unbezahlte Aufträge",
    "cashflowBewertung": "Offene Rechnungen €, gebundene Mittel, Burn Rate, Restbudget-Reichweite",
    "empfehlungen": ["Konkrete Empfehlung 1 mit Zahlen", "Empfehlung 2", "..."],
    "dokumentenAnalyse": "Optional: Erkenntnisse aus Angeboten/Belegen (nur wenn dokumente-texte.json gelesen)"
  }
}
```
Alle Felder außer `dokumentenAnalyse` sind Pflicht und dürfen nicht leer sein. Die Webapp zeigt diese Daten 1:1 im PDF an.

### Schritt 4
> "Analyse geschrieben. PDF unter `/bericht` herunterladen — die KI-Checkbox ist jetzt automatisch aktiv."
