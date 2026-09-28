<script>
	import { formatAccountName } from '$lib/format.js';
	import {
		app,
		changePassword,
		logout,
		showGateScreen,
		updateProfile
	} from '$lib/state.svelte.js';

	let displayName = $state(app.sessionUser?.displayName ?? '');
	let currentPassword = $state('');
	let newPassword = $state('');
	let newPasswordConfirm = $state('');
	let nameError = $state('');
	let passwordError = $state('');
	let nameSaved = $state(false);
	let passwordSaved = $state(false);
	let nameBusy = $state(false);
	let passwordBusy = $state(false);
	let showPassword = $state(false);

	async function saveName() {
		nameError = '';
		nameSaved = false;
		if (displayName.trim().length > 80) {
			nameError = 'Display name must be 80 characters or fewer.';
			return;
		}
		nameBusy = true;
		try {
			await updateProfile(displayName);
			nameSaved = true;
		} catch (e) {
			nameError = e instanceof Error ? e.message : 'Could not update profile.';
		} finally {
			nameBusy = false;
		}
	}

	async function savePassword() {
		passwordError = '';
		passwordSaved = false;
		if (!currentPassword) {
			passwordError = 'Enter your current password.';
			return;
		}
		if (newPassword.length < 8) {
			passwordError = 'Password must be at least 8 characters.';
			return;
		}
		if (newPassword !== newPasswordConfirm) {
			passwordError = 'Passwords do not match.';
			return;
		}
		passwordBusy = true;
		try {
			await changePassword({
				currentPassword,
				newPassword,
				newPasswordConfirm
			});
			currentPassword = '';
			newPassword = '';
			newPasswordConfirm = '';
			passwordSaved = true;
		} catch (e) {
			passwordError = e instanceof Error ? e.message : 'Could not change password.';
		} finally {
			passwordBusy = false;
		}
	}

	async function onLogout() {
		await logout();
	}
</script>

<section class="screen gate-screen">
	<div class="gate-card event-home">
		<h1>Profile</h1>
		<p class="subtitle">
			{#if app.sessionUser}
				{formatAccountName(app.sessionUser.email, app.sessionUser.displayName)}
			{/if}
		</p>

		<label for="profile-name">Display name</label>
		<input
			type="text"
			id="profile-name"
			maxlength="80"
			autocomplete="nickname"
			bind:value={displayName}
			aria-describedby="profile-name-error"
		/>
		{#if nameError}
			<p id="profile-name-error" class="field-error">{nameError}</p>
		{/if}
		<button type="button" class="btn-primary" disabled={nameBusy} onclick={saveName}>
			{nameBusy ? 'Saving…' : 'Save name'}
		</button>
		{#if nameSaved}
			<p class="save-ok" aria-live="polite">Name saved.</p>
		{/if}

		<label for="profile-email">Email</label>
		<input type="email" id="profile-email" value={app.sessionUser?.email ?? ''} readonly />

		<h2 class="history-heading">Change password</h2>

		<label for="profile-current-password">Current password</label>
		<div class="password-field">
			<input
				type={showPassword ? 'text' : 'password'}
				id="profile-current-password"
				autocomplete="current-password"
				bind:value={currentPassword}
				aria-describedby="profile-password-error"
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

		<label for="profile-new-password">New password</label>
		<input
			type={showPassword ? 'text' : 'password'}
			id="profile-new-password"
			autocomplete="new-password"
			bind:value={newPassword}
		/>

		<label for="profile-new-password-confirm">Re-enter new password</label>
		<input
			type={showPassword ? 'text' : 'password'}
			id="profile-new-password-confirm"
			autocomplete="new-password"
			bind:value={newPasswordConfirm}
		/>
		{#if passwordError}
			<p id="profile-password-error" class="field-error">{passwordError}</p>
		{/if}

		<button type="button" class="btn-primary" disabled={passwordBusy} onclick={savePassword}>
			{passwordBusy ? 'Saving…' : 'Update password'}
		</button>
		{#if passwordSaved}
			<p class="save-ok" aria-live="polite">Password updated.</p>
		{/if}

		<button type="button" class="btn-secondary gate-logout" onclick={showGateScreen}>
			Back to events
		</button>
		<button type="button" class="btn-secondary gate-logout" onclick={onLogout}>Sign out</button>
	</div>
</section>
