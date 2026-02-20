<script lang="ts">
	import { formatCents, formatDatum } from '$lib/format';
	import Charts from '$lib/components/Charts.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const verbleibend = $derived(data.gesamtBudget - data.gesamtIst);
	const prozent = $derived(data.gesamtBudget > 0 ? Math.round((data.gesamtIst / data.gesamtBudget) * 100) : 0);
	const topRaum = $derived([...data.raumSummaries].sort((a, b) => b.ist - a.ist)[0] ?? null);
	const warnungen = $derived(data.gewerkSummaries.filter((s) => !s.gewerk.pauschal && s.budget > 0 && s.ist / s.budget >= 0.8));
	const restMonate = $derived(
		data.avgProMonat > 0 && verbleibend > 0
			? Math.round(verbleibend / data.avgProMonat)
			: null
	);
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
		Dashboard
	</h1>

	<!-- KPIs -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
		<div class="kpi-card border-l-4 border-l-blue-500">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
				Gesamtbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtBudget)}</div>
		</div>
		<div class="kpi-card border-l-4 border-l-orange-400">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
				Ausgaben
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtIst)}</div>
		</div>
		<div class="kpi-card border-l-4 {verbleibend < 0 ? 'border-l-red-500' : 'border-l-green-500'}">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>
				Verbleibend
			</div>
			<div class="text-xl font-bold font-mono mt-1" class:text-red-600={verbleibend < 0}>{formatCents(verbleibend)}</div>
		</div>
		<div class="kpi-card border-l-4 border-l-gray-300">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
				Verbraucht
			</div>
			<div class="text-xl font-bold mt-1">{prozent}%</div>
			<div class="mt-2 w-full bg-gray-200 rounded-full h-2">
				<div
					class="h-2 rounded-full transition-all duration-500 {prozent > 100 ? 'bg-red-500' : prozent >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}"
					style="width: {Math.min(prozent, 100)}%"
				></div>
			</div>
		</div>
		{#if topRaum}
			<a href="/buchungen?raum={topRaum.raum.id}" class="kpi-card border-l-4 border-l-purple-400 hover:bg-gray-50 transition-colors">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
					Top Raum
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(topRaum.ist)}</div>
				<div class="text-xs text-gray-400 mt-1">{topRaum.raum.name} ({topRaum.raum.geschoss})</div>
			</a>
		{/if}
		{#if data.ausstehendBetrag > 0}
			<a href="/rechnungen" class="kpi-card border-l-4 {data.hatUeberfaellige ? 'border-l-red-500' : 'border-l-orange-400'} hover:bg-gray-50 transition-colors">
				<div class="flex items-center gap-1.5 text-xs font-medium {data.hatUeberfaellige ? 'text-red-600' : 'text-orange-600'} uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
					{data.hatUeberfaellige ? 'Überfällig' : 'Ausstehend'}
				</div>
				<div class="text-xl font-bold font-mono mt-1 {data.hatUeberfaellige ? 'text-red-600' : 'text-orange-700'}">{formatCents(data.ausstehendBetrag)}</div>
				<div class="text-xs text-gray-400 mt-1">{data.ausstehendRechnungen} {data.ausstehendRechnungen === 1 ? 'Rechnung' : 'Rechnungen'}</div>
			</a>
		{/if}
		{#if data.anzahlMonate > 0}
			<div class="kpi-card border-l-4 border-l-teal-500">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>
					Burn Rate
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.avgProMonat)}<span class="text-sm font-normal text-gray-400"> / Mo.</span></div>
				{#if restMonate !== null && data.gesamtBudget > 0}
					<div class="text-xs text-gray-400 mt-1">~{restMonate} Monate Budget</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Budget-Warnungen -->
	{#if warnungen.length > 0}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
			<div class="flex items-center gap-1.5 text-sm font-medium text-yellow-800 mb-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
				Budget-Warnungen
			</div>
			<div class="flex flex-wrap gap-2">
				{#each warnungen as s}
					{@const pct = Math.round((s.ist / s.budget) * 100)}
					<a href="/budget" class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors {s.ist > s.budget ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}">
						{s.gewerk.name}: {pct}%
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Charts -->
	{#if data.gesamtIst > 0}
		<Charts summaries={data.gewerkSummaries} />
	{/if}

	<!-- Letzte Buchungen -->
	<div class="card">
		<div class="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
			<h2 class="text-sm font-semibold text-gray-700">Letzte Buchungen</h2>
			<a href="/buchungen" class="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline">
				Alle anzeigen
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
			</a>
		</div>
		{#if data.letzteBuchungen.length > 0}
			<table class="w-full">
				<tbody>
					{#each data.letzteBuchungen as buchung (buchung.id)}
						<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
							<td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDatum(buchung.datum)}</td>
							<td class="px-4 py-3 text-sm">{buchung.beschreibung}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(buchung.betrag)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="px-4 py-12 text-center text-gray-400 text-sm">
				<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
				Noch keine Buchungen vorhanden
			</div>
		{/if}
	</div>

	<!-- Gewerk-Uebersicht -->
	{#if data.gewerkSummaries.some((s) => s.ist > 0)}
		<div class="card">
			<h2 class="text-sm font-semibold text-gray-700 px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">Gewerke-Uebersicht</h2>
			<div class="divide-y">
				{#each data.gewerkSummaries.filter((s) => s.ist > 0) as s (s.gewerk.id)}
					{@const pct = s.budget > 0 ? Math.round((s.ist / s.budget) * 100) : 0}
					<a href="/buchungen?gewerk={s.gewerk.id}" class="block px-4 py-3 hover:bg-gray-50/50 transition-colors">
						<div class="flex items-center justify-between mb-1.5">
							<div class="flex items-center gap-2 text-sm font-medium">
								<div class="w-3 h-3 rounded-full" style="background-color: {s.gewerk.farbe}"></div>
								{s.gewerk.name}
							</div>
							<div class="text-sm font-mono tabular-nums text-gray-600">{formatCents(s.ist)} <span class="text-gray-400">/</span> {formatCents(s.budget)}</div>
						</div>
						{#if s.budget > 0}
							<div class="w-full bg-gray-200 rounded-full h-1.5">
								<div
									class="h-1.5 rounded-full transition-all duration-500 {pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}"
									style="width: {Math.min(pct, 100)}%"
								></div>
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
