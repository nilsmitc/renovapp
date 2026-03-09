import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Fügt einen roten "BEZAHLT"-Stempel auf die erste Seite eines PDFs ein.
 * Der Stempel sieht aus wie ein echter Gummistempel (rote Ellipse, rotierter Text).
 * Gibt den Original-Buffer zurück, falls das PDF nicht geladen werden kann.
 */
export async function stempelePdf(buffer: Buffer, bezahltam: string): Promise<Buffer> {
	try {
		const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
		const pages = pdfDoc.getPages();
		if (pages.length === 0) return buffer;

		const page = pages[0];
		const { width, height } = page.getSize();

		const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

		// Datum: YYYY-MM-DD → DD.MM.YYYY
		const parts = bezahltam.split('-');
		const dateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : bezahltam;

		// Stempel-Mittelpunkt: oben rechts (ca. 73% Breite, 82% Höhe)
		const cx = width * 0.73;
		const cy = height * 0.82;

		const rot = degrees(-15);
		const stempelRot = rgb(0.78, 0, 0);
		const opacity = 0.82;

		// Ellipse (Oval-Rahmen)
		page.drawEllipse({
			x: cx,
			y: cy,
			xScale: 68,
			yScale: 36,
			borderColor: stempelRot,
			borderWidth: 2.5,
			rotate: rot,
			opacity
		});

		// "BEZAHLT" – oben in der Ellipse
		page.drawText('BEZAHLT', {
			x: cx - 42,
			y: cy + 8,
			size: 21,
			font: fontBold,
			color: stempelRot,
			opacity,
			rotate: rot
		});

		// "am DD.MM.YYYY" – unten in der Ellipse
		page.drawText(`am ${dateStr}`, {
			x: cx - 36,
			y: cy - 16,
			size: 12,
			font: fontRegular,
			color: stempelRot,
			opacity,
			rotate: rot
		});

		const pdfBytes = await pdfDoc.save();
		return Buffer.from(pdfBytes);
	} catch {
		// PDF nicht parsebar (verschlüsselt, kaputt) → Original unverändert zurückgeben
		return buffer;
	}
}
