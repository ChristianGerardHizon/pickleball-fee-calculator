<script>
	import { formatCurrency, formatDateLabel, parseNames, titleCase } from '$lib/format.js';
	import { getAdditionalFees, getEventTotals } from '$lib/math.js';
	import {
		addParticipantsToEvent,
		app,
		getCurrentEvent,
		mergeNamesIntoMaster,
		persist,
		persistSoon,
		showGateScreen,
		showProfileScreen
	} from '$lib/state.svelte.js';
	import IconCheck from './IconCheck.svelte';
	import IconPaddle from './IconPaddle.svelte';
	import IconPencil from './IconPencil.svelte';
	import IconPlus from './IconPlus.svelte';
	import IconX from './IconX.svelte';
	import ShareModal from './ShareModal.svelte';

	const event = $derived(getCurrentEvent());
	const totals = $derived(event ? getEventTotals(event) : null);

	let massText = $state('');
	let quickName = $state('');
	let shareOpen = $state(false);
	let masterExpanded = $state(false);
	let editingMasterIdx = $state(/** @type {number | null} */ (null));
	let editMasterDraft = $state('');

	const MASTER_PREVIEW = 5;

	const availableMaster = $derived.by(() => {
		if (!event) return [];
		const currentNames = new Set(event.participants.map((p) => p.name.toLowerCase()));
		return app.data.masterList.filter((m) => !currentNames.has(m.toLowerCase()));
	});

	const visibleMaster = $derived(
		masterExpanded ? availableMaster : availableMaster.slice(0, MASTER_PREVIEW)
	);
	const hiddenMasterCount = $derived(Math.max(0, availableMaster.length - MASTER_PREVIEW));

	function addCourt() {
		event?.courts.push({ fee: 0, payer: '', name: '' });
		persist();
	}

	/** @param {number} idx */
	function removeCourt(idx) {
		event?.courts.splice(idx, 1);
		persist();
	}

	function addAdditionalFee() {
		if (!event) return;
		if (!Array.isArray(event.additionalFees)) event.additionalFees = [];
		event.additionalFees.push({ name: '', amount: 0, payer: '' });
		persist();
	}

	/** @param {number} idx */
	function removeAdditionalFee(idx) {
		event?.additionalFees?.splice(idx, 1);
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
		if (editingMasterIdx === idx) cancelEditMaster();
		else if (editingMasterIdx !== null && editingMasterIdx > idx) editingMasterIdx -= 1;
		app.data.masterList.splice(idx, 1);
		persist();
	}

	/** @param {number} idx */
	function startEditMaster(idx) {
		editingMasterIdx = idx;
		editMasterDraft = app.data.masterList[idx] ?? '';
	}

	function cancelEditMaster() {
		editingMasterIdx = null;
		editMasterDraft = '';
	}

	function saveEditMaster() {
		if (editingMasterIdx === null) return;
		const trimmed = editMasterDraft.trim();
		if (!trimmed) return;
		const name = titleCase(trimmed);
		const idx = editingMasterIdx;
		const lower = name.toLowerCase();
		const dup = app.data.masterList.some((m, i) => i !== idx && m.toLowerCase() === lower);
		if (dup) return;
		if (app.data.masterList[idx] === name) {
			cancelEditMaster();
			return;
		}
		app.data.masterList[idx] = name;
		cancelEditMaster();
		persist();
	}

	/** @param {KeyboardEvent} e */
	function onEditMasterKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEditMaster();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEditMaster();
		}
	}

	/**
	 * @param {import('$lib/storage.js').Participant} person
	 * @param {Event & { currentTarget: HTMLInputElement }} e
	 */
	function onFixedAmountInput(person, e) {
		const raw = e.currentTarget.value;
		if (raw === '') {
			person.fixedAmount = null;
			persistSoon();
			return;
		}
		const n = Number(raw);
		// Ignore incomplete/invalid drafts (e.g. "-", "1e") so we never persist NaN.
		if (!Number.isFinite(n) || n < 0) return;
		person.fixedAmount = n;
		persistSoon();
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
				<button type="button" class="btn-secondary switch-event-btn" onclick={showProfileScreen}>
					Profile
				</button>
				<button type="button" class="btn-secondary switch-event-btn" onclick={showGateScreen}>
					Events
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
				<div class="court-list">
					{#if event.courts.length === 0}
						<p class="empty-state">No courts yet. Add one below to start splitting fees.</p>
					{/if}
					{#each event.courts as court, idx (idx)}
						{@const courtLabel = court.name?.trim() || `Court ${idx + 1}`}
						<div class="court-row">
							<input
								type="text"
								class="court-label"
								placeholder="Court {idx + 1}"
								aria-label="Court {idx + 1} name"
								bind:value={court.name}
								oninput={persistSoon}
							/>
							<input
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								aria-label="{courtLabel} fee"
								class="court-fee-input"
								bind:value={court.fee}
								oninput={persistSoon}
							/>
							<button
								type="button"
								class="remove-btn"
								aria-label="Remove {courtLabel}"
								onclick={() => removeCourt(idx)}
							>
								<IconX />
							</button>
							<input
								type="text"
								class="court-payer-input"
								placeholder="Paid by (optional)"
								aria-label="{courtLabel} paid by"
								bind:value={court.payer}
								oninput={persistSoon}
							/>
						</div>
					{/each}
				</div>
				<button type="button" class="btn-secondary add-court-btn" onclick={addCourt}>
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
							<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
							<path d="M3 6h18" />
							<path d="M16 10a4 4 0 0 1-8 0" />
						</svg>
					</span>
					Additional Fees
				</h2>
				<div class="court-list">
					{#if getAdditionalFees(event).length === 0}
						<p class="empty-state">
							Add group extras like food or drinks. They split evenly with the court fees.
						</p>
					{/if}
					{#each event.additionalFees ?? [] as extra, idx (idx)}
						{@const extraLabel = extra.name?.trim() || `Extra ${idx + 1}`}
						<div class="court-row">
							<input
								type="text"
								class="court-label"
								placeholder={idx === 0 ? 'Food' : 'e.g. Drinks'}
								aria-label="Extra {idx + 1} name"
								bind:value={extra.name}
								oninput={persistSoon}
							/>
							<input
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								aria-label="{extraLabel} amount"
								class="court-fee-input"
								bind:value={extra.amount}
								oninput={persistSoon}
							/>
							<button
								type="button"
								class="remove-btn"
								aria-label="Remove {extraLabel}"
								onclick={() => removeAdditionalFee(idx)}
							>
								<IconX />
							</button>
							<input
								type="text"
								class="court-payer-input"
								placeholder="Paid by (optional)"
								aria-label="{extraLabel} paid by"
								bind:value={extra.payer}
								oninput={persistSoon}
							/>
						</div>
					{/each}
				</div>
				<button type="button" class="btn-secondary add-court-btn" onclick={addAdditionalFee}>
					<IconPlus />
					Add Extra
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
						{#each visibleMaster as name (name)}
							<button type="button" class="chip" onclick={() => addFromMaster(name)}>
								+ {titleCase(name)}
							</button>
						{/each}
						{#if hiddenMasterCount > 0}
							<button
								type="button"
								class="chip chip-more"
								onclick={() => (masterExpanded = !masterExpanded)}
							>
								{masterExpanded ? 'Show less' : `Show more (${hiddenMasterCount})`}
							</button>
						{/if}
					{/if}
				</div>

				<div class="participant-list">
					{#if event.participants.length === 0}
						<p class="empty-state">No participants yet. Add names above or from the master list.</p>
					{/if}
					{#each event.participants as person, idx (person.name + idx)}
						{@const amountRow = totals.participantAmounts[idx]}
						<div class="participant-row" class:paid={person.paid}>
							<label class="participant-check">
								<input type="checkbox" bind:checked={person.paid} onchange={persist} />
								<span>{titleCase(person.name)}</span>
							</label>
							<span class="participant-owed money" title="Amount owed">
								{formatCurrency(amountRow?.owed ?? 0)}
							</span>
							<input
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								class="participant-fixed"
								placeholder="equal"
								aria-label="{titleCase(person.name)} fixed amount"
								value={person.fixedAmount ?? ''}
								oninput={(e) => onFixedAmountInput(person, e)}
							/>
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
					<span class="summary-highlight-label">
						{totals.hasFixedAmounts ? 'Standard share' : 'Amount per person'}
					</span>
					<span class="summary-highlight-value money">{formatCurrency(totals.perPerson)}</span>
				</div>
				{#if totals.hasFixedAmounts}
					<p class="fixed-amounts-note">
						{totals.fixedCount}
						{totals.fixedCount === 1 ? 'person' : 'people'} on fixed amounts
						({formatCurrency(totals.fixedTotal)} total)
					</p>
				{/if}
				{#if totals.fixedMismatch}
					<p class="field-error" role="alert">
						Fixed amounts ({formatCurrency(totals.fixedTotal)}) don’t match the total fee
						({formatCurrency(totals.totalFee)}).
					</p>
				{/if}
				<div class="fee-breakdown">
					<div class="fee-breakdown-row">
						<span>Court fees</span>
						<span class="money">{formatCurrency(totals.courtTotal)}</span>
					</div>
					<div class="fee-breakdown-row">
						<span>Extra fees</span>
						<span class="money">{formatCurrency(totals.extraTotal)}</span>
					</div>
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
				This is the full list of members remembered across events. Editing or removing someone
				here only affects future events.
			</p>
			<div class="master-manage-list">
				{#each app.data.masterList as name, idx (name + '-' + idx)}
					<div class="master-row">
						{#if editingMasterIdx === idx}
							<input
								type="text"
								class="master-edit-input"
								bind:value={editMasterDraft}
								aria-label="Edit master list name"
								autofocus
								onkeydown={onEditMasterKeydown}
							/>
							<div class="master-row-actions">
								<button
									type="button"
									class="edit-btn save-btn"
									aria-label="Save name"
									onclick={saveEditMaster}
								>
									<IconCheck />
								</button>
								<button
									type="button"
									class="remove-btn"
									aria-label="Cancel edit"
									onclick={cancelEditMaster}
								>
									<IconX />
								</button>
							</div>
						{:else}
							<span>{titleCase(name)}</span>
							<div class="master-row-actions">
								<button
									type="button"
									class="edit-btn"
									aria-label="Edit {titleCase(name)}"
									onclick={() => startEditMaster(idx)}
								>
									<IconPencil />
								</button>
								<button
									type="button"
									class="remove-btn"
									aria-label="Remove from master list"
									onclick={() => removeMaster(idx)}
								>
									<IconX />
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</details>
	</section>

	<ShareModal bind:open={shareOpen} {event} date={app.currentDate} />
{/if}
