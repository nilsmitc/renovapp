<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let zeigeFormular = $state(false);
	let formError = $state('');

	const gesamtLieferanten = $derived(data.stats.length);
	const gesamtLieferungen = $derived(
		data.stats.reduce((s, { anzahlLieferungen }) => s + anzahlLieferungen, 0)
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
			</svg>
			<h1 class="text-2xl font-bold text-gray-900">Lieferanten</h1>
		</div>
		<button
			onclick={() => (zeigeFormular = !zeigeFormular)}
			class="btn-primary flex items-center gap-2"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			Neuer Lieferant
		</button>
	</div>

	{#if zeigeFormular}
		<div class="card">
			<h2 class="mb-4 text-lg font-semibold text-gray-800">Neuen Lieferanten anlegen</h2>
			{#if formError}
				<div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
			{/if}
			<form
				method="POST"
				action="?/anlegen"
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
					<label class="mb-1 block text-sm font-medium text-gray-700" for="name">Name *</label>
					<input
						type="text"
						name="name"
						id="name"
						required
						placeholder="z.B. Hornbach, Bauhaus, OBI"
						class="input-base"
					/>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="notiz">Notiz</label>
					<input
						type="text"
						name="notiz"
						id="notiz"
						placeholder="Kundennummer, Ansprechpartner, ..."
						class="input-base"
					/>
				</div>

				<div class="flex gap-3 md:col-span-2">
					<button type="submit" class="btn-primary">Lieferant anlegen</button>
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

	{#if data.stats.length === 0}
		<div class="card py-12 text-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
			</svg>
			<p class="mt-3 text-gray-500">Noch keine Lieferanten angelegt</p>
			<button onclick={() => (zeigeFormular = true)} class="btn-primary mt-4">Ersten Lieferanten anlegen</button>
		</div>
	{:else}
		<!-- KPI-Zeile -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="kpi-card border-l-4 border-l-blue-500">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
					</svg>
					Materialkosten gesamt
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtAlle)}</div>
				<div class="text-xs text-gray-400 mt-1">bei {gesamtLieferanten} {gesamtLieferanten === 1 ? 'Lieferant' : 'Lieferanten'}</div>
			</div>

			<div class="kpi-card border-l-4 border-l-teal-500">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
					</svg>
					Lieferungen gesamt
				</div>
				<div class="text-xl font-bold font-mono mt-1">{gesamtLieferungen}</div>
				<div class="text-xs text-gray-400 mt-1">Händlerrechnungen erfasst</div>
			</div>

			<div class="kpi-card border-l-4 border-l-violet-400">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
					</svg>
					Lieferanten
				</div>
				<div class="text-xl font-bold font-mono mt-1">{gesamtLieferanten}</div>
				<div class="text-xs text-gray-400 mt-1">aktive {gesamtLieferanten === 1 ? 'Händler' : 'Händler'}</div>
			</div>
		</div>

		<!-- Lieferanten-Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each data.stats as { lieferant, gesamtBetrag, anzahlLieferungen }}
				{@const anteilProzent = data.gesamtAlle > 0 ? Math.round((gesamtBetrag / data.gesamtAlle) * 100) : 0}
				{@const gewerke = data.gewerkePerLieferant[lieferant.id] ?? []}

				<a
					href="/lieferanten/{lieferant.id}"
					class="card p-4 flex flex-col gap-3 hover:border-blue-300 hover:shadow-md transition-all duration-200"
				>
					<!-- Zeile 1: Name + Betrag -->
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="font-semibold text-gray-900">{lieferant.name}</div>
							{#if lieferant.notiz}
								<div class="text-xs text-gray-500 mt-0.5">{lieferant.notiz}</div>
							{/if}
						</div>
						<div class="text-right flex-shrink-0">
							{#if gesamtBetrag > 0}
								<div class="text-lg font-bold font-mono text-gray-900">{formatCents(gesamtBetrag)}</div>
								<div class="text-xs text-gray-400">{anteilProzent}% der Ausgaben</div>
							{:else}
								<div class="text-sm text-gray-400 font-medium">—</div>
							{/if}
						</div>
					</div>

					<!-- Zeile 2: Fortschrittsbalken -->
					{#if data.gesamtAlle > 0}
						<div class="w-full bg-gray-100 rounded-full h-1.5">
							<div
								class="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
								style="width: {anteilProzent}%"
							></div>
						</div>
					{/if}

					<!-- Zeile 3: Badge-Zeile -->
					<div class="flex items-center justify-between gap-2 flex-wrap">
						<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
							{anzahlLieferungen} {anzahlLieferungen === 1 ? 'Lieferung' : 'Lieferungen'}
						</span>
						{#if gewerke.length > 0}
							<div class="flex items-center gap-2 flex-wrap">
								{#each gewerke as gw}
									<div class="flex items-center gap-1">
										<div class="h-2.5 w-2.5 rounded-full flex-shrink-0" style="background-color: {gw.farbe}"></div>
										<span class="text-xs text-gray-500">{gw.name}</span>
									</div>
								{/each}
							</div>
						{:else if anzahlLieferungen > 0}
							<span class="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Kein Gewerk</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
