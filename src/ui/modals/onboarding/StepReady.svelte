<!-- src/ui/modals/onboarding/StepReady.svelte -->
<script lang="ts">
	export let beanQueryCommand: string | null = null;
	export let beanQueryVersion: string | null = null;
	export let beanPriceValid = false;
	export let beanPriceCommand: string | null = null;
	export let structuredFolderName = 'Finances';
	export let dataChoice: 'demo' | 'existing' | null = 'demo';
	export let operatingCurrency = 'USD';
	export let fileOrganization: 'yearly' | 'monthly' = 'yearly';

	export let onClose: () => void;
	export let onFinishAndOpenDashboard: () => void;
</script>

<div class="success-banner">
	<span class="success-icon">🎉</span>
	<h3>You're all set!</h3>
</div>

<div class="summary-card">
	<h4>Configuration Summary</h4>
	<div class="summary-grid">
		<div class="summary-row">
			<span class="summary-label">bean-query</span>
			<span class="summary-value"><code>{beanQueryCommand}</code> {#if beanQueryVersion}<span class="version-text">v{beanQueryVersion}</span>{/if}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">bean-price</span>
			<span class="summary-value">{beanPriceValid ? beanPriceCommand : 'Not configured (optional)'}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Folder</span>
			<span class="summary-value"><code>{structuredFolderName}/</code></span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Data source</span>
			<span class="summary-value">{dataChoice === 'demo' ? 'Demo Data' : 'Existing Ledger'}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Currency</span>
			<span class="summary-value currency">{operatingCurrency}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Transactions</span>
			<span class="summary-value">{fileOrganization === 'monthly' ? 'Monthly' : 'Yearly'} files</span>
		</div>
	</div>
</div>

<div class="next-steps">
	<h4>🚀 Next steps</h4>
	<ol>
		<li>Open the <strong>Finance Dashboard</strong> to explore your data</li>
		<li>Browse the 5 tabs: Overview, Transactions, Journal, Balance Sheet, Commodities</li>
		<li>Try BQL queries in your Markdown notes using <code>```bql</code> code blocks</li>
		{#if beanPriceValid}
			<li>Enable <strong>Automatic Price Fetching</strong> in Settings → General</li>
		{/if}
		<li>Manage commands anytime in <strong>Settings → Connection</strong></li>
	</ol>
</div>

<div class="action-row centered">
	<button on:click={onClose}>Close</button>
	<button class="mod-cta" on:click={onFinishAndOpenDashboard}>Open Dashboard</button>
</div>

<style>
	.success-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-4);
		color: var(--text-success);
	}

	.success-banner h3 {
		margin: 0;
		font-size: var(--font-ui-large);
		color: var(--text-success);
	}

	.success-icon {
		font-size: 28px;
	}

	.summary-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-left: 4px solid var(--text-success);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.summary-card h4 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.summary-grid {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		font-size: var(--font-ui-small);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.summary-row:last-child {
		border-bottom: none;
	}

	.summary-label {
		color: var(--text-muted);
		font-weight: 500;
	}

	.summary-value {
		color: var(--text-normal);
	}

	.summary-value code {
		background: var(--background-primary);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		font-size: 11px;
	}

	.summary-value.currency {
		color: var(--text-success);
		font-weight: 600;
	}

	.version-text {
		color: var(--text-success);
		font-weight: 600;
		font-size: var(--font-ui-smaller);
	}

	.next-steps {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.next-steps h4 {
		margin: 0 0 var(--size-4-2) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.next-steps ol {
		margin: 0;
		padding-left: var(--size-4-5);
		font-size: var(--font-ui-small);
		line-height: var(--line-height-normal);
	}

	.next-steps li {
		margin-bottom: var(--size-4-1);
	}

	.action-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.action-row.centered {
		justify-content: center;
		gap: var(--size-4-3);
	}
</style>
