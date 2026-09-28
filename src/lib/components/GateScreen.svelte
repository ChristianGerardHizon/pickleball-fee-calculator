<script>
	import { formatAccountName, formatCurrency, formatDateLabel } from '$lib/format.js';
	import { getEventTotals } from '$lib/math.js';
	import {
		app,
		authenticate,
		deleteEvent,
		getEventHistoryDates,
		logout,
		openEvent,
		showProfileScreen
	} from '$lib/state.svelte.js';
	import { createInvisibleTurnstile } from '$lib/turnstile.js';
	import IconPaddle from './IconPaddle.svelte';
	import IconX from './IconX.svelte';

	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let rememberMe = $state(true);
	let error = $state('');
	let busy = $state(false);
	let showPassword = $state(false);
	/** @type {'login' | 'register'} */
	let mode = $state('login');

	/** @type {HTMLDivElement | undefined} */
	let turnstileHost = $state(/** @type {HTMLDivElement | undefined} */ (undefined));
	/** @type {ReturnType<typeof createInvisibleTurnstile> | null} */
	let turnstile = null;

	const historyDates = $derived(getEventHistoryDates());

	$effect(() => {
		if (turnstileHost && !turnstile) {
			turnstile = createInvisibleTurnstile(turnstileHost);
		}
	});

	async function submitAuth() {
		error = '';
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !trimmedEmail.includes('@')) {
			error = 'Enter a valid email address.';
			return;
		}
		if (password.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}
		if (mode === 'register' && password !== passwordConfirm) {
			error = 'Passwords do not match.';
			return;
		}

		busy = true;
		try {
			if (!turnstile) throw new Error('Bot check is not ready. Please retry.');
			const turnstileToken = await turnstile.execute();
			await authenticate(mode, {
				email: trimmedEmail,
				password,
				passwordConfirm,
				turnstileToken,
				rememberMe
			});
			password = '';
			passwordConfirm = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not sign in.';
			await turnstile?.reset();
		} finally {
			busy = false;
		}
	}

	function submitEvent() {
		if (!app.gateDate) {
			error = 'Please select an event date.';
			return;
		}
		error = '';
		openEvent(app.gateDate);
	}

	/** @param {string} date */
	function onDeleteEvent(date) {
		const label = formatDateLabel(date);
		if (!confirm(`Delete the event for ${label}? This cannot be undone.`)) return;
		deleteEvent(date);
	}

	async function onLogout() {
		error = '';
		await logout();
		email = '';
		password = '';
		passwordConfirm = '';
	}

	/** @param {KeyboardEvent} e */
	function onAuthKeydown(e) {
		if (e.key === 'Enter') submitAuth();
	}

	/** @param {KeyboardEvent} e */
	function onEventKeydown(e) {
		if (e.key === 'Enter') submitEvent();
	}
</script>

<section class="screen gate-screen">
	<div class="gate-card" class:event-home={!!app.sessionUser}>
		<div class="brand-badge">
			<IconPaddle />
		</div>
		<h1>Pickleball Fee Splitter</h1>

		{#if !app.sessionUser}
			<p class="subtitle">
				{mode === 'login'
					? 'Sign in to open your events.'
					: 'Create an account to save events in the cloud.'}
			</p>

			<div class="auth-toggle" role="tablist">
				<button
					type="button"
					class="auth-toggle-btn"
					class:active={mode === 'login'}
					onclick={() => {
						mode = 'login';
						error = '';
					}}
				>
					Sign in
				</button>
				<button
					type="button"
					class="auth-toggle-btn"
					class:active={mode === 'register'}
					onclick={() => {
						mode = 'register';
						error = '';
					}}
				>
					Create account
				</button>
			</div>

			<label for="gate-email">Email</label>
			<input
				type="email"
				id="gate-email"
				autocomplete="email"
				bind:value={email}
				onkeydown={onAuthKeydown}
			/>

			<label for="gate-password">Password</label>
			<div class="password-field">
				<input
					type={showPassword ? 'text' : 'password'}
					id="gate-password"
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					bind:value={password}
					onkeydown={onAuthKeydown}
				/>
				<button
					type="button"
					class="password-toggle"
					aria-label={showPassword ? 'Hide password' : 'Show password'}
					onclick={() => (showPassword = !showPassword)}
				>
					{showPassword ? 'Hide' : 'Show'}
				</button>
			</div>

			{#if mode === 'register'}
				<label for="gate-password-confirm">Re-enter password</label>
				<input
					type={showPassword ? 'text' : 'password'}
					id="gate-password-confirm"
					autocomplete="new-password"
					bind:value={passwordConfirm}
					onkeydown={onAuthKeydown}
				/>
			{/if}

			<label class="remember-row" for="gate-remember">
				<input type="checkbox" id="gate-remember" bind:checked={rememberMe} />
				<span>
					<span class="remember-title">Remember me</span>
					<span class="remember-hint">Stay signed in on this device for 30 days.</span>
				</span>
			</label>

			<div class="turnstile-host" bind:this={turnstileHost}></div>

			<button type="button" class="btn-primary" disabled={busy} onclick={submitAuth}>
				{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
			</button>
		{:else}
			<p class="subtitle">
				Signed in as
				<strong>{formatAccountName(app.sessionUser.email, app.sessionUser.displayName)}</strong>.
				Open a past event or start a new one.
			</p>

			<div class="gate-account-actions">
				<button type="button" class="btn-secondary" onclick={showProfileScreen}>Profile</button>
			</div>

			<h2 class="history-heading">Event history</h2>
			{#if historyDates.length === 0}
				<p class="history-empty">No events yet. Pick a date below to start one.</p>
			{:else}
				<ul class="history-list">
					{#each historyDates as date (date)}
						{@const event = app.data.events[date]}
						{@const totals = event ? getEventTotals(event) : null}
						<li class="history-row">
							<button type="button" class="history-open" onclick={() => openEvent(date)}>
								<span class="history-date">{formatDateLabel(date)}</span>
								<span class="history-meta">
									{totals
										? `${totals.count} ${totals.count === 1 ? 'player' : 'players'} · ${formatCurrency(totals.remaining)} remaining`
										: ''}
								</span>
							</button>
							<button
								type="button"
								class="remove-btn history-delete"
								aria-label="Delete event {formatDateLabel(date)}"
								onclick={() => onDeleteEvent(date)}
							>
								<IconX />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<label for="gate-date">New event date</label>
			<input type="date" id="gate-date" bind:value={app.gateDate} onkeydown={onEventKeydown} />

			<button type="button" class="btn-primary" onclick={submitEvent}>Open Event</button>
			<button type="button" class="btn-secondary gate-logout" onclick={onLogout}>Sign out</button>
		{/if}

		<p class="error-text" aria-live="polite">{error}</p>
	</div>
</section>
