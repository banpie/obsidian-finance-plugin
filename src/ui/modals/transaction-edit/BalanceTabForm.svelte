<!-- src/ui/modals/transaction-edit/BalanceTabForm.svelte -->
<script lang="ts">
	import { nativeDatePicker } from "../../actions/nativeDatePicker";

	export let date: string;
	export let balanceAccount: string;
	export let balanceAmount: string | number;
	export let balanceCurrency: string;
</script>

<div class="form-grid">
	<div class="form-group">
		<label for="balance-date">Date *</label>
		<input
			type="date"
			id="balance-date"
			bind:value={date}
			use:nativeDatePicker
			required
		/>
	</div>

	<div class="form-group">
		<label for="balance-account">Account *</label>
		<input
			type="text"
			id="balance-account"
			bind:value={balanceAccount}
			list="accounts-list"
			placeholder="Account to check balance"
			required
		/>
	</div>

	<div class="form-group">
		<label for="balance-amount">Amount *</label>
		<input
			type="number"
			step="0.01"
			id="balance-amount"
			bind:value={balanceAmount}
			placeholder="Expected balance"
			required
		/>
	</div>

	<div class="form-group">
		<label for="balance-currency">Currency *</label>
		<input
			type="text"
			id="balance-currency"
			bind:value={balanceCurrency}
			list="currencies-list"
			placeholder="INR"
			maxlength="3"
			required
		/>
	</div>
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

	.form-group label {
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		color: var(--text-muted);
	}

	input[type="text"], input[type="number"], input[type="date"] {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	input:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}
</style>
