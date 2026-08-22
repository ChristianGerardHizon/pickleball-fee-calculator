import { json } from '@sveltejs/kit';
import {
	createSession,
	hashPassword,
	isValidEmail,
	isValidPassword,
	normalizeEmail,
	setSessionCookie
} from '$lib/server/auth.js';
import { EMPTY_PAYLOAD, getDb } from '$lib/server/db.js';
import { verifyTurnstileToken } from '$lib/server/turnstile.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform, cookies, url, getClientAddress }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
	const password = typeof body.password === 'string' ? body.password : '';
	const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : '';
	const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';

	const human = await verifyTurnstileToken(platform, turnstileToken, getClientAddress());
	if (!human) {
		return json({ error: 'Bot check failed. Please try again.' }, { status: 400 });
	}

	if (!isValidEmail(email)) {
		return json({ error: 'Enter a valid email address.' }, { status: 400 });
	}
	if (!isValidPassword(password)) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
	}
	if (password !== passwordConfirm) {
		return json({ error: 'Passwords do not match.' }, { status: 400 });
	}

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
	if (existing) {
		return json({ error: 'That email is already registered.' }, { status: 409 });
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const passwordHash = await hashPassword(password);

	await db.batch([
		db
			.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
			.bind(id, email, passwordHash, now),
		db
			.prepare('INSERT INTO user_data (user_id, payload, updated_at) VALUES (?, ?, ?)')
			.bind(id, EMPTY_PAYLOAD, now)
	]);

	const sessionId = await createSession(db, id);
	setSessionCookie(cookies, sessionId, url.protocol === 'https:');

	return json({ user: { id, email } });
}
