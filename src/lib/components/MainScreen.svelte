<script>
	import { formatCurrency, formatDateLabel, parseNames, titleCase } from '$lib/format.js';
	import { getEventTotals } from '$lib/math.js';
	import {
		addParticipantsToEvent,
		app,
		getCurrentEvent,
		mergeNamesIntoMaster,
		persist,
		persistSoon,
		showGateScreen
	} from '$lib/state.svelte.js';
	import IconPaddle from './IconPaddle.svelte';
	import IconPlus from './IconPlus.svelte';
	import IconX from './IconX.svelte';
	import ShareModal from './ShareModal.svelte';

	const event = $derived(getCurrentEvent());
	const totals = $derived(event ? getEventTotals(event) : null);

	let massText = $state('');
	let quickName = $state('');
	let shareOpen = $state(false);

	const availableMaster = $derived.by(() => {
		if (!event) return [];
		const currentNames = new Set(event.participants.map((p) => p.name.toLowerCase()));
		return app.data.masterList.filter((m) => !currentNames.has(m.toLowerCase()));
	});

	function addCourt() {
		event?.courts.push({ fee: 0, payer: '' });
		persist();
	}

	/** @param {number} idx */
	function removeCourt(idx) {
		event?.courts.splice(idx, 1);
		persist();
	}

	function massAdd() {
		const names = parseNames(massText);
		if (names.length === 0) return;
		mergeNamesIntoMaster(names);
		addParticipantsToEvent(names);
		persist();
		massText = '';
	}

	function quickAdd() {
		const val = quickName.trim();
		if (!val) return;
		const name = titleCase(val);
		mergeNamesIntoMaster([name]);
		addParticipantsToEvent([name]);
		persist();
		quickName = '';
	}

	/** @param {string} name */
	function addFromMaster(name) {
		addParticipantsToEvent([name]);
		persist();
	}

	/** @param {number} idx */
	function removeParticipant(idx) {
		event?.participants.splice(idx, 1);
		persist();
	}

	/** @param {number} idx */
	function removeMaster(idx) {
		app.data.masterList.splice(idx, 1);
		persist();
	}

	/** @param {KeyboardEvent} e */
	function onQuickKeydown(e) {
		if (e.key === 'Enter') quickAdd();
	}
</script>

{#if event && app.currentDate && totals}
	<section class="screen">
		<header class="app-header">
			<div class="brand">
				<span class="brand-icon">
					<IconPaddle />
				</span>
				<div>
					<span class="brand-title">Fee Splitter</span>
					<h1>{formatDateLabel(app.currentDate)}</h1>
				</div>
			</div>
			<div class="header-actions">
				<span class="sync-status {app.syncStatus}" aria-live="polite">
					<span class="sync-dot" aria-hidden="true"></span>
					{#if app.syncStatus === 'saving'}
						Saving…
					{:else if app.syncStatus === 'saved'}
						Saved
					{:else if app.syncStatus === 'error'}
						Save failed
					{/if}
				</span>
				<button type="button" class="btn-secondary switch-event-btn" onclick={showGateScreen}>
					Switch Event
				</button>
			</div>
		</header>

		<div class="grid">
			<div class="card">
				<h2>
					<span class="card-icon">
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
							<rect x="3" y="3" width="7" height="7" rx="1.5" />
							<rect x="14" y="3" width="7" height="7" rx="1.5" />
							<rect x="3" y="14" width="7" height="7" rx="1.5" />
							<rect x="14" y="14" width="7" height="7" rx="1.5" />
						</svg>
					</span>
					Courts
				</h2>
				<div>
					{#if event.courts.length === 0}
						<p class="empty-state">No courts yet. Add one below to start splitting fees.</p>
					{/if}
					{#each event.courts as court, idx (idx)}
						<div class="court-row">
							<div class="court-row-main">
								<span class="court-label">Court {idx + 1}</span>
								<input
									type="number"
									min="0"
									step="0.01"
									inputmode="decimal"
									aria-label="Court {idx + 1} fee"
									class="court-fee-input"
									bind:value={court.fee}
									oninput={persistSoon}
								/>
								<button
									type="button"
									class="remove-btn"
									aria-label="Remove court"
									onclick={() => removeCourt(idx)}
								>
									<IconX />
								</button>
							</div>
							<input
								type="text"
								class="court-payer-input"
								placeholder="Paid by (optional)"
								bind:value={court.payer}
								oninput={persistSoon}
							/>
						</div>
					{/each}
				</div>
				<button type="button" class="btn-secondary" onclick={addCourt}>
					<IconPlus />
					Add Court
				</button>
			</div>

			<div class="card">
				<h2>
					<span class="card-icon">
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
					</span>
					Participants
				</h2>

				<details>
					<summary>Mass add (paste a numbered list)</summary>
					<textarea
						rows="6"
						placeholder={'1. johanna\n2. bea\n3. christian\n4. stef'}
						bind:value={massText}
					></textarea>
					<button type="button" class="btn-secondary" onclick={massAdd}>
						<IconPlus />
						Add / Merge
					</button>
				</details>

				<div class="quick-add">
					<input
						type="text"
						placeholder="Add participant name"
						bind:value={quickName}
						onkeydown={onQuickKeydown}
					/>
					<button type="button" class="btn-secondary" onclick={quickAdd}>
						<IconPlus />
						Add
					</button>
				</div>

				<div class="chips">
					{#if availableMaster.length > 0}
						<div class="chips-label">Add from master list:</div>
						{#each availableMaster as name (name)}
							<button type="button" class="chip" onclick={() => addFromMaster(name)}>
								+ {titleCase(name)}
							</button>
						{/each}
					{/if}
				</div>

				<div class="participant-list">
					{#if event.participants.length === 0}
						<p class="empty-state">No participants yet. Add names above or from the master list.</p>
					{/if}
					{#each event.participants as person, idx (person.name + idx)}
						<div class="participant-row" class:paid={person.paid}>
							<label class="participant-check">
								<input type="checkbox" bind:checked={person.paid} onchange={persist} />
								<span>{titleCase(person.name)}</span>
							</label>
							{#if person.paid}
								<span class="paid-badge">Paid</span>
							{/if}
							<button
								type="button"
								class="remove-btn"
								aria-label="Remove participant"
								onclick={() => removeParticipant(idx)}
							>
								<IconX />
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="card summary-card">
			<h2>
				<span class="card-icon">
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
						<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
						<path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
						<path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
					</svg>
				</span>
				Summary
			</h2>
			<div>
				<div class="summary-highlight">
					<span class="summary-highlight-label">Amount per person</span>
					<span class="summary-highlight-value money">{formatCurrency(totals.perPerson)}</span>
				</div>
				<div class="summary-grid">
					<div>
						<span class="label">Courts</span>
						<span class="value">{event.courts.length}</span>
					</div>
					<div>
						<span class="label">Total Fee</span>
						<span class="value money">{formatCurrency(totals.totalFee)}</span>
					</div>
					<div>
						<span class="label">Participants</span>
						<span class="value">{totals.count}</span>
					</div>
					<div>
						<span class="label">Paid</span>
						<span class="value">{totals.paidCount} / {totals.count}</span>
					</div>
					<div>
						<span class="label">Collected</span>
						<span class="value money">{formatCurrency(totals.collected)}</span>
					</div>
					<div>
						<span class="label">Remaining</span>
						<span class="value money">{formatCurrency(totals.remaining)}</span>
					</div>
				</div>
				{#if totals.payerRows}
					<div class="payer-breakdown">
						<h3 class="payer-breakdown-title">Reimbursements</h3>
						{#each totals.payerRows as row (row.payer)}
							<div class="payer-row">
								<span class="payer-name">{row.payer}</span>
								<div class="payer-amounts">
									<span class="payer-remaining money"
										>{formatCurrency(row.remaining)}<span class="payer-sub">owed</span></span
									>
									<span class="payer-total money">of {formatCurrency(row.feeSum)} fronted</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<button type="button" class="btn-primary" onclick={() => (shareOpen = true)}>
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
					<circle cx="18" cy="5" r="3" />
					<circle cx="6" cy="12" r="3" />
					<circle cx="18" cy="19" r="3" />
					<path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
				</svg>
				Generate Shareable Image
			</button>
		</div>

		<details class="card">
			<summary>
				<span class="card-icon">
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
						<path d="M8 6h13M8 12h13M8 18h13" />
						<path d="M3 6h.01M3 12h.01M3 18h.01" />
					</svg>
				</span>
				Manage Master List
			</summary>
			<p class="hint">
				This is the full list of members remembered across events. Removing someone here only
				affects future events.
			</p>
			<div class="master-manage-list">
				{#each app.data.masterList as name, idx (name)}
					<div class="master-row">
						<span>{titleCase(name)}</span>
						<button
							type="button"
							class="remove-btn"
							aria-label="Remove from master list"
							onclick={() => removeMaster(idx)}
						>
							<IconX />
						</button>
					</div>
				{/each}
			</div>
		</details>
	</section>

	<ShareModal bind:open={shareOpen} {event} date={app.currentDate} />
{/if}
