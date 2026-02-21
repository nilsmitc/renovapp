import type { RequestHandler } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';
import { erstelleBauleiterbericht } from '$lib/pdfReport';
import { analysiereBaudaten } from '$lib/aiAnalyse';
import { berechneGewerkSummaries, abschlagEffektivStatus } from '$lib/domain';
import { formatCents } from '$lib/format';

export const GET: RequestHandler = async ({ url }) => {
	const mitAi = url.searchParams.get('ai') === 'true';

	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();
	const lieferantenData = leseLieferanten();

	let aiAnalyse = null;
	if (mitAi) {
		// Daten für Claude aufbereiten
		const datenText = buildDatenText(projekt, buchungen, rechnungen, lieferantenData);
		aiAnalyse = await analysiereBaudaten(datenText);
	}

	const pdfBuffer = await erstelleBauleiterbericht(
		projekt, buchungen, rechnungen, lieferantenData, aiAnalyse
	);

	const datum = new Date().toISOString().slice(0, 10);
	return new Response(pdfBuffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="bauleiter-bericht-${datum}.pdf"`,
			'Content-Length': pdfBuffer.byteLength.toString()
		}
	});
};

function buildDatenText(
	projekt: ReturnType<typeof leseProjekt>,
	buchungen: ReturnType<typeof leseBuchungen>,
	rechnungen: ReturnType<typeof leseRechnungen>,
	lieferantenData: ReturnType<typeof leseLieferanten>
): string {
	const gewerkSummaries = berechneGewerkSummaries(buchungen, projekt.gewerke, projekt.budgets);
	const gesamtIst = buchungen.reduce((s, b) => s + b.betrag, 0);
	const gesamtBudget = projekt.budgets.reduce((s, b) => s + b.geplant, 0);

	const lines: string[] = [];
	lines.push('=== PROJEKTÜBERSICHT ===');
	lines.push(`Gesamtbudget: ${formatCents(gesamtBudget)}`);
	lines.push(`Bisherige Ausgaben: ${formatCents(gesamtIst)}`);
	lines.push(`Verbleibend: ${formatCents(gesamtBudget - gesamtIst)}`);
	lines.push(`Verbraucht: ${gesamtBudget > 0 ? Math.round((gesamtIst / gesamtBudget) * 100) : 0}%`);
	lines.push(`Anzahl Buchungen: ${buchungen.length}`);
	lines.push('');

	lines.push('=== BUDGET NACH GEWERK ===');
	for (const s of gewerkSummaries) {
		const p = s.budget > 0 ? Math.round((s.ist / s.budget) * 100) : 0;
		lines.push(`${s.gewerk.name}: Budget ${formatCents(s.budget)}, Ausgaben ${formatCents(s.ist)}, Differenz ${formatCents(s.differenz)} (${p}%)${s.gewerk.pauschal ? ' [Sammelgewerk]' : ''}`);
	}
	lines.push('');

	if (rechnungen.length > 0) {
		lines.push('=== AUFTRÄGE / RECHNUNGEN ===');
		let gebundenGesamt = 0;
		for (const r of rechnungen) {
			const nachtraege = r.nachtraege.reduce((s, n) => s + n.betrag, 0);
			const auftragGesamt = (r.auftragssumme ?? 0) + nachtraege;
			const bezahlt = r.abschlaege.filter((a) => abschlagEffektivStatus(a) === 'bezahlt').reduce((s, a) => s + a.rechnungsbetrag, 0);
			const offen = r.abschlaege.filter((a) => { const st = abschlagEffektivStatus(a); return st === 'offen' || st === 'ueberfaellig'; }).reduce((s, a) => s + a.rechnungsbetrag, 0);
			const hatUeberfaellig = r.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');
			gebundenGesamt += offen;

			lines.push(`${r.auftragnehmer} (${projekt.gewerke.find((g) => g.id === r.gewerk)?.name ?? r.gewerk}): Auftrag ${formatCents(auftragGesamt)}, Bezahlt ${formatCents(bezahlt)}, Offen ${formatCents(offen)}${hatUeberfaellig ? ' [ÜBERFÄLLIG]' : ''}`);
		}
		lines.push(`Gesamt gebundene Mittel (offene Rechnungen): ${formatCents(gebundenGesamt)}`);
		lines.push('');
	}

	// Monatliche Entwicklung
	const monatsMap = new Map<string, number>();
	for (const b of buchungen) {
		const monat = b.datum.slice(0, 7);
		monatsMap.set(monat, (monatsMap.get(monat) ?? 0) + b.betrag);
	}
	const sortedMonate = [...monatsMap.entries()].sort(([a], [b]) => a.localeCompare(b));
	if (sortedMonate.length > 0) {
		lines.push('=== MONATLICHE AUSGABEN ===');
		for (const [monat, betrag] of sortedMonate) {
			lines.push(`${monat}: ${formatCents(betrag)}`);
		}
		const burnRate = Math.round(gesamtIst / sortedMonate.length);
		lines.push(`Durchschnittliche Burn Rate: ${formatCents(burnRate)} / Monat`);
		lines.push('');
	}

	if (lieferantenData.lieferanten.length > 0) {
		lines.push('=== LIEFERANTEN ===');
		for (const l of lieferantenData.lieferanten) {
			const lieferungen = lieferantenData.lieferungen.filter((li) => li.lieferantId === l.id);
			const gesamt = lieferungen.reduce((s, li) => s + (li.betrag ?? 0), 0);
			if (lieferungen.length > 0) {
				lines.push(`${l.name}: ${lieferungen.length} Lieferungen, ${formatCents(gesamt)}`);
			}
		}
	}

	return lines.join('\n');
}
