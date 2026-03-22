import type { PageServerLoad } from './$types';
import { leseAnalyse } from '$lib/aiAnalyse';
import { leseBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';
import { berechneSteuerDaten } from '$lib/reportData';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const load: PageServerLoad = async () => {
	const analyseDatei = leseAnalyse();
	const buchungen = leseBuchungen();
	const projekt = leseProjekt();
	const rechnungen = leseRechnungen();

	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const steuerDaten = berechneSteuerDaten(buchungen);

	// Dokumente-Extrakt prüfen
	const dokumentePfad = join(process.cwd(), 'data', 'dokumente-texte.json');
	let dokumenteVorhanden = false;
	let dokumenteExtrahiert: string | null = null;
	let dokumenteAnzahl = 0;
	if (existsSync(dokumentePfad)) {
		try {
			const daten = JSON.parse(readFileSync(dokumentePfad, 'utf-8'));
			dokumenteVorhanden = true;
			dokumenteExtrahiert = daten.extrahiert ?? null;
			dokumenteAnzahl = daten.anzahlDokumente ?? 0;
		} catch { /* ignorieren */ }
	}

	// Anzahl PDFs die extrahiert werden könnten
	let anzahlPdfs = 0;
	for (const r of rechnungen) {
		if (r.angebot?.toLowerCase().endsWith('.pdf')) anzahlPdfs++;
		for (const a of r.abschlaege) {
			if (a.beleg?.toLowerCase().endsWith('.pdf')) anzahlPdfs++;
		}
	}

	return {
		analyseVorhanden: analyseDatei !== null,
		analyseErstellt: analyseDatei?.erstellt ?? null,
		anzahlBuchungen: buchungen.length,
		anzahlGewerke: projekt.gewerke.length,
		anzahlRechnungen: rechnungen.length,
		hatSteuerDaten: steuerDaten.length > 0,
		dokumenteVorhanden,
		dokumenteExtrahiert,
		dokumenteAnzahl,
		anzahlPdfs,
		gesamtIst,
		gesamtBudget
	};
};
