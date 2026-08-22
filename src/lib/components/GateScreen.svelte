<script>
	import { app, authenticate, logout, openEvent } from '$lib/state.svelte.js';
	import { createInvisibleTurnstile } from '$lib/turnstile.js';
	import IconPaddle from './IconPaddle.svelte';

	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let error = $state('');
	let busy = $state(false);
	let showPassword = $state(false);
	/** @type {'login' | 'register'} */
	let mode = $state('login');

	/** @type {HTMLDivElement | undefined} */
	let turnstileHost = $state(/** @type {HTMLDivElement | undefined} */ (undefined));
	/** @type {ReturnType<typeof createInvisibleTurnstile> | null} */
	let turnstile = null;

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
				turnstileToken
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
	<div class="gate-card">
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

			<div class="turnstile-host" bind:this={turnstileHost}></div>

			<button type="button" class="btn-primary" disabled={busy} onclick={submitAuth}>
				{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
			</button>
		{:else}
			<p class="subtitle">
				Signed in as <strong>{app.sessionUser.email}</strong>. Choose a date to open or start an
				event.
			</p>

			<label for="gate-date">Event date</label>
			<input type="date" id="gate-date" bind:value={app.gateDate} onkeydown={onEventKeydown} />

			<button type="button" class="btn-primary" onclick={submitEvent}>Open Event</button>
			<button type="button" class="btn-secondary gate-logout" onclick={onLogout}>Sign out</button>
		{/if}

		<p class="error-text" aria-live="polite">{error}</p>
	</div>
</section>
