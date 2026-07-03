<script lang="ts">
	import BuchungForm from '$lib/components/BuchungForm.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<h1 class="page-title">
		<svg class="page-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15" /></svg>
		Neue Buchung
	</h1>
	<BuchungForm
		gewerke={data.gewerke}
		raeume={data.raeume}
		lieferanten={data.lieferanten}
		lieferungen={data.lieferungen}
		values={form?.values}
		defaultGewerk={data.lastGewerk}
		error={form?.error}
		submitLabel="Buchung anlegen"
	/>
</div>
