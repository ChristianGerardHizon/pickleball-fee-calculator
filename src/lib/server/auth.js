import { getDb } from './db.js';

export const SESSION_COOKIE = 'pb_session';
const SESSION_DAYS = 30;
const SESSION_COOKIE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const TEMP_SESSION_MS = 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 100_000;
export const MAX_DISPLAY_NAME = 80;

/**
 * @typedef {{ id: string, email: string, displayName: string | null }} SessionUser
 */

/** @param {Uint8Array} bytes */
function bytesToB64(bytes) {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}

/** @param {string} b64 */
function b64ToBytes(b64) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** @param {unknown} value */
export function parseRememberMe(value) {
	if (value === false || value === 0 || value === 'false') return false;
	return true;
}

/** @param {unknown} value */
export function parseDisplayName(value) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, MAX_DISPLAY_NAME);
}

/**
 * @param {string} id
 * @param {string} email
 * @param {string | null | undefined} displayName
 * @returns {{ id: string, email: string, displayName: string | null }}
 */
export function publicUser(id, email, displayName) {
	const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null;
	return { id, email, displayName: name };
}

/** @param {string} password */
export async function hashPassword(password) {
	const enc = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		key,
		256
	);
	return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

/**
 * @param {string} password
 * @param {string} stored
 */
export async function verifyPassword(password, stored) {
	const parts = stored.split('$');
	if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
	const iterations = Number(parts[1]);
	if (!Number.isFinite(iterations) || iterations < 1) return false;
	const salt = b64ToBytes(parts[2]);
	const expected = b64ToBytes(parts[3]);
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		key,
		256
	);
	const actual = new Uint8Array(bits);
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}

/**
 * @param {boolean} remember
 */
function sessionExpiryIso(remember) {
	const ms = remember ? SESSION_DAYS * 24 * 60 * 60 * 1000 : TEMP_SESSION_MS;
	return new Date(Date.now() + ms).toISOString();
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {string} sessionId
 * @param {{ secure: boolean, remember: boolean }} opts
 */
export function setSessionCookie(cookies, sessionId, opts) {
	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: opts.secure,
		...(opts.remember ? { maxAge: SESSION_COOKIE_SECONDS } : {})
	});
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
export function clearSessionCookie(cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/**
 * @param {D1Database} db
 * @param {string} userId
 * @param {boolean} [remember]
 */
export async function createSession(db, userId, remember = true) {
	const id = crypto.randomUUID();
	const expires = sessionExpiryIso(remember);
	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at, remember) VALUES (?, ?, ?, ?)')
		.bind(id, userId, expires, remember ? 1 : 0)
		.run();
	return id;
}

/**
 * @param {App.Platform | undefined} platform
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {boolean} secure
 */
export async function touchSession(platform, cookies, secure) {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return;

	let db;
	try {
		db = getDb(platform);
	} catch {
		return;
	}

	const row = await db
		.prepare('SELECT remember, expires_at FROM sessions WHERE id = ?')
		.bind(sessionId)
		.first();
	if (!row) return;
	if (new Date(/** @type {string} */ (row.expires_at)).getTime() <= Date.now()) return;

	const remember = Number(row.remember) !== 0;
	const expires = sessionExpiryIso(remember);
	await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(expires, sessionId).run();
	setSessionCookie(cookies, sessionId, { secure, remember });
}

/**
 * @param {App.Platform | undefined} platform
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {Promise<SessionUser | null>}
 */
export async function getUserFromCookies(platform, cookies) {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return null;

	let db;
	try {
		db = getDb(platform);
	} catch {
		return null;
	}

	const row = await db
		.prepare(
			`SELECT u.id, u.email, u.display_name, s.expires_at
			 FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.id = ?`
		)
		.bind(sessionId)
		.first();

	if (!row) return null;
	if (new Date(/** @type {string} */ (row.expires_at)).getTime() <= Date.now()) {
		await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
		return null;
	}

	return publicUser(
		/** @type {string} */ (row.id),
		/** @type {string} */ (row.email),
		/** @type {string | null} */ (row.display_name)
	);
}

/** @param {string} email */
export function normalizeEmail(email) {
	return email.trim().toLowerCase();
}

/** @param {string} email */
export function isValidEmail(email) {
	return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** @param {string} password */
export function isValidPassword(password) {
	return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}

/** @param {string} name */
export function isValidDisplayName(name) {
	return typeof name === 'string' && name.trim().length <= MAX_DISPLAY_NAME;
}
