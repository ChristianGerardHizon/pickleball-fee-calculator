<script>
	import GateScreen from '$lib/components/GateScreen.svelte';
	import MainScreen from '$lib/components/MainScreen.svelte';
	import ProfileScreen from '$lib/components/ProfileScreen.svelte';
	import RosterScreen from '$lib/components/RosterScreen.svelte';
	import { app, bootSession } from '$lib/state.svelte.js';
	import { onMount } from 'svelte';

	onMount(() => {
		bootSession();
	});
</script>

<div id="app">
	{#if app.booting}
		<section class="screen gate-screen">
			<div class="gate-card">
				<p class="subtitle">Loading…</p>
			</div>
		</section>
	{:else if app.screen === 'gate'}
		<GateScreen />
	{:else if app.screen === 'roster'}
		<RosterScreen />
	{:else if app.screen === 'profile'}
		<ProfileScreen />
	{:else}
		<MainScreen />
	{/if}
</div>
