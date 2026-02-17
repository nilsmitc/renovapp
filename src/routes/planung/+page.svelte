<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import type { PlanungEintrag } from '$lib/domain';
	import { vorgaengerVon } from '$lib/domain';
	import { formatDatum } from '$lib/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editGewerk = $state<string | null>(null);

	// Alle Gewerke, angereichert mit ihrem Planungs-Eintrag (falls vorhanden)
	const rows = $derived(
		data.gewerke.map((g) => ({
			gewerk: g,
			plan: data.planung.find((p) => p.gewerk === g.id) ?? null
		}))
	);

	// Gewerke bereit zu starten: status=geplant, alle Vorgaenger fertig
	const alsNaechstes = $derived(
		rows.filter(({ plan }) => {
			if (!plan || plan.status !== 'geplant') return false;
			const vorgIds = vorgaengerVon(plan.gewerk, data.planung);
			return vorgIds.every((id) => {
				const vp = data.planung.find((p) => p.gewerk === id);
				return vp?.status === 'fertig';
			});
		})
	);

	// Gantt: nur Gewerke mit start + ende
	const ganttRows = $derived(rows.filter((r) => r.plan?.start && r.plan?.ende));

	const ganttMin = $derived(
		ganttRows.length ? new Date(ganttRows.map((r) => r.plan!.start).sort()[0]) : null
	);
	const ganttMax = $derived(
		ganttRows.length ? new Date(ganttRows.map((r) => r.plan!.ende).sort().at(-1)!) : null
	);
	const ganttSpanMs = $derived(
		ganttMin && ganttMax ? ganttMax.getTime() - ganttMin.getTime() || 1 : 1
	);

	const ganttMonate = $derived.by(() => {
		if (!ganttMin || !ganttMax) return [];
		const monate: { label: string; pct: number }[] = [];
		const cur = new Date(ganttMin.getFullYear(), ganttMin.getMonth(), 1);
		while (cur <= ganttMax) {
			monate.push({
				label: cur.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
				pct: Math.max(0, dateToPct(cur.toISOString().slice(0, 10)))
			});
			cur.setMonth(cur.getMonth() + 1);
		}
		return monate;
	});

	function dateToPct(dateStr: string): number {
		if (!ganttMin) return 0;
		return ((new Date(dateStr).getTime() - ganttMin.getTime()) / ganttSpanMs) * 100;
	}
	function durationPct(start: string, ende: string): number {
		return ((new Date(ende).getTime() - new Date(start).getTime()) / ganttSpanMs) * 100;
	}

	function statusLabel(s: PlanungEintrag['status']): string {
		return s === 'geplant' ? 'Geplant' : s === 'aktiv' ? 'Aktiv' : 'Fertig';
	}
	function statusClass(s: PlanungEintrag['status']): string {
		return s === 'geplant'
			? 'bg-gray-100 text-gray-700'
			: s === 'aktiv'
				? 'bg-blue-100 text-blue-700'
				: 'bg-green-100 text-green-700';
	}

	function hasWarnung(plan: PlanungEintrag): boolean {
		if (!plan.start) return false;
		return vorgaengerVon(plan.gewerk, data.planung).some((id) => {
			const vp = data.planung.find((p) => p.gewerk === id);
			return vp?.ende && plan.start < vp.ende;
		});
	}

	function gewerkName(id: string): string {
		return data.gewerke.find((g) => g.id === id)?.name ?? id;
	}
	function gewerkFarbe(id: string): string {
		return data.gewerke.find((g) => g.id === id)?.farbe ?? '#9ca3af';
	}

	function editDefaults(gewerkId: string) {
		const p = data.planung.find((e) => e.gewerk === gewerkId);
		return {
			start: p?.start ?? '',
			ende: p?.ende ?? '',
			status: p?.status ?? 'geplant',
			nachGewerk: p?.nachGewerk ?? []
		};
	}
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
		Bauplaner
	</h1>

	{#if form?.error}
		<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200">
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
			{form.error}
		</div>
	{/if}

	<!-- Als naechstes -->
	{#if alsNaechstes.length > 0}
		<div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
			<div class="text-sm font-semibold text-blue-800 mb-2">Als nächstes bereit</div>
			<div class="flex flex-wrap gap-2">
				{#each alsNaechstes as { gewerk }}
					<span class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium text-white shadow-sm"
						style="background-color: {gewerk.farbe}">
						{gewerk.name}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Gantt -->
	{#if ganttRows.length > 0}
		<div class="card p-4 overflow-x-auto">
			<div class="text-sm font-semibold text-gray-700 mb-3">Zeitplan</div>
			<div class="min-w-[600px]">
				<!-- Monats-Header -->
				<div class="relative h-6 mb-1 border-b">
					{#each ganttMonate as m}
						<span class="absolute text-xs text-gray-400 -translate-x-1/2"
							style="left: {m.pct}%">{m.label}</span>
					{/each}
				</div>
				<!-- Bars -->
				<div class="space-y-1.5 pt-1">
					{#each ganttRows as { gewerk, plan }}
						<div class="flex items-center gap-2">
							<div class="w-32 shrink-0 text-xs text-gray-600 text-right truncate font-medium"
								title={gewerk.name}>{gewerk.name}</div>
							<div class="relative flex-1 h-6">
								<div
									class="absolute h-full rounded-md text-xs flex items-center px-1.5 text-white overflow-hidden whitespace-nowrap shadow-sm"
									style="left: {dateToPct(plan!.start)}%; width: {durationPct(plan!.start, plan!.ende)}%;
										background-color: {gewerk.farbe};
										opacity: {plan!.status === 'geplant' ? '0.55' : '1'}"
									title="{gewerk.name}: {formatDatum(plan!.start)} – {formatDatum(plan!.ende)}">
									{gewerk.name}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Tabelle -->
	<div class="card overflow-x-auto">
		<table class="w-full">
			<thead>
				<tr class="thead-row">
					<th class="px-4 py-3">Gewerk</th>
					<th class="px-4 py-3">Start</th>
					<th class="px-4 py-3">Ende</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Danach</th>
					<th class="px-4 py-3 w-24"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as { gewerk, plan }}
					<tr class="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
						<td class="px-4 py-3 text-sm">
							<div class="flex items-center gap-1.5">
								<div class="w-2.5 h-2.5 rounded-full shrink-0"
									style="background-color: {gewerk.farbe}"></div>
								<span class="font-medium">{gewerk.name}</span>
								{#if plan && hasWarnung(plan)}
									<span title="Startdatum liegt vor Ende eines Vorgänger-Gewerks"
										class="text-amber-500 text-base leading-none">&#9888;</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3 text-sm text-gray-600">
							{plan?.start ? formatDatum(plan.start) : '—'}
						</td>
						<td class="px-4 py-3 text-sm text-gray-600">
							{plan?.ende ? formatDatum(plan.ende) : '—'}
						</td>
						<td class="px-4 py-3 text-sm">
							{#if plan}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium {statusClass(plan.status)}">
									{#if plan.status === 'geplant'}
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									{:else if plan.status === 'aktiv'}
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
									{:else}
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									{/if}
									{statusLabel(plan.status)}
								</span>
							{:else}
								<span class="text-gray-400 text-xs">Nicht geplant</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-sm">
							<div class="flex flex-wrap gap-1">
								{#each plan?.nachGewerk ?? [] as ngId}
									<span class="text-xs px-1.5 py-0.5 rounded-md font-medium"
										style="background-color: {gewerkFarbe(ngId)}22; color: {gewerkFarbe(ngId)}">
										{gewerkName(ngId)}
									</span>
								{/each}
							</div>
						</td>
						<td class="px-4 py-3 text-sm text-right">
							<button
								class="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium"
								onclick={() => editGewerk = editGewerk === gewerk.id ? null : gewerk.id}>
								{#if editGewerk === gewerk.id}
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
									Schließen
								{:else}
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
									Bearbeiten
								{/if}
							</button>
						</td>
					</tr>

					<!-- Inline-Edit -->
					{#if editGewerk === gewerk.id}
						{@const def = editDefaults(gewerk.id)}
						<tr class="bg-gray-50 border-b">
							<td colspan="6" class="px-4 py-4">
								<form method="POST" action="?/update"
									use:enhance={() => async ({ update }) => { editGewerk = null; update(); }}
									class="space-y-3">
									<input type="hidden" name="gewerk" value={gewerk.id} />

									<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
										<div>
											<label class="block text-xs font-medium text-gray-600 mb-1">Start</label>
											<input type="date" name="start" value={def.start} class="input-base text-sm" />
										</div>
										<div>
											<label class="block text-xs font-medium text-gray-600 mb-1">Ende</label>
											<input type="date" name="ende" value={def.ende} class="input-base text-sm" />
										</div>
										<div>
											<label class="block text-xs font-medium text-gray-600 mb-1">Status</label>
											<select name="status" class="input-base text-sm">
												{#each ['geplant', 'aktiv', 'fertig'] as s}
													<option value={s} selected={def.status === s}>{statusLabel(s as PlanungEintrag['status'])}</option>
												{/each}
											</select>
										</div>
									</div>

									<div>
										<label class="block text-xs font-medium text-gray-600 mb-1">Danach kommt</label>
										<div class="flex flex-wrap gap-2">
											{#each data.gewerke.filter((g) => g.id !== gewerk.id) as g}
												<label class="flex items-center gap-1.5 text-sm cursor-pointer">
													<input type="checkbox" name="nachGewerk" value={g.id}
														checked={def.nachGewerk.includes(g.id)} class="rounded" />
													<span class="flex items-center gap-1">
														<span class="w-2 h-2 rounded-full inline-block"
															style="background-color: {g.farbe}"></span>
														{g.name}
													</span>
												</label>
											{/each}
										</div>
									</div>

									<div class="flex gap-2 items-center">
										<button type="submit" class="btn-primary text-sm inline-flex items-center gap-1.5">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" /></svg>
											Speichern
										</button>
										<button type="button" class="btn-secondary text-sm inline-flex items-center gap-1.5"
											onclick={() => editGewerk = null}>
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
											Abbrechen
										</button>
									</div>
								</form>

								{#if plan}
									<form method="POST" action="?/remove" class="mt-2"
										use:enhance={() => async ({ update }) => { editGewerk = null; update(); }}>
										<input type="hidden" name="gewerk" value={gewerk.id} />
										<button type="submit" class="inline-flex items-center gap-1 text-red-600 text-sm hover:underline font-medium"
											onclick={(e) => { if (!confirm('Planung für dieses Gewerk wirklich entfernen?')) e.preventDefault(); }}>
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
											Planung entfernen
										</button>
									</form>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
