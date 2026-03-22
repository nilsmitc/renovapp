<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
	import type { PageData } from './$types';
	import { formatCents, formatDatum } from '$lib/format';

	Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

	let { data }: { data: PageData } = $props();

	let chartCanvas: HTMLCanvasElement;

	onMount(() => {
		if (data.keineDaten || data.chartLabels.length === 0) return;

		const chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels: data.chartLabels,
				datasets: [
					{
						label: 'Ausgaben (Ist)',
						data: data.chartIst.map((v) => (v !== null ? v / 100 : null)),
						borderColor: '#3B82F6',
						backgroundColor: '#3B82F6',
						tension: 0.2,
						fill: false,
						pointRadius: 4,
						spanGaps: false
					},
					{
						label: 'Prognose',
						data: data.chartPrognose.map((v) => (v !== null ? v / 100 : null)),
						borderColor: '#F97316',
						backgroundColor: '#F97316',
						borderDash: [6, 4],
						tension: 0.2,
						fill: false,
						pointRadius: 3,
						spanGaps: false
					},
					{
						label: 'Gesamtbudget',
						data: data.chartBudget.map((v) => v / 100),
						borderColor: '#EF4444',
						backgroundColor: 'transparent',
						borderDash: [10, 4],
						tension: 0,
						fill: false,
						pointRadius: 0
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: true, position: 'bottom' },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${formatCents((ctx.raw as number) * 100)}`
						}
					}
				},
				scales: {
					y: {
						ticks: {
							callback: (v) => `${(v as number).toLocaleString('de-DE')} \u20AC`
						}
					}
				}
			}
		});

		return () => chart.destroy();
	});
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
		</svg>
		Prognose
	</h1>

	<!-- Konfidenz-Banner -->
	{#if !data.keineDaten}
		{#if data.konfidenz === 'niedrig'}
			<div class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex gap-3">
				<svg class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
				</svg>
				<div class="text-sm text-yellow-800">
					<span class="font-semibold">Geringe Datenbasis:</span> Die Prognose basiert auf {data.anzahlMonate} {data.anzahlMonate === 1 ? 'Monat' : 'Monaten'} mit {data.anzahlBuchungen} Buchungen.
					Renovierungskosten sind nicht linear – die Genauigkeit steigt mit mehr Daten.
				</div>
			</div>
		{:else if data.konfidenz === 'mittel'}
			<div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3">
				<svg class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
				</svg>
				<div class="text-sm text-blue-800">
					<span class="font-semibold">Moderate Datenbasis</span> ({data.anzahlMonate} Monate / {data.anzahlBuchungen} Buchungen).
					Prognose basiert auf Burn-Rate der letzten 3 Monate.
				</div>
			</div>
		{:else}
			<div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex gap-3">
				<svg class="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div class="text-sm text-green-800">
					<span class="font-semibold">Gute Datenbasis</span> ({data.anzahlMonate} Monate / {data.anzahlBuchungen} Buchungen).
					Prognose basiert auf Burn-Rate der letzten 3 Monate.
				</div>
			</div>
		{/if}
	{/if}

	<!-- KPI-Karten Reihe 1: Budget-Überblick -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
		<!-- Gesamtbudget -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
				</svg>
				Gesamtbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(data.gesamtBudget)}</div>
		</div>

		<!-- Bezahlt -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
				</svg>
				Bezahlt
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(data.gesamtIst)}</div>
			<div class="text-xs text-gray-400 mt-1">{data.gesamtBudget > 0 ? Math.round((data.gesamtIst / data.gesamtBudget) * 100) : 0}% des Budgets</div>
		</div>

		<!-- Frei verfügbar -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
				</svg>
				Frei verfügbar
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value {data.freiVerfuegbar < 0 ? 'text-red-600' : ''}">{formatCents(data.freiVerfuegbar)}</div>
			<div class="text-xs text-gray-400 mt-1">Budget abzgl. aller Kosten</div>
		</div>

		<!-- Budget-Erschöpfung -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Budget-Erschöpfung
			</div>
			{#if data.erschoepfungsDatum && data.restBudget > 0}
				<div class="text-xl font-bold mt-1 kpi-value">{data.erschoepfungsDatum}</div>
				<div class="text-xs text-gray-400 mt-1">in ca. {data.restMonate} {data.restMonate === 1 ? 'Monat' : 'Monaten'}</div>
				{#if data.bekannteZahlungenGesamt > 0}
					<div class="mt-1 text-xs text-blue-500">inkl. {formatCents(data.bekannteZahlungenGesamt)} geplanter Abschläge</div>
				{/if}
			{:else if data.restBudget <= 0}
				<div class="text-xl font-bold text-red-600 mt-1 kpi-value">Überschritten</div>
				<div class="text-xs text-red-400 mt-1">Budget bereits überzogen</div>
			{:else if data.keineDaten}
				<div class="text-sm text-gray-400 mt-1">Noch keine Daten</div>
			{:else}
				<div class="text-xl font-bold text-green-600 mt-1 kpi-value">Im Rahmen</div>
				<div class="text-xs text-gray-400 mt-1">Budget reicht laut Prognose</div>
			{/if}
		</div>
	</div>

	<!-- KPI-Karten Reihe 2: Geplante Ausgaben -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
		<!-- Ø Burn Rate -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
				</svg>
				Ø Burn Rate
			</div>
			{#if data.burnRateMonatlich > 0}
				<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(data.burnRateMonatlich)}<span class="text-sm font-normal text-gray-400"> / Monat</span></div>
				<div class="text-xs text-gray-400 mt-1">Ø letzte {data.burnRateBasis} {data.burnRateBasis === 1 ? 'Monat' : 'Monate'}{#if data.teilmonatAusgaben > 0} · lfd. Monat: {formatCents(data.teilmonatAusgaben)}{/if}</div>
			{:else}
				<div class="text-sm text-gray-400 mt-1">Noch keine Daten</div>
			{/if}
		</div>

		<!-- Offene Rechnungen -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
				</svg>
				Offene Rechnungen
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value {data.gesamtOffen > 0 ? 'text-orange-600' : ''}">{formatCents(data.gesamtOffen)}</div>
			{#if data.gesamtOffen > 0}
				<a href="/rechnungen" class="text-xs text-orange-500 hover:underline mt-1 block">Aufträge ansehen</a>
			{:else}
				<div class="text-xs text-gray-400 mt-1">Keine offenen Abschläge</div>
			{/if}
		</div>

		<!-- Restauftrag -->
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H6m12 10.5H6a2.25 2.25 0 01-2.25-2.25V6.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V9.75M12 12.75h.008v.008H12v-.008z" />
				</svg>
				Restauftrag
			</div>
			<div class="text-xl font-bold font-mono mt-1 kpi-value {data.gesamtRestauftrag > 0 ? 'text-violet-600' : ''}">{formatCents(data.gesamtRestauftrag)}</div>
			<div class="text-xs text-gray-400 mt-1">Vertraglich gebunden, nicht fakturiert</div>
		</div>

	</div>

	<!-- Chart: Ausgabenverlauf mit Prognose -->
	{#if data.keineDaten}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
			</svg>
			Noch keine Buchungen vorhanden – Verlaufskurve wird nach der ersten Buchung angezeigt.
		</div>
	{:else}
		<div class="card p-4">
			<h2 class="text-sm font-semibold text-gray-700 mb-4">Ausgabenverlauf &amp; Prognose</h2>
			<canvas bind:this={chartCanvas}></canvas>
			<div class="mt-3 text-xs text-gray-400 text-center">
				Blaue Linie: tatsächliche Ausgaben &middot; Orange gestrichelt: Prognose bei aktueller Burn Rate &middot; Rot gestrichelt: Gesamtbudget
			</div>
		</div>
	{/if}

	<!-- Nächste Zahlungen -->
	{#if data.naechsteZahlungen.length > 0}
		<div class="card overflow-x-auto">
			<div class="px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
				<h2 class="text-sm font-semibold text-gray-700">Nächste Zahlungen</h2>
				<p class="text-xs text-gray-400 mt-0.5">Offene Rechnungen chronologisch nach Fälligkeit</p>
			</div>
			<table class="w-full">
				<thead>
					<tr class="thead-row">
						<th class="px-4 py-3 text-left">Fällig am</th>
						<th class="px-4 py-3 text-left">Auftragnehmer</th>
						<th class="px-4 py-3 text-left">Typ</th>
						<th class="px-4 py-3 text-right">Betrag</th>
						<th class="px-4 py-3 text-left">Gewerk</th>
					</tr>
				</thead>
				<tbody>
					{#each data.naechsteZahlungen as z (z.rechnungId + '-' + z.nummer)}
						<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors {z.effektivStatus === 'ueberfaellig' ? 'bg-red-50/50' : z.effektivStatus === 'bald_faellig' ? 'bg-amber-50/50' : ''}">
							<td class="px-4 py-3 text-sm">
								{#if z.faelligkeitsdatum}
									<div>{formatDatum(z.faelligkeitsdatum)}</div>
									{#if z.tageVerbleibend !== null}
										{#if z.tageVerbleibend < 0}
											<div class="text-xs text-red-600 font-medium">überfällig seit {Math.abs(z.tageVerbleibend)} Tagen</div>
										{:else if z.tageVerbleibend === 0}
											<div class="text-xs text-red-600 font-medium">heute fällig</div>
										{:else if z.tageVerbleibend <= 7}
											<div class="text-xs text-amber-600 font-medium">in {z.tageVerbleibend} Tagen</div>
										{:else}
											<div class="text-xs text-gray-400">in {z.tageVerbleibend} Tagen</div>
										{/if}
									{/if}
								{:else}
									<span class="text-gray-400 text-xs italic">Kein Datum</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm">
								<a href="/rechnungen/{z.rechnungId}" class="text-blue-600 hover:underline font-medium">{z.auftragnehmer}</a>
							</td>
							<td class="px-4 py-3 text-sm text-gray-600">
								{z.typ} #{z.nummer}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums font-medium">
								{formatCents(z.betrag)}
							</td>
							<td class="px-4 py-3 text-sm">
								<div class="flex items-center gap-1.5">
									<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {z.gewerkFarbe}"></div>
									<span class="text-gray-600">{z.gewerkName}</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Gewerk-Übersicht -->
	{#if data.gewerkUebersicht.length > 0}
		<div class="card overflow-x-auto">
			<div class="px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
				<h2 class="text-sm font-semibold text-gray-700">Übersicht nach Gewerk</h2>
				<p class="text-xs text-gray-400 mt-0.5">Budget · Bezahlt · Offene Rechnungen · Restauftrag · Frei = was wirklich übrig ist</p>
			</div>
			<table class="w-full">
				<thead>
					<tr class="thead-row">
						<th class="px-4 py-3 text-left">Gewerk</th>
						<th class="px-4 py-3 text-right">Budget</th>
						<th class="px-4 py-3 text-right">Bezahlt</th>
						<th class="px-4 py-3 text-right">Offen</th>
						<th class="px-4 py-3 text-right">Restauftrag</th>
						<th class="px-4 py-3 text-right">Frei</th>
						<th class="px-4 py-3 text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.gewerkUebersicht as g (g.gewerk.id)}
						{@const hatWerte = g.ist > 0 || g.offen > 0 || g.restauftrag > 0}
						<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors {!hatWerte && g.budget === 0 ? 'opacity-40' : ''}">
							<td class="px-4 py-3 text-sm">
								<div class="flex items-center gap-2">
									<div class="w-3 h-3 rounded-full shrink-0" style="background-color: {g.gewerk.farbe}"></div>
									<span class="{hatWerte || g.budget > 0 ? 'font-medium' : 'italic text-gray-400'}">{g.gewerk.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-500">
								{g.budget > 0 ? formatCents(g.budget) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">
								{g.ist > 0 ? formatCents(g.ist) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums {g.offen > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}">
								{g.offen > 0 ? formatCents(g.offen) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums {g.restauftrag > 0 ? 'text-violet-600 font-medium' : 'text-gray-300'}">
								{g.restauftrag > 0 ? formatCents(g.restauftrag) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">
								{#if g.budget > 0 || hatWerte}
									<span class="{g.frei < 0 ? 'text-red-600 font-medium' : 'text-green-600'}">{formatCents(g.frei)}</span>
								{:else}
									<span class="text-gray-300">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-center">
								{#if g.gewerk.pauschal}
									<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sammelgewerk</span>
								{:else if !hatWerte && g.budget === 0}
									<span class="text-xs text-gray-300">–</span>
								{:else if g.status === 'kritisch'}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
										Kritisch
									</span>
								{:else if g.status === 'warnung'}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
										Warnung
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
										Im Rahmen
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
