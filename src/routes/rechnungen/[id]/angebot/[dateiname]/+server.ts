import type { RequestHandler } from './$types';
import { leseRechnungen, leseAngebotRechnung, contentType } from '$lib/dataStore';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params }) => {
	const rechnungen = leseRechnungen();
	const rechnung = rechnungen.find((r) => r.id === params.id);
	if (!rechnung || rechnung.angebot !== params.dateiname) {
		throw error(404, 'Angebot nicht gefunden');
	}

	const buffer = leseAngebotRechnung(params.id, params.dateiname);
	if (!buffer) throw error(404, 'Angebot nicht gefunden');

	const safeName = encodeURIComponent(params.dateiname);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': contentType(params.dateiname),
			'Content-Disposition': `inline; filename*=UTF-8''${safeName}`
		}
	});
};
