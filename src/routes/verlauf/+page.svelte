<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
	import type { PageData } from './$types';
	import { formatCents } from '$lib/format';

	Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

	let { data }: { data: PageData } = $props();

	const gesamt = $derived(data.monate.reduce((s, m) => s + m.ausgaben, 0));
	const gesamtAnzahl = $derived(data.monate.reduce((s, m) => s + m.anzahl, 0));

	let chartCanvas: HTMLCanvasElement;
	let kumulativCanvas: HTMLCanvasElement;

	onMount(() => {
		// Aelteste zuerst fuer das Chart (chronologisch)
		const chronologisch = [...data.monate].reverse();

		const chart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: chronologisch.map((m) => m.label),
				datasets: [{
					label: 'Ausgaben',
					data: chronologisch.map((m) => m.ausgaben / 100),
					backgroundColor: '#3B82F6'
				}]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => formatCents((ctx.raw as number) * 100)
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

		const kumulativChart = new Chart(kumulativCanvas, {
			type: 'line',
			data: {
				labels: chronologisch.map((m) => m.label),
				datasets: [{
					label: 'Kumuliert',
					data: chronologisch.map((m) => m.kumuliert / 100),
					borderColor: '#10B981',
					backgroundColor: '#10B981',
					tension: 0.3,
					fill: false,
					pointRadius: 4
				}]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => formatCents((ctx.raw as number) * 100)
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

		return () => {
			chart.destroy();
			kumulativChart.destroy();
		};
	});
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
		Monatsverlauf
	</h1>

	{#if data.monate.length === 0}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
			Noch keine Buchungen vorhanden.
		</div>
	{:else}
		<!-- Chart -->
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Ausgaben pro Monat</h3>
			<canvas bind:this={chartCanvas}></canvas>
		</div>

		<!-- Kumulativer Verlauf -->
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Kumulierte Gesamtausgaben</h3>
			<canvas bind:this={kumulativCanvas}></canvas>
		</div>

		<!-- Tabelle -->
		<div class="card overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="thead-row">
						<th class="px-4 py-3">Monat</th>
						<th class="px-4 py-3 text-right">Buchungen</th>
						<th class="px-4 py-3 text-right">Ausgaben</th>
						<th class="px-4 py-3 text-right">Kumuliert</th>
					</tr>
				</thead>
				<tbody>
					{#each data.monate as m (m.monat)}
						<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
							<td class="px-4 py-3 text-sm">
								<a href="/buchungen?monat={m.monat}" class="font-medium text-blue-600 hover:underline">
									{m.label}
								</a>
								<div class="text-xs text-gray-400 mt-0.5">
									{#if m.material > 0}<span>Material {formatCents(m.material)}</span>{/if}
									{#if m.material > 0 && (m.arbeitslohn > 0 || m.sonstiges > 0)}<span class="mx-1">·</span>{/if}
									{#if m.arbeitslohn > 0}<span>Arbeitslohn {formatCents(m.arbeitslohn)}</span>{/if}
									{#if m.arbeitslohn > 0 && m.sonstiges > 0}<span class="mx-1">·</span>{/if}
									{#if m.sonstiges > 0}<span>Sonstiges {formatCents(m.sonstiges)}</span>{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-sm text-right text-gray-500">{m.anzahl}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(m.ausgaben)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-500">{formatCents(m.kumuliert)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t bg-gray-50 font-medium">
						<td class="px-4 py-3 text-sm">Gesamt</td>
						<td class="px-4 py-3 text-sm text-right text-gray-500">{gesamtAnzahl}</td>
						<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(gesamt)}</td>
						<td class="px-4 py-3"></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
</div>
