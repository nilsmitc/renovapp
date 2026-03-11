import type { PageServerLoad } from './$types';
import { leseBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';
import { abschlagEffektivStatus } from '$lib/domain';

export const load: PageServerLoad = () => {
	const buchungen = leseBuchungen();
	const projekt = leseProjekt();
	const rechnungen = leseRechnungen();

	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const gesamtPuffer = projekt.budgets.reduce((s, b) => s + (b.puffer ?? 0), 0);

	// Offene Abschläge und Restauftrag pro Gewerk
	let gesamtOffen = 0;
	let gesamtRestauftrag = 0;
	const offenNachGewerk: Record<string, number> = {};
	const restauftragNachGewerk: Record<string, number> = {};
	for (const r of rechnungen) {
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig') {
				gesamtOffen += a.rechnungsbetrag;
				offenNachGewerk[r.gewerk] = (offenNachGewerk[r.gewerk] ?? 0) + a.rechnungsbetrag;
			}
		}
		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) {
				gesamtRestauftrag += nichtVerplant;
				restauftragNachGewerk[r.gewerk] = (restauftragNachGewerk[r.gewerk] ?? 0) + nichtVerplant;
			}
		}
	}

	// Nächste Zahlungen aus offenen Abschlägen
	const heute = new Date().toISOString().slice(0, 10);
	const naechsteZahlungen: NaechsteZahlung[] = [];
	for (const r of rechnungen) {
		const gewerk = projekt.gewerke.find((g) => g.id === r.gewerk);
		for (const a of r.abschlaege) {
			if (a.status === 'bezahlt' || a.status === 'ausstehend') continue;
			const effStatus = abschlagEffektivStatus(a);
			let tageVerbleibend: number | null = null;
			if (a.faelligkeitsdatum) {
				const diff =
					(new Date(a.faelligkeitsdatum).getTime() - new Date(heute).getTime()) /
					(1000 * 60 * 60 * 24);
				tageVerbleibend = Math.round(diff);
			}
			naechsteZahlungen.push({
				rechnungId: r.id,
				auftragnehmer: r.auftragnehmer,
				gewerkName: gewerk?.name ?? r.gewerk,
				gewerkFarbe: gewerk?.farbe ?? '#94a3b8',
				typ:
					a.typ === 'abschlag'
						? 'Abschlag'
						: a.typ === 'schlussrechnung'
							? 'Schlussrechnung'
							: 'Nachtragsrechnung',
				nummer: a.nummer,
				betrag: a.rechnungsbetrag,
				faelligkeitsdatum: a.faelligkeitsdatum ?? null,
				effektivStatus: effStatus,
				tageVerbleibend
			});
		}
	}
	naechsteZahlungen.sort((a, b) => {
		if (a.effektivStatus === 'ueberfaellig' && b.effektivStatus !== 'ueberfaellig') return -1;
		if (b.effektivStatus === 'ueberfaellig' && a.effektivStatus !== 'ueberfaellig') return 1;
		if (!a.faelligkeitsdatum && !b.faelligkeitsdatum) return 0;
		if (!a.faelligkeitsdatum) return 1;
		if (!b.faelligkeitsdatum) return -1;
		return a.faelligkeitsdatum.localeCompare(b.faelligkeitsdatum);
	});

	// Gewerk-Übersicht (funktioniert auch ohne Buchungen)
	const gewerkUebersichtRaw: GewerkUebersicht[] = projekt.gewerke
		.sort((a, b) => a.sortierung - b.sortierung)
		.map((gewerk) => {
			const gb = buchungen.filter((b) => b.gewerk === gewerk.id);
			const ist = gb.reduce((s, b) => s + b.betrag, 0);
			const budget = projekt.budgets.find((b) => b.gewerk === gewerk.id)?.geplant ?? 0;
			const puffer = projekt.budgets.find((b) => b.gewerk === gewerk.id)?.puffer ?? 0;
			const offen = offenNachGewerk[gewerk.id] ?? 0;
			const restauftrag = restauftragNachGewerk[gewerk.id] ?? 0;
			const frei = budget - ist - offen - restauftrag - puffer;

			let status: 'ok' | 'warnung' | 'kritisch' = 'ok';
			if (budget > 0) {
				if (frei < 0) status = 'kritisch';
				else if (frei < budget * 0.2) status = 'warnung';
			} else if (ist + offen + restauftrag > 0) {
				status = 'warnung';
			}

			return { gewerk, budget, ist, offen, restauftrag, puffer, frei, status };
		});

	if (buchungen.length === 0) {
		return {
			keineDaten: true,
			burnRateMonatlich: 0,
			burnRateBasis: 0,
			teilmonatAusgaben: 0,
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
			gesamtOffen,
			gesamtRestauftrag,
			gesamtPuffer,
			freiVerfuegbar: gesamtBudget - gesamtOffen - gesamtRestauftrag - gesamtPuffer,
			naechsteZahlungen: naechsteZahlungen.slice(0, 10),
			gewerkUebersicht: gewerkUebersichtRaw,
			bekannteZahlungenGesamt: 0
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
	const anzahlBuchungen = buchungen.length;

	// Burn Rate: nur vollständige Monate (laufender Monat hat zu wenig Daten)
	const heuteMonat = new Date().toISOString().slice(0, 7);
	const kompleteMonate = monate.filter((m) => m.monat < heuteMonat);
	const relevanteMonateBurnRate = kompleteMonate.slice(-3);
	const burnRateBasis = relevanteMonateBurnRate.length;
	const burnRateMonatlich =
		burnRateBasis > 0
			? Math.round(
					relevanteMonateBurnRate.reduce((s, m) => s + m.ausgaben, 0) / burnRateBasis
				)
			: 0;
	const teilmonatAusgaben = monate.find((m) => m.monat === heuteMonat)?.ausgaben ?? 0;

	// Konfidenz
	const anzahlMonate = kompleteMonate.length;
	let konfidenz: 'niedrig' | 'mittel' | 'hoch';
	if (anzahlMonate < 2) konfidenz = 'niedrig';
	else if (anzahlMonate < 4) konfidenz = 'mittel';
	else konfidenz = 'hoch';

	// Restbudget + Frei verfügbar
	const restBudget = gesamtBudget - gesamtIst;
	const freiVerfuegbar = gesamtBudget - gesamtIst - gesamtOffen - gesamtRestauftrag - gesamtPuffer;

	// Chart-Datenpunkte aufbauen
	const letzterHistorisch = monate[monate.length - 1];
	const [lastYear, lastMonth] = letzterHistorisch.monat.split('-').map(Number);

	// Bekannte zukünftige Zahlungen aus Abschlägen mit Fälligkeitsdatum
	const ersteFutureDatum = new Date(lastYear, lastMonth, 1);
	const ersteFutureMonat = `${ersteFutureDatum.getFullYear()}-${String(ersteFutureDatum.getMonth() + 1).padStart(2, '0')}`;
	const bekannteZahlungenProMonat: Record<string, number> = {};
	let bekannteZahlungenGesamt = 0;
	for (const r of rechnungen) {
		for (const a of r.abschlaege) {
			if (a.status === 'bezahlt') continue;
			if (!a.faelligkeitsdatum) continue;
			const monat =
				a.faelligkeitsdatum.slice(0, 7) <= letzterHistorisch.monat
					? ersteFutureMonat
					: a.faelligkeitsdatum.slice(0, 7);
			bekannteZahlungenProMonat[monat] =
				(bekannteZahlungenProMonat[monat] ?? 0) + a.rechnungsbetrag;
			bekannteZahlungenGesamt += a.rechnungsbetrag;
		}
	}

	// Erschöpfungsdatum via monatlicher Simulation (inkl. bekannte Zahlungen)
	let restMonate: number | null = null;
	let erschoepfungsDatum: string | null = null;
	if (burnRateMonatlich > 0 || bekannteZahlungenGesamt > 0) {
		let simKumuliert = gesamtIst;
		for (let i = 1; i <= 120; i++) {
			const d = new Date(lastYear, lastMonth - 1 + i, 1);
			const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			simKumuliert += burnRateMonatlich + (bekannteZahlungenProMonat[ms] ?? 0);
			if (simKumuliert >= gesamtBudget) {
				restMonate = i;
				erschoepfungsDatum = d.toLocaleDateString('de-DE', {
					month: 'long',
					year: 'numeric'
				});
				break;
			}
		}
	}

	const maxPrognoseMonate = Math.min(restMonate ?? 18, 18);

	const chartLabels: string[] = monate.map((m) => m.label);
	const chartIst: (number | null)[] = monate.map((m) => m.kumuliert);
	const chartPrognose: (number | null)[] = monate.map((_, i) =>
		i === monate.length - 1 ? letzterHistorisch.kumuliert : null
	);
	const chartBudget: number[] = monate.map(() => gesamtBudget);

	let progKumuliert = gesamtIst;
	for (let i = 1; i <= maxPrognoseMonate; i++) {
		const datum = new Date(lastYear, lastMonth - 1 + i, 1);
		const label = datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
		const monatStr = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
		const bekannt = bekannteZahlungenProMonat[monatStr] ?? 0;
		const roh = progKumuliert + burnRateMonatlich + bekannt;
		progKumuliert = Math.min(roh, gesamtBudget);

		chartLabels.push(label);
		chartIst.push(null);
		chartPrognose.push(progKumuliert);
		chartBudget.push(gesamtBudget);

		if (roh >= gesamtBudget) break;
	}

	return {
		keineDaten: false,
		burnRateMonatlich,
		burnRateBasis,
		teilmonatAusgaben,
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
		gesamtOffen,
		gesamtRestauftrag,
		gesamtPuffer,
		freiVerfuegbar,
		naechsteZahlungen: naechsteZahlungen.slice(0, 10),
		gewerkUebersicht: gewerkUebersichtRaw,
		bekannteZahlungenGesamt
	};
};

interface NaechsteZahlung {
	rechnungId: string;
	auftragnehmer: string;
	gewerkName: string;
	gewerkFarbe: string;
	typ: string;
	nummer: number;
	betrag: number;
	faelligkeitsdatum: string | null;
	effektivStatus: string;
	tageVerbleibend: number | null;
}

interface GewerkUebersicht {
	gewerk: { id: string; name: string; farbe: string; sortierung: number; pauschal?: boolean };
	budget: number;
	ist: number;
	offen: number;
	restauftrag: number;
	puffer: number;
	frei: number;
	status: 'ok' | 'warnung' | 'kritisch';
}
