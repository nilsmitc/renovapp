import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leseRechnungen, leseAngebotRechnung, leseBelegRechnung } from '$lib/dataStore';
import { extrahierePdfDaten } from '$lib/pdfExtract';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface DokumentText {
	dateiname: string;
	text: string;
}

interface AbschlagBeleg extends DokumentText {
	abschlagId: string;
	nummer: number;
	typ: string;
}

interface RechnungDokumente {
	rechnungId: string;
	auftragnehmer: string;
	gewerk: string;
	angebot?: DokumentText;
	belege: AbschlagBeleg[];
}

interface DokumenteExtrakt {
	extrahiert: string;
	anzahlDokumente: number;
	rechnungen: RechnungDokumente[];
}

async function extrahiereText(buffer: Buffer): Promise<string> {
	const result = await extrahierePdfDaten(buffer);
	return result.rohtext;
}

export const GET: RequestHandler = async () => {
	const rechnungen = leseRechnungen();
	const ergebnis: RechnungDokumente[] = [];
	let anzahl = 0;

	for (const r of rechnungen) {
		const entry: RechnungDokumente = {
			rechnungId: r.id,
			auftragnehmer: r.auftragnehmer,
			gewerk: r.gewerk,
			belege: []
		};

		// Angebot extrahieren (nur PDF)
		if (r.angebot && r.angebot.toLowerCase().endsWith('.pdf')) {
			const buffer = leseAngebotRechnung(r.id, r.angebot);
			if (buffer) {
				const text = await extrahiereText(buffer);
				if (text.trim()) {
					entry.angebot = { dateiname: r.angebot, text };
					anzahl++;
				}
			}
		}

		// Abschlag-Belege extrahieren (nur PDF)
		for (const a of r.abschlaege) {
			if (a.beleg && a.beleg.toLowerCase().endsWith('.pdf')) {
				const buffer = leseBelegRechnung(r.id, a.id, a.beleg);
				if (buffer) {
					const text = await extrahiereText(buffer);
					if (text.trim()) {
						entry.belege.push({
							abschlagId: a.id,
							nummer: a.nummer,
							typ: a.typ,
							dateiname: a.beleg,
							text
						});
						anzahl++;
					}
				}
			}
		}

		if (entry.angebot || entry.belege.length > 0) {
			ergebnis.push(entry);
		}
	}

	const extrakt: DokumenteExtrakt = {
		extrahiert: new Date().toISOString(),
		anzahlDokumente: anzahl,
		rechnungen: ergebnis
	};

	// Datei schreiben
	const pfad = join(process.cwd(), 'data', 'dokumente-texte.json');
	writeFileSync(pfad, JSON.stringify(extrakt, null, 2), 'utf-8');

	return json({ erfolg: true, anzahlDokumente: anzahl });
};
