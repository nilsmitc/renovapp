import type { RequestHandler } from './$types';
import { leseEmailConfig, schreibeEmailConfig } from '$lib/dataStore';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json() as {
		energieberaterEmail?: string;
		thunderbirdBin?: string;
		exportBetreff?: string;
	};

	// Bestehende Config laden (oder leeres Objekt)
	const config = leseEmailConfig() ?? {
		thunderbirdPfad: '',
		profil: '',
		konto: '',
		ordner: ''
	};

	config.energieberaterEmail = body.energieberaterEmail ?? '';
	config.thunderbirdBin = body.thunderbirdBin ?? '';
	config.exportBetreff = body.exportBetreff ?? '';

	schreibeEmailConfig(config);

	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
