import type { PageServerLoad, Actions } from './$types';
import { leseBuchungen, schreibeBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';
import { parseCentsFromInput } from '$lib/format';
import { fail } from '@sveltejs/kit';
import { berechneSteuerDaten } from '$lib/reportData';

export const load: PageServerLoad = () => {
	const buchungen = leseBuchungen();
	const { gewerke } = leseProjekt();

	// Buchungen die aus Abschlägen auto-erstellt wurden haben belege:[] –
	// der eigentliche Beleg liegt auf dem Abschlag. Deshalb hier nachladen.
	const rechnungen = leseRechnungen();
	const abschlagBelegeSet = new Set<string>();
	for (const r of rechnungen) {
		for (const a of r.abschlaege) {
			if (a.buchungId && a.beleg) abschlagBelegeSet.add(a.buchungId);
		}
	}
	// hatBeleg = eigenes Beleg-Array ODER Beleg auf dem Abschlag
	const belegeVorhanden: Record<string, boolean> = {};
	for (const b of buchungen) {
		belegeVorhanden[b.id] = b.belege.length > 0 || abschlagBelegeSet.has(b.id);
	}
	const gewerkeMap = new Map(gewerke.map((g) => [g.id, g.name]));

	// Nur positive Arbeitslohn-Buchungen sind §35a-Kandidaten
	const kandidaten = buchungen
		.filter((b) => b.kategorie === 'Arbeitslohn' && b.betrag > 0)
		.sort((a, b) => b.datum.localeCompare(a.datum));

	const bestaetigt = kandidaten.filter((b) => b.steuerrelevant === true);
	const vorschlaege = kandidaten.filter((b) => b.steuerrelevant !== true);

	const jahre = berechneSteuerDaten(buchungen);

	return { bestaetigt, vorschlaege, jahre, gewerkeMap: Object.fromEntries(gewerkeMap), belegeVorhanden };
};

export const actions: Actions = {
	markieren: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const relevant = formData.get('steuerrelevant') === 'true';
		const anteilRaw = (formData.get('arbeitsanteilEuro') as string) ?? '';

		const buchungen = leseBuchungen();
		const idx = buchungen.findIndex((b) => b.id === id);
		if (idx === -1) return fail(404, { error: 'Buchung nicht gefunden' });

		let arbeitsanteilCents: number | undefined = undefined;
		if (relevant && anteilRaw.trim() !== '') {
			const parsed = parseCentsFromInput(anteilRaw);
			if (parsed > 0 && parsed < buchungen[idx].betrag) {
				arbeitsanteilCents = parsed;
			}
		}

		buchungen[idx] = {
			...buchungen[idx],
			steuerrelevant: relevant ? true : undefined,
			arbeitsanteilCents: relevant ? arbeitsanteilCents : undefined,
			geaendert: new Date().toISOString()
		};
		schreibeBuchungen(buchungen);
	}
};
