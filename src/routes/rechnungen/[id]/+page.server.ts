import type { Actions, PageServerLoad } from './$types';
import {
	leseRechnungen,
	schreibeRechnungen,
	leseBuchungen,
	schreibeBuchungen,
	leseProjekt,
	speicherBelegRechnung,
	loescheBelegRechnung
} from '$lib/dataStore';
import {
	createAbschlag,
	createBuchung,
	createNachtrag,
	abschlagEffektivStatus
} from '$lib/domain';
import type { AbschlagTyp } from '$lib/domain';
import { fail, error } from '@sveltejs/kit';

export const load: PageServerLoad = ({ params }) => {
	const rechnungen = leseRechnungen();
	const rechnung = rechnungen.find((r) => r.id === params.id);
	if (!rechnung) error(404, 'Rechnung nicht gefunden');

	rechnung.abschlaege.sort((a, b) => {
		if (a.faelligkeitsdatum && b.faelligkeitsdatum) {
			return a.faelligkeitsdatum.localeCompare(b.faelligkeitsdatum);
		}
		if (a.faelligkeitsdatum) return -1;
		if (b.faelligkeitsdatum) return 1;
		return a.erstellt.localeCompare(b.erstellt);
	});

	const projekt = leseProjekt();
	const gewerk = projekt.gewerke.find((g) => g.id === rechnung.gewerk);

	return { rechnung, gewerk };
};

export const actions: Actions = {
	abschlagHinzufuegen: async ({ params, request }) => {
		const form = await request.formData();
		const typ = (form.get('typ') as string) as AbschlagTyp;
		const betragRaw = (form.get('betrag') as string)?.trim();
		const rechnungsnummer = (form.get('rechnungsnummer') as string)?.trim() || undefined;
		const faelligkeitsdatum = (form.get('faelligkeitsdatum') as string)?.trim() || undefined;
		const notiz = (form.get('notiz') as string)?.trim() || undefined;
		const belegFile = form.get('beleg') as File | null;

		if (!['abschlag', 'schlussrechnung', 'nachtragsrechnung'].includes(typ)) {
			return fail(400, { error: 'Ungültiger Typ' });
		}
		if (!betragRaw) return fail(400, { abschlagError: 'Betrag ist erforderlich' });

		const cleaned = betragRaw.replace(/\s/g, '').replaceAll('.', '').replace(',', '.');
		const betrag = Math.round(parseFloat(cleaned) * 100);
		if (isNaN(betrag) || betrag <= 0) return fail(400, { abschlagError: 'Ungültiger Betrag' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { abschlagError: 'Rechnung nicht gefunden' });

		const nummer = rechnung.abschlaege.length + 1;
		const abschlag = createAbschlag(typ, betrag, nummer);
		if (rechnungsnummer) abschlag.rechnungsnummer = rechnungsnummer;
		if (faelligkeitsdatum) abschlag.faelligkeitsdatum = faelligkeitsdatum;
		if (notiz) abschlag.notiz = notiz;

		// Beleg hochladen
		if (belegFile && belegFile.size > 0) {
			const erlaubteTypen = ['application/pdf', 'image/jpeg', 'image/png'];
			if (!erlaubteTypen.includes(belegFile.type)) {
				return fail(400, { abschlagError: 'Nur PDF, JPG und PNG erlaubt' });
			}
			if (belegFile.size > 10 * 1024 * 1024) {
				return fail(400, { abschlagError: 'Datei zu groß (max. 10 MB)' });
			}
			const buffer = Buffer.from(await belegFile.arrayBuffer());
			const gespeicherterName = speicherBelegRechnung(
				rechnung.id,
				abschlag.id,
				belegFile.name,
				buffer
			);
			abschlag.beleg = gespeicherterName;
		}

		rechnung.abschlaege.push(abschlag);
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		return { success: true };
	},

	bezahlen: async ({ params, request }) => {
		const form = await request.formData();
		const abschlagId = form.get('abschlagId') as string;
		const bezahltam = (form.get('bezahltam') as string)?.trim();
		const beschreibung = (form.get('beschreibung') as string)?.trim();

		if (!abschlagId) return fail(400, { bezahlenError: 'Abschlag-ID fehlt' });
		if (!bezahltam) return fail(400, { bezahlenError: 'Bezahlt-Datum ist erforderlich' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { bezahlenError: 'Rechnung nicht gefunden' });

		const abschlag = rechnung.abschlaege.find((a) => a.id === abschlagId);
		if (!abschlag) return fail(404, { bezahlenError: 'Abschlag nicht gefunden' });

		const effektivStatus = abschlagEffektivStatus(abschlag);
		if (effektivStatus === 'bezahlt') return fail(400, { bezahlenError: 'Abschlag bereits bezahlt' });

		const projekt = leseProjekt();

		// Buchung auto-erstellen
		const typLabel: Record<string, string> = {
			abschlag: 'Abschlag',
			schlussrechnung: 'Schlussrechnung',
			nachtragsrechnung: 'Nachtrag'
		};
		const defaultBeschreibung = `${rechnung.auftragnehmer} – ${typLabel[abschlag.typ] ?? abschlag.typ} ${abschlag.nummer}`;

		const buchung = createBuchung({
			datum: bezahltam,
			betrag: abschlag.rechnungsbetrag,
			gewerk: rechnung.gewerk,
			raum: null,
			kategorie: rechnung.kategorie,
			beschreibung: beschreibung?.trim() || defaultBeschreibung,
			rechnungsreferenz: abschlag.rechnungsnummer ?? ''
		});
		buchung.rechnungId = rechnung.id;

		const buchungen = leseBuchungen();
		buchungen.push(buchung);
		schreibeBuchungen(buchungen);

		// Abschlag als bezahlt markieren
		abschlag.status = 'bezahlt';
		abschlag.bezahltam = bezahltam;
		abschlag.buchungId = buchung.id;
		abschlag.geaendert = new Date().toISOString();
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);

		return { success: true };
	},

	abschlagLoeschen: async ({ params, request }) => {
		const form = await request.formData();
		const abschlagId = form.get('abschlagId') as string;
		if (!abschlagId) return fail(400, { error: 'Abschlag-ID fehlt' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { error: 'Rechnung nicht gefunden' });

		const abschlag = rechnung.abschlaege.find((a) => a.id === abschlagId);
		if (!abschlag) return fail(404, { error: 'Abschlag nicht gefunden' });

		if (abschlag.status === 'bezahlt') {
			return fail(400, { error: 'Bezahlte Abschläge können nicht gelöscht werden' });
		}

		// Beleg löschen falls vorhanden
		if (abschlag.beleg) {
			loescheBelegRechnung(rechnung.id, abschlag.id, abschlag.beleg);
		}

		rechnung.abschlaege = rechnung.abschlaege.filter((a) => a.id !== abschlagId);
		// Nummern neu vergeben
		rechnung.abschlaege.forEach((a, i) => (a.nummer = i + 1));
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		return { success: true };
	},

	nachtragHinzufuegen: async ({ params, request }) => {
		const form = await request.formData();
		const beschreibung = (form.get('beschreibung') as string)?.trim();
		const betragRaw = (form.get('betrag') as string)?.trim();
		const datum = (form.get('datum') as string)?.trim() || undefined;
		const notiz = (form.get('notiz') as string)?.trim() || undefined;

		if (!beschreibung) return fail(400, { nachtragError: 'Beschreibung ist erforderlich' });
		if (!betragRaw) return fail(400, { nachtragError: 'Betrag ist erforderlich' });

		const cleaned = betragRaw.replace(/\s/g, '').replaceAll('.', '').replace(',', '.');
		const betrag = Math.round(parseFloat(cleaned) * 100);
		if (isNaN(betrag) || betrag <= 0) return fail(400, { nachtragError: 'Ungültiger Betrag' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { nachtragError: 'Rechnung nicht gefunden' });

		const nachtrag = createNachtrag(beschreibung, betrag);
		if (datum) nachtrag.datum = datum;
		if (notiz) nachtrag.notiz = notiz;

		rechnung.nachtraege.push(nachtrag);
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		return { success: true };
	},

	nachtragLoeschen: async ({ params, request }) => {
		const form = await request.formData();
		const nachtragId = form.get('nachtragId') as string;
		if (!nachtragId) return fail(400, { error: 'Nachtrag-ID fehlt' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { error: 'Rechnung nicht gefunden' });

		rechnung.nachtraege = rechnung.nachtraege.filter((n) => n.id !== nachtragId);
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		return { success: true };
	},

	rechnungBearbeiten: async ({ params, request }) => {
		const form = await request.formData();
		const auftragnehmer = (form.get('auftragnehmer') as string)?.trim();
		const auftragssummeRaw = (form.get('auftragssumme') as string)?.trim();
		const auftragsdatum = (form.get('auftragsdatum') as string)?.trim() || undefined;
		const notiz = (form.get('notiz') as string)?.trim() || undefined;

		if (!auftragnehmer) return fail(400, { editError: 'Auftragnehmer ist erforderlich' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === params.id);
		if (!rechnung) return fail(404, { editError: 'Rechnung nicht gefunden' });

		let auftragssumme: number | undefined;
		if (auftragssummeRaw) {
			const cleaned = auftragssummeRaw.replace(/\s/g, '').replaceAll('.', '').replace(',', '.');
			const num = parseFloat(cleaned);
			if (!isNaN(num) && num > 0) auftragssumme = Math.round(num * 100);
		}

		rechnung.auftragnehmer = auftragnehmer;
		// Auftragssumme nur überschreiben wenn Feld ausgefüllt – leer lassen = bestehenden Wert behalten
		if (auftragssummeRaw) {
			if (auftragssumme !== undefined) {
				rechnung.auftragssumme = auftragssumme;
			} else {
				return fail(400, { editError: 'Ungültige Auftragssumme' });
			}
		}
		rechnung.auftragsdatum = auftragsdatum;
		rechnung.notiz = notiz;
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		return { success: true };
	}
};
