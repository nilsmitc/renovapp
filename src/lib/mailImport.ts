import { statSync, openSync, readSync, closeSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import type { Lieferant } from './domain.js';

export const THUNDERBIRD_INBOX =
	'/home/nils/.thunderbird/v5sejxwj.default-esr/ImapMail/imap.mailbox-1.org/INBOX';

export interface MailKandidat {
	id: string;
	messageId: string;
	datum: string; // YYYY-MM-DD aus Mail-Datum
	absender: string;
	betreff: string;
	lieferantId: string;
	lieferantName: string;
	pdfDateiname: string; // Originaldateiname des Anhangs
	pdfCacheDatei: string; // Dateiname in data/email-scan/
	extraktion: {
		betrag?: number;
		rechnungsnummer?: string;
		datum?: string; // aus PDF-Inhalt (kann vom Mail-Datum abweichen)
	};
	uebernommen: boolean;
	uebersprungen: boolean;
}

export interface MailScanCache {
	gescannt: string; // ISO-Timestamp
	kandidaten: MailKandidat[];
}

// ─── mbox-Leser ──────────────────────────────────────────────────────────────

/**
 * Liest die letzten `bytesVomEnde` Bytes der mbox-Datei und gibt
 * rohe RFC-2822-Nachrichten-Strings zurück. Thunderbird schreibt INBOX
 * als Unix-mbox: Nachrichten getrennt durch Zeilen die mit "From " beginnen.
 */
function leseMboxNachrichten(pfad: string, bytesVomEnde: number): string[] {
	const stat = statSync(pfad);
	const leseGroesse = Math.min(bytesVomEnde, stat.size);
	const startPos = stat.size - leseGroesse;

	const buf = Buffer.alloc(leseGroesse);
	const fd = openSync(pfad, 'r');
	readSync(fd, buf, 0, leseGroesse, startPos);
	closeSync(fd);

	// Latin-1 für verlustfreie byte→string Konvertierung (mbox kann non-UTF8 enthalten)
	const text = buf.toString('latin1');

	// Trenne auf mbox-Trenner: "From " am Zeilenanfang (ggf. nach \r\n oder \n)
	const teile = text.split(/\r?\nFrom [^\r\n]+\r?\n/);

	// Ersten Block verwerfen wenn wir nicht am Dateianfang starten (könnte Mitte einer Nachricht sein)
	if (startPos > 0 && teile.length > 1) teile.shift();

	return teile.filter((t) => t.trim().length > 100);
}

// ─── Lieferanten-Matching ─────────────────────────────────────────────────────

function matcheLieferant(from: string, subject: string, lieferanten: Lieferant[]): Lieferant | undefined {
	const suchtext = (from + ' ' + subject).toLowerCase();
	return lieferanten.find((l) => suchtext.includes(l.name.toLowerCase()));
}

function formatDatum(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export interface ScanRohErgebnis {
	kandidaten: Array<{
		messageId: string;
		datum: string;
		absender: string;
		betreff: string;
		lieferant: Lieferant;
		pdfBuffer: Buffer;
		pdfDateiname: string;
	}>;
	verarbeiteteNachrichten: number;
	zuAlt: number; // Nachrichten außerhalb des Zeitfensters
}

export async function scanneMbox(
	lieferanten: Lieferant[],
	tageRueckblick: number = 14,
	bytesVomEnde: number = 40 * 1024 * 1024 // 40 MB sollten 2 Wochen locker abdecken
): Promise<ScanRohErgebnis> {
	const fruehestDatum = new Date();
	fruehestDatum.setDate(fruehestDatum.getDate() - tageRueckblick);
	fruehestDatum.setHours(0, 0, 0, 0);

	const nachrichten = leseMboxNachrichten(THUNDERBIRD_INBOX, bytesVomEnde);
	const kandidaten: ScanRohErgebnis['kandidaten'] = [];
	let zuAlt = 0;

	for (const nachricht of nachrichten) {
		try {
			const parsed = await simpleParser(Buffer.from(nachricht, 'latin1'));

			const mailDatum = parsed.date;
			if (!mailDatum || mailDatum < fruehestDatum) {
				zuAlt++;
				continue;
			}

			// Nur Mails mit PDF-Anhang
			const pdfAnhaenge = (parsed.attachments ?? []).filter(
				(a) =>
					a.contentType === 'application/pdf' ||
					(a.filename ?? '').toLowerCase().endsWith('.pdf')
			);
			if (pdfAnhaenge.length === 0) continue;

			// Lieferant matchen (Name in Absender oder Betreff)
			const from = parsed.from?.text ?? '';
			const subject = parsed.subject ?? '';
			const lieferant = matcheLieferant(from, subject, lieferanten);
			if (!lieferant) continue;

			const datumStr = formatDatum(mailDatum);

			for (const pdf of pdfAnhaenge) {
				kandidaten.push({
					messageId: parsed.messageId ?? `noId-${Date.now()}-${Math.random()}`,
					datum: datumStr,
					absender: from,
					betreff: subject,
					lieferant,
					pdfBuffer: pdf.content as Buffer,
					pdfDateiname: pdf.filename ?? 'rechnung.pdf'
				});
			}
		} catch {
			// Beschädigte/unvollständige Nachricht — überspringen
		}
	}

	return { kandidaten, verarbeiteteNachrichten: nachrichten.length, zuAlt };
}
