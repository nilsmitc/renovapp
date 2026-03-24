<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, centsToInputValue } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editGewerk = $state<string | null>(null);
	let zeigeTaetigkeit = $state<string | null>(null);

	// Sortierung: rot → gelb → grün → sammelgewerk → kein budget
	const sortiert = $derived.by(() => {
		return [...data.summaries].sort((a, b) => {
			const ra = ampelPrio(a);
			const rb = ampelPrio(b);
			return ra - rb;
		});
	});

	function ampelPrio(s: typeof data.summaries[0]): number {
		if (s.gewerk.pauschal) return 4;
		if (s.budget === 0) return 5;
		const rest = s.budget - s.ist - (data.verplantPerGewerk[s.gewerk.id]?.offen ?? 0) - (data.verplantPerGewerk[s.gewerk.id]?.restauftrag ?? 0);
		if (rest < 0) return 0; // rot
		if (rest <= s.budget * 0.2) return 1; // gelb
		return 2; // grün
	}

	function borderCls(s: typeof data.summaries[0]): string {
		if (s.gewerk.pauschal || s.budget === 0) return 'border-l-4 border-gray-200';
		const rest = s.budget - s.ist - (data.verplantPerGewerk[s.gewerk.id]?.offen ?? 0) - (data.verplantPerGewerk[s.gewerk.id]?.restauftrag ?? 0);
		if (rest < 0) return 'border-l-4 border-red-500';
		if (rest <= s.budget * 0.2) return 'border-l-4 border-yellow-400';
		return 'border-l-4 border-green-500';
	}

	function pct(ist: number, budget: number): number {
		return budget > 0 ? Math.round((ist / budget) * 100) : 0;
	}

	function pctCls(p: number): string {
		if (p > 100) return 'text-red-600';
		if (p >= 80) return 'text-yellow-600';
		return 'text-green-600';
	}

	function barCls(p: number): string {
		if (p > 100) return 'bg-red-500';
		if (p >= 80) return 'bg-yellow-400';
		return 'bg-green-500';
	}

	const gesamtFrei = $derived(data.gesamtBudget - data.gesamtIst - data.gesamtOffen - data.gesamtRestauftrag);
	const gesamtPct = $derived(data.gesamtBudget > 0 ? Math.round(data.gesamtIst / data.gesamtBudget * 100) : 0);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
		<h1 class="text-2xl font-bold text-gray-900">Budget</h1>
	</div>

	<!-- KPI-Karten -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
				Gesamtbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtBudget)}</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-green-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Bezahlt
			</div>
			<div class="text-xl font-bold font-mono mt-1 text-green-600">{formatCents(data.gesamtIst)}</div>
			<div class="text-xs text-gray-400 mt-1">{gesamtPct}% des Budgets</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium text-orange-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Offen + Restauftrag
			</div>
			<div class="text-xl font-bold font-mono mt-1 text-orange-500">{formatCents(data.gesamtOffen + data.gesamtRestauftrag)}</div>
			<div class="text-xs text-gray-400 mt-1">Gebunden in Aufträgen</div>
		</div>

		<div class="kpi-card animate-in">
			<div class="flex items-center gap-1.5 text-xs font-medium {gesamtFrei < 0 ? 'text-red-500' : 'text-gray-400'} uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Frei verfügbar
			</div>
			<div class="text-xl font-bold font-mono mt-1 {gesamtFrei < 0 ? 'text-red-600' : 'text-green-600'}">{formatCents(gesamtFrei)}</div>
		</div>
	</div>

	<!-- Fehler -->
	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 animate-fade">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Budget-Karten -->
	<div class="space-y-3 stagger">
		{#each sortiert as s (s.gewerk.id)}
			{@const v = data.verplantPerGewerk[s.gewerk.id] ?? { offen: 0, restauftrag: 0, anzahl: 0 }}
			{@const frei = s.budget - s.ist - v.offen - v.restauftrag}
			{@const p = pct(s.ist, s.budget)}
			{@const rechnungen = data.rechnungenPerGewerk[s.gewerk.id] ?? []}
			{@const notiz = data.notizen[s.gewerk.id] ?? ''}
			{@const taetigkeiten = data.taetigkeitSummaries[s.gewerk.id]}

			<div class="card overflow-hidden {borderCls(s)} animate-in">
				{#if editGewerk === s.gewerk.id}
					<!-- Inline Edit -->
					<div class="p-4 animate-fade">
						<form method="POST" action="?/update" use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type !== 'failure') editGewerk = null;
								await update();
							};
						}} class="grid grid-cols-1 gap-3 md:grid-cols-3">
							<input type="hidden" name="gewerk" value={s.gewerk.id} />
							<div>
								<label class="mb-1 block text-sm font-medium text-gray-700">Budget (€) *</label>
								<input type="text" name="geplant" value={s.budget > 0 ? centsToInputValue(s.budget) : ''} placeholder="z.B. 15.000,00" class="input-base" />
							</div>
							<div class="md:col-span-2">
								<label class="mb-1 block text-sm font-medium text-gray-700">Notiz</label>
								<input type="text" name="notiz" value={notiz} placeholder="Optional" class="input-base" />
							</div>
							<div class="flex gap-3 md:col-span-3">
								<button type="submit" class="btn-primary">Speichern</button>
								<button type="button" onclick={() => (editGewerk = null)} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
							</div>
						</form>
					</div>
				{:else}
					<!-- Normale Ansicht -->
					<div class="p-4">
						<!-- Kopfzeile -->
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2 flex-wrap">
								<div class="w-4 h-4 rounded-sm shrink-0" style="background-color: {s.gewerk.farbe}"></div>
								<span class="font-semibold text-gray-900">{s.gewerk.name}</span>
								{#if s.gewerk.pauschal}
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Sammelgewerk</span>
								{:else if s.budget > 0}
									{#if frei < 0}
										<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Über Budget</span>
									{:else if frei <= s.budget * 0.2}
										<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Knapp</span>
									{/if}
								{/if}
							</div>
							<button onclick={() => (editGewerk = s.gewerk.id)} class="btn-sm-secondary inline-flex items-center gap-1">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
								Bearbeiten
							</button>
						</div>

						<!-- Budget / Ist / % -->
						{#if s.budget > 0 && !s.gewerk.pauschal}
							<div class="mt-2 flex items-baseline gap-3 text-sm flex-wrap">
								<span class="text-gray-500">Budget: <span class="font-mono tabular-nums font-medium text-gray-700">{formatCents(s.budget)}</span></span>
								<span class="text-gray-300">·</span>
								<span class="text-gray-500">Ist: <span class="font-mono tabular-nums font-medium {pctCls(p)}">{formatCents(s.ist)}</span></span>
								<span class="text-gray-300">·</span>
								<span class="font-mono tabular-nums font-medium {pctCls(p)}">{p}%</span>
							</div>

							<!-- Stacked Bar -->
							{@const pBezahlt = Math.min(100, (s.ist / s.budget) * 100)}
							{@const pOffen = Math.min(100 - pBezahlt, (v.offen / s.budget) * 100)}
							{@const pRest = Math.min(100 - pBezahlt - pOffen, (v.restauftrag / s.budget) * 100)}
							<div class="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
								<div class="flex h-full">
									{#if pBezahlt > 0}<div class="bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style="width: {pBezahlt}%"></div>{/if}
									{#if pOffen > 0}<div class="bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-500" style="width: {pOffen}%"></div>{/if}
									{#if pRest > 0}<div class="bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500" style="width: {pRest}%"></div>{/if}
								</div>
							</div>

							<!-- Detail-Zeile -->
							<div class="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500">
								<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span>Bezahlt {formatCents(s.ist)}</span>
								{#if v.offen > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-orange-400"></span>Offen {formatCents(v.offen)}</span>{/if}
								{#if v.restauftrag > 0}<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-violet-500"></span>Restauftrag {formatCents(v.restauftrag)}</span>{/if}
							</div>

							<!-- Frei -->
							<div class="mt-2 text-sm">
								<span class="text-gray-500">Frei: </span>
								<span class="font-mono tabular-nums font-semibold {frei < 0 ? 'text-red-600' : 'text-green-600'}">{formatCents(frei)}</span>
							</div>
						{:else if !s.gewerk.pauschal}
							{#if s.ist > 0}
								<div class="mt-2 text-sm text-gray-500">Ist: <span class="font-mono tabular-nums font-medium text-gray-700">{formatCents(s.ist)}</span> · <span class="text-gray-400">Kein Budget gesetzt</span></div>
							{:else}
								<div class="mt-2 text-xs text-gray-400">Kein Budget gesetzt</div>
							{/if}
						{:else}
							<!-- Sammelgewerk -->
							{#if s.ist > 0}
								<div class="mt-2 text-sm text-gray-500">Ist: <span class="font-mono tabular-nums font-medium text-gray-700">{formatCents(s.ist)}</span></div>
							{/if}
						{/if}

						<!-- Aufträge kompakt -->
						{#if rechnungen.length > 0}
							<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
								{#each rechnungen as r}
									<a href="/rechnungen/{r.id}" class="inline-flex items-center gap-1 text-blue-500 hover:underline">
										{r.auftragnehmer}
										{#if r.bezahlt > 0}<span class="text-green-600">({formatCents(r.bezahlt)})</span>{/if}
										{#if r.offen > 0}<span class="{r.hatUeberfaellige ? 'text-red-500' : 'text-orange-500'}">+{formatCents(r.offen)} offen</span>{/if}
										{#if r.hatUeberfaellige}<span class="text-red-500">!</span>{/if}
									</a>
								{/each}
							</div>
						{/if}

						<!-- Tätigkeit-Aufschlüsselung (Sammelgewerke) -->
						{#if taetigkeiten && taetigkeiten.length > 0}
							<div class="mt-2">
								<button onclick={() => zeigeTaetigkeit = zeigeTaetigkeit === s.gewerk.id ? null : s.gewerk.id} class="text-xs text-blue-500 hover:underline">
									{zeigeTaetigkeit === s.gewerk.id ? 'Aufschlüsselung verbergen' : 'Aufschlüsselung anzeigen'}
								</button>
								{#if zeigeTaetigkeit === s.gewerk.id}
									<div class="mt-1.5 space-y-0.5">
										{#each taetigkeiten as t}
											<div class="flex justify-between text-xs text-gray-500">
												<span>{t.taetigkeit}</span>
												<span class="font-mono tabular-nums">{formatCents(t.betrag)}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Notiz -->
						{#if notiz}
							<div class="mt-2 text-xs text-gray-400 italic">{notiz}</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Summen-Karte -->
	{#if data.summaries.length > 0}
		{@const gesamtRestauftrag = Object.values(data.verplantPerGewerk).reduce((s, v) => s + v.restauftrag, 0)}
		<div class="card p-4 bg-gray-50/50 animate-in">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<span class="text-sm font-semibold text-gray-600">Gesamt</span>
				<div class="flex flex-wrap gap-4 text-sm font-mono tabular-nums">
					<span class="text-gray-500">Budget: <span class="font-semibold text-gray-700">{formatCents(data.gesamtBudget)}</span></span>
					<span class="text-gray-500">Ist: <span class="font-semibold text-green-600">{formatCents(data.gesamtIst)}</span></span>
					{#if data.gesamtOffen > 0}<span class="text-gray-500">Offen: <span class="font-semibold text-orange-500">{formatCents(data.gesamtOffen)}</span></span>{/if}
					<span class="text-gray-500">Frei: <span class="font-semibold {gesamtFrei < 0 ? 'text-red-600' : 'text-green-600'}">{formatCents(gesamtFrei)}</span></span>
				</div>
			</div>
		</div>
	{/if}
</div>
