import type { RequestHandler } from './$types';
import { zipSync } from 'fflate';
import { spawn } from 'node:child_process';
import { writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
	leseBeleg,
	leseBelegRechnung,
	leseAngebotRechnung,
	leseBelegLieferung,
	leseEmailConfig,
	leseBelegeExportLog,
	schreibeBelegeExportLog
} from '$lib/dataStore';

const TMP_DIR = '/tmp';

export type ExportBelegRef = {
	typ: 'buchung' | 'abschlag' | 'lieferung' | 'angebot';
	buchungId?: string;
	rechnungId?: string;
	abschlagId?: string;
	lieferungId?: string;
	dateinamen: string[];
	datum: string;
	gewerkName: string;
	beschreibung: string;
};

function slugify(s: string): string {
	return s
		.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
		.replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
		.replace(/[^a-zA-Z0-9]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '')
		.slice(0, 40);
}

function zipDateiname(ref: ExportBelegRef, dateiname: string, idx: number, usedNames: Set<string>): string {
	const ext = dateiname.includes('.') ? '.' + dateiname.split('.').pop()!.toLowerCase() : '';
	const basis = `${ref.datum}_${slugify(ref.gewerkName)}_${slugify(ref.beschreibung)}`;
	let name = idx === 0 ? `${basis}${ext}` : `${basis}_${idx + 1}${ext}`;
	let counter = 2;
	while (usedNames.has(name)) {
		name = `${basis}_${counter++}${ext}`;
	}
	usedNames.add(name);
	return name;
}

function exportKey(ref: ExportBelegRef): string {
	if (ref.typ === 'buchung') return `buchung:${ref.buchungId}`;
	if (ref.typ === 'abschlag') return `abschlag:${ref.rechnungId}:${ref.abschlagId}`;
	if (ref.typ === 'lieferung') return `lieferung:${ref.lieferungId}`;
	return `angebot:${ref.rechnungId}`;
}

function aufraeuemenAlteTempDateien() {
	try {
		const jetzt = Date.now();
		const stunde = 60 * 60 * 1000;
		for (const f of readdirSync(TMP_DIR)) {
			if (!f.startsWith('renovapp-belege-')) continue;
			const pfad = join(TMP_DIR, f);
			try {
				if (jetzt - statSync(pfad).mtimeMs > stunde) unlinkSync(pfad);
			} catch { /* ignorieren */ }
		}
	} catch { /* ignorieren */ }
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json() as { belege: ExportBelegRef[]; mode: 'zip' | 'email' };
	const { belege, mode } = body;

	if (!Array.isArray(belege) || belege.length === 0) {
		return new Response(JSON.stringify({ error: 'Keine Belege ausgewählt' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Dateien sammeln und ZIP-Einträge bauen
	const usedNames = new Set<string>();
	const zipEntries: Record<string, Uint8Array> = {};

	for (const ref of belege) {
		for (let i = 0; i < ref.dateinamen.length; i++) {
			const dateiname = ref.dateinamen[i];
			let buffer: Buffer | null = null;

			if (ref.typ === 'buchung' && ref.buchungId) {
				buffer = leseBeleg(ref.buchungId, dateiname);
			} else if (ref.typ === 'abschlag' && ref.rechnungId && ref.abschlagId) {
				buffer = leseBelegRechnung(ref.rechnungId, ref.abschlagId, dateiname);
			} else if (ref.typ === 'lieferung' && ref.lieferungId) {
				buffer = leseBelegLieferung(ref.lieferungId, dateiname);
			} else if (ref.typ === 'angebot' && ref.rechnungId) {
				buffer = leseAngebotRechnung(ref.rechnungId, dateiname);
			}

			if (!buffer) continue;
			const name = zipDateiname(ref, dateiname, i, usedNames);
			zipEntries[name] = new Uint8Array(buffer);
		}
	}

	if (Object.keys(zipEntries).length === 0) {
		return new Response(JSON.stringify({ error: 'Keine Dateien gefunden' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const zipBuffer = Buffer.from(zipSync(zipEntries));
	const datum = new Date().toISOString().slice(0, 10);
	const config = leseEmailConfig();

	// Export loggen
	const log = leseBelegeExportLog();
	log.exports.push({
		id: randomUUID(),
		datum: new Date().toISOString(),
		empfaenger: config?.energieberaterEmail ?? '',
		anzahl: belege.length,
		eintraege: belege.map(exportKey)
	});
	schreibeBelegeExportLog(log);

	if (mode === 'email') {
		aufraeuemenAlteTempDateien();
		const zipPfad = join(TMP_DIR, `renovapp-belege-${Date.now()}.zip`);
		writeFileSync(zipPfad, zipBuffer);

		const thunderbirdBin = config?.thunderbirdBin?.trim() || 'thunderbird';
		const empfaenger = config?.energieberaterEmail ?? '';
		const betreff = config?.exportBetreff?.trim() || 'BAFA Belege – Altbau';
		const composeStr = `to='${empfaenger}',subject='${betreff}',attachment='file://${zipPfad}'`;

		spawn(thunderbirdBin, ['-compose', composeStr], {
			detached: true,
			stdio: 'ignore'
		}).unref();

		return new Response(JSON.stringify({ ok: true, anzahl: Object.keys(zipEntries).length }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// mode === 'zip': direkt herunterladen
	return new Response(zipBuffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="BAFA-Belege-${datum}.zip"`
		}
	});
};
