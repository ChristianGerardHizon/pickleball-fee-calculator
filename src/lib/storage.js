/**
 * @typedef {{ fee: number, payer: string, name: string }} Court
 * @typedef {{ name: string, amount: number, payer: string }} AdditionalFee
 * @typedef {{ name: string, paid: boolean, fixedAmount: number | null, courtAmounts: (number | null)[] }} Participant
 * @typedef {{ courts: Court[], additionalFees?: AdditionalFee[], participants: Participant[], createdAt: string }} EventRecord
 * @typedef {{ masterList: string[], events: Record<string, EventRecord> }} AppData
 */

/** @returns {AppData} */
export function emptyData() {
	return { masterList: [], events: {} };
}

/**
 * @param {unknown} court
 * @returns {Court}
 */
function normalizeCourt(court) {
	if (!court || typeof court !== 'object') return { fee: 0, payer: '', name: '' };
	const value = /** @type {Record<string, unknown>} */ (court);
	return {
		fee: Number(value.fee) || 0,
		payer: typeof value.payer === 'string' ? value.payer : '',
		name: typeof value.name === 'string' ? value.name : ''
	};
}

/**
 * @param {unknown} fee
 * @returns {AdditionalFee}
 */
function normalizeAdditionalFee(fee) {
	if (!fee || typeof fee !== 'object') return { name: '', amount: 0, payer: '' };
	const value = /** @type {Record<string, unknown>} */ (fee);
	return {
		name: typeof value.name === 'string' ? value.name : '',
		amount: Number(value.amount) || 0,
		payer: typeof value.payer === 'string' ? value.payer : ''
	};
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeFixedAmount(value) {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * @param {unknown} value
 * @param {number} courtCount
 * @returns {(number | null)[]}
 */
function normalizeCourtAmounts(value, courtCount) {
	const raw = Array.isArray(value) ? value : [];
	/** @type {(number | null)[]} */
	const out = [];
	for (let i = 0; i < courtCount; i++) {
		const item = raw[i];
		if (item === null || item === undefined || item === '') {
			out.push(null);
			continue;
		}
		const n = Number(item);
		out.push(Number.isFinite(n) && n >= 0 ? n : null);
	}
	return out;
}

/**
 * @param {unknown} event
 * @returns {EventRecord}
 */
function normalizeEvent(event) {
	if (!event || typeof event !== 'object') {
		return { courts: [], participants: [], createdAt: new Date().toISOString() };
	}
	const value = /** @type {Record<string, unknown>} */ (event);
	const courts = Array.isArray(value.courts) ? value.courts.map(normalizeCourt) : [];
	return {
		courts,
		additionalFees: Array.isArray(value.additionalFees)
			? value.additionalFees.map(normalizeAdditionalFee)
			: undefined,
		participants: Array.isArray(value.participants)
			? value.participants
					.filter((p) => p && typeof p === 'object')
					.map((p) => {
						const part = /** @type {Record<string, unknown>} */ (p);
						return {
							name: typeof part.name === 'string' ? part.name : '',
							paid: Boolean(part.paid),
							fixedAmount: normalizeFixedAmount(part.fixedAmount),
							courtAmounts: normalizeCourtAmounts(part.courtAmounts, courts.length)
						};
					})
			: [],
		createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
	};
}

/**
 * @param {unknown} parsed
 * @returns {AppData}
 */
export function normalizeAppData(parsed) {
	if (!parsed || typeof parsed !== 'object') return emptyData();
	const value = /** @type {Record<string, unknown>} */ (parsed);
	/** @type {Record<string, EventRecord>} */
	const events = {};
	if (value.events && typeof value.events === 'object' && !Array.isArray(value.events)) {
		for (const [date, event] of Object.entries(value.events)) {
			events[date] = normalizeEvent(event);
		}
	}
	return {
		masterList: Array.isArray(value.masterList)
			? value.masterList.filter((n) => typeof n === 'string')
			: [],
		events
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
