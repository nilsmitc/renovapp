<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, centsToInputValue } from '$lib/format';
	import { abschlagEffektivStatus, KATEGORIEN } from '$lib/domain';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let zeigeFormular = $state(false);
	let formError = $state('');

	// Rechnungen nach Gewerk gruppieren
	const rechnungenNachGewerk = $derived.by(() => {
		const map = new Map<string, typeof data.rechnungen>();
		for (const g of data.gewerke) {
			const r = data.rechnungen.filter((r) => r.gewerk === g.id);
			if (r.length > 0) map.set(g.id, r);
		}
		// Rechnungen ohne passendes Gewerk (sollte nicht vorkommen)
		const ohneGewerk = data.rechnungen.filter(
			(r) => !data.gewerke.find((g) => g.id === r.gewerk)
		);
		if (ohneGewerk.length > 0) map.set('__unbekannt__', ohneGewerk);
		return map;
	});

	function rechnungSumme(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function rechnungBasis(rechnung: (typeof data.rechnungen)[0]) {
		const nachtraege = rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0);
		return rechnung.auftragssumme !== undefined
			? rechnung.auftragssumme + nachtraege
			: rechnungSumme(rechnung);
	}

	function rechnungBezahlt(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege
			.filter((a) => a.status === 'bezahlt')
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function rechnungOffen(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege
			.filter((a) => {
				const s = abschlagEffektivStatus(a);
				return s === 'offen' || s === 'ueberfaellig';
			})
			.reduce((s, a) => s + a.rechnungsbetrag, 0);
	}

	function hatUeberfaellige(rechnung: (typeof data.rechnungen)[0]) {
		return rechnung.abschlaege.some((a) => abschlagEffektivStatus(a) === 'ueberfaellig');
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			<h1 class="text-2xl font-bold text-gray-900">Aufträge</h1>
		</div>
		<button
			onclick={() => (zeigeFormular = !zeigeFormular)}
			class="btn-primary flex items-center gap-2"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			Neue Rechnung
		</button>
	</div>

	{#if zeigeFormular}
		<div class="card">
			<h2 class="mb-4 text-lg font-semibold text-gray-800">Neue Rechnung anlegen</h2>
			{#if formError}
				<div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
			{/if}
			<form
				method="POST"
				action="?/erstellen"
				use:enhance={({ formElement }) => {
					formError = '';
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							formError = (result.data?.error as string) ?? 'Fehler';
						} else {
							formElement.reset();
							zeigeFormular = false;
						}
						await update();
					};
				}}
				class="grid grid-cols-1 gap-4 md:grid-cols-2"
			>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="gewerk">Gewerk *</label>
					<select name="gewerk" id="gewerk" required class="input-base">
						<option value="">— Gewerk wählen —</option>
						{#each data.gewerke as g}
							<option value={g.id}>{g.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragnehmer">Auftragnehmer *</label>
					<input
						type="text"
						name="auftragnehmer"
						id="auftragnehmer"
						required
						placeholder="z.B. Elektriker GmbH"
						class="input-base"
					/>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="kategorie">Buchungs-Kategorie *</label>
					<select name="kategorie" id="kategorie" required class="input-base">
						{#each KATEGORIEN as k}
							<option value={k} selected={k === 'Arbeitslohn'}>{k}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500">Wird beim Bezahlen für die Buchung verwendet</p>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragssumme">Auftragssumme (€)</label>
					<input
						type="text"
						name="auftragssumme"
						id="auftragssumme"
						placeholder="z.B. 20.000,00"
						class="input-base"
					/>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="auftragsdatum">Auftragsdatum</label>
					<input type="date" name="auftragsdatum" id="auftragsdatum" class="input-base" />
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="notiz">Notiz</label>
					<input
						type="text"
						name="notiz"
						id="notiz"
						placeholder="Optional"
						class="input-base"
					/>
				</div>

				<div class="flex gap-3 md:col-span-2">
					<button type="submit" class="btn-primary">Rechnung anlegen</button>
					<button
						type="button"
						onclick={() => (zeigeFormular = false)}
						class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Abbrechen
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.rechnungen.length === 0}
		<div class="card py-12 text-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			<p class="mt-3 text-gray-500">Noch keine Rechnungen angelegt</p>
			<button onclick={() => (zeigeFormular = true)} class="btn-primary mt-4">Erste Rechnung anlegen</button>
		</div>
	{:else}
		{#each data.gewerke as gewerk}
			{@const gRechnungen = data.rechnungen.filter((r) => r.gewerk === gewerk.id)}
			{#if gRechnungen.length > 0}
				<div class="card">
					<div class="mb-4 flex items-center gap-3">
						<div class="h-3 w-3 rounded-full" style="background-color: {gewerk.farbe}"></div>
						<h2 class="text-base font-semibold text-gray-800">{gewerk.name}</h2>
						<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
							{gRechnungen.length} {gRechnungen.length === 1 ? 'Rechnung' : 'Rechnungen'}
						</span>
					</div>

					<div class="space-y-3">
						{#each gRechnungen as rechnung}
							{@const gestellt = rechnungSumme(rechnung)}
							{@const bezahlt = rechnungBezahlt(rechnung)}
							{@const offen = rechnungOffen(rechnung)}
							{@const ueberfaellig = hatUeberfaellige(rechnung)}
							<a
								href="/rechnungen/{rechnung.id}"
								class="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="font-medium text-gray-900">{rechnung.auftragnehmer}</span>
										{#if ueberfaellig}
											<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Überfällig</span>
										{:else if offen > 0}
											<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Offen</span>
										{:else if gestellt > 0}
											<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bezahlt</span>
										{/if}
									</div>
									<div class="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
										{#if rechnung.auftragssumme}
											{@const nachtraege = rechnung.nachtraege.reduce((s, n) => s + n.betrag, 0)}
											<span>Auftrag: {formatCents(rechnung.auftragssumme + nachtraege)}{#if nachtraege > 0}<span class="text-orange-500"> (+{formatCents(nachtraege)} NT)</span>{/if}</span>
										{/if}
										{#if gestellt > 0}
											<span>Gestellt: {formatCents(gestellt)}</span>
										{/if}
										{#if bezahlt > 0}
											<span class="text-green-600">Bezahlt: {formatCents(bezahlt)}</span>
										{/if}
										{#if offen > 0}
											<span class={ueberfaellig ? 'text-red-600' : 'text-yellow-600'}>Offen: {formatCents(offen)}</span>
										{/if}
										{#if rechnung.abschlaege.length > 0}
											<span>{rechnung.abschlaege.length} {rechnung.abschlaege.length === 1 ? 'Abschlag' : 'Abschläge'}</span>
										{/if}
									</div>

									{#if gestellt > 0}
										{@const base = rechnungBasis(rechnung)}
										{@const bezahltPct = Math.min(100, (bezahlt / base) * 100)}
										{@const offenPct = Math.min(100 - bezahltPct, (offen / base) * 100)}
										<div class="mt-2 flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
											<div class="bg-green-500 transition-all" style="width: {bezahltPct}%"></div>
											<div class="bg-yellow-400 transition-all" style="width: {offenPct}%"></div>
										</div>
									{/if}
								</div>
								<svg xmlns="http://www.w3.org/2000/svg" class="ml-4 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
								</svg>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>
