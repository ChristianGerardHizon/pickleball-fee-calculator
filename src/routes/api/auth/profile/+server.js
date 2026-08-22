import { json } from '@sveltejs/kit';
import { isValidDisplayName, parseDisplayName, publicUser } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, locals, platform }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (typeof body.displayName !== 'string' || !isValidDisplayName(body.displayName)) {
		return json({ error: 'Display name must be 80 characters or fewer.' }, { status: 400 });
	}

	const displayName = parseDisplayName(body.displayName);

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	await db
		.prepare('UPDATE users SET display_name = ? WHERE id = ?')
		.bind(displayName, locals.user.id)
		.run();

	return json({ user: publicUser(locals.user.id, locals.user.email, displayName) });
}
