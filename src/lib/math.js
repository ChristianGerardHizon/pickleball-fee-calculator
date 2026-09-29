/**
 * @typedef {import('./storage.js').EventRecord} EventRecord
 * @typedef {import('./storage.js').AdditionalFee} AdditionalFee
 * @typedef {import('./storage.js').Court} Court
 * @typedef {import('./storage.js').Participant} Participant
 * @typedef {{ label: string, payer: string, amount: number }} PayToRow
 * @typedef {{ mode: 'each' | 'total', rows: PayToRow[] }} PayToInstructions
 * @typedef {{ name: string, owed: number, paid: boolean, isFixed: boolean }} ParticipantAmount
 * @typedef {{ courtIndex: number, courtName: string, fee: number, payer: string, amount: number, isCustom: boolean }} PersonCourtLine
 * @typedef {{ name: string, amount: number, payer: string, share: number }} PersonExtraLine
 * @typedef {{ name: string, paid: boolean, isFixed: boolean, owed: number, courtLines: PersonCourtLine[], extras: PersonExtraLine[], extraShare: number, multiPayTo: boolean }} PersonBreakdown
 */

export const ME_PAYER = 'Me';

/**
 * Display label for a pay-to destination. Blank bookers resolve to "Me";
 * pass `meLabel` (usually the account display name) to show that instead.
 *
 * @param {string} payer
 * @param {string} [meLabel]
 */
export function payToDisplayName(payer, meLabel = ME_PAYER) {
	if (payer !== ME_PAYER) return payer;
	const name = (meLabel || '').trim();
	return name || ME_PAYER;
}

/** @param {EventRecord} event */
export function getAdditionalFees(event) {
	return Array.isArray(event.additionalFees) ? event.additionalFees : [];
}

/**
 * Unique Pay-to destinations with a positive fee (courts + extras).
 * @param {EventRecord} event
 * @returns {number}
 */
export function getPayToDestinationCount(event) {
	/** @type {Map<string, number>} */
	const byPayer = new Map();
	/**
	 * @param {string} payer
	 * @param {number} fee
	 */
	function add(payer, fee) {
		const key = payer || ME_PAYER;
		byPayer.set(key, (byPayer.get(key) || 0) + fee);
	}
	event.courts.forEach((c) => add((c.payer || '').trim(), Number(c.fee) || 0));
	getAdditionalFees(event).forEach((fee) =>
		add((fee.payer || '').trim(), Number(fee.amount) || 0)
	);
	return Array.from(byPayer.values()).filter((amount) => amount > 0.004).length;
}

/** @param {EventRecord} event */
export function isMultiPayTo(event) {
	return getPayToDestinationCount(event) >= 2;
}

/**
 * @param {Participant} person
 * @returns {boolean}
 */
export function hasSingleFixedAmount(person) {
	return typeof person.fixedAmount === 'number' && Number.isFinite(person.fixedAmount);
}

/**
 * @param {Participant} person
 * @param {number} courtCount
 * @returns {boolean}
 */
export function hasCourtCustomAmounts(person, courtCount) {
	const amounts = Array.isArray(person.courtAmounts) ? person.courtAmounts : [];
	for (let i = 0; i < courtCount; i++) {
		const v = amounts[i];
		if (typeof v === 'number' && Number.isFinite(v)) return true;
	}
	return false;
}

/**
 * Keep courtAmounts length in sync with courts.
 * @param {Participant} person
 * @param {number} courtCount
 */
export function ensureCourtAmountsLength(person, courtCount) {
	if (!Array.isArray(person.courtAmounts)) person.courtAmounts = [];
	while (person.courtAmounts.length < courtCount) person.courtAmounts.push(null);
	if (person.courtAmounts.length > courtCount) {
		person.courtAmounts.length = courtCount;
	}
}

/**
 * Settlement destinations for the fee pool.
 * Lines with a "Pay to" booker go to that person; blank payers go to "Me".
 * - Equal split: amount is each participant's share of that destination's fees.
 * - Any custom amounts: amount is the full total owed to that destination.
 *
 * @param {EventRecord} event
 * @param {boolean} hasFixedAmounts
 * @returns {PayToInstructions | null}
 */
export function getPayToInstructions(event, hasFixedAmounts) {
	const count = event.participants.length;
	/** @type {Map<string, number>} */
	const byPayer = new Map();

	/**
	 * @param {string} payer
	 * @param {number} fee
	 */
	function add(payer, fee) {
		const key = payer || ME_PAYER;
		byPayer.set(key, (byPayer.get(key) || 0) + fee);
	}

	event.courts.forEach((c) => {
		add((c.payer || '').trim(), Number(c.fee) || 0);
	});
	getAdditionalFees(event).forEach((fee) => {
		add((fee.payer || '').trim(), Number(fee.amount) || 0);
	});

	const entries = Array.from(byPayer.entries()).filter(([, amount]) => amount > 0.004);
	if (entries.length === 0) return null;

	entries.sort((a, b) => {
		if (a[0] === ME_PAYER) return 1;
		if (b[0] === ME_PAYER) return -1;
		return a[0].localeCompare(b[0]);
	});

	if (hasFixedAmounts) {
		return {
			mode: 'total',
			rows: entries.map(([payer, amount]) => ({
				payer,
				label: payer,
				amount
			}))
		};
	}

	return {
		mode: 'each',
		rows: entries.map(([payer, amount]) => ({
			payer,
			label: payer,
			amount: count > 0 ? amount / count : 0
		}))
	};
}

/**
 * Per-court equal shares after applying customs for a multi-pay-to event.
 * @param {EventRecord} event
 * @returns {{ equalShares: number[], fixedMismatch: boolean }}
 */
function computeMultiCourtShares(event) {
	const courtCount = event.courts.length;
	/** @type {number[]} */
	const equalShares = [];
	let fixedMismatch = false;

	for (let i = 0; i < courtCount; i++) {
		const fee = Number(event.courts[i].fee) || 0;
		let customSum = 0;
		let customCount = 0;
		for (const p of event.participants) {
			const amounts = Array.isArray(p.courtAmounts) ? p.courtAmounts : [];
			const v = amounts[i];
			if (typeof v === 'number' && Number.isFinite(v)) {
				customSum += v;
				customCount += 1;
			}
		}
		const equalCount = event.participants.length - customCount;
		const leftover = Math.max(0, fee - customSum);
		const equalShare = equalCount > 0 ? leftover / equalCount : 0;
		equalShares.push(equalShare);
		if (customCount > 0) {
			if (customSum > fee + 0.004) fixedMismatch = true;
			if (equalCount === 0 && Math.abs(customSum - fee) > 0.004) fixedMismatch = true;
		}
	}

	return { equalShares, fixedMismatch };
}

/** @param {EventRecord} event */
export function getEventTotals(event) {
	const courtTotal = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
	const extraTotal = getAdditionalFees(event).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
	const totalFee = courtTotal + extraTotal;
	const count = event.participants.length;
	const courtCount = event.courts.length;
	const multi = isMultiPayTo(event);
	const extraShare = count > 0 ? extraTotal / count : 0;

	let fixedMismatch = false;
	let fixedTotal = 0;
	/** @type {ParticipantAmount[]} */
	let participantAmounts;

	if (multi) {
		const { equalShares, fixedMismatch: mismatch } = computeMultiCourtShares(event);
		fixedMismatch = mismatch;

		participantAmounts = event.participants.map((p) => {
			const amounts = Array.isArray(p.courtAmounts) ? p.courtAmounts : [];
			let owed = extraShare;
			let isFixed = false;
			let customSum = 0;
			for (let i = 0; i < courtCount; i++) {
				const v = amounts[i];
				if (typeof v === 'number' && Number.isFinite(v)) {
					owed += v;
					customSum += v;
					isFixed = true;
				} else {
					owed += equalShares[i] || 0;
				}
			}
			if (isFixed) fixedTotal += customSum;
			return {
				name: p.name,
				owed,
				paid: Boolean(p.paid),
				isFixed
			};
		});
	} else {
		const fixedPeople = event.participants.filter(hasSingleFixedAmount);
		const equalPeople = event.participants.filter((p) => !hasSingleFixedAmount(p));
		fixedTotal = fixedPeople.reduce(
			(sum, p) => sum + /** @type {number} */ (p.fixedAmount),
			0
		);
		const equalCount = equalPeople.length;
		const leftover = Math.max(0, totalFee - fixedTotal);
		const standardShare = equalCount > 0 ? leftover / equalCount : 0;
		const hasFixed = fixedPeople.length > 0;
		fixedMismatch =
			hasFixed &&
			(fixedTotal > totalFee + 0.004 ||
				(equalCount === 0 && Math.abs(fixedTotal - totalFee) > 0.004));

		participantAmounts = event.participants.map((p) => {
			const isFixed = hasSingleFixedAmount(p);
			return {
				name: p.name,
				owed: isFixed ? /** @type {number} */ (p.fixedAmount) : standardShare,
				paid: Boolean(p.paid),
				isFixed
			};
		});
	}

	const hasFixedAmounts = participantAmounts.some((p) => p.isFixed);
	const fixedCount = participantAmounts.filter((p) => p.isFixed).length;
	const standardPerson = participantAmounts.find((p) => !p.isFixed);
	const standardShare = standardPerson
		? standardPerson.owed
		: count > 0
			? totalFee / count
			: 0;

	const paidCount = event.participants.filter((p) => p.paid).length;
	const collected = participantAmounts
		.filter((p) => p.paid)
		.reduce((sum, p) => sum + p.owed, 0);
	const remaining = Math.max(0, totalFee - collected);
	const payTo = getPayToInstructions(event, hasFixedAmounts);

	return {
		courtTotal,
		extraTotal,
		totalFee,
		count,
		perPerson: standardShare,
		paidCount,
		collected,
		remaining,
		payTo,
		fixedTotal,
		hasFixedAmounts,
		fixedCount,
		fixedMismatch,
		multiPayTo: multi,
		participantAmounts
	};
}

/**
 * Breakdown for one participant (for detail panel + person share).
 * @param {EventRecord} event
 * @param {number} participantIndex
 * @returns {PersonBreakdown | null}
 */
export function getPersonBreakdown(event, participantIndex) {
	const person = event.participants[participantIndex];
	if (!person) return null;

	const count = event.participants.length;
	const multi = isMultiPayTo(event);
	const extrasList = getAdditionalFees(event);
	const extraTotal = extrasList.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
	const extraShare = count > 0 ? extraTotal / count : 0;

	/** @type {PersonExtraLine[]} */
	const extras = extrasList.map((fee) => ({
		name: fee.name?.trim() || 'Extra',
		amount: Number(fee.amount) || 0,
		payer: (fee.payer || '').trim() || ME_PAYER,
		share: count > 0 ? (Number(fee.amount) || 0) / count : 0
	}));

	if (!multi) {
		const totals = getEventTotals(event);
		const row = totals.participantAmounts[participantIndex];
		return {
			name: person.name,
			paid: Boolean(person.paid),
			isFixed: Boolean(row?.isFixed),
			owed: row?.owed ?? 0,
			courtLines: [],
			extras,
			extraShare,
			multiPayTo: false
		};
	}

	const { equalShares } = computeMultiCourtShares(event);
	const amounts = Array.isArray(person.courtAmounts) ? person.courtAmounts : [];
	/** @type {PersonCourtLine[]} */
	const courtLines = event.courts.map((court, i) => {
		const fee = Number(court.fee) || 0;
		const v = amounts[i];
		const isCustom = typeof v === 'number' && Number.isFinite(v);
		return {
			courtIndex: i,
			courtName: court.name?.trim() || `Court ${i + 1}`,
			fee,
			payer: (court.payer || '').trim() || ME_PAYER,
			amount: isCustom ? /** @type {number} */ (v) : equalShares[i] || 0,
			isCustom
		};
	});

	const isFixed = courtLines.some((line) => line.isCustom);
	const owed = courtLines.reduce((sum, line) => sum + line.amount, 0) + extraShare;

	return {
		name: person.name,
		paid: Boolean(person.paid),
		isFixed,
		owed,
		courtLines,
		extras,
		extraShare,
		multiPayTo: true
	};
}
