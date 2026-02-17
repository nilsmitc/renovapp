# Altbau Kostenverfolgung

## Was ist das?

SvelteKit-Webapp zur Kostenverfolgung eines Altbau-Umbaus. **Zwei Interfaces** auf dieselben JSON-Daten:
1. **Webapp** (SvelteKit) — Dateneingabe im Browser unter `http://localhost:5173`
2. **Claude Code** (CLI) — Analyse, Beratung, Bulk-Operationen via Read/Write auf JSON-Dateien

Starten: `cd ~/Altbau && ./start.sh` oder Doppelklick "Altbau Kosten" im App-Menü.

---

## Datendateien

Alle Daten liegen in `/home/nils/Altbau/data/`:

| Datei | Inhalt | Wann lesen? |
|-------|--------|-------------|
| `summary.json` | Auto-generierte Zusammenfassung (~1-2 KB) | **Immer zuerst!** Spart Tokens |
| `projekt.json` | Stammdaten: Gewerke, Räume, Budgets | Bei Stammdaten-Fragen |
| `buchungen.json` | Alle Kostenbuchungen (wächst) | Nur bei Detail-/Filterfragen |

**Wichtig:** `summary.json` wird automatisch bei jedem Schreibvorgang neu generiert (von der Webapp und manuell). Sie enthält Summen pro Gewerk, Gesamt-Ist/Budget, und die letzten 5 Buchungen.

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
    { "id": "elektro", "name": "Elektro", "farbe": "#3B82F6", "sortierung": 1 }
  ],
  "raeume": [
    { "id": "bad-eg", "name": "Bad", "geschoss": "EG", "sortierung": 2 }
  ],
  "budgets": [
    { "gewerk": "elektro", "geplant": 800000, "notiz": "" }
  ],
  "planung": [
    {
      "gewerk": "elektro",
      "start": "2026-03-01",
      "ende": "2026-03-15",
      "status": "geplant",
      "nachGewerk": ["trockenbau"]
    }
  ]
}
```

- `farbe`: Hex-Farbcode für Charts
- `sortierung`: Reihenfolge in Listen (0-basiert)
- `budgets[].gewerk`: Referenz auf `gewerke[].id`
- Jedes Gewerk hat genau einen Budget-Eintrag
- `planung[]`: optional, ein Eintrag pro Gewerk; `start`/`ende` leer wenn nicht terminiert
- `planung[].status`: `"geplant"` | `"aktiv"` | `"fertig"`
- `planung[].nachGewerk`: Gewerk-IDs die nach diesem starten können (Abhängigkeiten)

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
    "belege": ["rechnung.pdf"],
    "erstellt": "2026-02-14T18:06:59.500Z",
    "geaendert": "2026-02-14T18:06:59.500Z"
  }
]
```

- `betrag`: Integer in Cents. **Negativ bei Rückbuchungen** (`-5000` = −50,00 € Gutschrift)
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

---

## Projektstruktur

```
Altbau/
├── data/                           # JSON-Daten (gemeinsam für Webapp + Claude Code)
│   ├── projekt.json                # Gewerke, Räume, Budgets
│   ├── buchungen.json              # Alle Buchungen
│   ├── belege/                     # Beleg-Dateien (PDF/Bilder), ein Ordner pro Buchung
│   └── summary.json                # Auto-generiert
├── src/
│   ├── lib/
│   │   ├── domain.ts               # Types, Factories, Validierung, Aggregation
│   │   ├── dataStore.ts            # JSON Datei-I/O (server-only, synchron)
│   │   ├── format.ts               # formatCents(), parseCentsFromInput(), formatDatum()
│   │   └── components/
│   │       ├── BuchungForm.svelte   # Wiederverwendbares Buchungs-Formular
│   │       └── Charts.svelte        # Doughnut + Bar Chart (Chart.js)
│   └── routes/
│       ├── +page.svelte             # Dashboard (KPIs, Charts, Warnungen, Top-Raum, letzte Buchungen)
│       ├── buchungen/
│       │   ├── +page.svelte         # Liste mit Filtern + Volltext-Suche
│       │   ├── neu/+page.svelte     # Neue Buchung
│       │   └── [id]/+page.svelte    # Bearbeiten/Löschen
│       ├── verlauf/
│       │   ├── +page.svelte         # Monatsverlauf (Chart + Tabelle + Kategorie-Split)
│       │   └── +page.server.ts      # Monats-Aggregation
│       ├── belege/[buchungId]/[dateiname]/+server.ts  # Beleg-Dateien ausliefern
│       ├── gewerke/+page.svelte     # Gewerke CRUD
│       ├── raeume/+page.svelte      # Räume CRUD (nach Geschoss gruppiert)
│       ├── budget/+page.svelte      # Budget-Tabelle mit Ampel + Inline-Edit + Notizen
│       ├── planung/+page.svelte     # Bauplaner (Gantt-Chart, Abhängigkeiten, Status)
│       ├── einstellungen/+page.svelte  # Export / Import (ZIP-Backup)
│       └── api/export/+server.ts    # GET-Endpoint: ZIP-Download aller Daten
├── start.sh                         # Dev-Server starten + Browser öffnen
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
- **Node:** v22 via nvm (`source ~/.nvm/nvm.sh`)

### URL-Filter
Alle Filter funktionieren über URL-Parameter – kombinierbar, browser-back-fähig:
- `/buchungen?gewerk=elektro&raum=bad-eg&kategorie=Material&suche=Rechnung`
- `/buchungen?monat=2026-02` (vom Monatsverlauf-Link)
- `/buchungen?raum=@EG` — nur Stockwerk-Buchungen EG
- `/buchungen?geschoss=EG` — alle EG-Buchungen (Einzelräume + `@EG` kombiniert)

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

## Features (Stand 17.02.2026)

### Dashboard (`/`)
- 6 KPI-Karten: Budget, Ausgaben, Verbleibend, Verbraucht%, Top-Raum (klickbar), **Burn Rate** (Ø/Monat + Hochrechnung Restbudget)
- Budget-Warnungen: gelbe/rote Badges für Gewerke ≥80% (nur sichtbar wenn relevant)
- Charts (alle klickbar → navigieren zu gefilterten Buchungen):
  - Doughnut: Kostenanteile nach Gewerk
  - Bar: Budget vs. Ausgaben nach Gewerk
  - Doughnut: Kostenverteilung nach Kategorie (Material / Arbeitslohn / Sonstiges)
  - Gestapelter Balken: Kategorien nach Gewerk
- Letzte Buchungen (10 Einträge)
- Gewerke-Übersicht mit Fortschrittsbalken (klickbar → /buchungen?gewerk=X)

### Buchungen (`/buchungen`)
- Volltext-Suche in Beschreibung + Rechnungsreferenz
- Filter: Gewerk, Raum, Kategorie, Geschoss (kombinierbar, URL-Parameter)
- CRUD: Erstellen, Bearbeiten, Löschen
- **Rückbuchungen**: Checkbox im Formular → negativer `betrag`, rot markiert in Liste
- **Flexible Ortzuordnung**: Einzelraum, Stockwerk (`@EG`) oder kein Ort
- Belege anhängen (PDF/JPG/PNG, max 10 MB)
- Sortierung: neueste Buchungen oben; letztes Gewerk wird vorausgefüllt

### Monatsverlauf (`/verlauf`)
- Bar-Chart (Chart.js) – Ausgaben pro Monat chronologisch
- Linienchart – kumulierte Gesamtausgaben über Zeit
- Tabelle: Monat (klickbar → /buchungen gefiltert) | Buchungen | Ausgaben | Kumuliert
- Kategorie-Aufschlüsselung pro Monat (Material · Arbeitslohn · Sonstiges)

### Budget (`/budget`)
- Übersicht: Budget vs. Ist pro Gewerk mit Ampel-Farben
- Inline-Edit: Budget-Betrag + Notiz pro Gewerk

### Belege (`/belege`)
- Übersicht aller hochgeladenen Dokumente
- Filter nach Gewerk
- Direkter Download/Anzeige

### Bauplaner (`/planung`)
- CSS-only Gantt-Chart (kein zusätzliches Package)
- Status pro Gewerk: `geplant` / `aktiv` / `fertig`
- Abhängigkeiten: „Danach kommt" per Checkbox
- „Als nächstes bereit"-Panel: Gewerke ohne unfertige Vorgänger
- ⚠-Warnung wenn Startdatum vor Ende eines Vorgängers

### Gewerke & Räume (`/gewerke`, `/raeume`)
- CRUD für Stammdaten
- Räume gruppiert nach Geschoss

### Einstellungen (`/einstellungen`)
- **Export**: ZIP-Download mit projekt.json + buchungen.json + alle Belege
- **Import**: ZIP hochladen → vollständiges Restore (ersetzt alle Daten)
