import type { Actions, PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, schreibeBuchungen, speicherBeleg, loescheBeleg, loescheBelegeOrdner, leseLieferanten, schreibeLieferanten, speicherBelegLieferung, loescheBelegLieferung } from '$lib/dataStore';
import { validateBuchung, KATEGORIEN, type Kategorie } from '$lib/domain';
import { parseCentsFromInput } from '$lib/format';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = ({ params }) => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const buchung = buchungen.find((b) => b.id === params.id);

	if (!buchung) throw error(404, 'Buchung nicht gefunden');

	const { lieferanten, lieferungen } = leseLieferanten();

	return {
		buchung,
		gewerke: projekt.gewerke,
		raeume: projekt.raeume,
		kategorien: KATEGORIEN,
		lieferanten,
		lieferungen
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();

		const isRueckbuchung = form.get('rueckbuchung') === 'on';
		const betragRaw = parseCentsFromInput(form.get('betrag') as string);
		const betrag = isRueckbuchung ? -Math.abs(betragRaw) : Math.abs(betragRaw);
		const taetigkeit = (form.get('taetigkeit') as string)?.trim() || undefined;
		const lieferungId = (form.get('lieferungId') as string)?.trim() || undefined;
		const bezahltam = (form.get('bezahltam') as string)?.trim() || undefined;
		const kategorieRaw = form.get('kategorie') as string;
		if (!KATEGORIEN.includes(kategorieRaw as Kategorie)) {
			return fail(400, { error: `Ungültige Kategorie: "${kategorieRaw}"` });
		}
		const data = {
			datum: form.get('datum') as string,
			betrag,
			gewerk: form.get('gewerk') as string,
			raum: (form.get('raum') as string) || null,
			kategorie: kategorieRaw as Kategorie,
			beschreibung: (form.get('beschreibung') as string)?.trim(),
			rechnungsreferenz: (form.get('rechnungsreferenz') as string)?.trim() || '',
			bezahltam,
			taetigkeit,
			lieferungId
		};

		const projekt = leseProjekt();
		const errors = validateBuchung(data, projekt.gewerke);
		if (errors.length > 0) {
			return fail(400, { error: errors.join(', '), values: data });
		}

		const buchungen = leseBuchungen();
		const idx = buchungen.findIndex((b) => b.id === params.id);
		if (idx === -1) return fail(404, { error: 'Buchung nicht gefunden' });

		// Neue Belege verarbeiten (Buffer einmalig lesen)
		const neueBelege = [...buchungen[idx].belege];
		const dateien = form.getAll('belege') as File[];
		const belegBuffers: { name: string; buffer: Buffer }[] = [];
		for (const datei of dateien) {
			if (datei.size > 0 && datei.name) {
				belegBuffers.push({ name: datei.name, buffer: Buffer.from(await datei.arrayBuffer()) });
			}
		}
		for (const { name, buffer } of belegBuffers) {
			const safe = speicherBeleg(params.id, name, buffer);
			if (!neueBelege.includes(safe)) neueBelege.push(safe);
		}

		buchungen[idx] = {
			...buchungen[idx],
			...data,
			rechnungId: buchungen[idx].rechnungId,   // auto-Link erhalten – nicht über Formular editierbar
			lieferungId: buchungen[idx].lieferungId, // auto-Link erhalten – nicht über Formular editierbar
			belege: neueBelege,
			geaendert: new Date().toISOString()
		};
		schreibeBuchungen(buchungen);

		// Rück-Sync: Wenn diese Buchung aus einer Lieferung stammt, Lieferung aktualisieren
		const lieferungIdLink = buchungen[idx].lieferungId;
		if (lieferungIdLink) {
			const { lieferanten, lieferungen } = leseLieferanten();
			const lieferungIdx = lieferungen.findIndex((l) => l.id === lieferungIdLink);
			if (lieferungIdx !== -1) {
				lieferungen[lieferungIdx].betrag = data.betrag;
				lieferungen[lieferungIdx].datum = data.datum;
				if (data.gewerk) lieferungen[lieferungIdx].gewerk = data.gewerk;
				if (data.rechnungsreferenz) lieferungen[lieferungIdx].rechnungsnummer = data.rechnungsreferenz;
				lieferungen[lieferungIdx].geaendert = new Date().toISOString();

				// Neue Belege auch in die Lieferung kopieren
				for (const { name, buffer } of belegBuffers) {
					const safe = speicherBelegLieferung(lieferungIdLink, name, buffer);
					if (!lieferungen[lieferungIdx].belege) lieferungen[lieferungIdx].belege = [];
					if (!lieferungen[lieferungIdx].belege.includes(safe)) {
						lieferungen[lieferungIdx].belege.push(safe);
					}
				}

				schreibeLieferanten({ lieferanten, lieferungen });
			}
		}

		throw redirect(303, '/buchungen');
	},

	deleteBeleg: async ({ request, params }) => {
		const form = await request.formData();
		const dateiname = form.get('dateiname') as string;

		const buchungen = leseBuchungen();
		const idx = buchungen.findIndex((b) => b.id === params.id);
		if (idx === -1) return fail(404, { error: 'Buchung nicht gefunden' });

		loescheBeleg(params.id, dateiname);
		buchungen[idx].belege = buchungen[idx].belege.filter((b) => b !== dateiname);
		buchungen[idx].geaendert = new Date().toISOString();
		schreibeBuchungen(buchungen);

		// Rück-Sync: Beleg auch aus verknüpfter Lieferung entfernen
		const lieferungIdLink = buchungen[idx].lieferungId;
		if (lieferungIdLink) {
			const { lieferanten, lieferungen } = leseLieferanten();
			const lieferungIdx = lieferungen.findIndex((l) => l.id === lieferungIdLink);
			if (lieferungIdx !== -1 && lieferungen[lieferungIdx].belege?.includes(dateiname)) {
				loescheBelegLieferung(lieferungIdLink, dateiname);
				lieferungen[lieferungIdx].belege = lieferungen[lieferungIdx].belege.filter((b) => b !== dateiname);
				lieferungen[lieferungIdx].geaendert = new Date().toISOString();
				schreibeLieferanten({ lieferanten, lieferungen });
			}
		}

		return { success: true };
	},

	delete: async ({ params }) => {
		loescheBelegeOrdner(params.id);
		const buchungen = leseBuchungen();
		const filtered = buchungen.filter((b) => b.id !== params.id);
		schreibeBuchungen(filtered);
		throw redirect(303, '/buchungen');
	}
};
