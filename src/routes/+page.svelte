<script lang="ts">
	import { formatCents, formatDatum } from '$lib/format';
	import Charts from '$lib/components/Charts.svelte';
	import VerlaufSection from '$lib/components/VerlaufSection.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const prozent = $derived(data.gesamtBudget > 0 ? Math.round((data.gesamtIst / data.gesamtBudget) * 100) : 0);
	const topRaum = $derived([...data.raumSummaries].sort((a, b) => b.ist - a.ist)[0] ?? null);
	const warnungen = $derived(data.gewerkSummaries.filter((s) => !s.gewerk.pauschal && s.budget > 0 && s.ist / s.budget >= 0.8));
	const naechsteFaelligkeit = $derived(data.naechsteZahlungen[0] ?? null);
	const gesamtBindung = $derived(data.gesamtIst + data.gesamtOffen + data.gesamtRestauftrag);
	const bindungProzent = $derived(data.gesamtBudget > 0 ? Math.round((gesamtBindung / data.gesamtBudget) * 100) : 0);
	const verplant = $derived(data.gesamtOffen + data.gesamtRestauftrag);
	const kpiColor = $derived(
		data.gesamtOffen > 0
			? data.hatUeberfaellige ? 'red' : data.hatBaldFaellige ? 'amber' : 'orange'
			: 'gray'
	);

	function lieferantFuerLieferung(lieferungId: string | undefined): string | null {
		if (!lieferungId) return null;
		const lu = data.lieferungen.find((l) => l.id === lieferungId);
		if (!lu) return null;
		return data.lieferanten.find((l) => l.id === lu.lieferantId)?.name ?? null;
	}
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
		Dashboard
	</h1>

	<!-- KPIs Reihe 1: Budget-Überblick -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
				Gesamtbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(data.gesamtBudget)}</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
				Ausgaben
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(data.gesamtIst)}</div>
			<div class="text-xs text-gray-400 mt-1">{prozent}% des Budgets</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>
				Noch verfügbar
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value" class:text-red-600={data.freiVerfuegbar < 0}>{formatCents(data.freiVerfuegbar)}</div>
			<div class="text-xs text-gray-400 mt-1">abzgl. offener Aufträge & Rücklagen</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
				Budgetverbrauch
			</div>
			<div class="text-xl font-bold mt-1 kpi-value">{prozent}%</div>
			<div class="mt-2 w-full bg-gray-100 rounded-full h-2.5">
				<div
					class="h-2.5 rounded-full {prozent > 100 ? 'progress-bar-red' : prozent >= 80 ? 'progress-bar-yellow' : 'progress-bar'}"
					style="width: {Math.min(prozent, 100)}%"
				></div>
			</div>
		</div>
	</div>

	<!-- KPIs Reihe 2: Status & Tempo -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
		{#if verplant > 0}
		<div class="kpi-card">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
				Fest eingeplant
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(gesamtBindung)}</div>
			<div class="mt-2 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
				<div class="h-2 flex">
					<div class="bg-gradient-to-r from-blue-500 to-blue-400 h-2.5 transition-all duration-700" style="width: {data.gesamtBudget > 0 ? Math.min(data.gesamtIst / data.gesamtBudget * 100, 100) : 0}%"></div>
					<div class="bg-gradient-to-r from-violet-500 to-violet-400 h-2.5 transition-all duration-700" style="width: {data.gesamtBudget > 0 ? Math.min(verplant / data.gesamtBudget * 100, 100 - Math.min(data.gesamtIst / data.gesamtBudget * 100, 100)) : 0}%"></div>
				</div>
			</div>
			<div class="text-xs text-gray-400 mt-1">{formatCents(data.gesamtIst)} ausgegeben + {formatCents(verplant)} in Aufträgen</div>
			<div class="text-xs mt-0.5">
				<span class="{data.freiVerfuegbar < 0 ? 'text-red-600 font-semibold' : 'text-green-600'}">{formatCents(data.freiVerfuegbar)} echt frei</span>
			</div>
		</div>
		{/if}

		<div class="kpi-card">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>
				Kosten pro Monat
			</div>
			{#if data.burnRateMonatlich > 0}
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.burnRateMonatlich)}<span class="text-sm font-normal text-gray-400"> / Mo.</span></div>
				<div class="text-xs text-gray-400 mt-1">
					Ø letzte {data.burnRateBasis} Monate{#if data.restMonate !== null} · reicht noch ~{data.restMonate} Mo.{/if}
				</div>
			{:else}
				<div class="text-xl font-bold mt-1 text-gray-300">—</div>
				<div class="text-xs text-gray-400 mt-1">Noch keine Daten</div>
			{/if}
		</div>

		<a href="/rechnungen" class="kpi-card hover:bg-gray-50/50">
			<div class="flex items-center gap-1.5 text-xs font-medium {kpiColor === 'red' ? 'text-red-600' : kpiColor === 'amber' ? 'text-amber-600' : kpiColor === 'orange' ? 'text-orange-600' : 'text-gray-500'} uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
				{#if kpiColor === 'red'}Überfällig{:else if kpiColor === 'amber'}Bald fällig{:else}Offene Rechnungen{/if}
			</div>
			<div class="text-xl font-bold font-mono mt-1 {kpiColor === 'red' ? 'text-red-600' : kpiColor === 'amber' ? 'text-amber-600' : ''}">{formatCents(data.gesamtOffen)}</div>
			{#if data.gesamtOffen > 0}
				<div class="text-xs text-gray-400 mt-1">{data.ausstehendRechnungen} {data.ausstehendRechnungen === 1 ? 'Auftrag' : 'Aufträge'}</div>
			{:else}
				<div class="text-xs text-green-500 mt-1">Alle bezahlt</div>
			{/if}
		</a>

		{#if naechsteFaelligkeit}
			<a href="/rechnungen/{naechsteFaelligkeit.rechnungId}" class="kpi-card hover:bg-gray-50/50">
				<div class="flex items-center gap-1.5 text-xs font-medium {naechsteFaelligkeit.effektivStatus === 'ueberfaellig' ? 'text-red-600' : 'text-amber-600'} uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Nächste Fälligkeit
				</div>
				{#if naechsteFaelligkeit.faelligkeitsdatum}
					<div class="text-xl font-bold mt-1 {naechsteFaelligkeit.effektivStatus === 'ueberfaellig' ? 'text-red-600' : ''}">{formatDatum(naechsteFaelligkeit.faelligkeitsdatum)}</div>
					<div class="text-xs {naechsteFaelligkeit.effektivStatus === 'ueberfaellig' ? 'text-red-500' : 'text-gray-400'} mt-1">
						{#if naechsteFaelligkeit.tageVerbleibend !== null && naechsteFaelligkeit.tageVerbleibend < 0}{Math.abs(naechsteFaelligkeit.tageVerbleibend)} Tage überfällig{:else if naechsteFaelligkeit.tageVerbleibend === 0}Heute fällig{:else if naechsteFaelligkeit.tageVerbleibend !== null}in {naechsteFaelligkeit.tageVerbleibend} Tagen{/if}
						· {naechsteFaelligkeit.auftragnehmer}
					</div>
				{:else}
					<div class="text-xl font-bold font-mono mt-1">{formatCents(naechsteFaelligkeit.betrag)}</div>
					<div class="text-xs text-gray-400 mt-1">{naechsteFaelligkeit.auftragnehmer}</div>
				{/if}
			</a>
		{:else}
			<div class="kpi-card">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Nächste Fälligkeit
				</div>
				<div class="text-xl font-bold mt-1 text-gray-300">—</div>
				<div class="text-xs text-gray-400 mt-1">Keine anstehend</div>
			</div>
		{/if}

		{#if topRaum}
			<a href="/buchungen?raum={topRaum.raum.id}" class="kpi-card hover:bg-gray-50 transition-colors">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
					Teuerster Raum
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(topRaum.ist)}</div>
				<div class="text-xs text-gray-400 mt-1">{topRaum.raum.name} ({topRaum.raum.geschoss})</div>
			</a>
		{:else}
			<div class="kpi-card">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
					Teuerster Raum
				</div>
				<div class="text-xl font-bold mt-1 text-gray-300">—</div>
				<div class="text-xs text-gray-400 mt-1">Noch keine Raum-Buchungen</div>
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

	<!-- Nächste Zahlungen -->
	{#if data.naechsteZahlungen.length > 0}
		<div class="card">
			<div class="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
				<h2 class="text-sm font-semibold text-gray-700">Nächste Zahlungen</h2>
				<a href="/prognose" class="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline">
					Alle ansehen
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
				</a>
			</div>
			<table class="w-full">
				<tbody>
					{#each data.naechsteZahlungen as z (z.rechnungId + '-' + z.nummer)}
						<tr class="border-b last:border-b-0 {z.effektivStatus === 'ueberfaellig' ? 'bg-red-50/50' : z.effektivStatus === 'bald_faellig' ? 'bg-amber-50/50' : ''} hover:bg-gray-50/50 transition-colors">
							<td class="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">
								{#if z.faelligkeitsdatum}
									{formatDatum(z.faelligkeitsdatum)}
								{:else}
									<span class="text-gray-300">—</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-sm">
								<a href="/rechnungen/{z.rechnungId}" class="hover:text-blue-600 transition-colors">{z.auftragnehmer}</a>
							</td>
							<td class="px-4 py-2.5">
								<div class="flex items-center gap-1.5 text-xs text-gray-500">
									<span class="w-2 h-2 rounded-full shrink-0" style="background-color: {z.gewerkFarbe}"></span>
									{z.gewerkName}
								</div>
							</td>
							<td class="px-4 py-2.5 text-sm text-right font-mono tabular-nums whitespace-nowrap">{formatCents(z.betrag)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
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
							<td class="px-4 py-3 text-sm">
								<div class="flex items-center gap-1.5 flex-wrap">
									{buchung.beschreibung}
									{#if buchung.rechnungId}
										<a href="/rechnungen/{buchung.rechnungId}" class="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
											Auftrag
										</a>
									{/if}
									{#if buchung.lieferungId}
										{@const lName = lieferantFuerLieferung(buchung.lieferungId)}
										{#if lName}
											{@const lu = data.lieferungen.find((l) => l.id === buchung.lieferungId)}
											<a href="/lieferanten/{lu?.lieferantId}" class="inline-flex items-center gap-0.5 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg>
												{lName}
											</a>
										{/if}
									{/if}
								</div>
							</td>
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

	<!-- Gewerke-Übersicht -->
	{#if data.gewerkSummaries.some((s) => s.ist > 0 || s.budget > 0 || (data.offenPerGewerk[s.gewerk.id] ?? 0) > 0 || (data.restauftragPerGewerk[s.gewerk.id] ?? 0) > 0)}
		<div class="card">
			<div class="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
				<h2 class="text-sm font-semibold text-gray-700">Gewerke-Übersicht</h2>
				<div class="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
					<span class="flex items-center gap-1">
						<span class="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
						Bezahlt
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400"></span>
						Offen
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500"></span>
						Restauftrag
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
						Puffer
					</span>
				</div>
			</div>
			<div class="divide-y">
				{#each data.gewerkSummaries.filter((s) => s.ist > 0 || s.budget > 0 || (data.offenPerGewerk[s.gewerk.id] ?? 0) > 0 || (data.restauftragPerGewerk[s.gewerk.id] ?? 0) > 0) as s (s.gewerk.id)}
					{@const offen = data.offenPerGewerk[s.gewerk.id] ?? 0}
					{@const restauftrag = data.restauftragPerGewerk[s.gewerk.id] ?? 0}
					{@const puffer = data.pufferPerGewerk[s.gewerk.id] ?? 0}
					{@const frei = s.budget - s.ist - offen - restauftrag - puffer}
					{@const pctIst = s.budget > 0 ? (s.ist / s.budget) * 100 : 0}
					{@const pctOffen = s.budget > 0 ? (offen / s.budget) * 100 : 0}
					{@const pctRestauftrag = s.budget > 0 ? (restauftrag / s.budget) * 100 : 0}
					{@const pctPuffer = s.budget > 0 ? (puffer / s.budget) * 100 : 0}
					<a href="/buchungen?gewerk={s.gewerk.id}" class="block px-4 py-3 hover:bg-gray-50/50 transition-colors">
						<div class="flex items-center justify-between mb-1.5">
							<div class="flex items-center gap-2 text-sm font-medium">
								<div class="w-3 h-3 rounded-full shrink-0" style="background-color: {s.gewerk.farbe}"></div>
								{s.gewerk.name}
							</div>
							<div class="flex items-center gap-3 text-sm font-mono tabular-nums">
								<span class="text-gray-600">{formatCents(s.ist)} <span class="text-gray-400">/</span> {formatCents(s.budget)}</span>
								{#if s.budget > 0}
									<span class="text-xs {frei < 0 ? 'text-red-600 font-semibold' : 'text-green-600'}">Frei: {formatCents(frei)}</span>
								{/if}
							</div>
						</div>
						{#if s.budget > 0}
							<div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
								<div class="h-2 flex">
									<div class="h-2 transition-all duration-700 bg-gradient-to-r from-blue-500 to-blue-400" style="width: {pctIst}%"></div>
									{#if pctOffen > 0}
										<div class="h-2 transition-all duration-700 bg-gradient-to-r from-orange-400 to-orange-300" style="width: {pctOffen}%"></div>
									{/if}
									{#if pctRestauftrag > 0}
										<div class="h-2 transition-all duration-700 bg-gradient-to-r from-violet-500 to-violet-400" style="width: {pctRestauftrag}%"></div>
									{/if}
									{#if pctPuffer > 0}
										<div class="h-2 transition-all duration-700 bg-gradient-to-r from-amber-400 to-amber-300" style="width: {pctPuffer}%"></div>
									{/if}
								</div>
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Monatsverlauf -->
	{#if data.monate.length > 0}
		<VerlaufSection monate={data.monate} />
	{/if}
</div>
