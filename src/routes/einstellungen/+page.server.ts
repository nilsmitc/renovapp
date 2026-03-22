import type { Actions, PageServerLoad } from './$types';
import { unzipSync } from 'fflate';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { schreibeBuchungen, schreibeProjekt, schreibeRechnungen, schreibeLieferanten } from '$lib/dataStore';
import { fail, redirect } from '@sveltejs/kit';

const DATA_DIR = join(process.cwd(), 'data');
const PROJECT_DIR = process.cwd();
const MAX_GROESSE = 200 * 1024 * 1024; // 200 MB

export const load: PageServerLoad = ({ url }) => {
	let version = '?';
	try {
		version = execSync('git rev-parse --short HEAD', { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 5000 }).trim();
	} catch { /* git nicht verfügbar */ }

	return {
		updating: url.searchParams.get('updating') === '1',
		version
	};
};

export const actions: Actions = {
	import: async ({ request }) => {
		const form = await request.formData();
		const datei = form.get('backup') as File;

		if (!datei || datei.size === 0) {
			return fail(400, { error: 'Keine Datei gewählt' });
		}
		if (datei.size > MAX_GROESSE) {
			return fail(400, { error: 'Datei zu groß (max. 200 MB)' });
		}
		if (!datei.name.endsWith('.zip') && datei.type !== 'application/zip') {
			return fail(400, { error: 'Nur ZIP-Dateien erlaubt' });
		}

		let eintraege: ReturnType<typeof unzipSync>;
		try {
			eintraege = unzipSync(new Uint8Array(await datei.arrayBuffer()));
		} catch {
			return fail(400, { error: 'ZIP-Datei konnte nicht gelesen werden (beschädigt?)' });
		}

		// Pflichtdateien prüfen
		if (!eintraege['projekt.json']) {
			return fail(400, { error: 'Ungültiges Backup: projekt.json fehlt' });
		}
		if (!eintraege['buchungen.json']) {
			return fail(400, { error: 'Ungültiges Backup: buchungen.json fehlt' });
		}

		// JSON-Inhalt validieren
		const decoder = new TextDecoder();
		let projektJson: unknown;
		let buchungenJson: unknown;
		try {
			projektJson = JSON.parse(decoder.decode(eintraege['projekt.json']));
			buchungenJson = JSON.parse(decoder.decode(eintraege['buchungen.json']));
		} catch {
			return fail(400, { error: 'Beschädigte Daten in projekt.json oder buchungen.json' });
		}

		if (!projektJson || typeof projektJson !== 'object') {
			return fail(400, { error: 'projekt.json hat ungültiges Format' });
		}
		if (!Array.isArray(buchungenJson)) {
			return fail(400, { error: 'buchungen.json muss ein Array sein' });
		}

		// Alte Beleg-Ordner löschen
		for (const ordner of ['belege', 'rechnungen', 'lieferungen', 'email-scan']) {
			const dir = join(DATA_DIR, ordner);
			if (existsSync(dir)) rmSync(dir, { recursive: true });
		}

		// Belege und Dateien aus ZIP extrahieren
		for (const [pfad, inhalt] of Object.entries(eintraege)) {
			if (!pfad.startsWith('belege/') && !pfad.startsWith('rechnungen/') && !pfad.startsWith('lieferungen/') && !pfad.startsWith('email-scan/')) continue;
			// Pfad-Traversal-Schutz: nur erlaubte Zeichen
			if (/\.\./.test(pfad)) continue;
			if (pfad.startsWith('/')) continue;
			const ziel = join(DATA_DIR, pfad);
			mkdirSync(dirname(ziel), { recursive: true });
			writeFileSync(ziel, inhalt);
		}

		// JSONs schreiben (triggert automatisch aktualisiereSummary())
		schreibeProjekt(projektJson as Parameters<typeof schreibeProjekt>[0]);
		schreibeBuchungen(buchungenJson as Parameters<typeof schreibeBuchungen>[0]);

		// Rechnungen (optional – ältere Backups ohne diese Datei bleiben gültig)
		if (eintraege['rechnungen.json']) {
			try {
				const rechnungenJson = JSON.parse(decoder.decode(eintraege['rechnungen.json']));
				if (Array.isArray(rechnungenJson)) schreibeRechnungen(rechnungenJson);
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		// Lieferanten (optional – ältere Backups ohne diese Datei bleiben gültig)
		if (eintraege['lieferanten.json']) {
			try {
				const lieferantenJson = JSON.parse(decoder.decode(eintraege['lieferanten.json']));
				if (lieferantenJson && typeof lieferantenJson === 'object') {
					schreibeLieferanten(lieferantenJson as Parameters<typeof schreibeLieferanten>[0]);
				}
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		// KI-Analyse (optional)
		if (eintraege['ai-analyse.json']) {
			try {
				const aiJson = JSON.parse(decoder.decode(eintraege['ai-analyse.json']));
				if (aiJson && typeof aiJson === 'object') {
					writeFileSync(join(DATA_DIR, 'ai-analyse.json'), JSON.stringify(aiJson, null, 2));
				}
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		// Dokumente-Texte (optional)
		if (eintraege['dokumente-texte.json']) {
			try {
				const dokTexte = JSON.parse(decoder.decode(eintraege['dokumente-texte.json']));
				if (dokTexte && typeof dokTexte === 'object') {
					writeFileSync(join(DATA_DIR, 'dokumente-texte.json'), JSON.stringify(dokTexte, null, 2));
				}
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		// E-Mail-Scan-Cache (optional)
		if (eintraege['email-scan-cache.json']) {
			try {
				const emailCache = JSON.parse(decoder.decode(eintraege['email-scan-cache.json']));
				if (emailCache && typeof emailCache === 'object') {
					writeFileSync(join(DATA_DIR, 'email-scan-cache.json'), JSON.stringify(emailCache, null, 2));
				}
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		throw redirect(303, '/einstellungen?success=1');
	},

	update: async () => {
		// Git-Verfügbarkeit prüfen
		try {
			execSync('git --version', { encoding: 'utf-8', timeout: 5000 });
		} catch {
			return fail(500, { updateError: 'Git ist nicht installiert' });
		}

		try {
			const opts = { cwd: PROJECT_DIR, encoding: 'utf-8' as const, timeout: 30000 };

			// Lokale Änderungen sichern (z.B. .serena/)
			try { execSync('git stash', opts); } catch { /* nichts zu stashen */ }

			// Update ziehen
			execSync('git pull origin master', opts);

			// Lokale Änderungen wiederherstellen
			try { execSync('git stash pop', opts); } catch { /* Konflikte ignorieren */ }

			// Marker für Neustart schreiben — start.sh erkennt die Datei und startet den Server neu
			writeFileSync(join(PROJECT_DIR, '.restart-after-update'), '', 'utf-8');
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return fail(500, { updateError: `Update fehlgeschlagen: ${msg}` });
		}

		throw redirect(303, '/einstellungen?updating=1');
	}
};
