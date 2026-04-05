import type { RequestHandler } from './$types';
import { leseRechnungen, leseBelegNachtrag, contentType } from '$lib/dataStore';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params }) => {
	const rechnungen = leseRechnungen();
	const rechnung = rechnungen.find((r) => r.id === params.id);
	const nachtrag = rechnung?.nachtraege.find((n) => n.id === params.nachtragId);
	if (!nachtrag || nachtrag.beleg !== params.dateiname) {
		throw error(404, 'Beleg nicht gefunden');
	}

	const buffer = leseBelegNachtrag(params.id, params.nachtragId, params.dateiname);
	if (!buffer) throw error(404, 'Beleg nicht gefunden');

	const safeName = encodeURIComponent(params.dateiname);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': contentType(params.dateiname),
			'Content-Disposition': `inline; filename*=UTF-8''${safeName}`
		}
	});
};
