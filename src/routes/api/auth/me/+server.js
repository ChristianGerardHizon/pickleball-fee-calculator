import { json } from '@sveltejs/kit';
import { touchSession } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, platform, cookies, url }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}
	await touchSession(platform, cookies, url.protocol === 'https:');
	return json({ user: locals.user });
}
