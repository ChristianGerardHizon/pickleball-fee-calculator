/**
 * @typedef {import('./storage.js').EventRecord} EventRecord
 * @typedef {{ payer: string, feeSum: number, collected: number, remaining: number }} PayerRow
 */

/**
 * Only surfaced when 2+ distinct payer names are set across courts — leaving
 * every court's "Paid by" blank (or all the same name) keeps the app in its
 * original single-owner behavior with no reimbursement breakdown shown.
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
	const totalFee = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
	const count = event.participants.length;
	const perPerson = count > 0 ? totalFee / count : 0;
	const paidCount = event.participants.filter((p) => p.paid).length;
	const collected = paidCount * perPerson;
	const remaining = totalFee - collected;
	const payerRows = getPayerBreakdown(event, totalFee, collected);

	return { totalFee, count, perPerson, paidCount, collected, remaining, payerRows };
}
