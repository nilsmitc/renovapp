import type { Actions, PageServerLoad } from './$types';
import { leseRechnungen, schreibeRechnungen, leseProjekt } from '$lib/dataStore';
import { createRechnung, abschlagEffektivStatus } from '$lib/domain';
import { fail, redirect } from '@sveltejs/kit';
import type { Kategorie } from '$lib/domain';
import { berechneNaechsteZahlungen } from '$lib/reportData';

export const load: PageServerLoad = ({ url }) => {
	const alleRechnungen = leseRechnungen();
	const projekt = leseProjekt();

	// Ansicht: 'auftraege' (default) oder 'angebote'
	const ansicht = url.searchParams.get('ansicht') === 'angebote' ? 'angebote' : 'auftraege';
	const rechnungen = alleRechnungen.filter(r => r.status === (ansicht === 'angebote' ? 'angebot' : 'auftrag'));

	// URL-Filter
	const gewerkFilter = url.searchParams.get('gewerk');
	const statusFilter = url.searchParams.get('status') || 'alle';
	const sucheFilter = url.searchParams.get('suche') || '';
	const sortierung = url.searchParams.get('sortierung') || 'gewerk';

	// Filtern
	let gefiltert = gewerkFilter
		? rechnungen.filter(r => r.gewerk === gewerkFilter)
		: rechnungen;

	if (sucheFilter) {
		const q = sucheFilter.toLowerCase();
		gefiltert = gefiltert.filter(r =>
			r.auftragnehmer.toLowerCase().includes(q) ||
			(r.notiz?.toLowerCase().includes(q))
		);
	}

	if (statusFilter !== 'alle') {
		gefiltert = gefiltert.filter(r => {
			const hatBezahlte = r.abschlaege.some(a => a.status === 'bezahlt');
			const hatOffene = r.abschlaege.some(a => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			});
			if (statusFilter === 'offen') return hatOffene;
			if (statusFilter === 'bezahlt') return hatBezahlte && !hatOffene && r.abschlaege.length > 0;
			if (statusFilter === 'ohne-abschlaege') return r.abschlaege.length === 0;
			return true;
		});
	}

	// Angebote-Aggregate
	const angebote = alleRechnungen.filter(r => r.status === 'angebot');
	const angeboteVolumen = angebote.reduce((s, r) => s + (r.auftragssumme ?? 0), 0);

	// Aggregate über alle Aufträge (vor Filter, damit KPIs immer den Gesamtstand zeigen)
	const auftraege = alleRechnungen.filter(r => r.status === 'auftrag');
	let gesamtVolumen = 0;
	let gesamtBezahlt = 0;
	let gesamtOffen = 0;
	let gesamtGestellt = 0;
	let hatUeberfaellige = false;
	let hatBaldFaellige = false;
	let anzahlOffeneAbschlaege = 0;
	const gewerkAggregate: Record<string, { bezahlt: number; offen: number; gestellt: number; volumen: number }> = {};

	for (const r of auftraege) {
		const nachtraegeSum = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
		const volumen = (r.auftragssumme ?? 0) + nachtraegeSum;
		gesamtVolumen += volumen;

		if (!gewerkAggregate[r.gewerk]) {
			gewerkAggregate[r.gewerk] = { bezahlt: 0, offen: 0, gestellt: 0, volumen: 0 };
		}
		gewerkAggregate[r.gewerk].volumen += volumen;

		for (const a of r.abschlaege) {
			gesamtGestellt += a.rechnungsbetrag;
			gewerkAggregate[r.gewerk].gestellt += a.rechnungsbetrag;

			if (a.status === 'bezahlt') {
				gesamtBezahlt += a.rechnungsbetrag;
				gewerkAggregate[r.gewerk].bezahlt += a.rechnungsbetrag;
			} else {
				const effStatus = abschlagEffektivStatus(a);
				if (effStatus === 'offen' || effStatus === 'ueberfaellig' || effStatus === 'bald_faellig') {
					gesamtOffen += a.rechnungsbetrag;
					gewerkAggregate[r.gewerk].offen += a.rechnungsbetrag;
					anzahlOffeneAbschlaege++;
				}
				if (effStatus === 'ueberfaellig') hatUeberfaellige = true;
				if (effStatus === 'bald_faellig') hatBaldFaellige = true;
			}
		}
	}

	const gesamtRestauftrag = Math.max(0, gesamtVolumen - gesamtGestellt);

	// Nächste Zahlungen (nur über Aufträge, nicht Angebote)
	const naechsteZahlungen = berechneNaechsteZahlungen(auftraege, projekt.gewerke).slice(0, 5);

	return {
		ansicht,
		rechnungen: gefiltert,
		angebote,
		angeboteVolumen,
		gewerke: projekt.gewerke,
		gewerkeInAuftraegen: projekt.gewerke.filter(g => rechnungen.some(r => r.gewerk === g.id)),
		gewerkFilter,
		statusFilter,
		sucheFilter,
		sortierung,
		gesamtVolumen,
		gesamtBezahlt,
		gesamtOffen,
		gesamtRestauftrag,
		hatUeberfaellige,
		hatBaldFaellige,
		anzahlOffeneAbschlaege,
		naechsteZahlungen,
		gewerkAggregate,
		anzahlAuftraege: auftraege.length
	};
};

export const actions: Actions = {
	erstellen: async ({ request }) => {
		const form = await request.formData();
		const gewerk = (form.get('gewerk') as string)?.trim();
		const auftragnehmer = (form.get('auftragnehmer') as string)?.trim();
		const kategorie = (form.get('kategorie') as string) as Kategorie;
		const auftragssummeRaw = (form.get('auftragssumme') as string)?.trim();
		const auftragsdatum = (form.get('auftragsdatum') as string)?.trim() || undefined;
		const notiz = (form.get('notiz') as string)?.trim() || undefined;
		const statusRaw = (form.get('status') as string)?.trim();
		const status = statusRaw === 'angebot' ? 'angebot' : 'auftrag';

		if (!gewerk) return fail(400, { error: 'Gewerk ist erforderlich' });
		if (!auftragnehmer) return fail(400, { error: 'Auftragnehmer ist erforderlich' });
		if (!['Material', 'Arbeitslohn', 'Sonstiges'].includes(kategorie)) {
			return fail(400, { error: 'Ungültige Kategorie' });
		}

		const projekt = leseProjekt();
		if (!projekt.gewerke.find((g) => g.id === gewerk)) {
			return fail(400, { error: 'Unbekanntes Gewerk' });
		}

		let auftragssumme: number | undefined;
		if (auftragssummeRaw) {
			const cleaned = auftragssummeRaw.replace(/\s/g, '').replaceAll('.', '').replace(',', '.');
			const num = parseFloat(cleaned);
			if (!isNaN(num) && num > 0) auftragssumme = Math.round(num * 100);
		}

		const rechnung = createRechnung(gewerk, auftragnehmer, kategorie, status);
		if (auftragssumme !== undefined) rechnung.auftragssumme = auftragssumme;
		if (auftragsdatum) rechnung.auftragsdatum = auftragsdatum;
		if (notiz) rechnung.notiz = notiz;

		const rechnungen = leseRechnungen();
		rechnungen.push(rechnung);
		schreibeRechnungen(rechnungen);

		throw redirect(303, `/rechnungen/${rechnung.id}`);
	},

	loeschen: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID fehlt' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === id);
		if (!rechnung) return fail(404, { error: 'Rechnung nicht gefunden' });

		const hatBezahlteAbschlaege = rechnung.abschlaege.some((a) => a.status === 'bezahlt');
		if (hatBezahlteAbschlaege) {
			return fail(400, { error: 'Rechnung mit bezahlten Abschlägen kann nicht gelöscht werden' });
		}

		schreibeRechnungen(rechnungen.filter((r) => r.id !== id));
		return { success: true };
	},

	zuAuftragMachen: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID fehlt' });

		const rechnungen = leseRechnungen();
		const rechnung = rechnungen.find((r) => r.id === id);
		if (!rechnung) return fail(404, { error: 'Angebot nicht gefunden' });

		rechnung.status = 'auftrag';
		if (!rechnung.auftragsdatum) rechnung.auftragsdatum = new Date().toISOString().slice(0, 10);
		rechnung.geaendert = new Date().toISOString();
		schreibeRechnungen(rechnungen);
		throw redirect(303, `/rechnungen/${id}`);
	}
};
