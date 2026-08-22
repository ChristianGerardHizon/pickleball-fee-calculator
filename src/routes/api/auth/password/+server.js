import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { hashPassword, isValidPassword, verifyPassword } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals, platform }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
	const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
	const newPasswordConfirm =
		typeof body.newPasswordConfirm === 'string' ? body.newPasswordConfirm : '';

	if (!isValidPassword(newPassword)) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
	}
	if (newPassword !== newPasswordConfirm) {
		return json({ error: 'Passwords do not match.' }, { status: 400 });
	}

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	const row = await db
		.prepare('SELECT password_hash FROM users WHERE id = ?')
		.bind(locals.user.id)
		.first();
	if (!row) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}

	const ok = await verifyPassword(currentPassword, /** @type {string} */ (row.password_hash));
	if (!ok) {
		return json({ error: 'Current password is incorrect.' }, { status: 401 });
	}

	const passwordHash = await hashPassword(newPassword);
	await db
		.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
		.bind(passwordHash, locals.user.id)
		.run();

	return json({ ok: true });
}
