// @ts-expect-error pdfmake 0.3.x CJS default export
import PdfPrinter from 'pdfmake/js/Printer';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell, StyleDictionary } from 'pdfmake/interfaces';
import type { ProjektData, Buchung, Rechnung, LieferantenData, GewerkSummary, RaumSummary } from './domain';
import { berechneGewerkSummaries, berechneRaumSummaries, abschlagEffektivStatus } from './domain';
import { formatCents, formatDatum } from './format';
import type { BauAnalyse } from './aiAnalyse';
import {
	renderKostenVerteilungChart,
	renderBudgetVsIstChart,
	renderKategorieChart,
	renderKategorienNachGewerkChart,
	renderMonatsverlaufChart,
	renderKumuliertChart,
	renderPrognoseChart,
	type MonatsDaten
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

function prozent(ist: number, budget: number): string {
	if (budget === 0) return '—';
	return Math.round((ist / budget) * 100) + ' %';
}

function ampelFarbe(ist: number, budget: number): string {
	if (budget === 0) return '#6B7280';
	const p = ist / budget;
	if (p > 1) return '#EF4444';
	if (p >= 0.8) return '#F59E0B';
	return '#10B981';
}

function headerZelle(text: string, alignment: 'left' | 'right' | 'center' = 'left'): TableCell {
	return { text, style: 'tabelleHeader', alignment };
}

function betragZelle(cents: number, farbe?: string): TableCell {
	return { text: formatCents(cents), alignment: 'right' as const, fontSize: 9, color: farbe ?? '#1F2937' };
}

export async function erstelleBauleiterbericht(
	projekt: ProjektData,
	buchungen: Buchung[],
	rechnungen: Rechnung[],
	lieferantenData: LieferantenData,
	aiAnalyse: BauAnalyse | null
): Promise<Uint8Array> {
	const gewerkSummaries = berechneGewerkSummaries(buchungen, projekt.gewerke, projekt.budgets);
	const raumSummaries = berechneRaumSummaries(buchungen, projekt.raeume);

	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);
	const restBudget = gesamtBudget - gesamtIst;
	const verbrauchtProzent = gesamtBudget > 0 ? Math.round((gesamtIst / gesamtBudget) * 100) : 0;

	// Monatsdaten berechnen
	const monatsMap = new Map<string, { ausgaben: number; material: number; arbeitslohn: number; sonstiges: number }>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7);
		const existing = monatsMap.get(monat) ?? { ausgaben: 0, material: 0, arbeitslohn: 0, sonstiges: 0 };
		monatsMap.set(monat, {
			ausgaben: existing.ausgaben + b.betrag,
			material: existing.material + (b.kategorie === 'Material' ? b.betrag : 0),
			arbeitslohn: existing.arbeitslohn + (b.kategorie === 'Arbeitslohn' ? b.betrag : 0),
			sonstiges: existing.sonstiges + (b.kategorie === 'Sonstiges' ? b.betrag : 0)
		});
	}
	const sortedMonate = [...monatsMap.entries()].sort(([a], [b]) => a.localeCompare(b));
	let kumuliert = 0;
	const monate: (MonatsDaten & { material: number; arbeitslohn: number; sonstiges: number; monat: string })[] = sortedMonate.map(([monat, data]) => {
		kumuliert += data.ausgaben;
		const [year, month] = monat.split('-').map(Number);
		const label = new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
		return { monat, label, ausgaben: data.ausgaben, kumuliert, material: data.material, arbeitslohn: data.arbeitslohn, sonstiges: data.sonstiges };
	});

	// Prognose berechnen
	const burnRate = monate.length > 0 ? Math.round(gesamtIst / monate.length) : 0;
	const restMonate = burnRate > 0 && restBudget > 0 ? Math.ceil(restBudget / burnRate) : null;
	let erschoepfungsDatum: string | null = null;
	if (restMonate !== null && monate.length > 0) {
		const letzterMonat = monate[monate.length - 1].monat;
		const [ly, lm] = letzterMonat.split('-').map(Number);
		const datum = new Date(ly, lm - 1 + restMonate, 1);
		erschoepfungsDatum = datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
	}

	// Prognose-Chart-Daten
	const chartLabels = monate.map((m) => m.label);
	const chartIst: (number | null)[] = monate.map((m) => m.kumuliert);
	const chartPrognose: (number | null)[] = monate.map((_, i) => i === monate.length - 1 ? monate[monate.length - 1].kumuliert : null);
	const chartBudget: number[] = monate.map(() => gesamtBudget);

	if (monate.length > 0 && burnRate > 0) {
		const letzterHistorisch = monate[monate.length - 1];
		const [lastYear, lastMonth] = letzterHistorisch.monat.split('-').map(Number);
		const maxProg = Math.min(restMonate ?? 18, 18);
		for (let i = 1; i <= maxProg; i++) {
			const datum = new Date(lastYear, lastMonth - 1 + i, 1);
			chartLabels.push(datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
			chartIst.push(null);
			const progKumuliert = gesamtIst + burnRate * i;
			chartPrognose.push(Math.min(progKumuliert, gesamtBudget));
			chartBudget.push(gesamtBudget);
			if (progKumuliert >= gesamtBudget) break;
		}
	}

	// Gebundene Mittel
	let gebundenGesamt = 0;
	for (const r of rechnungen) {
		for (const a of r.abschlaege) {
			const s = abschlagEffektivStatus(a);
			if (s === 'offen' || s === 'ueberfaellig') gebundenGesamt += a.rechnungsbetrag;
		}
		if (r.auftragssumme !== undefined) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const gesamtAuftrag = r.auftragssumme + nachtraege;
			const alleAbschlaege = r.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
			const nichtVerplant = gesamtAuftrag - alleAbschlaege;
			if (nichtVerplant > 0) gebundenGesamt += nichtVerplant;
		}
	}

	// Charts rendern
	const [
		chartKosten,
		chartBudgetVsIst,
		chartKategorie,
		chartKatNachGewerk,
		chartMonat,
		chartKumuliert,
		chartPrognoseImg
	] = await Promise.all([
		renderKostenVerteilungChart(gewerkSummaries),
		renderBudgetVsIstChart(gewerkSummaries),
		renderKategorieChart(
			gewerkSummaries.reduce((s, g) => s + g.material, 0),
			gewerkSummaries.reduce((s, g) => s + g.arbeitslohn, 0),
			gewerkSummaries.reduce((s, g) => s + g.sonstiges, 0)
		),
		renderKategorienNachGewerkChart(gewerkSummaries),
		monate.length > 0 ? renderMonatsverlaufChart(monate) : Promise.resolve(''),
		monate.length > 0 ? renderKumuliertChart(monate) : Promise.resolve(''),
		chartLabels.length > 0 ? renderPrognoseChart(chartLabels, chartIst, chartPrognose, chartBudget) : Promise.resolve('')
	]);

	const heute = new Date().toISOString().slice(0, 10);

	// === PDF-Inhalt aufbauen ===
	const content: Content[] = [];

	// --- Deckblatt ---
	content.push(
		{ text: 'Bauleiter-Bericht', style: 'h1', fontSize: 32, margin: [0, 80, 0, 8] },
		{ text: `Kostenstand per ${formatDatum(heute)}`, fontSize: 14, color: '#6B7280', margin: [0, 0, 0, 40] },
		{
			columns: [
				{ width: '*', stack: [
					{ text: 'Gesamtbudget', style: 'klein' },
					{ text: formatCents(gesamtBudget), fontSize: 18, bold: true, margin: [0, 2, 0, 0] }
				]},
				{ width: '*', stack: [
					{ text: 'Ausgaben', style: 'klein' },
					{ text: formatCents(gesamtIst), fontSize: 18, bold: true, margin: [0, 2, 0, 0] }
				]},
				{ width: '*', stack: [
					{ text: 'Verbleibend', style: 'klein' },
					{ text: formatCents(restBudget), fontSize: 18, bold: true, color: restBudget < 0 ? '#EF4444' : '#10B981', margin: [0, 2, 0, 0] }
				]},
				{ width: '*', stack: [
					{ text: 'Verbraucht', style: 'klein' },
					{ text: `${verbrauchtProzent} %`, fontSize: 18, bold: true, margin: [0, 2, 0, 0] }
				]}
			],
			margin: [0, 0, 0, 20]
		},
		// Fortschrittsbalken
		{
			canvas: [
				{ type: 'rect', x: 0, y: 0, w: 515, h: 12, r: 4, color: '#E5E7EB' },
				{ type: 'rect', x: 0, y: 0, w: Math.min(515, 515 * verbrauchtProzent / 100), h: 12, r: 4, color: verbrauchtProzent > 100 ? '#EF4444' : verbrauchtProzent >= 80 ? '#F59E0B' : '#3B82F6' }
			],
			margin: [0, 0, 0, 20]
		}
	);

	if (gebundenGesamt > 0) {
		content.push({
			text: [
				{ text: 'Gebundene Mittel (offene Rechnungen + Verträge): ', style: 'klein' },
				{ text: formatCents(gebundenGesamt), fontSize: 10, bold: true, color: '#F97316' }
			],
			margin: [0, 0, 0, 0]
		});
	}

	if (buchungen.length > 0) {
		content.push({
			text: `${buchungen.length} Buchungen | ${monate.length} Monate | ${projekt.gewerke.length} Gewerke | ${projekt.raeume.length} Räume`,
			style: 'klein',
			margin: [0, 8, 0, 0]
		});
	}

	// --- KI-Einschätzung ---
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

		content.push({
			text: 'Diese Analyse wurde von Claude AI erstellt und dient als Orientierung.',
			fontSize: 8,
			italics: true,
			color: '#9CA3AF',
			margin: [0, 20, 0, 0]
		});
	}

	// --- Budget-Übersicht ---
	content.push(
		{ text: '', pageBreak: 'after' },
		{ text: 'Budget-Übersicht', style: 'h2', fontSize: 20 }
	);

	if (chartKosten && chartBudgetVsIst) {
		content.push({
			columns: [
				{ width: '*', stack: [
					{ text: 'Kosten nach Gewerk', style: 'h3' },
					{ image: chartKosten, width: 245 }
				]},
				{ width: '*', stack: [
					{ text: 'Budget vs. Ausgaben', style: 'h3' },
					{ image: chartBudgetVsIst, width: 245 }
				]}
			],
			margin: [0, 0, 0, 16]
		});
	}

	// Budget-Tabelle
	const budgetBody: TableCell[][] = [
		[headerZelle('Gewerk'), headerZelle('Budget', 'right'), headerZelle('Ausgaben', 'right'), headerZelle('Differenz', 'right'), headerZelle('%', 'right'), headerZelle('Status', 'center')]
	];
	for (const s of gewerkSummaries.filter((g) => g.ist > 0 || g.budget > 0)) {
		const pz = s.budget > 0 ? Math.round((s.ist / s.budget) * 100) : (s.ist > 0 ? 999 : 0);
		const farbe = ampelFarbe(s.ist, s.budget);
		const statusText = s.gewerk.pauschal ? 'Sammelgewerk' : (pz > 100 ? 'Überschritten' : pz >= 80 ? 'Achtung' : 'Im Rahmen');
		budgetBody.push([
			{ text: s.gewerk.name, fontSize: 9, bold: true },
			betragZelle(s.budget, '#6B7280'),
			betragZelle(s.ist),
			betragZelle(s.differenz, s.differenz < 0 ? '#EF4444' : '#10B981'),
			{ text: prozent(s.ist, s.budget), alignment: 'right', fontSize: 9 },
			{ text: statusText, alignment: 'center', fontSize: 8, bold: true, color: s.gewerk.pauschal ? '#6B7280' : farbe }
		]);
	}
	// Summenzeile
	budgetBody.push([
		{ text: 'Gesamt', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtBudget), alignment: 'right', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtIst), alignment: 'right', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: formatCents(restBudget), alignment: 'right', fontSize: 9, bold: true, color: restBudget < 0 ? '#EF4444' : '#10B981', fillColor: '#F3F4F6' },
		{ text: `${verbrauchtProzent} %`, alignment: 'right', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
		{ text: '', fillColor: '#F3F4F6' }
	]);

	content.push({
		table: {
			headerRows: 1,
			widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
			body: budgetBody
		},
		layout: TABLE_LAYOUT,
		margin: [0, 0, 0, 0]
	});

	// --- Kategorien-Analyse ---
	content.push(
		{ text: 'Kategorien-Analyse', style: 'h2', fontSize: 20 }
	);

	if (chartKategorie && chartKatNachGewerk) {
		content.push({
			columns: [
				{ width: '*', stack: [
					{ text: 'Kostenverteilung', style: 'h3' },
					{ image: chartKategorie, width: 245 }
				]},
				{ width: '*', stack: [
					{ text: 'Kategorien nach Gewerk', style: 'h3' },
					{ image: chartKatNachGewerk, width: 245 }
				]}
			],
			margin: [0, 0, 0, 16]
		});
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
		{ text: formatCents(gesamtMaterial), alignment: 'right', fontSize: 9, bold: true, color: '#3B82F6', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtArbeitslohn), alignment: 'right', fontSize: 9, bold: true, color: '#F97316', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtSonstiges), alignment: 'right', fontSize: 9, bold: true, color: '#6B7280', fillColor: '#F3F4F6' },
		{ text: formatCents(gesamtIst), alignment: 'right', fontSize: 9, bold: true, fillColor: '#F3F4F6' }
	]);

	content.push({
		table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: katBody },
		layout: TABLE_LAYOUT,
		margin: [0, 0, 0, 0]
	});

	// --- Kosten nach Raum ---
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

	// --- Auftragsstatus ---
	if (rechnungen.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Auftragsstatus', style: 'h2', fontSize: 20 }
		);

		const aufBody: TableCell[][] = [
			[headerZelle('Auftragnehmer'), headerZelle('Gewerk'), headerZelle('Auftrag', 'right'), headerZelle('Bezahlt', 'right'), headerZelle('Offen', 'right'), headerZelle('Status', 'center')]
		];

		let summeAuftrag = 0;
		let summeBezahlt = 0;
		let summeOffen = 0;

		for (const r of rechnungen) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const auftragGesamt = (r.auftragssumme ?? 0) + nachtraege;
			const bezahlt = r.abschlaege.filter((a) => abschlagEffektivStatus(a) === 'bezahlt').reduce((s, a) => s + a.rechnungsbetrag, 0);
			const offen = r.abschlaege.filter((a) => { const st = abschlagEffektivStatus(a); return st === 'offen' || st === 'ueberfaellig'; }).reduce((s, a) => s + a.rechnungsbetrag, 0);
			const hatUeberfaellig = r.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');

			summeAuftrag += auftragGesamt;
			summeBezahlt += bezahlt;
			summeOffen += offen;

			const gewerkName = projekt.gewerke.find((g) => g.id === r.gewerk)?.name ?? r.gewerk;
			const statusText = hatUeberfaellig ? 'Überfällig' : offen > 0 ? 'Offen' : bezahlt > 0 ? 'Bezahlt' : 'Ausstehend';
			const statusFarbe = hatUeberfaellig ? '#EF4444' : offen > 0 ? '#F97316' : '#10B981';

			aufBody.push([
				{ text: r.auftragnehmer, fontSize: 9, bold: true },
				{ text: gewerkName, fontSize: 9 },
				betragZelle(auftragGesamt),
				betragZelle(bezahlt, '#10B981'),
				betragZelle(offen, offen > 0 ? '#F97316' : '#6B7280'),
				{ text: statusText, alignment: 'center', fontSize: 8, bold: true, color: statusFarbe }
			]);
		}

		aufBody.push([
			{ text: 'Gesamt', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
			{ text: '', fillColor: '#F3F4F6' },
			{ text: formatCents(summeAuftrag), alignment: 'right', fontSize: 9, bold: true, fillColor: '#F3F4F6' },
			{ text: formatCents(summeBezahlt), alignment: 'right', fontSize: 9, bold: true, color: '#10B981', fillColor: '#F3F4F6' },
			{ text: formatCents(summeOffen), alignment: 'right', fontSize: 9, bold: true, color: '#F97316', fillColor: '#F3F4F6' },
			{ text: '', fillColor: '#F3F4F6' }
		]);

		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: aufBody },
			layout: TABLE_LAYOUT,
			margin: [0, 0, 0, 0]
		});
	}

	// --- Monatsverlauf ---
	if (monate.length > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Monatsverlauf', style: 'h2', fontSize: 20 }
		);

		if (chartMonat && chartKumuliert) {
			content.push({
				columns: [
					{ width: '*', stack: [
						{ text: 'Ausgaben pro Monat', style: 'h3' },
						{ image: chartMonat, width: 245 }
					]},
					{ width: '*', stack: [
						{ text: 'Kumulierte Gesamtausgaben', style: 'h3' },
						{ image: chartKumuliert, width: 245 }
					]}
				],
				margin: [0, 0, 0, 16]
			});
		}

		const monBody: TableCell[][] = [
			[headerZelle('Monat'), headerZelle('Ausgaben', 'right'), headerZelle('Material', 'right'), headerZelle('Arbeitslohn', 'right'), headerZelle('Sonstiges', 'right'), headerZelle('Kumuliert', 'right')]
		];
		// Neueste zuerst
		const monateAnzeige = [...monate].reverse();
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

	// --- Prognose ---
	if (monate.length > 0 && burnRate > 0) {
		content.push(
			{ text: '', pageBreak: 'after' },
			{ text: 'Prognose', style: 'h2', fontSize: 20 }
		);

		content.push({
			columns: [
				{ width: '*', stack: [
					{ text: 'Burn Rate', style: 'klein' },
					{ text: `${formatCents(burnRate)} / Monat`, fontSize: 14, bold: true, margin: [0, 2, 0, 0] }
				]},
				{ width: '*', stack: [
					{ text: 'Budget-Erschöpfung', style: 'klein' },
					{ text: erschoepfungsDatum ?? 'Im Rahmen', fontSize: 14, bold: true, margin: [0, 2, 0, 0] }
				]},
				{ width: '*', stack: [
					{ text: 'Restbudget', style: 'klein' },
					{ text: formatCents(restBudget), fontSize: 14, bold: true, color: restBudget < 0 ? '#EF4444' : '#10B981', margin: [0, 2, 0, 0] }
				]}
			],
			margin: [0, 0, 0, 16]
		});

		if (chartPrognoseImg) {
			content.push(
				{ text: 'Ausgabenverlauf & Prognose', style: 'h3' },
				{ image: chartPrognoseImg, width: 500, margin: [0, 0, 0, 8] },
				{ text: 'Blau: Ist-Ausgaben | Orange gestrichelt: Prognose | Rot gestrichelt: Gesamtbudget', style: 'klein', margin: [0, 0, 0, 16] }
			);
		}
	}

	// --- Lieferanten ---
	if (lieferantenData.lieferanten.length > 0) {
		content.push(
			{ text: 'Lieferanten-Übersicht', style: 'h2', fontSize: 20 }
		);

		const liefBody: TableCell[][] = [
			[headerZelle('Lieferant'), headerZelle('Lieferungen', 'right'), headerZelle('Gesamtbetrag', 'right'), headerZelle('Gutschriften', 'right')]
		];

		for (const l of lieferantenData.lieferanten) {
			const lieferungen = lieferantenData.lieferungen.filter((li) => li.lieferantId === l.id);
			const positiv = lieferungen.filter((li) => (li.betrag ?? 0) > 0).reduce((s, li) => s + (li.betrag ?? 0), 0);
			const gutschriften = lieferungen.filter((li) => (li.betrag ?? 0) < 0).reduce((s, li) => s + (li.betrag ?? 0), 0);
			const gesamt = positiv + gutschriften;

			if (lieferungen.length === 0) continue;

			liefBody.push([
				{ text: l.name, fontSize: 9, bold: true },
				{ text: String(lieferungen.length), alignment: 'right', fontSize: 9 },
				betragZelle(gesamt),
				gutschriften < 0
					? { text: formatCents(gutschriften), alignment: 'right', fontSize: 9, color: '#EF4444' }
					: { text: '—', alignment: 'right', fontSize: 9, color: '#6B7280' }
			]);
		}

		content.push({
			table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body: liefBody },
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
