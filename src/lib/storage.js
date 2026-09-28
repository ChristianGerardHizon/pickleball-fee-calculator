/**
 * @typedef {{ fee: number, payer: string }} Court
 * @typedef {{ name: string, paid: boolean }} Participant
 * @typedef {{ courts: Court[], participants: Participant[], createdAt: string }} EventRecord
 * @typedef {{ masterList: string[], events: Record<string, EventRecord> }} AppData
 */

/** @returns {AppData} */
export function emptyData() {
	return { masterList: [], events: {} };
}

/**
 * @param {unknown} parsed
 * @returns {AppData}
 */
export function normalizeAppData(parsed) {
	if (!parsed || typeof parsed !== 'object') return emptyData();
	const value = /** @type {Record<string, unknown>} */ (parsed);
	return {
		masterList: Array.isArray(value.masterList)
			? value.masterList.filter((n) => typeof n === 'string')
			: [],
		events: value.events && typeof value.events === 'object' && !Array.isArray(value.events)
			? /** @type {Record<string, EventRecord>} */ (value.events)
			: {}
	};
}

/** @returns {Promise<AppData>} */
export async function loadData() {
	const res = await fetch('/api/data');
	if (res.status === 401) return emptyData();
	if (!res.ok) {
		throw new Error('Failed to load data');
	}
	return normalizeAppData(await res.json());
}

/** @param {AppData} data */
export async function saveData(data) {
	const res = await fetch('/api/data', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) {
		throw new Error('Failed to save data');
	}
}
