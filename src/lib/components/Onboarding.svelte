<script lang="ts">
	import { onMount } from 'svelte';

	let { onClose }: { onClose: () => void } = $props();
	let step = $state(0);
	let visible = $state(true);

	const slides = [
		{
			titel: 'Willkommen bei RenovApp!',
			text: 'RenovApp hilft dir, die Kosten deiner Renovierung im Griff zu behalten. Der Ablauf ist einfach: Projekt einrichten, Kosten erfassen, Budget im Blick behalten.',
			farbe: 'text-blue-600',
			bg: 'bg-blue-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />'
		},
		{
			titel: 'Schritt 1: Projekt einrichten',
			text: 'Beim ersten Start sind 10 Standard-Gewerke (Elektro, Sanitär, etc.) und 5 Räume schon angelegt. Passe sie unter Gewerke und Räume an dein Projekt an. Setze dann unter Budget die geplanten Beträge pro Gewerk.',
			farbe: 'text-indigo-600',
			bg: 'bg-indigo-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />'
		},
		{
			titel: 'Schritt 2: Kosten erfassen',
			text: 'Es gibt drei Wege, Kosten zu erfassen: Einzelne Ausgaben direkt buchen (z.B. Kleinmaterial). Handwerker-Aufträge mit Abschlägen und Zahlungsfristen verwalten — bezahlte Abschläge erscheinen automatisch in den Ausgaben. Oder Lieferanten-Rechnungen als PDF hochladen — Betrag und Positionen werden automatisch erkannt.',
			farbe: 'text-emerald-600',
			bg: 'bg-emerald-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />'
		},
		{
			titel: 'Schritt 3: Budget im Blick',
			text: 'Das Dashboard zeigt den Gesamtstand auf einen Blick. Unter Budget siehst du eine Ampel pro Gewerk (grün/gelb/rot). Die Prognose rechnet hoch, wann das Budget aufgebraucht ist. Bei Bedarf kannst du unter Bericht einen PDF-Report herunterladen.',
			farbe: 'text-violet-600',
			bg: 'bg-violet-100',
			icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />'
		},
		{
			titel: 'Gut zu wissen',
			text: 'Sichere deine Daten regelmäßig unter Einstellungen als ZIP-Backup. Auf schmalen Bildschirmen findest du alle Bereiche im Hamburger-Menü. Wenn Thunderbird installiert ist, kann der E-Mail-Import Rechnungen automatisch aus deinem Postfach erkennen. Diese Einweisung kannst du jederzeit unter Einstellungen erneut starten.',
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
