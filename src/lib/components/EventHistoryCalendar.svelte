<script>
	/** @type {{ eventDates: string[], onSelect: (date: string) => void }} */
	let { eventDates, onSelect } = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	const eventSet = $derived(new Set(eventDates));

	function initialView() {
		const newest = eventDates[0];
		if (newest) {
			const [y, m] = newest.split('-').map(Number);
			return { year: y, month: m - 1 };
		}
		const now = new Date();
		return { year: now.getFullYear(), month: now.getMonth() };
	}

	const start = initialView();
	let viewYear = $state(start.year);
	let viewMonth = $state(start.month);

	const monthLabel = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	/** @param {number} year @param {number} month @param {number} day */
	function toIso(year, month, day) {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	const cells = $derived.by(() => {
		const firstDow = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		/** @type {{ key: string, day: number | null, iso: string | null, hasEvent: boolean }[]} */
		const result = [];
		for (let i = 0; i < firstDow; i++) {
			result.push({ key: `pad-${i}`, day: null, iso: null, hasEvent: false });
		}
		for (let day = 1; day <= daysInMonth; day++) {
			const iso = toIso(viewYear, viewMonth, day);
			result.push({
				key: iso,
				day,
				iso,
				hasEvent: eventSet.has(iso)
			});
		}
		return result;
	});

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}
</script>

<div class="event-cal" role="group" aria-label="Event dates calendar">
	<div class="event-cal-header">
		<button type="button" class="event-cal-nav" aria-label="Previous month" onclick={prevMonth}>
			‹
		</button>
		<span class="event-cal-month">{monthLabel}</span>
		<button type="button" class="event-cal-nav" aria-label="Next month" onclick={nextMonth}>
			›
		</button>
	</div>
	<div class="event-cal-weekdays" aria-hidden="true">
		{#each WEEKDAYS as wd}
			<span>{wd}</span>
		{/each}
	</div>
	<div class="event-cal-grid">
		{#each cells as cell (cell.key)}
			{#if cell.day === null}
				<span class="event-cal-pad"></span>
			{:else if cell.hasEvent && cell.iso}
				<button
					type="button"
					class="event-cal-day has-event"
					aria-label="Open event {cell.iso}"
					onclick={() => {
						if (cell.iso) onSelect(cell.iso);
					}}
				>
					{cell.day}
				</button>
			{:else}
				<span class="event-cal-day muted">{cell.day}</span>
			{/if}
		{/each}
	</div>
</div>
