# Changelog

## 2026-07-03
- Aufträge: Angebote können jetzt abgelehnt werden — abgelehnte Angebote wandern in einen eigenen Bereich und lassen sich wiederherstellen oder endgültig löschen; sie zählen nicht in Budget, Prognose oder Bericht
- Ausgaben: "Bezahlt"-Badge erscheint jetzt auch, wenn Buchungs- und Bezahldatum identisch sind (z.B. beim manuellen Anlegen mit "Als bezahlt markieren")
- Aufträge: Suchfeld verliert beim Tippen nicht mehr nach jedem Buchstaben den Fokus
- Neues Design: warme, handwerkliche Farbwelt — Terracotta als Primärfarbe, Stone-Neutraltöne statt Grau
- Dark Mode mit Umschalter in der Seitenleiste (wird gespeichert, folgt sonst der Systemeinstellung)
- Neue Navigation: feste Seitenleiste links mit allen Menüpunkten samt Beschriftung, auf Mobilgeräten als ausklappbares Menü
- Diagramme passen ihre Farben live an das gewählte Theme an (auch Achsen, Raster und Tooltips)
- Einheitliche Optik: gemeinsame Badges, Hinweisboxen und Buttons auf allen Seiten (vorher teils handgebaut und uneinheitlich)
- Gewerk-Farbpunkte bekommen einen dezenten Ring, damit dunkle Farben auch im Dark Mode sichtbar bleiben

## 2026-05-13
- Lieferanten: Serverfehler beim Anlegen einer Lieferung werden jetzt als Fehlermeldung angezeigt statt still ignoriert (Formular schloss sich ohne Speichern)
- Buchungen (Neu): "Als bezahlt markieren" (bezahltam) wird jetzt korrekt gespeichert
- Rechnungen: TypeScript-Fehler in use:enhance-Pattern behoben

## 2026-05-12
- Budget, Prognose, PDF-Bericht, Dashboard-Chart: Gewerke mit vollständig bezahlter Schlussrechnung zeigen jetzt "Abgeschlossen" (grün) statt "Knapp/Achtung" (gelb) — kein falscher Budget-Alarm mehr wenn ein Auftrag regulär abgerechnet ist

## 2026-04-25
- Dashboard / Prognose / Budget / PDF-Bericht: Angebote (noch nicht beauftragt) fließen nicht mehr in "Fest eingeplant", offene Beträge, Restauftrag, nächste Zahlungen oder Cashflow-Prognose ein — nur noch tatsächliche Aufträge zählen als gebundene Mittel

## 2026-04-19
- Rechnungen: Duplizierte Cent-Parsing-Logik durch zentrale `parseCentsFromInput()` ersetzt (Abschläge, Nachträge, Auftragssumme)
- Sicherheit: ZIP-Import mit `resolve()`-basiertem Path-Traversal-Schutz gehärtet
- PDF-Bericht: Fehlerbehandlung mit aussagekräftiger 500-Meldung statt unbehandeltem Crash
- PDF-Bericht: Leerer-Monatsdaten-Guard verhindert Null-Referenz bei Erststart
- Buchungen: Kategorie-Validierung vor dem Speichern (nur Material/Arbeitslohn/Sonstiges)
- Logging: Fehler beim Lesen von dokumente-texte.json werden jetzt geloggt statt verschluckt

## 2026-04-15
- Lieferanten: Zahlungsart "Kartenzahlung" wird beim Speichern nicht mehr zurückgesetzt
- Lieferanten-PDF-Erkennung: Bau&Leben-Rechnungen werden jetzt korrekt mit dem Brutto-Rechnungsbetrag erkannt (statt dem Nettowarenwert)

## 2026-04-05
- Angebote-Funktion: Aufträge können jetzt als "Angebot" (noch nicht beauftragt) angelegt werden, mit eigenem Tab in der Aufträge-Liste
- Angebote per "Als Auftrag annehmen" in Aufträge umwandeln
- Nachträge: Rechnungsbeleg direkt am Nachtrag hinterlegen
- Nachträge: "Abrechnen →" erstellt automatisch einen Abschlag vom Typ Nachtragsrechnung und verknüpft ihn
- Auftragsdetail: Alle Dokumente (Angebot + Abschlag-Belegs) werden prominent im Header angezeigt
- Auftragsdetail: Abschlag-Zeile vom Typ Nachtrag zeigt den Nachtrag-Beleg wenn kein eigener Abschlag-Beleg hinterlegt ist

## 2026-03-28
- KI-Analyse erweitert: 4 neue Dimensionen — Cashflow-Prognose, Szenario-Analyse (Best/Expected/Worst Case), Belege & Förderung (BAFA/KfW/§35a), Auftrags-Fortschritt
- Automatischer Update-Check beim App-Start: Banner unter der Navigation wenn eine neue Version bereit ist
- Belege-Export für BAFA / Energieberater: Multi-Select auf der Belege-Seite, Smart-Auswahl (Energie-Gewerke, Abschläge, noch nicht exportiert), ZIP-Download oder direkt in Thunderbird öffnen
- Exportierte Belege werden geloggt und mit grünem Badge markiert
- Einstellungen: E-Mail-Adresse, Thunderbird-Pfad und Betreff für den Belege-Export konfigurierbar

## 2026-03-24
- E-Mail-Import generisch: Thunderbird-Erkennung statt hardcodiertem Pfad, Postfach-Auswahl per UI
- Update-System funktioniert jetzt ohne Git (ZIP-Download von GitHub)
- Navigation passt sich an verschiedene Bildschirmbreiten an (Icon-Modus auf kleineren Bildschirmen)
- Standard-Gewerke werden bei leerem Projekt automatisch angelegt
- Fehlende Budget-Einträge werden automatisch ergänzt
- Einweisung neu geschrieben: Workflow-Fokus statt Feature-Beschreibung
- Changelog in den Einstellungen unter Updates sichtbar
- Bessere Fehlermeldungen beim Update-Check

## 2026-03-20
- Belege-Seite: Vorschau, fehlende Belege, Gruppierung nach Gewerk
- UI-Modernisierung: Aufträge, Gewerke, Räume, Budget-Seiten überarbeitet

## 2026-03-18
- Animationen und Inter Font eingeführt
- start.bat Fix für Windows
