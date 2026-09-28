import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

/**
 * @param {unknown} value
 * @returns {import('$lib/storage.js').AppData | null}
 */
function parsePayload(value) {
	if (!value || typeof value !== 'object') return null;
	const parsed = /** @type {Record<string, unknown>} */ (value);
	return {
		masterList: Array.isArray(parsed.masterList)
			? parsed.masterList.filter((n) => typeof n === 'string')
			: [],
		events: parsed.events && typeof parsed.events === 'object' && !Array.isArray(parsed.events)
			? /** @type {import('$lib/storage.js').AppData['events']} */ (parsed.events)
			: {}
	};
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, platform }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	const row = await db
		.prepare('SELECT payload FROM user_data WHERE user_id = ?')
		.bind(locals.user.id)
		.first();

	if (!row || typeof row.payload !== 'string') {
		return json({ masterList: [], events: {} });
	}

	try {
		const parsed = parsePayload(JSON.parse(row.payload));
		return json(parsed ?? { masterList: [], events: {} });
	} catch {
		return json({ masterList: [], events: {} });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ locals, platform, request }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const data = parsePayload(body);
	if (!data) {
		return json({ error: 'Invalid payload' }, { status: 400 });
	}

	let db;
	try {
		db = getDb(platform);
	} catch {
		return json({ error: 'Database is not configured' }, { status: 503 });
	}

	const now = new Date().toISOString();
	const payload = JSON.stringify(data);

	await db
		.prepare(
			`INSERT INTO user_data (user_id, payload, updated_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
		)
		.bind(locals.user.id, payload, now)
		.run();

	return json(data);
}
