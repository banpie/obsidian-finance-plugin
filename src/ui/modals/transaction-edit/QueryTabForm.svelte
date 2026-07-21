<!-- src/ui/modals/transaction-edit/QueryTabForm.svelte -->
<script lang="ts">
	import { nativeDatePicker } from "../../actions/nativeDatePicker";

	export let date: string;
	export let queryName: string;
	export let querySql: string;
	export let queryTesting = false;
	export let queryTestRows: string[][] = [];
	export let queryTestError = "";
	export let savedQueries: Record<string, string> = {};
	export let savedQueriesLoading = false;

	export let onTestQuerySQL: () => void;
	export let onLoadSavedQueries: () => void;
	export let onLoadQueryIntoForm: (name: string, sql: string) => void;
</script>

<div class="form-grid">
	<div class="form-group">
		<label for="query-date">Date *</label>
		<input
			type="date"
			id="query-date"
			bind:value={date}
			use:nativeDatePicker
			required
		/>
	</div>

	<div class="form-group">
		<label for="query-name">Query name *</label>
		<input
			type="text"
			id="query-name"
			bind:value={queryName}
			placeholder="e.g. my_expenses"
			required
		/>
		<small class="query-hint">Use in notes with <code>bql-q:{queryName || 'name'}</code></small>
	</div>

	<div class="form-group full-width">
		<label for="query-sql">SQL *</label>
		<textarea
			id="query-sql"
			bind:value={querySql}
			placeholder="SELECT account, sum(position) WHERE account ~ 'Expenses' GROUP BY account"
			required
			rows="4"
			class="query-sql-textarea"
		></textarea>
		<button
			type="button"
			class="btn-test-query"
			on:click={onTestQuerySQL}
			disabled={queryTesting || !querySql.trim()}
		>
			{queryTesting ? "Running..." : "▶ Test Query"}
		</button>
	</div>

	{#if queryTestError}
		<div class="form-group full-width">
			<div class="query-test-error">
				<strong>Error:</strong> {queryTestError}
			</div>
		</div>
	{/if}

	{#if queryTestRows.length > 0}
		<div class="form-group full-width">
			<div class="query-test-results">
				<small class="query-preview-label">
					Preview {Math.min(queryTestRows.length - 1, 5)} row(s)
				</small>
				<table class="query-preview-table">
					<thead>
						<tr>{#each queryTestRows[0] as h}<th>{h}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each queryTestRows.slice(1) as row}
							<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<!-- Saved Queries Browser -->
<div class="saved-queries-section">
	<div class="saved-queries-header">
		<span>Saved Named Queries</span>
		<button
			type="button"
			class="btn-refresh-queries"
			on:click={onLoadSavedQueries}
			disabled={savedQueriesLoading}
			title="Refresh list"
		>↻</button>
	</div>
	{#if savedQueriesLoading}
		<p class="saved-queries-empty">Loading…</p>
	{:else if Object.keys(savedQueries).length === 0}
		<p class="saved-queries-empty">No named queries saved yet.</p>
	{:else}
		<ul class="saved-queries-list">
			{#each Object.entries(savedQueries) as [name, sql]}
				<li class="saved-query-item">
					<div class="saved-query-info">
						<code class="saved-query-name">bql-q:{name}</code>
						<span class="saved-query-sql">{sql}</span>
					</div>
					<button
						type="button"
						class="btn-load-query"
						on:click={() => onLoadQueryIntoForm(name, sql)}
						title="Load into editor"
					>Load</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-3);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.form-group.full-width {
		grid-column: span 2;
	}

	.form-group label {
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		color: var(--text-muted);
	}

	input[type="text"], input[type="date"], textarea {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		font-family: inherit;
	}

	input:focus, textarea:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.query-sql-textarea {
		font-family: var(--font-monospace);
		font-size: 12px;
	}

	.query-hint {
		font-size: 11px;
		color: var(--text-muted);
	}

	.btn-test-query {
		align-self: flex-start;
		margin-top: 6px;
		font-size: 12px;
		padding: 4px 12px;
		border-radius: var(--radius-s);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		cursor: pointer;
	}

	.query-test-error {
		padding: 8px 12px;
		border-radius: var(--radius-s);
		background: rgba(220, 50, 50, 0.1);
		color: var(--text-error);
		font-size: 12px;
	}

	.query-test-results {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 8px;
		overflow-x: auto;
	}

	.query-preview-label {
		display: block;
		font-size: 11px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.query-preview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
	}

	.query-preview-table th, .query-preview-table td {
		padding: 4px 8px;
		border: 1px solid var(--background-modifier-border);
		text-align: left;
	}

	.saved-queries-section {
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.saved-queries-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-2);
		font-weight: 500;
		font-size: var(--font-ui-small);
	}

	.btn-refresh-queries {
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 14px;
	}

	.saved-queries-empty {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-style: italic;
	}

	.saved-queries-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.saved-query-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
	}

	.saved-query-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
	}

	.saved-query-name {
		font-size: 11px;
		color: var(--text-accent);
	}

	.saved-query-sql {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.btn-load-query {
		font-size: 11px;
		padding: 2px 8px;
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		cursor: pointer;
	}
</style>
