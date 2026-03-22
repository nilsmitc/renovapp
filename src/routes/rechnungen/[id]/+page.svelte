<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, centsToInputValue, formatDatum } from '$lib/format';
	import { abschlagEffektivStatus } from '$lib/domain';
	import type { PageData } from './$types';
	import type { Abschlag } from '$lib/domain';

	let { data }: { data: PageData } = $props();

	let zeigeAbschlagFormular = $state(false);
	let abschlagError = $state('');
	let bezahlenAbschlagId = $state<string | null>(null);
	let abschlagEingangsdatum = $state('');
	let abschlagZahlungsziel = $state('');
	let abschlagFaelligkeitsdatum = $state('');

	function berechneFaelligkeitsdatum() {
		const tage = parseInt(abschlagZahlungsziel, 10);
		if (abschlagEingangsdatum && tage > 0) {
			const d = new Date(abschlagEingangsdatum);
			d.setDate(d.getDate() + tage);
			abschlagFaelligkeitsdatum = d.toISOString().slice(0, 10);
		}
	}

	let edierenderAbschlagId = $state<string | null>(null);
	let editAbschlagError = $state('');
	let editEingangsdatum = $state('');
	let editZahlungsziel = $state('');
	let editFaelligkeitsdatum = $state('');

	function oeffneAbschlagBearbeiten(a: Abschlag) {
		edierenderAbschlagId = a.id;
		editAbschlagError = '';
		editEingangsdatum = a.eingangsdatum ?? '';
		editZahlungsziel = a.zahlungsziel ? String(a.zahlungsziel) : '';
		editFaelligkeitsdatum = a.faelligkeitsdatum ?? '';
	}

	function berechneEditFaelligkeitsdatum() {
		const tage = parseInt(editZahlungsziel, 10);
		if (editEingangsdatum && tage > 0) {
			const d = new Date(editEingangsdatum);
			d.setDate(d.getDate() + tage);
			editFaelligkeitsdatum = d.toISOString().slice(0, 10);
		}
	}
	let bezahlenError = $state('');
	let bearbeiten = $state(false);
	let editError = $state('');
	let loeschenError = $state('');
	let zeigeNachtragFormular = $state(false);
	let nachtragError = $state('');

	const rechnung = $derived(data.rechnung);

	const gestelltSumme = $derived(rechnung.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0));

	const bezahltSumme = $derived(
		rechnung.abschlaege.filter((a) => a.status === 'bezahlt').reduce((s, a) => s + a.rechnungsbetrag, 0)
	);

	const offenSumme = $derived(
		rechnung.abschlaege
			.filter((a) => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			})
			.reduce((s, a) => s + a.rechnungsbetrag, 0)
	);

	const ausstehendSumme = $derived(
		rechnung.abschlaege.filter((a) => a.status === 'ausstehend').reduce((s, a) => s + a.rechnungsbetrag, 0)
	);

	const nachtraegeSumme = $derived(rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0));

	const basisFuerFortschritt = $derived(
		rechnung.auftragssumme !== undefined
			? rechnung.auftragssumme + nachtraegeSumme
			: gestelltSumme
	);

	const bezahltPct = $derived(
		basisFuerFortschritt > 0 ? Math.min(100, (bezahltSumme / basisFuerFortschritt) * 100) : 0
	);
	const offenPct = $derived(
		basisFuerFortschritt > 0 ? Math.min(100 - bezahltPct, (offenSumme / basisFuerFortschritt) * 100) : 0
	);

	const restauftragSumme = $derived(
		rechnung.auftragssumme !== undefined
			? Math.max(0, basisFuerFortschritt - gestelltSumme)
			: 0
	);

	const restauftragPct = $derived(
		basisFuerFortschritt > 0 ? Math.min(100 - bezahltPct - offenPct, (restauftragSumme / basisFuerFortschritt) * 100) : 0
	);

	const anzahlOffeneAbschlaege = $derived(
		rechnung.abschlaege.filter(a => {
			const s = abschlagEffektivStatus(a);
			return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
		}).length
	);

	const hatUeberfaelligeAbschlaege = $derived(
		rechnung.abschlaege.some(a => abschlagEffektivStatus(a) === 'ueberfaellig')
	);

	const hatBaldFaelligeAbschlaege = $derived(
		rechnung.abschlaege.some(a => abschlagEffektivStatus(a) === 'bald_faellig')
	);

	// Dringendster offener Abschlag für Callout
	const dringendsterAbschlag = $derived.by(() => {
		const offene = rechnung.abschlaege
			.filter(a => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			})
			.sort((a, b) => (a.faelligkeitsdatum ?? '9999').localeCompare(b.faelligkeitsdatum ?? '9999'));
		return offene[0] ?? null;
	});

	const heute = new Date().toISOString().slice(0, 10);

	function tageVerbleibend(datum: string): number {
		return Math.round((new Date(datum).getTime() - new Date(heute).getTime()) / (1000 * 60 * 60 * 24));
	}

	function statusBadge(a: Abschlag) {
		const s = abschlagEffektivStatus(a);
		if (s === 'bezahlt') return { label: 'Bezahlt', cls: 'bg-green-100 text-green-700' };
		if (s === 'ueberfaellig') return { label: 'Überfällig', cls: 'bg-red-100 text-red-700' };
		if (s === 'bald_faellig') return { label: 'Bald fällig', cls: 'bg-amber-100 text-amber-700' };
		if (s === 'offen') return { label: 'Offen', cls: 'bg-yellow-100 text-yellow-700' };
		return { label: 'Ausstehend', cls: 'bg-gray-100 text-gray-600' };
	}

	function typLabel(typ: string) {
		if (typ === 'schlussrechnung') return 'Schlussrechnung';
		if (typ === 'nachtragsrechnung') return 'Nachtrag';
		return 'Abschlag';
	}

	// Timeline: alle Events chronologisch
	interface TimelineEvent {
		datum: string;
		label: string;
		betrag: number | null;
		detail: string;
		color: string; // tailwind color name
		filled: boolean; // past=filled, future=ring
	}

	const timelineEvents = $derived.by(() => {
		const events: TimelineEvent[] = [];

		// Auftrag erteilt
		if (rechnung.auftragsdatum) {
			events.push({
				datum: rechnung.auftragsdatum,
				label: 'Auftrag erteilt',
				betrag: rechnung.auftragssumme ?? null,
				detail: '',
				color: 'blue',
				filled: rechnung.auftragsdatum <= heute
			});
		}

		// Nachträge
		for (const n of rechnung.nachtraege) {
			const d = n.datum ?? n.erstellt.slice(0, 10);
			events.push({
				datum: d,
				label: `Nachtrag: ${n.beschreibung}`,
				betrag: n.betrag,
				detail: '',
				color: 'orange',
				filled: d <= heute
			});
		}

		// Abschläge
		for (const a of rechnung.abschlaege) {
			const effStatus = abschlagEffektivStatus(a);
			if (effStatus === 'bezahlt' && a.bezahltam) {
				events.push({
					datum: a.bezahltam,
					label: `${typLabel(a.typ)} ${a.nummer} bezahlt`,
					betrag: a.rechnungsbetrag,
					detail: a.rechnungsnummer ? `Rg. ${a.rechnungsnummer}` : '',
					color: 'green',
					filled: true
				});
			} else if (effStatus !== 'ausstehend') {
				const d = a.faelligkeitsdatum ?? a.erstellt.slice(0, 10);
				events.push({
					datum: d,
					label: `${typLabel(a.typ)} ${a.nummer} fällig`,
					betrag: a.rechnungsbetrag,
					detail: a.faelligkeitsdatum ? '' : 'Ohne Fälligkeit',
					color: effStatus === 'ueberfaellig' ? 'red' : effStatus === 'bald_faellig' ? 'amber' : 'yellow',
					filled: d <= heute
				});
			}
		}

		events.sort((a, b) => a.datum.localeCompare(b.datum));
		return events;
	});

	const timelineHeuteIndex = $derived(
		timelineEvents.findIndex(e => e.datum > heute)
	);
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<div class="flex items-center gap-2 text-sm text-gray-500">
		<a href="/rechnungen" class="hover:text-blue-600">Aufträge</a>
		<span>/</span>
		<span class="text-gray-900">{rechnung.auftragnehmer}</span>
	</div>

	<!-- Header -->
	<div class="card">
		{#if bearbeiten}
			<form
				id="rechnung-edit-form"
				method="POST"
				action="?/rechnungBearbeiten"
				enctype="multipart/form-data"
				use:enhance={() => {
					editError = '';
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							editError = (result.data?.editError as string) ?? 'Fehler';
						} else {
							bearbeiten = false;
						}
						await update();
					};
				}}
				class="grid grid-cols-1 gap-4 md:grid-cols-2"
			>
				{#if editError}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{editError}</div>
				{/if}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Auftragnehmer *</label>
					<input type="text" name="auftragnehmer" required value={rechnung.auftragnehmer} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Auftragssumme (€)</label>
					<input
						type="text"
						name="auftragssumme"
						value={rechnung.auftragssumme ? centsToInputValue(rechnung.auftragssumme) : ''}
						placeholder="Optional"
						class="input-base"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Auftragsdatum</label>
					<input type="date" name="auftragsdatum" value={rechnung.auftragsdatum ?? ''} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Notiz</label>
					<input type="text" name="notiz" value={rechnung.notiz ?? ''} class="input-base" />
				</div>
				<div class="md:col-span-2">
					<label class="mb-1 block text-sm font-medium text-gray-700">Angebot (PDF/JPG/PNG)</label>
					{#if rechnung.angebot}
						<div class="mb-2 flex items-center gap-3 text-sm">
							<a href="/rechnungen/{rechnung.id}/angebot/{rechnung.angebot}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">{rechnung.angebot}</a>
							<label class="flex cursor-pointer items-center gap-1.5 text-red-600">
								<input type="checkbox" name="angebotLoeschen" class="rounded" />
								<span>Löschen</span>
							</label>
						</div>
					{/if}
					<input type="file" name="angebot" accept=".pdf,.jpg,.jpeg,.png" class="input-base" />
				</div>
			</form>
			{#if loeschenError}
				<div class="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loeschenError}</div>
			{/if}
			<div class="mt-4 flex items-center gap-3">
				<button type="submit" form="rechnung-edit-form" class="btn-primary">Speichern</button>
				<button type="button" onclick={() => (bearbeiten = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
				<form
					method="POST"
					action="?/rechnungLoeschen"
					class="ml-auto"
					use:enhance={() => {
						loeschenError = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								loeschenError = (result.data?.loeschenError as string) ?? 'Fehler beim Löschen';
							}
							await update();
						};
					}}
				>
					<button
						type="submit"
						onclick={(e) => { if (!confirm(`Auftrag "${rechnung.auftragnehmer}" wirklich löschen? Alle zugehörigen Buchungen werden ebenfalls gelöscht.`)) e.preventDefault(); }}
						class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
					>
						Auftrag löschen
					</button>
				</form>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-3">
						{#if data.gewerk}
							<div class="h-3 w-3 rounded-full flex-shrink-0" style="background-color: {data.gewerk.farbe}"></div>
							<span class="text-sm text-gray-500">{data.gewerk.name}</span>
							<span class="text-gray-300">·</span>
						{/if}
						<span class="text-sm text-gray-500">{rechnung.kategorie}</span>
						{#if rechnung.auftragsdatum}
							<span class="text-gray-300">·</span>
							<span class="text-sm text-gray-500">Auftrag vom {formatDatum(rechnung.auftragsdatum)}</span>
						{/if}
					</div>
					<h1 class="mt-1 text-2xl font-bold text-gray-900">{rechnung.auftragnehmer}</h1>
					{#if rechnung.notiz}
						<p class="mt-1 text-sm text-gray-500">{rechnung.notiz}</p>
					{/if}
					{#if rechnung.angebot}
						<div class="mt-2">
							<a
								href="/rechnungen/{rechnung.id}/angebot/{rechnung.angebot}"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
								</svg>
								Angebot: {rechnung.angebot}
							</a>
						</div>
					{/if}
				</div>
				<button onclick={() => (bearbeiten = true)} class="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
				Bearbeiten
			</button>
		</div>

			<!-- KPI-Karten -->
			<div class="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
				{#if rechnung.auftragssumme}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
							Auftragssumme
						</div>
						<div class="text-xl font-bold font-mono mt-1">{formatCents(rechnung.auftragssumme)}</div>
						{#if nachtraegeSumme > 0}
							<div class="text-xs text-orange-500 mt-1">+{formatCents(nachtraegeSumme)} NT = {formatCents(basisFuerFortschritt)}</div>
						{/if}
					</div>
				{/if}

				<div class="kpi-card animate-in">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
						Gestellt
					</div>
					<div class="text-xl font-bold font-mono mt-1">{formatCents(gestelltSumme)}</div>
					<div class="text-xs text-gray-400 mt-1">{rechnung.abschlaege.length} {rechnung.abschlaege.length === 1 ? 'Abschlag' : 'Abschläge'}</div>
				</div>

				{#if bezahltSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-green-500 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Bezahlt
						</div>
						<div class="text-xl font-bold font-mono mt-1 text-green-600">{formatCents(bezahltSumme)}</div>
						<div class="text-xs text-gray-400 mt-1">{basisFuerFortschritt > 0 ? Math.round(bezahltSumme / basisFuerFortschritt * 100) : 0}% {rechnung.auftragssumme ? 'des Auftrags' : 'der Rechnungen'}</div>
					</div>
				{/if}

				{#if offenSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium {hatUeberfaelligeAbschlaege ? 'text-red-500' : hatBaldFaelligeAbschlaege ? 'text-amber-500' : 'text-yellow-500'} uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Offen
						</div>
						<div class="text-xl font-bold font-mono mt-1 {hatUeberfaelligeAbschlaege ? 'text-red-600' : hatBaldFaelligeAbschlaege ? 'text-amber-600' : 'text-yellow-600'}">{formatCents(offenSumme)}</div>
						<div class="text-xs text-gray-400 mt-1">{anzahlOffeneAbschlaege} {anzahlOffeneAbschlaege === 1 ? 'Abschlag' : 'Abschläge'}</div>
					</div>
				{/if}

				{#if restauftragSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-violet-500 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
							Restauftrag
						</div>
						<div class="text-xl font-bold font-mono mt-1 text-violet-600">{formatCents(restauftragSumme)}</div>
						<div class="text-xs text-gray-400 mt-1">Noch nicht gestellt</div>
					</div>
				{/if}
			</div>

			<!-- Fortschrittsbalken (3 Segmente) -->
			{#if gestelltSumme > 0 || restauftragSumme > 0}
				<div class="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
					<div class="flex h-full">
						{#if bezahltPct > 0}<div class="bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700" style="width: {bezahltPct}%"></div>{/if}
						{#if offenPct > 0}<div class="bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-700" style="width: {offenPct}%"></div>{/if}
						{#if restauftragPct > 0}<div class="bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700" style="width: {restauftragPct}%"></div>{/if}
					</div>
				</div>
				<div class="mt-1.5 flex flex-wrap gap-4 text-xs text-gray-500">
					{#if bezahltSumme > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span>Bezahlt {formatCents(bezahltSumme)}</span>{/if}
					{#if offenSumme > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-orange-400"></span>Offen {formatCents(offenSumme)}</span>{/if}
					{#if restauftragSumme > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-violet-500"></span>Nicht gestellt {formatCents(restauftragSumme)}</span>{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Zahlungs-Callout -->
	{#if dringendsterAbschlag}
		{@const effStatus = abschlagEffektivStatus(dringendsterAbschlag)}
		{@const isUeberfaellig = effStatus === 'ueberfaellig'}
		{@const tage = dringendsterAbschlag.faelligkeitsdatum ? tageVerbleibend(dringendsterAbschlag.faelligkeitsdatum) : null}
		<div class="flex items-center gap-3 rounded-lg px-4 py-3 animate-in {isUeberfaellig ? 'border-l-4 border-red-500 bg-red-50' : 'border-l-4 border-amber-400 bg-amber-50'}">
			{#if isUeberfaellig}
				<svg class="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
			{:else}
				<svg class="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			{/if}
			<div class="flex-1 text-sm {isUeberfaellig ? 'text-red-800' : 'text-amber-800'}">
				<span class="font-semibold">{typLabel(dringendsterAbschlag.typ)} {dringendsterAbschlag.nummer}: {formatCents(dringendsterAbschlag.rechnungsbetrag)}</span>
				{#if tage !== null}
					<span> — </span>
					{#if tage < 0}<span class="font-semibold">{Math.abs(tage)} {Math.abs(tage) === 1 ? 'Tag' : 'Tage'} überfällig</span>
					{:else if tage === 0}<span class="font-semibold">Heute fällig</span>
					{:else}<span>fällig in {tage} {tage === 1 ? 'Tag' : 'Tagen'}</span>{/if}
					{#if dringendsterAbschlag.faelligkeitsdatum}
						<span class="text-xs opacity-70"> ({formatDatum(dringendsterAbschlag.faelligkeitsdatum)})</span>
					{/if}
				{/if}
			</div>
			<button
				onclick={() => { bezahlenAbschlagId = dringendsterAbschlag.id; bezahlenError = ''; }}
				class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {isUeberfaellig ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}"
			>
				Bezahlen
			</button>
		</div>
	{/if}

	<!-- Verknüpfte Lieferungen -->
	{#if data.verknuepfteLieferungen.length > 0}
		<div class="card">
			<h2 class="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
				<svg class="h-4 w-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
				Verknüpfte Lieferungen
				<span class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{data.verknuepfteLieferungen.length}</span>
			</h2>
			<div class="space-y-2">
				{#each data.verknuepfteLieferungen as lu}
					<div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
						<div class="flex flex-wrap items-center gap-3">
							<span class="font-medium text-gray-800">{lu.lieferantName}</span>
							{#if lu.beschreibung}
								<span class="text-gray-500">{lu.beschreibung}</span>
							{/if}
							{#if lu.rechnungsnummer}
								<span class="text-xs text-gray-400">Rg.-Nr. {lu.rechnungsnummer}</span>
							{/if}
							{#if lu.lieferscheinnummer}
								<span class="text-xs text-gray-400">LS-Nr. {lu.lieferscheinnummer}</span>
							{/if}
							{#if lu.datum}
								<span class="text-xs text-gray-400">{formatDatum(lu.datum)}</span>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if lu.betrag}
								<span class="tabular-nums font-medium text-gray-700">{formatCents(lu.betrag)}</span>
							{/if}
							<a href="/lieferanten/{lu.lieferantId}" class="text-xs text-blue-500 hover:underline">Lieferant</a>
						</div>
					</div>
				{/each}
			</div>
			<p class="mt-2 text-xs text-gray-400">Diese Lieferungen sind diesem Auftrag zugeordnet und werden nicht separat in Ausgaben gebucht.</p>
		</div>
	{/if}

	<!-- Nachträge -->
	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h2 class="text-base font-semibold text-gray-800">Nachträge</h2>
				{#if rechnung.nachtraege.length > 0}
					<span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
						{rechnung.nachtraege.length} · +{formatCents(nachtraegeSumme)}
					</span>
				{/if}
			</div>
			<button
				onclick={() => (zeigeNachtragFormular = !zeigeNachtragFormular)}
				class="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Nachtrag erfassen
			</button>
		</div>

		{#if zeigeNachtragFormular}
			<div class="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
				{#if nachtragError}
					<div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{nachtragError}</div>
				{/if}
				<form
					method="POST"
					action="?/nachtragHinzufuegen"
					use:enhance={({ formElement }) => {
						nachtragError = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								nachtragError = (result.data?.nachtragError as string) ?? 'Fehler';
							} else {
								formElement.reset();
								zeigeNachtragFormular = false;
							}
							await update();
						};
					}}
					class="grid grid-cols-1 gap-3 md:grid-cols-2"
				>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="nachtrag-beschreibung">Beschreibung *</label>
						<input type="text" id="nachtrag-beschreibung" name="beschreibung" required placeholder="z.B. Zusätzliche Unterverteilung" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="nachtrag-betrag">Betrag (€) *</label>
						<input type="text" id="nachtrag-betrag" name="betrag" required placeholder="z.B. 2.500,00" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="nachtrag-datum">Datum</label>
						<input type="date" id="nachtrag-datum" name="datum" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="nachtrag-notiz">Notiz</label>
						<input type="text" id="nachtrag-notiz" name="notiz" placeholder="Optional" class="input-base" />
					</div>
					<div class="flex gap-3 md:col-span-2">
						<button type="submit" class="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">Nachtrag hinzufügen</button>
						<button type="button" onclick={() => (zeigeNachtragFormular = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
					</div>
				</form>
			</div>
		{/if}

		{#if rechnung.nachtraege.length === 0 && !zeigeNachtragFormular}
			<p class="py-4 text-center text-sm text-gray-400">Noch keine Nachträge erfasst. Nachträge sind genehmigte Mehraufwände, die den Gesamtauftrag erhöhen.</p>
		{:else if rechnung.nachtraege.length > 0}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead>
						<tr class="thead-row">
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Beschreibung</th>
							<th class="px-3 py-2 text-right text-xs font-medium text-gray-500">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Notiz</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each rechnung.nachtraege as nachtrag (nachtrag.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-3 py-3 text-sm font-medium text-gray-800">{nachtrag.beschreibung}</td>
								<td class="px-3 py-3 text-right text-sm font-semibold tabular-nums text-orange-700">+{formatCents(nachtrag.betrag)}</td>
								<td class="px-3 py-3 text-sm text-gray-500">{nachtrag.datum ? formatDatum(nachtrag.datum) : '—'}</td>
								<td class="px-3 py-3 text-sm text-gray-500">{nachtrag.notiz ?? '—'}</td>
								<td class="px-3 py-3">
									<form method="POST" action="?/nachtragLoeschen" use:enhance>
										<input type="hidden" name="nachtragId" value={nachtrag.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm('Nachtrag löschen?')) e.preventDefault(); }}
											class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
											title="Löschen"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
											</svg>
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Abschläge -->
	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold text-gray-800">Abschläge</h2>
			<button
				onclick={() => (zeigeAbschlagFormular = !zeigeAbschlagFormular)}
				class="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Hinzufügen
			</button>
		</div>

		{#if zeigeAbschlagFormular}
			<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
				{#if abschlagError}
					<div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{abschlagError}</div>
				{/if}
				<form
					method="POST"
					action="?/abschlagHinzufuegen"
					enctype="multipart/form-data"
					use:enhance={({ formElement }) => {
						abschlagError = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								abschlagError = (result.data?.abschlagError as string) ?? 'Fehler';
							} else {
								formElement.reset();
								abschlagEingangsdatum = '';
								abschlagZahlungsziel = '';
								abschlagFaelligkeitsdatum = '';
								zeigeAbschlagFormular = false;
							}
							await update();
						};
					}}
					class="grid grid-cols-1 gap-3 md:grid-cols-2"
				>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Typ *</label>
						<select name="typ" required class="input-base">
							<option value="abschlag">Abschlag</option>
							<option value="schlussrechnung">Schlussrechnung</option>
							<option value="nachtragsrechnung">Nachtrag</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Betrag (€) *</label>
						<input type="text" name="betrag" required placeholder="z.B. 5.000,00" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Rechnungsnummer</label>
						<input type="text" name="rechnungsnummer" placeholder="Optional" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Rechnungseingang</label>
						<input type="date" name="eingangsdatum" bind:value={abschlagEingangsdatum} oninput={berechneFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Zahlungsziel (Tage)</label>
						<input type="number" name="zahlungsziel" min="1" max="365" placeholder="z.B. 14" bind:value={abschlagZahlungsziel} oninput={berechneFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">
							Fällig am
							{#if abschlagEingangsdatum && abschlagZahlungsziel}
								<span class="ml-1 text-xs font-normal text-blue-500">(automatisch berechnet)</span>
							{/if}
						</label>
						<input type="date" name="faelligkeitsdatum" bind:value={abschlagFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Notiz</label>
						<input type="text" name="notiz" placeholder="Optional" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Beleg (PDF/JPG/PNG)</label>
						<input type="file" name="beleg" accept=".pdf,.jpg,.jpeg,.png" class="input-base" />
					</div>
					<div class="flex gap-3 md:col-span-2">
						<button type="submit" class="btn-primary">Abschlag hinzufügen</button>
						<button type="button" onclick={() => (zeigeAbschlagFormular = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
					</div>
				</form>
			</div>
		{/if}

		{#if rechnung.abschlaege.length === 0}
			<p class="py-6 text-center text-sm text-gray-400">Noch keine Abschläge. Füge den ersten Abschlag hinzu.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead>
						<tr class="thead-row">
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Typ</th>
							<th class="px-3 py-2 text-right text-xs font-medium text-gray-500">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Rg.-Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Fällig</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Bezahlt am</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each rechnung.abschlaege as abschlag}
							{@const badge = statusBadge(abschlag)}
							{@const effStatus = abschlagEffektivStatus(abschlag)}
							{@const borderCls = effStatus === 'bezahlt' ? 'border-l-4 border-green-400' : effStatus === 'ueberfaellig' ? 'border-l-4 border-red-500' : effStatus === 'bald_faellig' ? 'border-l-4 border-amber-400' : effStatus === 'offen' ? 'border-l-4 border-yellow-300' : 'border-l-4 border-gray-200'}
							{@const betragCls = effStatus === 'bezahlt' ? 'text-green-700' : effStatus === 'ueberfaellig' ? 'text-red-700' : effStatus === 'bald_faellig' ? 'text-amber-700' : 'text-gray-900'}
							<tr class="hover:bg-gray-50 {borderCls}">
								<td class="px-3 py-3 text-sm text-gray-500">{abschlag.nummer}</td>
								<td class="px-3 py-3 text-sm font-medium text-gray-800">{typLabel(abschlag.typ)}</td>
								<td class="px-3 py-3 text-right text-sm font-semibold tabular-nums {betragCls}">{formatCents(abschlag.rechnungsbetrag)}</td>
								<td class="px-3 py-3 text-sm text-gray-500">{abschlag.rechnungsnummer ?? '—'}</td>
								<td class="px-3 py-3 text-sm {effStatus === 'ueberfaellig' ? 'font-semibold text-red-600' : effStatus === 'bald_faellig' ? 'font-semibold text-amber-600' : 'text-gray-500'}">
									{abschlag.faelligkeitsdatum ? formatDatum(abschlag.faelligkeitsdatum) : '—'}
									{#if abschlag.faelligkeitsdatum}
										{@const tage = tageVerbleibend(abschlag.faelligkeitsdatum)}
										{#if effStatus === 'ueberfaellig'}
											<span class="block text-xs text-red-500 font-semibold">{Math.abs(tage)} {Math.abs(tage) === 1 ? 'Tag' : 'Tage'} überfällig</span>
										{:else if tage === 0 && effStatus !== 'bezahlt'}
											<span class="block text-xs text-red-500 font-semibold">Heute fällig</span>
										{:else if effStatus === 'bald_faellig'}
											<span class="block text-xs text-amber-500 font-semibold">in {tage} {tage === 1 ? 'Tag' : 'Tagen'}</span>
										{:else if effStatus === 'offen' && tage > 0}
											<span class="block text-xs text-gray-400">in {tage} {tage === 1 ? 'Tag' : 'Tagen'}</span>
										{/if}
									{/if}
								</td>
								<td class="px-3 py-3">
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {badge.cls}">{badge.label}</span>
								</td>
								<td class="px-3 py-3 text-sm text-gray-500">
									{#if abschlag.bezahltam}
										<span class="inline-flex items-center gap-1">
											<svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
											{formatDatum(abschlag.bezahltam)}
										</span>
										{#if abschlag.buchungId}
											<a href="/buchungen/{abschlag.buchungId}" class="ml-1 text-xs text-blue-500 hover:underline">Buchung</a>
										{/if}
									{:else}
										—
									{/if}
								</td>
								<td class="px-3 py-3">
									<div class="flex items-center gap-2">
										{#if abschlag.beleg}
											<a
												href="/rechnungen/{rechnung.id}/{abschlag.id}/{abschlag.beleg}"
												target="_blank"
												rel="noopener noreferrer"
												class="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
												title="Beleg: {abschlag.beleg}"
											>
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
												</svg>
											</a>
										{/if}
										<button
											onclick={() => oeffneAbschlagBearbeiten(abschlag)}
											class="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
											title="Bearbeiten"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
											</svg>
										</button>
										{#if effStatus !== 'bezahlt'}
											<button
												onclick={() => {
													bezahlenAbschlagId = abschlag.id;
													bezahlenError = '';
												}}
												class="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
											>
												Bezahlen
											</button>
											<form method="POST" action="?/abschlagLoeschen" use:enhance>
												<input type="hidden" name="abschlagId" value={abschlag.id} />
												<button
													type="submit"
													onclick={(e) => { if (!confirm('Abschlag löschen?')) e.preventDefault(); }}
													class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
													title="Löschen"
												>
													<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
													</svg>
												</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>

							<!-- Bezahlen-Inline-Formular -->
							{#if bezahlenAbschlagId === abschlag.id}
								<tr class="bg-green-50">
									<td colspan="8" class="px-3 py-3">
										{#if bezahlenError}
											<div class="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{bezahlenError}</div>
										{/if}
										<form
											method="POST"
											action="?/bezahlen"
											use:enhance={() => {
												bezahlenError = '';
												return async ({ result, update }) => {
													if (result.type === 'failure') {
														bezahlenError = (result.data?.bezahlenError as string) ?? 'Fehler';
													} else {
														bezahlenAbschlagId = null;
													}
													await update();
												};
											}}
											class="flex flex-wrap items-end gap-3"
										>
											<input type="hidden" name="abschlagId" value={abschlag.id} />
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">Bezahlt am *</label>
												<input type="date" name="bezahltam" required value={heute} class="input-base" />
											</div>
											<div class="flex-1">
												<label class="mb-1 block text-xs font-medium text-gray-700">Buchungs-Beschreibung</label>
												<input
													type="text"
													name="beschreibung"
													placeholder="{rechnung.auftragnehmer} – {typLabel(abschlag.typ)} {abschlag.nummer}"
													class="input-base w-full"
												/>
											</div>
											<div class="flex gap-2">
												<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
													Bezahlt &amp; Buchung erstellen
												</button>
												<button type="button" onclick={() => (bezahlenAbschlagId = null)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
													Abbrechen
												</button>
											</div>
										</form>
									</td>
								</tr>
							{/if}

							<!-- Bearbeiten-Inline-Formular -->
							{#if edierenderAbschlagId === abschlag.id}
								<tr class="bg-blue-50">
									<td colspan="8" class="px-3 py-3">
										{#if editAbschlagError}
											<div class="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{editAbschlagError}</div>
										{/if}
										<form
											method="POST"
											action="?/abschlagBearbeiten"
											use:enhance={() => {
												editAbschlagError = '';
												return async ({ result, update }) => {
													if (result.type === 'failure') {
														editAbschlagError = (result.data?.abschlagEditError as string) ?? 'Fehler';
													} else {
														edierenderAbschlagId = null;
													}
													await update();
												};
											}}
											class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
										>
											<input type="hidden" name="abschlagId" value={abschlag.id} />
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">Rechnungsnummer</label>
												<input type="text" name="rechnungsnummer" value={abschlag.rechnungsnummer ?? ''} placeholder="Optional" class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">Rechnungseingang</label>
												<input type="date" name="eingangsdatum" bind:value={editEingangsdatum} oninput={berechneEditFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">Zahlungsziel (Tage)</label>
												<input type="number" name="zahlungsziel" min="1" max="365" bind:value={editZahlungsziel} oninput={berechneEditFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">
													Fällig am
													{#if editEingangsdatum && editZahlungsziel}
														<span class="ml-1 text-xs font-normal text-blue-500">(auto)</span>
													{/if}
												</label>
												<input type="date" name="faelligkeitsdatum" bind:value={editFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-700">Notiz</label>
												<input type="text" name="notiz" value={abschlag.notiz ?? ''} placeholder="Optional" class="input-base" />
											</div>
											<div class="flex items-end gap-2">
												<button type="submit" class="btn-primary">Speichern</button>
												<button type="button" onclick={() => (edierenderAbschlagId = null)} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
											</div>
										</form>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Timeline / Verlauf -->
	{#if timelineEvents.length > 0}
		<div class="card animate-in">
			<div class="px-4 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span class="text-sm font-semibold text-gray-700">Verlauf</span>
				</div>
			</div>
			<div class="px-4 py-4">
				<div class="relative">
					{#each timelineEvents as event, i}
						{@const dotColor =
							event.color === 'green' ? 'bg-green-500' :
							event.color === 'blue' ? 'bg-blue-500' :
							event.color === 'orange' ? 'bg-orange-500' :
							event.color === 'red' ? 'bg-red-500' :
							event.color === 'amber' ? 'bg-amber-500' :
							'bg-yellow-400'}
						{@const ringColor =
							event.color === 'green' ? 'border-green-500' :
							event.color === 'blue' ? 'border-blue-500' :
							event.color === 'orange' ? 'border-orange-500' :
							event.color === 'red' ? 'border-red-500' :
							event.color === 'amber' ? 'border-amber-500' :
							'border-yellow-400'}

						<!-- Heute-Marker -->
						{#if timelineHeuteIndex === i}
							<div class="flex items-center gap-2 py-1.5 ml-1">
								<div class="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-200"></div>
								<div class="flex-1 h-px bg-blue-300"></div>
								<span class="text-xs font-semibold text-blue-600 px-2">Heute</span>
								<div class="flex-1 h-px bg-blue-300"></div>
							</div>
						{/if}

						<div class="flex gap-3 {i < timelineEvents.length - 1 || (timelineHeuteIndex === -1 && i === timelineEvents.length - 1) ? '' : ''}">
							<!-- Vertikale Linie + Dot -->
							<div class="flex flex-col items-center">
								{#if event.filled}
									<div class="w-3 h-3 rounded-full {dotColor} shrink-0 mt-1"></div>
								{:else}
									<div class="w-3 h-3 rounded-full border-2 {ringColor} bg-white shrink-0 mt-1"></div>
								{/if}
								{#if i < timelineEvents.length - 1 || timelineHeuteIndex === -1}
									<div class="w-px flex-1 bg-gray-200 min-h-4"></div>
								{/if}
							</div>

							<!-- Event Content -->
							<div class="pb-4 min-w-0">
								<div class="flex items-baseline gap-2 flex-wrap">
									<span class="text-xs font-mono text-gray-400 tabular-nums">{formatDatum(event.datum)}</span>
									<span class="text-sm font-medium {event.filled ? 'text-gray-800' : 'text-gray-500'}">{event.label}</span>
								</div>
								<div class="flex items-center gap-2 mt-0.5">
									{#if event.betrag !== null}
										<span class="text-xs font-mono tabular-nums {
											event.color === 'green' ? 'text-green-600' :
											event.color === 'orange' ? 'text-orange-600' :
											event.color === 'red' ? 'text-red-600' :
											'text-gray-500'
										}">
											{event.color === 'orange' ? '+' : ''}{formatCents(event.betrag)}
										</span>
									{/if}
									{#if event.detail}
										<span class="text-xs text-gray-400">{event.detail}</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}

					<!-- Heute-Marker am Ende (wenn alle Events in der Vergangenheit) -->
					{#if timelineHeuteIndex === -1}
						<div class="flex items-center gap-2 py-1.5 ml-1">
							<div class="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-200"></div>
							<div class="flex-1 h-px bg-blue-300"></div>
							<span class="text-xs font-semibold text-blue-600 px-2">Heute</span>
							<div class="flex-1 h-px bg-blue-300"></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
