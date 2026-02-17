<script lang="ts">
	import { enhance } from '$app/forms';
	import BuchungForm from '$lib/components/BuchungForm.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
			<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
			Buchung bearbeiten
		</h1>
		<form method="POST" action="?/delete" use:enhance>
			<button type="submit" class="inline-flex items-center gap-1 text-red-600 text-sm hover:underline"
				onclick={(e) => { if (!confirm('Buchung wirklich löschen?')) e.preventDefault(); }}>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
				Löschen
			</button>
		</form>
	</div>

	<BuchungForm
		gewerke={data.gewerke}
		raeume={data.raeume}
		values={(form as any)?.values ?? data.buchung}
		belege={data.buchung.belege}
		buchungId={data.buchung.id}
		error={form?.error}
		submitLabel="Änderungen speichern"
		action="?/update"
	/>

	<!-- Beleg löschen -->
	{#if data.buchung.belege.length > 0}
		<div class="bg-white p-4 rounded-lg shadow-sm border">
			<h3 class="text-sm font-medium text-gray-700 mb-2">Belege verwalten</h3>
			<div class="space-y-2">
				{#each data.buchung.belege as beleg}
					<div class="flex items-center justify-between py-1">
						<a href="/belege/{data.buchung.id}/{beleg}" target="_blank" class="text-blue-600 hover:underline text-sm">{beleg}</a>
						<form method="POST" action="?/deleteBeleg" use:enhance>
							<input type="hidden" name="dateiname" value={beleg} />
							<button type="submit" class="inline-flex items-center gap-1 text-red-600 text-xs hover:underline"
								onclick={(e) => { if (!confirm(`Beleg "${beleg}" löschen?`)) e.preventDefault(); }}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
								Entfernen
							</button>
						</form>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
