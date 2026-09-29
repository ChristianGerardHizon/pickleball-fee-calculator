<script>
	import { formatAccountName, formatCurrency, formatDateLabel, parseNames, titleCase } from '$lib/format.js';
	import {
		ensureCourtAmountsLength,
		getAdditionalFees,
		getEventTotals,
		getPersonBreakdown,
		ME_PAYER,
		payToDisplayName
	} from '$lib/math.js';
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
	const multiPayTo = $derived(Boolean(totals?.multiPayTo));
	const mePayToLabel = $derived(
		app.sessionUser
			? formatAccountName(app.sessionUser.email, app.sessionUser.displayName)
			: ME_PAYER
	);
	const isOnlyMePayTo = $derived(
		Boolean(
			totals?.payTo &&
				totals.payTo.rows.length === 1 &&
				totals.payTo.rows[0].payer === ME_PAYER
		)
	);

	let massText = $state('');
	let quickName = $state('');
	let shareOpen = $state(false);
	let sharePersonIdx = $state(/** @type {number | null} */ (null));
	let masterExpanded = $state(false);
	let editingMasterIdx = $state(/** @type {number | null} */ (null));
	let editMasterDraft = $state('');
	let editingFixedIdx = $state(/** @type {number | null} */ (null));
	let editFixedDraft = $state('');
	let personDetailIdx = $state(/** @type {number | null} */ (null));

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

	const personBreakdown = $derived(
		event && personDetailIdx !== null ? getPersonBreakdown(event, personDetailIdx) : null
	);

	function syncAllCourtAmounts() {
		if (!event) return;
		const n = event.courts.length;
		for (const p of event.participants) ensureCourtAmountsLength(p, n);
	}

	function addCourt() {
		if (!event) return;
		event.courts.push({ fee: 0, payer: '', name: '' });
		syncAllCourtAmounts();
		persist();
	}

	/** @param {number} idx */
	function removeCourt(idx) {
		if (!event) return;
		event.courts.splice(idx, 1);
		for (const p of event.participants) {
			if (!Array.isArray(p.courtAmounts)) p.courtAmounts = [];
			p.courtAmounts.splice(idx, 1);
			ensureCourtAmountsLength(p, event.courts.length);
		}
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
		if (editingFixedIdx === idx) cancelEditFixed();
		else if (editingFixedIdx !== null && editingFixedIdx > idx) editingFixedIdx -= 1;
		if (personDetailIdx === idx) closePersonDetail();
		else if (personDetailIdx !== null && personDetailIdx > idx) personDetailIdx -= 1;
		if (sharePersonIdx === idx) {
			shareOpen = false;
			sharePersonIdx = null;
		} else if (sharePersonIdx !== null && sharePersonIdx > idx) sharePersonIdx -= 1;
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

	/** @param {number} idx */
	function startEditFixed(idx) {
		const person = event?.participants[idx];
		if (!person) return;
		editingFixedIdx = idx;
		editFixedDraft = person.fixedAmount != null ? String(person.fixedAmount) : '';
	}

	function cancelEditFixed() {
		editingFixedIdx = null;
		editFixedDraft = '';
	}

	function saveEditFixed() {
		if (editingFixedIdx === null || !event) return;
		const person = event.participants[editingFixedIdx];
		if (!person) {
			cancelEditFixed();
			return;
		}
		const raw = editFixedDraft.trim();
		if (raw === '') {
			person.fixedAmount = null;
			cancelEditFixed();
			persistSoon();
			return;
		}
		const n = Number(raw);
		if (!Number.isFinite(n) || n < 0) {
			cancelEditFixed();
			return;
		}
		person.fixedAmount = n;
		cancelEditFixed();
		persistSoon();
	}

	/** @param {KeyboardEvent} e */
	function onEditFixedKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEditFixed();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEditFixed();
		}
	}

	/** @param {number} idx */
	function openPersonDetail(idx) {
		if (!event) return;
		ensureCourtAmountsLength(event.participants[idx], event.courts.length);
		personDetailIdx = idx;
	}

	function closePersonDetail() {
		personDetailIdx = null;
	}

	/**
	 * @param {number} courtIdx
	 * @param {string} raw
	 */
	function setPersonCourtAmount(courtIdx, raw) {
		if (personDetailIdx === null || !event) return;
		const person = event.participants[personDetailIdx];
		if (!person) return;
		ensureCourtAmountsLength(person, event.courts.length);
		const trimmed = raw.trim();
		if (trimmed === '') {
			person.courtAmounts[courtIdx] = null;
			persistSoon();
			return;
		}
		const n = Number(trimmed);
		if (!Number.isFinite(n) || n < 0) return;
		person.courtAmounts[courtIdx] = n;
		persistSoon();
	}

	function clearPersonCustoms() {
		if (personDetailIdx === null || !event) return;
		const person = event.participants[personDetailIdx];
		if (!person) return;
		person.courtAmounts = event.courts.map(() => null);
		person.fixedAmount = null;
		persist();
	}

	function openEventShare() {
		sharePersonIdx = null;
		shareOpen = true;
	}

	function openPersonShare() {
		if (personDetailIdx === null) return;
		sharePersonIdx = personDetailIdx;
		shareOpen = true;
	}

	/** @param {KeyboardEvent} e */
	function onQuickKeydown(e) {
		if (e.key === 'Enter') quickAdd();
	}

	/** @param {KeyboardEvent} e */
	function onPersonDetailKeydown(e) {
		if (e.key === 'Escape' && personDetailIdx !== null && !shareOpen) {
			e.preventDefault();
			closePersonDetail();
		}
	}
</script>

<svelte:window onkeydown={onPersonDetailKeydown} />

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
								placeholder="Pay to (optional)"
								aria-label="{courtLabel} pay to"
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
								placeholder="Pay to (optional)"
								aria-label="{extraLabel} pay to"
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

			<div class="card card-participants">
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
					{:else}
						<table class="participant-table">
							<thead>
								<tr>
									<th scope="col" class="col-paid">Paid</th>
									<th scope="col" class="col-name">Name</th>
									<th scope="col" class="col-amount">Amount</th>
									{#if !multiPayTo}
										<th scope="col" class="col-edit">
											<span class="sr-only">Custom amount</span>
										</th>
									{/if}
									<th scope="col" class="col-remove">
										<span class="sr-only">Remove</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{#each event.participants as person, idx (person.name + idx)}
									{@const amountRow = totals.participantAmounts[idx]}
									{@const isFixed = Boolean(amountRow?.isFixed)}
									<tr class="participant-row" class:paid={person.paid} class:is-custom={isFixed}>
										<td class="col-paid">
											<label class="participant-check participant-check-only">
												<input
													type="checkbox"
													bind:checked={person.paid}
													onchange={persist}
													aria-label="Mark {titleCase(person.name)} as paid"
												/>
											</label>
										</td>
										<td class="col-name">
											<span class="participant-identity">
												{#if multiPayTo}
													<button
														type="button"
														class="participant-name-btn"
														onclick={() => openPersonDetail(idx)}
													>
														{titleCase(person.name)}
													</button>
												{:else}
													<span class="participant-name">{titleCase(person.name)}</span>
												{/if}
												{#if isFixed || person.paid}
													<span class="participant-meta">
														{#if isFixed}
															<span class="custom-badge">Custom</span>
														{/if}
														{#if person.paid}
															<span class="paid-badge">Paid</span>
														{/if}
													</span>
												{/if}
											</span>
										</td>
										<td class="col-amount">
											<span class="participant-owed money" title="Amount owed">
												{formatCurrency(amountRow?.owed ?? 0)}
											</span>
										</td>
										{#if !multiPayTo}
											<td class="col-edit">
												{#if editingFixedIdx === idx}
													<input
														type="number"
														min="0"
														step="0.01"
														inputmode="decimal"
														class="participant-fixed"
														placeholder="amount"
														aria-label="{titleCase(person.name)} custom amount"
														value={editFixedDraft}
														autofocus
														oninput={(e) => {
															editFixedDraft = e.currentTarget.value;
														}}
														onkeydown={onEditFixedKeydown}
														onblur={saveEditFixed}
													/>
												{:else}
													<button
														type="button"
														class="participant-fixed-btn"
														class:is-custom={isFixed}
														aria-label={isFixed
															? `Edit ${titleCase(person.name)} custom amount`
															: `Set custom amount for ${titleCase(person.name)}`}
														onclick={() => startEditFixed(idx)}
													>
														<IconPencil />
													</button>
												{/if}
											</td>
										{/if}
										<td class="col-remove">
											<button
												type="button"
												class="remove-btn"
												aria-label="Remove participant"
												onclick={() => removeParticipant(idx)}
											>
												<IconX />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
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
				{#if totals.payTo && isOnlyMePayTo}
					<div class="summary-highlight payto-only-me">
						<span class="summary-highlight-label">Pay to {mePayToLabel}</span>
						<span class="summary-highlight-value money">
							{formatCurrency(totals.payTo.rows[0].amount)}{#if totals.payTo.mode === 'each'}<span
									class="payto-hero-each">each</span
								>{/if}
						</span>
					</div>
				{:else if totals.payTo}
					<div class="summary-highlight payto-highlight">
						<span class="summary-highlight-label">Pay to</span>
						{#each totals.payTo.rows as row, idx (`${row.payer}-${idx}`)}
							<div class="payto-hero-row">
								<span class="payto-hero-name">{payToDisplayName(row.payer, mePayToLabel)}</span>
								<span class="payto-hero-amount money">
									{formatCurrency(row.amount)}{#if totals.payTo.mode === 'each'}<span
											class="payto-hero-each">each</span
										>{/if}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="summary-highlight">
						<span class="summary-highlight-label">
							{totals.hasFixedAmounts ? 'Standard share' : 'Amount per person'}
						</span>
						<span class="summary-highlight-value money">{formatCurrency(totals.perPerson)}</span>
					</div>
				{/if}
				{#if totals.hasFixedAmounts}
					<p class="fixed-amounts-note">
						{totals.fixedCount}
						{totals.fixedCount === 1 ? 'person' : 'people'} with custom amounts
						({formatCurrency(totals.fixedTotal)} total). Summary above is for everyone else.
					</p>
				{/if}
				{#if totals.fixedMismatch}
					<p class="field-error" role="alert">
						{#if totals.multiPayTo}
							Custom court amounts don’t match one or more court fees.
						{:else}
							Fixed amounts ({formatCurrency(totals.fixedTotal)}) don’t match the total fee
							({formatCurrency(totals.totalFee)}).
						{/if}
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
			</div>
			<button type="button" class="btn-primary" onclick={openEventShare}>
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

	{#if personDetailIdx !== null && personBreakdown}
		<div
			class="modal"
			onclick={(e) => {
				if (e.target === e.currentTarget) closePersonDetail();
			}}
			role="presentation"
		>
			<div
				class="modal-content person-detail-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="person-detail-title"
			>
				<button
					type="button"
					class="modal-close"
					aria-label="Close"
					onclick={closePersonDetail}
				>
					<IconX />
				</button>
				<h2 id="person-detail-title">{titleCase(personBreakdown.name)}</h2>
				<p class="hint person-detail-total">
					Total owed
					<span class="money">{formatCurrency(personBreakdown.owed)}</span>
				</p>

				{#if personBreakdown.multiPayTo}
					<div class="person-breakdown-list">
						{#each personBreakdown.courtLines as line (line.courtIndex)}
							<div class="person-breakdown-row" class:is-custom={line.isCustom}>
								<div class="person-breakdown-meta">
									<span class="person-breakdown-name">{line.courtName}</span>
									<span class="person-breakdown-sub">
										Fee {formatCurrency(line.fee)} · Pay to {payToDisplayName(
											line.payer,
											mePayToLabel
										)}
									</span>
								</div>
								<input
									type="number"
									min="0"
									step="0.01"
									inputmode="decimal"
									class="person-breakdown-amount"
									aria-label="{line.courtName} amount for {titleCase(personBreakdown.name)}"
									placeholder={String(line.amount)}
									value={line.isCustom ? String(line.amount) : ''}
									oninput={(e) => setPersonCourtAmount(line.courtIndex, e.currentTarget.value)}
								/>
							</div>
						{/each}
						{#if personBreakdown.extraShare > 0.004}
							<div class="person-breakdown-row person-breakdown-extra">
								<div class="person-breakdown-meta">
									<span class="person-breakdown-name">Extra fees</span>
									<span class="person-breakdown-sub">Split evenly</span>
								</div>
								<span class="money person-breakdown-readonly">
									{formatCurrency(personBreakdown.extraShare)}
								</span>
							</div>
						{/if}
					</div>
					<p class="hint">Leave blank to use the equal share for that court.</p>
				{/if}

				<div class="person-detail-actions">
					{#if personBreakdown.isFixed}
						<button type="button" class="btn-secondary" onclick={clearPersonCustoms}>
							Clear custom
						</button>
					{/if}
					<button type="button" class="btn-primary" onclick={openPersonShare}>
						Generate summary
					</button>
				</div>
			</div>
		</div>
	{/if}

	<ShareModal
		bind:open={shareOpen}
		{event}
		date={app.currentDate}
		meLabel={mePayToLabel}
		participantIndex={sharePersonIdx}
	/>
{/if}
