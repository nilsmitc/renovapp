<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editId = $state<string | null>(null);

	const geschosse = ['KG', 'EG', 'OG', 'DG'];
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
		Räume
	</h1>

	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Add form -->
	<form method="POST" action="?/add" use:enhance class="card p-4">
		<h2 class="text-sm font-semibold text-gray-700 mb-3">Neuer Raum</h2>
		<div class="flex gap-3 items-end">
			<div class="flex-1">
				<label for="name" class="block text-sm text-gray-600 mb-1">Name</label>
				<input type="text" name="name" id="name" required
					class="input-base" placeholder="z.B. Küche" />
			</div>
			<div>
				<label for="geschoss" class="block text-sm text-gray-600 mb-1">Geschoss</label>
				<select name="geschoss" id="geschoss" required class="input-sm">
					{#each geschosse as g}
						<option value={g}>{g}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="btn-primary inline-flex items-center gap-1.5">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
				Hinzufügen
			</button>
		</div>
	</form>

	<!-- List grouped by Geschoss -->
	{#each geschosse as geschoss}
		{@const raeume = data.raeume.filter((r) => r.geschoss === geschoss)}
		{#if raeume.length > 0}
			<div class="card">
				<h2 class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b bg-gray-50/80 rounded-t-lg">{geschoss}</h2>
				<table class="w-full">
					<tbody>
						{#each raeume as raum (raum.id)}
							<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
								{#if editId === raum.id}
									<td colspan="2" class="px-4 py-3">
										<form method="POST" action="?/update" use:enhance={() => { return async ({ update }) => { editId = null; update(); }; }} class="flex gap-3 items-end">
											<input type="hidden" name="id" value={raum.id} />
											<div class="flex-1">
												<input type="text" name="name" value={raum.name} required
													class="input-base" />
											</div>
											<select name="geschoss" required class="input-sm">
												{#each geschosse as g}
													<option value={g} selected={g === raum.geschoss}>{g}</option>
												{/each}
											</select>
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
									<td class="px-4 py-3 text-sm font-medium">{raum.name}</td>
									<td class="px-4 py-3 text-right">
										<button onclick={() => editId = raum.id} class="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline mr-3 font-medium transition-colors">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
											Bearbeiten
										</button>
										<form method="POST" action="?/delete" use:enhance class="inline">
											<input type="hidden" name="id" value={raum.id} />
											<button type="submit" class="inline-flex items-center gap-1 text-red-600 text-sm hover:underline font-medium transition-colors"
												onclick={(e) => { if (!confirm('Raum wirklich löschen?')) e.preventDefault(); }}>
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
												Löschen
											</button>
										</form>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/each}
</div>
