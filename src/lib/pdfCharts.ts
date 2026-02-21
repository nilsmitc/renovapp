import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';
import type { GewerkSummary } from './domain';

const WIDTH = 800;
const HEIGHT = 400;

let canvasInstance: ChartJSNodeCanvas | null = null;

function getCanvas(): ChartJSNodeCanvas {
	if (!canvasInstance) {
		canvasInstance = new ChartJSNodeCanvas({ width: WIDTH, height: HEIGHT, backgroundColour: '#ffffff' });
	}
	return canvasInstance;
}

async function renderChart(config: ChartConfiguration): Promise<string> {
	const canvas = getCanvas();
	const buffer = await canvas.renderToBuffer(config);
	return 'data:image/png;base64,' + buffer.toString('base64');
}

// Kategorie-Farben (gleich wie Charts.svelte)
const FARBE_MATERIAL = '#3B82F6';
const FARBE_ARBEITSLOHN = '#F97316';
const FARBE_SONSTIGES = '#6B7280';

/** Doughnut: Kosten nach Gewerk */
export async function renderKostenVerteilungChart(summaries: GewerkSummary[]): Promise<string> {
	const active = summaries.filter((s) => s.ist > 0 || s.budget > 0);
	return renderChart({
		type: 'doughnut',
		data: {
			labels: active.map((s) => s.gewerk.name),
			datasets: [{
				data: active.map((s) => s.ist / 100),
				backgroundColor: active.map((s) => s.gewerk.farbe)
			}]
		},
		options: {
			responsive: false,
			animation: false,
			plugins: {
				legend: { position: 'right', labels: { font: { size: 13 } } }
			}
		}
	});
}

/** Bar: Budget vs. Ausgaben nach Gewerk */
export async function renderBudgetVsIstChart(summaries: GewerkSummary[]): Promise<string> {
	const active = summaries.filter((s) => s.ist > 0 || s.budget > 0);
	return renderChart({
		type: 'bar',
		data: {
			labels: active.map((s) => s.gewerk.name),
			datasets: [
				{
					label: 'Budget',
					data: active.map((s) => s.budget / 100),
					backgroundColor: '#E5E7EB'
				},
				{
					label: 'Ausgaben',
					data: active.map((s) => s.ist / 100),
					backgroundColor: active.map((s) =>
						s.ist > s.budget && s.budget > 0 ? '#EF4444' :
						s.ist >= s.budget * 0.8 && s.budget > 0 ? '#F59E0B' : '#3B82F6'
					)
				}
			]
		},
		options: {
			responsive: false,
			animation: false,
			scales: {
				y: { ticks: { callback: (v) => `${Number(v).toLocaleString('de-DE')} \u20ac` } }
			},
			plugins: { legend: { labels: { font: { size: 13 } } } }
		}
	});
}

/** Doughnut: Material / Arbeitslohn / Sonstiges */
export async function renderKategorieChart(material: number, arbeitslohn: number, sonstiges: number): Promise<string> {
	return renderChart({
		type: 'doughnut',
		data: {
			labels: ['Material', 'Arbeitslohn', 'Sonstiges'],
			datasets: [{
				data: [material / 100, arbeitslohn / 100, sonstiges / 100],
				backgroundColor: [FARBE_MATERIAL, FARBE_ARBEITSLOHN, FARBE_SONSTIGES]
			}]
		},
		options: {
			responsive: false,
			animation: false,
			plugins: {
				legend: { position: 'right', labels: { font: { size: 13 } } }
			}
		}
	});
}

/** Stacked Bar: Kategorien nach Gewerk */
export async function renderKategorienNachGewerkChart(summaries: GewerkSummary[]): Promise<string> {
	const mitIst = summaries.filter((s) => s.ist > 0);
	return renderChart({
		type: 'bar',
		data: {
			labels: mitIst.map((s) => s.gewerk.name),
			datasets: [
				{ label: 'Material', data: mitIst.map((s) => s.material / 100), backgroundColor: FARBE_MATERIAL },
				{ label: 'Arbeitslohn', data: mitIst.map((s) => s.arbeitslohn / 100), backgroundColor: FARBE_ARBEITSLOHN },
				{ label: 'Sonstiges', data: mitIst.map((s) => s.sonstiges / 100), backgroundColor: FARBE_SONSTIGES }
			]
		},
		options: {
			responsive: false,
			animation: false,
			scales: {
				x: { stacked: true },
				y: {
					stacked: true,
					ticks: { callback: (v) => `${Number(v).toLocaleString('de-DE')} \u20ac` }
				}
			},
			plugins: { legend: { labels: { font: { size: 13 } } } }
		}
	});
}

export interface MonatsDaten {
	label: string;
	ausgaben: number;
	kumuliert: number;
}

/** Bar: Monatliche Ausgaben */
export async function renderMonatsverlaufChart(monate: MonatsDaten[]): Promise<string> {
	return renderChart({
		type: 'bar',
		data: {
			labels: monate.map((m) => m.label),
			datasets: [{
				label: 'Ausgaben',
				data: monate.map((m) => m.ausgaben / 100),
				backgroundColor: '#3B82F6'
			}]
		},
		options: {
			responsive: false,
			animation: false,
			plugins: { legend: { display: false } },
			scales: {
				y: { ticks: { callback: (v) => `${Number(v).toLocaleString('de-DE')} \u20ac` } }
			}
		}
	});
}

/** Line: Kumulierte Ausgaben */
export async function renderKumuliertChart(monate: MonatsDaten[]): Promise<string> {
	return renderChart({
		type: 'line',
		data: {
			labels: monate.map((m) => m.label),
			datasets: [{
				label: 'Kumuliert',
				data: monate.map((m) => m.kumuliert / 100),
				borderColor: '#10B981',
				backgroundColor: '#10B981',
				tension: 0.3,
				fill: false,
				pointRadius: 4
			}]
		},
		options: {
			responsive: false,
			animation: false,
			plugins: { legend: { display: false } },
			scales: {
				y: { ticks: { callback: (v) => `${Number(v).toLocaleString('de-DE')} \u20ac` } }
			}
		}
	});
}

/** Line: Prognose (Ist + Hochrechnung + Budget-Linie) */
export async function renderPrognoseChart(
	labels: string[],
	ist: (number | null)[],
	prognose: (number | null)[],
	budget: number[]
): Promise<string> {
	return renderChart({
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label: 'Ausgaben (Ist)',
					data: ist.map((v) => (v !== null ? v / 100 : null)),
					borderColor: '#3B82F6',
					backgroundColor: '#3B82F6',
					tension: 0.2,
					fill: false,
					pointRadius: 4,
					spanGaps: false
				},
				{
					label: 'Prognose',
					data: prognose.map((v) => (v !== null ? v / 100 : null)),
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
					data: budget.map((v) => v / 100),
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
			responsive: false,
			animation: false,
			plugins: {
				legend: { display: true, position: 'bottom', labels: { font: { size: 13 } } }
			},
			scales: {
				y: { ticks: { callback: (v) => `${Number(v).toLocaleString('de-DE')} \u20ac` } }
			}
		}
	});
}
