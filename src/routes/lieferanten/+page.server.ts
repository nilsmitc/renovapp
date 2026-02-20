import type { Actions, PageServerLoad } from './$types';
import { leseLieferanten, schreibeLieferanten } from '$lib/dataStore';
import { createLieferant } from '$lib/domain';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const { lieferanten, lieferungen } = leseLieferanten();

	// Gesamtausgaben (Händlerrechnungen) + Anzahl Lieferungen pro Lieferant berechnen
	const stats = lieferanten.map((l) => {
		const lieferungenVonLieferant = lieferungen.filter((lu) => lu.lieferantId === l.id);
		const gesamtBetrag = lieferungenVonLieferant.reduce((s, lu) => s + (lu.betrag ?? 0), 0);
		return {
			lieferant: l,
			gesamtBetrag,
			anzahlLieferungen: lieferungenVonLieferant.length
		};
	});

	// Absteigend nach Gesamtbetrag sortieren
	stats.sort((a, b) => b.gesamtBetrag - a.gesamtBetrag);

	return { stats };
};

export const actions: Actions = {
	anlegen: async ({ request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const notiz = (form.get('notiz') as string)?.trim() || undefined;

		if (!name) return fail(400, { error: 'Name ist erforderlich' });

		const { lieferanten, lieferungen } = leseLieferanten();

		const lieferant = createLieferant(name, notiz);

		// Doppelte ID verhindern (z.B. "Hornbach" → "hornbach" existiert schon)
		if (lieferanten.find((l) => l.id === lieferant.id)) {
			return fail(400, { error: `Lieferant "${name}" existiert bereits` });
		}

		lieferanten.push(lieferant);
		schreibeLieferanten({ lieferanten, lieferungen });

		throw redirect(303, `/lieferanten/${lieferant.id}`);
	},

	loeschen: async ({ request }) => {
		const form = await request.formData();
		const id = (form.get('id') as string)?.trim();
		if (!id) return fail(400, { error: 'ID fehlt' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === id);
		if (!lieferant) return fail(404, { error: 'Lieferant nicht gefunden' });

		const hatLieferungen = lieferungen.some((lu) => lu.lieferantId === id);
		if (hatLieferungen) {
			return fail(400, { error: 'Lieferant mit Lieferungen kann nicht gelöscht werden' });
		}

		schreibeLieferanten({
			lieferanten: lieferanten.filter((l) => l.id !== id),
			lieferungen
		});
		return { success: true };
	}
};
