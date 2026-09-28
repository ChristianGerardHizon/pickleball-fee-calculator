import { json } from '@sveltejs/kit';
import { clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ platform, cookies }) {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		try {
			const db = getDb(platform);
			await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
		} catch {
			// Cookie still gets cleared below.
		}
	}
	clearSessionCookie(cookies);
	return json({ ok: true });
}
