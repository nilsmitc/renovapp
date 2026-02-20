# RenovApp – Kostenverfolgung für Renovierungsprojekte

Web-App zur Kostenverfolgung von Renovierungsprojekten. Lokale SvelteKit-Anwendung mit dateibasierter JSON-Speicherung – kein Server, keine Datenbank nötig.

## Features

- **Dashboard** – KPI-Karten (Budget, Ausgaben, Verbleibend, Burn Rate, **Ausstehend** = gestellte unbezahlte Abschläge, **Gebunden** = nicht fakturierte Vertragssummen), 4 klickbare Charts, Budget-Warnungen, vollständige Gewerke-Übersicht; **Monatsverlauf** (Balken-Chart, Linien-Chart, Tabelle) direkt integriert
- **Ausgaben** – Kostenbuchungen erfassen, bearbeiten, löschen; Volltext-Suche + kombinierbare Filter inkl. Herkunft (direkt / aus Rechnung / aus Lieferung); **Rückbuchungen**; optionales **Tätigkeit**-Feld
- **Aufträge** – Auftragnehmer-Rechnungen mit mehreren Abschlagszahlungen (Abschlag / Schlussrechnung / Nachtrag); Beleg-Upload je Abschlag; Bezahlen erstellt automatisch eine Buchung
- **Nachträge** – Genehmigte Mehraufwände (Change Orders) auf Aufträgen erfassen; Gesamtauftrag = Auftragssumme + Σ Nachträge; Fortschrittsbalken berücksichtigt Nachträge
- **Lieferanten** – Materialeinkäufe bei Händlern (Hornbach, Bauhaus etc.) erfassen; Lieferungen mit Belegen und Positionen; **Gutschriften** (negativer Betrag, rot markiert); **automatische PDF-Extraktion** (Datum, Betrag, Rg.-Nr., Positionen); Lieferungen fließen automatisch als Buchung in Ausgaben/Dashboard ein
- **Flexible Ortzuordnung** – Buchungen auf einzelne Räume oder ganze Stockwerke buchen
- **Belege** – Alle Dokumente (PDF/JPG/PNG) zentral: pro Buchung, Abschlag oder Lieferung; Typ-Badge zeigt Herkunft
- **Prognose** – Burn-Rate-Projektion, Budget-Erschöpfungsdatum, **Gebundene Mittel** (offene Rechnungen), Gewerk-Hochrechnungstabelle
- **Budget** – Gewerk-Budgets mit Ampel-Status und Inline-Bearbeitung; **Sammelgewerke** mit Tätigkeit-Aufschlüsselung
- **Sammelgewerk** – Gewerke (z.B. Generalunternehmer) als "Sammelgewerk" markieren: kein Budget-Alarm, stattdessen Tätigkeit-Aufschlüsselung
- **Gewerke & Räume** – Stammdaten verwalten (CRUD), Räume nach Geschoss gruppiert
- **Export / Import** – Vollständiges ZIP-Backup aller Daten inkl. Belege und Rechnungen; Restore per Import
- **Icons & visuelles Design** – Heroicons (Inline-SVG) auf allen Seiten; sticky Navigation; konsistente Card- und Tabellen-Styles

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/) – Doughnut- und Balkendiagramme
- [fflate](https://github.com/101arrowz/fflate) – ZIP-Kompression für Export/Import
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
| `rechnungen/` | Belege pro Abschlag (`{rechnung-id}/{abschlag-id}/datei`) |
| `lieferungen/` | Belege pro Lieferung (`{lieferung-id}/datei`) |

Geldbeträge werden als **Integer in Cent** gespeichert (`300000` = 3.000,00 €).
Rückbuchungen werden als **negativer Betrag** gespeichert (`-5000` = −50,00 €).

### Felder Buchung

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `datum` | `string` | ISO-Datum `YYYY-MM-DD` |
| `betrag` | `number` | Cents, negativ bei Rückbuchungen |
| `gewerk` | `string` | Gewerk-ID |
| `raum` | `string\|null` | Raum-ID, `@EG`/`@OG`/`@KG` oder `null` |
| `kategorie` | `string` | `"Material"` \| `"Arbeitslohn"` \| `"Sonstiges"` |
| `beschreibung` | `string` | Pflichtfeld, Freitext |
| `rechnungsreferenz` | `string` | Optional, Rechnungsnummer |
| `taetigkeit` | `string?` | Optional, z.B. `"Fliesen Bad"` – für Sammelgewerke |
| `rechnungId` | `string?` | Gesetzt wenn auto-erstellt aus bezahltem Abschlag |
| `lieferungId` | `string?` | Gesetzt wenn auto-erstellt aus einer Lieferung |
| `belege` | `string[]` | Dateinamen hochgeladener Dokumente |

### Felder Rechnung / Abschlag / Nachtrag

**Rechnung:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | UUID v4 |
| `gewerk` | `string` | Gewerk-ID |
| `auftragnehmer` | `string` | Name des Auftragnehmers |
| `kategorie` | `string` | Buchungs-Kategorie für auto-Buchung |
| `auftragssumme` | `number?` | Cents, ursprüngliches Angebot |
| `nachtraege` | `Nachtrag[]` | Genehmigte Mehraufwände |
| `abschlaege` | `Abschlag[]` | Zahlungsvorgänge |

**Abschlag:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `typ` | `string` | `"abschlag"` \| `"schlussrechnung"` \| `"nachtragsrechnung"` |
| `rechnungsbetrag` | `number` | Cents |
| `status` | `string` | `"ausstehend"` \| `"offen"` \| `"bezahlt"` |
| `faelligkeitsdatum` | `string?` | `YYYY-MM-DD`, löst `ueberfaellig` aus wenn überschritten |
| `buchungId` | `string?` | Link zur auto-erstellten Buchung |
| `beleg` | `string?` | Dateiname in `data/rechnungen/{rechnungId}/{abschlagId}/` |

**Nachtrag** (Change Order):

### Felder Lieferant / Lieferung

**Lieferant:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | Slugified Name, z.B. `"hornbach"` |
| `name` | `string` | Anzeigename |
| `notiz` | `string?` | Kundennummer, Ansprechpartner etc. |

**Lieferung:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | UUID v4 |
| `lieferantId` | `string` | → Lieferant.id |
| `datum` | `string` | `YYYY-MM-DD` |
| `betrag` | `number?` | Cents – Rechnungsbetrag laut Händlerrechnung; **negativ bei Gutschriften** |
| `gewerk` | `string?` | Gewerk-ID für auto-Buchung |
| `rechnungsnummer` | `string?` | Rechnungsnummer des Lieferanten |
| `lieferscheinnummer` | `string?` | Lieferscheinnummer |
| `positionen` | `LieferungPosition[]?` | Aus PDF extrahierte Einzelpositionen |
| `belege` | `string[]` | Dateinamen in `data/lieferungen/{lieferung-id}/` |
| `buchungId` | `string?` | Link zur auto-erstellten Buchung (wird gesetzt wenn betrag + gewerk vorhanden) |

**Auto-Buchung aus Lieferung:** Sobald `betrag` und `gewerk` an einer Lieferung gesetzt sind, wird automatisch eine Buchung mit `kategorie = "Material"` in `buchungen.json` angelegt. Diese erscheint in Ausgaben und fließt ins Dashboard ein. Beim Bearbeiten wird die Buchung synchronisiert; beim Löschen der Lieferung wird die auto-Buchung mitgelöscht.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `beschreibung` | `string` | Freitext |
| `betrag` | `number` | Cents |
| `datum` | `string?` | `YYYY-MM-DD` |

### Gewerke-Felder

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | Slugified Name, z.B. `"elektro"` |
| `name` | `string` | Anzeigename |
| `farbe` | `string` | Hex-Farbe für Charts |
| `sortierung` | `number` | Anzeigereihenfolge |
| `pauschal` | `boolean?` | Optional – Sammelgewerk-Flag, unterdrückt Budget-Ampel |

### Sammelgewerke

Gewerke die verschiedenartige Arbeiten abdecken (z.B. Generalunternehmer für Fliesen, Dämmung, Verputz) können als **Sammelgewerk** markiert werden:
- In `/gewerke` → Bearbeiten → Checkbox "Sammelgewerk – kein Budget-Alarm"
- Im Buchungsformular: optionales Feld **Tätigkeit** ausfüllen (z.B. `"Fliesen Bad"`)
- In `/budget`: "Sammelgewerk"-Badge statt Ampel + Tätigkeit-Aufschlüsselung

### Ortzuordnung

Das `raum`-Feld in Buchungen unterstützt drei Werte:

| Wert | Bedeutung |
|------|-----------|
| `null` | Kein Ort (allgemeine Kosten) |
| `"bad-eg"` | Einzelraum (Raum-ID) |
| `"@EG"` | Stockwerk-Buchung (Präfix `@`) |

## Projektstruktur

```
src/
├── lib/
│   ├── domain.ts       # Typen, Validierung, Aggregation
│   ├── dataStore.ts    # JSON Datei-I/O
│   ├── format.ts       # Währungs- und Datumsformatierung
│   └── components/
│       ├── BuchungForm.svelte
│       └── Charts.svelte
└── routes/
    ├── +page.svelte          # Dashboard
    ├── buchungen/            # Ausgaben (Liste, Neu, Bearbeiten)
    ├── rechnungen/           # Aufträge mit Abschlägen und Nachträgen
    ├── lieferanten/          # Lieferanten-Übersicht und Detailseite mit Lieferungen
    ├── lieferungen/          # Beleg-Auslieferung für Lieferungen
    ├── verlauf/              # Monatsverlauf (URL erreichbar, im Dashboard integriert)
    ├── prognose/             # Prognose (Burn Rate, Budget-Erschöpfung, Hochrechnung)
    ├── belege/               # Dokumentenverwaltung
    ├── budget/               # Budget-Übersicht + Sammelgewerk-Aufschlüsselung
    ├── gewerke/              # Gewerke-Verwaltung (inkl. Sammelgewerk-Flag)
    ├── raeume/               # Räume-Verwaltung
    ├── einstellungen/        # Export / Import
    └── api/                  # PDF-Analyse-Endpoint, ZIP-Download-Endpoint
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
