import { emptyData, loadData, saveData } from './storage.js';
import { titleCase } from './format.js';

/**
 * @typedef {import('./storage.js').AppData} AppData
 * @typedef {import('./storage.js').EventRecord} EventRecord
 * @typedef {{ name: string, selected: boolean }} RosterEntry
 * @typedef {{ id: string, email: string, displayName: string | null }} SessionUser
 */

export const app = $state({
	/** @type {AppData} */
	data: emptyData(),
	/** @type {SessionUser | null} */
	sessionUser: null,
	booting: true,
	/** @type {string | null} */
	currentDate: null,
	/** @type {RosterEntry[]} */
	pendingRoster: [],
	/** @type {'gate' | 'roster' | 'main' | 'profile'} */
	screen: 'gate',
	gateDate: new Date().toISOString().slice(0, 10),
	/** @type {'idle' | 'saving' | 'saved' | 'error'} */
	syncStatus: 'idle'
});

let persistTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
let savedStatusTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

export async function persist() {
	if (!app.sessionUser) return;
	app.syncStatus = 'saving';
	try {
		await saveData(app.data);
		app.syncStatus = 'saved';
		if (savedStatusTimer) clearTimeout(savedStatusTimer);
		savedStatusTimer = setTimeout(() => {
			if (app.syncStatus === 'saved') app.syncStatus = 'idle';
		}, 2000);
	} catch (e) {
		console.warn('Could not save data.', e);
		app.syncStatus = 'error';
	}
}

export function persistSoon() {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistTimer = null;
		persist();
	}, 400);
}

export async function loadFromServer() {
	app.data = await loadData();
}

export async function bootSession() {
	try {
		const res = await fetch('/api/auth/me');
		if (res.ok) {
			const body = await res.json();
			app.sessionUser = body.user ?? null;
			if (app.sessionUser) {
				await loadFromServer();
			}
		} else {
			app.sessionUser = null;
			app.data = emptyData();
		}
	} catch (e) {
		console.warn('Could not restore session.', e);
		app.sessionUser = null;
	} finally {
		app.booting = false;
	}
}

/**
 * @param {'login' | 'register'} mode
 * @param {{
 *   email: string,
 *   password: string,
 *   passwordConfirm?: string,
 *   turnstileToken: string,
 *   rememberMe?: boolean
 * }} creds
 */
export async function authenticate(mode, creds) {
	const rememberMe = creds.rememberMe !== false;
	const payload =
		mode === 'register'
			? {
					email: creds.email,
					password: creds.password,
					passwordConfirm: creds.passwordConfirm ?? '',
					turnstileToken: creds.turnstileToken,
					rememberMe
				}
			: {
					email: creds.email,
					password: creds.password,
					turnstileToken: creds.turnstileToken,
					rememberMe
				};
	const res = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(typeof body.error === 'string' ? body.error : 'Could not sign in.');
	}
	app.sessionUser = body.user;
	await loadFromServer();
}

/** @param {string} displayName */
export async function updateProfile(displayName) {
	const res = await fetch('/api/auth/profile', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ displayName })
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(typeof body.error === 'string' ? body.error : 'Could not update profile.');
	}
	app.sessionUser = body.user;
}

/**
 * @param {{ currentPassword: string, newPassword: string, newPasswordConfirm: string }} payload
 */
export async function changePassword(payload) {
	const res = await fetch('/api/auth/password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(typeof body.error === 'string' ? body.error : 'Could not change password.');
	}
}

export async function logout() {
	try {
		await fetch('/api/auth/logout', { method: 'POST' });
	} catch {
		// Still clear local session.
	}
	if (persistTimer) {
		clearTimeout(persistTimer);
		persistTimer = null;
	}
	app.sessionUser = null;
	app.data = emptyData();
	app.currentDate = null;
	app.pendingRoster = [];
	app.screen = 'gate';
	app.syncStatus = 'idle';
}

/** @returns {EventRecord | null} */
export function getCurrentEvent() {
	if (!app.currentDate) return null;
	return app.data.events[app.currentDate] ?? null;
}

export function getEventHistoryDates() {
	return Object.keys(app.data.events).sort().reverse();
}

export function getPreviousEventDates() {
	return Object.keys(app.data.events)
		.filter((d) => d !== app.currentDate)
		.sort()
		.reverse();
}

/** @param {string} date */
export function namesFromEvent(date) {
	const event = app.data.events[date];
	if (!event || !Array.isArray(event.participants)) return [];
	return event.participants.map((p) => p.name).filter(Boolean);
}

/** @param {string[]} names */
export function setPendingRosterFromNames(names) {
	const seen = new Set();
	app.pendingRoster = [];
	names.forEach((name) => {
		const key = name.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		app.pendingRoster.push({ name, selected: true });
	});
}

/**
 * @param {string} date
 * @param {string[]} names
 */
export function createEventWithParticipants(date, names) {
	app.data.events[date] = {
		courts: [{ fee: 0, payer: '' }],
		participants: names.map((name) => ({ name, paid: false })),
		createdAt: new Date().toISOString()
	};
}

/** @param {string} date */
export function deleteEvent(date) {
	delete app.data.events[date];
	if (app.currentDate === date) {
		app.currentDate = null;
	}
	persist();
}

/** @param {string[]} names */
export function mergeNamesIntoMaster(names) {
	names.forEach((name) => {
		const exists = app.data.masterList.some((m) => m.toLowerCase() === name.toLowerCase());
		if (!exists) app.data.masterList.push(name);
	});
}

/** @param {string[]} names */
export function addParticipantsToEvent(names) {
	const event = getCurrentEvent();
	if (!event) return;
	names.forEach((name) => {
		const exists = event.participants.some((p) => p.name.toLowerCase() === name.toLowerCase());
		if (!exists) event.participants.push({ name, paid: false });
	});
}

export function showGateScreen() {
	app.screen = 'gate';
	app.pendingRoster = [];
}

export function showProfileScreen() {
	app.screen = 'profile';
}

/** @param {string} date */
export function openEvent(date) {
	app.currentDate = date;
	if (app.data.events[date]) {
		app.screen = 'main';
		return;
	}
	app.screen = 'roster';
}

export function confirmRoster() {
	if (!app.currentDate) return;
	const names = app.pendingRoster.filter((p) => p.selected).map((p) => p.name);
	mergeNamesIntoMaster(names);
	createEventWithParticipants(app.currentDate, names);
	persist();
	app.pendingRoster = [];
	app.screen = 'main';
}

/** @param {string} raw */
export function addNameToPendingRoster(raw) {
	const name = titleCase(raw);
	if (!name) return;
	const existing = app.pendingRoster.find((p) => p.name.toLowerCase() === name.toLowerCase());
	if (existing) {
		existing.selected = true;
	} else {
		app.pendingRoster.push({ name, selected: true });
	}
}
