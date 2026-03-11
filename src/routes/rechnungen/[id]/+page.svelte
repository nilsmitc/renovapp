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

	const heute = new Date().toISOString().slice(0, 10);

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

			<!-- KPI-Zeile -->
			<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#if rechnung.auftragssumme}
					<div class="rounded-lg bg-gray-50 p-3">
						<div class="text-xs uppercase tracking-wide text-gray-500">Auftrag</div>
						<div class="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatCents(rechnung.auftragssumme)}</div>
					</div>
				{/if}
				{#if nachtraegeSumme > 0}
					<div class="rounded-lg bg-orange-50 p-3">
						<div class="text-xs uppercase tracking-wide text-orange-600">Nachträge</div>
						<div class="mt-1 text-lg font-bold tabular-nums text-orange-700">+{formatCents(nachtraegeSumme)}</div>
					</div>
				{/if}
				<div class="rounded-lg bg-gray-50 p-3">
					<div class="text-xs uppercase tracking-wide text-gray-500">Gestellt</div>
					<div class="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatCents(gestelltSumme)}</div>
				</div>
				{#if bezahltSumme > 0}
					<div class="rounded-lg bg-green-50 p-3">
						<div class="text-xs uppercase tracking-wide text-green-600">Bezahlt</div>
						<div class="mt-1 text-lg font-bold tabular-nums text-green-700">{formatCents(bezahltSumme)}</div>
					</div>
				{/if}
				{#if offenSumme > 0}
					<div class="rounded-lg bg-yellow-50 p-3">
						<div class="text-xs uppercase tracking-wide text-yellow-600">Offen</div>
						<div class="mt-1 text-lg font-bold tabular-nums text-yellow-700">{formatCents(offenSumme)}</div>
					</div>
				{/if}
			</div>

			<!-- Fortschrittsbalken -->
			{#if gestelltSumme > 0}
				<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
					<div class="flex h-full">
						<div class="bg-green-500 transition-all duration-500" style="width: {bezahltPct}%"></div>
						<div class="bg-yellow-400 transition-all duration-500" style="width: {offenPct}%"></div>
					</div>
				</div>
				<div class="mt-1 flex gap-4 text-xs text-gray-500">
					<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>Bezahlt</span>
					{#if offenSumme > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-yellow-400"></span>Offen</span>{/if}
					{#if ausstehendSumme > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-gray-200"></span>Ausstehend</span>{/if}
				</div>
			{/if}
		{/if}
	</div>

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
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Beschreibung</th>
							<th class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Datum</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Notiz</th>
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
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Typ</th>
							<th class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Betrag</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Rg.-Nr.</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fällig</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
							<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Bezahlt am</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each rechnung.abschlaege as abschlag}
							{@const badge = statusBadge(abschlag)}
							{@const effStatus = abschlagEffektivStatus(abschlag)}
							<tr class="hover:bg-gray-50">
								<td class="px-3 py-3 text-sm text-gray-500">{abschlag.nummer}</td>
								<td class="px-3 py-3 text-sm font-medium text-gray-800">{typLabel(abschlag.typ)}</td>
								<td class="px-3 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">{formatCents(abschlag.rechnungsbetrag)}</td>
								<td class="px-3 py-3 text-sm text-gray-500">{abschlag.rechnungsnummer ?? '—'}</td>
								<td class="px-3 py-3 text-sm {effStatus === 'ueberfaellig' ? 'font-medium text-red-600' : effStatus === 'bald_faellig' ? 'font-medium text-amber-600' : 'text-gray-500'}">
									{abschlag.faelligkeitsdatum ? formatDatum(abschlag.faelligkeitsdatum) : '—'}
									{#if abschlag.faelligkeitsdatum && (effStatus === 'offen' || effStatus === 'bald_faellig')}
										{@const tage = Math.ceil((new Date(abschlag.faelligkeitsdatum).getTime() - Date.now()) / 86400000)}
										<span class="block text-xs {effStatus === 'bald_faellig' ? 'text-amber-500 font-medium' : 'text-gray-400'}">
											in {tage} {tage === 1 ? 'Tag' : 'Tagen'}
										</span>
									{/if}
								</td>
								<td class="px-3 py-3">
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {badge.cls}">{badge.label}</span>
								</td>
								<td class="px-3 py-3 text-sm text-gray-500">
									{abschlag.bezahltam ? formatDatum(abschlag.bezahltam) : '—'}
									{#if abschlag.buchungId}
										<a href="/buchungen/{abschlag.buchungId}" class="ml-1 text-xs text-blue-500 hover:underline">Buchung</a>
									{/if}
								</td>
								<td class="px-3 py-3">
									<div class="flex items-center gap-2">
										{#if abschlag.beleg}
											<a
												href="/rechnungen/{rechnung.id}/{abschlag.id}/{abschlag.beleg}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-xs text-blue-500 hover:underline"
												title="Beleg öffnen"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
</div>
