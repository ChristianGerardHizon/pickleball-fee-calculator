import { json } from '@sveltejs/kit';
import {
	createSession,
	isValidEmail,
	isValidPassword,
	normalizeEmail,
	parseRememberMe,
	publicUser,
	setSessionCookie,
	verifyPassword
} from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
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
	const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
	const remember = parseRememberMe(body.rememberMe);

	const human = await verifyTurnstileToken(platform, turnstileToken, getClientAddress());
	if (!human) {
		return json({ error: 'Bot check failed. Please try again.' }, { status: 400 });
	}

	if (!isValidEmail(email) || !isValidPassword(password)) {
		return json({ error: 'Invalid email or password.' }, { status: 401 });
	}

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	const row = await db
		.prepare('SELECT id, email, display_name, password_hash FROM users WHERE email = ?')
		.bind(email)
		.first();

	if (!row) {
		return json({ error: 'Invalid email or password.' }, { status: 401 });
	}

	const ok = await verifyPassword(password, /** @type {string} */ (row.password_hash));
	if (!ok) {
		return json({ error: 'Invalid email or password.' }, { status: 401 });
	}

	const sessionId = await createSession(db, /** @type {string} */ (row.id), remember);
	setSessionCookie(cookies, sessionId, { secure: url.protocol === 'https:', remember });

	return json({
		user: publicUser(
			/** @type {string} */ (row.id),
			/** @type {string} */ (row.email),
			/** @type {string | null} */ (row.display_name)
		)
	});
}
