<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { formatCents, formatDatum } from '$lib/format';

	let { data }: { data: PageData } = $props();

	const LIMIT_CENTS = 600000;

	let aktivesJahr = $state<number | null>(data.jahre[0]?.jahr ?? null);
	const jahresDaten = $derived(data.jahre.find((j) => j.jahr === aktivesJahr) ?? null);

	let offeneMarkierung = $state<string | null>(null);
	let arbeitsanteilInput = $state('');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between gap-4 flex-wrap">
		<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
			<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
			Steuer §35a
		</h1>
		{#if data.bestaetigt.length > 0}
			<a
				href="/api/steuer-export{aktivesJahr ? `?jahr=${aktivesJahr}` : ''}"
				class="btn-primary flex items-center gap-2 text-sm"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
				CSV für Steuerberater
			</a>
		{/if}
	</div>

	{#if data.bestaetigt.length === 0 && data.vorschlaege.length === 0}
		<!-- Komplett leer: keine Arbeitslohn-Buchungen -->
		<div class="card px-4 py-12 text-center">
			<svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" /></svg>
			<p class="text-gray-500 font-medium">Keine Arbeitslohn-Buchungen vorhanden</p>
			<p class="text-gray-400 text-sm mt-1">Füge Handwerkerrechnungen unter <a href="/buchungen/neu" class="text-blue-600 hover:underline">Ausgaben</a> mit Kategorie "Arbeitslohn" hinzu.</p>
		</div>
	{:else}
		<!-- Jahr-Tabs (nur wenn mehrere Jahre) -->
		{#if data.jahre.length > 1}
			<div class="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
				{#each data.jahre as j}
					<button
						onclick={() => (aktivesJahr = j.jahr)}
						class="px-4 py-2 text-sm font-medium transition-colors
							{aktivesJahr === j.jahr
								? 'bg-blue-600 text-white'
								: 'bg-white text-gray-600 hover:bg-gray-50'}"
					>
						{j.jahr}
					</button>
				{/each}
			</div>
		{/if}

		<!-- KPI-Zeile -->
		{#if jahresDaten}
			{@const limitUeberschritten = jahresDaten.limitProzent > 100}
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
				<div class="kpi-card animate-in">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 ">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
						§35a Arbeitslöhne {jahresDaten.jahr}
					</div>
					<div class="text-xl font-bold font-mono mt-1 kpi-value">{formatCents(jahresDaten.summe)}</div>
					<div class="text-xs text-gray-400 mt-1">von max. {formatCents(LIMIT_CENTS)} anrechenbar</div>
				</div>

				<div class="kpi-card animate-in">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 ">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						Steuerersparnis
					</div>
					<div class="text-xl font-bold font-mono mt-1 text-blue-700 kpi-value">{formatCents(jahresDaten.erstattung)}</div>
					<div class="text-xs text-gray-400 mt-1">20 % der anrechenbaren Arbeitslöhne · max. 1.200 €</div>
				</div>

				<div class="kpi-card animate-in">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 ">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
						Limit-Auslastung
					</div>
					<div class="text-xl font-bold font-mono mt-1 kpi-value {limitUeberschritten ? 'text-red-600' : 'text-amber-600'}">{jahresDaten.limitProzent > 100 ? '>100' : jahresDaten.limitProzent} %</div>
					<div class="mt-2 w-full bg-gray-100 rounded-full h-1.5">
						<div
							class="h-1.5 rounded-full transition-all duration-500 {limitUeberschritten ? 'bg-red-500' : 'bg-amber-400'}"
							style="width: {Math.min(jahresDaten.limitProzent, 100)}%"
						></div>
					</div>
					{#if limitUeberschritten}
						<div class="text-xs text-red-600 mt-1">Limit ausgeschöpft – weitere Beträge nicht anrechenbar</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Tabelle: Bestätigt -->
		{#if jahresDaten && jahresDaten.buchungen.length > 0}
			<div class="card overflow-x-auto">
				<div class="px-4 pt-4 pb-2 flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gray-700">Bestätigt – §35a-fähige Handwerkerleistungen</h2>
					<span class="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 font-medium">{jahresDaten.buchungen.length} {jahresDaten.buchungen.length === 1 ? 'Eintrag' : 'Einträge'}</span>
				</div>
				<table class="w-full">
					<thead>
						<tr class="thead-row">
							<th class="px-4 py-3 text-left">Datum</th>
							<th class="px-4 py-3 text-left">Beschreibung</th>
							<th class="px-4 py-3 text-left">Gewerk</th>
							<th class="px-4 py-3 text-right">Rechnung</th>
							<th class="px-4 py-3 text-right">Arbeitsanteil</th>
							<th class="px-4 py-3 text-right">§35a 20 %</th>
							<th class="px-4 py-3 text-center">Beleg</th>
							<th class="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each jahresDaten.buchungen as b (b.id)}
							{@const anteil = b.arbeitsanteilCents ?? b.betrag}
							{@const steuerBetrag = Math.round(anteil * 0.2)}
							<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
								<td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDatum(b.datum)}</td>
								<td class="px-4 py-3 text-sm">
									<a href="/buchungen/{b.id}" class="font-medium text-gray-900 hover:text-blue-600 hover:underline">{b.beschreibung}</a>
									{#if b.taetigkeit}<div class="text-xs text-gray-400 italic">{b.taetigkeit}</div>{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600">{data.gewerkeMap[b.gewerk] ?? b.gewerk}</td>
								<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600">{formatCents(b.betrag)}</td>
								<td class="px-4 py-3 text-sm text-right font-mono tabular-nums {b.arbeitsanteilCents ? 'text-emerald-700 font-medium' : 'text-gray-600'}">
									{formatCents(anteil)}
									{#if b.arbeitsanteilCents}
										<div class="text-xs text-emerald-600 font-normal">Teilbetrag</div>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-right font-mono tabular-nums font-medium text-blue-700">{formatCents(steuerBetrag)}</td>
								<td class="px-4 py-3 text-center">
									{#if data.belegeVorhanden[b.id]}
										<svg class="w-4 h-4 text-emerald-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
									{:else}
										<svg class="w-4 h-4 text-amber-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
									{/if}
								</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/markieren" use:enhance>
										<input type="hidden" name="id" value={b.id} />
										<input type="hidden" name="steuerrelevant" value="false" />
										<button type="submit" class="text-xs text-red-500 hover:text-red-700 hover:underline">Entfernen</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-t bg-gray-50 font-medium">
							<td colspan="4" class="px-4 py-3 text-sm">Summe</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-emerald-700">{formatCents(jahresDaten.summe)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-blue-700">{formatCents(jahresDaten.erstattung)}</td>
							<td colspan="2"></td>
						</tr>
					</tfoot>
				</table>
			</div>
		{/if}

		<!-- Vorschläge -->
		{#if data.vorschlaege.length > 0}
			<details class="card" open={data.bestaetigt.length === 0}>
				<summary class="px-4 py-3 flex items-center gap-2 cursor-pointer select-none hover:bg-gray-50/50 rounded-lg">
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15" /></svg>
					<span class="text-sm font-semibold text-gray-700">Noch nicht zugeordnet</span>
					<span class="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{data.vorschlaege.length} Arbeitslohn-{data.vorschlaege.length === 1 ? 'Buchung' : 'Buchungen'}</span>
					<span class="text-xs text-gray-400 ml-auto">Diese Buchungen könnten §35a-fähig sein – prüfen und bestätigen</span>
				</summary>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="thead-row">
								<th class="px-4 py-3 text-left">Datum</th>
								<th class="px-4 py-3 text-left">Beschreibung</th>
								<th class="px-4 py-3 text-left">Gewerk</th>
								<th class="px-4 py-3 text-right">Betrag</th>
								<th class="px-4 py-3 text-center">Beleg</th>
								<th class="px-4 py-3"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.vorschlaege as b (b.id)}
								<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
									<td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDatum(b.datum)}</td>
									<td class="px-4 py-3 text-sm">
										<a href="/buchungen/{b.id}" class="font-medium text-gray-900 hover:text-blue-600 hover:underline">{b.beschreibung}</a>
										{#if b.taetigkeit}<div class="text-xs text-gray-400 italic">{b.taetigkeit}</div>{/if}
									</td>
									<td class="px-4 py-3 text-sm text-gray-600">{data.gewerkeMap[b.gewerk] ?? b.gewerk}</td>
									<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(b.betrag)}</td>
									<td class="px-4 py-3 text-center">
										{#if data.belegeVorhanden[b.id]}
											<svg class="w-4 h-4 text-emerald-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
										{:else}
											<svg class="w-4 h-4 text-amber-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
										{/if}
									</td>
									<td class="px-4 py-3 min-w-[200px]">
										{#if offeneMarkierung === b.id}
											<form
												method="POST"
												action="?/markieren"
												use:enhance={() => {
													return async ({ update }) => {
														offeneMarkierung = null;
														arbeitsanteilInput = '';
														await update();
													};
												}}
												class="flex items-center gap-2 flex-wrap"
											>
												<input type="hidden" name="id" value={b.id} />
												<input type="hidden" name="steuerrelevant" value="true" />
												<input
													type="text"
													name="arbeitsanteilEuro"
													bind:value={arbeitsanteilInput}
													placeholder="Arbeitsanteil € (leer = gesamt)"
													class="input-sm w-44 text-sm"
												/>
												<button type="submit" class="btn-primary text-xs py-1 px-2">Bestätigen</button>
												<button
													type="button"
													onclick={() => { offeneMarkierung = null; arbeitsanteilInput = ''; }}
													class="text-gray-400 text-xs hover:underline"
												>Abbrechen</button>
											</form>
										{:else}
											<button
												onclick={() => { offeneMarkierung = b.id; arbeitsanteilInput = ''; }}
												class="text-sm font-medium text-blue-600 hover:underline"
											>Als §35a markieren</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		{/if}
	{/if}

	<!-- Rechtlicher Hinweis -->
	<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 space-y-3">
		<div class="font-medium text-gray-700">Hinweis §35a EStG – Handwerkerleistungen</div>
		<p>20 % Steuerermäßigung auf Arbeitskosten (nicht Materialkosten), max. <strong class="text-gray-600">1.200 €/Jahr</strong> (= max. 6.000 € anrechenbare Arbeitslöhne). Zahlung muss <strong class="text-gray-600">unbar</strong> erfolgt sein – Barzahlung wird vom Finanzamt nicht anerkannt.</p>

		<div>
			<div class="font-medium text-gray-600 mb-1.5">Pflichtangaben auf der Rechnung</div>
			<ul class="space-y-1 text-gray-500">
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Name und Anschrift</strong> des Leistungserbringers (Handwerker/Firma) und des Auftraggebers (Eigentümer)</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Art und Umfang der Leistung</strong> – konkrete Tätigkeitsbeschreibung (z. B. „Verlegen von Fliesen, 25 m², Bad EG")</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Zeitraum der Leistungserbringung</strong> (Ausführungszeitraum, nicht nur das Rechnungsdatum)</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Arbeitskosten und Materialkosten getrennt ausgewiesen</strong> – nur der Arbeitslohnanteil ist §35a-fähig; bei Mischrechnung muss der Anteil erkennbar sein</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Rechnungsnummer</strong> und Rechnungsdatum</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Bankverbindung (IBAN)</strong> des Leistungserbringers – erforderlich für den Überweisungsnachweis</span>
				</li>
				<li class="flex gap-2">
					<svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					<span><strong class="text-gray-600">Zahlungsnachweis</strong> (Kontoauszug oder Überweisungsbeleg) – das Finanzamt kann diesen zusätzlich verlangen</span>
				</li>
			</ul>
		</div>

		<p class="text-xs text-gray-400 border-t border-gray-200 pt-2">Diese Auswertung dient als Arbeitshilfe – Angaben ohne Gewähr. Bitte alle Belege im Original aufbewahren und Angaben mit Ihrem Steuerberater abstimmen.</p>
	</div>
</div>
