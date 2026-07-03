<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip
	} from 'chart.js';
	import { formatCents } from '$lib/format';
	import { chartColors, type ChartColors } from '$lib/chartTheme';
	import { theme } from '$lib/theme.svelte';

	Chart.register(
		BarController,
		BarElement,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip
	);

	type Monat = {
		monat: string;
		label: string;
		ausgaben: number;
		anzahl: number;
		kumuliert: number;
		material: number;
		arbeitslohn: number;
		sonstiges: number;
	};

	let { monate }: { monate: Monat[] } = $props();

	const gesamt = $derived(monate.reduce((s, m) => s + m.ausgaben, 0));
	const gesamtAnzahl = $derived(monate.reduce((s, m) => s + m.anzahl, 0));

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

		// Älteste zuerst für die Charts (chronologisch)
		const chronologisch = [...monate].reverse();

		chart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: chronologisch.map((m) => m.label),
				datasets: [
					{
						label: 'Ausgaben',
						data: chronologisch.map((m) => m.ausgaben / 100),
						backgroundColor: c.line
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
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
				datasets: [
					{
						label: 'Kumuliert',
						data: chronologisch.map((m) => m.kumuliert / 100),
						borderColor: c.cumulative,
						backgroundColor: c.cumulative,
						tension: 0.3,
						fill: false,
						pointRadius: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
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

<div class="space-y-4">
	<h2 class="flex items-center gap-2 text-lg font-semibold text-stone-800 dark:text-stone-200">
		<svg class="w-5 h-5 text-primary-500 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
		Monatsverlauf
	</h2>

	<!-- Charts -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Ausgaben pro Monat</h3>
			<div class="h-56 relative">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
		</div>
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Kumulierte Gesamtausgaben</h3>
			<div class="h-56 relative">
				<canvas bind:this={kumulativCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Tabelle -->
	<div class="card overflow-x-auto">
		<table class="w-full">
			<thead>
				<tr class="thead-row">
					<th class="px-4 py-3 text-left">Monat</th>
					<th class="px-4 py-3 text-right">Buchungen</th>
					<th class="px-4 py-3 text-right">Ausgaben</th>
					<th class="px-4 py-3 text-right">Kumuliert</th>
				</tr>
			</thead>
			<tbody>
				{#each monate as m (m.monat)}
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
</div>
