import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_DIR = join(process.cwd());

function git(command: string, timeout = 10000): string {
	try {
		return execSync(`git ${command}`, {
			cwd: PROJECT_DIR,
			encoding: 'utf-8',
			timeout,
			stdio: ['pipe', 'pipe', 'pipe']
		}).trim();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`git ${command} fehlgeschlagen: ${msg}`);
	}
}

function gitVerfuegbar(): boolean {
	try {
		execSync('git --version', { encoding: 'utf-8', timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = () => {
	if (!gitVerfuegbar()) {
		return json({ fehler: 'Git ist nicht installiert' });
	}

	// Prüfe ob Remote 'origin' existiert
	try {
		const remotes = git('remote');
		if (!remotes.split('\n').includes('origin')) {
			return json({ fehler: 'Kein Remote "origin" konfiguriert. Bitte mit "git remote add origin <URL>" einrichten.' });
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ fehler: `Remote-Prüfung fehlgeschlagen: ${msg}` });
	}

	try {
		// Remote aktualisieren
		git('fetch origin master', 15000);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ fehler: `Keine Verbindung zum Update-Server: ${msg}` });
	}

	try {
		const aktuellerCommit = git('rev-parse --short HEAD');
		const neusterCommit = git('rev-parse --short origin/master');
		const updateVerfuegbar = aktuellerCommit !== neusterCommit;

		let commits: { hash: string; datum: string; nachricht: string }[] = [];
		if (updateVerfuegbar) {
			const log = git('log HEAD..origin/master --format=%h§%as§%s');
			if (log) {
				commits = log.split('\n').map((line) => {
					const [hash, datum, ...rest] = line.split('§');
					return { hash, datum, nachricht: rest.join('§') };
				});
			}
		}

		return json({ updateVerfuegbar, aktuellerCommit, neusterCommit, commits });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ fehler: `Git-Fehler: ${msg}` });
	}
};
