// === Types ===

export interface Gewerk {
	id: string;
	name: string;
	farbe: string;
	sortierung: number;
	pauschal?: boolean;
}

export interface Raum {
	id: string;
	name: string;
	geschoss: string;
	sortierung: number;
}

export type Kategorie = 'Material' | 'Arbeitslohn' | 'Sonstiges';

export const KATEGORIEN: Kategorie[] = ['Material', 'Arbeitslohn', 'Sonstiges'];

export interface Buchung {
	id: string;
	datum: string;
	betrag: number; // cents
	gewerk: string;
	raum: string | null;
	kategorie: Kategorie;
	beschreibung: string;
	rechnungsreferenz: string;
	taetigkeit?: string;
	rechnungId?: string;   // gesetzt wenn auto-erstellt aus bezahltem Abschlag
	lieferungId?: string;  // optionaler Link zu einer Lieferung
	belege: string[];
	erstellt: string;
	geaendert: string;
}

export interface Budget {
	gewerk: string;
	geplant: number; // cents
	notiz: string;
}

export interface ProjektData {
	gewerke: Gewerk[];
	raeume: Raum[];
	budgets: Budget[];
}

// === Lieferanten & Lieferungen ===

export interface LieferungPosition {
	beschreibung: string;
	menge?: string;    // z.B. "20 Stk", "5,5 m²"
	betrag?: number;   // Cents
}

export interface Lieferant {
	id: string;      // slugified, z.B. "hornbach", "bauhaus"
	name: string;
	notiz?: string;  // Kundennummer, Ansprechpartner etc.
	erstellt: string;
	geaendert: string;
}

export interface Lieferung {
	id: string;
	lieferantId: string;           // → Lieferant.id
	datum: string;                 // "YYYY-MM-DD"
	beschreibung?: string;
	rechnungsnummer?: string;      // Rechnungsnummer des Lieferanten
	lieferscheinnummer?: string;   // Lieferscheinnummer
	betrag?: number;               // Rechnungsbetrag des Lieferanten in Cents (zur Gegenkontrolle)
	gewerk?: string;               // optionale Gewerk-Zuordnung
	positionen?: LieferungPosition[]; // aus PDF extrahierte Einzelpositionen
	belege: string[];              // Lieferscheine, Händlerrechnungen etc.
	notiz?: string;
	buchungId?: string;            // Link zur auto-erstellten Buchung in buchungen.json
	erstellt: string;
	geaendert: string;
}

export interface LieferantenData {
	lieferanten: Lieferant[];
	lieferungen: Lieferung[];
}

// === Rechnungen & Abschläge ===

export interface Nachtrag {
	id: string;
	beschreibung: string;
	betrag: number; // cents
	datum?: string; // YYYY-MM-DD
	notiz?: string;
	erstellt: string;
}

export type AbschlagTyp = 'abschlag' | 'schlussrechnung' | 'nachtragsrechnung';
export type AbschlagStatus = 'ausstehend' | 'offen' | 'bezahlt' | 'ueberfaellig';

export interface Abschlag {
	id: string;
	typ: AbschlagTyp;
	nummer: number;             // auto-increment pro Rechnung (1, 2, 3 …)
	rechnungsnummer?: string;   // Rechnungsnummer vom Auftragnehmer
	rechnungsbetrag: number;    // Cents
	faelligkeitsdatum?: string; // YYYY-MM-DD
	bezahltam?: string;         // YYYY-MM-DD
	status: AbschlagStatus;     // 'ausstehend' = noch nicht gestellt
	buchungId?: string;         // Link zur auto-erstellten Buchung
	beleg?: string;             // Dateiname in data/rechnungen/{rechnungId}/{abschlagId}/
	notiz?: string;
	erstellt: string;
	geaendert: string;
}

export interface Rechnung {
	id: string;
	gewerk: string;          // Gewerk-ID
	auftragnehmer: string;
	kategorie: Kategorie;    // wird für auto-erstellte Buchungen verwendet
	auftragssumme?: number;  // Cents, optional
	auftragsdatum?: string;  // YYYY-MM-DD
	notiz?: string;
	nachtraege: Nachtrag[];  // genehmigte Mehraufwände (Change Orders)
	abschlaege: Abschlag[];
	erstellt: string;
	geaendert: string;
}

// === Aggregated Views ===

export interface GewerkSummary {
	gewerk: Gewerk;
	ist: number;
	material: number;
	arbeitslohn: number;
	sonstiges: number;
	budget: number;
	differenz: number;
	anzahl: number;
}

export interface RaumSummary {
	raum: Raum;
	ist: number;
	nachGewerk: Record<string, number>;
}

export interface DashboardData {
	gesamtIst: number;
	gesamtBudget: number;
	gewerkSummaries: GewerkSummary[];
	raumSummaries: RaumSummary[];
	letzteBuchungen: Buchung[];
}

// === Factories ===

export function createGewerk(name: string, farbe: string, sortierung: number): Gewerk {
	return { id: slugify(name), name, farbe, sortierung };
}

export function createRaum(name: string, geschoss: string, sortierung: number): Raum {
	return { id: slugify(`${name}-${geschoss}`), name, geschoss, sortierung };
}

export function createBuchung(
	data: Omit<Buchung, 'id' | 'belege' | 'erstellt' | 'geaendert'>
): Buchung {
	const now = new Date().toISOString();
	return {
		...data,
		id: crypto.randomUUID(),
		belege: [],
		erstellt: now,
		geaendert: now
	};
}

export function createRechnung(
	gewerk: string,
	auftragnehmer: string,
	kategorie: Kategorie
): Rechnung {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		gewerk,
		auftragnehmer,
		kategorie,
		nachtraege: [],
		abschlaege: [],
		erstellt: now,
		geaendert: now
	};
}

export function createNachtrag(beschreibung: string, betrag: number): Nachtrag {
	return {
		id: crypto.randomUUID(),
		beschreibung,
		betrag,
		erstellt: new Date().toISOString()
	};
}

export function createAbschlag(
	typ: AbschlagTyp,
	rechnungsbetrag: number,
	nummer: number
): Abschlag {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		typ,
		nummer,
		rechnungsbetrag,
		status: 'offen',
		erstellt: now,
		geaendert: now
	};
}

export function createLieferant(name: string, notiz?: string): Lieferant {
	const now = new Date().toISOString();
	return {
		id: slugify(name),
		name,
		notiz,
		erstellt: now,
		geaendert: now
	};
}

export function createLieferung(
	data: Omit<Lieferung, 'id' | 'belege' | 'erstellt' | 'geaendert'>
): Lieferung {
	const now = new Date().toISOString();
	return {
		...data,
		id: crypto.randomUUID(),
		belege: [],
		erstellt: now,
		geaendert: now
	};
}

/** Berechnet den effektiven Status eines Abschlags (ueberfaellig wenn offen + Fälligkeit überschritten) */
export function abschlagEffektivStatus(abschlag: Abschlag): AbschlagStatus {
	if (abschlag.status === 'offen' && abschlag.faelligkeitsdatum) {
		const heute = new Date().toISOString().slice(0, 10);
		if (abschlag.faelligkeitsdatum <= heute) return 'ueberfaellig';
	}
	return abschlag.status;
}

// === Validation ===

export function validateBuchung(
	data: Partial<Buchung>,
	gewerke: Gewerk[]
): string[] {
	const errors: string[] = [];
	if (!data.datum) errors.push('Datum ist erforderlich');
	if (!data.betrag) errors.push('Betrag muss ungleich 0 sein');
	if (!data.gewerk) errors.push('Gewerk ist erforderlich');
	if (data.gewerk && !gewerke.find((g) => g.id === data.gewerk))
		errors.push('Unbekanntes Gewerk');
	if (!data.kategorie || !KATEGORIEN.includes(data.kategorie))
		errors.push('Ungültige Kategorie');
	if (!data.beschreibung?.trim()) errors.push('Beschreibung ist erforderlich');
	return errors;
}

// === Aggregation ===

export function berechneGewerkSummaries(
	buchungen: Buchung[],
	gewerke: Gewerk[],
	budgets: Budget[]
): GewerkSummary[] {
	return gewerke
		.sort((a, b) => a.sortierung - b.sortierung)
		.map((gewerk) => {
			const gb = buchungen.filter((b) => b.gewerk === gewerk.id);
			const budget = budgets.find((b) => b.gewerk === gewerk.id)?.geplant ?? 0;
			const ist = gb.reduce((s, b) => s + b.betrag, 0);
			return {
				gewerk,
				ist,
				material: gb.filter((b) => b.kategorie === 'Material').reduce((s, b) => s + b.betrag, 0),
				arbeitslohn: gb
					.filter((b) => b.kategorie === 'Arbeitslohn')
					.reduce((s, b) => s + b.betrag, 0),
				sonstiges: gb
					.filter((b) => b.kategorie === 'Sonstiges')
					.reduce((s, b) => s + b.betrag, 0),
				budget,
				differenz: budget - ist,
				anzahl: gb.length
			};
		});
}

export function berechneRaumSummaries(
	buchungen: Buchung[],
	raeume: Raum[]
): RaumSummary[] {
	// Einzelraum-Summaries
	const raumSummaries = raeume
		.sort((a, b) => a.sortierung - b.sortierung)
		.map((raum) => {
			const rb = buchungen.filter((b) => b.raum === raum.id);
			const nachGewerk: Record<string, number> = {};
			for (const b of rb) {
				nachGewerk[b.gewerk] = (nachGewerk[b.gewerk] ?? 0) + b.betrag;
			}
			return {
				raum,
				ist: rb.reduce((s, b) => s + b.betrag, 0),
				nachGewerk
			};
		});

	// Stockwerk-Summaries (@EG, @OG, ...)
	const geschosse = [...new Set(raeume.map((r) => r.geschoss))].sort();
	const geschossSummaries: RaumSummary[] = geschosse
		.map((g) => {
			const rb = buchungen.filter((b) => b.raum === `@${g}`);
			if (rb.length === 0) return null;
			const nachGewerk: Record<string, number> = {};
			for (const b of rb) {
				nachGewerk[b.gewerk] = (nachGewerk[b.gewerk] ?? 0) + b.betrag;
			}
			const virtualRaum: Raum = { id: `@${g}`, name: `${g} (Stockwerk)`, geschoss: g, sortierung: -1 };
			return { raum: virtualRaum, ist: rb.reduce((s, b) => s + b.betrag, 0), nachGewerk };
		})
		.filter((s): s is RaumSummary => s !== null);

	return [...geschossSummaries, ...raumSummaries];
}

export function berechneDashboard(
	buchungen: Buchung[],
	projekt: ProjektData
): DashboardData {
	const gewerkSummaries = berechneGewerkSummaries(
		buchungen,
		projekt.gewerke,
		projekt.budgets
	);
	const raumSummaries = berechneRaumSummaries(buchungen, projekt.raeume);

	return {
		gesamtIst: buchungen.reduce((s, b) => s + b.betrag, 0),
		gesamtBudget: projekt.budgets.reduce((s, b) => s + b.geplant, 0),
		gewerkSummaries,
		raumSummaries,
		letzteBuchungen: [...buchungen].sort((a, b) => b.erstellt.localeCompare(a.erstellt)).slice(0, 10)
	};
}

// === Ort-Helpers ===

export function isGeschossBuchung(raum: string | null): boolean {
	return raum !== null && raum.startsWith('@');
}

export function raumLabel(raum: string | null, raeume: Raum[]): string {
	if (!raum) return '—';
	if (isGeschossBuchung(raum)) return `${raum.slice(1)} (Stockwerk)`;
	const r = raeume.find((r) => r.id === raum);
	return r ? `${r.name} (${r.geschoss})` : raum;
}

// === Helpers ===

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[äÄ]/g, 'ae')
		.replace(/[öÖ]/g, 'oe')
		.replace(/[üÜ]/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export { slugify };
