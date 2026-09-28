/**
 * @param {App.Platform | undefined} platform
 * @returns {D1Database}
 */
export function getDb(platform) {
	const db = platform?.env?.DB;
	if (!db) {
		throw new Error('D1 binding DB is not available');
	}
	return db;
}

export const EMPTY_PAYLOAD = JSON.stringify({ masterList: [], events: {} });
