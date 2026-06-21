<script lang="ts">
	type PeriodMode = 'month' | 'year';
	type PeriodPreset = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom-month' | 'custom-year';

	export let periodPreset: PeriodPreset = 'this-month';
	export let periodMode: PeriodMode = 'month';
	export let year = new Date().getFullYear();
	export let month = new Date().getMonth() + 1;
	export let disabled = false;
	export let onPresetChange: (preset: PeriodPreset) => void | Promise<void> = () => {};
	export let onModeChange: (mode: PeriodMode) => void | Promise<void> = () => {};
	export let onMonthChange: (month: number) => void | Promise<void> = () => {};
	export let onYearChange: (year: number) => void | Promise<void> = () => {};
	export let onMovePeriod: (delta: -1 | 1) => void | Promise<void> = () => {};
	export let onRefresh: () => void | Promise<void> = () => {};

	let showPicker = false;
	let draftYear = year;
	let draftMonth = month;

	const months = [
		{ value: 1, label: '01' },
		{ value: 2, label: '02' },
		{ value: 3, label: '03' },
		{ value: 4, label: '04' },
		{ value: 5, label: '05' },
		{ value: 6, label: '06' },
		{ value: 7, label: '07' },
		{ value: 8, label: '08' },
		{ value: 9, label: '09' },
		{ value: 10, label: '10' },
		{ value: 11, label: '11' },
		{ value: 12, label: '12' },
	];

	const periodPresets: Array<{ value: PeriodPreset; label: string }> = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'last-year', label: 'Last Year' },
	];

	$: normalizedMonth = Math.min(12, Math.max(1, Math.trunc(month || 1)));
	$: displayLabel = periodMode === 'year' ? String(year) : `${year}-${pad2(normalizedMonth)}`;
	$: modeLabel = periodMode === 'year' ? 'Year' : 'Month';
	$: presetLabel = periodPresets.find(item => item.value === periodPreset)?.label || (periodMode === 'year' ? 'Custom Year' : 'Custom Month');
	$: previousLabel = `Previous ${modeLabel.toLowerCase()}`;
	$: nextLabel = `Next ${modeLabel.toLowerCase()}`;

	function pad2(value: number): string {
		return String(value).padStart(2, '0');
	}

	function openPicker() {
		draftYear = year;
		draftMonth = normalizedMonth;
		showPicker = !showPicker;
	}

	async function handlePresetChange(preset: PeriodPreset) {
		showPicker = false;
		await onPresetChange(preset);
	}

	async function handleModeChange(mode: PeriodMode) {
		if (mode === periodMode) return;
		showPicker = false;
		await onModeChange(mode);
	}

	async function handleMonthChange(event: Event) {
		const value = Number((event.currentTarget as HTMLSelectElement).value);
		draftMonth = Math.min(12, Math.max(1, Math.trunc(value)));
	}

	async function handleYearChange(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(value)) {
			draftYear = Math.max(1, Math.trunc(value));
		}
	}

	async function handleMovePeriod(delta: -1 | 1) {
		showPicker = false;
		await onMovePeriod(delta);
	}

	async function handleRefresh() {
		showPicker = false;
		await onRefresh();
	}

	async function applyPicker() {
		if (draftYear !== year) {
			await onYearChange(draftYear);
		}
		if (periodMode === 'month' && draftMonth !== normalizedMonth) {
			await onMonthChange(draftMonth);
		}
		showPicker = false;
	}

	function cancelPicker() {
		showPicker = false;
		draftYear = year;
		draftMonth = normalizedMonth;
	}

	function handlePickerKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			cancelPicker();
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			applyPicker();
		}
	}
</script>

<div class="period-navigator">
	<div class="period-main">
		<div class="period-stepper-wrap">
			<div class="period-stepper" aria-label="Selected reporting period">
				<button type="button" class="icon-button" on:click={() => handleMovePeriod(-1)} disabled={disabled} aria-label={previousLabel} title={previousLabel}>←</button>
				<button
					type="button"
					class="current-period-button"
					on:click={openPicker}
					disabled={disabled}
					aria-expanded={showPicker}
					title="Choose exact period"
				>
					<span class="current-period">{displayLabel}</span>
					<span class="current-preset">{presetLabel}</span>
				</button>
				<button type="button" class="icon-button" on:click={() => handleMovePeriod(1)} disabled={disabled} aria-label={nextLabel} title={nextLabel}>→</button>
			</div>

			{#if showPicker}
				<div class="exact-picker" role="dialog" aria-label="Choose exact period">
					<div class="exact-picker-fields">
						<label>
							<span>Year</span>
							<input type="number" min="1970" max="9999" step="1" value={draftYear} on:input={handleYearChange} on:keydown={handlePickerKeydown} disabled={disabled} />
						</label>
						{#if periodMode === 'month'}
							<label>
								<span>Month</span>
								<select value={draftMonth} on:change={handleMonthChange} on:keydown={handlePickerKeydown} disabled={disabled}>
									{#each months as monthOption}
										<option value={monthOption.value}>{monthOption.label}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
					<div class="exact-picker-actions">
						<button type="button" class="secondary-button" on:click={cancelPicker}>Cancel</button>
						<button type="button" class="primary-button" on:click={applyPicker} disabled={disabled}>Apply</button>
					</div>
				</div>
			{/if}
		</div>

		<div class="segmented-control period-mode" aria-label="Period mode">
			<button type="button" class:active={periodMode === 'month'} on:click={() => handleModeChange('month')} disabled={disabled}>Month</button>
			<button type="button" class:active={periodMode === 'year'} on:click={() => handleModeChange('year')} disabled={disabled}>Year</button>
		</div>

		<button type="button" class="refresh-button" on:click={handleRefresh} disabled={disabled}>Refresh</button>
	</div>

	<div class="quick-presets" aria-label="Quick period presets">
		{#each periodPresets as preset}
			<button
				type="button"
				class:active={periodPreset === preset.value}
				on:click={() => handlePresetChange(preset.value)}
				disabled={disabled}
			>
				{preset.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.period-navigator {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--size-4-1);
	}

	.period-main {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--size-4-2);
	}

	.period-stepper-wrap {
		position: relative;
		display: inline-flex;
	}

	.period-stepper {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		overflow: hidden;
		background: var(--background-primary);
	}

	.icon-button,
	.current-period-button,
	.segmented-control button,
	.refresh-button,
	.quick-presets button,
	.primary-button,
	.secondary-button {
		height: 34px;
		border: 0;
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.icon-button {
		width: 34px;
		padding: 0;
		font-size: 16px;
	}

	.icon-button + .current-period-button,
	.current-period-button + .icon-button {
		border-left: 1px solid var(--background-modifier-border);
	}

	.current-period-button {
		display: flex;
		min-width: 138px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 0 var(--size-4-3);
	}

	.current-period {
		font-weight: 600;
		line-height: 1.1;
	}

	.current-preset {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		line-height: 1;
	}

	.segmented-control {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		overflow: hidden;
		background: var(--background-primary);
	}

	.segmented-control button {
		min-width: 58px;
		padding: 0 var(--size-4-2);
		border-left: 1px solid var(--background-modifier-border);
	}

	.segmented-control button:first-child {
		border-left: 0;
	}

	.segmented-control button.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.exact-picker label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.exact-picker select,
	.exact-picker input {
		min-width: 110px;
		height: 34px;
		padding: 0 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.refresh-button {
		padding: 0 var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
	}

	.quick-presets {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 4px;
	}

	.quick-presets button {
		height: 26px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.quick-presets button.active {
		border-color: var(--interactive-accent);
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.primary-button,
	.secondary-button {
		padding: 0 var(--size-4-3);
		border-radius: 4px;
	}

	.primary-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.secondary-button {
		border: 1px solid var(--background-modifier-border);
		background: var(--interactive-normal);
		color: var(--text-normal);
	}

	.icon-button:hover,
	.current-period-button:hover,
	.segmented-control button:hover,
	.refresh-button:hover,
	.quick-presets button:hover,
	.secondary-button:hover {
		background: var(--interactive-hover);
	}

	.primary-button:hover {
		background: var(--interactive-accent-hover);
	}

	.icon-button:disabled,
	.current-period-button:disabled,
	.segmented-control button:disabled,
	.refresh-button:disabled,
	.quick-presets button:disabled,
	.primary-button:disabled,
	.secondary-button:disabled,
	.exact-picker select:disabled,
	.exact-picker input:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.exact-picker {
		position: absolute;
		left: 0;
		top: calc(100% + var(--size-4-1));
		z-index: 50;
		display: flex;
		min-width: 260px;
		flex-direction: column;
		gap: var(--size-4-2);
		padding: var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
	}

	.exact-picker-fields {
		display: flex;
		gap: var(--size-4-2);
	}

	.exact-picker-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-2);
	}

	@media (max-width: 700px) {
		.period-navigator {
			align-items: flex-start;
		}

		.period-main,
		.quick-presets {
			justify-content: flex-start;
		}

		.exact-picker {
			left: 0;
			right: auto;
		}

		.exact-picker-fields {
			flex-direction: column;
		}
	}
</style>
