<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { formatCents, formatDatum } from '$lib/format';

	let { data }: { data: PageData } = $props();

	let suche = $state('');
	let typFilter = $state<'alle' | 'buchung' | 'abschlag' | 'lieferung' | 'angebot'>('alle');
	let gruppierung = $state<'monat' | 'gewerk' | 'typ'>('monat');

	function isPdf(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}

	function isImage(name: string): boolean {
		const n = name.toLowerCase();
		return n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png');
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
		buchung: 'Buchung', abschlag: 'Abschlag', lieferung: 'Lieferung', angebot: 'Angebot'
	};
	const typBadgeCls: Record<string, string> = {
		buchung: 'bg-green-100 text-green-700',
		abschlag: 'bg-blue-100 text-blue-700',
		lieferung: 'bg-violet-100 text-violet-700',
		angebot: 'bg-orange-100 text-orange-700'
	};

	const typFilterOptions: { key: typeof typFilter; label: string }[] = [
		{ key: 'alle', label: 'Alle' },
		{ key: 'buchung', label: 'Buchungen' },
		{ key: 'abschlag', label: 'Abschläge' },
		{ key: 'lieferung', label: 'Lieferungen' },
		{ key: 'angebot', label: 'Angebote' }
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

	// Gewerk-Farben Map
	const gewerkFarben = $derived(new Map(data.gewerke.map(g => [g.id, g.farbe])));

	// Gruppierung
	type Gruppe = [string, typeof gefilterteEintraege];

	const gruppiert = $derived.by((): Gruppe[] => {
		const map = new Map<string, typeof gefilterteEintraege>();
		for (const e of gefilterteEintraege) {
			let key: string;
			if (gruppierung === 'gewerk') key = e.gewerkId || '__ohne__';
			else if (gruppierung === 'typ') key = e.typ;
			else key = e.datum ? e.datum.slice(0, 7) : '0000-00';
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(e);
		}
		return [...map.entries()].sort(([a], [b]) => {
			if (gruppierung === 'typ') return a.localeCompare(b);
			return b.localeCompare(a);
		});
	});

	function gruppenLabel(key: string): string {
		if (gruppierung === 'monat') return formatMonat(key);
		if (gruppierung === 'typ') return typLabel[key] ?? key;
		if (key === '__ohne__') return 'Ohne Gewerk';
		const g = data.gewerke.find(g => g.id === key);
		return g?.name ?? key;
	}

	function gruppenFarbe(key: string): string | null {
		if (gruppierung !== 'gewerk') return null;
		return gewerkFarben.get(key) ?? null;
	}

	const totalBelege = $derived(gefilterteEintraege.reduce((s, e) => s + e.belege.length, 0));
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
		<h1 class="text-2xl font-bold text-gray-900">Belege</h1>
	</div>

	<!-- KPI-Karten -->
	{#if data.eintraege.length > 0 || data.fehlend.gesamt > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
					Belege gesamt
				</div>
				<div class="text-xl font-bold font-mono mt-1">{data.stats.gesamt}</div>
				<div class="text-xs text-gray-400 mt-1">{data.eintraege.length} {data.eintraege.length === 1 ? 'Eintrag' : 'Einträge'}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
					Belegter Betrag
				</div>
				<div class="text-xl font-bold font-mono mt-1">{formatCents(data.stats.gesamtBetrag)}</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
					Nach Typ
				</div>
				<div class="text-sm font-mono mt-2 space-y-0.5">
					<div class="flex justify-between"><span class="text-gray-500">Buchungen</span><span class="font-semibold">{data.stats.buchungen}</span></div>
					<div class="flex justify-between"><span class="text-gray-500">Abschläge</span><span class="font-semibold">{data.stats.abschlaege}</span></div>
					<div class="flex justify-between"><span class="text-gray-500">Lieferungen</span><span class="font-semibold">{data.stats.lieferungen}</span></div>
					<div class="flex justify-between"><span class="text-gray-500">Angebote</span><span class="font-semibold">{data.stats.angebote}</span></div>
				</div>
			</div>

			<div class="kpi-card animate-in">
				<div class="flex items-center gap-1.5 text-xs font-medium {data.fehlend.gesamt > 0 ? 'text-amber-500' : 'text-green-500'} uppercase tracking-wide">
					{#if data.fehlend.gesamt > 0}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					{/if}
					Fehlende Belege
				</div>
				<div class="text-xl font-bold font-mono mt-1 {data.fehlend.gesamt > 0 ? 'text-amber-600' : 'text-green-600'}">{data.fehlend.gesamt}</div>
				{#if data.fehlend.gesamt > 0}
					<div class="text-xs text-gray-400 mt-1">
						{#if data.fehlend.buchungen > 0}{data.fehlend.buchungen} Buchungen{/if}
						{#if data.fehlend.abschlaege > 0}{data.fehlend.buchungen > 0 ? ' · ' : ''}{data.fehlend.abschlaege} Abschläge{/if}
						{#if data.fehlend.lieferungen > 0}{(data.fehlend.buchungen > 0 || data.fehlend.abschlaege > 0) ? ' · ' : ''}{data.fehlend.lieferungen} Lieferungen{/if}
					</div>
				{:else}
					<div class="text-xs text-green-500 mt-1">Alle Einträge belegt</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Filter -->
	<div class="flex flex-wrap gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200 items-end animate-in">
		<select onchange={(e) => applyFilter('gewerk', e.currentTarget.value)} class="input-sm">
			<option value="">Alle Gewerke</option>
			{#each data.gewerke as g}
				<option value={g.id} selected={data.filter.gewerk === g.id}>{g.name}</option>
			{/each}
		</select>

		<div class="flex overflow-x-auto rounded-lg border border-gray-200">
			{#each typFilterOptions as opt}
				<button
					onclick={() => (typFilter = opt.key)}
					class="whitespace-nowrap shrink-0 px-3 py-1.5 text-sm font-medium transition-colors
						{typFilter === opt.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
				>
					{opt.label}
				</button>
			{/each}
		</div>

		<select bind:value={gruppierung} class="input-sm">
			<option value="monat">Nach Monat</option>
			<option value="gewerk">Nach Gewerk</option>
			<option value="typ">Nach Typ</option>
		</select>

		<div class="relative flex-1 min-w-40">
			<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			<input type="text" bind:value={suche} placeholder="Suche..." class="input-sm pl-8 w-full" />
		</div>
	</div>

	<!-- Inhalt -->
	{#if data.eintraege.length === 0}
		<div class="card px-4 py-12 text-center text-gray-400 text-sm">
			<svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
			Keine Belege vorhanden
		</div>
	{:else if gefilterteEintraege.length === 0}
		<div class="card px-4 py-10 text-center text-gray-400 text-sm">
			Keine Belege für diesen Filter
		</div>
	{:else}
		<div class="space-y-6 stagger">
			{#each gruppiert as [key, eintraege]}
				<div class="animate-in">
					<!-- Gruppen-Header -->
					<div class="flex items-center gap-3 px-1 mb-3">
						{#if gruppenFarbe(key)}
							<div class="w-3 h-3 rounded-full shrink-0" style="background-color: {gruppenFarbe(key)}"></div>
						{/if}
						<span class="text-sm font-semibold text-gray-700">{gruppenLabel(key)}</span>
						<span class="text-xs text-gray-400">{eintraege.length} {eintraege.length === 1 ? 'Eintrag' : 'Einträge'}</span>
						<div class="flex-1 border-t border-gray-200"></div>
					</div>

					<!-- Einträge -->
					<div class="space-y-2">
						{#each eintraege as eintrag (eintrag.key)}
							{@const gFarbe = gewerkFarben.get(eintrag.gewerkId)}
							<div class="card p-4 hover:shadow-md hover:border-gray-300 transition-all">
								<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											{#if gFarbe}
												<div class="w-3 h-3 rounded-sm shrink-0" style="background-color: {gFarbe}"></div>
											{/if}
											<span class="font-medium text-gray-900">{eintrag.beschreibung}</span>
											<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {typBadgeCls[eintrag.typ]}">
												{typLabel[eintrag.typ]}
											</span>
										</div>
										<div class="text-sm text-gray-500 mt-0.5">
											{eintrag.datum ? formatDatum(eintrag.datum) : '—'} · {eintrag.gewerkName} · <span class="font-mono tabular-nums">{formatCents(eintrag.betrag)}</span>
										</div>
									</div>
									<a href={eintrag.editHref} class="text-sm text-blue-500 hover:underline shrink-0">
										{eintrag.typ === 'buchung' ? 'Bearbeiten' : 'Öffnen'}
									</a>
								</div>

								<!-- Belege mit Vorschau -->
								<div class="flex flex-wrap gap-2 mt-3">
									{#each eintrag.belege as beleg}
										<a href={beleg.href} target="_blank" rel="noopener noreferrer"
											class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 hover:border-gray-300 transition-all">
											{#if isImage(beleg.dateiname)}
												<img src={beleg.href} alt={beleg.dateiname} loading="lazy" class="w-10 h-10 object-cover rounded" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
											{:else if isPdf(beleg.dateiname)}
												<svg class="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
												</svg>
											{:else}
												<svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
											{/if}
											<span class="text-blue-600 truncate max-w-48">{beleg.dateiname}</span>
										</a>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Statistik -->
	{#if data.eintraege.length > 0}
		<div class="text-sm text-gray-400 text-right">
			{gefilterteEintraege.length} von {data.eintraege.length} Einträgen · {totalBelege} {totalBelege === 1 ? 'Beleg' : 'Belege'}
		</div>
	{/if}
</div>
