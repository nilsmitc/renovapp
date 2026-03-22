import type { Actions, PageServerLoad } from './$types';
import { leseProjekt, schreibeProjekt, leseBuchungen } from '$lib/dataStore';
import { slugify } from '$lib/domain';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();

	// Kosten pro Raum berechnen
	const raumInfo: Record<string, { ist: number; anzahlBuchungen: number; nachGewerk: Record<string, number> }> = {};
	const geschossInfo: Record<string, { ist: number; anzahl: number }> = {};
	let gesamtIst = 0;

	for (const b of buchungen) {
		if (!b.raum) continue;
		gesamtIst += b.betrag;

		if (!raumInfo[b.raum]) raumInfo[b.raum] = { ist: 0, anzahlBuchungen: 0, nachGewerk: {} };
		raumInfo[b.raum].ist += b.betrag;
		raumInfo[b.raum].anzahlBuchungen++;
		raumInfo[b.raum].nachGewerk[b.gewerk] = (raumInfo[b.raum].nachGewerk[b.gewerk] ?? 0) + b.betrag;
	}

	// Geschoss-Aggregate
	for (const r of projekt.raeume) {
		if (!geschossInfo[r.geschoss]) geschossInfo[r.geschoss] = { ist: 0, anzahl: 0 };
		geschossInfo[r.geschoss].anzahl++;
		const info = raumInfo[r.id];
		if (info) geschossInfo[r.geschoss].ist += info.ist;
	}
	// Stockwerk-Buchungen (@EG etc.) dazurechnen
	for (const [key, info] of Object.entries(raumInfo)) {
		if (key.startsWith('@')) {
			const geschoss = key.slice(1);
			if (!geschossInfo[geschoss]) geschossInfo[geschoss] = { ist: 0, anzahl: 0 };
			geschossInfo[geschoss].ist += info.ist;
		}
	}

	// Teuerster Raum
	let topRaumId: string | null = null;
	let topRaumIst = 0;
	for (const r of projekt.raeume) {
		const ist = raumInfo[r.id]?.ist ?? 0;
		if (ist > topRaumIst) { topRaumIst = ist; topRaumId = r.id; }
	}

	return {
		raeume: projekt.raeume.toSorted((a, b) => a.sortierung - b.sortierung),
		gewerke: projekt.gewerke,
		raumInfo,
		geschossInfo,
		gesamtIst,
		topRaumId,
		topRaumIst
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const geschoss = (form.get('geschoss') as string)?.trim();
		const flaecheRaw = (form.get('flaeche') as string)?.trim();

		if (!name) return fail(400, { error: 'Name ist erforderlich' });
		if (!geschoss) return fail(400, { error: 'Geschoss ist erforderlich' });

		const projekt = leseProjekt();
		const id = slugify(`${name}-${geschoss}`);

		if (projekt.raeume.find((r) => r.id === id)) {
			return fail(400, { error: 'Raum existiert bereits' });
		}

		const sortierung = projekt.raeume.length > 0
			? Math.max(...projekt.raeume.map(r => r.sortierung)) + 1
			: 0;

		const raum: typeof projekt.raeume[0] = { id, name, geschoss, sortierung };
		if (flaecheRaw) {
			const f = parseFloat(flaecheRaw.replace(',', '.'));
			if (!isNaN(f) && f > 0) raum.flaeche = f;
		}

		projekt.raeume.push(raum);
		schreibeProjekt(projekt);
		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = (form.get('name') as string)?.trim();
		const geschoss = (form.get('geschoss') as string)?.trim();
		const flaecheRaw = (form.get('flaeche') as string)?.trim();

		if (!name || !geschoss) return fail(400, { error: 'Name und Geschoss sind erforderlich' });

		const projekt = leseProjekt();
		const raum = projekt.raeume.find((r) => r.id === id);
		if (!raum) return fail(404, { error: 'Raum nicht gefunden' });

		raum.name = name;
		raum.geschoss = geschoss;
		if (flaecheRaw) {
			const f = parseFloat(flaecheRaw.replace(',', '.'));
			if (!isNaN(f) && f > 0) raum.flaeche = f;
			else raum.flaeche = undefined;
		} else {
			raum.flaeche = undefined;
		}

		schreibeProjekt(projekt);
		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;

		const buchungen = leseBuchungen();
		const anzahl = buchungen.filter(b => b.raum === id).length;

		if (anzahl > 0) {
			return fail(400, { error: `Raum hat ${anzahl} Buchung${anzahl > 1 ? 'en' : ''} — zuerst umbuchen oder löschen` });
		}

		const projekt = leseProjekt();
		projekt.raeume = projekt.raeume.filter((r) => r.id !== id);
		schreibeProjekt(projekt);
		return { success: true };
	},

	sortieren: async ({ request }) => {
		const form = await request.formData();
		const reihenfolgeRaw = form.get('reihenfolge') as string;
		if (!reihenfolgeRaw) return fail(400, { error: 'Reihenfolge fehlt' });

		let reihenfolge: string[];
		try {
			reihenfolge = JSON.parse(reihenfolgeRaw);
		} catch {
			return fail(400, { error: 'Ungültiges Format' });
		}

		const projekt = leseProjekt();
		for (const raum of projekt.raeume) {
			const idx = reihenfolge.indexOf(raum.id);
			if (idx !== -1) raum.sortierung = idx;
		}
		schreibeProjekt(projekt);
		return { success: true };
	}
};
