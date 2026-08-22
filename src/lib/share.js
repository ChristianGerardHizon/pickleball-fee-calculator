import { formatCurrency, formatDateLabel, titleCase } from './format.js';
import { getPayerBreakdown } from './math.js';

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
 * @param {HTMLCanvasElement} canvas
 * @param {{ event: EventRecord, date: string }} opts
 * @returns {string}
 */
export function generateShareImage(canvas, { event, date }) {
	const totalFee = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
	const count = event.participants.length;
	const perPerson = count > 0 ? totalFee / count : 0;
	const names = event.participants.map((p) => titleCase(p.name));
	const payerRows = getPayerBreakdown(event, totalFee, 0);

	const W = 800;
	const PAD = 40;
	const CW = W - PAD * 2;
	const CP = 24;
	const INNER_W = CW - CP * 2;

	canvas.width = W;
	canvas.height = 200;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	const HEADER_H = 104;
	const HIGHLIGHT_H = 116;
	const courtRowH = 30;
	const courtsCardH =
		CP + 22 + 16 + (event.courts.length > 0 ? event.courts.length * courtRowH : courtRowH) + 16 + 24 + CP;
	const payerRowH = 30;
	const payerCardH = payerRows ? CP + 22 + 16 + payerRows.length * payerRowH + CP : 0;

	const chips = layoutChips(
		ctx,
		names.length ? names : ['No participants yet'],
		INNER_W,
		34,
		10,
		10,
		14,
		shareFont(600, 14)
	);
	const participantsCardH = CP + 22 + 16 + chips.totalHeight + CP;

	const GAP = 20;
	const totalHeight =
		HEADER_H +
		GAP +
		HIGHLIGHT_H +
		GAP +
		courtsCardH +
		GAP +
		(payerRows ? payerCardH + GAP : 0) +
		participantsCardH +
		GAP +
		30;

	canvas.width = W;
	canvas.height = totalHeight;

	ctx.fillStyle = SHARE_COLORS.bg;
	ctx.fillRect(0, 0, W, totalHeight);

	ctx.fillStyle = SHARE_COLORS.emerald700;
	ctx.fillRect(0, 0, W, HEADER_H);
	const badgeSize = 52;
	const badgeY = (HEADER_H - badgeSize) / 2;
	ctx.fillStyle = 'rgba(255,255,255,0.16)';
	roundRect(ctx, PAD, badgeY, badgeSize, badgeSize, 14);
	ctx.fill();
	drawPaddleIcon(ctx, PAD + (badgeSize - 26) / 2, badgeY + (badgeSize - 26) / 2, 26, '#ffffff');

	const textX = PAD + badgeSize + 16;
	ctx.textAlign = 'left';
	ctx.fillStyle = '#ffffff';
	ctx.font = shareFont(800, 25);
	ctx.fillText('Pickleball Court Fees', textX, HEADER_H / 2 - 4);
	ctx.font = shareFont(500, 15);
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.fillText(formatDateLabel(date), textX, HEADER_H / 2 + 20);

	let y = HEADER_H + GAP;
	ctx.fillStyle = SHARE_COLORS.emerald700;
	roundRect(ctx, PAD, y, CW, HIGHLIGHT_H, 16);
	ctx.fill();

	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = shareFont(600, 14);
	ctx.fillText('AMOUNT PER PERSON', PAD + CP, y + 38);
	ctx.fillStyle = '#ffffff';
	ctx.font = moneyFont(700, 44);
	ctx.fillText(formatCurrency(perPerson), PAD + CP, y + 86);

	const statX = PAD + CW - CP;
	ctx.textAlign = 'right';
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = shareFont(600, 13);
	ctx.fillText('TOTAL POOL', statX, y + 38);
	ctx.fillStyle = '#ffffff';
	ctx.font = moneyFont(700, 22);
	ctx.fillText(formatCurrency(totalFee), statX, y + 64);
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = shareFont(600, 13);
	ctx.fillText('PARTICIPANTS', statX, y + 90);
	ctx.fillStyle = '#ffffff';
	ctx.font = shareFont(700, 20);
	ctx.fillText(String(count), statX, y + 112);
	ctx.textAlign = 'left';

	y += HIGHLIGHT_H + GAP;
	ctx.fillStyle = SHARE_COLORS.surface;
	roundRect(ctx, PAD, y, CW, courtsCardH, 16);
	ctx.fill();
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1.5;
	roundRect(ctx, PAD, y, CW, courtsCardH, 16);
	ctx.stroke();

	let cy = y + CP + 6;
	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 16);
	ctx.fillText('Court Fees', PAD + CP, cy);
	cy += 30;

	if (event.courts.length === 0) {
		ctx.fillStyle = SHARE_COLORS.ink500;
		ctx.font = shareFont(500, 14);
		ctx.fillText('No courts added', PAD + CP, cy);
		cy += courtRowH;
	} else {
		event.courts.forEach((c, idx) => {
			ctx.fillStyle = SHARE_COLORS.ink600;
			ctx.font = shareFont(500, 15);
			ctx.textAlign = 'left';
			ctx.fillText(`Court ${idx + 1}`, PAD + CP, cy);
			ctx.fillStyle = SHARE_COLORS.ink900;
			ctx.font = moneyFont(700, 15);
			ctx.textAlign = 'right';
			ctx.fillText(formatCurrency(c.fee), PAD + CW - CP, cy);
			ctx.textAlign = 'left';
			cy += courtRowH;
		});
	}

	cy += 4;
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(PAD + CP, cy);
	ctx.lineTo(PAD + CW - CP, cy);
	ctx.stroke();
	cy += 26;

	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 16);
	ctx.textAlign = 'left';
	ctx.fillText('Total', PAD + CP, cy);
	ctx.fillStyle = SHARE_COLORS.emerald700;
	ctx.font = moneyFont(700, 17);
	ctx.textAlign = 'right';
	ctx.fillText(formatCurrency(totalFee), PAD + CW - CP, cy);
	ctx.textAlign = 'left';

	y += courtsCardH + GAP;
	if (payerRows) {
		ctx.fillStyle = SHARE_COLORS.surface;
		roundRect(ctx, PAD, y, CW, payerCardH, 16);
		ctx.fill();
		ctx.strokeStyle = SHARE_COLORS.ink200;
		ctx.lineWidth = 1.5;
		roundRect(ctx, PAD, y, CW, payerCardH, 16);
		ctx.stroke();

		let py = y + CP + 6;
		ctx.fillStyle = SHARE_COLORS.ink900;
		ctx.font = shareFont(700, 16);
		ctx.fillText('Paid By', PAD + CP, py);
		py += 30;

		payerRows.forEach((r) => {
			ctx.fillStyle = SHARE_COLORS.ink600;
			ctx.font = shareFont(500, 15);
			ctx.textAlign = 'left';
			ctx.fillText(r.payer, PAD + CP, py);
			ctx.fillStyle = SHARE_COLORS.ink900;
			ctx.font = moneyFont(700, 15);
			ctx.textAlign = 'right';
			ctx.fillText(formatCurrency(r.feeSum), PAD + CW - CP, py);
			ctx.textAlign = 'left';
			py += payerRowH;
		});

		y += payerCardH + GAP;
	}

	ctx.fillStyle = SHARE_COLORS.surface;
	roundRect(ctx, PAD, y, CW, participantsCardH, 16);
	ctx.fill();
	ctx.strokeStyle = SHARE_COLORS.ink200;
	ctx.lineWidth = 1.5;
	roundRect(ctx, PAD, y, CW, participantsCardH, 16);
	ctx.stroke();

	ctx.fillStyle = SHARE_COLORS.ink900;
	ctx.font = shareFont(700, 16);
	ctx.fillText(`Participants (${count})`, PAD + CP, y + CP + 6);

	const chipsOriginX = PAD + CP;
	const chipsOriginY = y + CP + 6 + 32;
	ctx.font = shareFont(600, 14);
	const chipLabels = names.length ? names : ['No participants yet'];
	chips.positions.forEach((pos, idx) => {
		const chipX = chipsOriginX + pos.x;
		const chipY = chipsOriginY + pos.y;
		ctx.fillStyle = SHARE_COLORS.emerald50;
		roundRect(ctx, chipX, chipY, pos.w, 34, 17);
		ctx.fill();
		ctx.strokeStyle = SHARE_COLORS.emerald100;
		ctx.lineWidth = 1.5;
		roundRect(ctx, chipX, chipY, pos.w, 34, 17);
		ctx.stroke();
		ctx.fillStyle = SHARE_COLORS.emerald800;
		ctx.fillText(chipLabels[idx], chipX + 14, chipY + 22);
	});

	y += participantsCardH + GAP;
	ctx.textAlign = 'center';
	ctx.fillStyle = SHARE_COLORS.ink500;
	ctx.font = shareFont(500, 12);
	ctx.fillText('Generated with Pickleball Fee Splitter', W / 2, y + 6);
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
