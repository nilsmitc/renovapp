/**
 * Gemeinsame Berechnungslogik für Dashboard, Prognose, Steuer und PDF-Bericht.
 * Vermeidet Duplikation der Finanz-Aggregation über mehrere Seiten hinweg.
 */

import type { Buchung, ProjektData, Rechnung, Gewerk } from './domain';
import { abschlagEffektivStatus } from './domain';

// === Interfaces ===

export interface NaechsteZahlung {
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

export interface Finanzuebersicht {
	gesamtOffen: number;
	gesamtRestauftrag: number;
	gesamtPuffer: number;
	freiVerfuegbar: number;
	offenPerGewerk: Record<string, number>;
	restauftragPerGewerk: Record<string, number>;
	pufferPerGewerk: Record<string, number>;
	ausstehendRechnungen: number;
	hatUeberfaellige: boolean;
	hatBaldFaellige: boolean;
}

export interface BurnRateResult {
	burnRateMonatlich: number;
	burnRateBasis: number;
	restMonate: number | null;
}

export interface SteuerJahr {
	jahr: number;
	summe: number;
	erstattung: number;
	limitProzent: number;
	buchungen: Buchung[];
}

const STEUER_LIMIT_CENTS = 600000; // €6.000 Bemessungsgrundlage §35a
const STEUER_SATZ = 0.2;

// === Finanzübersicht ===

export function berechneFinanzuebersicht(
	buchungen: Buchung[],
	projekt: ProjektData,
	rechnungen: Rechnung[]
): Finanzuebersicht {
	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const gesamtPuffer = projekt.budgets.reduce((s, b) => s + (b.puffer ?? 0), 0);

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

	const freiVerfuegbar = gesamtBudget - gesamtIst - gesamtOffen - gesamtRestauftrag - gesamtPuffer;

	return {
		gesamtOffen,
		gesamtRestauftrag,
		gesamtPuffer,
		freiVerfuegbar,
		offenPerGewerk,
		restauftragPerGewerk,
		pufferPerGewerk,
		ausstehendRechnungen,
		hatUeberfaellige,
		hatBaldFaellige
	};
}

// === Nächste Zahlungen ===

export function berechneNaechsteZahlungen(
	rechnungen: Rechnung[],
	gewerke: Gewerk[]
): NaechsteZahlung[] {
	const heute = new Date().toISOString().slice(0, 10);
	const zahlungen: NaechsteZahlung[] = [];

	for (const r of rechnungen) {
		const gewerk = gewerke.find((g) => g.id === r.gewerk);
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
			zahlungen.push({
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

	zahlungen.sort((a, b) => {
		if (a.effektivStatus === 'ueberfaellig' && b.effektivStatus !== 'ueberfaellig') return -1;
		if (b.effektivStatus === 'ueberfaellig' && a.effektivStatus !== 'ueberfaellig') return 1;
		if (!a.faelligkeitsdatum && !b.faelligkeitsdatum) return 0;
		if (!a.faelligkeitsdatum) return 1;
		if (!b.faelligkeitsdatum) return -1;
		return a.faelligkeitsdatum.localeCompare(b.faelligkeitsdatum);
	});

	return zahlungen;
}

// === Burn Rate (3-Monats-Durchschnitt) ===

export interface MonatAusgaben {
	monat: string;
	label: string;
	ausgaben: number;
	anzahl: number;
	kumuliert: number;
	material: number;
	arbeitslohn: number;
	sonstiges: number;
}

export function berechneMonatsDaten(buchungen: Buchung[]): MonatAusgaben[] {
	const monatMap = new Map<
		string,
		{ ausgaben: number; anzahl: number; material: number; arbeitslohn: number; sonstiges: number }
	>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7);
		const ex = monatMap.get(monat) ?? { ausgaben: 0, anzahl: 0, material: 0, arbeitslohn: 0, sonstiges: 0 };
		monatMap.set(monat, {
			ausgaben: ex.ausgaben + b.betrag,
			anzahl: ex.anzahl + 1,
			material: ex.material + (b.kategorie === 'Material' ? b.betrag : 0),
			arbeitslohn: ex.arbeitslohn + (b.kategorie === 'Arbeitslohn' ? b.betrag : 0),
			sonstiges: ex.sonstiges + (b.kategorie === 'Sonstiges' ? b.betrag : 0)
		});
	}

	const sorted = [...monatMap.entries()].sort(([a], [b]) => a.localeCompare(b));
	let kumuliert = 0;
	return sorted.map(([monat, d]) => {
		kumuliert += d.ausgaben;
		const [year, month] = monat.split('-');
		const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('de-DE', {
			month: 'long',
			year: 'numeric'
		});
		return { monat, label, ausgaben: d.ausgaben, anzahl: d.anzahl, kumuliert, material: d.material, arbeitslohn: d.arbeitslohn, sonstiges: d.sonstiges };
	});
}

export function berechneBurnRate(monate: MonatAusgaben[], freiVerfuegbar: number): BurnRateResult {
	const heuteMonat = new Date().toISOString().slice(0, 7);
	const kompletteMonateKeys = monate.filter((m) => m.monat < heuteMonat);
	const relevanteMonateBurnRate = kompletteMonateKeys.slice(-3);
	const burnRateBasis = relevanteMonateBurnRate.length;
	const burnRateMonatlich =
		burnRateBasis > 0
			? Math.round(relevanteMonateBurnRate.reduce((s, m) => s + m.ausgaben, 0) / burnRateBasis)
			: 0;
	const restMonate =
		burnRateMonatlich > 0 && freiVerfuegbar > 0
			? Math.round(freiVerfuegbar / burnRateMonatlich)
			: null;

	return { burnRateMonatlich, burnRateBasis, restMonate };
}

// === Steuer §35a ===

export function berechneSteuerDaten(buchungen: Buchung[]): SteuerJahr[] {
	const bestaetigt = buchungen.filter(
		(b) => b.steuerrelevant === true && b.kategorie === 'Arbeitslohn' && b.betrag > 0
	);

	const jahreMap = new Map<number, { summe: number; buchungen: Buchung[] }>();
	for (const b of bestaetigt) {
		const jahr = Number(b.datum.slice(0, 4));
		const anteil = b.arbeitsanteilCents ?? b.betrag;
		const ex = jahreMap.get(jahr) ?? { summe: 0, buchungen: [] };
		jahreMap.set(jahr, { summe: ex.summe + anteil, buchungen: [...ex.buchungen, b] });
	}

	return [...jahreMap.entries()]
		.sort(([a], [b]) => b - a)
		.map(([jahr, { summe, buchungen }]) => ({
			jahr,
			summe,
			erstattung: Math.round(Math.min(summe, STEUER_LIMIT_CENTS) * STEUER_SATZ),
			limitProzent: Math.min(Math.round((summe / STEUER_LIMIT_CENTS) * 100), 200),
			buchungen
		}));
}
