<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
	import type { PageData } from './$types';
	import { formatCents } from '$lib/format';

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
							callback: (v) => `${(v as number).toLocaleString('de-DE')} €`
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

	{#if data.keineDaten}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
			</svg>
			Noch keine Buchungen vorhanden – Prognose wird nach der ersten Buchung berechnet.
		</div>
	{:else}
		<!-- Konfidenz-Banner -->
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
					<span class="font-semibold">Lineare Fortschreibung der Burn Rate</span> ({data.anzahlMonate} Monate / {data.anzahlBuchungen} Buchungen).
					Renovierungskosten schwanken stark – diese Prognose ist eine grobe Orientierung.
				</div>
			</div>
		{:else}
			<div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex gap-3">
				<svg class="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div class="text-sm text-green-800">
					<span class="font-semibold">Gute Datenbasis</span> ({data.anzahlMonate} Monate / {data.anzahlBuchungen} Buchungen).
					Prognose basiert auf linearer Burn-Rate-Fortschreibung.
				</div>
			</div>
		{/if}

		<!-- KPI-Karten -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="kpi-card border-l-4 border-l-teal-500">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
					</svg>
					Ø Burn Rate
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.burnRateMonatlich)}<span class="text-sm font-normal text-gray-400"> / Monat</span></div>
				<div class="text-xs text-gray-400 mt-1">Durchschnitt über {data.anzahlMonate} {data.anzahlMonate === 1 ? 'Monat' : 'Monate'}</div>
			</div>

			<div class="kpi-card border-l-4 border-l-orange-400">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Budget-Erschöpfung
				</div>
				{#if data.erschoepfungsDatum && data.restBudget > 0}
					<div class="text-xl font-bold mt-1">{data.erschoepfungsDatum}</div>
					<div class="text-xs text-gray-400 mt-1">in ca. {data.restMonate} {data.restMonate === 1 ? 'Monat' : 'Monaten'}</div>
				{:else if data.restBudget <= 0}
					<div class="text-xl font-bold text-red-600 mt-1">Überschritten</div>
					<div class="text-xs text-red-400 mt-1">Budget bereits überzogen</div>
				{:else}
					<div class="text-xl font-bold text-green-600 mt-1">Im Rahmen</div>
					<div class="text-xs text-gray-400 mt-1">Budget reicht aus</div>
				{/if}
			</div>

			<div class="kpi-card border-l-4 {data.restBudget >= 0 ? 'border-l-green-500' : 'border-l-red-500'}">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
					</svg>
					Restbudget
				</div>
				<div class="text-xl font-bold font-mono mt-1 {data.restBudget < 0 ? 'text-red-600' : ''}">{formatCents(data.restBudget)}</div>
				<div class="text-xs text-gray-400 mt-1">von {formatCents(data.gesamtBudget)} gesamt</div>
				{#if data.gebundeneMittelGesamt > 0}
					{@const nachBindung = data.restBudget - data.gebundeneMittelGesamt}
					<div class="text-xs mt-1 {nachBindung < 0 ? 'text-red-500 font-medium' : 'text-gray-400'}">Nach Bindung: {formatCents(nachBindung)}</div>
				{/if}
			</div>

			{#if data.gebundeneMittelGesamt > 0}
				<div class="kpi-card border-l-4 border-l-orange-400">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
						</svg>
						Gebundene Mittel
					</div>
					<div class="text-xl font-bold font-mono mt-1 text-orange-600">{formatCents(data.gebundeneMittelGesamt)}</div>
					<a href="/rechnungen" class="text-xs text-orange-500 hover:underline mt-1 block">Offene Rechnungen ansehen</a>
				</div>
			{/if}

			<div class="kpi-card border-l-4 border-l-blue-400">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
					</svg>
					Bisher ausgegeben
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtIst)}</div>
				<div class="text-xs text-gray-400 mt-1">{data.gesamtBudget > 0 ? Math.round((data.gesamtIst / data.gesamtBudget) * 100) : 0}% des Budgets</div>
			</div>
		</div>

		<!-- Chart: Ausgabenverlauf mit Prognose -->
		<div class="card p-4">
			<h2 class="text-sm font-semibold text-gray-700 mb-4">Ausgabenverlauf &amp; Prognose</h2>
			<canvas bind:this={chartCanvas}></canvas>
			<div class="mt-3 text-xs text-gray-400 text-center">
				Blaue Linie: tatsächliche Ausgaben &middot; Orange gestrichelt: Prognose bei aktueller Burn Rate &middot; Rot gestrichelt: Gesamtbudget
			</div>
		</div>

		<!-- Gewerk-Prognose-Tabelle -->
		<div class="card overflow-x-auto">
			<div class="px-4 py-3 border-b bg-gray-50/80 rounded-t-lg">
				<h2 class="text-sm font-semibold text-gray-700">Prognose nach Gewerk</h2>
				<p class="text-xs text-gray-400 mt-0.5">Hochrechnung basiert auf dem bisherigen Kostenanteil jedes Gewerks am Gesamtprojekt.</p>
			</div>
			<table class="w-full">
				<thead>
					<tr class="thead-row">
						<th class="px-4 py-3 text-left">Gewerk</th>
						<th class="px-4 py-3 text-right">Budget</th>
						<th class="px-4 py-3 text-right">Ist</th>
						<th class="px-4 py-3 text-right">Gebunden</th>
						<th class="px-4 py-3 text-right">% verbraucht</th>
						<th class="px-4 py-3 text-right">Hochrechnung</th>
						<th class="px-4 py-3 text-right">Differenz</th>
						<th class="px-4 py-3 text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.gewerkPrognosen as p (p.gewerk.id)}
						{@const pct = p.budget > 0 ? Math.round((p.ist / p.budget) * 100) : 0}
						<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors {p.ist === 0 ? 'opacity-50' : ''}">
							<td class="px-4 py-3 text-sm">
								<div class="flex items-center gap-2">
									<div class="w-3 h-3 rounded-full shrink-0" style="background-color: {p.gewerk.farbe}"></div>
									<span class="{p.ist === 0 ? 'italic text-gray-400' : 'font-medium'}">{p.gewerk.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-500">
								{p.budget > 0 ? formatCents(p.budget) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">
								{p.ist > 0 ? formatCents(p.ist) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums {p.gebunden > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}">
								{p.gebunden > 0 ? formatCents(p.gebunden) : '—'}
							</td>
							<td class="px-4 py-3 text-sm text-right">
								{#if p.ist > 0 && p.budget > 0}
									<span class="{pct > 100 ? 'text-red-600 font-medium' : pct >= 80 ? 'text-yellow-600 font-medium' : 'text-gray-600'}">{pct}%</span>
								{:else}
									<span class="text-gray-300">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">
								{#if p.hochgerechnet !== null}
									{formatCents(p.hochgerechnet)}
									{#if p.quelle === 'auftrag'}
										<div class="text-xs text-blue-500 font-sans font-normal not-italic">Laut Auftrag</div>
									{/if}
								{:else}
									<span class="text-gray-300 italic text-xs">Keine Daten</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">
								{#if p.differenz !== null}
									<span class="{p.differenz < 0 ? 'text-red-600 font-medium' : 'text-green-600'}">{formatCents(p.differenz)}</span>
								{:else}
									<span class="text-gray-300">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-center">
								{#if p.gewerk.pauschal}
									<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sammelgewerk</span>
								{:else if p.hochgerechnet === null}
									<span class="text-xs text-gray-300">–</span>
								{:else if p.status === 'kritisch'}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
										Kritisch
									</span>
								{:else if p.status === 'warnung'}
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
