import type { Actions, PageServerLoad } from './$types';
import { leseProjekt, schreibeProjekt, leseBuchungen, leseRechnungen } from '$lib/dataStore';
import { slugify } from '$lib/domain';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();

	// Budget & Ist pro Gewerk berechnen
	const gewerkInfo: Record<string, { ist: number; budget: number; anzahlBuchungen: number; anzahlAuftraege: number }> = {};
	let gesamtBudget = 0;
	let gesamtIst = 0;

	for (const g of projekt.gewerke) {
		const budget = projekt.budgets.find(b => b.gewerk === g.id);
		const geplant = budget?.geplant ?? 0;
		const gBuchungen = buchungen.filter(b => b.gewerk === g.id);
		const ist = gBuchungen.reduce((s, b) => s + b.betrag, 0);
		const anzahlAuftraege = rechnungen.filter(r => r.gewerk === g.id).length;

		gewerkInfo[g.id] = { ist, budget: geplant, anzahlBuchungen: gBuchungen.length, anzahlAuftraege };
		gesamtBudget += geplant;
		gesamtIst += ist;
	}

	return {
		gewerke: projekt.gewerke.toSorted((a, b) => a.sortierung - b.sortierung),
		gewerkInfo,
		gesamtBudget,
		gesamtIst
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const farbe = (form.get('farbe') as string) || '#6B7280';
		const pauschal = form.get('pauschal') === 'on';

		if (!name) return fail(400, { error: 'Name ist erforderlich' });
		if (farbe && !/^#[0-9A-Fa-f]{6}$/.test(farbe)) {
			return fail(400, { error: 'Ungültige Farbe (Hex-Format erwartet, z.B. #3B82F6)' });
		}

		const projekt = leseProjekt();
		const id = slugify(name);

		if (projekt.gewerke.find((g) => g.id === id)) {
			return fail(400, { error: 'Gewerk existiert bereits' });
		}

		const sortierung = projekt.gewerke.length > 0
			? Math.max(...projekt.gewerke.map(g => g.sortierung)) + 1
			: 0;
		projekt.gewerke.push({ id, name, farbe, sortierung, pauschal: pauschal || undefined });
		projekt.budgets.push({ gewerk: id, geplant: 0, notiz: '' });
		schreibeProjekt(projekt);
		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = (form.get('name') as string)?.trim();
		const farbe = form.get('farbe') as string;
		const pauschal = form.get('pauschal') === 'on';

		if (!name) return fail(400, { error: 'Name ist erforderlich' });
		if (farbe && !/^#[0-9A-Fa-f]{6}$/.test(farbe)) {
			return fail(400, { error: 'Ungültige Farbe (Hex-Format erwartet, z.B. #3B82F6)' });
		}

		const projekt = leseProjekt();
		const gewerk = projekt.gewerke.find((g) => g.id === id);
		if (!gewerk) return fail(404, { error: 'Gewerk nicht gefunden' });

		gewerk.name = name;
		gewerk.farbe = farbe;
		gewerk.pauschal = pauschal || undefined;
		schreibeProjekt(projekt);
		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;

		const buchungen = leseBuchungen();
		const rechnungen = leseRechnungen();
		const anzahlBuchungen = buchungen.filter(b => b.gewerk === id).length;
		const anzahlAuftraege = rechnungen.filter(r => r.gewerk === id).length;

		if (anzahlBuchungen > 0 || anzahlAuftraege > 0) {
			const teile = [];
			if (anzahlBuchungen > 0) teile.push(`${anzahlBuchungen} Buchung${anzahlBuchungen > 1 ? 'en' : ''}`);
			if (anzahlAuftraege > 0) teile.push(`${anzahlAuftraege} Auftrag${anzahlAuftraege > 1 ? 'Aufträge' : ''}`);
			return fail(400, { error: `Gewerk hat ${teile.join(' und ')} — zuerst umbuchen oder löschen` });
		}

		const projekt = leseProjekt();
		projekt.gewerke = projekt.gewerke.filter((g) => g.id !== id);
		projekt.budgets = projekt.budgets.filter((b) => b.gewerk !== id);
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
		for (const gewerk of projekt.gewerke) {
			const idx = reihenfolge.indexOf(gewerk.id);
			if (idx !== -1) {
				gewerk.sortierung = idx;
			}
		}
		schreibeProjekt(projekt);
		return { success: true };
	}
};
