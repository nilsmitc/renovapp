import type { PageServerLoad } from './$types';
import { isClaudeVerfuegbar } from '$lib/aiAnalyse';
import { leseBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';

export const load: PageServerLoad = async () => {
	const claudeVerfuegbar = await isClaudeVerfuegbar();
	const buchungen = leseBuchungen();
	const projekt = leseProjekt();
	const rechnungen = leseRechnungen();

	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);

	return {
		claudeVerfuegbar,
		anzahlBuchungen: buchungen.length,
		anzahlGewerke: projekt.gewerke.length,
		anzahlRechnungen: rechnungen.length,
		gesamtIst,
		gesamtBudget
	};
};
