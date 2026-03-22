import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';
import { berechneDashboard } from '$lib/domain';
import {
	berechneFinanzuebersicht,
	berechneNaechsteZahlungen,
	berechneMonatsDaten,
	berechneBurnRate
} from '$lib/reportData';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const dashboard = berechneDashboard(buchungen, projekt);
	const rechnungen = leseRechnungen();

	const finanz = berechneFinanzuebersicht(buchungen, projekt, rechnungen);
	const naechsteZahlungen = berechneNaechsteZahlungen(rechnungen, projekt.gewerke);
	const monatsDaten = berechneMonatsDaten(buchungen);
	const burnRateResult = berechneBurnRate(monatsDaten, finanz.freiVerfuegbar);

	// Monatsverlauf: neueste zuerst für die Anzeige
	const monate = [...monatsDaten].reverse();

	const { lieferanten, lieferungen } = leseLieferanten();

	return {
		...dashboard,
		burnRateMonatlich: burnRateResult.burnRateMonatlich,
		burnRateBasis: burnRateResult.burnRateBasis,
		restMonate: burnRateResult.restMonate,
		gesamtOffen: finanz.gesamtOffen,
		gesamtRestauftrag: finanz.gesamtRestauftrag,
		gesamtPuffer: finanz.gesamtPuffer,
		freiVerfuegbar: finanz.freiVerfuegbar,
		offenPerGewerk: finanz.offenPerGewerk,
		restauftragPerGewerk: finanz.restauftragPerGewerk,
		pufferPerGewerk: finanz.pufferPerGewerk,
		ausstehendRechnungen: finanz.ausstehendRechnungen,
		hatUeberfaellige: finanz.hatUeberfaellige,
		hatBaldFaellige: finanz.hatBaldFaellige,
		naechsteZahlungen: naechsteZahlungen.slice(0, 5),
		lieferanten,
		lieferungen,
		monate
	};
};
