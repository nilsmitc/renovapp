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

	const gesamtPct = $derived(data.gesamtBudget > 0 ? Math.round(data.gesamtIst / data.gesamtBudget * 100) : 0);

	// Lokale Kopie der Gewerke für optimistisches Drag & Drop
	let gewerkeLokal = $state(data.gewerke);
	$effect(() => { gewerkeLokal = data.gewerke; });

	// Drag & Drop Handlers
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
		if (id !== draggedId) dragOverId = id;
	}

	function onDragLeave() {
		dragOverId = null;
	}

	async function onDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		dragOverId = null;
		if (!draggedId || draggedId === targetId) { draggedId = null; return; }

		// Optimistisch umsortieren
		const arr = [...gewerkeLokal];
		const fromIdx = arr.findIndex(g => g.id === draggedId);
		const toIdx = arr.findIndex(g => g.id === targetId);
		if (fromIdx === -1 || toIdx === -1) { draggedId = null; return; }
		const [moved] = arr.splice(fromIdx, 1);
		arr.splice(toIdx, 0, moved);
		gewerkeLokal = arr;
		draggedId = null;

		// Server-Update
		const reihenfolge = arr.map(g => g.id);
		const formData = new FormData();
		formData.set('reihenfolge', JSON.stringify(reihenfolge));
		await fetch('?/sortieren', { method: 'POST', body: formData });
		invalidateAll();
	}

	function onDragEnd() {
		draggedId = null;
		dragOverId = null;
	}

	function budgetPct(id: string): number {
		const info = data.gewerkInfo[id];
		if (!info || info.budget === 0) return 0;
		return Math.round((info.ist / info.budget) * 100);
	}

	function budgetBarCls(pct: number): string {
		if (pct > 100) return 'bg-red-500';
		if (pct >= 80) return 'bg-yellow-400';
		return 'bg-green-500';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
			<h1 class="text-2xl font-bold text-gray-900">Gewerke</h1>
		</div>
		<button onclick={() => (zeigeFormular = !zeigeFormular)} class="btn-primary flex items-center gap-2">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
			Neues Gewerk
		</button>
	</div>

	<!-- KPI-Karten -->
	{#if gewerkeLokal.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
					Gewerke
				</div>
				<div class="text-xl font-bold font-mono mt-1">{gewerkeLokal.length}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
					Gesamtbudget
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtBudget)}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium {gesamtPct > 100 ? 'text-red-500' : gesamtPct >= 80 ? 'text-yellow-500' : 'text-gray-400'} uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
					Verbraucht
				</div>
				<div class="text-xl font-bold font-mono mt-1 {gesamtPct > 100 ? 'text-red-600' : gesamtPct >= 80 ? 'text-yellow-600' : 'text-green-600'}">{formatCents(data.gesamtIst)}</div>
				{#if data.gesamtBudget > 0}
					<div class="text-xs text-gray-400 mt-1">{gesamtPct}% des Budgets</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Fehler-Meldung -->
	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 animate-fade">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Neues Gewerk Formular -->
	{#if zeigeFormular}
		<div class="card animate-fade">
			<h2 class="mb-4 text-lg font-semibold text-gray-800">Neues Gewerk anlegen</h2>
			<form method="POST" action="?/add" use:enhance={({ formElement }) => {
				return async ({ result, update }) => {
					if (result.type !== 'failure') {
						formElement.reset();
						zeigeFormular = false;
					}
					await update();
				};
			}} class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
					<input type="text" name="name" id="name" required placeholder="z.B. Elektro" class="input-base" />
				</div>
				<div>
					<label for="farbe" class="mb-1 block text-sm font-medium text-gray-700">Farbe</label>
					<div class="flex gap-3 items-center">
						<input type="color" name="farbe" id="farbe" value="#6B7280" class="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer" />
						<span class="text-xs text-gray-400">Wird in Charts verwendet</span>
					</div>
				</div>
				<div class="md:col-span-2">
					<label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
						<input type="checkbox" name="pauschal" class="rounded" />
						Sammelgewerk – kein Budget-Alarm
						<span class="text-xs text-gray-400">(z.B. Generalunternehmer)</span>
					</label>
				</div>
				<div class="flex gap-3 md:col-span-2">
					<button type="submit" class="btn-primary">Gewerk anlegen</button>
					<button type="button" onclick={() => (zeigeFormular = false)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Gewerk-Karten -->
	{#if gewerkeLokal.length === 0}
		<div class="card py-12 text-center">
			<svg class="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" /></svg>
			<p class="mt-3 text-gray-500">Noch keine Gewerke angelegt</p>
			<button onclick={() => (zeigeFormular = true)} class="btn-primary mt-4">Erstes Gewerk anlegen</button>
		</div>
	{:else}
		<div class="space-y-3 stagger">
			{#each gewerkeLokal as gewerk, i (gewerk.id)}
				{@const info = data.gewerkInfo[gewerk.id]}
				{@const pct = budgetPct(gewerk.id)}
				{@const isDragging = draggedId === gewerk.id}
				{@const isDragOver = dragOverId === gewerk.id}
				<div
					class="card overflow-hidden transition-all duration-200 animate-in {isDragging ? 'opacity-50 scale-[0.98]' : ''} {isDragOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''}"
					draggable={editId !== gewerk.id ? 'true' : 'false'}
					ondragstart={(e) => onDragStart(e, gewerk.id)}
					ondragover={(e) => onDragOver(e, gewerk.id)}
					ondragleave={onDragLeave}
					ondrop={(e) => onDrop(e, gewerk.id)}
					ondragend={onDragEnd}
					role="listitem"
				>
					<!-- Farbbalken oben -->
					<div class="h-1" style="background-color: {gewerk.farbe}"></div>

					{#if editId === gewerk.id}
						<!-- Inline Edit -->
						<div class="p-4 animate-fade">
							<form method="POST" action="?/update" use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type !== 'failure') editId = null;
									await update();
								};
							}} class="grid grid-cols-1 gap-3 md:grid-cols-2">
								<input type="hidden" name="id" value={gewerk.id} />
								<div>
									<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
									<input type="text" name="name" value={gewerk.name} required class="input-base" />
								</div>
								<div>
									<label class="mb-1 block text-sm font-medium text-gray-700">Farbe</label>
									<input type="color" name="farbe" value={gewerk.farbe} class="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer" />
								</div>
								<div class="md:col-span-2">
									<label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
										<input type="checkbox" name="pauschal" checked={gewerk.pauschal ?? false} class="rounded" />
										Sammelgewerk – kein Budget-Alarm
									</label>
								</div>
								<div class="flex gap-3 md:col-span-2">
									<button type="submit" class="btn-primary">Speichern</button>
									<button type="button" onclick={() => (editId = null)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
								</div>
							</form>
						</div>
					{:else}
						<!-- Normale Ansicht -->
						<div class="p-4">
							<!-- Kopfzeile: Drag-Handle, Name, Actions -->
							<div class="flex items-center gap-3">
								<!-- Drag Handle -->
								<div class="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0" title="Ziehen zum Sortieren">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
								</div>

								<!-- Name + Badge -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<div class="w-4 h-4 rounded-sm shrink-0" style="background-color: {gewerk.farbe}"></div>
										<span class="font-semibold text-gray-900">{gewerk.name}</span>
										{#if gewerk.pauschal}
											<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Sammelgewerk</span>
										{/if}
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-1 shrink-0">
									<button onclick={() => (editId = gewerk.id)} class="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Bearbeiten">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
									</button>
									<form method="POST" action="?/delete" use:enhance class="inline">
										<input type="hidden" name="id" value={gewerk.id} />
										<button type="submit" class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Löschen"
											onclick={(e) => {
												const parts = [];
												if (info?.anzahlBuchungen) parts.push(`${info.anzahlBuchungen} Buchung${info.anzahlBuchungen > 1 ? 'en' : ''}`);
												if (info?.anzahlAuftraege) parts.push(`${info.anzahlAuftraege} ${info.anzahlAuftraege > 1 ? 'Aufträge' : 'Auftrag'}`);
												const hinweis = parts.length > 0 ? `\n\nAchtung: Gewerk hat ${parts.join(' und ')}!` : '';
												if (!confirm(`Gewerk "${gewerk.name}" wirklich löschen?${hinweis}`)) e.preventDefault();
											}}>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
										</button>
									</form>
								</div>
							</div>

							<!-- Budget-Info -->
							{#if info}
								<div class="mt-3">
									{#if !gewerk.pauschal && info.budget > 0}
										<div class="flex items-baseline gap-3 text-sm">
											<span class="text-gray-500">Budget: <span class="font-mono tabular-nums font-medium text-gray-700">{formatCents(info.budget)}</span></span>
											<span class="text-gray-300">·</span>
											<span class="text-gray-500">Ist: <span class="font-mono tabular-nums font-medium {pct > 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-green-600'}">{formatCents(info.ist)}</span></span>
											<span class="text-gray-300">·</span>
											<span class="font-mono tabular-nums text-sm font-medium {pct > 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-green-600'}">{pct}%</span>
										</div>
										<div class="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
											<div class="{budgetBarCls(pct)} h-full rounded-full transition-all duration-500" style="width: {Math.min(100, pct)}%"></div>
										</div>
									{:else if !gewerk.pauschal}
										<span class="text-xs text-gray-400">Kein Budget gesetzt</span>
										{#if info.ist > 0}
											<span class="text-xs text-gray-400 ml-2">· Ist: <span class="font-mono">{formatCents(info.ist)}</span></span>
										{/if}
									{/if}
								</div>

								<!-- Buchungen / Aufträge Links -->
								{#if info.anzahlBuchungen > 0 || info.anzahlAuftraege > 0}
									<div class="mt-2 flex gap-3 text-xs">
										{#if info.anzahlBuchungen > 0}
											<a href="/buchungen?gewerk={gewerk.id}" class="text-blue-500 hover:underline">{info.anzahlBuchungen} {info.anzahlBuchungen === 1 ? 'Buchung' : 'Buchungen'}</a>
										{/if}
										{#if info.anzahlAuftraege > 0}
											<a href="/rechnungen?gewerk={gewerk.id}" class="text-blue-500 hover:underline">{info.anzahlAuftraege} {info.anzahlAuftraege === 1 ? 'Auftrag' : 'Aufträge'}</a>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
