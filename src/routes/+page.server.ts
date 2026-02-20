import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen } from '$lib/dataStore';
import { berechneDashboard, abschlagEffektivStatus } from '$lib/domain';

export const load: PageServerLoad = () => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const dashboard = berechneDashboard(buchungen, projekt);

	const anzahlMonate = new Set(buchungen.map((b) => b.datum.slice(0, 7))).size;
	const avgProMonat = anzahlMonate > 0 ? Math.round(dashboard.gesamtIst / anzahlMonate) : 0;

	// Ausstehende Zahlungen: offene Abschläge + nicht fakturierte Vertragssummen
	const rechnungen = leseRechnungen();
	let ausstehendBetrag = 0;
	let ausstehendRechnungen = 0;
	let hatUeberfaellige = false;
	for (const r of rechnungen) {
		let rHatAusstehend = false;
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig') {
				ausstehendBetrag += a.rechnungsbetrag;
				rHatAusstehend = true;
				if (s === 'ueberfaellig') hatUeberfaellige = true;
			}
		}
		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) {
				ausstehendBetrag += nichtVerplant;
				rHatAusstehend = true;
			}
		}
		if (rHatAusstehend) ausstehendRechnungen++;
	}

	return {
		...dashboard,
		avgProMonat,
		anzahlMonate,
		ausstehendBetrag,
		ausstehendRechnungen,
		hatUeberfaellige
	};
};
