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

	const months = [
		{ value: 1, label: 'January', shortLabel: 'Jan' },
		{ value: 2, label: 'February', shortLabel: 'Feb' },
		{ value: 3, label: 'March', shortLabel: 'Mar' },
		{ value: 4, label: 'April', shortLabel: 'Apr' },
		{ value: 5, label: 'May', shortLabel: 'May' },
		{ value: 6, label: 'June', shortLabel: 'Jun' },
		{ value: 7, label: 'July', shortLabel: 'Jul' },
		{ value: 8, label: 'August', shortLabel: 'Aug' },
		{ value: 9, label: 'September', shortLabel: 'Sep' },
		{ value: 10, label: 'October', shortLabel: 'Oct' },
		{ value: 11, label: 'November', shortLabel: 'Nov' },
		{ value: 12, label: 'December', shortLabel: 'Dec' },
	];

	const periodPresets: Array<{ value: PeriodPreset; label: string }> = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'last-year', label: 'Last Year' },
	];

	$: normalizedMonth = Math.min(12, Math.max(1, Math.trunc(month || 1)));
	$: monthName = months.find(item => item.value === normalizedMonth)?.label || '';
	$: displayLabel = periodMode === 'year' ? String(year) : `${monthName} ${year}`;
	$: modeLabel = periodMode === 'year' ? 'Year' : 'Month';
	$: presetLabel = periodPresets.find(item => item.value === periodPreset)?.label || (periodMode === 'year' ? 'Custom Year' : 'Custom Month');
	$: previousLabel = `Previous ${modeLabel.toLowerCase()}`;
	$: nextLabel = `Next ${modeLabel.toLowerCase()}`;

	async function handlePresetChange(event: Event) {
		const preset = (event.currentTarget as HTMLSelectElement).value as PeriodPreset;
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
		await onMonthChange(value);
	}

	async function handleYearChange(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(value)) {
			await onYearChange(value);
		}
	}
</script>

<div class="period-navigator">
	<div class="period-stepper" aria-label="Selected reporting period">
		<button type="button" class="icon-button" on:click={() => onMovePeriod(-1)} disabled={disabled} aria-label={previousLabel} title={previousLabel}>←</button>
		<button
			type="button"
			class="current-period-button"
			on:click={() => showPicker = !showPicker}
			disabled={disabled}
			aria-expanded={showPicker}
			title="Choose exact period"
		>
			<span class="current-period">{displayLabel}</span>
			<span class="current-preset">{presetLabel}</span>
		</button>
		<button type="button" class="icon-button" on:click={() => onMovePeriod(1)} disabled={disabled} aria-label={nextLabel} title={nextLabel}>→</button>
	</div>

	<div class="segmented-control period-mode" aria-label="Period mode">
		<button type="button" class:active={periodMode === 'month'} on:click={() => handleModeChange('month')} disabled={disabled}>Month</button>
		<button type="button" class:active={periodMode === 'year'} on:click={() => handleModeChange('year')} disabled={disabled}>Year</button>
	</div>

	<label class="quick-picker">
		<span>Quick</span>
		<select value={periodPreset} on:change={handlePresetChange} disabled={disabled}>
			{#each periodPresets as preset}
				<option value={preset.value}>{preset.label}</option>
			{/each}
		</select>
	</label>

	<button type="button" class="refresh-button" on:click={onRefresh} disabled={disabled}>Refresh</button>

	{#if showPicker}
		<div class="exact-picker">
			<label>
				<span>Year</span>
				<input type="number" min="1970" max="9999" step="1" value={year} on:change={handleYearChange} disabled={disabled} />
			</label>
			{#if periodMode === 'month'}
				<label>
					<span>Month</span>
					<select value={normalizedMonth} on:change={handleMonthChange} disabled={disabled}>
						{#each months as monthOption}
							<option value={monthOption.value}>{monthOption.label}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>
	{/if}
</div>

<style>
	.period-navigator {
		position: relative;
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--size-4-2);
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
	.refresh-button {
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

	.quick-picker,
	.exact-picker label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.quick-picker select,
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

	.icon-button:hover,
	.current-period-button:hover,
	.segmented-control button:hover,
	.refresh-button:hover {
		background: var(--interactive-hover);
	}

	.icon-button:disabled,
	.current-period-button:disabled,
	.segmented-control button:disabled,
	.refresh-button:disabled,
	.quick-picker select:disabled,
	.exact-picker select:disabled,
	.exact-picker input:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.exact-picker {
		position: absolute;
		right: 0;
		top: calc(100% + var(--size-4-1));
		z-index: 20;
		display: flex;
		gap: var(--size-4-2);
		padding: var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
	}

	@media (max-width: 700px) {
		.period-navigator {
			justify-content: flex-start;
		}

		.exact-picker {
			left: 0;
			right: auto;
		}
	}
</style>
