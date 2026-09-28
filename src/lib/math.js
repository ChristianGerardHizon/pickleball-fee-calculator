/**
 * @typedef {import('./storage.js').EventRecord} EventRecord
 * @typedef {import('./storage.js').AdditionalFee} AdditionalFee
 * @typedef {import('./storage.js').Participant} Participant
 * @typedef {{ payer: string, feeSum: number, collected: number, remaining: number }} PayerRow
 * @typedef {{ name: string, owed: number, paid: boolean, isFixed: boolean }} ParticipantAmount
 */

/** @param {EventRecord} event */
export function getAdditionalFees(event) {
	return Array.isArray(event.additionalFees) ? event.additionalFees : [];
}

/** @param {Participant} person */
export function isFixedAmount(person) {
	return typeof person.fixedAmount === 'number' && Number.isFinite(person.fixedAmount);
}

/**
 * Only surfaced when 2+ distinct payer names are set across courts and extra
 * fees — leaving every "Paid by" blank (or all the same name) keeps the app
 * in its original single-owner behavior with no reimbursement breakdown shown.
 * Money already collected from paid participants is attributed to each
 * payer proportionally to the share of the total fee they fronted.
 *
 * @param {EventRecord} event
 * @param {number} totalFee
 * @param {number} totalCollected
 * @returns {PayerRow[] | null}
 */
export function getPayerBreakdown(event, totalFee, totalCollected) {
	/** @type {Map<string, number>} */
	const payerTotals = new Map();
	event.courts.forEach((c) => {
		const payer = (c.payer || '').trim();
		if (!payer) return;
		const fee = Number(c.fee) || 0;
		payerTotals.set(payer, (payerTotals.get(payer) || 0) + fee);
	});
	getAdditionalFees(event).forEach((fee) => {
		const payer = (fee.payer || '').trim();
		if (!payer) return;
		const amount = Number(fee.amount) || 0;
		payerTotals.set(payer, (payerTotals.get(payer) || 0) + amount);
	});

	if (payerTotals.size < 2) return null;

	const assignedTotal = Array.from(payerTotals.values()).reduce((a, b) => a + b, 0);
	const unassigned = totalFee - assignedTotal;

	const rows = Array.from(payerTotals.entries()).map(([payer, feeSum]) => {
		const share = totalFee > 0 ? feeSum / totalFee : 0;
		const collected = totalCollected * share;
		return { payer, feeSum, collected, remaining: feeSum - collected };
	});

	if (unassigned > 0.004) {
		const share = totalFee > 0 ? unassigned / totalFee : 0;
		const collected = totalCollected * share;
		rows.push({
			payer: 'Unassigned',
			feeSum: unassigned,
			collected,
			remaining: unassigned - collected
		});
	}

	return rows;
}

/** @param {EventRecord} event */
export function getEventTotals(event) {
	const courtTotal = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
	const extraTotal = getAdditionalFees(event).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
	const totalFee = courtTotal + extraTotal;
	const count = event.participants.length;

	const fixedPeople = event.participants.filter(isFixedAmount);
	const equalPeople = event.participants.filter((p) => !isFixedAmount(p));
	const fixedTotal = fixedPeople.reduce((sum, p) => sum + /** @type {number} */ (p.fixedAmount), 0);
	const equalCount = equalPeople.length;
	const hasFixedAmounts = fixedPeople.length > 0;
	const leftover = Math.max(0, totalFee - fixedTotal);
	const standardShare = equalCount > 0 ? leftover / equalCount : 0;

	/** @type {ParticipantAmount[]} */
	const participantAmounts = event.participants.map((p) => {
		const isFixed = isFixedAmount(p);
		return {
			name: p.name,
			owed: isFixed ? /** @type {number} */ (p.fixedAmount) : standardShare,
			paid: Boolean(p.paid),
			isFixed
		};
	});

	const paidCount = event.participants.filter((p) => p.paid).length;
	const collected = participantAmounts
		.filter((p) => p.paid)
		.reduce((sum, p) => sum + p.owed, 0);
	// Cap at the fee pool so over-fixed paid amounts don't show a negative remainder.
	const remaining = Math.max(0, totalFee - collected);
	const payerRows = getPayerBreakdown(event, totalFee, collected);

	const fixedMismatch =
		hasFixedAmounts &&
		(fixedTotal > totalFee + 0.004 ||
			(equalCount === 0 && Math.abs(fixedTotal - totalFee) > 0.004));

	return {
		courtTotal,
		extraTotal,
		totalFee,
		count,
		perPerson: standardShare,
		paidCount,
		collected,
		remaining,
		payerRows,
		fixedTotal,
		hasFixedAmounts,
		fixedCount: fixedPeople.length,
		fixedMismatch,
		participantAmounts
	};
}
