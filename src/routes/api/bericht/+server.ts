import type { RequestHandler } from './$types';
import { leseProjekt, leseBuchungen, leseRechnungen, leseLieferanten } from '$lib/dataStore';
import { erstelleBauleiterbericht } from '$lib/pdfReport';
import { leseAnalyse } from '$lib/aiAnalyse';

export const GET: RequestHandler = async ({ url }) => {
	const mitAi = url.searchParams.get('ai') === 'true';

	const projekt = leseProjekt();
	const buchungen = leseBuchungen();
	const rechnungen = leseRechnungen();
	const lieferantenData = leseLieferanten();

	const analyseDatei = mitAi ? leseAnalyse() : null;

	let pdfBuffer: Uint8Array;
	try {
		pdfBuffer = await erstelleBauleiterbericht(
			projekt, buchungen, rechnungen, lieferantenData,
			analyseDatei?.analyse ?? null, mitAi
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('PDF-Generierung fehlgeschlagen:', message);
		return new Response(
			JSON.stringify({ error: 'PDF-Generierung fehlgeschlagen', detail: message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const datum = new Date().toISOString().slice(0, 10);
	return new Response(pdfBuffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="bauleiter-bericht-${datum}.pdf"`,
			'Content-Length': pdfBuffer.byteLength.toString()
		}
	});
};
