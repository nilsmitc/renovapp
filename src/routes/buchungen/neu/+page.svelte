<script lang="ts">
	import BuchungForm from '$lib/components/BuchungForm.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<h1 class="flex items-center gap-2 text-2xl font-bold text-gray-900">
		<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15" /></svg>
		Neue Buchung
	</h1>
	<BuchungForm
		gewerke={data.gewerke}
		raeume={data.raeume}
		values={form?.values}
		defaultGewerk={data.lastGewerk}
		error={form?.error}
		submitLabel="Buchung anlegen"
	/>
</div>
