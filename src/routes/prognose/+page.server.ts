import type { PageServerLoad } from './$types';
import { leseBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';
import { abschlagEffektivStatus } from '$lib/domain';

export const load: PageServerLoad = () => {
	const buchungen = leseBuchungen();
	const projekt = leseProjekt();

	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);

	// Gebundene Mittel: offene Abschläge + nicht verplante Vertragssummen
	const rechnungen = leseRechnungen();
	let gebundeneMittelGesamt = 0;
	const gebundenNachGewerk: Record<string, number> = {};
	for (const r of rechnungen) {
		// Offene / überfällige Abschläge
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig') {
				gebundeneMittelGesamt += a.rechnungsbetrag;
				gebundenNachGewerk[r.gewerk] = (gebundenNachGewerk[r.gewerk] ?? 0) + a.rechnungsbetrag;
			}
		}
		// Noch nicht als Abschlag verplanter Teil der Auftragssumme
		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) {
				gebundeneMittelGesamt += nichtVerplant;
				gebundenNachGewerk[r.gewerk] = (gebundenNachGewerk[r.gewerk] ?? 0) + nichtVerplant;
			}
		}
	}

	if (buchungen.length === 0) {
		return {
			keineDaten: true,
			burnRateMonatlich: 0,
			gesamtIst: 0,
			gesamtBudget,
			restBudget: gesamtBudget,
			restMonate: null as number | null,
			anzahlMonate: 0,
			anzahlBuchungen: 0,
			konfidenz: 'niedrig' as const,
			erschoepfungsDatum: null as string | null,
			chartLabels: [] as string[],
			chartIst: [] as (number | null)[],
			chartPrognose: [] as (number | null)[],
			chartBudget: [] as number[],
			gewerkPrognosen: [] as GewerkPrognose[],
			gebundeneMittelGesamt,
			gebundenNachGewerk
		};
	}

	// Monatsdaten aggregieren
	const map = new Map<string, number>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7);
		map.set(monat, (map.get(monat) ?? 0) + b.betrag);
	}
	const sortedMonate = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

	let kumuliert = 0;
	const monate = sortedMonate.map(([monat, ausgaben]) => {
		kumuliert += ausgaben;
		const [year, month] = monat.split('-').map(Number);
		const label = new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
			month: 'long',
			year: 'numeric'
		});
		return { monat, label, ausgaben, kumuliert };
	});

	const gesamtIst = kumuliert;
	const anzahlMonate = monate.length;
	const anzahlBuchungen = buchungen.length;

	// Burn Rate
	const burnRateMonatlich = Math.round(gesamtIst / anzahlMonate);

	// Restbudget & Erschöpfungsdatum
	const restBudget = gesamtBudget - gesamtIst;
	const restMonate = burnRateMonatlich > 0 && restBudget > 0
		? Math.ceil(restBudget / burnRateMonatlich)
		: null;

	let erschoepfungsDatum: string | null = null;
	if (restMonate !== null) {
		const letzterMonat = monate[monate.length - 1].monat;
		const [ly, lm] = letzterMonat.split('-').map(Number);
		const datum = new Date(ly, lm - 1 + restMonate, 1);
		erschoepfungsDatum = datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
	}

	// Konfidenz-Indikator
	let konfidenz: 'niedrig' | 'mittel' | 'hoch';
	if (anzahlMonate < 2) konfidenz = 'niedrig';
	else if (anzahlMonate < 4) konfidenz = 'mittel';
	else konfidenz = 'hoch';

	// Chart-Datenpunkte aufbauen
	const letzterHistorisch = monate[monate.length - 1];
	const [lastYear, lastMonth] = letzterHistorisch.monat.split('-').map(Number);
	const maxPrognoseMonate = Math.min(restMonate ?? 18, 18);

	const chartLabels: string[] = monate.map((m) => m.label);
	// Ist: Werte für historische Monate
	const chartIst: (number | null)[] = monate.map((m) => m.kumuliert);
	// Prognose: nur ab letztem Ist-Monat (Überlappung für nahtlosen Übergang)
	const chartPrognose: (number | null)[] = monate.map((_, i) =>
		i === monate.length - 1 ? letzterHistorisch.kumuliert : null
	);
	// Budget-Linie: konstant
	const chartBudget: number[] = monate.map(() => gesamtBudget);

	for (let i = 1; i <= maxPrognoseMonate; i++) {
		const datum = new Date(lastYear, lastMonth - 1 + i, 1);
		const label = datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
		const progKumuliert = gesamtIst + burnRateMonatlich * i;

		chartLabels.push(label);
		chartIst.push(null);
		chartPrognose.push(Math.min(progKumuliert, gesamtBudget));
		chartBudget.push(gesamtBudget);

		if (progKumuliert >= gesamtBudget) break;
	}

	// Gewerk-Prognosen
	const gewerkPrognosen: GewerkPrognose[] = projekt.gewerke
		.sort((a, b) => a.sortierung - b.sortierung)
		.map((gewerk) => {
			const gb = buchungen.filter((b) => b.gewerk === gewerk.id);
			const ist = gb.reduce((s, b) => s + b.betrag, 0);
			const budget = projekt.budgets.find((b) => b.gewerk === gewerk.id)?.geplant ?? 0;

			// Auftragssummen aus Rechnungen (Festpreisverträge)
			const gewerkRechnungen = rechnungen.filter((r) => r.gewerk === gewerk.id);
			const rechnungsHochrechnung = gewerkRechnungen.reduce((s, r) => {
				if (r.auftragssumme === undefined) return s;
				const nachtraege = r.nachtraege.reduce((sn, n) => sn + n.betrag, 0);
				return s + r.auftragssumme + nachtraege;
			}, 0);
			// Direkte Buchungen ohne Rechnungsbezug
			const direkteIst = gb.filter((b) => !b.rechnungId).reduce((s, b) => s + b.betrag, 0);

			let hochgerechnet: number | null = null;
			let differenz: number | null = null;
			let status: 'ok' | 'warnung' | 'kritisch' = 'ok';
			let quelle: 'auftrag' | 'proportional' | null = null;

			const berechneStatus = (hoch: number) => {
				if (budget === 0) return hoch > 0 ? 'warnung' as const : 'ok' as const;
				if (hoch > budget) return 'kritisch' as const;
				if (hoch > budget * 0.8) return 'warnung' as const;
				return 'ok' as const;
			};

			if (rechnungsHochrechnung > 0) {
				// Festpreisvertrag bekannt → Auftragssumme als Hochrechnung
				hochgerechnet = rechnungsHochrechnung + direkteIst;
				differenz = budget - hochgerechnet;
				quelle = 'auftrag';
				status = berechneStatus(hochgerechnet);
			} else if (ist > 0 && gesamtIst > 0) {
				// Kein bekannter Festpreis → proportionale Hochrechnung
				hochgerechnet = Math.round((ist / gesamtIst) * gesamtBudget);
				differenz = budget - hochgerechnet;
				quelle = 'proportional';
				status = berechneStatus(hochgerechnet);
			}

			return { gewerk, budget, ist, hochgerechnet, differenz, status, quelle, gebunden: gebundenNachGewerk[gewerk.id] ?? 0 };
		});

	return {
		keineDaten: false,
		burnRateMonatlich,
		gesamtIst,
		gesamtBudget,
		restBudget,
		restMonate,
		anzahlMonate,
		anzahlBuchungen,
		konfidenz,
		erschoepfungsDatum,
		chartLabels,
		chartIst,
		chartPrognose,
		chartBudget,
		gewerkPrognosen,
		gebundeneMittelGesamt,
		gebundenNachGewerk
	};
};

interface GewerkPrognose {
	gewerk: { id: string; name: string; farbe: string; sortierung: number; pauschal?: boolean };
	budget: number;
	ist: number;
	hochgerechnet: number | null;
	differenz: number | null;
	status: 'ok' | 'warnung' | 'kritisch';
	gebunden: number;
	quelle: 'auftrag' | 'proportional' | null;
}
