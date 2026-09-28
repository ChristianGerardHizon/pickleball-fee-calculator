import { formatCurrency, formatDateLabel, titleCase } from './format.js';
import { getAdditionalFees, getEventTotals, getPayerBreakdown } from './math.js';

/**
 * @typedef {import('./storage.js').EventRecord} EventRecord
 */

const SHARE_FONT = '"Plus Jakarta Sans", Arial, sans-serif';
const shareFont = (/** @type {number} */ weight, /** @type {number} */ size) =>
	`${weight} ${size}px ${SHARE_FONT}`;
const MONEY_FONT = 'Arial, sans-serif';
const moneyFont = (/** @type {number} */ weight, /** @type {number} */ size) =>
	`${weight >= 700 ? 'bold' : 'normal'} ${size}px ${MONEY_FONT}`;

const SHARE_COLORS = {
	bg: '#f8fafc',
	surface: '#ffffff',
	emerald700: '#047857',
	emerald800: '#065f46',
	emerald50: '#ecfdf5',
	emerald100: '#d1fae5',
	ink900: '#0f172a',
	ink600: '#475569',
	ink500: '#64748b',
	ink200: '#e2e8f0'
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {string} color
 */
function drawPaddleIcon(ctx, x, y, size, color) {
	const scale = size / 24;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	ctx.fillStyle = color;
	roundRect(ctx, 6, 2, 12, 14, 6);
	ctx.fill();
	roundRect(ctx, 10.3, 14.5, 3.4, 7.5, 1.6);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(19, 19, 2.2, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[]} labels
 * @param {number} maxWidth
 * @param {number} chipH
 * @param {number} gapX
 * @param {number} gapY
 * @param {number} padX
 * @param {string} font
 */
function layoutChips(ctx, labels, maxWidth, chipH, gapX, gapY, padX, font) {
	ctx.font = font;
	let x = 0;
	let y = 0;
	/** @type {{ x: number, y: number, w: number, label: string }[]} */
	const positions = [];
	labels.forEach((label) => {
		const w = ctx.measureText(label).width + padX * 2;
		if (x > 0 && x + w > maxWidth) {
			x = 0;
			y += chipH + gapY;
		}
		positions.push({ x, y, w, label });
		x += w + gapX;
	});
	return { positions, totalHeight: labels.length ? y + chipH : 0 };
}

/**
 * Shrinks the money font until `text` fits within `maxWidth`, so the hero
 * amount stays legible instead of overflowing the card on large totals.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} startSize
 * @param {number} minSize
 * @returns {number}
 */
function fitMoneySize(ctx, text, maxWidth, startSize, minSize) {
	let size = startSize;
	while (size > minSize) {
		ctx.font = moneyFont(800, size);
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 2;
	}
	return size;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ event: EventRecord, date: string }} opts
 * @returns {string}
 */
export function generateShareImage(canvas, { event, date }) {
	const { totalFee, count, perPerson, courtTotal, extraTotal, hasFixedAmounts, participantAmounts } =
		getEventTotals(event);
	const extras = getAdditionalFees(event);
	const names = participantAmounts.map((p) => {
		const label = titleCase(p.name);
		return p.isFixed ? `${label} · ${formatCurrency(p.owed)}` : label;
	});
	const payerRows = getPayerBreakdown(event, totalFee, 0);

	// Narrower, denser canvas tuned for reading on a phone screen (chat
	// previews, quick screenshots) rather than a desktop-sized poster.
	const W = 620;
	const PAD = 20;
	const CW = W - PAD * 2;
	const CP = 16;
	const INNER_W = CW - CP * 2;
	const GAP = 12;

	canvas.width = W;
	canvas.height = 200;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	const HEADER_H = 54;
	const HIGHLIGHT_H = 156;
	const courtRowH = 24;
	const lineCardH = (/** @type {number} */ rows) =>
		CP + 18 + 12 + (rows > 0 ? rows * courtRowH : courtRowH) + 12 + 22 + CP;
	const courtsCardH = lineCardH(event.courts.length);
	const extrasCardH = extras.length > 0 ? lineCardH(extras.length) : 0;
	const payerRowH = 24;
	const payerCardH = payerRows ? CP + 18 + 12 + payerRows.length * payerRowH + CP : 0;

	const chips = layoutChips(
		ctx,
		names.length ? names : ['No participants yet'],
		INNER_W,
		27,
		7,
		7,
		11,
		shareFont(600, 12.5)
	);
	const participantsCardH = CP + 18 + 12 + chips.totalHeight + CP;

	const totalHeight =
		HEADER_H +
		GAP +
		HIGHLIGHT_H +
		GAP +
		courtsCardH +
		GAP +
		(extras.length > 0 ? extrasCardH + GAP : 0) +
		(payerRows ? payerCardH + GAP : 0) +
		participantsCardH +
		GAP +
		22;

	canvas.width = W;
	canvas.height = totalHeight;

	ctx.fillStyle = SHARE_COLORS.bg;
	ctx.fillRect(0, 0, W, totalHeight);

	// Compact single-line header: badge, title, date all on one row.
	ctx.fillStyle = SHARE_COLORS.emerald700;
	ctx.fillRect(0, 0, W, HEADER_H);
	const badgeSize = 32;
	const badgeY = (HEADER_H - badgeSize) / 2;
	ctx.fillStyle = 'rgba(255,255,255,0.16)';
	roundRect(ctx, PAD, badgeY, badgeSize, badgeSize, 10);
	ctx.fill();
	drawPaddleIcon(ctx, PAD + (badgeSize - 18) / 2, badgeY + (badgeSize - 18) / 2, 18, '#ffffff');

	ctx.textAlign = 'left';
	ctx.fillStyle = '#ffffff';
	ctx.font = shareFont(800, 16);
	ctx.fillText('Pickleball Court Fees', PAD + badgeSize + 12, HEADER_H / 2 + 5);

	ctx.textAlign = 'right';
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = shareFont(600, 12);
	ctx.fillText(formatDateLabel(date), PAD + CW, HEADER_H / 2 + 4);
	ctx.textAlign = 'left';

	// Hero card: the amount each person owes is the whole point of the
	// image, so it gets the biggest, boldest, most central treatment.
	let y = HEADER_H + GAP;
	ctx.fillStyle = SHARE_COLORS.emerald700;
	roundRect(ctx, PAD, y, CW, HIGHLIGHT_H, 18);
	ctx.fill();

	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.8)';
	ctx.font = shareFont(700, 13);
	ctx.fillText(hasFixedAmounts ? 'STANDARD SHARE' : 'AMOUNT PER PERSON', W / 2, y + 30);

	const amountText = formatCurrency(perPerson);
	const amountMaxWidth = CW - CP * 2;
	const amountSize = fitMoneySize(ctx, amountText, amountMaxWidth, 68, 36);
	ctx.font = moneyFont(800, amountSize);
	ctx.fillStyle = '#ffffff';
	ctx.fillText(amountText, W / 2, y + 92);

	ctx.strokeStyle = 'rgba(255,255,255,0.25)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(PAD + CP, y + 116);
	ctx.lineTo(PAD + CW - CP, y + 116);
	ctx.stroke();

	const halfX1 = PAD + CW / 4;
	const halfX2 = PAD + (CW * 3) / 4;
	ctx.fillStyle = 'rgba(255,255,255,0.7)';
	ctx.font = shareFont(600, 11);
	ctx.fillText('TOTAL POOL', halfX1, y + 136);
	ctx.fillText('PARTICIPANTS', halfX2, y + 136);
	ctx.fillStyle = '#ffffff';
	ctx.font = shareFont(700, 15);
	ctx.fillText(formatCurrency(totalFee), halfX1, y + 152);
	ctx.fillText(String(count), halfX2, y + 152);
	ctx.textAlign = 'left';

	y += HIGHLIGHT_H + GAP;
	ctx.fillStyle = SHARE_COLORS.surface;
	roundRect(ctx, PAD, y, CW, courtsCardH, 14);
	ctx.fill();
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1.5;
	roundRect(ctx, PAD, y, CW, courtsCardH, 14);
	ctx.stroke();

	let cy = y + CP + 4;
	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 14);
	ctx.fillText('Court Fees', PAD + CP, cy);
	cy += 24;

	if (event.courts.length === 0) {
		ctx.fillStyle = SHARE_COLORS.ink500;
		ctx.font = shareFont(500, 13);
		ctx.fillText('No courts added', PAD + CP, cy);
		cy += courtRowH;
	} else {
		event.courts.forEach((c, idx) => {
			ctx.fillStyle = SHARE_COLORS.ink600;
			ctx.font = shareFont(500, 13);
			ctx.textAlign = 'left';
			ctx.fillText(c.name?.trim() || `Court ${idx + 1}`, PAD + CP, cy);
			ctx.fillStyle = SHARE_COLORS.ink900;
			ctx.font = moneyFont(700, 13);
			ctx.textAlign = 'right';
			ctx.fillText(formatCurrency(c.fee), PAD + CW - CP, cy);
			ctx.textAlign = 'left';
			cy += courtRowH;
		});
	}

	cy += 2;
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(PAD + CP, cy);
	ctx.lineTo(PAD + CW - CP, cy);
	ctx.stroke();
	cy += 20;

	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 14);
	ctx.textAlign = 'left';
	ctx.fillText('Total', PAD + CP, cy);
	ctx.fillStyle = SHARE_COLORS.emerald700;
	ctx.font = moneyFont(700, 15);
	ctx.textAlign = 'right';
	ctx.fillText(formatCurrency(courtTotal), PAD + CW - CP, cy);
	ctx.textAlign = 'left';

	y += courtsCardH + GAP;
	if (extras.length > 0) {
		ctx.fillStyle = SHARE_COLORS.surface;
		roundRect(ctx, PAD, y, CW, extrasCardH, 14);
		ctx.fill();
		ctx.strokeStyle = SHARE_COLORS.ink200;
		ctx.lineWidth = 1.5;
		roundRect(ctx, PAD, y, CW, extrasCardH, 14);
		ctx.stroke();

		let ey = y + CP + 4;
		ctx.fillStyle = SHARE_COLORS.ink900;
		ctx.font = shareFont(700, 14);
		ctx.fillText('Additional Fees', PAD + CP, ey);
		ey += 24;

		extras.forEach((f, idx) => {
			ctx.fillStyle = SHARE_COLORS.ink600;
			ctx.font = shareFont(500, 13);
			ctx.textAlign = 'left';
			ctx.fillText(f.name?.trim() || `Extra ${idx + 1}`, PAD + CP, ey);
			ctx.fillStyle = SHARE_COLORS.ink900;
			ctx.font = moneyFont(700, 13);
			ctx.textAlign = 'right';
			ctx.fillText(formatCurrency(f.amount), PAD + CW - CP, ey);
			ctx.textAlign = 'left';
			ey += courtRowH;
		});

		ey += 2;
		ctx.strokeStyle = SHARE_COLORS.ink200;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(PAD + CP, ey);
		ctx.lineTo(PAD + CW - CP, ey);
		ctx.stroke();
		ey += 20;

		ctx.fillStyle = SHARE_COLORS.ink900;
		ctx.font = shareFont(700, 14);
		ctx.textAlign = 'left';
		ctx.fillText('Total', PAD + CP, ey);
		ctx.fillStyle = SHARE_COLORS.emerald700;
		ctx.font = moneyFont(700, 15);
		ctx.textAlign = 'right';
		ctx.fillText(formatCurrency(extraTotal), PAD + CW - CP, ey);
		ctx.textAlign = 'left';

		y += extrasCardH + GAP;
	}
	if (payerRows) {
		ctx.fillStyle = SHARE_COLORS.surface;
		roundRect(ctx, PAD, y, CW, payerCardH, 14);
		ctx.fill();
		ctx.strokeStyle = SHARE_COLORS.ink200;
		ctx.lineWidth = 1.5;
		roundRect(ctx, PAD, y, CW, payerCardH, 14);
		ctx.stroke();

		let py = y + CP + 4;
		ctx.fillStyle = SHARE_COLORS.ink900;
		ctx.font = shareFont(700, 14);
		ctx.fillText('Paid By', PAD + CP, py);
		py += 24;

		payerRows.forEach((r) => {
			ctx.fillStyle = SHARE_COLORS.ink600;
			ctx.font = shareFont(500, 13);
			ctx.textAlign = 'left';
			ctx.fillText(r.payer, PAD + CP, py);
			ctx.fillStyle = SHARE_COLORS.ink900;
			ctx.font = moneyFont(700, 13);
			ctx.textAlign = 'right';
			ctx.fillText(formatCurrency(r.feeSum), PAD + CW - CP, py);
			ctx.textAlign = 'left';
			py += payerRowH;
		});

		y += payerCardH + GAP;
	}

	ctx.fillStyle = SHARE_COLORS.surface;
	roundRect(ctx, PAD, y, CW, participantsCardH, 14);
	ctx.fill();
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1.5;
	roundRect(ctx, PAD, y, CW, participantsCardH, 14);
	ctx.stroke();

	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 14);
	ctx.fillText(`Participants (${count})`, PAD + CP, y + CP + 4);

	const chipsOriginX = PAD + CP;
	const chipsOriginY = y + CP + 4 + 24;
	ctx.font = shareFont(600, 12.5);
	const chipLabels = names.length ? names : ['No participants yet'];
	chips.positions.forEach((pos, idx) => {
		const chipX = chipsOriginX + pos.x;
		const chipY = chipsOriginY + pos.y;
		ctx.fillStyle = SHARE_COLORS.emerald50;
		roundRect(ctx, chipX, chipY, pos.w, 27, 13.5);
		ctx.fill();
		ctx.strokeStyle = SHARE_COLORS.emerald100;
		ctx.lineWidth = 1.5;
		roundRect(ctx, chipX, chipY, pos.w, 27, 13.5);
		ctx.stroke();
		ctx.fillStyle = SHARE_COLORS.emerald800;
		ctx.fillText(chipLabels[idx], chipX + 11, chipY + 18);
	});

	y += participantsCardH + GAP;
	ctx.textAlign = 'center';
	ctx.fillStyle = SHARE_COLORS.ink500;
	ctx.font = shareFont(500, 11);
	ctx.fillText('Generated with Pickleball Fee Splitter', W / 2, y + 4);
	ctx.textAlign = 'left';

	return canvas.toDataURL('image/png');
}

export async function loadShareFonts() {
	try {
		await Promise.all([
			document.fonts.load(shareFont(500, 16)),
			document.fonts.load(shareFont(600, 16)),
			document.fonts.load(shareFont(700, 16)),
			document.fonts.load(shareFont(800, 16))
		]);
	} catch {
		// Fall through and render with whatever font is available.
	}
}
