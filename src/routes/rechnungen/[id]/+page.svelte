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
	let nachtragBelegUploadId = $state<string | null>(null);
	let zuAuftragFehler = $state('');

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
		if (s === 'bezahlt') return { label: 'Bezahlt', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
		if (s === 'ueberfaellig') return { label: 'Überfällig', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
		if (s === 'bald_faellig') return { label: 'Bald fällig', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
		if (s === 'offen') return { label: 'Offen', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
		return { label: 'Ausstehend', cls: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400' };
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
	<div class="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
		{#if rechnung.status === 'angebot'}
			<a href="/rechnungen?ansicht=angebote" class="hover:text-primary-600 dark:hover:text-primary-400">Angebote</a>
		{:else}
			<a href="/rechnungen" class="hover:text-primary-600 dark:hover:text-primary-400">Aufträge</a>
		{/if}
		<span>/</span>
		<span class="text-stone-900 dark:text-stone-100">{rechnung.auftragnehmer}</span>
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
					<div class="alert-danger md:col-span-2">{editError}</div>
				{/if}
				<div>
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Auftragnehmer *</label>
					<input type="text" name="auftragnehmer" required value={rechnung.auftragnehmer} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Auftragssumme (€)</label>
					<input
						type="text"
						name="auftragssumme"
						value={rechnung.auftragssumme ? centsToInputValue(rechnung.auftragssumme) : ''}
						placeholder="Optional"
						class="input-base"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Auftragsdatum</label>
					<input type="date" name="auftragsdatum" value={rechnung.auftragsdatum ?? ''} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Notiz</label>
					<input type="text" name="notiz" value={rechnung.notiz ?? ''} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Status</label>
					<select name="status" class="input-base" value={rechnung.status}>
						<option value="angebot">Angebot (noch nicht beauftragt)</option>
						<option value="auftrag">Auftrag (beauftragt)</option>
					</select>
				</div>
				<div class="md:col-span-2">
					<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">{rechnung.status === 'angebot' ? 'Angebots-Dokument' : 'Angebot'} (PDF/JPG/PNG)</label>
					{#if rechnung.angebot}
						<div class="mb-2 flex items-center gap-3">
							<a href="/rechnungen/{rechnung.id}/angebot/{rechnung.angebot}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300 dark:hover:bg-stone-700">
								<svg class="h-4 w-4 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
								{rechnung.angebot}
							</a>
							<label class="flex cursor-pointer items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
								<input type="checkbox" name="angebotLoeschen" class="rounded" />
								<span>Löschen</span>
							</label>
						</div>
					{/if}
					<input type="file" name="angebot" accept=".pdf,.jpg,.jpeg,.png" class="input-base" />
				</div>
			</form>
			{#if loeschenError}
				<div class="alert-danger mt-2">{loeschenError}</div>
			{/if}
			<div class="mt-4 flex items-center gap-3">
				<button type="submit" form="rechnung-edit-form" class="btn-primary">Speichern</button>
				<button type="button" onclick={() => (bearbeiten = false)} class="btn-secondary">Abbrechen</button>
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
						onclick={(e) => { if (!confirm(`${rechnung.status === 'angebot' ? 'Angebot' : 'Auftrag'} "${rechnung.auftragnehmer}" wirklich löschen? Alle zugehörigen Buchungen werden ebenfalls gelöscht.`)) e.preventDefault(); }}
						class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-stone-900 dark:text-red-400 dark:hover:bg-red-950/40"
					>
						{rechnung.status === 'angebot' ? 'Angebot löschen' : 'Auftrag löschen'}
					</button>
				</form>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-3 flex-wrap">
						{#if data.gewerk}
							<div class="h-3 w-3 rounded-full flex-shrink-0 color-dot" style="background-color: {data.gewerk.farbe}"></div>
							<span class="text-sm text-stone-500 dark:text-stone-400">{data.gewerk.name}</span>
							<span class="text-stone-300 dark:text-stone-600">·</span>
						{/if}
						<span class="text-sm text-stone-500 dark:text-stone-400">{rechnung.kategorie}</span>
						{#if rechnung.auftragsdatum}
							<span class="text-stone-300 dark:text-stone-600">·</span>
							<span class="text-sm text-stone-500 dark:text-stone-400">{rechnung.status === 'angebot' ? 'Angebot vom' : 'Auftrag vom'} {formatDatum(rechnung.auftragsdatum)}</span>
						{/if}
						{#if rechnung.status === 'angebot'}
							<span class="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700 uppercase tracking-wide dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300">Angebot</span>
						{/if}
					</div>
					<h1 class="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">{rechnung.auftragnehmer}</h1>
					{#if rechnung.notiz}
						<p class="mt-1 text-sm text-stone-500 dark:text-stone-400">{rechnung.notiz}</p>
					{/if}
					{#if rechnung.angebot || rechnung.abschlaege.some(a => a.beleg)}
						<div class="mt-3 flex flex-wrap gap-2">
							{#if rechnung.angebot}
								<a
									href="/rechnungen/{rechnung.id}/angebot/{rechnung.angebot}"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 hover:bg-stone-100 transition group dark:border-stone-700 dark:bg-stone-800/50 dark:hover:bg-stone-700"
								>
									<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
										<svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
										</svg>
									</div>
									<div class="min-w-0">
										<div class="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">{rechnung.status === 'angebot' ? 'Angebots-Dokument' : 'Angebot'}</div>
										<div class="truncate text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 max-w-[240px]">{rechnung.angebot}</div>
									</div>
									<svg class="ml-1 h-4 w-4 flex-shrink-0 text-stone-300 dark:text-stone-600 group-hover:text-primary-400 dark:group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
									</svg>
								</a>
							{/if}
							{#each rechnung.abschlaege.filter(a => a.beleg) as a}
								<a
									href="/rechnungen/{rechnung.id}/{a.id}/{a.beleg}"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 hover:bg-stone-100 transition group dark:border-stone-700 dark:bg-stone-800/50 dark:hover:bg-stone-700"
								>
									<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
										<svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
										</svg>
									</div>
									<div class="min-w-0">
										<div class="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">{typLabel(a.typ)} #{a.nummer}</div>
										<div class="truncate text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 max-w-[240px]">{a.beleg}</div>
									</div>
									<svg class="ml-1 h-4 w-4 flex-shrink-0 text-stone-300 dark:text-stone-600 group-hover:text-primary-400 dark:group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
									</svg>
								</a>
							{/each}
						</div>
					{/if}
				</div>
				<button onclick={() => (bearbeiten = true)} class="flex-shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700">
				Bearbeiten
			</button>
		</div>

		<!-- Banner: Als Auftrag annehmen -->
		{#if rechnung.status === 'angebot'}
			<div class="alert-warning mt-4 flex items-center justify-between gap-4 flex-wrap">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
					</svg>
					<div>
						<p class="text-sm font-medium text-amber-800 dark:text-amber-200">Dieses Angebot wurde noch nicht beauftragt.</p>
						<p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Abschläge und Zahlungen können erst nach Auftragsannahme erfasst werden.</p>
					</div>
				</div>
				<form
					method="POST"
					action="?/zuAuftragMachen"
					use:enhance={() => {
						zuAuftragFehler = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								zuAuftragFehler = (result.data?.error as string) ?? 'Fehler';
							}
							await update();
						};
					}}
				>
					<button
						type="submit"
						class="whitespace-nowrap rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
					>
						Als Auftrag annehmen →
					</button>
				</form>
			</div>
			{#if zuAuftragFehler}
				<p class="mt-2 text-sm text-red-600">{zuAuftragFehler}</p>
			{/if}
		{/if}

			<!-- KPI-Karten -->
			<div class="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
				{#if rechnung.auftragssumme}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
							Auftragssumme
						</div>
						<div class="text-xl font-bold font-mono mt-1">{formatCents(rechnung.auftragssumme)}</div>
						{#if nachtraegeSumme > 0}
							<div class="text-xs text-orange-500 dark:text-orange-400 mt-1">+{formatCents(nachtraegeSumme)} NT = {formatCents(basisFuerFortschritt)}</div>
						{/if}
					</div>
				{/if}

				<div class="kpi-card animate-in">
					<div class="flex items-center gap-1.5 text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
						Gestellt
					</div>
					<div class="text-xl font-bold font-mono mt-1">{formatCents(gestelltSumme)}</div>
					<div class="text-xs text-stone-400 dark:text-stone-500 mt-1">{rechnung.abschlaege.length} {rechnung.abschlaege.length === 1 ? 'Abschlag' : 'Abschläge'}</div>
				</div>

				{#if bezahltSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-green-500 dark:text-green-400 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Bezahlt
						</div>
						<div class="text-xl font-bold font-mono mt-1 text-green-600 dark:text-green-400">{formatCents(bezahltSumme)}</div>
						<div class="text-xs text-stone-400 dark:text-stone-500 mt-1">{basisFuerFortschritt > 0 ? Math.round(bezahltSumme / basisFuerFortschritt * 100) : 0}% {rechnung.auftragssumme ? 'des Auftrags' : 'der Rechnungen'}</div>
					</div>
				{/if}

				{#if offenSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium {hatUeberfaelligeAbschlaege ? 'text-red-500 dark:text-red-400' : hatBaldFaelligeAbschlaege ? 'text-amber-500 dark:text-amber-400' : 'text-yellow-500 dark:text-yellow-400'} uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
							Offen
						</div>
						<div class="text-xl font-bold font-mono mt-1 {hatUeberfaelligeAbschlaege ? 'text-red-600 dark:text-red-400' : hatBaldFaelligeAbschlaege ? 'text-amber-600 dark:text-amber-400' : 'text-yellow-600 dark:text-yellow-400'}">{formatCents(offenSumme)}</div>
						<div class="text-xs text-stone-400 dark:text-stone-500 mt-1">{anzahlOffeneAbschlaege} {anzahlOffeneAbschlaege === 1 ? 'Abschlag' : 'Abschläge'}</div>
					</div>
				{/if}

				{#if restauftragSumme > 0}
					<div class="kpi-card animate-in">
						<div class="flex items-center gap-1.5 text-xs font-medium text-violet-500 dark:text-violet-400 uppercase tracking-wide">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
							Restauftrag
						</div>
						<div class="text-xl font-bold font-mono mt-1 text-violet-600 dark:text-violet-400">{formatCents(restauftragSumme)}</div>
						<div class="text-xs text-stone-400 dark:text-stone-500 mt-1">Noch nicht gestellt</div>
					</div>
				{/if}
			</div>

			<!-- Fortschrittsbalken (3 Segmente) -->
			{#if gestelltSumme > 0 || restauftragSumme > 0}
				<div class="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
					<div class="flex h-full">
						{#if bezahltPct > 0}<div class="bg-gradient-to-r from-(--app-paid) to-(--app-paid-light) transition-all duration-700" style="width: {bezahltPct}%"></div>{/if}
						{#if offenPct > 0}<div class="bg-gradient-to-r from-(--app-open) to-(--app-open-light) transition-all duration-700" style="width: {offenPct}%"></div>{/if}
						{#if restauftragPct > 0}<div class="bg-gradient-to-r from-(--app-rest) to-(--app-rest-light) transition-all duration-700" style="width: {restauftragPct}%"></div>{/if}
					</div>
				</div>
				<div class="mt-1.5 flex flex-wrap gap-4 text-xs text-stone-500 dark:text-stone-400">
					{#if bezahltSumme > 0}<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-(--app-paid)"></span>Bezahlt {formatCents(bezahltSumme)}</span>{/if}
					{#if offenSumme > 0}<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-(--app-open)"></span>Offen {formatCents(offenSumme)}</span>{/if}
					{#if restauftragSumme > 0}<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-(--app-rest)"></span>Nicht gestellt {formatCents(restauftragSumme)}</span>{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Zahlungs-Callout -->
	{#if dringendsterAbschlag}
		{@const effStatus = abschlagEffektivStatus(dringendsterAbschlag)}
		{@const isUeberfaellig = effStatus === 'ueberfaellig'}
		{@const tage = dringendsterAbschlag.faelligkeitsdatum ? tageVerbleibend(dringendsterAbschlag.faelligkeitsdatum) : null}
		<div class="flex items-center gap-3 rounded-lg px-4 py-3 animate-in {isUeberfaellig ? 'border-l-4 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/30' : 'border-l-4 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30'}">
			{#if isUeberfaellig}
				<svg class="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
			{:else}
				<svg class="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			{/if}
			<div class="flex-1 text-sm {isUeberfaellig ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}">
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
				class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium {isUeberfaellig ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600' : 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600'}"
			>
				Bezahlen
			</button>
		</div>
	{/if}

	<!-- Verknüpfte Lieferungen -->
	{#if data.verknuepfteLieferungen.length > 0}
		<div class="card">
			<h2 class="mb-3 flex items-center gap-2 text-base font-semibold text-stone-800 dark:text-stone-200">
				<svg class="h-4 w-4 text-violet-500 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
				Verknüpfte Lieferungen
				<span class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{data.verknuepfteLieferungen.length}</span>
			</h2>
			<div class="space-y-2">
				{#each data.verknuepfteLieferungen as lu}
					<div class="flex items-center justify-between rounded-lg bg-stone-50 dark:bg-stone-800/50 px-3 py-2 text-sm">
						<div class="flex flex-wrap items-center gap-3">
							<span class="font-medium text-stone-800 dark:text-stone-200">{lu.lieferantName}</span>
							{#if lu.beschreibung}
								<span class="text-stone-500 dark:text-stone-400">{lu.beschreibung}</span>
							{/if}
							{#if lu.rechnungsnummer}
								<span class="text-xs text-stone-400 dark:text-stone-500">Rg.-Nr. {lu.rechnungsnummer}</span>
							{/if}
							{#if lu.lieferscheinnummer}
								<span class="text-xs text-stone-400 dark:text-stone-500">LS-Nr. {lu.lieferscheinnummer}</span>
							{/if}
							{#if lu.datum}
								<span class="text-xs text-stone-400 dark:text-stone-500">{formatDatum(lu.datum)}</span>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if lu.betrag}
								<span class="tabular-nums font-medium text-stone-700 dark:text-stone-300">{formatCents(lu.betrag)}</span>
							{/if}
							<a href="/lieferanten/{lu.lieferantId}" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">Lieferant</a>
						</div>
					</div>
				{/each}
			</div>
			<p class="mt-2 text-xs text-stone-400 dark:text-stone-500">Diese Lieferungen sind diesem Auftrag zugeordnet und werden nicht separat in Ausgaben gebucht.</p>
		</div>
	{/if}

	<!-- Nachträge -->
	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h2 class="text-base font-semibold text-stone-800 dark:text-stone-200">Nachträge</h2>
				{#if rechnung.nachtraege.length > 0}
					<span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
						{rechnung.nachtraege.length} · +{formatCents(nachtraegeSumme)}
					</span>
				{/if}
			</div>
			<button
				onclick={() => (zeigeNachtragFormular = !zeigeNachtragFormular)}
				class="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Nachtrag erfassen
			</button>
		</div>

		{#if zeigeNachtragFormular}
			<div class="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
				{#if nachtragError}
					<div class="alert-danger mb-3">{nachtragError}</div>
				{/if}
				<form
					method="POST"
					action="?/nachtragHinzufuegen"
					enctype="multipart/form-data"
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
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300" for="nachtrag-beschreibung">Beschreibung *</label>
						<input type="text" id="nachtrag-beschreibung" name="beschreibung" required placeholder="z.B. Zusätzliche Unterverteilung" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300" for="nachtrag-betrag">Betrag (€) *</label>
						<input type="text" id="nachtrag-betrag" name="betrag" required placeholder="z.B. 2.500,00" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300" for="nachtrag-datum">Datum</label>
						<input type="date" id="nachtrag-datum" name="datum" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300" for="nachtrag-notiz">Notiz</label>
						<input type="text" id="nachtrag-notiz" name="notiz" placeholder="Optional" class="input-base" />
					</div>
					<div class="md:col-span-2">
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300" for="nachtrag-beleg">Rechnung / Beleg (PDF/JPG/PNG)</label>
						<input type="file" id="nachtrag-beleg" name="beleg" accept=".pdf,.jpg,.jpeg,.png" class="input-base" />
					</div>
					<div class="flex gap-3 md:col-span-2">
						<button type="submit" class="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600">Nachtrag hinzufügen</button>
						<button type="button" onclick={() => (zeigeNachtragFormular = false)} class="btn-secondary">Abbrechen</button>
					</div>
				</form>
			</div>
		{/if}

		{#if rechnung.nachtraege.length === 0 && !zeigeNachtragFormular}
			<p class="py-4 text-center text-sm text-stone-400 dark:text-stone-500">Noch keine Nachträge erfasst. Nachträge sind genehmigte Mehraufwände, die den Gesamtauftrag erhöhen.</p>
		{:else if rechnung.nachtraege.length > 0}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead>
						<tr class="thead-row">
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Beschreibung</th>
							<th class="px-3 py-2 text-right text-xs font-medium text-stone-500 dark:text-stone-400">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Datum</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Dokument</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Status / Abrechnung</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100 dark:divide-stone-800">
						{#each rechnung.nachtraege as nachtrag (nachtrag.id)}
							{@const verknuepfterAbschlag = nachtrag.abschlagId ? rechnung.abschlaege.find(a => a.id === nachtrag.abschlagId) : null}
							{@const abschlagStatus = verknuepfterAbschlag ? abschlagEffektivStatus(verknuepfterAbschlag) : null}
							<tr class="table-row-hover">
								<td class="px-3 py-3 text-sm font-medium text-stone-800 dark:text-stone-200">{nachtrag.beschreibung}</td>
								<td class="px-3 py-3 text-right text-sm font-semibold tabular-nums text-orange-700 dark:text-orange-400">+{formatCents(nachtrag.betrag)}</td>
								<td class="px-3 py-3 text-sm text-stone-500 dark:text-stone-400">{nachtrag.datum ? formatDatum(nachtrag.datum) : '—'}</td>
								<td class="px-3 py-3">
									{#if nachtrag.beleg}
										<div class="flex items-center gap-1.5">
											<a
												href="/rechnungen/{rechnung.id}/nachtrag/{nachtrag.id}/{nachtrag.beleg}"
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300 dark:hover:bg-stone-700"
											>
												<svg class="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
												</svg>
												<span class="max-w-[120px] truncate" title={nachtrag.beleg}>{nachtrag.beleg}</span>
											</a>
											<form method="POST" action="?/nachtragBelegHochladen" use:enhance={() => async ({ update }) => update()}>
												<input type="hidden" name="nachtragId" value={nachtrag.id} />
												<input type="hidden" name="belegLoeschen" value="on" />
												<button type="submit" class="rounded p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:text-stone-500 dark:hover:text-red-400 dark:hover:bg-red-950/40" title="Dokument entfernen">
													<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											</form>
										</div>
									{:else if nachtragBelegUploadId === nachtrag.id}
										<form
											method="POST"
											action="?/nachtragBelegHochladen"
											enctype="multipart/form-data"
											class="flex items-center gap-1.5"
											use:enhance={() => {
												return async ({ update }) => { nachtragBelegUploadId = null; await update(); };
											}}
										>
											<input type="hidden" name="nachtragId" value={nachtrag.id} />
											<input type="file" name="beleg" accept=".pdf,.jpg,.jpeg,.png" required class="text-xs w-36 dark:text-stone-300 file:mr-2 file:rounded file:border-0 file:bg-stone-100 file:px-2 file:py-1 file:text-xs dark:file:bg-stone-700 dark:file:text-stone-300" />
											<button type="submit" class="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500">OK</button>
											<button type="button" onclick={() => (nachtragBelegUploadId = null)} class="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700">✕</button>
										</form>
									{:else}
										<button
											onclick={() => (nachtragBelegUploadId = nachtrag.id)}
											class="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1.5 text-xs text-stone-400 hover:border-stone-400 hover:text-stone-600 transition dark:border-stone-600 dark:text-stone-500 dark:hover:border-stone-500 dark:hover:text-stone-300"
										>
											<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
											Rechnung hochladen
										</button>
									{/if}
								</td>
								<td class="px-3 py-3">
									{#if verknuepfterAbschlag}
										{#if abschlagStatus === 'bezahlt'}
											<span class="badge-success">
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
												Bezahlt
											</span>
										{:else if abschlagStatus === 'ueberfaellig'}
											<span class="badge-danger">Überfällig</span>
										{:else if abschlagStatus === 'bald_faellig'}
											<span class="badge-warning">Bald fällig</span>
										{:else if abschlagStatus === 'offen'}
											<span class="badge-warning">Offen</span>
										{:else}
											<span class="badge-neutral">Ausstehend</span>
										{/if}
										<span class="ml-1 text-xs text-stone-400 dark:text-stone-500">→ Abschlag {verknuepfterAbschlag.nummer}</span>
									{:else}
										<form
											method="POST"
											action="?/nachtragAbrechnen"
											use:enhance={() => {
												return async ({ update }) => { await update(); };
											}}
										>
											<input type="hidden" name="nachtragId" value={nachtrag.id} />
											<button
												type="submit"
												class="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/50"
												title="Abschlag vom Typ 'Nachtrag-Rechnung' erstellen"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
												Abrechnen →
											</button>
										</form>
									{/if}
								</td>
								<td class="px-3 py-3">
									{#if !verknuepfterAbschlag}
										<form method="POST" action="?/nachtragLoeschen" use:enhance>
											<input type="hidden" name="nachtragId" value={nachtrag.id} />
											<button
												type="submit"
												onclick={(e) => { if (!confirm('Nachtrag löschen?')) e.preventDefault(); }}
												class="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
												title="Löschen"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
												</svg>
											</button>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Abschläge -->
	<div class="card {rechnung.status === 'angebot' ? 'opacity-50 pointer-events-none' : ''}">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold text-stone-800 dark:text-stone-200">Abschläge</h2>
			{#if rechnung.status === 'angebot'}
				<span class="text-xs text-stone-400 dark:text-stone-500 italic">Erst nach Auftragsannahme verfügbar</span>
			{:else}
			<button
				onclick={() => (zeigeAbschlagFormular = !zeigeAbschlagFormular)}
				class="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Hinzufügen
			</button>
			{/if}
		</div>

		{#if zeigeAbschlagFormular}
			<div class="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/20">
				{#if abschlagError}
					<div class="alert-danger mb-3">{abschlagError}</div>
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
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Typ *</label>
						<select name="typ" required class="input-base">
							<option value="abschlag">Abschlag</option>
							<option value="schlussrechnung">Schlussrechnung</option>
							<option value="nachtragsrechnung">Nachtrag</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Betrag (€) *</label>
						<input type="text" name="betrag" required placeholder="z.B. 5.000,00" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Rechnungsnummer</label>
						<input type="text" name="rechnungsnummer" placeholder="Optional" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Rechnungseingang</label>
						<input type="date" name="eingangsdatum" bind:value={abschlagEingangsdatum} oninput={berechneFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Zahlungsziel (Tage)</label>
						<input type="number" name="zahlungsziel" min="1" max="365" placeholder="z.B. 14" bind:value={abschlagZahlungsziel} oninput={berechneFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
							Fällig am
							{#if abschlagEingangsdatum && abschlagZahlungsziel}
								<span class="ml-1 text-xs font-normal text-primary-600 dark:text-primary-400">(automatisch berechnet)</span>
							{/if}
						</label>
						<input type="date" name="faelligkeitsdatum" bind:value={abschlagFaelligkeitsdatum} class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Notiz</label>
						<input type="text" name="notiz" placeholder="Optional" class="input-base" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Beleg (PDF/JPG/PNG)</label>
						<input type="file" name="beleg" accept=".pdf,.jpg,.jpeg,.png" class="input-base" />
					</div>
					<div class="flex gap-3 md:col-span-2">
						<button type="submit" class="btn-primary">Abschlag hinzufügen</button>
						<button type="button" onclick={() => (zeigeAbschlagFormular = false)} class="btn-secondary">Abbrechen</button>
					</div>
				</form>
			</div>
		{/if}

		{#if rechnung.abschlaege.length === 0}
			<p class="py-6 text-center text-sm text-stone-400 dark:text-stone-500">Noch keine Abschläge. Füge den ersten Abschlag hinzu.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead>
						<tr class="thead-row">
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Typ</th>
							<th class="px-3 py-2 text-right text-xs font-medium text-stone-500 dark:text-stone-400">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Rg.-Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Fällig</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Status</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-stone-500 dark:text-stone-400">Bezahlt am</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100 dark:divide-stone-800">
						{#each rechnung.abschlaege as abschlag}
							{@const badge = statusBadge(abschlag)}
							{@const effStatus = abschlagEffektivStatus(abschlag)}
							{@const borderCls = effStatus === 'bezahlt' ? 'border-l-4 border-green-400 dark:border-green-600' : effStatus === 'ueberfaellig' ? 'border-l-4 border-red-500 dark:border-red-600' : effStatus === 'bald_faellig' ? 'border-l-4 border-amber-400 dark:border-amber-600' : effStatus === 'offen' ? 'border-l-4 border-yellow-300 dark:border-yellow-700' : 'border-l-4 border-stone-200 dark:border-stone-700'}
							{@const betragCls = effStatus === 'bezahlt' ? 'text-green-700 dark:text-green-400' : effStatus === 'ueberfaellig' ? 'text-red-700 dark:text-red-400' : effStatus === 'bald_faellig' ? 'text-amber-700 dark:text-amber-400' : 'text-stone-900 dark:text-stone-100'}
							{@const linkedNachtrag = abschlag.typ === 'nachtragsrechnung' ? rechnung.nachtraege.find(n => n.abschlagId === abschlag.id && n.beleg) : null}
							<tr class="table-row-hover {borderCls}">
								<td class="px-3 py-3 text-sm text-stone-500 dark:text-stone-400">{abschlag.nummer}</td>
								<td class="px-3 py-3 text-sm font-medium text-stone-800 dark:text-stone-200">{typLabel(abschlag.typ)}</td>
								<td class="px-3 py-3 text-right text-sm font-semibold tabular-nums {betragCls}">{formatCents(abschlag.rechnungsbetrag)}</td>
								<td class="px-3 py-3 text-sm text-stone-500 dark:text-stone-400">{abschlag.rechnungsnummer ?? '—'}</td>
								<td class="px-3 py-3 text-sm {effStatus === 'ueberfaellig' ? 'font-semibold text-red-600 dark:text-red-400' : effStatus === 'bald_faellig' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}">
									{abschlag.faelligkeitsdatum ? formatDatum(abschlag.faelligkeitsdatum) : '—'}
									{#if abschlag.faelligkeitsdatum}
										{@const tage = tageVerbleibend(abschlag.faelligkeitsdatum)}
										{#if effStatus === 'ueberfaellig'}
											<span class="block text-xs text-red-500 dark:text-red-400 font-semibold">{Math.abs(tage)} {Math.abs(tage) === 1 ? 'Tag' : 'Tage'} überfällig</span>
										{:else if tage === 0 && effStatus !== 'bezahlt'}
											<span class="block text-xs text-red-500 dark:text-red-400 font-semibold">Heute fällig</span>
										{:else if effStatus === 'bald_faellig'}
											<span class="block text-xs text-amber-500 dark:text-amber-400 font-semibold">in {tage} {tage === 1 ? 'Tag' : 'Tagen'}</span>
										{:else if effStatus === 'offen' && tage > 0}
											<span class="block text-xs text-stone-400 dark:text-stone-500">in {tage} {tage === 1 ? 'Tag' : 'Tagen'}</span>
										{/if}
									{/if}
								</td>
								<td class="px-3 py-3">
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {badge.cls}">{badge.label}</span>
								</td>
								<td class="px-3 py-3 text-sm text-stone-500 dark:text-stone-400">
									{#if abschlag.bezahltam}
										<span class="inline-flex items-center gap-1">
											<svg class="w-3.5 h-3.5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
											{formatDatum(abschlag.bezahltam)}
										</span>
										{#if abschlag.buchungId}
											<a href="/buchungen/{abschlag.buchungId}" class="ml-1 text-xs text-primary-600 dark:text-primary-400 hover:underline">Buchung</a>
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
												class="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300 dark:hover:bg-stone-700"
												title="{abschlag.beleg}"
											>
												<svg class="h-3.5 w-3.5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
												</svg>
												PDF
											</a>
										{:else if linkedNachtrag}
											<a
												href="/rechnungen/{rechnung.id}/nachtrag/{linkedNachtrag.id}/{linkedNachtrag.beleg}"
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300 dark:hover:bg-stone-700"
												title="{linkedNachtrag.beleg} (Nachtrag-Beleg)"
											>
												<svg class="h-3.5 w-3.5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
												</svg>
												PDF
											</a>
										{/if}
										<button
											onclick={() => oeffneAbschlagBearbeiten(abschlag)}
											class="rounded p-1 text-stone-400 hover:bg-primary-50 hover:text-primary-600 dark:text-stone-500 dark:hover:bg-primary-900/30 dark:hover:text-primary-400"
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
												class="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
											>
												Bezahlen
											</button>
											<form method="POST" action="?/abschlagLoeschen" use:enhance>
												<input type="hidden" name="abschlagId" value={abschlag.id} />
												<button
													type="submit"
													onclick={(e) => { if (!confirm('Abschlag löschen?')) e.preventDefault(); }}
													class="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
								<tr class="bg-green-50 dark:bg-green-950/20">
									<td colspan="8" class="px-3 py-3">
										{#if bezahlenError}
											<div class="alert-danger mb-2">{bezahlenError}</div>
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
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Bezahlt am *</label>
												<input type="date" name="bezahltam" required value={heute} class="input-base" />
											</div>
											<div class="flex-1">
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Buchungs-Beschreibung</label>
												<input
													type="text"
													name="beschreibung"
													placeholder="{rechnung.auftragnehmer} – {typLabel(abschlag.typ)} {abschlag.nummer}"
													class="input-base w-full"
												/>
											</div>
											<div class="flex gap-2">
												<button type="submit" class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600">
													Bezahlt &amp; Buchung erstellen
												</button>
												<button type="button" onclick={() => (bezahlenAbschlagId = null)} class="btn-secondary">
													Abbrechen
												</button>
											</div>
										</form>
									</td>
								</tr>
							{/if}

							<!-- Bearbeiten-Inline-Formular -->
							{#if edierenderAbschlagId === abschlag.id}
								<tr class="bg-primary-50 dark:bg-primary-950/20">
									<td colspan="8" class="px-3 py-3">
										{#if editAbschlagError}
											<div class="alert-danger mb-2">{editAbschlagError}</div>
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
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Rechnungsnummer</label>
												<input type="text" name="rechnungsnummer" value={abschlag.rechnungsnummer ?? ''} placeholder="Optional" class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Rechnungseingang</label>
												<input type="date" name="eingangsdatum" bind:value={editEingangsdatum} oninput={berechneEditFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Zahlungsziel (Tage)</label>
												<input type="number" name="zahlungsziel" min="1" max="365" bind:value={editZahlungsziel} oninput={berechneEditFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">
													Fällig am
													{#if editEingangsdatum && editZahlungsziel}
														<span class="ml-1 text-xs font-normal text-primary-600 dark:text-primary-400">(auto)</span>
													{/if}
												</label>
												<input type="date" name="faelligkeitsdatum" bind:value={editFaelligkeitsdatum} class="input-base" />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">Notiz</label>
												<input type="text" name="notiz" value={abschlag.notiz ?? ''} placeholder="Optional" class="input-base" />
											</div>
											<div class="flex items-end gap-2">
												<button type="submit" class="btn-primary">Speichern</button>
												<button type="button" onclick={() => (edierenderAbschlagId = null)} class="btn-sm-secondary">Abbrechen</button>
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
			<div class="px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/40 rounded-t-xl">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span class="text-sm font-semibold text-stone-700 dark:text-stone-300">Verlauf</span>
				</div>
			</div>
			<div class="px-4 py-4">
				<div class="relative">
					{#each timelineEvents as event, i}
						{@const dotColor =
							event.color === 'green' ? 'bg-green-500' :
							event.color === 'blue' ? 'bg-primary-600' :
							event.color === 'orange' ? 'bg-orange-500' :
							event.color === 'red' ? 'bg-red-500' :
							event.color === 'amber' ? 'bg-amber-500' :
							'bg-yellow-400'}
						{@const ringColor =
							event.color === 'green' ? 'border-green-500' :
							event.color === 'blue' ? 'border-primary-600' :
							event.color === 'orange' ? 'border-orange-500' :
							event.color === 'red' ? 'border-red-500' :
							event.color === 'amber' ? 'border-amber-500' :
							'border-yellow-400'}

						<!-- Heute-Marker -->
						{#if timelineHeuteIndex === i}
							<div class="flex items-center gap-2 py-1.5 ml-1">
								<div class="w-2 h-2 rounded-full bg-primary-600 ring-2 ring-primary-200 dark:ring-primary-900"></div>
								<div class="flex-1 h-px bg-primary-300 dark:bg-primary-800"></div>
								<span class="text-xs font-semibold text-primary-600 dark:text-primary-400 px-2">Heute</span>
								<div class="flex-1 h-px bg-primary-300 dark:bg-primary-800"></div>
							</div>
						{/if}

						<div class="flex gap-3 {i < timelineEvents.length - 1 || (timelineHeuteIndex === -1 && i === timelineEvents.length - 1) ? '' : ''}">
							<!-- Vertikale Linie + Dot -->
							<div class="flex flex-col items-center">
								{#if event.filled}
									<div class="w-3 h-3 rounded-full {dotColor} shrink-0 mt-1"></div>
								{:else}
									<div class="w-3 h-3 rounded-full border-2 {ringColor} bg-white dark:bg-stone-900 shrink-0 mt-1"></div>
								{/if}
								{#if i < timelineEvents.length - 1 || timelineHeuteIndex === -1}
									<div class="w-px flex-1 bg-stone-200 dark:bg-stone-800 min-h-4"></div>
								{/if}
							</div>

							<!-- Event Content -->
							<div class="pb-4 min-w-0">
								<div class="flex items-baseline gap-2 flex-wrap">
									<span class="text-xs font-mono text-stone-400 dark:text-stone-500 tabular-nums">{formatDatum(event.datum)}</span>
									<span class="text-sm font-medium {event.filled ? 'text-stone-800 dark:text-stone-200' : 'text-stone-500 dark:text-stone-400'}">{event.label}</span>
								</div>
								<div class="flex items-center gap-2 mt-0.5">
									{#if event.betrag !== null}
										<span class="text-xs font-mono tabular-nums {
											event.color === 'green' ? 'text-green-600 dark:text-green-400' :
											event.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
											event.color === 'red' ? 'text-red-600 dark:text-red-400' :
											'text-stone-500 dark:text-stone-400'
										}">
											{event.color === 'orange' ? '+' : ''}{formatCents(event.betrag)}
										</span>
									{/if}
									{#if event.detail}
										<span class="text-xs text-stone-400 dark:text-stone-500">{event.detail}</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}

					<!-- Heute-Marker am Ende (wenn alle Events in der Vergangenheit) -->
					{#if timelineHeuteIndex === -1}
						<div class="flex items-center gap-2 py-1.5 ml-1">
							<div class="w-2 h-2 rounded-full bg-primary-600 ring-2 ring-primary-200 dark:ring-primary-900"></div>
							<div class="flex-1 h-px bg-primary-300 dark:bg-primary-800"></div>
							<span class="text-xs font-semibold text-primary-600 dark:text-primary-400 px-2">Heute</span>
							<div class="flex-1 h-px bg-primary-300 dark:bg-primary-800"></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
