<script>
	import { generateShareImage, loadShareFonts } from '$lib/share.js';
	import { tick } from 'svelte';
	import IconX from './IconX.svelte';

	/** @type {{ open: boolean, event: import('$lib/storage.js').EventRecord, date: string }} */
	let { open = $bindable(false), event, date } = $props();

	let imageSrc = $state('');
	let downloadName = $state('pickleball-split.png');
	/** @type {HTMLButtonElement | undefined} */
	let closeButton = $state();

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
			imageSrc = generateShareImage(node, { event, date });
			downloadName = `pickleball-${date}.png`;
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
			<h2 id="share-title">Shareable Summary</h2>
			<canvas use:shareCanvas class="hidden"></canvas>
			{#if imageSrc}
				<img class="share-image" src={imageSrc} alt="Shareable summary" />
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
