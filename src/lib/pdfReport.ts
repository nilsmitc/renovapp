// @ts-expect-error pdfmake 0.3.x CJS default export
import PdfPrinter from 'pdfmake/js/Printer';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell, StyleDictionary } from 'pdfmake/interfaces';
import type { ProjektData, Buchung, Rechnung, LieferantenData } from './domain';
import { berechneGewerkSummaries, berechneRaumSummaries, abschlagEffektivStatus } from './domain';
import { formatCents, formatDatum } from './format';
import type { BauAnalyse } from './aiAnalyse';
import {
	berechneFinanzuebersicht,
	berechneNaechsteZahlungen,
	berechneMonatsDaten,
	berechneBurnRate,
	berechneSteuerDaten
} from './reportData';
import {
	renderKostenVerteilungChart,
	renderBudgetStackedChart,
	renderKategorieChart,
	renderKategorienNachGewerkChart,
	renderMonatsverlaufChart,
	renderKumuliertChart,
	renderPrognoseChart
} from './pdfCharts';

// pdfmake fonts (Roboto aus vfs_fonts als Buffer)
const fonts = {
	Roboto: {
		normal: Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64'),
		bold: Buffer.from(vfsFonts['Roboto-Medium.ttf'], 'base64'),
		italics: Buffer.from(vfsFonts['Roboto-Italic.ttf'], 'base64'),
		bolditalics: Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64')
	}
};

const STYLES: StyleDictionary = {
	h1: { fontSize: 26, bold: true, color: '#1F2937', margin: [0, 0, 0, 4] },
	h2: { fontSize: 16, bold: true, color: '#1F2937', margin: [0, 20, 0, 8] },
	h3: { fontSize: 12, bold: true, color: '#374151', margin: [0, 12, 0, 4] },
	klein: { fontSize: 9, color: '#6B7280' },
	betrag: { font: 'Roboto', alignment: 'right' as const },
	tabelleHeader: { bold: true, fontSize: 9, color: '#374151', fillColor: '#F3F4F6' }
};

const TABLE_LAYOUT = {
	hLineWidth: () => 0.5,
	vLineWidth: () => 0,
	hLineColor: () => '#E5E7EB',
	paddingLeft: () => 8,
	paddingRight: () => 8,
	paddingTop: () => 5,
	paddingBottom: () => 5
};


function headerZelle(text: string, alignment: 'left' | 'right' | 'center' = 'left'): TableCell {
	return { text, style: 'tabelleHeader', alignment };
}

function betragZelle(cents: number, farbe?: string): TableCell {
	return { text: formatCents(cents), alignment: 'right' as const, fontSize: 9, color: farbe ?? '#1F2937' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function kpiBlock(label: string, wert: string, farbe?: string): any {
	return {
		width: '*',
		stack: [
			{ text: label, style: 'klein' },
			{ text: wert, fontSize: 14, bold: true, color: farbe ?? '#1F2937', margin: [0, 2, 0, 0] }
		]
	};
}

export async function erstelleBauleiterbericht(
	projekt: ProjektData,
	buchungen: Buchung[],
	rechnungen: Rechnung[],
	lieferantenData: LieferantenData,
	aiAnalyse: BauAnalyse | null,
	aiAngefragt: boolean = false
): Promise<Uint8Array> {
	const gewerkSummaries = berechneGewerkSummaries(buchungen, projekt.gewerke, projekt.budgets);
	const raumSummaries = berechneRaumSummaries(buchungen, projekt.raeume);

	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const verbrauchtProzent = gesamtBudget > 0 ? Math.round((gesamtIst / gesamtBudget) * 100) : 0;

	// Finanzübersicht (offen, restauftrag, frei verfügbar)
	const finanz = berechneFinanzuebersicht(buchungen, projekt, rechnungen);
	const naechsteZahlungen = berechneNaechsteZahlungen(rechnungen, projekt.gewerke);

	// Monatsdaten + Burn Rate
	const monatsDaten = berechneMonatsDaten(buchungen);
	const burnRateResult = berechneBurnRate(monatsDaten, finanz.freiVerfuegbar);

	// Prognose-Chart-Daten (mit bekannten Zahlungen)
	let erschoepfungsDatum: string | null = null;
	const chartLabels = monatsDaten.map((m) => m.label);
	const chartIst: (number | null)[] = monatsDaten.map((m) => m.kumuliert);
	const chartPrognose: (number | null)[] = monatsDaten.map((_, i) =>
		i === monatsDaten.length - 1 ? monatsDaten[monatsDaten.length - 1].kumuliert : null
	);
	const chartBudget: number[] = monatsDaten.map(() => gesamtBudget);

	if (monatsDaten.length > 0 && burnRateResult.burnRateMonatlich > 0) {
		const letzterHistorisch = monatsDaten[monatsDaten.length - 1];
		const [lastYear, lastMonth] = letzterHistorisch.monat.split('-').map(Number);

		// Bekannte zukünftige Zahlungen aus offenen Abschlägen
		const ersteFutureDatum = new Date(lastYear, lastMonth, 1);
		const ersteFutureMonat = `${ersteFutureDatum.getFullYear()}-${String(ersteFutureDatum.getMonth() + 1).padStart(2, '0')}`;
		const bekannteZahlungenProMonat: Record<string, number> = {};
		for (const r of rechnungen) {
			for (const a of r.abschlaege) {
				if (a.status === 'bezahlt') continue;
				if (!a.faelligkeitsdatum) continue;
				const monat =
					a.faelligkeitsdatum.slice(0, 7) <= letzterHistorisch.monat
						? ersteFutureMonat
						: a.faelligkeitsdatum.slice(0, 7);
				bekannteZahlungenProMonat[monat] =
					(bekannteZahlungenProMonat[monat] ?? 0) + a.rechnungsbetrag;
			}
		}

		// Erschöpfungsdatum via monatlicher Simulation
		let restMonate: number | null = null;
		let simKumuliert = gesamtIst;
		for (let i = 1; i <= 120; i++) {
			const d = new Date(lastYear, lastMonth - 1 + i, 1);
			const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			simKumuliert += burnRateResult.burnRateMonatlich + (bekannteZahlungenProMonat[ms] ?? 0);
			if (simKumuliert >= gesamtBudget) {
				restMonate = i;
				erschoepfungsDatum = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
				break;
			}
		}

		// Chart-Datenpunkte
		const maxProg = Math.min(restMonate ?? 18, 18);
		let progKumuliert = gesamtIst;
		for (let i = 1; i <= maxProg; i++) {
			const datum = new Date(lastYear, lastMonth - 1 + i, 1);
			const monatStr = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
			chartLabels.push(datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
			chartIst.push(null);
			const bekannt = bekannteZahlungenProMonat[monatStr] ?? 0;
			const roh = progKumuliert + burnRateResult.burnRateMonatlich + bekannt;
			progKumuliert = Math.min(roh, gesamtBudget);
			chartPrognose.push(progKumuliert);
			chartBudget.push(gesamtBudget);
			if (roh >= gesamtBudget) break;
		}
	}

	// Gewerk-Finanzdaten für erweiterte Tabelle
	const gewerkFinanz = gewerkSummaries.map((s) => {
		const offen = finanz.offenPerGewerk[s.gewerk.id] ?? 0;
		const restauftrag = finanz.restauftragPerGewerk[s.gewerk.id] ?? 0;
		const frei = s.budget - s.ist - offen - restauftrag;
		return { ...s, offen, restauftrag, frei };
	});

	// Charts rendern
	const [
		chartKosten,
		chartBudgetStacked,
		chartKategorie,
		chartKatNachGewerk,
		chartMonat,
		chartKumuliert,
		chartPrognoseImg
	] = await Promise.all([
		renderKostenVerteilungChart(gewerkSummaries),
		renderBudgetStackedChart(gewerkFinanz),
		renderKategorieChart(
			gewerkSummaries.reduce((s, g) => s + g.material, 0),
			gewerkSummaries.reduce((s, g) => s + g.arbeitslohn, 0),
			gewerkSummaries.reduce((s, g) => s + g.sonstiges, 0)
		),
		renderKategorienNachGewerkChart(gewerkSummaries),
		monatsDaten.length > 0 ? renderMonatsverlaufChart(monatsDaten) : Promise.resolve(''),
		monatsDaten.length > 0 ? renderKumuliertChart(monatsDaten) : Promise.resolve(''),
		chartLabels.length > 0 ? renderPrognoseChart(chartLabels, chartIst, chartPrognose, chartBudget) : Promise.resolve('')
	]);

	const heute = new Date().toISOString().slice(0, 10);

	// === PDF-Inhalt aufbauen ===
	const content: Content[] = [];

	// ─── DECKBLATT ───
	const festEingeplant = finanz.gesamtOffen + finanz.gesamtRestauftrag;
	const naechsteFaelligkeit = naechsteZahlungen.length > 0 ? naechsteZahlungen[0] : null;

	content.push(
		{ text: 'Bauleiter-Bericht', style: 'h1', fontSize: 32, margin: [0, 80, 0, 8] },
		{ text: `Kostenstand per ${formatDatum(heute)}`, fontSize: 14, color: '#6B7280', margin: [0, 0, 0, 40] },
		// KPI-Zeile 1
		{
			columns: [
				kpiBlock('Gesamtbudget', formatCents(gesamtBudget)),
				kpiBlock('Ausgaben', formatCents(gesamtIst)),
				kpiBlock('Noch verfügbar', formatCents(finanz.freiVerfuegbar), finanz.freiVerfuegbar < 0 ? '#EF4444' : '#10B981'),
				kpiBlock('Verbraucht', `${verbrauchtProzent} %`)
			],
			margin: [0, 0, 0, 16]
		},
		// KPI-Zeile 2
		{
			columns: [
				kpiBlock('Fest eingeplant', formatCents(festEingeplant), festEingeplant > 0 ? '#8B5CF6' : '#6B7280'),
				kpiBlock('Burn Rate (3 Mo.)', burnRateResult.burnRateMonatlich > 0 ? `${formatCents(burnRateResult.burnRateMonatlich)} / Mo.` : '—'),
				kpiBlock('Offene Rechnungen', finanz.ausstehendRechnungen > 0 ? `${finanz.ausstehendRechnungen}` : '—',
					finanz.hatUeberfaellige ? '#EF4444' : finanz.hatBaldFaellige ? '#D97706' : finanz.ausstehendRechnungen > 0 ? '#F97316' : '#6B7280'),
				kpiBlock('Nächste Fälligkeit',
					naechsteFaelligkeit?.faelligkeitsdatum ? formatDatum(naechsteFaelligkeit.faelligkeitsdatum) : '—',
					naechsteFaelligkeit?.effektivStatus === 'ueberfaellig' ? '#EF4444' : naechsteFaelligkeit?.effektivStatus === 'bald_faellig' ? '#D97706' : '#6B7280')
			],
			margin: [0, 0, 0, 20]
		}
	);

	// Gestapelter Fortschrittsbalken: Bezahlt (blau) + Offen (orange) + Restauftrag (violett)
	const barWidth = 515;
	const bindungGesamt = gesamtIst + finanz.gesamtOffen + finanz.gesamtRestauftrag;
	const barBasis = Math.max(gesamtBudget, bindungGesamt);
	const barBezahlt = barBasis > 0 ? Math.min(barWidth, barWidth * gesamtIst / barBasis) : 0;
	const barOffen = barBasis > 0 ? Math.min(barWidth - barBezahlt, barWidth * finanz.gesamtOffen / barBasis) : 0;
	const barRestauftrag = barBasis > 0 ? Math.min(barWidth - barBezahlt - barOffen, barWidth * finanz.gesamtRestauftrag / barBasis) : 0;

	content.push(
		{
			canvas: [
				{ type: 'rect', x: 0, y: 0, w: barWidth, h: 12, r: 4, color: '#E5E7EB' },
				...(barRestauftrag > 0 ? [{ type: 'rect' as const, x: 0, y: 0, w: Math.min(barWidth, barBezahlt + barOffen + barRestauftrag), h: 12, r: 4, color: '#8B5CF6' }] : []),
				...(barOffen > 0 ? [{ type: 'rect' as const, x: 0, y: 0, w: Math.min(barWidth, barBezahlt + barOffen), h: 12, r: 4, color: '#F97316' }] : []),
				...(barBezahlt > 0 ? [{ type: 'rect' as const, x: 0, y: 0, w: barBezahlt, h: 12, r: 4, color: '#3B82F6' }] : [])
			],
			margin: [0, 0, 0, 4]
		},
		{
			columns: [
				{ text: 'Bezahlt', fontSize: 7, color: '#3B82F6', width: 'auto' },
				{ text: '  ', width: 4 },
				{ text: 'Offen', fontSize: 7, color: '#F97316', width: 'auto' },
				{ text: '  ', width: 4 },
				{ text: 'Restauftrag', fontSize: 7, color: '#8B5CF6', width: 'auto' },
				{ text: '', width: '*' }
			],
			margin: [0, 0, 0, 12]
		}
	);

	if (buchungen.length > 0) {
		content.push({
			text: `${buchungen.length} Buchungen | ${monatsDaten.length} Monate | ${projekt.gewerke.length} Gewerke | ${projekt.raeume.length} Räume`,
			style: 'klein',
			margin: [0, 0, 0, 0]
		});
	}

	// ─── KI-EINSCHÄTZUNG ───
	if (aiAngefragt && !aiAnalyse) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Zusammenfassung & Bewertung', style: 'h2', fontSize: 20 },
			{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#9CA3AF' }], margin: [0, 0, 0, 16] },
			{ text: 'Die KI-Analyse konnte nicht erstellt werden.', fontSize: 11, color: '#6B7280', margin: [0, 0, 0, 8] },
			{ text: 'Mögliche Ursachen: Claude CLI nicht verfügbar, Timeout oder Fehler bei der Verarbeitung. Bitte prüfe, ob "claude" installiert und im PATH ist.', fontSize: 9, color: '#9CA3AF' }
		);
	}
	if (aiAnalyse) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Zusammenfassung & Bewertung', style: 'h2', fontSize: 20 },
			{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#3B82F6' }], margin: [0, 0, 0, 16] }
		);

		if (aiAnalyse.zusammenfassung) {
			content.push(
				{ text: 'Projektstatus', style: 'h3' },
				{ text: aiAnalyse.zusammenfassung, fontSize: 10, lineHeight: 1.5, margin: [0, 0, 0, 12] }
			);
		}

		if (aiAnalyse.risikobewertung) {
			content.push(
				{ text: 'Risikobewertung', style: 'h3' },
				{ text: aiAnalyse.risikobewertung, fontSize: 10, lineHeight: 1.5, margin: [0, 0, 0, 12] }
			);
		}

		if (aiAnalyse.cashflowBewertung) {
			content.push(
				{ text: 'Cashflow-Bewertung', style: 'h3' },
				{ text: aiAnalyse.cashflowBewertung, fontSize: 10, lineHeight: 1.5, margin: [0, 0, 0, 12] }
			);
		}

		if (aiAnalyse.empfehlungen.length > 0) {
			content.push(
				{ text: 'Empfehlungen', style: 'h3' },
				{
					ul: aiAnalyse.empfehlungen.map((e) => ({ text: e, fontSize: 10, lineHeight: 1.5 })),
					margin: [0, 0, 0, 12]
				}
			);
		}

		if (aiAnalyse.dokumentenAnalyse) {
			content.push(
				{ text: 'Dokumentenanalyse', style: 'h3' },
				{ text: aiAnalyse.dokumentenAnalyse, fontSize: 10, lineHeight: 1.5, margin: [0, 0, 0, 12] }
			);
		}

		content.push({
			text: 'Diese Analyse wurde von Claude AI erstellt und dient als Orientierung.',
			fontSize: 8,
			italics: true,
			color: '#9CA3AF',
			margin: [0, 20, 0, 0]
		});
	}

	// ─── BUDGET-ÜBERSICHT ───
	content.push(
		{ text: '', pageBreak: 'after' },
		{ text: 'Budget-Übersicht', style: 'h2', fontSize: 20 }
	);

	if (chartKosten) {
		content.push(
			{ text: 'Kosten nach Gewerk', style: 'h3' },
			{ image: chartKosten, width: 500, margin: [0, 0, 0, 12] }
		);
	}
	if (chartBudgetStacked) {
		content.push(
			{ text: 'Budget vs. Bindung nach Gewerk', style: 'h3' },
			{ image: chartBudgetStacked, width: 500, margin: [0, 0, 0, 12] }
		);
	}

	// Budget-Tabelle (erweitert: 8 Spalten)
	const budgetBody: TableCell[][] = [
		[headerZelle('Gewerk'), headerZelle('Budget', 'right'), headerZelle('Bezahlt', 'right'), headerZelle('Offen', 'right'), headerZelle('Restauftrag', 'right'), headerZelle('Frei', 'right'), headerZelle('Status', 'center')]
	];
	for (const s of gewerkFinanz.filter((g) => g.ist > 0 || g.budget > 0)) {
		const statusText = s.gewerk.pauschal ? 'Sammelgewerk'
			: s.frei < 0 ? 'Kritisch'
			: s.budget > 0 && s.frei < s.budget * 0.2 ? 'Achtung'
			: 'Im Rahmen';
		const statusFarbe = s.gewerk.pauschal ? '#6B7280'
			: s.frei < 0 ? '#EF4444'
			: s.budget > 0 && s.frei < s.budget * 0.2 ? '#F59E0B'
			: '#10B981';
		budgetBody.push([
			{ text: s.gewerk.name, fontSize: 9, bold: true },
			betragZelle(s.budget, '#6B7280'),
			betragZelle(s.ist, '#10B981'),
			s.offen > 0 ? betragZelle(s.offen, '#F97316') : { text: '—', alignment: 'right' as const, fontSize: 9, color: '#D1D5DB' },
			s.restauftrag > 0 ? betragZelle(s.restauftrag, '#8B5CF6') : { text: '—', alignment: 'right' as const, fontSize: 9, color: '#D1D5DB' },
			betragZelle(s.frei, s.frei < 0 ? '#EF4444' : '#10B981'),
			{ text: statusText, alignment: 'center' as const, fontSize: 8, bold: true, color: statusFarbe }
		]);
	}
	// Summenzeile
	budgetBody.push([
		{ text: 'Gesamt', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtBudget), alignment: 'right' as const, fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtIst), alignment: 'right' as const, fontSize: 9, bold: true, color: '#10B981', fillColor: '#F3F4F6' },
		{ text: formatCents(finanz.gesamtOffen), alignment: 'right' as const, fontSize: 9, bold: true, color: '#F97316', fillColor: '#F3F4F6' },
		{ text: formatCents(finanz.gesamtRestauftrag), alignment: 'right' as const, fontSize: 9, bold: true, color: '#8B5CF6', fillColor: '#F3F4F6' },
		{ text: formatCents(finanz.freiVerfuegbar), alignment: 'right' as const, fontSize: 9, bold: true, color: finanz.freiVerfuegbar < 0 ? '#EF4444' : '#10B981', fillColor: '#F3F4F6' },
		{ text: '', fillColor: '#F3F4F6' }
	]);

	content.push({
		table: {
			headerRows: 1,
			widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
			body: budgetBody
		},
		layout: TABLE_LAYOUT,
		margin: [0, 0, 0, 0]
	});

	// Sammelgewerk-Aufschlüsselung
	const sammelgewerke = gewerkFinanz.filter((g) => g.gewerk.pauschal && g.ist > 0);
	for (const sg of sammelgewerke) {
		const taetigkeiten = new Map<string, number>();
		for (const b of buchungen.filter((b) => b.gewerk === sg.gewerk.id)) {
			const key = b.taetigkeit || 'Ohne Zuordnung';
			taetigkeiten.set(key, (taetigkeiten.get(key) ?? 0) + b.betrag);
		}
		if (taetigkeiten.size === 0) continue;

		content.push({ text: `${sg.gewerk.name} — Aufschlüsselung nach Tätigkeit`, style: 'h3' });
		const tBody: TableCell[][] = [
			[headerZelle('Tätigkeit'), headerZelle('Betrag', 'right'), headerZelle('Anteil', 'right')]
		];
		const sorted = [...taetigkeiten.entries()].sort(([, a], [, b]) => b - a);
		for (const [taetigkeit, betrag] of sorted) {
			tBody.push([
				{ text: taetigkeit, fontSize: 9 },
				betragZelle(betrag),
				{ text: sg.ist > 0 ? `${Math.round((betrag / sg.ist) * 100)} %` : '—', alignment: 'right' as const, fontSize: 9, color: '#6B7280' }
			]);
		}
		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: tBody },
			layout: TABLE_LAYOUT,
			margin: [0, 0, 0, 8]
		});
	}

	// ─── KATEGORIEN-ANALYSE ───
	content.push(
		{ text: 'Kategorien-Analyse', style: 'h2', fontSize: 20 }
	);

	if (chartKategorie) {
		content.push(
			{ text: 'Kostenverteilung', style: 'h3' },
			{ image: chartKategorie, width: 500, margin: [0, 0, 0, 12] }
		);
	}
	if (chartKatNachGewerk) {
		content.push(
			{ text: 'Kategorien nach Gewerk', style: 'h3' },
			{ image: chartKatNachGewerk, width: 500, margin: [0, 0, 0, 12] }
		);
	}

	// Kategorien-Tabelle
	const katBody: TableCell[][] = [
		[headerZelle('Gewerk'), headerZelle('Material', 'right'), headerZelle('Arbeitslohn', 'right'), headerZelle('Sonstiges', 'right'), headerZelle('Gesamt', 'right')]
	];
	for (const s of gewerkSummaries.filter((g) => g.ist > 0)) {
		katBody.push([
			{ text: s.gewerk.name, fontSize: 9, bold: true },
			betragZelle(s.material, '#3B82F6'),
			betragZelle(s.arbeitslohn, '#F97316'),
			betragZelle(s.sonstiges, '#6B7280'),
			betragZelle(s.ist)
		]);
	}
	const gesamtMaterial = gewerkSummaries.reduce((s, g) => s + g.material, 0);
	const gesamtArbeitslohn = gewerkSummaries.reduce((s, g) => s + g.arbeitslohn, 0);
	const gesamtSonstiges = gewerkSummaries.reduce((s, g) => s + g.sonstiges, 0);
	katBody.push([
		{ text: 'Gesamt', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtMaterial), alignment: 'right' as const, fontSize: 9, bold: true, color: '#3B82F6', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtArbeitslohn), alignment: 'right' as const, fontSize: 9, bold: true, color: '#F97316', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtSonstiges), alignment: 'right' as const, fontSize: 9, bold: true, color: '#6B7280', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtIst), alignment: 'right' as const, fontSize: 9, bold: true, fillColor: '#F3F4F6' }
	]);

	content.push({
		table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: katBody },
		layout: TABLE_LAYOUT,
		margin: [0, 0, 0, 0]
	});

	// ─── KOSTEN NACH RAUM ───
	const raeumeActive = raumSummaries.filter((r) => r.ist > 0);
	if (raeumeActive.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Kosten nach Raum', style: 'h2', fontSize: 20 }
		);

		const geschosse = ['EG', 'OG', 'KG'];
		for (const geschoss of geschosse) {
			const gRaeume = raeumeActive.filter((r) => r.raum.geschoss === geschoss);
			if (gRaeume.length === 0) continue;

			content.push({ text: geschoss, style: 'h3' });
			const raumBody: TableCell[][] = [
				[headerZelle('Raum'), headerZelle('Ausgaben', 'right'), headerZelle('Aufschlüsselung')]
			];
			for (const r of gRaeume) {
				const details = Object.entries(r.nachGewerk)
					.sort(([, a], [, b]) => b - a)
					.map(([gId, betrag]) => {
						const gName = projekt.gewerke.find((g) => g.id === gId)?.name ?? gId;
						return `${gName}: ${formatCents(betrag)}`;
					})
					.join(', ');
				raumBody.push([
					{ text: r.raum.name, fontSize: 9, bold: true },
					betragZelle(r.ist),
					{ text: details, fontSize: 8, color: '#6B7280' }
				]);
			}
			content.push({
				table: { headerRows: 1, widths: ['auto', 'auto', '*'], body: raumBody },
				layout: TABLE_LAYOUT,
				margin: [0, 0, 0, 8]
			});
		}
	}

	// ─── AUFTRAGSSTATUS ───
	if (rechnungen.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Auftragsstatus', style: 'h2', fontSize: 20 }
		);

		// Erweiterte Tabelle mit Nachträge-Spalte
		const aufBody: TableCell[][] = [
			[headerZelle('Auftragnehmer'), headerZelle('Gewerk'), headerZelle('Ursprüngl.', 'right'), headerZelle('Nachträge', 'right'), headerZelle('Gesamt', 'right'), headerZelle('Bezahlt', 'right'), headerZelle('Offen', 'right'), headerZelle('Status', 'center')]
		];

		let summeUrspruenglich = 0;
		let summeNachtraege = 0;
		let summeGesamt = 0;
		let summeBezahlt = 0;
		let summeOffen = 0;

		for (const r of rechnungen) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const urspruenglich = r.auftragssumme ?? 0;
			const auftragGesamt = urspruenglich + nachtraege;
			const bezahlt = r.abschlaege.filter((a) => abschlagEffektivStatus(a) === 'bezahlt').reduce((s, a) => s + a.rechnungsbetrag, 0);
			const offen = r.abschlaege.filter((a) => { const st = abschlagEffektivStatus(a); return st === 'offen' || st === 'ueberfaellig' || st === 'bald_faellig'; }).reduce((s, a) => s + a.rechnungsbetrag, 0);
			const hatUeberfaellig = r.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');

			summeUrspruenglich += urspruenglich;
			summeNachtraege += nachtraege;
			summeGesamt += auftragGesamt;
			summeBezahlt += bezahlt;
			summeOffen += offen;

			const gewerkName = projekt.gewerke.find((g) => g.id === r.gewerk)?.name ?? r.gewerk;
			const hatAusstehend = r.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ausstehend');
			const statusText = hatUeberfaellig ? 'Überfällig'
				: offen > 0 ? 'Offen'
				: hatAusstehend ? 'Ausstehend'
				: (bezahlt > 0 && bezahlt < auftragGesamt) ? 'Teilw. bezahlt'
				: bezahlt >= auftragGesamt && auftragGesamt > 0 ? 'Bezahlt'
				: 'Ausstehend';
			const statusFarbe = hatUeberfaellig ? '#EF4444'
				: offen > 0 ? '#F97316'
				: hatAusstehend ? '#6B7280'
				: (bezahlt > 0 && bezahlt < auftragGesamt) ? '#3B82F6'
				: '#10B981';

			aufBody.push([
				{ text: r.auftragnehmer, fontSize: 9, bold: true },
				{ text: gewerkName, fontSize: 9 },
				betragZelle(urspruenglich),
				nachtraege > 0 ? betragZelle(nachtraege, '#D97706') : { text: '—', alignment: 'right' as const, fontSize: 9, color: '#D1D5DB' },
				betragZelle(auftragGesamt),
				betragZelle(bezahlt, '#10B981'),
				betragZelle(offen, offen > 0 ? '#F97316' : '#6B7280'),
				{ text: statusText, alignment: 'center' as const, fontSize: 8, bold: true, color: statusFarbe }
			]);
		}

		aufBody.push([
			{ text: 'Gesamt', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
			{ text: '', fillColor: '#F3F4F6' },
			{ text: formatCents(summeUrspruenglich), alignment: 'right' as const, fontSize: 9, bold: true, fillColor: '#F3F4F6' },
			{ text: formatCents(summeNachtraege), alignment: 'right' as const, fontSize: 9, bold: true, color: '#D97706', fillColor: '#F3F4F6' },
			{ text: formatCents(summeGesamt), alignment: 'right' as const, fontSize: 9, bold: true, fillColor: '#F3F4F6' },
			{ text: formatCents(summeBezahlt), alignment: 'right' as const, fontSize: 9, bold: true, color: '#10B981', fillColor: '#F3F4F6' },
			{ text: formatCents(summeOffen), alignment: 'right' as const, fontSize: 9, bold: true, color: '#F97316', fillColor: '#F3F4F6' },
			{ text: '', fillColor: '#F3F4F6' }
		]);

		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'], body: aufBody },
			layout: TABLE_LAYOUT,
			margin: [0, 0, 0, 0]
		});

		// Nächste Zahlungen
		const relevanteZahlungen = naechsteZahlungen.slice(0, 10);
		if (relevanteZahlungen.length > 0) {
			content.push({ text: 'Nächste Zahlungen', style: 'h3' });
			const nzBody: TableCell[][] = [
				[headerZelle('Fälligkeit'), headerZelle('Auftragnehmer'), headerZelle('Gewerk'), headerZelle('Typ'), headerZelle('Betrag', 'right'), headerZelle('Status', 'center')]
			];

			for (const z of relevanteZahlungen) {
				const istUeberfaellig = z.effektivStatus === 'ueberfaellig';
				const istBaldFaellig = z.effektivStatus === 'bald_faellig';
				const fillColor = istUeberfaellig ? '#FEF2F2' : istBaldFaellig ? '#FFFBEB' : undefined;

				let statusText = z.effektivStatus === 'ueberfaellig' ? 'Überfällig'
					: z.effektivStatus === 'bald_faellig' ? 'Bald fällig'
					: 'Offen';
				if (z.tageVerbleibend !== null) {
					if (z.tageVerbleibend < 0) statusText += ` (${Math.abs(z.tageVerbleibend)} Tage)`;
					else if (z.tageVerbleibend === 0) statusText = 'Heute fällig';
					else statusText += ` (in ${z.tageVerbleibend} T.)`;
				}

				nzBody.push([
					{ text: z.faelligkeitsdatum ? formatDatum(z.faelligkeitsdatum) : '—', fontSize: 9, fillColor },
					{ text: z.auftragnehmer, fontSize: 9, fillColor },
					{ text: z.gewerkName, fontSize: 9, fillColor },
					{ text: `${z.typ} #${z.nummer}`, fontSize: 9, fillColor },
					{ text: formatCents(z.betrag), alignment: 'right' as const, fontSize: 9, fillColor },
					{ text: statusText, alignment: 'center' as const, fontSize: 8, bold: true,
						color: istUeberfaellig ? '#EF4444' : istBaldFaellig ? '#D97706' : '#6B7280', fillColor }
				]);
			}

			content.push({
				table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'], body: nzBody },
				layout: TABLE_LAYOUT,
				margin: [0, 0, 0, 0]
			});
		}
	}

	// ─── STEUER §35a ───
	const steuerDaten = berechneSteuerDaten(buchungen);
	if (steuerDaten.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Steuerliche Auswertung — §35a EStG', style: 'h2', fontSize: 20 }
		);

		for (const sj of steuerDaten) {
			content.push(
				{ text: `Steuerjahr ${sj.jahr}`, style: 'h3' },
				{
					columns: [
						kpiBlock('Handwerkerleistungen', formatCents(sj.summe)),
						kpiBlock('Bemessungsgrundlage', formatCents(Math.min(sj.summe, 600000))),
						kpiBlock('Steuererstattung (20%)', formatCents(sj.erstattung), '#10B981'),
						kpiBlock('Limit-Ausschöpfung', `${sj.limitProzent} %`, sj.limitProzent >= 100 ? '#F59E0B' : '#6B7280')
					],
					margin: [0, 0, 0, 8]
				}
			);

			const stBody: TableCell[][] = [
				[headerZelle('Datum'), headerZelle('Beschreibung'), headerZelle('Gewerk'), headerZelle('Betrag', 'right'), headerZelle('Arbeitsanteil', 'right')]
			];
			for (const b of sj.buchungen) {
				const gewerkName = projekt.gewerke.find((g) => g.id === b.gewerk)?.name ?? b.gewerk;
				const anteil = b.arbeitsanteilCents ?? b.betrag;
				stBody.push([
					{ text: formatDatum(b.datum), fontSize: 9 },
					{ text: b.beschreibung, fontSize: 9 },
					{ text: gewerkName, fontSize: 9 },
					betragZelle(b.betrag),
					anteil !== b.betrag ? betragZelle(anteil, '#3B82F6') : { text: '= Betrag', alignment: 'right' as const, fontSize: 8, color: '#6B7280' }
				]);
			}
			content.push({
				table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto'], body: stBody },
				layout: TABLE_LAYOUT,
				margin: [0, 0, 0, 12]
			});
		}

		content.push({
			text: 'Grundlage: bestätigte Handwerkerleistungen (Arbeitslohn). Maximal 6.000 € Bemessungsgrundlage pro Jahr, davon 20% = max. 1.200 € Steuererstattung.',
			fontSize: 8,
			italics: true,
			color: '#9CA3AF',
			margin: [0, 0, 0, 0]
		});
	}

	// ─── MONATSVERLAUF ───
	if (monatsDaten.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Monatsverlauf', style: 'h2', fontSize: 20 }
		);

		if (chartMonat) {
			content.push(
				{ text: 'Ausgaben pro Monat', style: 'h3' },
				{ image: chartMonat, width: 500, margin: [0, 0, 0, 12] }
			);
		}
		if (chartKumuliert) {
			content.push(
				{ text: 'Kumulierte Gesamtausgaben', style: 'h3' },
				{ image: chartKumuliert, width: 500, margin: [0, 0, 0, 12] }
			);
		}

		const monBody: TableCell[][] = [
			[headerZelle('Monat'), headerZelle('Ausgaben', 'right'), headerZelle('Material', 'right'), headerZelle('Arbeitslohn', 'right'), headerZelle('Sonstiges', 'right'), headerZelle('Kumuliert', 'right')]
		];
		const monateAnzeige = [...monatsDaten].reverse();
		for (const m of monateAnzeige) {
			monBody.push([
				{ text: m.label, fontSize: 9 },
				betragZelle(m.ausgaben),
				betragZelle(m.material, '#3B82F6'),
				betragZelle(m.arbeitslohn, '#F97316'),
				betragZelle(m.sonstiges, '#6B7280'),
				betragZelle(m.kumuliert, '#6B7280')
			]);
		}
		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: monBody },
			layout: TABLE_LAYOUT,
			margin: [0, 0, 0, 0]
		});
	}

	// ─── PROGNOSE ───
	if (monatsDaten.length > 0 && burnRateResult.burnRateMonatlich > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Prognose', style: 'h2', fontSize: 20 }
		);

		content.push({
			columns: [
				kpiBlock('Burn Rate (3 Mo. Ø)', `${formatCents(burnRateResult.burnRateMonatlich)} / Monat`),
				kpiBlock('Budget-Erschöpfung', erschoepfungsDatum ?? 'Im Rahmen'),
				kpiBlock('Frei verfügbar', formatCents(finanz.freiVerfuegbar), finanz.freiVerfuegbar < 0 ? '#EF4444' : '#10B981'),
				kpiBlock('Gebundene Mittel', formatCents(finanz.gesamtOffen + finanz.gesamtRestauftrag), '#8B5CF6')
			],
			margin: [0, 0, 0, 16]
		});

		if (chartPrognoseImg) {
			content.push(
				{ text: 'Ausgabenverlauf & Prognose', style: 'h3' },
				{ image: chartPrognoseImg, width: 500, margin: [0, 0, 0, 8] },
				{ text: 'Blau: Ist-Ausgaben | Orange gestrichelt: Prognose (inkl. bekannte Zahlungen) | Rot gestrichelt: Gesamtbudget', style: 'klein', margin: [0, 0, 0, 16] }
			);
		}

		// Gewerk-Prognose-Tabelle
		const gewerkeMitBudget = gewerkFinanz.filter((g) => g.budget > 0 && g.ist > 0);
		if (gewerkeMitBudget.length > 0) {
			content.push({ text: 'Gewerk-Prognose', style: 'h3' });
			const gpBody: TableCell[][] = [
				[headerZelle('Gewerk'), headerZelle('Ist', 'right'), headerZelle('Budget', 'right'), headerZelle('Gebunden', 'right'), headerZelle('Frei', 'right'), headerZelle('Risiko', 'center')]
			];
			for (const g of gewerkeMitBudget) {
				const gebunden = g.offen + g.restauftrag;
				const risikoText = g.frei < 0 ? 'Kritisch'
					: g.frei < g.budget * 0.2 ? 'Achtung'
					: g.gewerk.pauschal ? 'Sammelgewerk'
					: 'Im Rahmen';
				const risikoFarbe = g.frei < 0 ? '#EF4444'
					: g.frei < g.budget * 0.2 ? '#F59E0B'
					: g.gewerk.pauschal ? '#6B7280'
					: '#10B981';
				gpBody.push([
					{ text: g.gewerk.name, fontSize: 9, bold: true },
					betragZelle(g.ist),
					betragZelle(g.budget, '#6B7280'),
					gebunden > 0 ? betragZelle(gebunden, '#8B5CF6') : { text: '—', alignment: 'right' as const, fontSize: 9, color: '#D1D5DB' },
					betragZelle(g.frei, g.frei < 0 ? '#EF4444' : '#10B981'),
					{ text: risikoText, alignment: 'center' as const, fontSize: 8, bold: true, color: risikoFarbe }
				]);
			}
			content.push({
				table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: gpBody },
				layout: TABLE_LAYOUT,
				margin: [0, 0, 0, 0]
			});
		}
	}

	// ─── LIEFERANTEN ───
	if (lieferantenData.lieferanten.length > 0) {
		content.push(
			{ text: 'Lieferanten-Übersicht', style: 'h2', fontSize: 20 }
		);

		const liefBody: TableCell[][] = [
			[headerZelle('Lieferant'), headerZelle('Zahlungsart'), headerZelle('Lieferungen', 'right'), headerZelle('Gesamtbetrag', 'right'), headerZelle('Gutschriften', 'right')]
		];

		for (const l of lieferantenData.lieferanten) {
			const lieferungen = lieferantenData.lieferungen.filter((li) => li.lieferantId === l.id);
			if (lieferungen.length === 0) continue;

			const positiv = lieferungen.filter((li) => (li.betrag ?? 0) > 0).reduce((s, li) => s + (li.betrag ?? 0), 0);
			const gutschriften = lieferungen.filter((li) => (li.betrag ?? 0) < 0).reduce((s, li) => s + (li.betrag ?? 0), 0);
			const gesamt = positiv + gutschriften;

			const zahlungsartText = l.zahlungsart === 'bankeinzug' ? 'Bankeinzug'
				: l.zahlungsart === 'kartenzahlung' ? 'Kartenzahlung'
				: '—';

			liefBody.push([
				{ text: l.name, fontSize: 9, bold: true },
				{ text: zahlungsartText, fontSize: 9, color: '#6B7280' },
				{ text: String(lieferungen.length), alignment: 'right' as const, fontSize: 9 },
				betragZelle(gesamt),
				gutschriften < 0
					? { text: formatCents(gutschriften), alignment: 'right' as const, fontSize: 9, color: '#EF4444' }
					: { text: '—', alignment: 'right' as const, fontSize: 9, color: '#6B7280' }
			]);
		}

		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: liefBody },
			layout: TABLE_LAYOUT,
			margin: [0, 0, 0, 0]
		});
	}

	// === PDF-Dokument erstellen ===
	const docDefinition: TDocumentDefinitions = {
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 60],
		styles: STYLES,
		defaultStyle: { font: 'Roboto', fontSize: 10 },
		content,
		footer: (currentPage: number, pageCount: number) => ({
			columns: [
				{ text: 'RenovApp \u2013 Bauleiter-Bericht', style: 'klein', margin: [40, 0, 0, 0] },
				{ text: `Erstellt am ${formatDatum(heute)}`, style: 'klein', alignment: 'center' },
				{ text: `Seite ${currentPage} von ${pageCount}`, style: 'klein', alignment: 'right', margin: [0, 0, 40, 0] }
			],
			margin: [0, 20, 0, 0]
		})
	};

	const printer = new PdfPrinter.default(fonts);
	const pdfDoc = await printer.createPdfKitDocument(docDefinition);

	return new Promise<Uint8Array>((resolve, reject) => {
		const chunks: Uint8Array[] = [];
		pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
		pdfDoc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
		pdfDoc.on('error', reject);
		pdfDoc.end();
	});
}
