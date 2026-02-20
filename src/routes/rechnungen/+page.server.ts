import type { Actions, PageServerLoad } from './$types';
import { leseRechnungen, schreibeRechnungen, leseProjekt } from '$lib/dataStore';
import { createRechnung } from '$lib/domain';
import { fail, redirect } from '@sveltejs/kit';
import type { Kategorie } from '$lib/domain';

export const load: PageServerLoad = () => {
	const rechnungen = leseRechnungen();
	const projekt = leseProjekt();
	return { rechnungen, gewerke: projekt.gewerke };
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

		const rechnung = createRechnung(gewerk, auftragnehmer, kategorie);
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
	}
};
