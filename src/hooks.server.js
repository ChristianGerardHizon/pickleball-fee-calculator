import { getUserFromCookies } from '$lib/server/auth.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	event.locals.user = await getUserFromCookies(event.platform, event.cookies);
	return resolve(event);
}
