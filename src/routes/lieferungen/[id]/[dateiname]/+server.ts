import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leseBelegLieferung, contentType, leseLieferanten } from '$lib/dataStore';
import { stempelePdf } from '$lib/pdfStamp';

export const GET: RequestHandler = async ({ params }) => {
	// Sicherheitscheck: Dateiname muss in der Lieferung registriert sein (verhindert Path Traversal)
	const { lieferungen } = leseLieferanten();
	const lieferung = lieferungen.find((l) => l.id === params.id);
	if (!lieferung || !lieferung.belege.includes(params.dateiname)) {
		throw error(404, 'Beleg nicht gefunden');
	}

	let buffer = leseBelegLieferung(params.id, params.dateiname);
	if (!buffer) throw error(404, 'Beleg nicht gefunden');

	const typ = contentType(params.dateiname);
	if (typ === 'application/pdf' && lieferung.bezahltam) {
		buffer = await stempelePdf(buffer, lieferung.bezahltam);
	}

	const safeName = encodeURIComponent(params.dateiname);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': typ,
			'Content-Disposition': `inline; filename*=UTF-8''${safeName}`
		}
	});
};
