<script>
	import { generatePersonShareImage, generateShareImage, loadShareFonts } from '$lib/share.js';
	import { ME_PAYER } from '$lib/math.js';
	import { titleCase } from '$lib/format.js';
	import { tick } from 'svelte';
	import IconX from './IconX.svelte';

	/**
	 * @type {{
	 *   open: boolean,
	 *   event: import('$lib/storage.js').EventRecord,
	 *   date: string,
	 *   meLabel?: string,
	 *   participantIndex?: number | null
	 * }}
	 */
	let {
		open = $bindable(false),
		event,
		date,
		meLabel = ME_PAYER,
		participantIndex = null
	} = $props();

	let imageSrc = $state('');
	let downloadName = $state('pickleball-split.png');
	/** @type {HTMLButtonElement | undefined} */
	let closeButton = $state();

	const isPersonShare = $derived(
		typeof participantIndex === 'number' &&
			participantIndex >= 0 &&
			participantIndex < event.participants.length
	);
	const personName = $derived(
		isPersonShare ? titleCase(event.participants[/** @type {number} */ (participantIndex)].name) : ''
	);

	$effect(() => {
		if (open) {
			document.body.classList.add('modal-open');
			tick().then(() => closeButton?.focus());
		} else {
			document.body.classList.remove('modal-open');
		}
		return () => document.body.classList.remove('modal-open');
	});

	/** @param {HTMLCanvasElement} node */
	function shareCanvas(node) {
		let cancelled = false;
		(async () => {
			await loadShareFonts();
			if (cancelled) return;
			if (isPersonShare) {
				imageSrc = generatePersonShareImage(node, {
					event,
					date,
					participantIndex: /** @type {number} */ (participantIndex),
					meLabel
				});
				const slug = personName.toLowerCase().replace(/\s+/g, '-') || 'person';
				downloadName = `pickleball-${date}-${slug}.png`;
			} else {
				imageSrc = generateShareImage(node, { event, date, meLabel });
				downloadName = `pickleball-${date}.png`;
			}
		})();
		return {
			destroy() {
				cancelled = true;
			}
		};
	}

	function close() {
		open = false;
		imageSrc = '';
	}

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (e.key === 'Escape' && open) close();
	}

	/** @param {MouseEvent} e */
	function onBackdrop(e) {
		if (e.target === e.currentTarget) close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="modal" onclick={onBackdrop} role="presentation">
		<div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="share-title">
			<button
				type="button"
				class="modal-close"
				aria-label="Close"
				bind:this={closeButton}
				onclick={close}
			>
				<IconX />
			</button>
			<h2 id="share-title">
				{#if isPersonShare}
					{personName}'s Summary
				{:else}
					Shareable Summary
				{/if}
			</h2>
			{#key `${isPersonShare ? participantIndex : 'event'}-${date}`}
				<canvas use:shareCanvas class="hidden"></canvas>
			{/key}
			{#if imageSrc}
				<img
					class="share-image"
					src={imageSrc}
					alt={isPersonShare ? `${personName} fee summary` : 'Shareable summary'}
				/>
			{/if}
			<p class="hint">Long-press the image to save, or use the button below.</p>
			<a class="btn-primary" href={imageSrc} download={downloadName}>
				<svg
					class="icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<path d="M7 10l5 5 5-5" />
					<path d="M12 15V3" />
				</svg>
				Download Image
			</a>
		</div>
	</div>
{/if}
