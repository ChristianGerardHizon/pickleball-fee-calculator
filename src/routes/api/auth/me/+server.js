import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Not signed in' }, { status: 401 });
	}
	return json({ user: locals.user });
}
