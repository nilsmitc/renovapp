import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leseBeleg, contentType, leseBuchungen } from '$lib/dataStore';
import { stempelePdf } from '$lib/pdfStamp';

export const GET: RequestHandler = async ({ params }) => {
	// Sicherheitscheck: Dateiname muss in der Buchung registriert sein (verhindert Path Traversal)
	const buchungen = leseBuchungen();
	const buchung = buchungen.find((b) => b.id === params.buchungId);
	if (!buchung || !buchung.belege.includes(params.dateiname)) {
		throw error(404, 'Beleg nicht gefunden');
	}

	let buffer = leseBeleg(params.buchungId, params.dateiname);
	if (!buffer) throw error(404, 'Beleg nicht gefunden');

	const typ = contentType(params.dateiname);
	if (typ === 'application/pdf' && buchung.bezahltam) {
		buffer = await stempelePdf(buffer, buchung.bezahltam);
	}

	const safeName = encodeURIComponent(params.dateiname);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': typ,
			'Content-Disposition': `inline; filename*=UTF-8''${safeName}`
		}
	});
};
