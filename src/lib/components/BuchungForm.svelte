<script lang="ts">
	import { enhance } from '$app/forms';
	import { KATEGORIEN, type Gewerk, type Raum } from '$lib/domain';
	import { centsToInputValue } from '$lib/format';

	interface Props {
		gewerke: Gewerk[];
		raeume: Raum[];
		values?: {
			datum?: string;
			betrag?: number;
			gewerk?: string;
			raum?: string | null;
			kategorie?: string;
			beschreibung?: string;
			rechnungsreferenz?: string;
		};
		defaultGewerk?: string | null;
		belege?: string[];
		buchungId?: string;
		error?: string;
		submitLabel?: string;
		action?: string;
	}

	let { gewerke, raeume, values = {}, defaultGewerk = null, belege = [], buchungId, error = '', submitLabel = 'Speichern', action }: Props = $props();

	const geschosse = $derived([...new Set(raeume.map((r) => r.geschoss))].sort());
	const isRueckbuchung = $derived((values.betrag ?? 0) < 0);

	const today = new Date().toISOString().slice(0, 10);

	function isPdf(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}
</script>

{#if error}
	<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200 mb-4">
		<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
		{error}
	</div>
{/if}

<form method="POST" action={action} use:enhance enctype="multipart/form-data" class="card p-6 space-y-4">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="datum" class="block text-sm font-medium text-gray-700 mb-1">Datum</label>
			<input type="date" name="datum" id="datum" required
				value={values.datum ?? today}
				class="input-base" />
		</div>

		<div>
			<label for="betrag" class="block text-sm font-medium text-gray-700 mb-1">Betrag (EUR)</label>
			<input type="text" name="betrag" id="betrag" required inputmode="decimal"
				value={values.betrag ? centsToInputValue(Math.abs(values.betrag)) : ''}
				placeholder="z.B. 234,50"
				class="input-base" />
			<div class="flex items-center gap-2 mt-1.5">
				<input type="checkbox" name="rueckbuchung" id="rueckbuchung"
					checked={isRueckbuchung} class="rounded" />
				<label for="rueckbuchung" class="text-sm text-gray-700">Rückbuchung / Gutschrift</label>
			</div>
		</div>

		<div>
			<label for="gewerk" class="block text-sm font-medium text-gray-700 mb-1">Gewerk</label>
			<select name="gewerk" id="gewerk" required class="input-base">
				<option value="">— Bitte wählen —</option>
				{#each gewerke as g}
					<option value={g.id} selected={(values.gewerk ?? defaultGewerk) === g.id}>{g.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="raum" class="block text-sm font-medium text-gray-700 mb-1">Ort <span class="text-gray-400">(optional)</span></label>
			<select name="raum" id="raum" class="input-base">
				<option value="">— Kein Ort —</option>
				<optgroup label="Stockwerk">
					{#each geschosse as g}
						<option value="@{g}" selected={values.raum === `@${g}`}>{g} (ganzes Stockwerk)</option>
					{/each}
				</optgroup>
				{#each geschosse as g}
					<optgroup label="Einzelräume – {g}">
						{#each raeume.filter((r) => r.geschoss === g).sort((a, b) => a.sortierung - b.sortierung) as r}
							<option value={r.id} selected={values.raum === r.id}>{r.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>

		<div>
			<label for="kategorie" class="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
			<select name="kategorie" id="kategorie" required class="input-base">
				{#each KATEGORIEN as k}
					<option value={k} selected={values.kategorie === k}>{k}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="rechnungsreferenz" class="block text-sm font-medium text-gray-700 mb-1">Rechnungsreferenz <span class="text-gray-400">(optional)</span></label>
			<input type="text" name="rechnungsreferenz" id="rechnungsreferenz"
				value={values.rechnungsreferenz ?? ''}
				placeholder="z.B. RE-2026-001"
				class="input-base" />
		</div>
	</div>

	<div>
		<label for="beschreibung" class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
		<input type="text" name="beschreibung" id="beschreibung" required
			value={values.beschreibung ?? ''}
			placeholder="z.B. Kabel NYM-J 5x2,5"
			class="input-base" />
	</div>

	<!-- Belege -->
	<div>
		<label for="belege" class="block text-sm font-medium text-gray-700 mb-1">Belege <span class="text-gray-400">(optional)</span></label>
		<input type="file" name="belege" id="belege" multiple accept=".pdf,.jpg,.jpeg,.png"
			class="input-base file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
		<p class="text-xs text-gray-400 mt-1">PDF, JPG oder PNG</p>
	</div>

	<!-- Vorhandene Belege (Edit-Modus) -->
	{#if belege.length > 0 && buchungId}
		<div>
			<div class="text-sm font-medium text-gray-700 mb-2">Vorhandene Belege</div>
			<div class="flex flex-wrap gap-2">
				{#each belege as beleg}
					<div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm">
						{#if isPdf(beleg)}
							<svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm2-10h2v4H6V8zm3 0h2v4H9V8zm3 0h2v4h-2V8z"/></svg>
						{:else}
							<svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
						{/if}
						<a href="/belege/{buchungId}/{beleg}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">{beleg}</a>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex gap-3 pt-2">
		<button type="submit" class="btn-primary inline-flex items-center gap-1.5">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" /></svg>
			{submitLabel}
		</button>
		<a href="/buchungen" class="btn-secondary inline-flex items-center gap-1.5">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
			Abbrechen
		</a>
	</div>
</form>
