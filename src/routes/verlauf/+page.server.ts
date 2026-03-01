import type { PageServerLoad } from './$types';
import { leseBuchungen } from '$lib/dataStore';

type MonatSummary = {
	monat: string;
	label: string;
	ausgaben: number;
	anzahl: number;
	kumuliert: number;
	material: number;
	arbeitslohn: number;
	sonstiges: number;
};

export const load: PageServerLoad = () => {
	const buchungen = leseBuchungen();

	const map = new Map<string, { ausgaben: number; anzahl: number; material: number; arbeitslohn: number; sonstiges: number }>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7); // "YYYY-MM"
		const existing = map.get(monat) ?? { ausgaben: 0, anzahl: 0, material: 0, arbeitslohn: 0, sonstiges: 0 };
		map.set(monat, {
			ausgaben: existing.ausgaben + b.betrag,
			anzahl: existing.anzahl + 1,
			material: existing.material + (b.kategorie === 'Material' ? b.betrag : 0),
			arbeitslohn: existing.arbeitslohn + (b.kategorie === 'Arbeitslohn' ? b.betrag : 0),
			sonstiges: existing.sonstiges + (b.kategorie === 'Sonstiges' ? b.betrag : 0)
		});
	}

	// Sortiert aufsteigend für kumulierte Summe
	const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

	let kumuliert = 0;
	const monate: MonatSummary[] = sorted.map(([monat, data]) => {
		kumuliert += data.ausgaben;
		const [year, month] = monat.split('-');
		const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('de-DE', {
			month: 'long',
			year: 'numeric'
		});
		return { monat, label, ausgaben: data.ausgaben, anzahl: data.anzahl, kumuliert, material: data.material, arbeitslohn: data.arbeitslohn, sonstiges: data.sonstiges };
	});

	const maxAusgaben = Math.max(...monate.map((m) => m.ausgaben), 1);

	// Chronologisch (aufsteigend) für Charts; neueste zuerst für Tabelle
	const chronologisch = monate;
	const tabelle = [...monate].reverse();

	return { chronologisch, tabelle, maxAusgaben };
};
