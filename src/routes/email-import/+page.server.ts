import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { join } from 'node:path';
import {
	mkdirSync,
	writeFileSync,
	readFileSync,
	existsSync,
	unlinkSync,
	readdirSync
} from 'node:fs';
import crypto from 'node:crypto';
import { scanneMbox, type MailKandidat, type MailScanCache } from '$lib/mailImport';
import { extrahierePdfDaten } from '$lib/pdfExtract';
import {
	leseLieferanten,
	schreibeLieferanten,
	leseBuchungen,
	schreibeBuchungen,
	speicherBelegLieferung,
	leseProjekt
} from '$lib/dataStore';
import { createLieferung, createBuchung } from '$lib/domain';
import { parseCentsFromInput } from '$lib/format';

const DATA_DIR = join(process.cwd(), 'data');
const SCAN_DIR = join(DATA_DIR, 'email-scan');
const CACHE_PATH = join(DATA_DIR, 'email-scan-cache.json');

function leseCache(): MailScanCache | null {
	if (!existsSync(CACHE_PATH)) return null;
	try {
		return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
	} catch {
		return null;
	}
}

function schreibeCache(cache: MailScanCache): void {
	writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}


export const load: PageServerLoad = () => {
	const cache = leseCache();
	const { lieferanten } = leseLieferanten();
	const projekt = leseProjekt();
	return { cache, lieferanten, gewerke: projekt.gewerke };
};

export const actions: Actions = {
	scannen: async () => {
		const { lieferanten } = leseLieferanten();

		if (lieferanten.length === 0) {
			return fail(400, { scanFehler: 'Keine Lieferanten angelegt – bitte zuerst unter /lieferanten anlegen.' });
		}

		mkdirSync(SCAN_DIR, { recursive: true });

		// Bereits verarbeitete messageIds aus altem Cache merken
		const alterCache = leseCache();
		const verarbeitetIds = new Set(
			(alterCache?.kandidaten ?? [])
				.filter((k) => k.uebernommen || k.uebersprungen)
				.map((k) => k.messageId)
		);

		// Bereits erledigte Kandidaten behalten (inkl. ihrer Cache-Dateien)
		const erledigteKandidaten: MailKandidat[] = (alterCache?.kandidaten ?? []).filter(
			(k) => k.uebernommen || k.uebersprungen
		);

		// Nur PDFs von nicht-erledigten Kandidaten löschen
		const behalteneDateien = new Set(erledigteKandidaten.map((k) => k.pdfCacheDatei));
		if (existsSync(SCAN_DIR)) {
			for (const datei of readdirSync(SCAN_DIR)) {
				if (!behalteneDateien.has(datei)) {
					try { unlinkSync(join(SCAN_DIR, datei)); } catch { /* ignorieren */ }
				}
			}
		}

		let rohErgebnis;
		try {
			rohErgebnis = await scanneMbox(lieferanten, 14);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(500, { scanFehler: `Thunderbird-Postfach konnte nicht gelesen werden: ${msg}` });
		}

		const neueKandidaten: MailKandidat[] = [];

		for (const k of rohErgebnis.kandidaten) {
			// Bereits verarbeitete Mails überspringen
			if (verarbeitetIds.has(k.messageId)) continue;

			const id = crypto.randomUUID();
			const safeName = k.pdfDateiname.replace(/[^a-zA-Z0-9._-]/g, '_');
			const cacheDatei = `${id}-${safeName}`;

			// PDF in Scan-Cache speichern
			writeFileSync(join(SCAN_DIR, cacheDatei), k.pdfBuffer);

			// PDF inhaltlich analysieren
			let extraktion: MailKandidat['extraktion'] = {};
			try {
				const result = await extrahierePdfDaten(k.pdfBuffer);
				extraktion = {
					betrag: result.betrag,
					rechnungsnummer: result.rechnungsnummer,
					datum: result.datum
				};
			} catch { /* Extraktion optional */ }

			neueKandidaten.push({
				id,
				messageId: k.messageId,
				datum: k.datum,
				absender: k.absender,
				betreff: k.betreff,
				lieferantId: k.lieferant.id,
				lieferantName: k.lieferant.name,
				pdfDateiname: safeName,
				pdfCacheDatei: cacheDatei,
				extraktion,
				uebernommen: false,
				uebersprungen: false
			});
		}

		// Erledigte behalten + neue anhängen (neueste zuerst)
		const alleKandidaten = [...neueKandidaten, ...erledigteKandidaten];
		schreibeCache({ gescannt: new Date().toISOString(), kandidaten: alleKandidaten });

		return {
			gescannt: true,
			anzahlGefunden: neueKandidaten.length,
			anzahlNachrichten: rohErgebnis.verarbeiteteNachrichten
		};
	},

	uebernehmen: async ({ request }) => {
		const form = await request.formData();
		const id = (form.get('id') as string)?.trim();
		const gewerk = (form.get('gewerk') as string)?.trim();
		const lieferantId = (form.get('lieferantId') as string)?.trim();
		const betragRaw = (form.get('betrag') as string)?.trim();
		const datum = (form.get('datum') as string)?.trim();
		const rechnungsnummer = (form.get('rechnungsnummer') as string)?.trim() || undefined;
		const beschreibung = (form.get('beschreibung') as string)?.trim() || undefined;

		if (!id || !gewerk || !lieferantId || !datum) {
			return fail(400, { uebernehmenFehler: 'Gewerk und Datum sind Pflichtfelder.' });
		}

		const cache = leseCache();
		if (!cache) return fail(400, { uebernehmenFehler: 'Kein Scan-Cache vorhanden – bitte neu scannen.' });

		const kandidat = cache.kandidaten.find((k) => k.id === id);
		if (!kandidat) return fail(404, { uebernehmenFehler: 'Kandidat nicht gefunden.' });
		if (kandidat.uebernommen) return fail(400, { uebernehmenFehler: 'Bereits übernommen.' });

		const betrag = betragRaw ? Math.abs(parseCentsFromInput(betragRaw)) : undefined;
		if (betrag !== undefined && betrag <= 0) {
			return fail(400, { uebernehmenFehler: 'Ungültiger Betrag.' });
		}

		// Lieferant laden
		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === lieferantId);
		if (!lieferant) return fail(404, { uebernehmenFehler: 'Lieferant nicht gefunden.' });

		// Lieferung erstellen
		const lieferung = createLieferung({
			lieferantId,
			datum,
			beschreibung,
			rechnungsnummer,
			betrag,
			gewerk: gewerk || undefined
		});

		// PDF als Beleg übernehmen
		const pdfPfad = join(SCAN_DIR, kandidat.pdfCacheDatei);
		if (existsSync(pdfPfad)) {
			const pdfBuffer = readFileSync(pdfPfad);
			const gespeicherterName = speicherBelegLieferung(lieferung.id, kandidat.pdfDateiname, pdfBuffer);
			lieferung.belege.push(gespeicherterName);
		}

		lieferungen.push(lieferung);

		// Auto-Buchung erstellen wenn betrag + gewerk gesetzt
		const buchungen = leseBuchungen();
		if (betrag && betrag > 0 && gewerk) {
			const buchungsBeschreibung =
				lieferant.name + (lieferung.beschreibung ? ` – ${lieferung.beschreibung}` : '');
			const buchung = createBuchung({
				datum,
				betrag,
				gewerk,
				raum: null,
				kategorie: 'Material',
				beschreibung: buchungsBeschreibung,
				rechnungsreferenz: rechnungsnummer ?? '',
				lieferungId: lieferung.id
			});
			buchungen.push(buchung);
			lieferung.buchungId = buchung.id;
		}

		schreibeLieferanten({ lieferanten, lieferungen });
		schreibeBuchungen(buchungen);

		// Als übernommen markieren
		kandidat.uebernommen = true;
		schreibeCache(cache);

		return { uebernommenErfolg: true, lieferantId };
	},

	ueberspringen: async ({ request }) => {
		const form = await request.formData();
		const id = (form.get('id') as string)?.trim();

		const cache = leseCache();
		if (!cache || !id) return fail(400, { error: 'Fehler' });

		const kandidat = cache.kandidaten.find((k) => k.id === id);
		if (kandidat) {
			kandidat.uebersprungen = true;
			schreibeCache(cache);
		}
		return { uebersprungen: true };
	}
};
