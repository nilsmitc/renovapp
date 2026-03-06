<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents, centsToInputValue } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editGewerk = $state<string | null>(null);

	function ampelClass(restbudget: number, budget: number, pauschal?: boolean): string {
		if (pauschal) return '';
		if (budget === 0) return '';
		if (restbudget < 0) return 'bg-red-50 text-red-900';
		if (restbudget <= budget * 0.1) return 'bg-yellow-50 text-yellow-900';
		return '';
	}

	function ampelBadge(restbudget: number, budget: number, pauschal?: boolean): { label: string; class: string } | null {
		if (pauschal) return null;
		if (budget === 0) return null;
		if (restbudget < 0) return { label: '🔴', class: 'bg-red-100 text-red-700' };
		if (restbudget <= budget * 0.1) return { label: '🟡', class: 'bg-yellow-100 text-yellow-700' };
		return { label: '🟢', class: 'bg-green-100 text-green-700' };
	}

	function getStackedBarWidths(ist: number, offen: number, restauftrag: number, budget: number) {
		if (budget === 0) return { bezahlt: 0, offen: 0, restauftrag: 0 };
		const total = ist + offen + restauftrag;
		return {
			bezahlt: Math.min(100, (ist / budget) * 100),
			offen: Math.min(100 - (ist / budget) * 100, (offen / budget) * 100),
			restauftrag: Math.min(100 - (ist / budget) * 100 - (offen / budget) * 100, (restauftrag / budget) * 100)
		};
	}

	const gesamtOffen = $derived(Object.values(data.verplantPerGewerk).reduce((s, v) => s + v.offen, 0));
	const gesamtRestauftrag = $derived(Object.values(data.verplantPerGewerk).reduce((s, v) => s + v.restauftrag, 0));
	const gesamtRestbudget = $derived(data.gesamtBudget - data.gesamtIst - gesamtOffen - gesamtRestauftrag);

	let expandedGewerke = $state<Set<string>>(new Set());

	function toggleGewerk(id: string) {
		const s = new Set(expandedGewerke);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		expandedGewerke = s;
	}
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
		Budget-Übersicht
	</h1>

	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Summary -->
	<div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
		<div class="kpi-card border-l-4 border-l-blue-500">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
				Gesamtbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtBudget)}</div>
		</div>
		<div class="kpi-card border-l-4 border-l-green-500">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
				Bezahlt
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(data.gesamtIst)}</div>
		</div>
		<div class="kpi-card border-l-4 border-l-orange-400">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8.25v-2m0 0c-1.11 0-2-.9-2-2s.89-2 2-2 2 .9 2 2-.89 2-2 2zm0 0H4.5m15 0H19.5M2.25 12h19.5" /></svg>
				Offen
			</div>
			<div class="text-xl font-bold font-mono mt-1">{formatCents(gesamtOffen)}</div>
		</div>
		<div class="kpi-card border-l-4 {gesamtRestbudget < 0 ? 'border-l-red-500' : 'border-l-green-500'}">
			<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>
				Restbudget
			</div>
			<div class="text-xl font-bold font-mono mt-1" class:text-red-600={gesamtRestbudget < 0}>
				{formatCents(gesamtRestbudget)}
			</div>
		</div>
	</div>

	<!-- Table -->
	<div class="card overflow-x-auto">
		<table class="w-full">
			<thead>
				<tr class="thead-row">
					<th class="px-4 py-3">Gewerk</th>
					<th class="px-4 py-3 text-right">Budget</th>
					<th class="px-4 py-3 text-right">Bezahlt</th>
					<th class="px-4 py-3 text-right">Offen</th>
					<th class="px-4 py-3 text-right">Restauftrag</th>
					<th class="px-4 py-3 text-right">Restbudget</th>
					<th class="px-4 py-3 text-center">Status</th>
					<th class="px-4 py-3 text-right">Aufträge</th>
					<th class="px-4 py-3 w-24"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.summaries as s (s.gewerk.id)}
					{@const vp = data.verplantPerGewerk[s.gewerk.id] ?? { offen: 0, restauftrag: 0, anzahl: 0 }}
					{@const restbudget = s.budget - s.ist - vp.offen - vp.restauftrag}
					{@const barWidths = getStackedBarWidths(s.ist, vp.offen, vp.restauftrag, s.budget)}
					<tr class="border-b {ampelClass(restbudget, s.budget, s.gewerk.pauschal)}">
						{#if editGewerk === s.gewerk.id}
							<td colspan="9" class="px-4 py-3">
								<form method="POST" action="?/update" use:enhance={() => { return async ({ update }) => { editGewerk = null; update(); }; }} class="flex gap-3 items-end">
									<input type="hidden" name="gewerk" value={s.gewerk.id} />
									<div class="flex-1">
										<label class="text-xs text-gray-500">Gewerk</label>
										<div class="font-medium text-sm">{s.gewerk.name}</div>
									</div>
									<div>
										<label for="geplant" class="text-xs text-gray-500">Budget (EUR)</label>
										<input type="text" name="geplant" id="geplant" inputmode="decimal"
											value={centsToInputValue(s.budget)}
											class="w-36 input-sm" />
									</div>
									<div class="flex-1">
										<label for="notiz" class="text-xs text-gray-500">Notiz</label>
										<input type="text" name="notiz" id="notiz"
											value={data.notizen[s.gewerk.id] ?? ''}
											class="w-full input-sm" />
									</div>
									<button type="submit" class="btn-sm-primary inline-flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" /></svg>
										Speichern
									</button>
									<button type="button" onclick={() => editGewerk = null} class="btn-sm-secondary inline-flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
										Abbrechen
									</button>
								</form>
							</td>
						{:else}
							<td class="px-4 py-3 text-sm">
								<div class="flex items-center gap-2">
									<div class="w-3 h-3 rounded-full" style="background-color: {s.gewerk.farbe}"></div>
									<span class="font-medium">{s.gewerk.name}</span>
								</div>
								{#if data.notizen[s.gewerk.id]}
									<div class="text-xs text-gray-400 mt-0.5 ml-5">{data.notizen[s.gewerk.id]}</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(s.budget)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-green-600">{formatCents(s.ist)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-orange-500">{formatCents(vp.offen)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600">{formatCents(vp.restauftrag)}</td>
							<td class="px-4 py-3 text-sm text-right font-mono tabular-nums" class:text-red-600={restbudget < 0}>
								{formatCents(restbudget)}
							</td>
							<td class="px-4 py-3 text-center">
								{#if s.gewerk.pauschal}
									<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sammelgewerk</span>
								{:else if ampelBadge(restbudget, s.budget)}
									{@const badge = ampelBadge(restbudget, s.budget)!}
									<span class="text-xs px-2 py-0.5 rounded-full font-medium {badge.class}">{badge.label}</span>
								{:else}
									<span class="text-xs text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-center">
								{#if vp.anzahl > 0}
									<button
										onclick={() => toggleGewerk(s.gewerk.id)}
										class="text-sm text-blue-600 hover:underline font-medium cursor-pointer"
									>
										{expandedGewerke.has(s.gewerk.id) ? '▲' : '▼'} {vp.anzahl}
									</button>
								{:else}
									<span class="text-xs text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-right">
								<button onclick={() => editGewerk = s.gewerk.id} class="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium transition-colors">
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
									Budget
								</button>
							</td>
						{/if}
					</tr>
					{#if !editGewerk || editGewerk !== s.gewerk.id}
						<tr class="border-b bg-gray-50/40">
							<td colspan="2"></td>
							<td colspan="7" class="px-4 py-2">
								<div class="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
									<div class="bg-green-500 transition-all" style="width: {barWidths.bezahlt}%"></div>
									<div class="bg-orange-400 transition-all" style="width: {barWidths.offen}%"></div>
									<div class="bg-gray-400 transition-all" style="width: {barWidths.restauftrag}%"></div>
								</div>
							</td>
						</tr>
					{/if}
					{#if expandedGewerke.has(s.gewerk.id) && data.rechnungenPerGewerk[s.gewerk.id]}
						{#each data.rechnungenPerGewerk[s.gewerk.id] as r}
							<tr class="border-b bg-blue-50/30">
								<td class="px-4 py-2 pl-10 text-xs text-gray-700">
									<span class="mr-1 text-gray-300">↳</span>
									{#if r.hatUeberfaellige}
										<span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>
									{:else if r.offen > 0}
										<span class="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>
									{:else}
										<span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
									{/if}
									{r.auftragnehmer}
								</td>
								<td></td>
								<td class="px-4 py-2 text-xs text-right font-mono tabular-nums text-green-600">
									{r.bezahlt > 0 ? formatCents(r.bezahlt) : '—'}
								</td>
								<td class="px-4 py-2 text-xs text-right font-mono tabular-nums text-orange-500">
									{r.offen > 0 ? formatCents(r.offen) : '—'}
								</td>
								<td colspan="3"></td>
								<td class="px-4 py-2 text-xs text-right">
									<a href="/rechnungen/{r.id}" class="text-blue-600 hover:underline font-medium">→</a>
								</td>
								<td></td>
							</tr>
						{/each}
					{/if}
					{#if s.gewerk.pauschal && data.taetigkeitSummaries[s.gewerk.id]?.length > 0}
						{#each data.taetigkeitSummaries[s.gewerk.id] as t}
							<tr class="border-b bg-gray-50/40">
								<td class="px-4 py-2 pl-10 text-xs text-gray-500 italic">
									<span class="mr-1 text-gray-300">&#x21B3;</span>{t.taetigkeit}
								</td>
								<td colspan="4"></td>
								<td class="px-4 py-2 text-xs text-right font-mono tabular-nums text-gray-500">{formatCents(t.betrag)}</td>
								<td colspan="3"></td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
			<tfoot>
				<tr class="border-t font-medium bg-gray-50">
					<td class="px-4 py-3 text-sm">Gesamt</td>
					<td class="px-4 py-3 text-sm text-right font-mono tabular-nums">{formatCents(data.gesamtBudget)}</td>
					<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-green-600">{formatCents(data.gesamtIst)}</td>
					<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-orange-500">{formatCents(gesamtOffen)}</td>
					<td class="px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600">{formatCents(gesamtRestauftrag)}</td>
					<td class="px-4 py-3 text-sm text-right font-mono tabular-nums" class:text-red-600={gesamtRestbudget < 0}>
						{formatCents(gesamtRestbudget)}
					</td>
					<td colspan="3"></td>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
