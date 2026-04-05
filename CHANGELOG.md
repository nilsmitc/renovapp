# Changelog

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
