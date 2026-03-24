import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_DIR = process.cwd();
const GITHUB_REPO = 'nilsmitc/renovapp';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/commits`;

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

function leseVersionJson(): { commit: string; datum: string } | null {
	try {
		const raw = readFileSync(join(PROJECT_DIR, 'version.json'), 'utf-8');
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

// Git-basierter Update-Check (wenn im Git-Repo)
function updateViaGit(): Response {
	try {
		git('fetch origin master', 15000);
	} catch {
		return json({ fehler: 'Keine Verbindung zum Update-Server. Internetverbindung prüfen.' });
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
}

// GitHub-API-basierter Update-Check (Fallback ohne Git-Repo)
async function updateViaGitHubApi(aktuellerCommit: string): Promise<Response> {
	try {
		const res = await fetch(`${GITHUB_API}?sha=master&per_page=20`, {
			headers: { 'Accept': 'application/vnd.github.v3+json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!res.ok) {
			return json({ fehler: `GitHub-API Fehler: ${res.status} ${res.statusText}` });
		}

		const data = await res.json() as { sha: string; commit: { message: string; committer: { date: string } } }[];

		if (!Array.isArray(data) || data.length === 0) {
			return json({ fehler: 'Keine Commits auf GitHub gefunden.' });
		}

		const neusterCommit = data[0].sha.substring(0, 7);
		const updateVerfuegbar = !data.some(c => c.sha.startsWith(aktuellerCommit));

		let commits: { hash: string; datum: string; nachricht: string }[] = [];
		if (updateVerfuegbar) {
			// Alle Commits bis zum aktuellen anzeigen
			for (const c of data) {
				if (c.sha.startsWith(aktuellerCommit)) break;
				commits.push({
					hash: c.sha.substring(0, 7),
					datum: c.commit.committer.date.substring(0, 10),
					nachricht: c.commit.message.split('\n')[0]
				});
			}
		}

		return json({ updateVerfuegbar, aktuellerCommit, neusterCommit, commits });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ fehler: `Keine Verbindung zum Update-Server: ${msg}` });
	}
}

export const GET: RequestHandler = async () => {
	// Variante 1: Git-Repo vorhanden → git fetch
	if (istGitRepo()) {
		try {
			git('remote');
			return updateViaGit();
		} catch {
			// Git-Repo ohne Remote → Fallback auf API
		}
	}

	// Variante 2: Kein Git-Repo → GitHub API mit version.json
	const version = leseVersionJson();
	if (!version) {
		return json({ fehler: 'Keine Versionsinformation gefunden (version.json fehlt).' });
	}

	return updateViaGitHubApi(version.commit);
};
