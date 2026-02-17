<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { formatCents, formatDatum } from '$lib/format';
	import { KATEGORIEN } from '$lib/domain';

	let { data }: { data: PageData } = $props();

	function gewerkName(id: string): string {
		return data.gewerke.find((g) => g.id === id)?.name ?? id;
	}

	function raumName(id: string | null): string {
		if (!id) return '—';
		if (id.startsWith('@')) return `${id.slice(1)} (Stockwerk)`;
		const r = data.raeume.find((r) => r.id === id);
		return r ? `${r.name} (${r.geschoss})` : id;
	}

	function gewerkFarbe(id: string): string {
		return data.gewerke.find((g) => g.id === id)?.farbe ?? '#9ca3af';
	}

	function applyFilter(key: string, value: string) {
		const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`/buchungen?${params.toString()}`);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
			<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
			Buchungen
		</h1>
		<a href="/buchungen/neu" class="btn-primary inline-flex items-center gap-1.5">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
			Neue Buchung
		</a>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
		<div class="relative flex-1 min-w-48">
			<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
			<input
				type="search"
				placeholder="Suche in Beschreibung & Rechnung..."
				value={data.filter.suche ?? ''}
				oninput={(e) => applyFilter('suche', e.currentTarget.value)}
				class="input-sm w-full pl-8"
			/>
		</div>
		<select onchange={(e) => applyFilter('gewerk', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Gewerke</option>
			{#each data.gewerke as g}
				<option value={g.id} selected={data.filter.gewerk === g.id}>{g.name}</option>
			{/each}
		</select>

		<select onchange={(e) => applyFilter('raum', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Räume</option>
			{#each data.raeume as r}
				<option value={r.id} selected={data.filter.raum === r.id}>{r.name} ({r.geschoss})</option>
			{/each}
		</select>

		<select onchange={(e) => applyFilter('kategorie', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Kategorien</option>
			{#each KATEGORIEN as k}
				<option value={k} selected={data.filter.kategorie === k}>{k}</option>
			{/each}
		</select>
	</div>


	<!-- Table -->
	<div class="card overflow-x-auto">
		<table class="w-full">
			<thead>
				<tr class="thead-row">
					<th class="px-4 py-3">Datum</th>
					<th class="px-4 py-3">Beschreibung</th>
					<th class="px-4 py-3">Gewerk</th>
					<th class="px-4 py-3">Raum</th>
					<th class="px-4 py-3">Kategorie</th>
					<th class="px-4 py-3 text-right">Betrag</th>
					<th class="px-4 py-3 w-24"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.buchungen as buchung (buchung.id)}
					<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
						<td class="px-4 py-3 text-sm whitespace-nowrap">{formatDatum(buchung.datum)}</td>
						<td class="px-4 py-3 text-sm">
							<div class="flex items-center gap-1.5">
								{buchung.beschreibung}
								{#if buchung.belege?.length}
									<a href="/buchungen/{buchung.id}" class="text-gray-400 hover:text-blue-500 transition-colors" title="{buchung.belege.length} Beleg(e)">
										<svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
										{buchung.belege.length}
									</a>
								{/if}
							</div>
							{#if buchung.rechnungsreferenz}
								<div class="text-xs text-gray-400 mt-0.5">{buchung.rechnungsreferenz}</div>
							{/if}
						</td>
						<td class="px-4 py-3 text-sm">
							<div class="flex items-center gap-1.5">
								<div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {gewerkFarbe(buchung.gewerk)}"></div>
								{gewerkName(buchung.gewerk)}
							</div>
						</td>
						<td class="px-4 py-3 text-sm text-gray-600">{raumName(buchung.raum)}</td>
						<td class="px-4 py-3 text-sm text-gray-600">{buchung.kategorie}</td>
						<td class="px-4 py-3 text-sm text-right font-mono tabular-nums {buchung.betrag < 0 ? 'text-red-600' : ''}">
							{formatCents(buchung.betrag)}
							{#if buchung.betrag < 0}
								<span class="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Rückbuchung</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-sm text-right">
							<a href="/buchungen/{buchung.id}" class="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
								Bearbeiten
							</a>
						</td>
					</tr>
				{/each}
				{#if data.buchungen.length === 0}
					<tr><td colspan="7" class="px-4 py-12 text-center text-gray-400 text-sm">
					<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
					Keine Buchungen gefunden
				</td></tr>
				{/if}
			</tbody>
		</table>
	</div>

	{#if data.buchungen.length > 0}
		<div class="text-sm text-gray-500 text-right">
			{data.buchungen.length} Buchungen, Summe: <span class="font-mono tabular-nums font-medium">{formatCents(data.buchungen.reduce((s, b) => s + b.betrag, 0))}</span>
		</div>
	{/if}
</div>
