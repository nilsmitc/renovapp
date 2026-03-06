<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const offeneKandidaten = $derived(
		(data.cache?.kandidaten ?? []).filter((k) => !k.uebernommen && !k.uebersprungen)
	);
	const erledigteKandidaten = $derived(
		(data.cache?.kandidaten ?? []).filter((k) => k.uebernommen || k.uebersprungen)
	);

	let scanLaeuft = $state(false);
	let aktivesFormular: string | null = $state(null);

	function formatGescannt(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
				<svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
				</svg>
				E-Mail-Import
			</h1>
			<p class="text-sm text-gray-500 mt-1">
				Rechnungen aus Thunderbird importieren — nur Mails von bekannten Lieferanten, letzte 14 Tage.
			</p>
		</div>

		<!-- Scan-Button -->
		<form method="POST" action="?/scannen" use:enhance={() => {
			scanLaeuft = true;
			return async ({ update }) => {
				await update();
				scanLaeuft = false;
			};
		}}>
			<button
				type="submit"
				disabled={scanLaeuft}
				class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait transition-colors shadow-sm">
				{#if scanLaeuft}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
					Scanne Postfach…
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
					</svg>
					{data.cache ? 'Neu scannen' : 'Jetzt scannen'}
				{/if}
			</button>
		</form>
	</div>

	<!-- Fehlermeldung Scan -->
	{#if form?.scanFehler}
		<div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
			<strong>Fehler:</strong> {form.scanFehler}
		</div>
	{/if}

	<!-- Scan-Ergebnis Banner -->
	{#if form?.gescannt}
		<div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm flex items-center gap-2">
			<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Scan abgeschlossen — {form.anzahlNachrichten} Nachrichten geprüft,
			<strong>{form.anzahlGefunden} Kandidaten</strong> gefunden.
		</div>
	{/if}

	<!-- Status letzter Scan -->
	{#if data.cache}
		<div class="text-xs text-gray-400 -mt-2">
			Letzter Scan: {formatGescannt(data.cache.gescannt)}
			· {data.cache.kandidaten.length} Kandidaten gesamt
			· {offeneKandidaten.length} offen
		</div>
	{/if}

	<!-- Keine Lieferanten -->
	{#if data.lieferanten.length === 0}
		<div class="card text-center py-10 text-gray-500">
			<p class="font-medium">Noch keine Lieferanten angelegt.</p>
			<p class="text-sm mt-1">Bitte zuerst unter <a href="/lieferanten" class="text-blue-600 hover:underline">Lieferanten</a> die Händler anlegen.</p>
		</div>
	{/if}

	<!-- Offene Kandidaten -->
	{#if offeneKandidaten.length > 0}
		<div class="space-y-4">
			<h2 class="text-base font-semibold text-gray-800">Zu prüfen ({offeneKandidaten.length})</h2>

			{#each offeneKandidaten as k (k.id)}
				<div class="card">
					<!-- Kandidat-Header -->
					<div class="flex items-start justify-between gap-4 mb-4">
						<div class="min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
									{k.lieferantName}
								</span>
								<span class="text-xs text-gray-400">{k.datum}</span>
							</div>
							<p class="font-medium text-gray-900 mt-1 truncate">{k.betreff}</p>
							<p class="text-xs text-gray-400 truncate">{k.absender}</p>
						</div>
						<div class="shrink-0 text-right">
							{#if k.extraktion.betrag}
								<p class="text-lg font-bold text-gray-900 tabular-nums">{formatCents(k.extraktion.betrag)}</p>
								<p class="text-xs text-gray-400">aus PDF</p>
							{:else}
								<p class="text-sm text-amber-600 font-medium">Betrag nicht erkannt</p>
							{/if}
						</div>
					</div>

					<!-- Formular ausklappen/zuklappen -->
					{#if aktivesFormular === k.id}
						<!-- Bestätigungs-Formular -->
						<form
							method="POST"
							action="?/uebernehmen"
							use:enhance={({ formData }) => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										aktivesFormular = null;
									}
									await update();
								};
							}}
							class="border-t border-blue-100 pt-4 space-y-3 bg-blue-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">

							<input type="hidden" name="id" value={k.id} />

							<div class="grid grid-cols-2 gap-3">
								<!-- Datum -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Datum</label>
									<input
										type="date"
										name="datum"
										value={k.extraktion.datum ?? k.datum}
										required
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
								</div>
								<!-- Betrag -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Betrag (€)</label>
									<input
										type="text"
										name="betrag"
										value={k.extraktion.betrag ? (k.extraktion.betrag / 100).toFixed(2).replace('.', ',') : ''}
										placeholder="0,00"
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
								</div>
								<!-- Rechnungsnummer -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Rechnungsnummer</label>
									<input
										type="text"
										name="rechnungsnummer"
										value={k.extraktion.rechnungsnummer ?? ''}
										placeholder="optional"
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
								</div>
								<!-- Gewerk -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Gewerk <span class="text-red-500">*</span></label>
									<select
										name="gewerk"
										required
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
										<option value="">– auswählen –</option>
										{#each data.gewerke as g}
											<option value={g.id}>{g.name}</option>
										{/each}
									</select>
								</div>
								<!-- Lieferant (ggf. ändern) -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Lieferant</label>
									<select
										name="lieferantId"
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
										{#each data.lieferanten as l}
											<option value={l.id} selected={l.id === k.lieferantId}>{l.name}</option>
										{/each}
									</select>
								</div>
								<!-- Beschreibung -->
								<div>
									<label class="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
									<input
										type="text"
										name="beschreibung"
										value={k.betreff}
										maxlength="120"
										class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
								</div>
							</div>

							{#if form?.uebernehmenFehler}
								<p class="text-xs text-red-600">{form.uebernehmenFehler}</p>
							{/if}

							<div class="flex gap-2 pt-1">
								<button
									type="submit"
									class="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Übernehmen
								</button>
								<button
									type="button"
									onclick={() => aktivesFormular = null}
									class="px-4 py-2 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
									Abbrechen
								</button>
							</div>
						</form>
					{:else}
						<!-- Aktions-Buttons -->
						<div class="flex items-center gap-2 border-t border-gray-100 pt-3">
							{#if k.extraktion.rechnungsnummer}
								<span class="text-xs text-gray-400">Rg. {k.extraktion.rechnungsnummer}</span>
								<span class="text-gray-200">·</span>
							{/if}
							<span class="text-xs text-gray-400 truncate flex-1">{k.pdfDateiname}</span>

							<form method="POST" action="?/ueberspringen" use:enhance>
								<input type="hidden" name="id" value={k.id} />
								<button
									type="submit"
									class="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-md transition-colors">
									Überspringen
								</button>
							</form>
							<button
								type="button"
								onclick={() => aktivesFormular = k.id}
								class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Übernehmen
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else if data.cache && offeneKandidaten.length === 0}
		<div class="card text-center py-10">
			<svg class="w-10 h-10 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="font-medium text-gray-700">Alles erledigt</p>
			<p class="text-sm text-gray-400 mt-1">Alle Kandidaten wurden übernommen oder übersprungen.</p>
		</div>
	{:else if !data.cache}
		<div class="card text-center py-12 text-gray-400">
			<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
			</svg>
			<p class="font-medium">Noch kein Scan durchgeführt</p>
			<p class="text-sm mt-1">Auf "Jetzt scannen" klicken um das Thunderbird-Postfach nach Rechnungen zu durchsuchen.</p>
		</div>
	{/if}

	<!-- Erledigte (zusammengeklappt) -->
	{#if erledigteKandidaten.length > 0}
		<details class="card">
			<summary class="cursor-pointer text-sm font-medium text-gray-500 select-none">
				Erledigt ({erledigteKandidaten.length})
			</summary>
			<div class="mt-3 space-y-2">
				{#each erledigteKandidaten as k (k.id)}
					<div class="flex items-center gap-3 py-2 border-t border-gray-100">
						{#if k.uebernommen}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
								Übernommen
							</span>
						{:else}
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
								Übersprungen
							</span>
						{/if}
						<span class="text-sm text-gray-600 truncate">{k.betreff}</span>
						<span class="text-xs text-gray-400 shrink-0">{k.datum}</span>
					</div>
				{/each}
			</div>
		</details>
	{/if}
</div>
