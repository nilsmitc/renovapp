import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';
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
	let hatBaldFaellige = false;
	let gebundenBetrag = 0;
	let gebundenRechnungen = 0;
	const verplantPerGewerk: Record<string, number> = {};
	for (const r of rechnungen) {
		let rHatAusstehend = false;
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig') {
				ausstehendBetrag += a.rechnungsbetrag;
				verplantPerGewerk[r.gewerk] = (verplantPerGewerk[r.gewerk] ?? 0) + a.rechnungsbetrag;
				rHatAusstehend = true;
				if (s === 'ueberfaellig') hatUeberfaellige = true;
				if (s === 'bald_faellig') hatBaldFaellige = true;
			}
		}
		if (rHatAusstehend) ausstehendRechnungen++;

		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) {
				gebundenBetrag += nichtVerplant;
				verplantPerGewerk[r.gewerk] = (verplantPerGewerk[r.gewerk] ?? 0) + nichtVerplant;
				gebundenRechnungen++;
			}
		}
	}

	const { lieferanten, lieferungen } = leseLieferanten();

	// Monatsverlauf
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
	monate.reverse(); // Neueste zuerst

	return {
		...dashboard,
		avgProMonat,
		anzahlMonate,
		ausstehendBetrag,
		ausstehendRechnungen,
		hatUeberfaellige,
		hatBaldFaellige,
		gebundenBetrag,
		gebundenRechnungen,
		verplantPerGewerk,
		lieferanten,
		lieferungen,
		monate
	};
};
