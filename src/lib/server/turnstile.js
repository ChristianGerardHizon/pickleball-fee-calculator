import { env } from '$env/dynamic/private';

/**
 * @param {App.Platform | undefined} platform
 * @returns {string}
 */
function getTurnstileSecret(platform) {
	return platform?.env?.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY || '';
}

/**
 * @param {App.Platform | undefined} platform
 * @param {string} token
 * @param {string | null} [remoteip]
 */
export async function verifyTurnstileToken(platform, token, remoteip) {
	if (typeof token !== 'string' || token.trim().length === 0) {
		return false;
	}

	const secret = getTurnstileSecret(platform);
	if (!secret) return false;

	const body = new URLSearchParams();
	body.set('secret', secret);
	body.set('response', token.trim());
	if (remoteip) body.set('remoteip', remoteip);

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) return false;

	const data = await res.json().catch(() => null);
	return Boolean(data && data.success === true);
}
