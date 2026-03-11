/**
 * Einmaliges Skript: BEZAHLT-Stempel auf alle Lieferungs-PDFs
 * Datum-Priorität: bezahltam > erstellt
 *
 * Ausführen: npx tsx scripts/stempel-belege.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const LIEFERUNGEN_DIR = join(DATA_DIR, 'lieferungen');

interface Lieferung {
	id: string;
	belege?: string[];
	bezahltam?: string;
	erstellt: string;
}

async function stempelePdf(buffer: Buffer, datum: string): Promise<Buffer> {
	const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
	const pages = pdfDoc.getPages();
	if (pages.length === 0) return buffer;

	const page = pages[0];
	const { width, height } = page.getSize();
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

	const parts = datum.split('-');
	const dateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : datum;

	const cx = width * 0.73;
	const cy = height * 0.82;
	const rot = degrees(-15);
	const stempelRot = rgb(0.78, 0, 0);
	const opacity = 0.82;

	page.drawEllipse({ x: cx, y: cy, xScale: 68, yScale: 36, borderColor: stempelRot, borderWidth: 2.5, rotate: rot, opacity });
	page.drawText('BEZAHLT', { x: cx - 42, y: cy + 8, size: 21, font: fontBold, color: stempelRot, opacity, rotate: rot });
	page.drawText(`am ${dateStr}`, { x: cx - 36, y: cy - 16, size: 12, font: fontRegular, color: stempelRot, opacity, rotate: rot });

	return Buffer.from(await pdfDoc.save());
}

const { lieferungen }: { lieferungen: Lieferung[] } = JSON.parse(
	readFileSync(join(DATA_DIR, 'lieferanten.json'), 'utf-8')
);

let gestempelt = 0;
let uebersprungen = 0;
let fehler = 0;

for (const lieferung of lieferungen) {
	if (!lieferung.belege || lieferung.belege.length === 0) continue;

	const datum = lieferung.bezahltam ?? lieferung.erstellt.slice(0, 10);
	const dir = join(LIEFERUNGEN_DIR, lieferung.id);

	for (const dateiname of lieferung.belege) {
		if (!dateiname.toLowerCase().endsWith('.pdf')) {
			console.log(`  ⏭ Kein PDF, übersprungen: ${dateiname}`);
			uebersprungen++;
			continue;
		}

		const pfad = join(dir, dateiname);
		if (!existsSync(pfad)) {
			console.warn(`  ⚠ Datei nicht gefunden: ${pfad}`);
			fehler++;
			continue;
		}

		try {
			const original = readFileSync(pfad);
			const gestempeltBuffer = await stempelePdf(original, datum);
			writeFileSync(pfad, gestempeltBuffer);
			const quelle = lieferung.bezahltam ? 'bezahltam' : 'erstellt';
			console.log(`  ✓ ${dateiname} → am ${datum} (${quelle})`);
			gestempelt++;
		} catch (e) {
			console.error(`  ✗ Fehler bei ${dateiname}: ${e}`);
			fehler++;
		}
	}
}

console.log(`\nFertig: ${gestempelt} gestempelt, ${uebersprungen} übersprungen, ${fehler} Fehler`);
