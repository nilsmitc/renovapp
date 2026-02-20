import type { Actions, PageServerLoad } from './$types';
import { leseProjekt, schreibeProjekt, leseBuchungen } from '$lib/dataStore';
import { slugify } from '$lib/domain';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	return { gewerke: projekt.gewerke };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const farbe = (form.get('farbe') as string) || '#6B7280';

		if (!name) return fail(400, { error: 'Name ist erforderlich' });
		if (farbe && !/^#[0-9A-Fa-f]{6}$/.test(farbe)) {
			return fail(400, { error: 'Ungültige Farbe (Hex-Format erwartet, z.B. #3B82F6)' });
		}

		const projekt = leseProjekt();
		const id = slugify(name);

		if (projekt.gewerke.find((g) => g.id === id)) {
			return fail(400, { error: 'Gewerk existiert bereits' });
		}

		const sortierung = projekt.gewerke.length;
		projekt.gewerke.push({ id, name, farbe, sortierung });
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
		if (buchungen.some((b) => b.gewerk === id)) {
			return fail(400, { error: 'Gewerk hat noch Buchungen und kann nicht gelöscht werden' });
		}

		const projekt = leseProjekt();
		projekt.gewerke = projekt.gewerke.filter((g) => g.id !== id);
		projekt.budgets = projekt.budgets.filter((b) => b.gewerk !== id);
		schreibeProjekt(projekt);
		return { success: true };
	}
};
