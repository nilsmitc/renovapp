<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatCents, formatDatum } from '$lib/format';
	import { abschlagEffektivStatus, KATEGORIEN } from '$lib/domain';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let zeigeFormular = $state(false);
	let formError = $state('');

	// Filter-State (synchronisiert mit URL-Params)
	let suche = $state(data.sucheFilter);
	let statusFilter = $state(data.statusFilter);
	let gewerkFilterLocal = $state(data.gewerkFilter || '');
	let sortierung = $state(data.sortierung);

	function applyFilters() {
		const params = new URLSearchParams();
		if (suche) params.set('suche', suche);
		if (statusFilter && statusFilter !== 'alle') params.set('status', statusFilter);
		if (gewerkFilterLocal) params.set('gewerk', gewerkFilterLocal);
		if (sortierung && sortierung !== 'gewerk') params.set('sortierung', sortierung);
		goto(`/rechnungen?${params.toString()}`, { replaceState: true });
	}

	// Rechnungen nach Gewerk gruppieren (für Gewerk-Sortierung)
	const rechnungenNachGewerk = $derived.by(() => {
		const map = new Map<string, typeof data.rechnungen>();
		for (const g of data.gewerke) {
			const r = data.rechnungen.filter((r) => r.gewerk === g.id);
			if (r.length > 0) map.set(g.id, r);
		}
		const ohneGewerk = data.rechnungen.filter(
			(r) => !data.gewerke.find((g) => g.id === r.gewerk)
		);
		if (ohneGewerk.length > 0) map.set('__unbekannt__', ohneGewerk);
		return map;
	});

	// Flat-Liste sortiert (für Volumen-/Fälligkeits-Sortierung)
	const rechnungenSortiert = $derived.by(() => {
		const arr = [...data.rechnungen];
		if (data.sortierung === 'volumen') {
			arr.sort((a, b) => rechnungBasis(b) - rechnungBasis(a));
		} else if (data.sortierung === 'faelligkeit') {
			arr.sort((a, b) => {
				const aNext = naechsteFaelligkeit(a);
				const bNext = naechsteFaelligkeit(b);
				// Überfällige zuerst, dann nach Datum, dann ohne Fälligkeit am Ende
				if (!aNext && !bNext) return 0;
				if (!aNext) return 1;
				if (!bNext) return -1;
				return aNext.localeCompare(bNext);
			});
		}
		return arr;
	});

	function rechnungSumme(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function rechnungBasis(rechnung: (typeof data.rechnungen)[0]) {
		const nachtraege = rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0);
		return rechnung.auftragssumme !== undefined
			? rechnung.auftragssumme + nachtraege
			: rechnungSumme(rechnung);
	}

	function rechnungBezahlt(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege
			.filter((a) => a.status === 'bezahlt')
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function rechnungOffen(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege
			.filter((a) => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			})
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function rechnungAusstehend(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege
			.filter((a) => a.status === 'ausstehend')
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function hatUeberfaellige(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');
	}

	function naechsteFaelligkeit(rechnung: (typeof data.rechnungen)[0]): string | null {
		const offene = rechnung.abschlaege
			.filter(a => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			})
			.filter(a => a.faelligkeitsdatum)
			.sort((a, b) => (a.faelligkeitsdatum ?? '').localeCompare(b.faelligkeitsdatum ?? ''));
		return offene[0]?.faelligkeitsdatum ?? null;
	}

	function countdownInfo(rechnung: (typeof data.rechnungen)[0]): { text: string; cls: string } | null {
		const heute = new Date().toISOString().slice(0, 10);
		const offene = rechnung.abschlaege
			.filter(a => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig' || s === 'bald_faellig';
			})
			.filter(a => a.faelligkeitsdatum)
			.sort((a, b) => (a.faelligkeitsdatum ?? '').localeCompare(b.faelligkeitsdatum ?? ''));
		if (offene.length === 0) return null;
		const a = offene[0];
		const diff = Math.round((new Date(a.faelligkeitsdatum!).getTime() - new Date(heute).getTime()) / (1000 * 60 * 60 * 24));
		if (diff < 0) return { text: `${Math.abs(diff)} T. überfällig`, cls: 'bg-red-100 text-red-700' };
		if (diff === 0) return { text: 'Heute fällig', cls: 'bg-red-100 text-red-700' };
		if (diff <= 7) return { text: `in ${diff} Tagen`, cls: 'bg-amber-100 text-amber-700' };
		return null;
	}

	const hatFilter = $derived(suche || statusFilter !== 'alle' || gewerkFilterLocal || sortierung !== 'gewerk');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			<h1 class="text-2xl font-bold text-gray-900">Aufträge</h1>
		</div>
		<button
			onclick={() => (zeigeFormular = !zeigeFormular)}
			class="btn-primary flex items-center gap-2"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			Neuer Auftrag
		</button>
	</div>

	<!-- KPI-Karten -->
	{#if data.anzahlAuftraege > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
					Gesamtvolumen
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtVolumen)}</div>
				<div class="text-xs text-gray-400 mt-1">{data.anzahlAuftraege} {data.anzahlAuftraege === 1 ? 'Auftrag' : 'Aufträge'}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Bezahlt
				</div>
				<div class="text-xl font-bold font-mono mt-1 text-green-600">{formatCents(data.gesamtBezahlt)}</div>
				<div class="text-xs text-gray-400 mt-1">{data.gesamtVolumen > 0 ? Math.round(data.gesamtBezahlt / data.gesamtVolumen * 100) : 0}% des Volumens</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium {data.hatUeberfaellige ? 'text-red-500' : data.hatBaldFaellige ? 'text-amber-500' : 'text-gray-400'} uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Offen
				</div>
				<div class="text-xl font-bold font-mono mt-1 {data.hatUeberfaellige ? 'text-red-600' : data.hatBaldFaellige ? 'text-amber-600' : 'text-orange-500'}">{formatCents(data.gesamtOffen)}</div>
				<div class="text-xs text-gray-400 mt-1">{data.anzahlOffeneAbschlaege} {data.anzahlOffeneAbschlaege === 1 ? 'Abschlag' : 'Abschläge'}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
					Restauftrag
				</div>
				<div class="text-xl font-bold font-mono mt-1 text-violet-600">{formatCents(data.gesamtRestauftrag)}</div>
				<div class="text-xs text-gray-400 mt-1">Noch nicht gestellt</div>
			</div>
		</div>
	{/if}

	<!-- Nächste Zahlungen -->
	{#if data.naechsteZahlungen.length > 0}
		<div class="card animate-in">
			<div class="px-4 py-3 border-b border-gray-100 bg-gray-50/80 rounded-t-xl flex items-center justify-between">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span class="text-sm font-semibold text-gray-700">Nächste Zahlungen</span>
				</div>
				<span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{data.naechsteZahlungen.length}</span>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="thead-row">
						<th class="px-4 py-2 text-left">Fällig</th>
						<th class="px-4 py-2 text-left">Auftragnehmer</th>
						<th class="px-4 py-2 text-left">Gewerk</th>
						<th class="px-4 py-2 text-right">Betrag</th>
						<th class="px-4 py-2 text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.naechsteZahlungen as z}
						{@const isUeberfaellig = z.effektivStatus === 'ueberfaellig'}
						{@const isBaldFaellig = z.effektivStatus === 'bald_faellig'}
						<tr class="border-b border-gray-50 {isUeberfaellig ? 'bg-red-50/50' : isBaldFaellig ? 'bg-amber-50/50' : ''} table-row-hover">
							<td class="px-4 py-2 font-mono text-xs {isUeberfaellig ? 'text-red-700 font-semibold' : isBaldFaellig ? 'text-amber-700 font-semibold' : 'text-gray-600'}">
								{z.faelligkeitsdatum ? formatDatum(z.faelligkeitsdatum) : '—'}
								{#if z.tageVerbleibend !== null}
									<span class="block text-xs {isUeberfaellig ? 'text-red-500' : isBaldFaellig ? 'text-amber-500' : 'text-gray-400'}">
										{#if z.tageVerbleibend < 0}{Math.abs(z.tageVerbleibend)} T. überfällig{:else if z.tageVerbleibend === 0}Heute{:else}in {z.tageVerbleibend} T.{/if}
									</span>
								{/if}
							</td>
							<td class="px-4 py-2">
								<a href="/rechnungen/{z.rechnungId}" class="text-blue-600 hover:underline font-medium">{z.auftragnehmer}</a>
								<span class="text-xs text-gray-400 ml-1">{z.typ} {z.nummer}</span>
							</td>
							<td class="px-4 py-2">
								<span class="inline-flex items-center gap-1.5">
									<span class="w-2.5 h-2.5 rounded-full" style="background-color: {z.gewerkFarbe}"></span>
									<span class="text-xs text-gray-600">{z.gewerkName}</span>
								</span>
							</td>
							<td class="px-4 py-2 text-right font-mono font-semibold tabular-nums {isUeberfaellig ? 'text-red-700' : isBaldFaellig ? 'text-amber-700' : 'text-gray-900'}">
								{formatCents(z.betrag)}
							</td>
							<td class="px-4 py-2 text-center">
								{#if isUeberfaellig}
									<span class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Überfällig</span>
								{:else if isBaldFaellig}
									<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Bald fällig</span>
								{:else}
									<span class="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Offen</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Such- und Filterleiste -->
	{#if data.anzahlAuftraege > 0}
		<div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-3 items-end animate-in">
			<div class="flex-1 min-w-48 relative">
				<svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
				<input
					type="text"
					bind:value={suche}
					oninput={() => applyFilters()}
					placeholder="Auftragnehmer suchen..."
					class="input-sm w-full pl-8"
				/>
			</div>
			<select bind:value={statusFilter} onchange={() => applyFilters()} class="input-sm">
				<option value="alle">Alle Status</option>
				<option value="offen">Offen & Überfällig</option>
				<option value="bezahlt">Bezahlt</option>
				<option value="ohne-abschlaege">Ohne Abschläge</option>
			</select>
			<select bind:value={gewerkFilterLocal} onchange={() => applyFilters()} class="input-sm">
				<option value="">Alle Gewerke</option>
				{#each data.gewerkeInAuftraegen as g}
					<option value={g.id}>{g.name}</option>
				{/each}
			</select>
			<select bind:value={sortierung} onchange={() => applyFilters()} class="input-sm">
				<option value="gewerk">Nach Gewerk</option>
				<option value="volumen">Nach Volumen</option>
				<option value="faelligkeit">Nach Fälligkeit</option>
			</select>
			{#if hatFilter}
				<a href="/rechnungen" class="text-xs text-blue-600 hover:underline whitespace-nowrap">Filter zurücksetzen</a>
			{/if}
		</div>
	{/if}

	<!-- Neuer Auftrag Formular -->
	{#if zeigeFormular}
		<div class="card animate-fade">
			<h2 class="mb-4 text-lg font-semibold text-gray-800">Neuen Auftrag anlegen</h2>
			{#if formError}
				<div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
			{/if}
			<form
				method="POST"
				action="?/erstellen"
				use:enhance={({ formElement }) => {
					formError = '';
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							formError = (result.data?.error as string) ?? 'Fehler';
						} else {
							formElement.reset();
							zeigeFormular = false;
						}
						await update();
					};
				}}
				class="grid grid-cols-1 gap-4 md:grid-cols-2"
			>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="gewerk">Gewerk *</label>
					<select name="gewerk" id="gewerk" required class="input-base">
						<option value="">— Gewerk wählen —</option>
						{#each data.gewerke as g}
							<option value={g.id}>{g.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragnehmer">Auftragnehmer *</label>
					<input
						type="text"
						name="auftragnehmer"
						id="auftragnehmer"
						required
						placeholder="z.B. Elektriker GmbH"
						class="input-base"
					/>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="kategorie">Buchungs-Kategorie *</label>
					<select name="kategorie" id="kategorie" required class="input-base">
						{#each KATEGORIEN as k}
							<option value={k} selected={k === 'Arbeitslohn'}>{k}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500">Wird beim Bezahlen für die Buchung verwendet</p>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragssumme">Auftragssumme (€)</label>
					<input
						type="text"
						name="auftragssumme"
						id="auftragssumme"
						placeholder="z.B. 20.000,00"
						class="input-base"
					/>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragsdatum">Auftragsdatum</label>
					<input type="date" name="auftragsdatum" id="auftragsdatum" class="input-base" />
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="notiz">Notiz</label>
					<input
						type="text"
						name="notiz"
						id="notiz"
						placeholder="Optional"
						class="input-base"
					/>
				</div>

				<div class="flex gap-3 md:col-span-2">
					<button type="submit" class="btn-primary">Auftrag anlegen</button>
					<button
						type="button"
						onclick={() => (zeigeFormular = false)}
						class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Abbrechen
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Aufträge-Liste -->
	{#if data.rechnungen.length === 0 && data.anzahlAuftraege === 0}
		<div class="card py-12 text-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			<p class="mt-3 text-gray-500">Noch keine Aufträge angelegt</p>
			<button onclick={() => (zeigeFormular = true)} class="btn-primary mt-4">Ersten Auftrag anlegen</button>
		</div>
	{:else if data.rechnungen.length === 0}
		<div class="card py-8 text-center">
			<p class="text-gray-500">Keine Aufträge für die aktuelle Filterauswahl</p>
			<a href="/rechnungen" class="text-sm text-blue-600 hover:underline mt-2 inline-block">Filter zurücksetzen</a>
		</div>
	{:else if data.sortierung === 'gewerk'}
		<!-- Gruppiert nach Gewerk -->
		<div class="space-y-4 stagger">
			{#each data.gewerke as gewerk}
				{@const gRechnungen = data.rechnungen.filter((r) => r.gewerk === gewerk.id)}
				{@const agg = data.gewerkAggregate[gewerk.id]}
				{#if gRechnungen.length > 0 && agg}
					<div class="card animate-in">
						<!-- Gewerk-Header mit Stacked Bar -->
						<div class="px-4 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
							<div class="flex items-center justify-between flex-wrap gap-2">
								<div class="flex items-center gap-3">
									<div class="h-3 w-3 rounded-full" style="background-color: {gewerk.farbe}"></div>
									<h2 class="text-base font-semibold text-gray-800">{gewerk.name}</h2>
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										{gRechnungen.length} {gRechnungen.length === 1 ? 'Auftrag' : 'Aufträge'}
									</span>
								</div>
								<div class="flex items-center gap-3 text-xs text-gray-500 font-mono tabular-nums">
									{#if agg.bezahlt > 0}
										<span class="text-green-600">{formatCents(agg.bezahlt)} bezahlt</span>
									{/if}
									{#if agg.offen > 0}
										<span class="text-orange-500">{formatCents(agg.offen)} offen</span>
									{/if}
									{#if agg.volumen > 0}
										<span>/ {formatCents(agg.volumen)}</span>
									{/if}
								</div>
							</div>
							{#if agg.volumen > 0}
								{@const pctBezahlt = (agg.bezahlt / agg.volumen) * 100}
								{@const pctOffen = (agg.offen / agg.volumen) * 100}
								{@const restauftrag = Math.max(0, agg.volumen - agg.gestellt)}
								{@const pctRestauftrag = (restauftrag / agg.volumen) * 100}
								<div class="mt-2 h-2 flex rounded-full bg-gray-100 overflow-hidden">
									{#if pctBezahlt > 0}
										<div class="h-2 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style="width: {pctBezahlt}%"></div>
									{/if}
									{#if pctOffen > 0}
										<div class="h-2 bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-500" style="width: {pctOffen}%"></div>
									{/if}
									{#if pctRestauftrag > 0}
										<div class="h-2 bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500" style="width: {pctRestauftrag}%"></div>
									{/if}
								</div>
							{/if}
						</div>

						<div class="divide-y divide-gray-50">
							{#each gRechnungen as rechnung}
								{@const gestellt = rechnungSumme(rechnung)}
								{@const bezahlt = rechnungBezahlt(rechnung)}
								{@const offen = rechnungOffen(rechnung)}
								{@const ausstehend = rechnungAusstehend(rechnung)}
								{@const ueberfaellig = hatUeberfaellige(rechnung)}
								{@const countdown = countdownInfo(rechnung)}
								<a
									href="/rechnungen/{rechnung.id}"
									class="flex items-center justify-between p-4 transition hover:bg-blue-50/60 table-row-hover"
								>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="font-medium text-gray-900">{rechnung.auftragnehmer}</span>
											{#if bezahlt > 0 && (offen > 0 || ausstehend > 0)}
												<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Teilw. bezahlt</span>
											{:else if bezahlt > 0 && rechnung.abschlaege.length > 0}
												<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bezahlt</span>
											{:else if ueberfaellig}
												<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Überfällig</span>
											{:else if offen > 0}
												<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Offen</span>
											{/if}
											{#if countdown}
												<span class="rounded-full {countdown.cls} px-2 py-0.5 text-xs font-medium">{countdown.text}</span>
											{/if}
										</div>
										<div class="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
											{#if rechnung.auftragssumme}
												{@const nachtraege = rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0)}
												<span>Auftrag: {formatCents(rechnung.auftragssumme + nachtraege)}{#if nachtraege > 0}<span class="text-orange-500"> (+{formatCents(nachtraege)} NT)</span>{/if}</span>
											{/if}
											{#if gestellt > 0}
												<span>Gestellt: {formatCents(gestellt)}</span>
											{/if}
											{#if bezahlt > 0}
												<span class="text-green-600">Bezahlt: {formatCents(bezahlt)}</span>
											{/if}
											{#if offen > 0}
												<span class={ueberfaellig ? 'text-red-600' : 'text-yellow-600'}>Offen: {formatCents(offen)}</span>
											{/if}
											{#if rechnung.abschlaege.length > 0}
												<span>{rechnung.abschlaege.length} {rechnung.abschlaege.length === 1 ? 'Abschlag' : 'Abschläge'}</span>
											{/if}
										</div>

										{#if gestellt > 0}
											{@const base = rechnungBasis(rechnung)}
											{@const bezahltPct = Math.min(100, (bezahlt / base) * 100)}
											{@const offenPct = Math.min(100 - bezahltPct, (offen / base) * 100)}
											<div class="mt-2 flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
												<div class="bg-blue-500 transition-all duration-500" style="width: {bezahltPct}%"></div>
												<div class="bg-orange-400 transition-all duration-500" style="width: {offenPct}%"></div>
											</div>
										{/if}
									</div>
									<svg xmlns="http://www.w3.org/2000/svg" class="ml-4 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
									</svg>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{:else}
		<!-- Flat-Liste (Volumen oder Fälligkeit) -->
		<div class="card animate-in">
			<div class="divide-y divide-gray-50">
				{#each rechnungenSortiert as rechnung}
					{@const gestellt = rechnungSumme(rechnung)}
					{@const bezahlt = rechnungBezahlt(rechnung)}
					{@const offen = rechnungOffen(rechnung)}
					{@const ausstehend = rechnungAusstehend(rechnung)}
					{@const ueberfaellig = hatUeberfaellige(rechnung)}
					{@const countdown = countdownInfo(rechnung)}
					{@const gewerk = data.gewerke.find(g => g.id === rechnung.gewerk)}
					<a
						href="/rechnungen/{rechnung.id}"
						class="flex items-center justify-between p-4 transition hover:bg-blue-50/60 table-row-hover"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="inline-flex items-center gap-1.5">
									<span class="w-2.5 h-2.5 rounded-full" style="background-color: {gewerk?.farbe ?? '#94a3b8'}"></span>
									<span class="text-xs text-gray-500">{gewerk?.name ?? rechnung.gewerk}</span>
								</span>
								<span class="font-medium text-gray-900">{rechnung.auftragnehmer}</span>
								{#if bezahlt > 0 && (offen > 0 || ausstehend > 0)}
									<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Teilw. bezahlt</span>
								{:else if bezahlt > 0 && rechnung.abschlaege.length > 0}
									<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bezahlt</span>
								{:else if ueberfaellig}
									<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Überfällig</span>
								{:else if offen > 0}
									<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Offen</span>
								{/if}
								{#if countdown}
									<span class="rounded-full {countdown.cls} px-2 py-0.5 text-xs font-medium">{countdown.text}</span>
								{/if}
							</div>
							<div class="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
								{#if rechnung.auftragssumme}
									{@const nachtraege = rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0)}
									<span>Auftrag: {formatCents(rechnung.auftragssumme + nachtraege)}{#if nachtraege > 0}<span class="text-orange-500"> (+{formatCents(nachtraege)} NT)</span>{/if}</span>
								{/if}
								{#if bezahlt > 0}
									<span class="text-green-600">Bezahlt: {formatCents(bezahlt)}</span>
								{/if}
								{#if offen > 0}
									<span class={ueberfaellig ? 'text-red-600' : 'text-yellow-600'}>Offen: {formatCents(offen)}</span>
								{/if}
							</div>
							{#if gestellt > 0}
								{@const base = rechnungBasis(rechnung)}
								{@const bezahltPct = Math.min(100, (bezahlt / base) * 100)}
								{@const offenPct = Math.min(100 - bezahltPct, (offen / base) * 100)}
								<div class="mt-2 flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
									<div class="bg-blue-500 transition-all duration-500" style="width: {bezahltPct}%"></div>
									<div class="bg-orange-400 transition-all duration-500" style="width: {offenPct}%"></div>
								</div>
							{/if}
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" class="ml-4 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
