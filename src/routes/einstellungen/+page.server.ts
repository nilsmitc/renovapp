import type { Actions, PageServerLoad } from './$types';
import { unzipSync } from 'fflate';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { schreibeBuchungen, schreibeProjekt, schreibeRechnungen, schreibeLieferanten, leseEmailConfig } from '$lib/dataStore';
import { fail, redirect } from '@sveltejs/kit';

const DATA_DIR = join(process.cwd(), 'data');
const PROJECT_DIR = process.cwd();
const MAX_GROESSE = 200 * 1024 * 1024; // 200 MB
const GITHUB_REPO = 'nilsmitc/renovapp';
const GITHUB_ZIP = `https://github.com/${GITHUB_REPO}/archive/refs/heads/master.zip`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/commits`;

// Ordner/Dateien, die beim ZIP-Update NICHT überschrieben werden
const UPDATE_SCHUTZ = ['data', 'node_modules', '.serena', '.git', '.env'];

function istGitRepo(): boolean {
	try {
		execSync('git rev-parse --git-dir', {
			cwd: PROJECT_DIR,
			encoding: 'utf-8',
			timeout: 5000,
			stdio: ['pipe', 'pipe', 'pipe']
		});
		return true;
	} catch {
		return false;
	}
}

function leseVersion(): string {
	// Erst Git, dann version.json
	if (istGitRepo()) {
		try {
			return execSync('git rev-parse --short HEAD', {
				cwd: PROJECT_DIR,
				encoding: 'utf-8',
				timeout: 5000
			}).trim();
		} catch { /* Fallback */ }
	}
	try {
		const v = JSON.parse(readFileSync(join(PROJECT_DIR, 'version.json'), 'utf-8'));
		return v.commit ?? '?';
	} catch {
		return '?';
	}
}

function leseChangelog(): string {
	try {
		return readFileSync(join(PROJECT_DIR, 'CHANGELOG.md'), 'utf-8');
	} catch {
		return '';
	}
}

export const load: PageServerLoad = ({ url }) => {
	const config = leseEmailConfig();
	return {
		updating: url.searchParams.get('updating') === '1',
		version: leseVersion(),
		changelog: leseChangelog(),
		exportConfig: config ? {
			energieberaterEmail: config.energieberaterEmail ?? '',
			thunderbirdBin: config.thunderbirdBin ?? '',
			exportBetreff: config.exportBetreff ?? ''
		} : null
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
			// Pfad-Traversal-Schutz
			if (/\.\./.test(pfad) || pfad.startsWith('/')) continue;
			const ziel = resolve(DATA_DIR, pfad);
			if (!ziel.startsWith(DATA_DIR + '/')) continue;
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

		// E-Mail-Config (optional)
		if (eintraege['email-config.json']) {
			try {
				const emailConfig = JSON.parse(decoder.decode(eintraege['email-config.json']));
				if (emailConfig && typeof emailConfig === 'object') {
					writeFileSync(join(DATA_DIR, 'email-config.json'), JSON.stringify(emailConfig, null, 2));
				}
			} catch { /* beschädigter Eintrag – ignorieren */ }
		}

		throw redirect(303, '/einstellungen?success=1');
	},

	update: async () => {
		// Variante 1: Git-Repo → git pull
		if (istGitRepo()) {
			try {
				const opts = { cwd: PROJECT_DIR, encoding: 'utf-8' as const, timeout: 30000 };

				try { execSync('git stash', opts); } catch { /* nichts zu stashen */ }
				execSync('git pull origin master', opts);
				try { execSync('git stash pop', opts); } catch { /* Konflikte ignorieren */ }

				writeFileSync(join(PROJECT_DIR, '.restart-after-update'), '', 'utf-8');
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return fail(500, { updateError: `Update fehlgeschlagen: ${msg}` });
			}

			throw redirect(303, '/einstellungen?updating=1');
		}

		// Variante 2: Kein Git-Repo → ZIP von GitHub herunterladen
		try {
			const res = await fetch(GITHUB_ZIP, {
				signal: AbortSignal.timeout(60000),
				redirect: 'follow'
			});

			if (!res.ok) {
				return fail(500, { updateError: `Download fehlgeschlagen: ${res.status} ${res.statusText}` });
			}

			const zipData = new Uint8Array(await res.arrayBuffer());
			const eintraege = unzipSync(zipData);

			// GitHub-ZIP hat einen Wrapper-Ordner: "renovapp-master/"
			// Finde den Prefix
			const ersteDatei = Object.keys(eintraege)[0] ?? '';
			const prefix = ersteDatei.includes('/') ? ersteDatei.split('/')[0] + '/' : '';

			for (const [zipPfad, inhalt] of Object.entries(eintraege)) {
				// Wrapper-Ordner entfernen
				const pfad = prefix ? zipPfad.slice(prefix.length) : zipPfad;
				if (!pfad || pfad.endsWith('/')) continue;

				// Geschützte Ordner nicht überschreiben
				const topLevel = pfad.split('/')[0];
				if (UPDATE_SCHUTZ.includes(topLevel)) continue;

				// Pfad-Traversal-Schutz
				if (/\.\./.test(pfad) || pfad.startsWith('/')) continue;
				const ziel = resolve(PROJECT_DIR, pfad);
				if (!ziel.startsWith(PROJECT_DIR + '/')) continue;
				mkdirSync(dirname(ziel), { recursive: true });
				writeFileSync(ziel, inhalt);

			}

			// version.json mit dem tatsächlichen neuesten Commit aktualisieren
			// (Die version.json im ZIP ist immer einen Commit hinter HEAD)
			try {
				const apiRes = await fetch(`${GITHUB_API}?sha=master&per_page=1`, {
					headers: { 'Accept': 'application/vnd.github.v3+json' },
					signal: AbortSignal.timeout(10000)
				});
				if (apiRes.ok) {
					const commits = await apiRes.json() as { sha: string; commit: { committer: { date: string } } }[];
					if (Array.isArray(commits) && commits.length > 0) {
						const versionData = {
							commit: commits[0].sha.substring(0, 7),
							datum: commits[0].commit.committer.date.substring(0, 10)
						};
						writeFileSync(join(PROJECT_DIR, 'version.json'), JSON.stringify(versionData, null, '\t') + '\n');
					}
				}
			} catch { /* Nicht kritisch — version.json aus ZIP reicht als Fallback */ }

			// Neustart auslösen
			writeFileSync(join(PROJECT_DIR, '.restart-after-update'), '', 'utf-8');
		} catch (err) {
			if (err instanceof Response) throw err; // redirect durchlassen
			const msg = err instanceof Error ? err.message : String(err);
			return fail(500, { updateError: `Update fehlgeschlagen: ${msg}` });
		}

		throw redirect(303, '/einstellungen?updating=1');
	}
};
