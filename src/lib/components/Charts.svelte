<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Chart, DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
	import type { GewerkSummary } from '$lib/domain';
	import { formatCents } from '$lib/format';
	import { chartColors, type ChartColors } from '$lib/chartTheme';
	import { theme } from '$lib/theme.svelte';

	Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Props {
		summaries: GewerkSummary[];
		abgeschlossenPerGewerk?: Record<string, boolean>;
	}

	let { summaries, abgeschlossenPerGewerk = {} }: Props = $props();

	let doughnutCanvas: HTMLCanvasElement;
	let barCanvas: HTMLCanvasElement;
	let kategorieDonutCanvas: HTMLCanvasElement;
	let gestapelteBalkenCanvas: HTMLCanvasElement;

	let doughnut: Chart<'doughnut'> | null = null;
	let bar: Chart<'bar'> | null = null;
	let kategorieDonut: Chart<'doughnut'> | null = null;
	let gestapelteBalken: Chart<'bar'> | null = null;

	const activeSummaries = $derived(summaries.filter((s) => s.ist > 0 || s.budget > 0));
	const summariesMitIst = $derived(summaries.filter((s) => s.ist > 0));

	const gesamtMaterial = $derived(summaries.reduce((acc, s) => acc + s.material, 0));
	const gesamtArbeitslohn = $derived(summaries.reduce((acc, s) => acc + s.arbeitslohn, 0));
	const gesamtSonstiges = $derived(summaries.reduce((acc, s) => acc + s.sonstiges, 0));

	function tooltipDefaults(c: ChartColors) {
		return { backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText };
	}

	function ausgabenFarben(c: ChartColors) {
		return activeSummaries.map((s) =>
			s.ist > s.budget && s.budget > 0 ? c.over :
			s.ist >= s.budget * 0.8 && s.budget > 0 && !abgeschlossenPerGewerk[s.gewerk.id] ? c.warn : c.ok
		);
	}

	/** Themeabhängige Farben auf alle Chart-Instanzen anwenden */
	function applyTheme() {
		const c = chartColors();
		if (doughnut) {
			doughnut.data.datasets[0].borderColor = c.segmentBorder;
			doughnut.options.plugins!.legend!.labels = { color: c.legend };
			Object.assign(doughnut.options.plugins!.tooltip!, tooltipDefaults(c));
			doughnut.update();
		}
		if (bar) {
			bar.data.datasets[0].backgroundColor = c.budgetTrack;
			bar.data.datasets[1].backgroundColor = ausgabenFarben(c);
			bar.options.scales!.x!.grid = { color: c.grid };
			bar.options.scales!.x!.ticks = { ...bar.options.scales!.x!.ticks, color: c.tick };
			bar.options.scales!.y!.grid = { color: c.grid };
			bar.options.scales!.y!.ticks = { ...bar.options.scales!.y!.ticks, color: c.tick };
			Object.assign(bar.options.plugins!.tooltip!, tooltipDefaults(c));
			bar.update();
		}
		if (kategorieDonut) {
			kategorieDonut.data.datasets[0].backgroundColor = [c.material, c.arbeitslohn, c.sonstiges];
			kategorieDonut.data.datasets[0].borderColor = c.segmentBorder;
			kategorieDonut.options.plugins!.legend!.labels = { color: c.legend };
			Object.assign(kategorieDonut.options.plugins!.tooltip!, tooltipDefaults(c));
			kategorieDonut.update();
		}
		if (gestapelteBalken) {
			gestapelteBalken.data.datasets[0].backgroundColor = c.material;
			gestapelteBalken.data.datasets[1].backgroundColor = c.arbeitslohn;
			gestapelteBalken.data.datasets[2].backgroundColor = c.sonstiges;
			gestapelteBalken.options.scales!.x!.grid = { color: c.grid };
			gestapelteBalken.options.scales!.x!.ticks = { ...gestapelteBalken.options.scales!.x!.ticks, color: c.tick };
			gestapelteBalken.options.scales!.y!.grid = { color: c.grid };
			gestapelteBalken.options.scales!.y!.ticks = { ...gestapelteBalken.options.scales!.y!.ticks, color: c.tick };
			Object.assign(gestapelteBalken.options.plugins!.tooltip!, tooltipDefaults(c));
			gestapelteBalken.update();
		}
	}

	$effect(() => {
		theme.current; // Abhängigkeit: bei Theme-Wechsel neu einfärben
		if (doughnut) applyTheme();
	});

	onMount(() => {
		const c = chartColors();

		doughnut = new Chart(doughnutCanvas, {
			type: 'doughnut',
			data: {
				labels: activeSummaries.map((s) => s.gewerk.name),
				datasets: [{
					data: activeSummaries.map((s) => s.ist / 100),
					backgroundColor: activeSummaries.map((s) => s.gewerk.farbe),
					borderColor: c.segmentBorder
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${activeSummaries[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					legend: { position: 'right', labels: { color: c.legend } },
					tooltip: {
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => `${ctx.label}: ${formatCents(activeSummaries[ctx.dataIndex].ist)}`
						}
					}
				}
			}
		});

		bar = new Chart(barCanvas, {
			type: 'bar',
			data: {
				labels: activeSummaries.map((s) => s.gewerk.name),
				datasets: [
					{
						label: 'Budget',
						data: activeSummaries.map((s) => s.budget / 100),
						backgroundColor: c.budgetTrack
					},
					{
						label: 'Ausgaben',
						data: activeSummaries.map((s) => s.ist / 100),
						backgroundColor: ausgabenFarben(c)
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${activeSummaries[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
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

		kategorieDonut = new Chart(kategorieDonutCanvas, {
			type: 'doughnut',
			data: {
				labels: ['Material', 'Arbeitslohn', 'Sonstiges'],
				datasets: [{
					data: [gesamtMaterial / 100, gesamtArbeitslohn / 100, gesamtSonstiges / 100],
					backgroundColor: [c.material, c.arbeitslohn, c.sonstiges],
					borderColor: c.segmentBorder
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (_e, elements) => {
					if (elements.length > 0) {
						const kategorien = ['Material', 'Arbeitslohn', 'Sonstiges'];
						goto(`/buchungen?kategorie=${kategorien[elements[0].index]}`);
					}
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					legend: { position: 'right', labels: { color: c.legend } },
					tooltip: {
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => {
								const werte = [gesamtMaterial, gesamtArbeitslohn, gesamtSonstiges];
								return `${ctx.label}: ${formatCents(werte[ctx.dataIndex])}`;
							}
						}
					}
				}
			}
		});

		gestapelteBalken = new Chart(gestapelteBalkenCanvas, {
			type: 'bar',
			data: {
				labels: summariesMitIst.map((s) => s.gewerk.name),
				datasets: [
					{
						label: 'Material',
						data: summariesMitIst.map((s) => s.material / 100),
						backgroundColor: c.material
					},
					{
						label: 'Arbeitslohn',
						data: summariesMitIst.map((s) => s.arbeitslohn / 100),
						backgroundColor: c.arbeitslohn
					},
					{
						label: 'Sonstiges',
						data: summariesMitIst.map((s) => s.sonstiges / 100),
						backgroundColor: c.sonstiges
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${summariesMitIst[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						...tooltipDefaults(c),
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
						}
					}
				},
				scales: {
					x: {
						stacked: true,
						grid: { color: c.grid },
						ticks: { color: c.tick }
					},
					y: {
						stacked: true,
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
			doughnut?.destroy();
			bar?.destroy();
			kategorieDonut?.destroy();
			gestapelteBalken?.destroy();
			doughnut = bar = kategorieDonut = gestapelteBalken = null;
		};
	});
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
	<div class="card p-4">
		<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Kosten nach Gewerk</h3>
		<div class="h-56 relative">
			<canvas bind:this={doughnutCanvas}></canvas>
		</div>
	</div>
	<div class="card p-4">
		<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Budget vs. Ausgaben</h3>
		<div class="h-56 relative">
			<canvas bind:this={barCanvas}></canvas>
		</div>
	</div>
	<div class="card p-4">
		<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Kostenverteilung</h3>
		<div class="h-56 relative">
			<canvas bind:this={kategorieDonutCanvas}></canvas>
		</div>
	</div>
	<div class="card p-4">
		<h3 class="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Kategorien nach Gewerk</h3>
		<div class="h-56 relative">
			<canvas bind:this={gestapelteBalkenCanvas}></canvas>
		</div>
	</div>
</div>
