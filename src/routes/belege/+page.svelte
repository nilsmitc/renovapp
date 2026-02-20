<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { formatCents, formatDatum } from '$lib/format';

	let { data }: { data: PageData } = $props();

	function isPdf(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}

	function applyFilter(key: string, value: string) {
		const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`/belege?${params.toString()}`);
	}

	const totalBelege = $derived(data.eintraege.reduce((s, e) => s + e.belege.length, 0));

	const typLabel: Record<string, string> = {
		buchung: 'Buchung',
		abschlag: 'Abschlag',
		lieferung: 'Lieferung'
	};
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
		Belege
	</h1>

	<!-- Filter -->
	<div class="flex gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
		<select onchange={(e) => applyFilter('gewerk', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Gewerke</option>
			{#each data.gewerke as g}
				<option value={g.id} selected={data.filter.gewerk === g.id}>{g.name}</option>
			{/each}
		</select>
	</div>

	<!-- Karten -->
	{#if data.eintraege.length === 0}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
			Keine Belege vorhanden
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.eintraege as eintrag (eintrag.key)}
				<div class="card p-4">
					<!-- Info -->
					<div class="flex items-start justify-between mb-3">
						<div>
							<div class="font-medium text-gray-900">{eintrag.beschreibung}</div>
							<div class="text-sm text-gray-500 mt-0.5">
								{eintrag.datum ? formatDatum(eintrag.datum) : '—'} &middot; {eintrag.gewerkName} &middot; <span class="font-mono tabular-nums">{formatCents(eintrag.betrag)}</span>
							</div>
						</div>
						<div class="flex items-center gap-2 shrink-0 ml-4">
							<span class="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
								{typLabel[eintrag.typ]}
							</span>
							<a href={eintrag.editHref} class="text-blue-600 hover:underline text-sm font-medium">
								{eintrag.typ === 'buchung' ? 'Bearbeiten' : 'Öffnen'}
							</a>
						</div>
					</div>

					<!-- Belege -->
					<div class="flex flex-wrap gap-2">
						{#each eintrag.belege as beleg}
							<a href={beleg.href} target="_blank" rel="noopener noreferrer"
								class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm hover:bg-gray-100 hover:border-gray-300 transition-all">
								{#if isPdf(beleg.dateiname)}
									<svg class="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
									</svg>
								{:else}
									<svg class="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
									</svg>
								{/if}
								<span class="text-blue-600 hover:underline">{beleg.dateiname}</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.eintraege.length > 0}
		<div class="text-sm text-gray-500 text-right">
			{data.eintraege.length} {data.eintraege.length === 1 ? 'Eintrag' : 'Einträge'} mit {totalBelege} {totalBelege === 1 ? 'Beleg' : 'Belegen'}
		</div>
	{/if}
</div>
