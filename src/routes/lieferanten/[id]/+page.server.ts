import type { Actions, PageServerLoad } from './$types';
import {
	leseLieferanten,
	schreibeLieferanten,
	leseBuchungen,
	schreibeBuchungen,
	leseProjekt,
	speicherBelegLieferung,
	loescheBelegLieferung,
	loescheBelegeOrdnerLieferung
} from '$lib/dataStore';
import { createLieferung, createBuchung, type Lieferung, type Lieferant, type Buchung, type LieferungPosition } from '$lib/domain';
import { error, fail } from '@sveltejs/kit';
import { parseCentsFromInput } from '$lib/format';

const ERLAUBTE_TYPEN = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_GROESSE = 10 * 1024 * 1024; // 10 MB

/**
 * Erstellt oder aktualisiert die automatisch verknüpfte Buchung einer Lieferung.
 * Voraussetzung: lieferung.betrag UND lieferung.gewerk müssen gesetzt sein.
 * Mutiert buchungen[] und lieferung.buchungId in-place.
 */
function syncLieferungBuchung(
	lieferung: Lieferung,
	lieferant: Lieferant,
	buchungen: Buchung[]
): void {
	const hatBetragUndGewerk = lieferung.betrag && lieferung.gewerk;
	const beschreibung =
		lieferant.name + (lieferung.beschreibung ? ` – ${lieferung.beschreibung}` : '');

	if (lieferung.buchungId) {
		const idx = buchungen.findIndex((b) => b.id === lieferung.buchungId);
		if (idx !== -1) {
			if (hatBetragUndGewerk) {
				// Bestehende Buchung synchronisieren
				buchungen[idx].datum = lieferung.datum;
				buchungen[idx].betrag = lieferung.betrag!;
				buchungen[idx].gewerk = lieferung.gewerk!;
				buchungen[idx].beschreibung = beschreibung;
				buchungen[idx].rechnungsreferenz = lieferung.rechnungsnummer ?? '';
				buchungen[idx].bezahltam = lieferung.bezahltam;
				buchungen[idx].geaendert = new Date().toISOString();
			} else {
				// Betrag oder Gewerk entfernt → Buchung löschen
				buchungen.splice(idx, 1);
				lieferung.buchungId = undefined;
			}
		} else {
			// Buchung fehlt (z.B. manuell gelöscht) → Flag zurücksetzen
			lieferung.buchungId = undefined;
		}
	}

	if (!lieferung.buchungId && hatBetragUndGewerk) {
		// Neue Buchung erstellen
		const buchung = createBuchung({
			datum: lieferung.datum,
			betrag: lieferung.betrag!,
			gewerk: lieferung.gewerk!,
			raum: null,
			kategorie: 'Material',
			beschreibung,
			rechnungsreferenz: lieferung.rechnungsnummer ?? '',
			bezahltam: lieferung.bezahltam,
			lieferungId: lieferung.id
		});
		buchungen.push(buchung);
		lieferung.buchungId = buchung.id;
	}
}

export const load: PageServerLoad = ({ params }) => {
	const { lieferanten, lieferungen } = leseLieferanten();
	const lieferant = lieferanten.find((l) => l.id === params.id);
	if (!lieferant) throw error(404, 'Lieferant nicht gefunden');

	const projekt = leseProjekt();
	const buchungen = leseBuchungen();

	const meineLieferungen = lieferungen
		.filter((lu) => lu.lieferantId === params.id)
		.sort((a, b) => b.datum.localeCompare(a.datum));

	// Pro Lieferung: gebuchten Betrag berechnen
	const lieferungenMitStats = meineLieferungen.map((lu) => {
		const gebuchtBetrag = buchungen
			.filter((b) => b.lieferungId === lu.id)
			.reduce((s, b) => s + b.betrag, 0);
		const anzahlBuchungen = buchungen.filter((b) => b.lieferungId === lu.id).length;
		return { lieferung: lu, gebuchtBetrag, anzahlBuchungen };
	});

	const gesamtBetrag = lieferungenMitStats.reduce((s, l) => s + (l.lieferung.betrag ?? 0), 0);
	const gesamtBuchungen = lieferungenMitStats.reduce((s, l) => s + l.anzahlBuchungen, 0);

	return {
		lieferant,
		lieferungenMitStats,
		gesamtBetrag,
		gesamtBuchungen,
		gewerke: projekt.gewerke
	};
};

export const actions: Actions = {
	lieferungHinzufuegen: async ({ request, params }) => {
		const form = await request.formData();
		const datum = (form.get('datum') as string)?.trim();
		const beschreibung = (form.get('beschreibung') as string)?.trim() || undefined;
		const rechnungsnummer = (form.get('rechnungsnummer') as string)?.trim() || undefined;
		const lieferscheinnummer = (form.get('lieferscheinnummer') as string)?.trim() || undefined;
		const betragRaw = (form.get('betrag') as string)?.trim();
		const gewerk = (form.get('gewerk') as string)?.trim() || undefined;
		const notiz = (form.get('notiz') as string)?.trim() || undefined;
		const bezahltam = (form.get('bezahltam') as string)?.trim() || undefined;
		const positionenRaw = (form.get('positionen') as string)?.trim();

		if (!datum) return fail(400, { lieferungError: 'Datum ist erforderlich' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === params.id);
		if (!lieferant) return fail(404, { lieferungError: 'Lieferant nicht gefunden' });

		const isGutschrift = form.get('gutschrift') === 'on';
		let betrag: number | undefined;
		if (betragRaw) {
			const cents = parseCentsFromInput(betragRaw);
			const absWert = Math.abs(cents);
			if (absWert > 0) betrag = isGutschrift ? -absWert : absWert;
		}

		let positionen: LieferungPosition[] | undefined;
		if (positionenRaw) {
			try {
				const parsed = JSON.parse(positionenRaw);
				if (Array.isArray(parsed) && parsed.length > 0) positionen = parsed;
			} catch { /* ungültiges JSON ignorieren */ }
		}

		const lieferung = createLieferung({
			lieferantId: params.id,
			datum,
			beschreibung,
			rechnungsnummer,
			lieferscheinnummer,
			betrag,
			gewerk,
			positionen,
			notiz,
			bezahltam
		});

		// Belege verarbeiten
		const belegeFiles = form.getAll('belege') as File[];
		for (const belegFile of belegeFiles) {
			if (!belegFile || belegFile.size === 0) continue;
			if (!ERLAUBTE_TYPEN.includes(belegFile.type)) {
				return fail(400, { lieferungError: 'Nur PDF, JPG und PNG sind erlaubt' });
			}
			if (belegFile.size > MAX_GROESSE) {
				return fail(400, { lieferungError: 'Beleg darf maximal 10 MB groß sein' });
			}
			const buffer = Buffer.from(await belegFile.arrayBuffer());
			const gespeicherterName = speicherBelegLieferung(lieferung.id, belegFile.name, buffer);
			lieferung.belege.push(gespeicherterName);
		}

		lieferungen.push(lieferung);

		// Buchung auto-erstellen wenn betrag + gewerk vorhanden
		const buchungen = leseBuchungen();
		syncLieferungBuchung(lieferung, lieferant, buchungen);
		schreibeBuchungen(buchungen);

		schreibeLieferanten({ lieferanten, lieferungen });
		return { lieferungErfolg: true };
	},

	belegHinzufuegen: async ({ request, params }) => {
		const form = await request.formData();
		const lieferungId = (form.get('lieferungId') as string)?.trim();
		if (!lieferungId) return fail(400, { belegError: 'Lieferung-ID fehlt' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === params.id);
		if (!lieferant) return fail(404, { belegError: 'Lieferant nicht gefunden' });

		const lieferung = lieferungen.find((lu) => lu.id === lieferungId);
		if (!lieferung || lieferung.lieferantId !== params.id) {
			return fail(404, { belegError: 'Lieferung nicht gefunden' });
		}

		const belegeFiles = form.getAll('belege') as File[];
		let hinzugefuegt = 0;
		for (const belegFile of belegeFiles) {
			if (!belegFile || belegFile.size === 0) continue;
			if (!ERLAUBTE_TYPEN.includes(belegFile.type)) {
				return fail(400, { belegError: 'Nur PDF, JPG und PNG sind erlaubt' });
			}
			if (belegFile.size > MAX_GROESSE) {
				return fail(400, { belegError: 'Beleg darf maximal 10 MB groß sein' });
			}
			const buffer = Buffer.from(await belegFile.arrayBuffer());
			const gespeicherterName = speicherBelegLieferung(lieferungId, belegFile.name, buffer);
			lieferung.belege.push(gespeicherterName);
			hinzugefuegt++;
		}

		if (hinzugefuegt === 0) return fail(400, { belegError: 'Keine gültige Datei angegeben' });

		lieferung.geaendert = new Date().toISOString();
		schreibeLieferanten({ lieferanten, lieferungen });
		return { belegErfolg: true };
	},

	belegLoeschen: async ({ request, params }) => {
		const form = await request.formData();
		const lieferungId = (form.get('lieferungId') as string)?.trim();
		const dateiname = (form.get('dateiname') as string)?.trim();
		if (!lieferungId || !dateiname) return fail(400, { error: 'Fehlende Parameter' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferung = lieferungen.find(
			(lu) => lu.id === lieferungId && lu.lieferantId === params.id
		);
		if (!lieferung) return fail(404, { error: 'Lieferung nicht gefunden' });

		loescheBelegLieferung(lieferungId, dateiname);
		lieferung.belege = lieferung.belege.filter((b) => b !== dateiname);
		lieferung.geaendert = new Date().toISOString();
		schreibeLieferanten({ lieferanten, lieferungen });
		return { success: true };
	},

	lieferungLoeschen: async ({ request, params }) => {
		const form = await request.formData();
		const lieferungId = (form.get('lieferungId') as string)?.trim();
		if (!lieferungId) return fail(400, { error: 'Lieferung-ID fehlt' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferung = lieferungen.find(
			(lu) => lu.id === lieferungId && lu.lieferantId === params.id
		);
		if (!lieferung) return fail(404, { error: 'Lieferung nicht gefunden' });

		// Manuell verknüpfte Buchungen (nicht die auto-erstellte) verhindern Löschen
		const buchungen = leseBuchungen();
		const manuellVerknuepft = buchungen.filter(
			(b) => b.lieferungId === lieferungId && b.id !== lieferung.buchungId
		);
		if (manuellVerknuepft.length > 0) {
			return fail(400, {
				error: `Lieferung kann nicht gelöscht werden – ${manuellVerknuepft.length} manuell verknüpfte Buchung(en)`
			});
		}

		// Auto-erstellte Buchung mitlöschen
		if (lieferung.buchungId) {
			schreibeBuchungen(buchungen.filter((b) => b.id !== lieferung.buchungId));
		}

		loescheBelegeOrdnerLieferung(lieferungId);
		schreibeLieferanten({
			lieferanten,
			lieferungen: lieferungen.filter((lu) => lu.id !== lieferungId)
		});
		return { success: true };
	},

	lieferantBearbeiten: async ({ request, params }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const notiz = (form.get('notiz') as string)?.trim() || undefined;

		if (!name) return fail(400, { editError: 'Name ist erforderlich' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === params.id);
		if (!lieferant) return fail(404, { editError: 'Lieferant nicht gefunden' });

		const isBankeinzug = form.get('zahlungsart') === 'bankeinzug';
		const bankeinzugTageRaw = parseInt(form.get('bankeinzugTage') as string);
		lieferant.name = name;
		lieferant.notiz = notiz;
		lieferant.zahlungsart = isBankeinzug ? 'bankeinzug' : undefined;
		lieferant.bankeinzugTage = isBankeinzug && !isNaN(bankeinzugTageRaw) ? bankeinzugTageRaw : undefined;
		lieferant.geaendert = new Date().toISOString();
		schreibeLieferanten({ lieferanten, lieferungen });
		return { editErfolg: true };
	},

	lieferungBearbeiten: async ({ request, params }) => {
		const form = await request.formData();
		const lieferungId = (form.get('lieferungId') as string)?.trim();
		const datum = (form.get('datum') as string)?.trim();
		if (!lieferungId) return fail(400, { editLieferungError: 'Lieferung-ID fehlt' });
		if (!datum) return fail(400, { editLieferungError: 'Datum ist erforderlich' });

		const { lieferanten, lieferungen } = leseLieferanten();
		const lieferant = lieferanten.find((l) => l.id === params.id);
		if (!lieferant) return fail(404, { editLieferungError: 'Lieferant nicht gefunden' });
		const lieferung = lieferungen.find(
			(lu) => lu.id === lieferungId && lu.lieferantId === params.id
		);
		if (!lieferung) return fail(404, { editLieferungError: 'Lieferung nicht gefunden' });

		lieferung.datum = datum;
		lieferung.beschreibung = (form.get('beschreibung') as string)?.trim() || undefined;
		lieferung.rechnungsnummer = (form.get('rechnungsnummer') as string)?.trim() || undefined;
		lieferung.lieferscheinnummer = (form.get('lieferscheinnummer') as string)?.trim() || undefined;
		lieferung.gewerk = (form.get('gewerk') as string)?.trim() || undefined;
		lieferung.notiz = (form.get('notiz') as string)?.trim() || undefined;
		lieferung.bezahltam = (form.get('bezahltam') as string)?.trim() || undefined;
		const betragRaw = (form.get('betrag') as string)?.trim();
		const isGutschriftEdit = form.get('gutschrift') === 'on';
		if (betragRaw) {
			const cents = parseCentsFromInput(betragRaw);
			const absWert = Math.abs(cents);
			lieferung.betrag = absWert > 0 ? (isGutschriftEdit ? -absWert : absWert) : undefined;
		} else {
			lieferung.betrag = undefined;
		}
		lieferung.geaendert = new Date().toISOString();

		// Buchung sync (erstellen / aktualisieren / löschen je nach betrag+gewerk)
		const buchungen = leseBuchungen();
		syncLieferungBuchung(lieferung, lieferant, buchungen);
		schreibeBuchungen(buchungen);

		schreibeLieferanten({ lieferanten, lieferungen });
		return { editLieferungErfolg: true };
	}
};
