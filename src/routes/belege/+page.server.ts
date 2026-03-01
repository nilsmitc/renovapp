import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';

type BelegDatei = { dateiname: string; href: string };
type BelegEintrag = {
	key: string;
	datum: string;
	beschreibung: string;
	gewerkName: string;
	betrag: number;
	belege: BelegDatei[];
	typ: 'buchung' | 'abschlag' | 'lieferung';
	editHref: string;
};

export const load: PageServerLoad = ({ url }) => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();
	const { lieferanten, lieferungen } = leseLieferanten();

	const gewerk = url.searchParams.get('gewerk');
	const gewerkeMap = new Map(projekt.gewerke.map((g) => [g.id, g.name]));
	const lieferantenMap = new Map(lieferanten.map((l) => [l.id, l.name]));

	const eintraege: BelegEintrag[] = [];

	// 1. Buchungs-Belege
	for (const b of buchungen) {
		if (b.belege.length === 0) continue;
		if (gewerk && b.gewerk !== gewerk) continue;
		eintraege.push({
			key: `buchung-${b.id}`,
			datum: b.datum,
			beschreibung: b.beschreibung,
			gewerkName: gewerkeMap.get(b.gewerk) ?? b.gewerk,
			betrag: b.betrag,
			belege: b.belege.map((f) => ({ dateiname: f, href: `/belege/${b.id}/${f}` })),
			typ: 'buchung',
			editHref: `/buchungen/${b.id}`
		});
	}

	// 2. Abschlag-Belege (Auftragsrechnungen)
	for (const r of rechnungen) {
		if (gewerk && r.gewerk !== gewerk) continue;
		for (const a of r.abschlaege) {
			if (!a.beleg) continue;
			const typLabel =
				a.typ === 'schlussrechnung'
					? 'Schlussrechnung'
					: a.typ === 'nachtragsrechnung'
						? 'Nachtrag'
						: 'Abschlag';
			eintraege.push({
				key: `abschlag-${a.id}`,
				datum: a.faelligkeitsdatum ?? '',
				beschreibung: `${r.auftragnehmer} – ${typLabel}`,
				gewerkName: gewerkeMap.get(r.gewerk) ?? r.gewerk,
				betrag: a.rechnungsbetrag,
				belege: [{ dateiname: a.beleg, href: `/rechnungen/${r.id}/${a.id}/${a.beleg}` }],
				typ: 'abschlag',
				editHref: `/rechnungen/${r.id}`
			});
		}
	}

	// 3. Lieferungs-Belege
	for (const l of lieferungen) {
		if (l.belege.length === 0) continue;
		if (gewerk && l.gewerk !== gewerk) continue;
		const lieferantName = lieferantenMap.get(l.lieferantId) ?? l.lieferantId;
		eintraege.push({
			key: `lieferung-${l.id}`,
			datum: l.datum,
			beschreibung: lieferantName + (l.rechnungsnummer ? ` – ${l.rechnungsnummer}` : ''),
			gewerkName: gewerkeMap.get(l.gewerk ?? '') ?? '—',
			betrag: l.betrag ?? 0,
			belege: l.belege.map((f) => ({ dateiname: f, href: `/lieferungen/${l.id}/${f}` })),
			typ: 'lieferung',
			editHref: `/lieferanten/${l.lieferantId}`
		});
	}

	// Datum absteigend; leere Daten ans Ende
	eintraege.sort((a, b) => (b.datum || '0').localeCompare(a.datum || '0'));

	const stats = {
		gesamt: eintraege.reduce((s, e) => s + e.belege.length, 0),
		buchungen: eintraege.filter((e) => e.typ === 'buchung').length,
		abschlaege: eintraege.filter((e) => e.typ === 'abschlag').length,
		lieferungen: eintraege.filter((e) => e.typ === 'lieferung').length,
		gesamtBetrag: eintraege.reduce((s, e) => s + e.betrag, 0)
	};

	return { eintraege, gewerke: projekt.gewerke, filter: { gewerk }, stats };
};
