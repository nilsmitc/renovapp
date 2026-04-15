import { PDFParse } from 'pdf-parse';
import type { LieferungPosition } from './domain.js';

export interface PdfExtractResult {
	datum?: string;              // "YYYY-MM-DD"
	rechnungsnummer?: string;
	lieferscheinnummer?: string;
	betrag?: number;             // Cents
	positionen: LieferungPosition[];
	rohtext: string;
	fehler?: string;
}

export async function extrahierePdfDaten(buffer: Buffer): Promise<PdfExtractResult> {
	let rohtext = '';
	try {
		const parser = new PDFParse({ data: buffer });
		const result = await parser.getText();
		rohtext = result.text ?? '';
	} catch {
		return { positionen: [], rohtext: '', fehler: 'PDF konnte nicht gelesen werden' };
	}

	if (!rohtext.trim()) {
		return { positionen: [], rohtext, fehler: 'scan' };
	}

	return {
		datum: extrahiereDatum(rohtext),
		rechnungsnummer: extrahiereRechnungsnummer(rohtext),
		lieferscheinnummer: extrahiereLieferscheinnummer(rohtext),
		betrag: extrahiereGesamtbetrag(rohtext),
		positionen: extrahierePositionen(rohtext),
		rohtext
	};
}

// ─── Datum ───────────────────────────────────────────────────────────────────

function extrahiereDatum(text: string): string | undefined {
	// Zuerst: Datum mit eindeutigem Keyword (über Zeilenumbrüche hinweg)
	const mitKeyword = [
		/(?:Rechnungsdatum|Leistungsdatum|Belegdatum|Bestelldatum)\s*[:\-]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/is,
		/Datum\s*[:\-]\s*(\d{1,2}\.\d{1,2}\.\d{4})/is,
		/vom\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/is
	];

	for (const re of mitKeyword) {
		const m = text.match(re);
		if (m) return normalisieresDatum(m[1]);
	}

	// Fallback: erstes vierstelliges Jahresdatum im Text
	const fallback = text.match(/\b(\d{1,2}[.\/-]\d{1,2}[.\/-]20\d{2})\b/);
	if (fallback) return normalisieresDatum(fallback[1]);

	return undefined;
}

function normalisieresDatum(raw: string): string {
	const parts = raw.split(/[.\/-]/);
	if (parts.length !== 3) return '';
	const [a, b, c] = parts;
	if (c.length === 4) {
		// DD.MM.YYYY
		return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
	} else if (a.length === 4) {
		// YYYY-MM-DD
		return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
	}
	return '';
}

// ─── Rechnungsnummer ─────────────────────────────────────────────────────────

function extrahiereRechnungsnummer(text: string): string | undefined {
	const patterns = [
		/(?:Rechnungsnummer|Rechnungs-?Nr\.?|Rg\.?-?Nr\.?|Re\.?-?Nr\.?|Belegnummer|Invoice\s*No\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_.]{3,30})/i,
		/(?:Rechnung\s+Nr\.?|Rechnung\s+Nummer)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_.]{3,30})/i
	];
	for (const re of patterns) {
		const m = text.match(re);
		if (m && m[1]) return m[1].trim();
	}
	return undefined;
}

// ─── Lieferscheinnummer ───────────────────────────────────────────────────────

function extrahiereLieferscheinnummer(text: string): string | undefined {
	const patterns = [
		/(?:Lieferschein-?(?:Nr\.?|Nummer)|LS-?Nr\.?|Delivery\s*Note)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_.]{3,30})/i,
		/Lieferschein\s+(?:Nr\.?:?\s*)([A-Z0-9][A-Z0-9\-\/_.]{3,30})/i
	];
	for (const re of patterns) {
		const m = text.match(re);
		if (m && m[1]) return m[1].trim();
	}
	return undefined;
}

// ─── Gesamtbetrag ─────────────────────────────────────────────────────────────

function extrahiereGesamtbetrag(text: string): number | undefined {
	const lines = text.split('\n');

	// Stufe 0: Tabellenkopf-Erkennung (z.B. Bau&Leben mit Header-Zeile und Wertezeile)
	const ausTabelle = extrahiereAusTabellenkopf(lines);
	if (ausTabelle !== undefined) return ausTabelle;

	// Stufe 1: Keyword-Patterns mit optionalem Whitespace/Zeilenumbruch zwischen Keyword und Betrag
	// Die \s* erlaubt Zeilenumbrüche (flag 's' nicht nötig bei \s)
	const keywordPatterns = [
		// Brutto-Gesamtbetrag (höchste Priorität)
		/(?:Gesamtbetrag|Rechnungsbetrag|Rechnungssumme|Bruttobetrag|Endbetrag|Gesamtsumme)\s*[:\-]?\s*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?/i,
		// "Gesamt inkl. MwSt/USt"
		/Gesamt\s+inkl\.?\s*(?:MwSt\.?|USt\.?)\s*[:\-]?\s*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?/i,
		// "Zu zahlen" / "Zahlbetrag" / "Offener Betrag"
		/(?:Zu\s+zahlen|Zahlbetrag|Zu\s+zahlender\s+Betrag|Offener\s+Betrag)\s*[:\-]?\s*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?/i,
		// "Total" / "Summe brutto"
		/(?:Total\s+(?:brutto|inkl\.?)|Summe\s+brutto)\s*[:\-]?\s*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?/i,
		// Betrag steht auf nächster Zeile nach Keyword
		/(?:Gesamtbetrag|Rechnungsbetrag|Zu\s+zahlen|Zahlbetrag)\s*[:\-]?\s*\n\s*(?:EUR|€)?\s*([\d.,]+)/i,
		// "EUR 1.234,56" nach Brutto-Keyword
		/(?:EUR|€)\s*([\d.,]+)\s*(?:inkl\.?\s*(?:MwSt\.?|USt\.?)|brutto)/i,
	];

	for (const re of keywordPatterns) {
		const m = text.match(re);
		if (m) {
			const cents = parseBetragZuCents(m[1]);
			if (cents > 0) return cents;
		}
	}

	// Stufe 2: Letzten Betrag in einer Zeile mit €/EUR nehmen
	// (Gesamtbeträge stehen typischerweise am Ende der Rechnung)
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line.includes('€') && !/EUR/i.test(line)) continue;

		// Zeilen mit Netto/MwSt/Steuer/Skonto/Übertrag überspringen (das sind Teilbeträge)
		if (/(?:netto|mwst|ust|steuer|%|zwischensumme|übertrag|nettowarenwert|skontierfähig|skontozahlbetrag|skonto)/i.test(line)) continue;

		const m = line.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
		if (m) {
			const cents = parseBetragZuCents(m[1]);
			if (cents > 0) return cents;
		}
	}

	// Stufe 3: Alle €-Beträge sammeln, den vorletzten nehmen
	// (letzter ist oft MwSt, vorletzter oft der Brutto-Gesamtbetrag)
	const alleBetraege = [...text.matchAll(/(?:€|EUR)\s*([\d]{1,6}[.,][\d]{2})/gi)]
		.map((m) => parseBetragZuCents(m[1]))
		.filter((b) => b > 100); // < 1 € ignorieren

	if (alleBetraege.length >= 2) {
		// Vorletzten nehmen (oft: ..., Brutto, MwSt-Zeile am Ende)
		return alleBetraege[alleBetraege.length - 2];
	}
	if (alleBetraege.length === 1) {
		return alleBetraege[0];
	}

	return undefined;
}

// Erkennt Tabellenkopf-Strukturen wie bei Bau&Leben, wo mehrere Spalten-Header
// (inkl. "Rechnungsbetrag EUR") auf einer Zeile stehen und die Werte auf der
// nächsten — das Standard-Regex greift dort fälschlich die erste Zahl (Netto)
// statt der letzten Spalte (Brutto).
function extrahiereAusTabellenkopf(lines: string[]): number | undefined {
	const bruttoKeyword = /\b(Rechnungsbetrag|Gesamtbetrag|Bruttobetrag|Endbetrag|Gesamtsumme|Rechnungssumme)\b/i;
	const tabellenTokens = /\b(Nettowarenwert|Netto|MwSt|USt|Steuer|Zahlungstermin|Skontierf[aä]hig|Skontozahlbetrag|Skonto|Brutto)\b|%/gi;
	const betragRe = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!bruttoKeyword.test(line)) continue;

		const weitereTokens = (line.match(tabellenTokens) || []).length;
		if (weitereTokens < 2) continue;

		// Nächste nicht-leere Zeile als Wertezeile
		let j = i + 1;
		while (j < lines.length && !lines[j].trim()) j++;
		if (j >= lines.length) return undefined;

		const betraege = (lines[j].match(betragRe) || [])
			.map((b) => parseBetragZuCents(b))
			.filter((c) => c > 0);
		if (betraege.length < 2) return undefined;

		return Math.max(...betraege);
	}
	return undefined;
}

function parseBetragZuCents(raw: string): number {
	const cleaned = raw.trim().replace(/\s/g, '');

	let normalized: string;

	if (/^\d{1,3}(\.\d{3})+(,\d{2})$/.test(cleaned)) {
		// Deutsches Format: 1.234,56 oder 1.234.567,89
		normalized = cleaned.replaceAll('.', '').replace(',', '.');
	} else if (/^\d+(,\d{2})$/.test(cleaned)) {
		// 1234,56
		normalized = cleaned.replace(',', '.');
	} else if (/^\d{1,3}(,\d{3})+(\.\d{2})$/.test(cleaned)) {
		// Englisches Format: 1,234.56
		normalized = cleaned.replaceAll(',', '');
	} else if (/^\d+(\.\d{2})$/.test(cleaned)) {
		// 1234.56
		normalized = cleaned;
	} else {
		// Generisch: letztes Komma/Punkt als Dezimaltrennzeichen
		const letzterTrenner = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
		if (letzterTrenner !== -1 && cleaned.length - letzterTrenner === 3) {
			// Dezimalstelle am Ende: alles davor ist Ganzzahl
			normalized =
				cleaned.slice(0, letzterTrenner).replaceAll(/[.,]/g, '') +
				'.' +
				cleaned.slice(letzterTrenner + 1);
		} else {
			normalized = cleaned.replaceAll(',', '.');
		}
	}

	const num = parseFloat(normalized);
	if (isNaN(num) || num <= 0) return 0;
	return Math.round(num * 100);
}

// ─── Positionen ───────────────────────────────────────────────────────────────

function extrahierePositionen(text: string): LieferungPosition[] {
	const positionen: LieferungPosition[] = [];
	const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

	const positionRe = /^(.{5,60?}?)\s+((?:\d+\s*[xX×]\s*)?[\d.,]+\s*(?:Stk|Stück|m|m²|m2|lfm|kg|l|Pck|Pkg|Rolle|St\.?)?)?\s+([\d]{1,6}[.,]\d{2})\s*(?:€|EUR)?$/;

	for (const line of lines) {
		if (line.length < 10) continue;
		if (/(?:gesamt|summe|mwst|steuer|netto|brutto|zwischensumme|total|zahlung|ust)/i.test(line)) continue;
		if (/^\s*%/.test(line)) continue;

		const m = line.match(positionRe);
		if (m) {
			const beschreibung = m[1].trim();
			const menge = m[2]?.trim() || undefined;
			const betrag = parseBetragZuCents(m[3]);

			if (beschreibung.length >= 4 && betrag > 0 && betrag < 10_000_000) {
				positionen.push({ beschreibung, menge, betrag });
			}
		}
	}

	return positionen.slice(0, 30);
}
