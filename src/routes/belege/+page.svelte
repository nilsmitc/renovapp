<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { formatCents, formatDatum } from '$lib/format';

	let { data }: { data: PageData } = $props();

	let suche = $state('');
	let typFilter = $state<'alle' | 'buchung' | 'abschlag' | 'lieferung'>('alle');

	function isPdf(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}

	function applyFilter(key: string, value: string) {
		const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`/belege?${params.toString()}`);
	}

	function formatMonat(m: string): string {
		if (m === '0000-00') return 'Kein Datum';
		const [y, mo] = m.split('-').map(Number);
		return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
	}

	const typLabel: Record<string, string> = {
		buchung: 'Buchung',
		abschlag: 'Abschlag',
		lieferung: 'Lieferung'
	};

	const typFilterOptions: { key: 'alle' | 'buchung' | 'abschlag' | 'lieferung'; label: string }[] = [
		{ key: 'alle', label: 'Alle' },
		{ key: 'buchung', label: 'Buchungen' },
		{ key: 'abschlag', label: 'Abschläge' },
		{ key: 'lieferung', label: 'Lieferungen' }
	];

	const gefilterteEintraege = $derived(
		data.eintraege.filter((e) => {
			if (typFilter !== 'alle' && e.typ !== typFilter) return false;
			if (suche.trim()) {
				const q = suche.toLowerCase();
				return (
					e.beschreibung.toLowerCase().includes(q) ||
					e.belege.some((b) => b.dateiname.toLowerCase().includes(q)) ||
					e.gewerkName.toLowerCase().includes(q)
				);
			}
			return true;
		})
	);

	const gruppiertNachMonat = $derived(() => {
		const map = new Map<string, typeof gefilterteEintraege>();
		for (const e of gefilterteEintraege) {
			const monat = e.datum ? e.datum.slice(0, 7) : '0000-00';
			if (!map.has(monat)) map.set(monat, []);
			map.get(monat)!.push(e);
		}
		return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
	});

	const totalBelege = $derived(gefilterteEintraege.reduce((s, e) => s + e.belege.length, 0));
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
		Belege
	</h1>

	<!-- KPI-Zeile -->
	{#if data.eintraege.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="kpi-card border-l-4 border-l-blue-500">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
					Belege gesamt
				</div>
				<div class="text-xl font-bold font-mono mt-1">{data.stats.gesamt}</div>
				<div class="text-xs text-gray-400 mt-1">bei {data.eintraege.length} {data.eintraege.length === 1 ? 'Eintrag' : 'Einträgen'}</div>
			</div>

			<div class="kpi-card border-l-4 border-l-gray-400">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
					Aufschlüsselung
				</div>
				<div class="text-xl font-bold font-mono mt-1">{data.stats.buchungen + data.stats.abschlaege + data.stats.lieferungen}</div>
				<div class="text-xs text-gray-400 mt-1">
					{data.stats.buchungen} Buchungen · {data.stats.abschlaege} Abschläge · {data.stats.lieferungen} Lieferungen
				</div>
			</div>

			<div class="kpi-card border-l-4 border-l-orange-400">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Belegter Betrag
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.stats.gesamtBetrag)}</div>
				<div class="text-xs text-gray-400 mt-1">Summe aller belegten Buchungen</div>
			</div>
		</div>
	{/if}

	<!-- Filter -->
	<div class="flex flex-wrap gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
		<!-- Gewerk-Dropdown -->
		<select onchange={(e) => applyFilter('gewerk', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Gewerke</option>
			{#each data.gewerke as g}
				<option value={g.id} selected={data.filter.gewerk === g.id}>{g.name}</option>
			{/each}
		</select>

		<!-- Typ-Tabs -->
		<div class="flex rounded-lg border border-gray-200 overflow-hidden">
			{#each typFilterOptions as opt}
				<button
					onclick={() => (typFilter = opt.key)}
					class="px-3 py-1.5 text-sm font-medium transition-colors
						{typFilter === opt.key
							? 'bg-blue-600 text-white'
							: 'bg-white text-gray-600 hover:bg-gray-50'}"
				>
					{opt.label}
				</button>
			{/each}
		</div>

		<!-- Suche -->
		<div class="relative flex-1 min-w-40">
			<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			<input
				type="text"
				bind:value={suche}
				placeholder="Suche nach Beschreibung, Datei, Gewerk ..."
				class="input-sm pl-8 w-full"
			/>
		</div>
	</div>

	<!-- Inhalt -->
	{#if data.eintraege.length === 0}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
			Keine Belege vorhanden
		</div>
	{:else if gefilterteEintraege.length === 0}
		<div class="card px-4 py-10 text-center text-gray-400 text-sm">
			<svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			Keine Belege für diesen Filter
		</div>
	{:else}
		<div class="space-y-6">
			{#each gruppiertNachMonat() as [monat, eintraege]}
				<!-- Monats-Header -->
				<div class="flex items-center gap-3 px-1">
					<span class="text-sm font-semibold text-gray-700">{formatMonat(monat)}</span>
					<span class="text-xs text-gray-400">{eintraege.length} {eintraege.length === 1 ? 'Eintrag' : 'Einträge'}</span>
					<div class="flex-1 border-t border-gray-200"></div>
				</div>

				<!-- Einträge des Monats -->
				<div class="space-y-3">
					{#each eintraege as eintrag (eintrag.key)}
						<div class="card p-4">
							<!-- Info -->
							<div class="flex items-start justify-between mb-3">
								<div>
									<div class="font-medium text-gray-900">{eintrag.beschreibung}</div>
									<div class="text-sm text-gray-500 mt-0.5">
										{eintrag.datum ? formatDatum(eintrag.datum) : '—'} &middot; {eintrag.gewerkName} &middot; <span class="font-mono tabular-nums">{formatCents(eintrag.betrag)}</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0 ml-4">
									<span class="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
										{typLabel[eintrag.typ]}
									</span>
									<a href={eintrag.editHref} class="text-blue-600 hover:underline text-sm font-medium">
										{eintrag.typ === 'buchung' ? 'Bearbeiten' : 'Öffnen'}
									</a>
								</div>
							</div>

							<!-- Belege -->
							<div class="flex flex-wrap gap-2">
								{#each eintrag.belege as beleg}
									<a href={beleg.href} target="_blank" rel="noopener noreferrer"
										class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm hover:bg-gray-100 hover:border-gray-300 transition-all">
										{#if isPdf(beleg.dateiname)}
											<svg class="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
											</svg>
										{:else}
											<svg class="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
											</svg>
										{/if}
										<span class="text-blue-600 hover:underline">{beleg.dateiname}</span>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Statistik-Zeile -->
	{#if data.eintraege.length > 0}
		<div class="text-sm text-gray-500 text-right">
			{gefilterteEintraege.length} von {data.eintraege.length} {data.eintraege.length === 1 ? 'Eintrag' : 'Einträgen'} · {totalBelege} {totalBelege === 1 ? 'Beleg' : 'Belege'}
		</div>
	{/if}
</div>
