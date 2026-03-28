import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BauAnalyse {
	zusammenfassung: string;
	risikobewertung: string;
	cashflowBewertung: string;
	empfehlungen: string[];
	cashflowPrognose?: string;       // Monat-für-Monat Liquiditätsprognose
	szenarioAnalyse?: string;        // Best/Expected/Worst Case Gesamtkosten
	belegeUndFoerderung?: string;    // BAFA-Readiness, KfW, §35a
	auftragsfortschritt?: string;    // Pro Auftrag: % bezahlt, Restbetrag, Status
	dokumentenAnalyse?: string;      // Erkenntnisse aus Angeboten/Rechnungsbelegen
}

export interface BauAnalyseDatei {
	erstellt: string;
	analyse: BauAnalyse;
}

const ANALYSE_PATH = join(process.cwd(), 'data', 'ai-analyse.json');

/** Liest die KI-Analyse aus data/ai-analyse.json (geschrieben von Claude Code) */
export function leseAnalyse(): BauAnalyseDatei | null {
	if (!existsSync(ANALYSE_PATH)) return null;
	try {
		return JSON.parse(readFileSync(ANALYSE_PATH, 'utf-8'));
	} catch {
		return null;
	}
}
