<script lang="ts">
	import type { PageData } from './$types';
	import { formatCents } from '$lib/format';

	let { data }: { data: PageData } = $props();

	let mitAi = $state(data.claudeVerfuegbar);
	let laeuft = $state(false);

	function berichtErstellen() {
		laeuft = true;
		const url = mitAi ? '/api/bericht?ai=true' : '/api/bericht';

		// Fetch als Blob um Spinner-State zu ermöglichen
		fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error('Fehler beim Erstellen');
				return res.blob();
			})
			.then((blob) => {
				const a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = `bauleiter-bericht-${new Date().toISOString().slice(0, 10)}.pdf`;
				a.click();
				URL.revokeObjectURL(a.href);
			})
			.catch((err) => {
				alert('Fehler beim Erstellen des Berichts: ' + err.message);
			})
			.finally(() => {
				laeuft = false;
			});
	}
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
		</svg>
		Bauleiter-Bericht
	</h1>

	<!-- Info -->
	<div class="card p-6 space-y-4">
		<p class="text-sm text-gray-600">
			Erstellt einen professionellen PDF-Bericht mit allen Finanzdaten des Renovierungsprojekts.
			Der Bericht enthält Budget-Übersicht, Gewerk- und Raum-Aufschlüsselung, Auftragsstatus,
			Monatsverlauf, Prognose und Lieferanten-Übersicht.
		</p>

		<!-- Projektinfo -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
			<div class="bg-gray-50 rounded-lg p-3">
				<div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</div>
				<div class="text-sm font-bold font-mono mt-1">{formatCents(data.gesamtBudget)}</div>
			</div>
			<div class="bg-gray-50 rounded-lg p-3">
				<div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ausgaben</div>
				<div class="text-sm font-bold font-mono mt-1">{formatCents(data.gesamtIst)}</div>
			</div>
			<div class="bg-gray-50 rounded-lg p-3">
				<div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Buchungen</div>
				<div class="text-sm font-bold mt-1">{data.anzahlBuchungen}</div>
			</div>
			<div class="bg-gray-50 rounded-lg p-3">
				<div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Gewerke</div>
				<div class="text-sm font-bold mt-1">{data.anzahlGewerke}</div>
			</div>
		</div>

		<!-- KI-Option -->
		<div class="border rounded-lg p-4 {mitAi ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'}">
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={mitAi}
					disabled={!data.claudeVerfuegbar}
					class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<div>
					<div class="text-sm font-medium text-gray-900">
						Mit KI-Analyse (Claude)
					</div>
					{#if data.claudeVerfuegbar}
						<div class="text-xs text-gray-500 mt-1">
							Claude analysiert die Finanzdaten und erstellt eine Zusammenfassung mit Risikobewertung,
							Cashflow-Einschätzung und konkreten Empfehlungen.
						</div>
					{:else}
						<div class="text-xs text-red-500 mt-1">
							Claude CLI nicht verfügbar. Stelle sicher, dass <code class="bg-red-100 px-1 rounded">claude</code> installiert und im PATH ist.
						</div>
					{/if}
				</div>
			</label>
		</div>

		<!-- Hinweis -->
		<div class="text-xs text-gray-400">
			{#if mitAi}
				Die Erstellung dauert ca. 15–30 Sekunden (inkl. KI-Analyse).
			{:else}
				Die Erstellung dauert wenige Sekunden.
			{/if}
		</div>

		<!-- Button -->
		<button
			onclick={berichtErstellen}
			disabled={laeuft || data.anzahlBuchungen === 0}
			class="btn-primary inline-flex items-center gap-2"
		>
			{#if laeuft}
				<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				{mitAi ? 'Bericht wird erstellt (mit KI-Analyse)...' : 'Bericht wird erstellt...'}
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
				</svg>
				Bericht erstellen (PDF)
			{/if}
		</button>

		{#if data.anzahlBuchungen === 0}
			<p class="text-sm text-yellow-600">
				Noch keine Buchungen vorhanden. Der Bericht kann erst nach der ersten Buchung erstellt werden.
			</p>
		{/if}
	</div>

	<!-- Inhalt des Berichts -->
	<div class="card p-6 space-y-3">
		<h2 class="text-sm font-semibold text-gray-800">Der Bericht enthält:</h2>
		<ul class="text-sm text-gray-600 space-y-1.5 list-none">
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Deckblatt mit Kernzahlen und Fortschrittsbalken
			</li>
			{#if mitAi}
				<li class="flex items-center gap-2">
					<svg class="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
					<span class="text-purple-700 font-medium">KI-Einschätzung: Zusammenfassung, Risiken, Cashflow, Empfehlungen</span>
				</li>
			{/if}
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Budget-Übersicht mit Diagrammen und Ampel-Status
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Kategorien-Analyse (Material / Arbeitslohn / Sonstiges)
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Kosten nach Raum (gruppiert nach Geschoss)
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Auftragsstatus mit offenen und überfälligen Rechnungen
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Monatsverlauf mit Ausgaben- und Kumuliert-Charts
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Prognose mit Burn Rate und Budget-Erschöpfungsdatum
			</li>
			<li class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Lieferanten-Übersicht
			</li>
		</ul>
	</div>
</div>
