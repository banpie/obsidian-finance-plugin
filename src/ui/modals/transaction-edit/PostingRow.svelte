<!-- src/ui/modals/transaction-edit/PostingRow.svelte -->
<script lang="ts">
	import type { JournalPosting } from "../../../models/journal";
	import { nativeDatePicker } from "../../actions/nativeDatePicker";

	export let posting: JournalPosting;
	export let index: number;
	export let totalPostings: number;
	export let date: string;
	export let operatingCurrency = "USD";

	export let showCost = false;
	export let showPrice = false;
	export let showPostingFlag = false;
	export let showPostingComment = false;
	export let showPostingMetadata = false;

	export let onToggleCost: (index: number) => void;
	export let onTogglePrice: (index: number) => void;
	export let onToggleFlag: (index: number) => void;
	export let onToggleComment: (index: number) => void;
	export let onToggleMetadata: (index: number) => void;
	export let onRemovePosting: (index: number) => void;

	export let onAddMetadata: (index: number) => void;
	export let onRemoveMetadata: (index: number, key: string) => void;
	export let onUpdateMetadataKey: (index: number, oldKey: string, newKey: string) => void;
</script>

<div class="posting-container">
	<div class="posting-row">
		<div class="posting-account">
			<label for="posting-account-{index}">Account *</label>
			<input
				id="posting-account-{index}"
				type="text"
				bind:value={posting.account}
				list="accounts-list"
				placeholder="Account name"
				required
			/>
		</div>

		<div class="posting-amount">
			<label for="posting-amount-{index}">Amount</label>
			<input
				id="posting-amount-{index}"
				type="number"
				step="0.01"
				bind:value={posting.amount}
				placeholder="Optional amount"
				on:wheel|preventDefault
			/>
		</div>

		<div class="posting-currency">
			<label for="posting-currency-{index}">Currency</label>
			<input
				id="posting-currency-{index}"
				bind:value={posting.currency}
				list="currencies-list"
				placeholder={operatingCurrency}
				maxlength="3"
			/>
		</div>

		<div class="posting-toggle-buttons">
			<button
				type="button"
				class="posting-toggle-btn cost-btn"
				class:active={showCost}
				on:click={() => onToggleCost(index)}
				title="Cost"
			>$</button>
			<button
				type="button"
				class="posting-toggle-btn price-btn"
				class:active={showPrice}
				on:click={() => onTogglePrice(index)}
				title="Price"
			>@</button>
			<button
				type="button"
				class="posting-toggle-btn flag-btn"
				class:active={showPostingFlag}
				on:click={() => onToggleFlag(index)}
				title="Flag"
			>!</button>
			<button
				type="button"
				class="posting-toggle-btn comment-btn"
				class:active={showPostingComment}
				on:click={() => onToggleComment(index)}
				title="Comment"
			>💬</button>
			<button
				type="button"
				class="posting-toggle-btn metadata-btn"
				class:active={showPostingMetadata}
				on:click={() => onToggleMetadata(index)}
				title="Metadata"
			>📋</button>
			{#if totalPostings > 2}
				<button
					type="button"
					class="remove-posting"
					on:click={() => onRemovePosting(index)}
					title="Remove posting"
				>&times;</button>
			{/if}
		</div>
	</div>

	<!-- Cost Section -->
	{#if showCost && posting.cost}
		<div class="posting-advanced cost-section">
			<div class="advanced-grid">
				<div class="advanced-field">
					<label for="cost-amount-{index}">Amount</label>
					<input
						id="cost-amount-{index}"
						type="number"
						step="0.01"
						bind:value={posting.cost.number}
						placeholder="150.00"
						on:wheel|preventDefault
					/>
				</div>

				<div class="advanced-field">
					<label for="cost-currency-{index}">Currency</label>
					<input
						id="cost-currency-{index}"
						type="text"
						bind:value={posting.cost.currency}
						list="currencies-list"
						placeholder={operatingCurrency}
						maxlength="3"
					/>
				</div>

				<div class="advanced-field">
					<label for="cost-date-{index}">Date</label>
					<input
						id="cost-date-{index}"
						type="date"
						bind:value={posting.cost.date}
						max={date}
						use:nativeDatePicker
					/>
				</div>

				<div class="advanced-field">
					<label for="cost-label-{index}">Label</label>
					<input
						id="cost-label-{index}"
						bind:value={posting.cost.label}
						placeholder="lot-001"
					/>
				</div>

				<div class="advanced-field checkbox-field">
					<label>
						<input
							type="checkbox"
							bind:checked={posting.cost.isTotal}
						/>
						Total Cost {'{{}}'}
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- Price Section -->
	{#if showPrice && posting.price}
		<div class="posting-advanced price-section">
			<div class="advanced-grid">
				<div class="advanced-field">
					<label for="price-amount-{index}">Amount</label>
					<input
						id="price-amount-{index}"
						type="number"
						step="0.01"
						bind:value={posting.price.amount}
						placeholder="1.09"
						on:wheel|preventDefault
					/>
				</div>

				<div class="advanced-field">
					<label for="price-currency-{index}">Currency</label>
					<input
						id="price-currency-{index}"
						bind:value={posting.price.currency}
						list="currencies-list"
						placeholder={operatingCurrency}
						maxlength="3"
					/>
				</div>

				<div class="advanced-field checkbox-field">
					<label>
						<input
							type="checkbox"
							bind:checked={posting.price.isTotal}
						/>
						Total Price @@
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- Posting Flag Section -->
	{#if showPostingFlag}
		<div class="posting-advanced flag-section">
			<div class="flag-field">
				<label>
					<input
						type="radio"
						bind:group={posting.flag}
						value="!"
					/>
					! Incomplete
				</label>
				<label>
					<input
						type="radio"
						bind:group={posting.flag}
						value="*"
					/>
					* Complete
				</label>
			</div>
		</div>
	{/if}

	<!-- Comment Section -->
	{#if showPostingComment}
		<div class="posting-advanced comment-section">
			<label for="posting-comment-{index}">Comment</label>
			<input
				id="posting-comment-{index}"
				bind:value={posting.comment}
				placeholder="Inline comment"
				class="comment-input"
			/>
		</div>
	{/if}

	<!-- Posting Metadata Section -->
	{#if showPostingMetadata}
		<div class="posting-advanced metadata-section">
			<div class="metadata-list">
				{#each Object.keys(posting.metadata || {}) as key}
					<div class="metadata-item">
						<input
							type="text"
							value={key}
							placeholder="key"
							class="metadata-key"
							on:change={(e) => onUpdateMetadataKey(index, key, e.currentTarget.value)}
						/>
						<input
							type="text"
							bind:value={posting.metadata[key]}
							placeholder="Value"
							class="metadata-value"
						/>
						<button
							type="button"
							class="remove-metadata"
							on:click={() => onRemoveMetadata(index, key)}
						>&times;</button>
					</div>
				{/each}
				<button
					type="button"
					class="add-metadata-btn"
					on:click={() => onAddMetadata(index)}
				>+ Add Metadata</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.posting-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 10px;
		margin-bottom: 8px;
	}

	.posting-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: 8px;
		align-items: flex-end;
	}

	.posting-account, .posting-amount, .posting-currency {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.posting-account label, .posting-amount label, .posting-currency label {
		font-size: 11px;
		color: var(--text-muted);
	}

	input[type="text"], input[type="number"], input[type="date"] {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
		font-size: 12px;
	}

	input:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.posting-toggle-buttons {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.posting-toggle-btn {
		width: 26px;
		height: 26px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		border-radius: var(--radius-s);
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		cursor: pointer;
	}

	.posting-toggle-btn.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.remove-posting {
		width: 26px;
		height: 26px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 14px;
	}

	.remove-posting:hover {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.posting-advanced {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 8px;
		margin-top: 4px;
	}

	.advanced-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 8px;
		align-items: flex-end;
	}

	.advanced-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.advanced-field label {
		font-size: 10px;
		color: var(--text-muted);
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		cursor: pointer;
	}

	.flag-field {
		display: flex;
		gap: 16px;
	}

	.flag-field label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		cursor: pointer;
	}

	.comment-input {
		width: 100%;
	}

	.metadata-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.metadata-item {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.metadata-key, .metadata-value {
		flex: 1;
	}

	.remove-metadata {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 14px;
	}

	.add-metadata-btn {
		align-self: flex-start;
		font-size: 11px;
		background: transparent;
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 2px 8px;
		color: var(--text-accent);
		cursor: pointer;
	}
</style>
