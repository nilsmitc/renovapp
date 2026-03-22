<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatCents } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editId = $state<string | null>(null);
	let zeigeFormular = $state(false);
	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	const geschosse = ['KG', 'EG', 'OG', 'DG'];
	const geschossLabels: Record<string, string> = { KG: 'Kellergeschoss', EG: 'Erdgeschoss', OG: 'Obergeschoss', DG: 'Dachgeschoss' };

	// Lokale Kopie für optimistisches Drag & Drop
	let raeumeLokal = $state(data.raeume);
	$effect(() => { raeumeLokal = data.raeume; });

	function onDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}

	function onDragOver(e: DragEvent, id: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		// Nur innerhalb desselben Geschosses
		if (draggedId && id !== draggedId) {
			const from = raeumeLokal.find(r => r.id === draggedId);
			const to = raeumeLokal.find(r => r.id === id);
			if (from && to && from.geschoss === to.geschoss) dragOverId = id;
		}
	}

	function onDragLeave() { dragOverId = null; }

	async function onDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		dragOverId = null;
		if (!draggedId || draggedId === targetId) { draggedId = null; return; }

		const from = raeumeLokal.find(r => r.id === draggedId);
		const to = raeumeLokal.find(r => r.id === targetId);
		if (!from || !to || from.geschoss !== to.geschoss) { draggedId = null; return; }

		// Optimistisch umsortieren
		const arr = [...raeumeLokal];
		const fromIdx = arr.findIndex(r => r.id === draggedId);
		const toIdx = arr.findIndex(r => r.id === targetId);
		const [moved] = arr.splice(fromIdx, 1);
		arr.splice(toIdx, 0, moved);
		raeumeLokal = arr;
		draggedId = null;

		const reihenfolge = arr.map(r => r.id);
		const formData = new FormData();
		formData.set('reihenfolge', JSON.stringify(reihenfolge));
		await fetch('?/sortieren', { method: 'POST', body: formData });
		invalidateAll();
	}

	function onDragEnd() { draggedId = null; dragOverId = null; }

	// Teuerster Raum
	const topRaum = $derived(data.topRaumId ? data.raeume.find(r => r.id === data.topRaumId) : null);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
			<h1 class="text-2xl font-bold text-gray-900">Räume</h1>
		</div>
		<button onclick={() => (zeigeFormular = !zeigeFormular)} class="btn-primary flex items-center gap-2">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
			Neuer Raum
		</button>
	</div>

	<!-- KPI-Karten -->
	{#if raeumeLokal.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
					Räume
				</div>
				<div class="text-xl font-bold font-mono mt-1">{raeumeLokal.length}</div>
				<div class="text-xs text-gray-400 mt-1">{new Set(raeumeLokal.map(r => r.geschoss)).size} Geschosse</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
					Raumgebundene Kosten
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtIst)}</div>
			</div>

			{#if topRaum}
				<a href="/buchungen?raum={topRaum.id}" class="kpi-card animate-in hover:ring-2 hover:ring-blue-200 transition-all">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /></svg>
						Teuerster Raum
					</div>
					<div class="text-xl font-bold font-mono mt-1">{formatCents(data.topRaumIst)}</div>
					<div class="text-xs text-blue-500 mt-1">{topRaum.name} ({topRaum.geschoss})</div>
				</a>
			{/if}
		</div>
	{/if}

	<!-- Fehler -->
	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 animate-fade">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Neuer Raum Formular -->
	{#if zeigeFormular}
		<div class="card animate-fade">
			<h2 class="mb-4 text-lg font-semibold text-gray-800">Neuen Raum anlegen</h2>
			<form method="POST" action="?/add" use:enhance={({ formElement }) => {
				return async ({ result, update }) => {
					if (result.type !== 'failure') { formElement.reset(); zeigeFormular = false; }
					await update();
				};
			}} class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
					<input type="text" name="name" id="name" required placeholder="z.B. Küche" class="input-base" />
				</div>
				<div>
					<label for="geschoss" class="mb-1 block text-sm font-medium text-gray-700">Geschoss *</label>
					<select name="geschoss" id="geschoss" required class="input-base">
						{#each geschosse as g}
							<option value={g}>{geschossLabels[g]} ({g})</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="flaeche" class="mb-1 block text-sm font-medium text-gray-700">Fläche (m²)</label>
					<input type="text" name="flaeche" id="flaeche" placeholder="z.B. 12,5" class="input-base" />
				</div>
				<div class="flex gap-3 md:col-span-3">
					<button type="submit" class="btn-primary">Raum anlegen</button>
					<button type="button" onclick={() => (zeigeFormular = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Räume nach Geschoss -->
	{#if raeumeLokal.length === 0}
		<div class="card py-12 text-center">
			<svg class="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
			<p class="mt-3 text-gray-500">Noch keine Räume angelegt</p>
			<button onclick={() => (zeigeFormular = true)} class="btn-primary mt-4">Ersten Raum anlegen</button>
		</div>
	{:else}
		<div class="space-y-6 stagger">
			{#each geschosse as geschoss}
				{@const gRaeume = raeumeLokal.filter(r => r.geschoss === geschoss)}
				{@const gInfo = data.geschossInfo[geschoss]}
				{#if gRaeume.length > 0}
					<div class="animate-in">
						<!-- Geschoss-Header -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<h2 class="text-sm font-semibold text-gray-700">{geschossLabels[geschoss]} ({geschoss})</h2>
								<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{gRaeume.length} {gRaeume.length === 1 ? 'Raum' : 'Räume'}</span>
							</div>
							{#if gInfo && gInfo.ist > 0}
								<span class="text-xs font-mono tabular-nums text-gray-500">{formatCents(gInfo.ist)}</span>
							{/if}
						</div>

						<!-- Raum-Karten -->
						<div class="space-y-2">
							{#each gRaeume as raum (raum.id)}
								{@const info = data.raumInfo[raum.id]}
								{@const isDragging = draggedId === raum.id}
								{@const isDragOver = dragOverId === raum.id}
								<div
									class="card overflow-hidden transition-all duration-200 {isDragging ? 'opacity-50 scale-[0.98]' : ''} {isDragOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''}"
									draggable={editId !== raum.id ? 'true' : 'false'}
									ondragstart={(e) => onDragStart(e, raum.id)}
									ondragover={(e) => onDragOver(e, raum.id)}
									ondragleave={onDragLeave}
									ondrop={(e) => onDrop(e, raum.id)}
									ondragend={onDragEnd}
									role="listitem"
								>
									{#if editId === raum.id}
										<!-- Inline Edit -->
										<div class="p-4 animate-fade">
											<form method="POST" action="?/update" use:enhance={() => {
												return async ({ result, update }) => {
													if (result.type !== 'failure') editId = null;
													await update();
												};
											}} class="grid grid-cols-1 gap-3 md:grid-cols-4">
												<input type="hidden" name="id" value={raum.id} />
												<div>
													<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
													<input type="text" name="name" value={raum.name} required class="input-base" />
												</div>
												<div>
													<label class="mb-1 block text-sm font-medium text-gray-700">Geschoss *</label>
													<select name="geschoss" required class="input-base">
														{#each geschosse as g}
															<option value={g} selected={g === raum.geschoss}>{g}</option>
														{/each}
													</select>
												</div>
												<div>
													<label class="mb-1 block text-sm font-medium text-gray-700">Fläche (m²)</label>
													<input type="text" name="flaeche" value={raum.flaeche ?? ''} placeholder="z.B. 12,5" class="input-base" />
												</div>
												<div class="flex items-end gap-2">
													<button type="submit" class="btn-primary">Speichern</button>
													<button type="button" onclick={() => (editId = null)} class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
												</div>
											</form>
										</div>
									{:else}
										<!-- Normale Ansicht -->
										<div class="p-4">
											<div class="flex items-center gap-3">
												<!-- Drag Handle -->
												<div class="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0" title="Ziehen zum Sortieren">
													<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
												</div>

												<!-- Name + Fläche -->
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 flex-wrap">
														<span class="font-semibold text-gray-900">{raum.name}</span>
														{#if raum.flaeche}
															<span class="text-xs text-gray-400">{raum.flaeche} m²</span>
														{/if}
													</div>
												</div>

												<!-- Actions -->
												<div class="flex items-center gap-1 shrink-0">
													<button onclick={() => (editId = raum.id)} class="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Bearbeiten">
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
													</button>
													<form method="POST" action="?/delete" use:enhance class="inline">
														<input type="hidden" name="id" value={raum.id} />
														<button type="submit" class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Löschen"
															onclick={(e) => {
																const n = info?.anzahlBuchungen ?? 0;
																const hinweis = n > 0 ? `\n\nAchtung: Raum hat ${n} Buchung${n > 1 ? 'en' : ''}!` : '';
																if (!confirm(`Raum "${raum.name}" wirklich löschen?${hinweis}`)) e.preventDefault();
															}}>
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
														</button>
													</form>
												</div>
											</div>

											<!-- Kosten-Info -->
											{#if info && info.ist > 0}
												<div class="mt-2 flex items-baseline gap-3 text-sm">
													<span class="font-mono tabular-nums font-medium text-gray-700">{formatCents(info.ist)}</span>
													{#if raum.flaeche && raum.flaeche > 0}
														<span class="text-gray-300">·</span>
														<span class="text-xs font-mono tabular-nums text-gray-500">{(info.ist / 100 / raum.flaeche).toFixed(2).replace('.', ',')} €/m²</span>
													{/if}
												</div>

												<!-- Gewerk-Balken -->
												{@const gewerkEntries = Object.entries(info.nachGewerk).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)}
												{#if gewerkEntries.length > 0}
													<div class="mt-2 h-1.5 flex rounded-full bg-gray-100 overflow-hidden">
														{#each gewerkEntries as [gId, betrag]}
															{@const gewerk = data.gewerke.find(g => g.id === gId)}
															<div
																class="h-full transition-all duration-500"
																style="width: {(betrag / info.ist) * 100}%; background-color: {gewerk?.farbe ?? '#94a3b8'}"
																title="{gewerk?.name ?? gId}: {formatCents(betrag)}"
															></div>
														{/each}
													</div>
												{/if}

												<div class="mt-1.5">
													<a href="/buchungen?raum={raum.id}" class="text-xs text-blue-500 hover:underline">{info.anzahlBuchungen} {info.anzahlBuchungen === 1 ? 'Buchung' : 'Buchungen'}</a>
												</div>
											{:else}
												<div class="mt-2 text-xs text-gray-400">Keine Buchungen</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
