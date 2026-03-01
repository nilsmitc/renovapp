import type { RequestHandler } from './$types';
import { leseBuchungen, leseProjekt, leseRechnungen } from '$lib/dataStore';

export const GET: RequestHandler = ({ url }) => {
	const jahrParam = url.searchParams.get('jahr');

	const buchungen = leseBuchungen();
	const { gewerke } = leseProjekt();
	const gewerkeMap = new Map(gewerke.map((g) => [g.id, g.name]));

	// Beleg-Status: eigenes Beleg-Array ODER Beleg auf verknüpftem Abschlag
	const rechnungen = leseRechnungen();
	const abschlagBelegeSet = new Set<string>();
	for (const r of rechnungen) {
		for (const a of r.abschlaege) {
			if (a.buchungId && a.beleg) abschlagBelegeSet.add(a.buchungId);
		}
	}

	const rows = buchungen
		.filter((b) => b.steuerrelevant === true && b.betrag > 0)
		.filter((b) => !jahrParam || b.datum.startsWith(jahrParam))
		.sort((a, b) => a.datum.localeCompare(b.datum))
		.map((b) => {
			const anteil = b.arbeitsanteilCents ?? b.betrag;
			const hatBeleg = b.belege.length > 0 || abschlagBelegeSet.has(b.id);
			return [
				b.datum.slice(0, 4),
				b.datum,
				b.beschreibung.replace(/;/g, ','),
				gewerkeMap.get(b.gewerk) ?? b.gewerk,
				(b.betrag / 100).toFixed(2),
				(anteil / 100).toFixed(2),
				(Math.round(anteil * 0.2) / 100).toFixed(2),
				hatBeleg ? 'Ja' : 'Nein'
			].join(';');
		});

	const header =
		'Steuerjahr;Datum;Beschreibung;Gewerk;Rechnungsbetrag (EUR);Arbeitsanteil (EUR);§35a-Betrag 20% (EUR);Beleg vorhanden';
	const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM für Excel-Kompatibilität
	const filename = jahrParam ? `steuer-35a-${jahrParam}.csv` : 'steuer-35a-gesamt.csv';

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
