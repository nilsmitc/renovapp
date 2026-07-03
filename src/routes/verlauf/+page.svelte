<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
	import type { PageData } from './$types';
	import { formatCents } from '$lib/format';
	import { chartColors, type ChartColors } from '$lib/chartTheme';
	import { theme } from '$lib/theme.svelte';

	Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

	let { data }: { data: PageData } = $props();

	const gesamt = $derived(data.tabelle.reduce((s, m) => s + m.ausgaben, 0));
	const gesamtAnzahl = $derived(data.tabelle.reduce((s, m) => s + m.anzahl, 0));

	let chartCanvas: HTMLCanvasElement;
	let kumulativCanvas: HTMLCanvasElement;

	let chart: Chart<'bar'> | null = null;
	let kumulativChart: Chart<'line'> | null = null;

	function tooltipDefaults(c: ChartColors) {
		return { backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText };
	}

	function applyTheme() {
		const c = chartColors();
		if (chart) {
			chart.data.datasets[0].backgroundColor = c.line;
			chart.options.scales!.x!.grid = { color: c.grid };
			chart.options.scales!.x!.ticks = { ...chart.options.scales!.x!.ticks, color: c.tick };
			chart.options.scales!.y!.grid = { color: c.grid };
			chart.options.scales!.y!.ticks = { ...chart.options.scales!.y!.ticks, color: c.tick };
			Object.assign(chart.options.plugins!.tooltip!, tooltipDefaults(c));
			chart.update();
		}
		if (kumulativChart) {
			kumulativChart.data.datasets[0].borderColor = c.cumulative;
			kumulativChart.data.datasets[0].backgroundColor = c.cumulative;
			kumulativChart.options.scales!.x!.grid = { color: c.grid };
			kumulativChart.options.scales!.x!.ticks = { ...kumulativChart.options.scales!.x!.ticks, color: c.tick };
			kumulativChart.options.scales!.y!.grid = { color: c.grid };
			kumulativChart.options.scales!.y!.ticks = { ...kumulativChart.options.scales!.y!.ticks, color: c.tick };
			Object.assign(kumulativChart.options.plugins!.tooltip!, tooltipDefaults(c));
			kumulativChart.update();
		}
	}

	$effect(() => {
		theme.current; // Abhängigkeit: bei Theme-Wechsel neu einfärben
		if (chart) applyTheme();
	});

	onMount(() => {
		const c = chartColors();
		const chronologisch = data.chronologisch;

		chart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: chronologisch.map((m) => m.label),
				datasets: [{
					label: 'Ausgaben',
					data: chronologisch.map((m) => m.ausgaben / 100),
					backgroundColor: c.line
				}]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => formatCents((ctx.raw as number) * 100)
						}
					}
				},
				scales: {
					x: {
						grid: { color: c.grid },
						ticks: { color: c.tick }
					},
					y: {
						grid: { color: c.grid },
						ticks: {
							color: c.tick,
							callback: (v) => `${(v as number).toLocaleString('de-DE')} €`
						}
					}
				}
			}
		});

		kumulativChart = new Chart(kumulativCanvas, {
			type: 'line',
			data: {
				labels: chronologisch.map((m) => m.label),
				datasets: [{
					label: 'Kumuliert',
					data: chronologisch.map((m) => m.kumuliert / 100),
					borderColor: c.cumulative,
					backgroundColor: c.cumulative,
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
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => formatCents((ctx.raw as number) * 100)
						}
					}
				},
				scales: {
					x: {
						grid: { color: c.grid },
						ticks: { color: c.tick }
					},
					y: {
						grid: { color: c.grid },
						ticks: {
							color: c.tick,
							callback: (v) => `${(v as number).toLocaleString('de-DE')} €`
						}
					}
				}
			}
		});

		return () => {
			chart?.destroy();
			kumulativChart?.destroy();
			chart = kumulativChart = null;
		};
	});
</script>

<div class="space-y-6">
	<h1 class="page-title">
		<svg class="page-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
		Monatsverlauf
	</h1>

	{#if data.tabelle.length === 0}
		<div class="card px-4 py-12 text-center text-stone-400 dark:text-stone-500 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-stone-300 dark:text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
			Noch keine Buchungen vorhanden.
		</div>
	{:else}
		<!-- Chart -->
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Ausgaben pro Monat</h3>
			<canvas bind:this={chartCanvas}></canvas>
		</div>

		<!-- Kumulativer Verlauf -->
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Kumulierte Gesamtausgaben</h3>
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
					{#each data.tabelle as m (m.monat)}
						<tr class="border-b border-stone-100 dark:border-stone-800 last:border-b-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
							<td class="px-4 py-3 text-sm">
								<a href="/buchungen?monat={m.monat}" class="font-medium text-primary-600 dark:text-primary-400 hover:underline">
									{m.label}
								</a>
								<div class="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
									{#if m.material > 0}<span>Material {formatCents(m.material)}</span>{/if}
									{#if m.material > 0 && (m.arbeitslohn > 0 || m.sonstiges > 0)}<span class="mx-1">·</span>{/if}
									{#if m.arbeitslohn > 0}<span>Arbeitslohn {formatCents(m.arbeitslohn)}</span>{/if}
									{#if m.arbeitslohn > 0 && m.sonstiges > 0}<span class="mx-1">·</span>{/if}
									{#if m.sonstiges > 0}<span>Sonstiges {formatCents(m.sonstiges)}</span>{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-sm text-right text-stone-500 dark:text-stone-400">{m.anzahl}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums dark:text-stone-200">{formatCents(m.ausgaben)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-stone-500 dark:text-stone-400">{formatCents(m.kumuliert)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 font-medium dark:text-stone-200">
						<td class="px-4 py-3 text-sm">Gesamt</td>
						<td class="px-4 py-3 text-sm text-right text-stone-500 dark:text-stone-400">{gesamtAnzahl}</td>
						<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(gesamt)}</td>
						<td class="px-4 py-3"></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
</div>
