import type { Actions, PageServerLoad } from './$types';
import { leseProjekt, schreibeProjekt, leseBuchungen, leseRechnungen } from '$lib/dataStore';
import { berechneGewerkSummaries, abschlagEffektivStatus } from '$lib/domain';
import { parseCentsFromInput } from '$lib/format';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();
	const summaries = berechneGewerkSummaries(buchungen, projekt.gewerke, projekt.budgets);

	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const notizen = Object.fromEntries(projekt.budgets.map((b) => [b.gewerk, b.notiz]));

	// Tätigkeit-Aufschlüsselung für Sammelgewerke
	const taetigkeitSummaries: Record<string, { taetigkeit: string; betrag: number }[]> = {};
	for (const s of summaries) {
		if (!s.gewerk.pauschal) continue;
		const gb = buchungen.filter((b) => b.gewerk === s.gewerk.id);
		const map = new Map<string, number>();
		for (const b of gb) {
			const t = b.taetigkeit?.trim() || '(ohne Angabe)';
			map.set(t, (map.get(t) ?? 0) + b.betrag);
		}
		taetigkeitSummaries[s.gewerk.id] = [...map.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([taetigkeit, betrag]) => ({ taetigkeit, betrag }));
	}

	// Verplante Kosten pro Gewerk aus Rechnungen
	type RechnungKurz = {
		id: string;
		auftragnehmer: string;
		bezahlt: number;
		offen: number;
		hatUeberfaellige: boolean;
		auftragssumme?: number;
	};

	const verplantPerGewerk: Record<string, { offen: number; restauftrag: number; anzahl: number }> = {};
	const rechnungenPerGewerk: Record<string, RechnungKurz[]> = {};

	for (const rechnung of rechnungen) {
		if (rechnung.status === 'angebot') continue;
		const g = rechnung.gewerk;
		verplantPerGewerk[g] ??= { offen: 0, restauftrag: 0, anzahl: 0 };
		verplantPerGewerk[g].anzahl++;
		rechnungenPerGewerk[g] ??= [];

		// Offene Abschläge
		for (const a of rechnung.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig') {
				verplantPerGewerk[g].offen += a.rechnungsbetrag;
			}
		}

		// Restauftrag: Auftragssumme + Nachträge - alle gestellten Abschläge
		const gesamtAuftrag = (rechnung.auftragssumme ?? 0)
			+ rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0);
		const gestellte = rechnung.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
		verplantPerGewerk[g].restauftrag += Math.max(0, gesamtAuftrag - gestellte);

		// Compact Rechnung für Budget-Tabelle
		const bezahlt = rechnung.abschlaege
			.filter((a) => a.status === 'bezahlt')
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
		const offeneAbschlaege = rechnung.abschlaege.filter((a) => {
			const s = abschlagEffektivStatus(a);
			return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
		});
		const offen = offeneAbschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
		const hatUeberfaellige = rechnung.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');

		rechnungenPerGewerk[g].push({
			id: rechnung.id,
			auftragnehmer: rechnung.auftragnehmer,
			bezahlt,
			offen,
			hatUeberfaellige,
			auftragssumme: rechnung.auftragssumme
		});
	}

	// Gesamt offene Beträge
	let gesamtOffen = 0;
	for (const v of Object.values(verplantPerGewerk)) {
		gesamtOffen += v.offen;
	}
	const gesamtRestauftrag = Object.values(verplantPerGewerk).reduce((s, v) => s + v.restauftrag, 0);

	return { summaries, gesamtBudget, gesamtIst, gesamtOffen, gesamtRestauftrag, notizen, taetigkeitSummaries, verplantPerGewerk, rechnungenPerGewerk };
};

export const actions: Actions = {
	update: async ({ request }) => {
		const form = await request.formData();
		const gewerk = form.get('gewerk') as string;
		const geplant = parseCentsFromInput(form.get('geplant') as string);
		const notiz = (form.get('notiz') as string)?.trim() || '';

		if (!gewerk) return fail(400, { error: 'Gewerk fehlt' });
		if (isNaN(geplant) || geplant < 0) return fail(400, { error: 'Budget muss >= 0 sein' });

		const projekt = leseProjekt();
		if (!projekt.gewerke.find((g) => g.id === gewerk))
			return fail(400, { error: 'Unbekanntes Gewerk' });

		const budget = projekt.budgets.find((b) => b.gewerk === gewerk);
		if (budget) {
			budget.geplant = geplant;
			budget.notiz = notiz;
		} else {
			projekt.budgets.push({ gewerk, geplant, notiz });
		}
		schreibeProjekt(projekt);
		return { success: true };
	}
};
