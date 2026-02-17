<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editId = $state<string | null>(null);
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
		Gewerke
	</h1>

	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Add form -->
	<form method="POST" action="?/add" use:enhance class="card p-4">
		<h2 class="text-sm font-semibold text-gray-700 mb-3">Neues Gewerk</h2>
		<div class="flex gap-3 items-end">
			<div class="flex-1">
				<label for="name" class="block text-sm text-gray-600 mb-1">Name</label>
				<input type="text" name="name" id="name" required
					class="input-base" placeholder="z.B. Elektro" />
			</div>
			<div>
				<label for="farbe" class="block text-sm text-gray-600 mb-1">Farbe</label>
				<input type="color" name="farbe" id="farbe" value="#6B7280" class="h-10 w-14 rounded-md border border-gray-300 cursor-pointer" />
			</div>
			<button type="submit" class="btn-primary inline-flex items-center gap-1.5">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
				Hinzufügen
			</button>
		</div>
	</form>

	<!-- List -->
	<div class="card">
		<table class="w-full">
			<thead>
				<tr class="thead-row">
					<th class="px-4 py-3 w-10">Farbe</th>
					<th class="px-4 py-3">Name</th>
					<th class="px-4 py-3 w-48 text-right">Aktionen</th>
				</tr>
			</thead>
			<tbody>
				{#each data.gewerke as gewerk (gewerk.id)}
					<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
						{#if editId === gewerk.id}
							<td colspan="3" class="px-4 py-3">
								<form method="POST" action="?/update" use:enhance={() => { return async ({ update }) => { editId = null; update(); }; }} class="flex gap-3 items-end">
									<input type="hidden" name="id" value={gewerk.id} />
									<div class="flex-1">
										<input type="text" name="name" value={gewerk.name} required
											class="input-base" />
									</div>
									<input type="color" name="farbe" value={gewerk.farbe} class="h-10 w-14 rounded-md border border-gray-300 cursor-pointer" />
									<button type="submit" class="btn-sm-primary inline-flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" /></svg>
										Speichern
									</button>
									<button type="button" onclick={() => editId = null} class="btn-sm-secondary inline-flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
										Abbrechen
									</button>
								</form>
							</td>
						{:else}
							<td class="px-4 py-3">
								<div class="w-6 h-6 rounded" style="background-color: {gewerk.farbe}"></div>
							</td>
							<td class="px-4 py-3 text-sm font-medium">{gewerk.name}</td>
							<td class="px-4 py-3 text-right">
								<button onclick={() => editId = gewerk.id} class="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline mr-3 font-medium transition-colors">
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
									Bearbeiten
								</button>
								<form method="POST" action="?/delete" use:enhance class="inline">
									<input type="hidden" name="id" value={gewerk.id} />
									<button type="submit" class="inline-flex items-center gap-1 text-red-600 text-sm hover:underline font-medium transition-colors"
										onclick={(e) => { if (!confirm('Gewerk wirklich löschen?')) e.preventDefault(); }}>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
										Löschen
									</button>
								</form>
							</td>
						{/if}
					</tr>
				{/each}
				{#if data.gewerke.length === 0}
					<tr><td colspan="3" class="px-4 py-12 text-center text-gray-400 text-sm">
					<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
					Noch keine Gewerke angelegt
				</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
