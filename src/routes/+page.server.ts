import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';
import { berechneDashboard, abschlagEffektivStatus } from '$lib/domain';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const dashboard = berechneDashboard(buchungen, projekt);
	const rechnungen = leseRechnungen();

	const gesamtPuffer = projekt.budgets.reduce((s, b) => s + (b.puffer ?? 0), 0);

	// Offene Abschläge + Restauftrag pro Gewerk (getrennt)
	let gesamtOffen = 0;
	let gesamtRestauftrag = 0;
	let ausstehendRechnungen = 0;
	let hatUeberfaellige = false;
	let hatBaldFaellige = false;
	const offenPerGewerk: Record<string, number> = {};
	const restauftragPerGewerk: Record<string, number> = {};
	for (const r of rechnungen) {
		let rHatOffen = false;
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig') {
				gesamtOffen += a.rechnungsbetrag;
				offenPerGewerk[r.gewerk] = (offenPerGewerk[r.gewerk] ?? 0) + a.rechnungsbetrag;
				rHatOffen = true;
				if (s === 'ueberfaellig') hatUeberfaellige = true;
				if (s === 'bald_faellig') hatBaldFaellige = true;
			}
		}
		if (rHatOffen) ausstehendRechnungen++;

		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) {
				gesamtRestauftrag += nichtVerplant;
				restauftragPerGewerk[r.gewerk] = (restauftragPerGewerk[r.gewerk] ?? 0) + nichtVerplant;
			}
		}
	}

	// Puffer pro Gewerk
	const pufferPerGewerk: Record<string, number> = {};
	for (const b of projekt.budgets) {
		if (b.puffer && b.puffer > 0) {
			pufferPerGewerk[b.gewerk] = b.puffer;
		}
	}

	// Frei verfügbar
	const freiVerfuegbar = dashboard.gesamtBudget - dashboard.gesamtIst - gesamtOffen - gesamtRestauftrag - gesamtPuffer;

	// Monatsverlauf aggregieren (vor Burn Rate, damit wir die Daten wiederverwenden)
	const monatMap = new Map<
		string,
		{ ausgaben: number; anzahl: number; material: number; arbeitslohn: number; sonstiges: number }
	>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7);
		const ex = monatMap.get(monat) ?? {
			ausgaben: 0,
			anzahl: 0,
			material: 0,
			arbeitslohn: 0,
			sonstiges: 0
		};
		monatMap.set(monat, {
			ausgaben: ex.ausgaben + b.betrag,
			anzahl: ex.anzahl + 1,
			material: ex.material + (b.kategorie === 'Material' ? b.betrag : 0),
			arbeitslohn: ex.arbeitslohn + (b.kategorie === 'Arbeitslohn' ? b.betrag : 0),
			sonstiges: ex.sonstiges + (b.kategorie === 'Sonstiges' ? b.betrag : 0)
		});
	}

	// 3-Monats Burn Rate (nur vollständige Monate)
	const heuteMonat = new Date().toISOString().slice(0, 7);
	const sortierteMonatKeys = [...monatMap.keys()].sort();
	const kompletteMonateKeys = sortierteMonatKeys.filter((m) => m < heuteMonat);
	const relevanteMonateBurnRate = kompletteMonateKeys.slice(-3);
	const burnRateBasis = relevanteMonateBurnRate.length;
	const burnRateMonatlich =
		burnRateBasis > 0
			? Math.round(
					relevanteMonateBurnRate.reduce((s, m) => s + (monatMap.get(m)?.ausgaben ?? 0), 0) /
						burnRateBasis
				)
			: 0;
	const restMonate =
		burnRateMonatlich > 0 && freiVerfuegbar > 0
			? Math.round(freiVerfuegbar / burnRateMonatlich)
			: null;

	// Nächste Zahlungen (Top 5)
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

	// Monatsverlauf Reihe aufbauen
	const sortedMonat = [...monatMap.entries()].sort(([a], [b]) => a.localeCompare(b));
	let kumuliert = 0;
	const monate = sortedMonat.map(([monat, d]) => {
		kumuliert += d.ausgaben;
		const [year, month] = monat.split('-');
		const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('de-DE', {
			month: 'long',
			year: 'numeric'
		});
		return {
			monat,
			label,
			ausgaben: d.ausgaben,
			anzahl: d.anzahl,
			kumuliert,
			material: d.material,
			arbeitslohn: d.arbeitslohn,
			sonstiges: d.sonstiges
		};
	});
	monate.reverse();

	const { lieferanten, lieferungen } = leseLieferanten();

	return {
		...dashboard,
		burnRateMonatlich,
		burnRateBasis,
		restMonate,
		gesamtOffen,
		gesamtRestauftrag,
		gesamtPuffer,
		freiVerfuegbar,
		offenPerGewerk,
		restauftragPerGewerk,
		pufferPerGewerk,
		ausstehendRechnungen,
		hatUeberfaellige,
		hatBaldFaellige,
		naechsteZahlungen: naechsteZahlungen.slice(0, 5),
		lieferanten,
		lieferungen,
		monate
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
