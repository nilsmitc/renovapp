/**
 * Liest die themeabhängigen Chart-Farben aus den CSS-Variablen (:root / .dark).
 * Nur im Browser aufrufen (nach Mount bzw. bei Theme-Wechsel).
 */
export interface ChartColors {
	material: string;
	arbeitslohn: string;
	sonstiges: string;
	budgetTrack: string;
	over: string;
	warn: string;
	ok: string;
	line: string;
	cumulative: string;
	paid: string;
	open: string;
	rest: string;
	grid: string;
	tick: string;
	legend: string;
	segmentBorder: string;
	tooltipBg: string;
	tooltipText: string;
}

export function chartColors(): ChartColors {
	const s = getComputedStyle(document.documentElement);
	const v = (n: string) => s.getPropertyValue(n).trim();
	return {
		material: v('--app-chart-material'),
		arbeitslohn: v('--app-chart-arbeitslohn'),
		sonstiges: v('--app-chart-sonstiges'),
		budgetTrack: v('--app-chart-budget-track'),
		over: v('--app-chart-over'),
		warn: v('--app-chart-warn'),
		ok: v('--app-chart-ok'),
		line: v('--app-chart-line'),
		cumulative: v('--app-chart-cumulative'),
		paid: v('--app-paid'),
		open: v('--app-open'),
		rest: v('--app-rest'),
		grid: v('--app-chart-grid'),
		tick: v('--app-chart-tick'),
		legend: v('--app-chart-legend'),
		segmentBorder: v('--app-chart-segment-border'),
		tooltipBg: v('--app-chart-tooltip-bg'),
		tooltipText: v('--app-chart-tooltip-text')
	};
}
