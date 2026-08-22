import { env } from '$env/dynamic/public';

const DUMMY_INVISIBLE_SITE_KEY = '1x00000000000000000000BB';

/**
 * @typedef {{
 *   render: (el: HTMLElement, opts: Record<string, unknown>) => string,
 *   execute: (id: string) => void,
 *   reset: (id: string) => void,
 *   remove: (id: string) => void
 * }} TurnstileApi
 */

/** @returns {TurnstileApi | undefined} */
function turnstileApi() {
	return /** @type {{ turnstile?: TurnstileApi }} */ (window).turnstile;
}

/** @returns {string} */
export function getTurnstileSiteKey() {
	return env.PUBLIC_TURNSTILE_SITE_KEY || DUMMY_INVISIBLE_SITE_KEY;
}

/** @returns {Promise<TurnstileApi>} */
async function loadTurnstile() {
	const existing = turnstileApi();
	if (existing) return existing;
	await new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.onload = () => resolve(undefined);
		script.onerror = () => reject(new Error('Could not load bot check.'));
		document.head.appendChild(script);
	});
	const loaded = turnstileApi();
	if (!loaded) throw new Error('Could not load bot check.');
	return loaded;
}

/**
 * @param {HTMLElement} host
 */
export function createInvisibleTurnstile(host) {
	/** @type {string | null} */
	let widgetId = null;
	/** @type {((token: string) => void) | null} */
	let resolveToken = null;
	/** @type {((err: Error) => void) | null} */
	let rejectToken = null;

	async function ensureRendered() {
		const turnstile = await loadTurnstile();
		if (widgetId) return turnstile;
		widgetId = turnstile.render(host, {
			sitekey: getTurnstileSiteKey(),
			size: 'invisible',
			execution: 'execute',
			callback: (/** @type {string} */ token) => {
				resolveToken?.(token);
				resolveToken = null;
				rejectToken = null;
			},
			'error-callback': () => {
				rejectToken?.(new Error('Bot check failed. Please try again.'));
				resolveToken = null;
				rejectToken = null;
			},
			'expired-callback': () => {
				rejectToken?.(new Error('Bot check expired. Please try again.'));
				resolveToken = null;
				rejectToken = null;
			}
		});
		return turnstile;
	}

	return {
		async execute() {
			const turnstile = await ensureRendered();
			if (!widgetId) throw new Error('Bot check failed. Please try again.');
			return new Promise((resolve, reject) => {
				const id = widgetId;
				if (!id) {
					reject(new Error('Bot check failed. Please try again.'));
					return;
				}
				resolveToken = resolve;
				rejectToken = reject;
				turnstile.execute(id);
			});
		},
		async reset() {
			if (!widgetId) return;
			const turnstile = await loadTurnstile();
			turnstile.reset(widgetId);
		}
	};
}
