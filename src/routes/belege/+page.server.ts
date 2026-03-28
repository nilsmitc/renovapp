import type { PageServerLoad } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten, leseBelegeExportLog } from '$lib/dataStore';

type BelegDatei = { dateiname: string; href: string };

export type ExportRef = {
	typ: 'buchung' | 'abschlag' | 'lieferung' | 'angebot';
	buchungId?: string;
	rechnungId?: string;
	abschlagId?: string;
	lieferungId?: string;
	dateinamen: string[];
	datum: string;
	gewerkName: string;
	beschreibung: string;
};

type BelegEintrag = {
	key: string;
	datum: string;
	beschreibung: string;
	gewerkId: string;
	gewerkName: string;
	betrag: number;
	belege: BelegDatei[];
	typ: 'buchung' | 'abschlag' | 'lieferung' | 'angebot';
	editHref: string;
	exportRef: ExportRef;
	exportiert: boolean;
};

export const load: PageServerLoad = ({ url }) => {
	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();
	const { lieferanten, lieferungen } = leseLieferanten();
	const exportLog = leseBelegeExportLog();

	const gewerk = url.searchParams.get('gewerk');
	const gewerkeMap = new Map(projekt.gewerke.map((g) => [g.id, g.name]));
	const lieferantenMap = new Map(lieferanten.map((l) => [l.id, l.name]));

	// Alle bereits exportierten Eintrags-Keys sammeln
	const exportierteKeys = new Set<string>();
	for (const exp of exportLog.exports) {
		for (const eintrag of exp.eintraege) {
			exportierteKeys.add(eintrag);
		}
	}

	const eintraege: BelegEintrag[] = [];

	// 1. Buchungs-Belege
	for (const b of buchungen) {
		if (b.belege.length === 0) continue;
		if (gewerk && b.gewerk !== gewerk) continue;
		const gewerkName = gewerkeMap.get(b.gewerk) ?? b.gewerk;
		const exportRef: ExportRef = {
			typ: 'buchung',
			buchungId: b.id,
			dateinamen: b.belege,
			datum: b.datum,
			gewerkName,
			beschreibung: b.beschreibung
		};
		eintraege.push({
			key: `buchung-${b.id}`,
			datum: b.datum,
			beschreibung: b.beschreibung,
			gewerkId: b.gewerk,
			gewerkName,
			betrag: b.betrag,
			belege: b.belege.map((f) => ({ dateiname: f, href: `/belege/${b.id}/${f}` })),
			typ: 'buchung',
			editHref: `/buchungen/${b.id}`,
			exportRef,
			exportiert: exportierteKeys.has(`buchung:${b.id}`)
		});
	}

	// 2. Abschlag-Belege (Auftragsrechnungen)
	for (const r of rechnungen) {
		if (gewerk && r.gewerk !== gewerk) continue;
		const gewerkName = gewerkeMap.get(r.gewerk) ?? r.gewerk;
		for (const a of r.abschlaege) {
			if (!a.beleg) continue;
			const typLabel =
				a.typ === 'schlussrechnung'
					? 'Schlussrechnung'
					: a.typ === 'nachtragsrechnung'
						? 'Nachtrag'
						: 'Abschlag';
			const beschreibung = `${r.auftragnehmer} – ${typLabel}`;
			const exportRef: ExportRef = {
				typ: 'abschlag',
				rechnungId: r.id,
				abschlagId: a.id,
				dateinamen: [a.beleg],
				datum: a.faelligkeitsdatum ?? '',
				gewerkName,
				beschreibung
			};
			eintraege.push({
				key: `abschlag-${a.id}`,
				datum: a.faelligkeitsdatum ?? '',
				beschreibung,
				gewerkId: r.gewerk,
				gewerkName,
				betrag: a.rechnungsbetrag,
				belege: [{ dateiname: a.beleg, href: `/rechnungen/${r.id}/${a.id}/${a.beleg}` }],
				typ: 'abschlag',
				editHref: `/rechnungen/${r.id}`,
				exportRef,
				exportiert: exportierteKeys.has(`abschlag:${r.id}:${a.id}`)
			});
		}
	}

	// 3. Lieferungs-Belege
	for (const l of lieferungen) {
		if (l.belege.length === 0) continue;
		if (gewerk && l.gewerk !== gewerk) continue;
		const lieferantName = lieferantenMap.get(l.lieferantId) ?? l.lieferantId;
		const gewerkName = gewerkeMap.get(l.gewerk ?? '') ?? '—';
		const beschreibung = lieferantName + (l.rechnungsnummer ? ` – ${l.rechnungsnummer}` : '');
		const exportRef: ExportRef = {
			typ: 'lieferung',
			lieferungId: l.id,
			dateinamen: l.belege,
			datum: l.datum,
			gewerkName,
			beschreibung
		};
		eintraege.push({
			key: `lieferung-${l.id}`,
			datum: l.datum,
			beschreibung,
			gewerkId: l.gewerk ?? '',
			gewerkName,
			betrag: l.betrag ?? 0,
			belege: l.belege.map((f) => ({ dateiname: f, href: `/lieferungen/${l.id}/${f}` })),
			typ: 'lieferung',
			editHref: `/lieferanten/${l.lieferantId}`,
			exportRef,
			exportiert: exportierteKeys.has(`lieferung:${l.id}`)
		});
	}

	// 4. Angebote (Aufträge)
	for (const r of rechnungen) {
		if (!r.angebot) continue;
		if (gewerk && r.gewerk !== gewerk) continue;
		const gewerkName = gewerkeMap.get(r.gewerk) ?? r.gewerk;
		const beschreibung = `${r.auftragnehmer} – Angebot`;
		const datum = r.auftragsdatum ?? r.erstellt.slice(0, 10);
		const exportRef: ExportRef = {
			typ: 'angebot',
			rechnungId: r.id,
			dateinamen: [r.angebot],
			datum,
			gewerkName,
			beschreibung
		};
		eintraege.push({
			key: `angebot-${r.id}`,
			datum,
			beschreibung,
			gewerkId: r.gewerk,
			gewerkName,
			betrag: r.auftragssumme ?? 0,
			belege: [{ dateiname: r.angebot, href: `/rechnungen/${r.id}/angebot/${r.angebot}` }],
			typ: 'angebot',
			editHref: `/rechnungen/${r.id}`,
			exportRef,
			exportiert: exportierteKeys.has(`angebot:${r.id}`)
		});
	}

	// Datum absteigend; leere Daten ans Ende
	eintraege.sort((a, b) => (b.datum || '0').localeCompare(a.datum || '0'));

	const stats = {
		gesamt: eintraege.reduce((s, e) => s + e.belege.length, 0),
		buchungen: eintraege.filter((e) => e.typ === 'buchung').length,
		abschlaege: eintraege.filter((e) => e.typ === 'abschlag').length,
		lieferungen: eintraege.filter((e) => e.typ === 'lieferung').length,
		angebote: eintraege.filter((e) => e.typ === 'angebot').length,
		gesamtBetrag: eintraege.reduce((s, e) => s + e.betrag, 0)
	};

	// Fehlende Belege zählen
	const fehlendBuchungen = buchungen.filter(b => b.belege.length === 0 && (!gewerk || b.gewerk === gewerk)).length;
	let fehlendAbschlaege = 0;
	for (const r of rechnungen) {
		if (gewerk && r.gewerk !== gewerk) continue;
		fehlendAbschlaege += r.abschlaege.filter(a => !a.beleg).length;
	}
	const fehlendLieferungen = lieferungen.filter(l => l.belege.length === 0 && (!gewerk || l.gewerk === gewerk)).length;

	const fehlend = {
		buchungen: fehlendBuchungen,
		abschlaege: fehlendAbschlaege,
		lieferungen: fehlendLieferungen,
		gesamt: fehlendBuchungen + fehlendAbschlaege + fehlendLieferungen
	};

	return { eintraege, gewerke: projekt.gewerke, filter: { gewerk }, stats, fehlend };
};
