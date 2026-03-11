<script lang="ts">
	import { onMount } from 'svelte';

	let { onClose }: { onClose: () => void } = $props();
	let step = $state(0);
	let visible = $state(true);

	const slides = [
		{
			titel: 'Willkommen bei RenovApp!',
			text: 'Deine zentrale Anlaufstelle für die Kostenverfolgung deines Renovierungsprojekts. Erfasse Ausgaben, verwalte Aufträge an Handwerker, tracke Materiallieferungen und behalte dein Budget im Blick.',
			farbe: 'text-blue-600',
			bg: 'bg-blue-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />'
		},
		{
			titel: 'Dashboard',
			text: 'Das Dashboard zeigt dir auf einen Blick den aktuellen Stand: Budget, Ausgaben, Burn Rate und Restbudget. Die Charts visualisieren Kostenanteile nach Gewerk und Kategorie. Der Gewerke-Balken zeigt den Fortschritt inkl. verplanter Kosten aus Aufträgen.',
			farbe: 'text-indigo-600',
			bg: 'bg-indigo-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />'
		},
		{
			titel: 'Ausgaben erfassen',
			text: 'Unter Ausgaben legst du neue Buchungen an: Datum, Betrag, Gewerk, Raum und Kategorie (Material, Arbeitslohn, Sonstiges). Du kannst Belege als PDF oder Bild anhängen. Filter und Volltextsuche helfen beim Wiederfinden.',
			farbe: 'text-emerald-600',
			bg: 'bg-emerald-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />'
		},
		{
			titel: 'Aufträge & Rechnungen',
			text: 'Verwalte Handwerker-Aufträge mit mehreren Abschlägen. Tracke Zahlungsfristen und Fälligkeiten. Wenn du einen Abschlag als bezahlt markierst, wird automatisch eine Buchung in den Ausgaben erstellt. Nachträge (Change Orders) werden separat erfasst.',
			farbe: 'text-amber-600',
			bg: 'bg-amber-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />'
		},
		{
			titel: 'Lieferanten & Material',
			text: 'Erfasse Materiallieferungen von Händlern wie Hornbach oder Bauhaus. Beim Upload einer Rechnung als PDF werden Datum, Betrag und Positionen automatisch extrahiert. Sobald Betrag und Gewerk zugeordnet sind, erscheint die Lieferung automatisch in den Ausgaben.',
			farbe: 'text-green-600',
			bg: 'bg-green-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375m11.25 0h3.375a1.125 1.125 0 001.125-1.125v-3.659a1.687 1.687 0 00-.311-.98l-2.244-3.121A1.688 1.688 0 0016.875 9H14.25m0 0V5.625m0 3.375H7.5m7.5-3.375h-3.375c-.621 0-1.125.504-1.125 1.125V9" />'
		},
		{
			titel: 'Budget, Prognose & Bericht',
			text: 'Die Budget-Seite zeigt eine Ampel pro Gewerk (grün/gelb/rot). Die Prognose berechnet Burn Rate und Budget-Erschöpfungsdatum. Unter Bericht kannst du einen professionellen PDF-Bericht herunterladen, optional mit KI-Analyse.',
			farbe: 'text-violet-600',
			bg: 'bg-violet-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />'
		},
		{
			titel: 'Tipps zum Einstieg',
			text: 'Sichere deine Daten regelmäßig unter Einstellungen als ZIP-Backup. Die Navigation hat 13 Bereiche — auf dem Handy erreichbar über das Hamburger-Menü. Diese Einweisung kannst du jederzeit unter Einstellungen erneut starten.',
			farbe: 'text-yellow-600',
			bg: 'bg-yellow-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />'
		}
	];

	function next() {
		if (step < slides.length - 1) {
			visible = false;
			setTimeout(() => { step++; visible = true; }, 150);
		} else {
			onClose();
		}
	}

	function prev() {
		if (step > 0) {
			visible = false;
			setTimeout(() => { step--; visible = true; }, 150);
		}
	}

	function goTo(i: number) {
		if (i !== step) {
			visible = false;
			setTimeout(() => { step = i; visible = true; }, 150);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
		else if (e.key === 'ArrowLeft') prev();
	}

	onMount(() => {
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"></div>

<!-- Modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative">
		<!-- Slide content -->
		<div class="text-center transition-opacity duration-200 {visible ? 'opacity-100' : 'opacity-0'}">
			<!-- Icon -->
			<div class="mx-auto mb-5 w-16 h-16 rounded-2xl {slides[step].bg} flex items-center justify-center">
				<svg class="w-8 h-8 {slides[step].farbe}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{@html slides[step].icon}
				</svg>
			</div>

			<!-- Titel -->
			<h2 class="text-xl font-bold text-gray-900 mb-3">{slides[step].titel}</h2>

			<!-- Text -->
			<p class="text-sm text-gray-600 leading-relaxed mb-6">{slides[step].text}</p>
		</div>

		<!-- Dots + Counter -->
		<div class="flex items-center justify-center gap-2 mb-6">
			<div class="flex gap-1.5">
				{#each slides as _, i}
					<button
						onclick={() => goTo(i)}
						class="w-2.5 h-2.5 rounded-full transition-colors {i === step ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}"
						aria-label="Slide {i + 1}"
					></button>
				{/each}
			</div>
			<span class="text-xs text-gray-400 ml-2">{step + 1} von {slides.length}</span>
		</div>

		<!-- Navigation -->
		<div class="flex items-center justify-between">
			<button onclick={onClose} class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
				Überspringen
			</button>
			<div class="flex gap-2">
				{#if step > 0}
					<button onclick={prev} class="btn-secondary text-sm px-4 py-1.5">Zurück</button>
				{/if}
				<button onclick={next} class="btn-primary text-sm px-4 py-1.5">
					{step === slides.length - 1 ? "Los geht's!" : 'Weiter'}
				</button>
			</div>
		</div>
	</div>
</div>
