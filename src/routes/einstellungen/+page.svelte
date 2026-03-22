<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData, PageData } from './$types';
	import { onMount } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const erfolg = $derived($page.url.searchParams.get('success') === '1');
	let laeuft = $state(false);

	// Update-Status
	let updatePruefung = $state(false);
	let updateStatus = $state<{
		updateVerfuegbar?: boolean;
		aktuellerCommit?: string;
		neusterCommit?: string;
		commits?: { hash: string; datum: string; nachricht: string }[];
		fehler?: string;
	} | null>(null);
	let updateLaeuft = $state(false);

	async function updatePruefen() {
		updatePruefung = true;
		updateStatus = null;
		try {
			const res = await fetch('/api/update-status');
			updateStatus = await res.json();
		} catch {
			updateStatus = { fehler: 'Verbindung zum Server fehlgeschlagen' };
		} finally {
			updatePruefung = false;
		}
	}

	// Auto-Reload nach Update
	onMount(() => {
		if (data.updating) {
			const timer = setTimeout(() => {
				window.location.href = '/einstellungen';
			}, 5000);
			return () => clearTimeout(timer);
		}
	});
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
		Einstellungen
	</h1>

	<!-- Update -->
	{#if data.updating}
		<div class="card p-6 space-y-4">
			<div class="flex items-center gap-3">
				<svg class="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
				<div>
					<div class="text-sm font-semibold text-gray-900">Update wird installiert...</div>
					<div class="text-xs text-gray-500 mt-1">Der Server startet automatisch neu. Diese Seite wird in wenigen Sekunden neu geladen.</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="card p-6 space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
				<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
				Updates
			</h2>

			{#if form?.updateError}
				<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200 text-sm">
					<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
					{form.updateError}
				</div>
			{/if}

			{#if updateStatus?.fehler}
				<div class="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-3 rounded-md border border-yellow-200 text-sm">
					<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
					{updateStatus.fehler}
				</div>
			{:else if updateStatus?.updateVerfuegbar}
				<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
					<div class="flex items-center gap-2">
						<svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>
						<span class="text-sm font-semibold text-amber-800">{updateStatus.commits?.length ?? 0} neue Updates verfügbar</span>
					</div>
					{#if updateStatus.commits && updateStatus.commits.length > 0}
						<ul class="text-xs text-gray-700 space-y-1 ml-7">
							{#each updateStatus.commits as commit}
								<li>
									<span class="font-mono text-gray-400">{commit.hash}</span>
									<span class="text-gray-400 mx-1">{commit.datum}</span>
									{commit.nachricht}
								</li>
							{/each}
						</ul>
					{/if}
					<form method="POST" action="?/update" use:enhance={() => {
						updateLaeuft = true;
						return async ({ update }) => {
							await update();
							updateLaeuft = false;
						};
					}}>
						<button type="submit" class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50" disabled={updateLaeuft}>
							{#if updateLaeuft}
								<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
								Aktualisiere...
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>
								Jetzt aktualisieren
							{/if}
						</button>
					</form>
					<p class="text-xs text-gray-500 ml-7">Der Server wird kurz neu gestartet. Deine Daten bleiben erhalten.</p>
				</div>
			{:else if updateStatus && !updateStatus.updateVerfuegbar}
				<div class="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-md border border-green-200 text-sm">
					<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Deine Version ist aktuell
					<span class="text-green-500 font-mono text-xs ml-1">({updateStatus.aktuellerCommit})</span>
				</div>
			{/if}

			{#if !updateStatus || updateStatus.fehler}
				<button
					onclick={updatePruefen}
					disabled={updatePruefung}
					class="btn-secondary inline-flex items-center gap-1.5"
				>
					{#if updatePruefung}
						<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
						Suche nach Updates...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
						Nach Updates suchen
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Export -->
	<div class="card p-6 space-y-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
			<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
			Backup exportieren
		</h2>
		<p class="text-sm text-gray-600">
			Lädt eine ZIP-Datei mit allen Daten herunter: Buchungen, Aufträge, Lieferanten,
			Projektdaten (Gewerke, Räume, Budgets), alle Belege (Buchungen, Abschläge, Lieferungen),
			KI-Analyse, Dokumenten-Extrakte und E-Mail-Scan-Cache.
		</p>
		<a href="/api/export" class="btn-primary inline-flex items-center gap-1.5">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
			Backup herunterladen
		</a>
	</div>

	<!-- Import -->
	<div class="card p-6 space-y-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
			<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
			Backup importieren
		</h2>
		<p class="text-sm text-gray-600">
			Stellt ein zuvor erstelltes Backup wieder her. <strong class="text-red-700">Alle
			vorhandenen Daten werden dabei überschrieben.</strong>
		</p>

		{#if form?.error}
			<div class="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md border border-red-200 text-sm">
				<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
				{form.error}
			</div>
		{/if}
		{#if erfolg}
			<div class="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-md border border-green-200 text-sm">
				<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Backup erfolgreich importiert.
			</div>
		{/if}

		<form method="POST" action="?/import" enctype="multipart/form-data"
			use:enhance={() => {
				laeuft = true;
				return async ({ update }) => {
					await update();
					laeuft = false;
				};
			}}
			class="space-y-3"
			onsubmit={(e) => {
				if (!confirm('Wirklich importieren? Alle vorhandenen Daten werden überschrieben.')) {
					e.preventDefault();
				}
			}}>
			<input
				type="file"
				name="backup"
				accept=".zip,application/zip"
				required
				class="input-base file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
			/>
			<div>
				<button type="submit" class="btn-primary inline-flex items-center gap-1.5" disabled={laeuft}>
					{#if laeuft}
						<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
						Importieren...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
						Importieren
					{/if}
				</button>
			</div>
		</form>
	</div>

	<!-- Hilfe -->
	<div class="card p-6 space-y-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
			<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
			Hilfe
		</h2>
		<p class="text-sm text-gray-600">
			Die Einweisung erklärt die wichtigsten Bereiche der App in einer kurzen Slideshow.
		</p>
		<button
			onclick={() => {
				localStorage.removeItem('onboarding_done');
				location.reload();
			}}
			class="btn-secondary inline-flex items-center gap-1.5"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
			Einweisung erneut anzeigen
		</button>
	</div>

	<!-- Version -->
	<div class="text-center text-xs text-gray-400 pt-2">
		RenovApp &middot; Version {data.version}
	</div>
</div>
