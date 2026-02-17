<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Chart, DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
	import type { GewerkSummary } from '$lib/domain';
	import { formatCents } from '$lib/format';

	Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Props {
		summaries: GewerkSummary[];
	}

	let { summaries }: Props = $props();

	let doughnutCanvas: HTMLCanvasElement;
	let barCanvas: HTMLCanvasElement;
	let kategorieDonutCanvas: HTMLCanvasElement;
	let gestapelteBalkenCanvas: HTMLCanvasElement;

	const activeSummaries = $derived(summaries.filter((s) => s.ist > 0 || s.budget > 0));
	const summariesMitIst = $derived(summaries.filter((s) => s.ist > 0));

	const gesamtMaterial = $derived(summaries.reduce((acc, s) => acc + s.material, 0));
	const gesamtArbeitslohn = $derived(summaries.reduce((acc, s) => acc + s.arbeitslohn, 0));
	const gesamtSonstiges = $derived(summaries.reduce((acc, s) => acc + s.sonstiges, 0));

	const FARBE_MATERIAL = '#3B82F6';
	const FARBE_ARBEITSLOHN = '#F97316';
	const FARBE_SONSTIGES = '#6B7280';

	onMount(() => {
		const doughnut = new Chart(doughnutCanvas, {
			type: 'doughnut',
			data: {
				labels: activeSummaries.map((s) => s.gewerk.name),
				datasets: [{
					data: activeSummaries.map((s) => s.ist / 100),
					backgroundColor: activeSummaries.map((s) => s.gewerk.farbe)
				}]
			},
			options: {
				responsive: true,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${activeSummaries[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					legend: { position: 'right' },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.label}: ${formatCents(activeSummaries[ctx.dataIndex].ist)}`
						}
					}
				}
			}
		});

		const bar = new Chart(barCanvas, {
			type: 'bar',
			data: {
				labels: activeSummaries.map((s) => s.gewerk.name),
				datasets: [
					{
						label: 'Budget',
						data: activeSummaries.map((s) => s.budget / 100),
						backgroundColor: '#E5E7EB'
					},
					{
						label: 'Ausgaben',
						data: activeSummaries.map((s) => s.ist / 100),
						backgroundColor: activeSummaries.map((s) =>
							s.ist > s.budget && s.budget > 0 ? '#EF4444' :
							s.ist >= s.budget * 0.8 && s.budget > 0 ? '#F59E0B' : '#3B82F6'
						)
					}
				]
			},
			options: {
				responsive: true,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${activeSummaries[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
						}
					}
				},
				scales: {
					y: {
						ticks: {
							callback: (v) => `${(v as number).toLocaleString('de-DE')} \u20ac`
						}
					}
				}
			}
		});

		const kategorieDonut = new Chart(kategorieDonutCanvas, {
			type: 'doughnut',
			data: {
				labels: ['Material', 'Arbeitslohn', 'Sonstiges'],
				datasets: [{
					data: [gesamtMaterial / 100, gesamtArbeitslohn / 100, gesamtSonstiges / 100],
					backgroundColor: [FARBE_MATERIAL, FARBE_ARBEITSLOHN, FARBE_SONSTIGES]
				}]
			},
			options: {
				responsive: true,
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
					legend: { position: 'right' },
					tooltip: {
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

		const gestapelteBalken = new Chart(gestapelteBalkenCanvas, {
			type: 'bar',
			data: {
				labels: summariesMitIst.map((s) => s.gewerk.name),
				datasets: [
					{
						label: 'Material',
						data: summariesMitIst.map((s) => s.material / 100),
						backgroundColor: FARBE_MATERIAL
					},
					{
						label: 'Arbeitslohn',
						data: summariesMitIst.map((s) => s.arbeitslohn / 100),
						backgroundColor: FARBE_ARBEITSLOHN
					},
					{
						label: 'Sonstiges',
						data: summariesMitIst.map((s) => s.sonstiges / 100),
						backgroundColor: FARBE_SONSTIGES
					}
				]
			},
			options: {
				responsive: true,
				onClick: (_e, elements) => {
					if (elements.length > 0) goto(`/buchungen?gewerk=${summariesMitIst[elements[0].index].gewerk.id}`);
				},
				onHover: (e, elements) => {
					const t = e.native?.target as HTMLElement | null;
					if (t) t.style.cursor = elements.length > 0 ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
						}
					}
				},
				scales: {
					x: { stacked: true },
					y: {
						stacked: true,
						ticks: {
							callback: (v) => `${(v as number).toLocaleString('de-DE')} \u20ac`
						}
					}
				}
			}
		});

		return () => {
			doughnut.destroy();
			bar.destroy();
			kategorieDonut.destroy();
			gestapelteBalken.destroy();
		};
	});
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Kosten nach Gewerk</h3>
			<canvas bind:this={doughnutCanvas}></canvas>
		</div>
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Budget vs. Ausgaben</h3>
			<canvas bind:this={barCanvas}></canvas>
		</div>
	</div>
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Kostenverteilung nach Kategorie</h3>
			<canvas bind:this={kategorieDonutCanvas}></canvas>
		</div>
		<div class="card p-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-3">Kategorien nach Gewerk</h3>
			<canvas bind:this={gestapelteBalkenCanvas}></canvas>
		</div>
	</div>
</div>
