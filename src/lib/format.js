/** @param {string} str */
export function titleCase(str) {
	return str
		.trim()
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

/** @param {string} text */
export function parseNames(text) {
	return text
		.split('\n')
		.map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
		.filter(Boolean)
		.map(titleCase);
}

/** @param {number|string} amount */
export function formatCurrency(amount) {
	const n = Number(amount) || 0;
	return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param {string} email
 * @param {string | null | undefined} displayName
 */
export function formatAccountName(email, displayName) {
	const name = (displayName || '').trim();
	if (name) return name;
	const local = email.split('@')[0] || email;
	return local;
}

/** @param {string} dateStr */
export function formatDateLabel(dateStr) {
	const d = new Date(dateStr + 'T00:00:00');
	return d.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
