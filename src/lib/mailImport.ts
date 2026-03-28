import { statSync, openSync, readSync, closeSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { simpleParser } from 'mailparser';
import type { Lieferant } from './domain.js';

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface EmailConfig {
	thunderbirdPfad: string;
	profil: string;	// Profil-Verzeichnisname, z.B. "abc12345.default"
	konto: string;		// IMAP-Server, z.B. "imap.example.com"
	ordner: string;		// Ordnername, z.B. "INBOX"
	energieberaterEmail?: string;
	thunderbirdBin?: string;	// Pfad zum thunderbird-Binary, Standard: "thunderbird"
	exportBetreff?: string;		// Betreff für Belege-Export-E-Mails
}

export interface ThunderbirdProfil {
	id: string;			// Verzeichnisname, z.B. "abc12345.default"
	name: string;		// Anzeigename aus profiles.ini, z.B. "default"
	isDefault: boolean;
}

export interface ThunderbirdKonto {
	server: string;		// z.B. "imap.example.com"
	ordner: string[];	// z.B. ["INBOX", "Sent", "Drafts"]
}

export interface ThunderbirdErkennung {
	pfad: string;
	profile: ThunderbirdProfil[];
	konten: Record<string, ThunderbirdKonto[]>; // Key = Profil-ID
}

export interface MailKandidat {
	id: string;
	messageId: string;
	datum: string;
	absender: string;
	betreff: string;
	lieferantId: string;
	lieferantName: string;
	pdfDateiname: string;
	pdfCacheDatei: string;
	extraktion: {
		betrag?: number;
		rechnungsnummer?: string;
		datum?: string;
	};
	uebernommen: boolean;
	uebersprungen: boolean;
}

export interface MailScanCache {
	gescannt: string;
	kandidaten: MailKandidat[];
}

// ─── Thunderbird-Erkennung ───────────────────────────────────────────────────

function parseIni(text: string): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};
	let section = '';
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
		const secMatch = trimmed.match(/^\[(.+)\]$/);
		if (secMatch) {
			section = secMatch[1];
			result[section] = {};
			continue;
		}
		const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
		if (kvMatch && section) {
			result[section][kvMatch[1].trim()] = kvMatch[2].trim();
		}
	}
	return result;
}

export function findeThunderbirdPfad(): string | null {
	const os = platform();
	let pfad: string;
	if (os === 'linux') {
		pfad = join(homedir(), '.thunderbird');
	} else if (os === 'darwin') {
		pfad = join(homedir(), 'Library', 'Thunderbird');
	} else if (os === 'win32') {
		pfad = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Thunderbird');
	} else {
		return null;
	}
	return existsSync(pfad) ? pfad : null;
}

function parseProfile(tbPfad: string): ThunderbirdProfil[] {
	const iniPfad = join(tbPfad, 'profiles.ini');
	if (!existsSync(iniPfad)) return [];

	const ini = parseIni(readFileSync(iniPfad, 'utf-8'));

	// Default-Profil aus installs.ini ermitteln (falls vorhanden)
	let installDefault = '';
	const installsIniPfad = join(tbPfad, 'installs.ini');
	if (existsSync(installsIniPfad)) {
		const installsIni = parseIni(readFileSync(installsIniPfad, 'utf-8'));
		for (const section of Object.values(installsIni)) {
			if (section['Default']) {
				installDefault = section['Default'];
				break;
			}
		}
	}

	const profile: ThunderbirdProfil[] = [];
	for (const [section, values] of Object.entries(ini)) {
		if (!section.startsWith('Profile')) continue;
		const name = values['Name'] ?? '';
		const path = values['Path'] ?? '';
		if (!path) continue;

		const isRelative = values['IsRelative'] === '1';
		const profilPfad = isRelative ? path : resolve(path);
		const vollPfad = isRelative ? join(tbPfad, profilPfad) : profilPfad;

		if (!existsSync(vollPfad)) continue;

		const isDefault = installDefault
			? profilPfad === installDefault
			: values['Default'] === '1';

		profile.push({ id: profilPfad, name, isDefault });
	}

	// Default-Profil zuerst
	profile.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1));
	return profile;
}

function findeKonten(tbPfad: string, profilId: string): ThunderbirdKonto[] {
	const imapDir = join(tbPfad, profilId, 'ImapMail');
	if (!existsSync(imapDir)) return [];

	const konten: ThunderbirdKonto[] = [];
	try {
		const serverDirs = readdirSync(imapDir, { withFileTypes: true })
			.filter(d => d.isDirectory());

		for (const dir of serverDirs) {
			const serverPfad = join(imapDir, dir.name);
			try {
				const dateien = readdirSync(serverPfad, { withFileTypes: true })
					.filter(d => d.isFile() && !d.name.includes('.') && d.name !== 'msgFilterRules')
					.map(d => d.name);

				// INBOX zuerst, dann alphabetisch
				dateien.sort((a, b) => {
					if (a === 'INBOX') return -1;
					if (b === 'INBOX') return 1;
					return a.localeCompare(b);
				});

				if (dateien.length > 0) {
					konten.push({ server: dir.name, ordner: dateien });
				}
			} catch { /* Lese-Fehler im Ordner — überspringen */ }
		}
	} catch { /* ImapMail nicht lesbar */ }

	return konten;
}

export function erkenneThunderbird(): ThunderbirdErkennung | null {
	const pfad = findeThunderbirdPfad();
	if (!pfad) return null;

	const profile = parseProfile(pfad);
	if (profile.length === 0) return null;

	const konten: Record<string, ThunderbirdKonto[]> = {};
	for (const p of profile) {
		konten[p.id] = findeKonten(pfad, p.id);
	}

	return { pfad, profile, konten };
}

export function baueMboxPfad(config: EmailConfig): string {
	return join(config.thunderbirdPfad, config.profil, 'ImapMail', config.konto, config.ordner);
}

// ─── mbox-Leser ──────────────────────────────────────────────────────────────

function leseMboxNachrichten(pfad: string, bytesVomEnde: number): string[] {
	const stat = statSync(pfad);
	const leseGroesse = Math.min(bytesVomEnde, stat.size);
	const startPos = stat.size - leseGroesse;

	const buf = Buffer.alloc(leseGroesse);
	const fd = openSync(pfad, 'r');
	readSync(fd, buf, 0, leseGroesse, startPos);
	closeSync(fd);

	const text = buf.toString('latin1');
	const teile = text.split(/\r?\nFrom [^\r\n]+\r?\n/);

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
	zuAlt: number;
}

export async function scanneMbox(
	mboxPfad: string,
	lieferanten: Lieferant[],
	tageRueckblick: number = 14,
	bytesVomEnde: number = 40 * 1024 * 1024
): Promise<ScanRohErgebnis> {
	const fruehestDatum = new Date();
	fruehestDatum.setDate(fruehestDatum.getDate() - tageRueckblick);
	fruehestDatum.setHours(0, 0, 0, 0);

	const nachrichten = leseMboxNachrichten(mboxPfad, bytesVomEnde);
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

			const pdfAnhaenge = (parsed.attachments ?? []).filter(
				(a) =>
					a.contentType === 'application/pdf' ||
					(a.filename ?? '').toLowerCase().endsWith('.pdf')
			);
			if (pdfAnhaenge.length === 0) continue;

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
