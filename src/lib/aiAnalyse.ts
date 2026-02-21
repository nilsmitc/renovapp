import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BauAnalyse {
	zusammenfassung: string;
	risikobewertung: string;
	cashflowBewertung: string;
	empfehlungen: string[];
}

/** Prüft ob die Claude CLI verfügbar ist */
export async function isClaudeVerfuegbar(): Promise<boolean> {
	try {
		await execFileAsync('which', ['claude']);
		return true;
	} catch {
		return false;
	}
}

/** Ruft Claude CLI als Subprozess auf und analysiert die Baudaten */
export async function analysiereBaudaten(datenText: string): Promise<BauAnalyse | null> {
	if (!(await isClaudeVerfuegbar())) return null;

	const prompt = `Du bist ein erfahrener Bauleiter und Baukostenberater. Analysiere die folgenden Finanzdaten einer Altbau-Renovierung.

Antworte EXAKT in diesem Format mit diesen Markdown-Überschriften:

## Zusammenfassung
(3-5 Sätze zum aktuellen Projektstatus mit konkreten Zahlen)

## Risikobewertung
(Welche Gewerke sind kritisch? Wo drohen Budgetüberschreitungen? Nenne konkrete Zahlen und Prozente.)

## Cashflow-Bewertung
(Wie steht es um offene Rechnungen und gebundene Mittel? Wie ist der Zahlungsfluss?)

## Empfehlungen
- (Empfehlung 1)
- (Empfehlung 2)
- (Empfehlung 3)
- (weitere falls nötig)

Antworte auf Deutsch. Sei konkret, nenne Zahlen und Eurobeträge. Keine Einleitung, keine Verabschiedung — nur die vier Abschnitte.

---

${datenText}`;

	try {
		const { stdout } = await execFileAsync(
			'claude',
			['-p', prompt, '--model', 'sonnet', '--tools', '', '--output-format', 'text', '--no-session-persistence'],
			{ timeout: 60_000, maxBuffer: 1024 * 1024, env: { ...process.env, HOME: process.env.HOME } }
		);

		return parseAnalyse(stdout);
	} catch (error) {
		console.error('Claude AI-Analyse fehlgeschlagen:', error instanceof Error ? error.message : error);
		return null;
	}
}

/** Parst die Claude-Antwort anhand der Markdown-Überschriften */
function parseAnalyse(text: string): BauAnalyse {
	const abschnitt = (header: string): string => {
		const regex = new RegExp(`## ${header}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
		const match = text.match(regex);
		return match?.[1]?.trim() ?? '';
	};

	const empfehlungenText = abschnitt('Empfehlungen');
	const empfehlungen = empfehlungenText
		.split('\n')
		.map((line) => line.replace(/^[-*]\s*/, '').trim())
		.filter((line) => line.length > 0);

	return {
		zusammenfassung: abschnitt('Zusammenfassung'),
		risikobewertung: abschnitt('Risikobewertung'),
		cashflowBewertung: abschnitt('Cashflow-Bewertung') || abschnitt('Cashflow'),
		empfehlungen: empfehlungen.length > 0 ? empfehlungen : ['Keine Empfehlungen verfügbar.']
	};
}
