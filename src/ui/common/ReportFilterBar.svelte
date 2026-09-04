<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let query = '';
	export let placeholder = 'Search…';
	export let shownCount = 0;
	export let totalCount = 0;
	export let hasActiveFilters = false;
	export let searchLabel = 'Search report rows';

	const dispatch = createEventDispatcher<{ clear: void }>();
</script>

<div class="report-filter-bar">
	<label class="search-control">
		<span class="search-icon" aria-hidden="true">⌕</span>
		<input type="search" bind:value={query} {placeholder} aria-label={searchLabel} />
	</label>

	<div class="filter-controls">
		<slot />
	</div>

	<div class="filter-summary" aria-live="polite">{shownCount} of {totalCount}</div>
	<button
		type="button"
		class="clear-filters"
		disabled={!hasActiveFilters}
		on:click={() => dispatch('clear')}
	>
		Clear
	</button>
</div>

<style>
	.report-filter-bar {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		flex-wrap: wrap;
		padding: var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-secondary);
	}

	.search-control {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: min(280px, 100%);
		flex: 1 1 240px;
		padding: 0 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
	}

	.search-control:focus-within {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 1px var(--interactive-accent);
	}

	.search-icon,
	.filter-summary {
		color: var(--text-muted);
	}

	.search-control input {
		width: 100%;
		min-height: 32px;
		border: 0;
		box-shadow: none;
		background: transparent;
	}

	.search-control input:focus {
		box-shadow: none;
	}

	.filter-controls {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		flex-wrap: wrap;
	}

	.filter-summary {
		font-size: var(--font-ui-smaller);
		white-space: nowrap;
	}

	.clear-filters {
		min-height: 32px;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		cursor: pointer;
	}

	.clear-filters:disabled {
		cursor: default;
		opacity: 0.55;
	}

	@media (max-width: 720px) {
		.search-control,
		.filter-controls {
			width: 100%;
		}

		.filter-controls :global(select) {
			flex: 1 1 140px;
		}
	}
</style>
