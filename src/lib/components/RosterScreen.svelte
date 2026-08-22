<script>
	import { formatDateLabel, titleCase } from '$lib/format.js';
	import {
		addNameToPendingRoster,
		app,
		confirmRoster,
		getPreviousEventDates,
		namesFromEvent,
		setPendingRosterFromNames,
		showGateScreen
	} from '$lib/state.svelte.js';
	import IconPlus from './IconPlus.svelte';
	import IconX from './IconX.svelte';

	const previousDates = getPreviousEventDates();
	let sourceDate = $state(previousDates[0] || '');
	let addName = $state('');

	loadFromSource();

	function loadFromSource() {
		if (!sourceDate) {
			setPendingRosterFromNames([]);
		} else {
			setPendingRosterFromNames(namesFromEvent(sourceDate));
		}
	}

	function addNameFromInput() {
		addNameToPendingRoster(addName);
		addName = '';
	}

	const selectedCount = $derived(app.pendingRoster.filter((p) => p.selected).length);
	const rosterCountLabel = $derived(
		app.pendingRoster.length === 0
			? '0 selected'
			: `${selectedCount} of ${app.pendingRoster.length} selected`
	);

	/** @param {KeyboardEvent} e */
	function onAddKeydown(e) {
		if (e.key === 'Enter') addNameFromInput();
	}
</script>

<section class="screen roster-screen">
	<div class="gate-card roster-card">
		<div class="brand-badge">
			<svg
				class="icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
				<path d="M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		</div>
		<h1>Who is in this event?</h1>
		<p class="subtitle">{app.currentDate ? formatDateLabel(app.currentDate) : ''}</p>
		<p class="hint">
			Pick a previous event to copy its roster. Uncheck anyone sitting out, or remove them from the
			list. Paid status is not copied.
		</p>

		<label for="roster-source">Copy roster from</label>
		<select id="roster-source" bind:value={sourceDate} onchange={loadFromSource}>
			<option value="">Start empty</option>
			{#each previousDates as date (date)}
				<option value={date}>{formatDateLabel(date)}</option>
			{/each}
		</select>

		<p class="roster-count" aria-live="polite">{rosterCountLabel}</p>
		<div class="participant-list roster-list">
			{#if app.pendingRoster.length === 0}
				<p class="roster-empty">Add names below, or copy a roster from a previous event.</p>
			{:else}
				{#each app.pendingRoster as person, idx (person.name + idx)}
					<div class="participant-row roster-row" class:selected={person.selected}>
						<label class="participant-check">
							<input type="checkbox" bind:checked={person.selected} />
							<span>{titleCase(person.name)}</span>
						</label>
						<button
							type="button"
							class="remove-btn"
							aria-label="Remove from this event"
							onclick={() => app.pendingRoster.splice(idx, 1)}
						>
							<IconX />
						</button>
					</div>
				{/each}
			{/if}
		</div>

		<label for="roster-add-input">Add a name</label>
		<div class="quick-add roster-add">
			<input
				type="text"
				id="roster-add-input"
				placeholder="Participant name"
				autocomplete="off"
				bind:value={addName}
				onkeydown={onAddKeydown}
			/>
			<button type="button" class="btn-secondary" onclick={addNameFromInput}>
				<IconPlus />
				Add
			</button>
		</div>

		<button type="button" class="btn-primary" onclick={confirmRoster}>Confirm Participants</button>
		<button type="button" class="btn-secondary roster-back-btn" onclick={showGateScreen}>Back</button>
	</div>
</section>
