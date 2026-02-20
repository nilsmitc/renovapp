<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, formatDatum, centsToInputValue } from '$lib/format';
	import type { PageData } from './$types';
	import type { LieferungPosition } from '$lib/domain';

	let { data }: { data: PageData } = $props();

	let zeigeLieferungFormular = $state(false);
	let zeigeEditFormular = $state(false);
	let lieferungError = $state('');
	let editError = $state('');

	// Welche Lieferung ist gerade "belegHinzufuegen" offen?
	let belegUploadFuerLieferung = $state<string | null>(null);
	let belegError = $state('');

	// Welche Lieferung wird gerade bearbeitet?
	let bearbeiteteLieferungId = $state<string | null>(null);
	let editLieferungError = $state('');

	// ─── PDF-Extraktion State ───────────────────────────────────────────────
	let formDatum = $state(new Date().toISOString().slice(0, 10));
	let formRechnungsnummer = $state('');
	let formLieferscheinnummer = $state('');
	let formBetrag = $state('');
	let extrahiertePositionen = $state<LieferungPosition[]>([]);
	let autoFilled = $state(new Set<string>());
	let extraktionLaeuft = $state(false);
	let extraktionStatus = $state<'ok' | 'scan' | 'fehler' | null>(null);
	let zeigePdfPositionen = $state(false);
	let laufenderPdfRequest = $state<AbortController | null>(null);

	function resetLieferungForm() {
		formDatum = new Date().toISOString().slice(0, 10);
		formRechnungsnummer = '';
		formLieferscheinnummer = '';
		formBetrag = '';
		extrahiertePositionen = [];
		autoFilled = new Set();
		extraktionLaeuft = false;
		extraktionStatus = null;
		zeigePdfPositionen = false;
	}

	async function analysierePdf(files: FileList | null) {
		if (!files || files.length === 0) return;
		const pdfDatei = Array.from(files).find((f) => f.type === 'application/pdf');
		if (!pdfDatei) return;

		// Vorherigen laufenden Request abbrechen (verhindert Race Condition bei schnellem Datei-Wechsel)
		if (laufenderPdfRequest) laufenderPdfRequest.abort();
		const controller = new AbortController();
		laufenderPdfRequest = controller;

		extraktionLaeuft = true;
		extraktionStatus = null;
		autoFilled = new Set();

		const fd = new FormData();
		fd.append('datei', pdfDatei);

		try {
			const res = await fetch('/api/pdf-analyse', { method: 'POST', body: fd, signal: controller.signal });
			if (res.ok) {
				const d = await res.json();
				const filled = new Set<string>();
				if (d.datum) { formDatum = d.datum; filled.add('datum'); }
				if (d.rechnungsnummer) { formRechnungsnummer = d.rechnungsnummer; filled.add('rechnungsnummer'); }
				if (d.lieferscheinnummer) { formLieferscheinnummer = d.lieferscheinnummer; filled.add('lieferscheinnummer'); }
				if (d.betrag) { formBetrag = centsToInputValue(d.betrag); filled.add('betrag'); }
				extrahiertePositionen = d.positionen ?? [];
				autoFilled = filled;
				extraktionStatus = 'ok';
			} else if (res.status === 422) {
				extraktionStatus = 'scan';
			} else {
				extraktionStatus = 'fehler';
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return; // Abgebrochen – kein Fehler anzeigen
			extraktionStatus = 'fehler';
		} finally {
			if (laufenderPdfRequest === controller) laufenderPdfRequest = null;
			extraktionLaeuft = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/lieferanten" class="text-gray-400 hover:text-gray-600">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</a>
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{data.lieferant.name}</h1>
				{#if data.lieferant.notiz}
					<p class="text-sm text-gray-500">{data.lieferant.notiz}</p>
				{/if}
			</div>
		</div>
		<button
			onclick={() => (zeigeEditFormular = !zeigeEditFormular)}
			class="btn-sm-secondary flex items-center gap-1"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
			</svg>
			Bearbeiten
		</button>
	</div>

	<!-- Edit-Formular -->
	{#if zeigeEditFormular}
		<div class="card">
			<h2 class="mb-4 text-base font-semibold text-gray-800">Lieferant bearbeiten</h2>
			{#if editError}
				<div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</div>
			{/if}
			<form
				method="POST"
				action="?/lieferantBearbeiten"
				use:enhance={() => {
					editError = '';
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							editError = (result.data?.editError as string) ?? 'Fehler';
						} else {
							zeigeEditFormular = false;
						}
						await update();
					};
				}}
				class="grid grid-cols-1 gap-4 md:grid-cols-2"
			>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="edit-name">Name *</label>
					<input type="text" name="name" id="edit-name" required value={data.lieferant.name} class="input-base" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="edit-notiz">Notiz</label>
					<input type="text" name="notiz" id="edit-notiz" value={data.lieferant.notiz ?? ''} placeholder="Kundennummer, Ansprechpartner, ..." class="input-base" />
				</div>
				<div class="flex gap-3 md:col-span-2">
					<button type="submit" class="btn-sm-primary">Speichern</button>
					<button type="button" onclick={() => (zeigeEditFormular = false)} class="btn-sm-secondary">Abbrechen</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- KPI-Karten -->
	<div class="grid grid-cols-3 gap-4">
		<div class="kpi-card">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-500">Gesamtausgaben</div>
			<div class="mt-1 text-2xl font-bold tabular-nums text-gray-900">
				{data.gesamtBetrag !== 0 ? formatCents(data.gesamtBetrag) : '—'}
			</div>
		</div>
		<div class="kpi-card">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-500">Lieferungen</div>
			<div class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{data.lieferungenMitStats.length}</div>
		</div>
		<div class="kpi-card">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-500">Buchungen</div>
			<div class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{data.gesamtBuchungen}</div>
		</div>
	</div>

	<!-- Neue Lieferung -->
	<div class="card">
		<div class="flex items-center justify-between">
			<h2 class="text-base font-semibold text-gray-800">Lieferungen</h2>
			<button
				onclick={() => { zeigeLieferungFormular = !zeigeLieferungFormular; if (!zeigeLieferungFormular) resetLieferungForm(); }}
				class="btn-sm-primary flex items-center gap-1"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Neue Lieferung
			</button>
		</div>

		{#if zeigeLieferungFormular}
			<div class="mt-4 border-t border-gray-100 pt-4">
				{#if lieferungError}
					<div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{lieferungError}</div>
				{/if}
				<form
					method="POST"
					action="?/lieferungHinzufuegen"
					enctype="multipart/form-data"
					use:enhance={({ formElement }) => {
						lieferungError = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								lieferungError = (result.data?.lieferungError as string) ?? 'Fehler';
							} else {
								formElement.reset();
								resetLieferungForm();
								zeigeLieferungFormular = false;
							}
							await update();
						};
					}}
					class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
				>
					<!-- Datum -->
					<div>
						<div class="mb-1 flex items-center gap-2">
							<label class="text-sm font-medium text-gray-700" for="datum">Datum *</label>
							{#if autoFilled.has('datum')}
								<span class="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Erkannt</span>
							{/if}
						</div>
						<input type="date" name="datum" id="datum" required bind:value={formDatum} class="input-base" />
					</div>

					<!-- Beschreibung -->
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="beschreibung">Beschreibung</label>
						<input type="text" name="beschreibung" id="beschreibung" placeholder="z.B. Rigips + Dämmung" class="input-base" />
					</div>

					<!-- Betrag -->
					<div>
						<div class="mb-1 flex items-center gap-2">
							<label class="text-sm font-medium text-gray-700" for="betrag">Rechnungsbetrag (€)</label>
							{#if autoFilled.has('betrag')}
								<span class="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Erkannt</span>
							{/if}
						</div>
						<input type="text" name="betrag" id="betrag" placeholder="z.B. 1.234,56" bind:value={formBetrag} class="input-base" />
						<div class="mt-2 flex items-center gap-2">
							<input type="checkbox" name="gutschrift" id="gutschrift" class="rounded" />
							<label for="gutschrift" class="text-sm text-gray-700">Gutschrift / Rückbuchung</label>
						</div>
						<p class="mt-1 text-xs text-gray-500">Betrag laut Händlerrechnung (zur Kontrolle)</p>
					</div>

					<!-- Rechnungsnummer -->
					<div>
						<div class="mb-1 flex items-center gap-2">
							<label class="text-sm font-medium text-gray-700" for="rechnungsnummer">Rechnungsnummer</label>
							{#if autoFilled.has('rechnungsnummer')}
								<span class="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Erkannt</span>
							{/if}
						</div>
						<input type="text" name="rechnungsnummer" id="rechnungsnummer" placeholder="z.B. 2026-04567" bind:value={formRechnungsnummer} class="input-base" />
					</div>

					<!-- Lieferscheinnummer -->
					<div>
						<div class="mb-1 flex items-center gap-2">
							<label class="text-sm font-medium text-gray-700" for="lieferscheinnummer">Lieferscheinnummer</label>
							{#if autoFilled.has('lieferscheinnummer')}
								<span class="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Erkannt</span>
							{/if}
						</div>
						<input type="text" name="lieferscheinnummer" id="lieferscheinnummer" placeholder="z.B. LS-20260315" bind:value={formLieferscheinnummer} class="input-base" />
					</div>

					<!-- Gewerk -->
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700" for="gewerk">Gewerk</label>
						<select name="gewerk" id="gewerk" class="input-base">
							<option value="">— Optional —</option>
							{#each data.gewerke as g}
								<option value={g.id}>{g.name}</option>
							{/each}
						</select>
					</div>

					<!-- Notiz -->
					<div class="md:col-span-2 lg:col-span-3">
						<label class="mb-1 block text-sm font-medium text-gray-700" for="notiz">Notiz</label>
						<input type="text" name="notiz" id="notiz" placeholder="Optional" class="input-base" />
					</div>

					<!-- Dokumente + PDF-Analyse -->
					<div class="md:col-span-2 lg:col-span-3">
						<label class="mb-1 block text-sm font-medium text-gray-700" for="belege-neu">
							Dokumente (Lieferschein, Rechnung)
						</label>
						<input
							type="file"
							name="belege"
							id="belege-neu"
							multiple
							accept=".pdf,.jpg,.jpeg,.png"
							class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
							oninput={(e) => analysierePdf(e.currentTarget.files)}
						/>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<p class="text-xs text-gray-500">PDF, JPG oder PNG, max. 10 MB</p>
							{#if extraktionLaeuft}
								<span class="flex items-center gap-1 text-xs text-blue-600">
									<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
									</svg>
									PDF wird analysiert…
								</span>
							{:else if extraktionStatus === 'ok'}
								<span class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									{autoFilled.size} Felder automatisch befüllt
									{#if extrahiertePositionen.length > 0}
										· {extrahiertePositionen.length} Positionen
									{/if}
								</span>
							{:else if extraktionStatus === 'scan'}
								<span class="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
									</svg>
									Scan erkannt – bitte manuell ausfüllen
								</span>
							{:else if extraktionStatus === 'fehler'}
								<span class="text-xs text-orange-600">Analyse fehlgeschlagen – manuelle Eingabe</span>
							{/if}
						</div>

						<!-- Erkannte Positionen Vorschau -->
						{#if extrahiertePositionen.length > 0 && extraktionStatus === 'ok'}
							<div class="mt-3">
								<button
									type="button"
									onclick={() => (zeigePdfPositionen = !zeigePdfPositionen)}
									class="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
								>
									<svg class="h-3.5 w-3.5 transition-transform {zeigePdfPositionen ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
									</svg>
									{extrahiertePositionen.length} erkannte Positionen {zeigePdfPositionen ? 'verbergen' : 'anzeigen'}
								</button>
								{#if zeigePdfPositionen}
									<div class="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
										<table class="w-full text-xs">
											<tbody class="divide-y divide-gray-100">
												{#each extrahiertePositionen as pos}
													<tr>
														<td class="py-1 pr-3 text-gray-700">{pos.beschreibung}</td>
														<td class="py-1 pr-3 text-gray-500">{pos.menge ?? ''}</td>
														<td class="py-1 text-right tabular-nums font-medium text-gray-900">
															{pos.betrag ? formatCents(pos.betrag) : '—'}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Hidden: Positionen als JSON -->
					<input type="hidden" name="positionen" value={JSON.stringify(extrahiertePositionen)} />

					<div class="flex gap-3 md:col-span-2 lg:col-span-3">
						<button type="submit" class="btn-primary">Lieferung anlegen</button>
						<button
							type="button"
							onclick={() => { zeigeLieferungFormular = false; resetLieferungForm(); }}
							class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							Abbrechen
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Lieferungen-Tabelle -->
		{#if data.lieferungenMitStats.length === 0}
			<p class="mt-4 text-sm text-gray-500">Noch keine Lieferungen erfasst.</p>
		{:else}
			<div class="mt-4 space-y-3">
				{#each data.lieferungenMitStats as { lieferung, gebuchtBetrag, anzahlBuchungen }}
					<div class="rounded-lg border border-gray-200 p-4">
						<!-- Kopfzeile -->
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-medium text-gray-900">{formatDatum(lieferung.datum)}</span>
									{#if lieferung.beschreibung}
										<span class="text-sm text-gray-700">{lieferung.beschreibung}</span>
									{/if}
									{#if lieferung.gewerk}
										{@const gw = data.gewerke.find((g) => g.id === lieferung.gewerk)}
										{#if gw}
											<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style="background-color: {gw.farbe}22; color: {gw.farbe}">
												<span class="h-1.5 w-1.5 rounded-full" style="background-color: {gw.farbe}"></span>
												{gw.name}
											</span>
										{/if}
									{/if}
								</div>
								<div class="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
									{#if lieferung.rechnungsnummer}
										<span>Rg.-Nr. {lieferung.rechnungsnummer}</span>
									{/if}
									{#if lieferung.lieferscheinnummer}
										<span>LS-Nr. {lieferung.lieferscheinnummer}</span>
									{/if}
									{#if lieferung.betrag}
										<span>Händlerrechnung: {formatCents(lieferung.betrag)}</span>
									{/if}
									{#if lieferung.buchungId}
										<a href="/buchungen/{lieferung.buchungId}" class="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200">
											<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
											In Ausgaben
										</a>
									{:else if lieferung.betrag && !lieferung.gewerk}
										<span class="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
											<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
											Kein Gewerk – nicht in Ausgaben
										</span>
									{/if}
									{#if anzahlBuchungen > 1}
										<a href="/buchungen?lieferung={lieferung.id}" class="text-blue-600 hover:underline">
											{anzahlBuchungen} Buchungen ({formatCents(gebuchtBetrag)})
										</a>
									{/if}
									{#if lieferung.notiz}
										<span class="italic">{lieferung.notiz}</span>
									{/if}
								</div>
							</div>

							<!-- Betrag-Kästchen -->
							{#if lieferung.betrag}
								<div class="text-right">
									<div class="text-base font-semibold tabular-nums {lieferung.betrag < 0 ? 'text-red-600' : 'text-gray-900'}">{formatCents(lieferung.betrag)}</div>
									{#if lieferung.betrag < 0}
										<div class="text-xs font-medium text-red-500">Gutschrift</div>
									{:else}
										<div class="text-xs text-gray-500">Händlerrechnung</div>
									{/if}
									{#if anzahlBuchungen > 0 && lieferung.betrag !== gebuchtBetrag}
										<div class="text-xs text-gray-500">{formatCents(gebuchtBetrag)} gebucht</div>
									{/if}
								</div>
							{:else if gebuchtBetrag > 0}
								<div class="text-right">
									<div class="text-base font-semibold tabular-nums text-gray-900">{formatCents(gebuchtBetrag)}</div>
									<div class="text-xs text-gray-500">gebucht</div>
								</div>
							{/if}
						</div>

						<!-- Inline Edit Formular -->
						{#if bearbeiteteLieferungId === lieferung.id}
							<div class="mt-3 border-t border-blue-100 pt-3">
								{#if editLieferungError}
									<div class="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{editLieferungError}</div>
								{/if}
								<form
									method="POST"
									action="?/lieferungBearbeiten"
									use:enhance={() => {
										editLieferungError = '';
										return async ({ result, update }) => {
											if (result.type === 'failure') {
												editLieferungError = (result.data?.editLieferungError as string) ?? 'Fehler';
											} else {
												bearbeiteteLieferungId = null;
											}
											await update();
										};
									}}
									class="grid grid-cols-2 gap-3 md:grid-cols-3"
								>
									<input type="hidden" name="lieferungId" value={lieferung.id} />
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-datum-{lieferung.id}">Datum *</label>
										<input type="date" name="datum" id="edit-datum-{lieferung.id}" required value={lieferung.datum} class="input-sm" />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-beschreibung-{lieferung.id}">Beschreibung</label>
										<input type="text" name="beschreibung" id="edit-beschreibung-{lieferung.id}" value={lieferung.beschreibung ?? ''} class="input-sm" />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-betrag-{lieferung.id}">Rechnungsbetrag (€)</label>
										<input type="text" name="betrag" id="edit-betrag-{lieferung.id}" value={lieferung.betrag ? centsToInputValue(Math.abs(lieferung.betrag)) : ''} placeholder="z.B. 1.234,56" class="input-sm" />
										<div class="mt-1.5 flex items-center gap-2">
											<input type="checkbox" name="gutschrift" id="edit-gutschrift-{lieferung.id}" class="rounded" checked={lieferung.betrag !== undefined && lieferung.betrag < 0} />
											<label for="edit-gutschrift-{lieferung.id}" class="text-xs text-gray-600">Gutschrift / Rückbuchung</label>
										</div>
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-rgnr-{lieferung.id}">Rechnungsnummer</label>
										<input type="text" name="rechnungsnummer" id="edit-rgnr-{lieferung.id}" value={lieferung.rechnungsnummer ?? ''} class="input-sm" />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-lsnr-{lieferung.id}">Lieferscheinnummer</label>
										<input type="text" name="lieferscheinnummer" id="edit-lsnr-{lieferung.id}" value={lieferung.lieferscheinnummer ?? ''} class="input-sm" />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-gewerk-{lieferung.id}">Gewerk</label>
										<select name="gewerk" id="edit-gewerk-{lieferung.id}" class="input-sm">
											<option value="">— Optional —</option>
											{#each data.gewerke as g}
												<option value={g.id} selected={lieferung.gewerk === g.id}>{g.name}</option>
											{/each}
										</select>
									</div>
									<div class="col-span-2 md:col-span-3">
										<label class="mb-1 block text-xs font-medium text-gray-600" for="edit-notiz-{lieferung.id}">Notiz</label>
										<input type="text" name="notiz" id="edit-notiz-{lieferung.id}" value={lieferung.notiz ?? ''} class="input-sm" />
									</div>
									<div class="col-span-2 flex gap-2 md:col-span-3">
										<button type="submit" class="btn-sm-primary text-xs">Speichern</button>
										<button type="button" onclick={() => (bearbeiteteLieferungId = null)} class="btn-sm-secondary text-xs">Abbrechen</button>
									</div>
								</form>
							</div>
						{/if}

						<!-- Positionen -->
						{#if lieferung.positionen && lieferung.positionen.length > 0}
							<details class="mt-3">
								<summary class="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800">
									{lieferung.positionen.length} Positionen (aus PDF)
								</summary>
								<div class="mt-2 overflow-hidden rounded-md border border-gray-200">
									<table class="w-full text-xs">
										<thead>
											<tr class="bg-gray-50">
												<th class="px-3 py-1.5 text-left font-medium text-gray-600">Artikel</th>
												<th class="px-3 py-1.5 text-left font-medium text-gray-600">Menge</th>
												<th class="px-3 py-1.5 text-right font-medium text-gray-600">Betrag</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-100">
											{#each lieferung.positionen as pos}
												<tr class="hover:bg-gray-50">
													<td class="px-3 py-1.5 text-gray-700">{pos.beschreibung}</td>
													<td class="px-3 py-1.5 text-gray-500">{pos.menge ?? '—'}</td>
													<td class="px-3 py-1.5 text-right tabular-nums text-gray-900">
														{pos.betrag ? formatCents(pos.betrag) : '—'}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</details>
						{/if}

						<!-- Belege -->
						{#if lieferung.belege.length > 0}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each lieferung.belege as beleg}
									<div class="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
										</svg>
										<a
											href="/lieferungen/{lieferung.id}/{beleg}"
											target="_blank"
											rel="noopener noreferrer"
											class="max-w-[160px] truncate text-xs text-blue-600 hover:underline"
										>{beleg}</a>
										<form method="POST" action="?/belegLoeschen" use:enhance={() => async ({ update }) => update()}>
											<input type="hidden" name="lieferungId" value={lieferung.id} />
											<input type="hidden" name="dateiname" value={beleg} />
											<button
												type="submit"
												onclick={(e) => { if (!confirm('Beleg löschen?')) e.preventDefault(); }}
												class="text-gray-400 hover:text-red-500"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</form>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Aktionen -->
						<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
							{#if belegUploadFuerLieferung === lieferung.id}
								{#if belegError}
									<p class="w-full text-xs text-red-600">{belegError}</p>
								{/if}
								<form
									method="POST"
									action="?/belegHinzufuegen"
									enctype="multipart/form-data"
									class="flex flex-wrap items-center gap-2"
									use:enhance={({ formElement }) => {
										belegError = '';
										return async ({ result, update }) => {
											if (result.type === 'failure') {
												belegError = (result.data?.belegError as string) ?? 'Fehler';
											} else {
												formElement.reset();
												belegUploadFuerLieferung = null;
											}
											await update();
										};
									}}
								>
									<input type="hidden" name="lieferungId" value={lieferung.id} />
									<input
										type="file"
										name="belege"
										multiple
										accept=".pdf,.jpg,.jpeg,.png"
										class="text-xs text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
									/>
									<button type="submit" class="btn-sm-primary text-xs">Hochladen</button>
									<button type="button" onclick={() => (belegUploadFuerLieferung = null)} class="btn-sm-secondary text-xs">Abbrechen</button>
								</form>
							{:else}
								<button
									onclick={() => { belegUploadFuerLieferung = lieferung.id; belegError = ''; }}
									class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
									</svg>
									Dokument hinzufügen
								</button>
							{/if}

							<span class="text-gray-200">|</span>

							<a href="/buchungen?lieferung={lieferung.id}" class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
								</svg>
								Buchungen ansehen
							</a>

							<button
								onclick={() => { bearbeiteteLieferungId = bearbeiteteLieferungId === lieferung.id ? null : lieferung.id; editLieferungError = ''; }}
								class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
								</svg>
								Bearbeiten
							</button>

							<span class="ml-auto">
								<form
									method="POST"
									action="?/lieferungLoeschen"
									use:enhance={() => async ({ result, update }) => {
										if (result.type === 'failure') alert((result.data?.error as string) ?? 'Fehler beim Löschen');
										await update();
									}}
								>
									<input type="hidden" name="lieferungId" value={lieferung.id} />
									<button
										type="submit"
										onclick={(e) => { if (!confirm('Lieferung wirklich löschen?')) e.preventDefault(); }}
										class="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
										</svg>
										Löschen
									</button>
								</form>
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
