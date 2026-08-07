<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Notice } from 'obsidian'; // Ensure Notice is imported

	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let kpiError: string | null = null;
	export let fileStatus: "checking" | "ok" | "error" = "checking";
	export let fileStatusMessage: string | null = "";
	export let errorCount = 0;
	export let errorList: string[] = [];
	// Reconciliation props
	export let reconciliationOverdue = 0;
	export let reconciliationUpToDate = 0;
	export let reconciliationAccounts: Array<{
		account: string;
		reconcileDays: number;
		lastBalanceDate: string | null;
		daysSinceLastBalance: number | null;
		isOverdue: boolean;
	}> = [];
	export let activeTab: 'errors' | 'reconciliation' = 'errors';

	const dispatch = createEventDispatcher();

	function handleRefresh() {
		dispatch('refresh');
	}

	function handleStatusClick() {
		if (fileStatus === 'error' && fileStatusMessage) {
			new Notice(fileStatusMessage, 0); // Show persistent notice
		}
	}

	function switchTab(tab: 'errors' | 'reconciliation') {
		dispatch('tabChange', tab);
	}

	/** Shorten an account name for display: "Assets:Bank:Checking" → "Bank:Checking" */
	function shortAccount(account: string): string {
		const parts = account.split(':');
		return parts.length > 1 ? parts.slice(1).join(':') : account;
	}

</script>

<div class="beancount-header">
	<h2>Snapshot</h2>

	<div class="header-controls">
		<button
			type="button" class="beancount-status-button" class:status-ok={fileStatus === 'ok'}
			class:status-error={fileStatus === 'error'}
			on:click={handleStatusClick}
			title={fileStatus === 'error' ? 'Click to see error details' : 'File Status'}
			disabled={fileStatus === 'checking'} >
			{#if fileStatus === 'checking'}
				<span>Checking...</span>
			{:else if fileStatus === 'ok'}
				<span>✅ OK</span>
			{:else if fileStatus === 'error'}
				<span>❌ {errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
			{/if}
		</button>

		<button on:click={handleRefresh} disabled={isLoading} class="refresh-button">
			{#if isLoading}
				<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12a9 9 0 11-6.219-8.56"/>
				</svg>
				Refreshing...
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 013.5-7.1"/>
					<path d="M20.5 5.5a9 9 0 01.5 6.5"/>
					<path d="M3 12a9 9 0 016.5 8.1"/>
					<path d="M20.5 18.5a9 9 0 01-6.5-5.5"/>
				</svg>
				Refresh
			{/if}
		</button>
	</div>
</div>

<h4>Key Metrics</h4>
<div class="beancount-kpi-container">
	{#if kpiError}
		<div class="beancount-error-message">{kpiError}</div>
	{:else}
		<div class="kpi-metric">
			<span class="kpi-label">Net Worth</span>
			<span class="kpi-value net-worth">{netWorth}</span>
		</div>
		<div class="kpi-metric">
			<span class="kpi-label">Assets</span>
			<span class="kpi-value">{assets}</span>
		</div>
		<div class="kpi-metric">
			<span class="kpi-label">Liabilities</span>
			<span class="kpi-value">{liabilities}</span>
		</div>
	{/if}
</div>

{#if !kpiError}
	<div class="conversion-note">
		<span>Commodities without price data are excluded from totals</span>
	</div>
{/if}

<!-- Tabbed bottom section -->
<hr class="tab-separator">
<div class="tab-strip">
	<button
		class="tab-button"
		class:tab-active={activeTab === 'errors'}
		on:click={() => switchTab('errors')}
	>
		Errors
		{#if errorCount > 0}
			<span class="tab-badge tab-badge-error">{errorCount}</span>
		{/if}
	</button>
	<button
		class="tab-button"
		class:tab-active={activeTab === 'reconciliation'}
		on:click={() => switchTab('reconciliation')}
	>
		Reconciliation
		{#if reconciliationOverdue > 0}
			<span class="tab-badge tab-badge-warning">{reconciliationOverdue}</span>
		{/if}
	</button>
</div>

<!-- Tab content -->
{#if activeTab === 'errors'}
	{#if fileStatus === 'error' && errorList.length > 0}
		<div class="error-section">
			<div class="error-list">
				{#each errorList as error}
					<div class="error-item">
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/>
							<path d="m15 9-6 6"/>
							<path d="m9 9 6 6"/>
						</svg>
						<span class="error-text">{error}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="tab-empty-state">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
				<polyline points="22 4 12 14.01 9 11.01"/>
			</svg>
			<span>No errors</span>
		</div>
	{/if}
{:else if activeTab === 'reconciliation'}
	{#if reconciliationAccounts.length === 0}
		<div class="tab-empty-state">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="16" x2="12" y2="12"/>
				<line x1="12" y1="8" x2="12.01" y2="8"/>
			</svg>
			<span>No accounts configured for reconciliation.<br>Add <code>reconcile: 30</code> metadata to an open directive.</span>
		</div>
	{:else}
		<div class="reconciliation-section">
			<!-- Summary row -->
			<div class="reconciliation-summary">
				<div class="reconciliation-stat" class:stat-warning={reconciliationOverdue > 0}>
					<span class="stat-value">{reconciliationOverdue}</span>
					<span class="stat-label">Overdue</span>
				</div>
				<div class="reconciliation-stat stat-ok">
					<span class="stat-value">{reconciliationUpToDate}</span>
					<span class="stat-label">Up to date</span>
				</div>
			</div>

			<!-- Per-account list -->
			<div class="reconciliation-list">
				{#each reconciliationAccounts as acct}
					<div class="reconciliation-item" class:recon-overdue={acct.isOverdue}>
						<div class="recon-account-row">
							<span class="recon-indicator" class:indicator-overdue={acct.isOverdue} class:indicator-ok={!acct.isOverdue}></span>
							<span class="recon-account-name" title={acct.account}>{shortAccount(acct.account)}</span>
						</div>
						<div class="recon-detail-row">
							{#if acct.lastBalanceDate}
								<span class="recon-detail">
									{acct.daysSinceLastBalance}d ago
									<span class="recon-sep">·</span>
									every {acct.reconcileDays}d
								</span>
							{:else}
								<span class="recon-detail recon-never">Never reconciled</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	/* Styles adjusted slightly */
	.beancount-header {
		display: flex;
		justify-content: space-between; /* Space title and controls */
		align-items: center;
		padding-bottom: 10px;
		gap: 10px;
	}
	.beancount-header h2 {
		margin-right: 0; /* Let controls push right */
	}
	.header-controls { /* Wrapper for right-aligned controls */
		display: flex;
		align-items: center;
		gap: 8px; /* Consistent gap */
	}

	.beancount-status-button {
		font-size: inherit;
		padding: var(--size-4-1) var(--size-4-3);
		line-height: var(--line-height-normal);
		background-color: transparent;
		border: none;
		color: var(--text-muted);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		cursor: default;
	}
	.beancount-status-button.status-error { cursor: pointer; }
	.beancount-status-button:not(.status-error):hover { background-color: transparent; }
	.beancount-status-button span { font-weight: 500; }
	.beancount-status-button.status-ok span { color: var(--text-success); }
	.beancount-status-button.status-error span { color: var(--text-error); }

	/* Refresh button and loading spinner */
	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.loading-spinner {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* --- KPI Styles --- */
	.beancount-kpi-container { 
		display: grid; 
		grid-template-columns: 1fr 1fr; 
		gap: 10px; 
		margin-bottom: 15px; 
	}
	.kpi-metric { 
		display: flex; 
		flex-direction: column; 
		padding: 10px 12px; 
		background-color: var(--background-secondary); 
		border-radius: 6px; 
		border: 1px solid var(--background-modifier-border); 
	}
	.kpi-label { 
		font-size: var(--font-ui-small); 
		color: var(--text-muted); 
		margin-bottom: 4px; 
	}
	.kpi-value { 
		font-size: 1.25em; 
		font-weight: 600; 
	}
	.net-worth { 
		font-size: 1.4em; 
		color: var(--text-accent); 
	}
	.kpi-metric:first-child { 
		grid-column: 1 / -1; 
	}
	
	/* --- Error Message Styles --- */
	.beancount-error-message { 
		color: var(--text-error); 
		font-size: var(--font-ui-small); 
		padding: 10px; 
		background-color: var(--background-secondary-alt); 
		border-radius: 6px; 
		border: 1px solid var(--background-modifier-border); 
		grid-column: 1 / -1; 
		word-break: break-all; 
		white-space: pre-wrap; 
	}

	/* --- Conversion Note Styles --- */
	.conversion-note {
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
		margin-top: 6px;
		text-align: center;
	}

	/* --- Tab Strip Styles --- */
	.tab-separator {
		border: none;
		border-top: 1px solid var(--background-modifier-border);
		margin: 15px 0 0 0;
	}

	.tab-strip {
		display: flex;
		gap: 0;
		margin-bottom: 10px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.tab-button {
		flex: 1;
		padding: 8px 12px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.tab-button:hover {
		color: var(--text-normal);
		background: none;
		box-shadow: none;
	}

	.tab-button.tab-active {
		color: var(--text-accent);
		border-bottom-color: var(--text-accent);
	}

	.tab-badge {
		font-size: 0.75em;
		padding: 1px 6px;
		border-radius: 10px;
		font-weight: 600;
		line-height: 1.4;
	}

	.tab-badge-error {
		background-color: var(--background-modifier-error);
		color: var(--text-on-accent);
	}

	.tab-badge-warning {
		background-color: var(--color-orange);
		color: var(--text-on-accent);
	}

	/* --- Tab Empty State --- */
	.tab-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px 10px;
		color: var(--text-faint);
		font-size: var(--font-ui-small);
		text-align: center;
	}

	.tab-empty-state code {
		font-size: 0.9em;
		background-color: var(--background-secondary);
		padding: 1px 4px;
		border-radius: 3px;
	}

	/* --- Error Section Styles --- */
	.error-section {
		margin-top: 0;
	}
	
	.error-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	
	.error-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 6px 8px;
		background-color: var(--background-secondary);
		border-radius: 4px;
		border-left: 3px solid var(--text-error);
	}
	
	.error-item svg {
		flex-shrink: 0;
		color: var(--text-error);
		margin-top: 2px;
	}
	
	.error-text {
		font-size: var(--font-ui-small);
		color: var(--text-normal);
		line-height: 1.4;
		word-break: break-all;
		font-family: var(--font-monospace);
	}

	/* --- Reconciliation Section Styles --- */
	.reconciliation-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.reconciliation-summary {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.reconciliation-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px 8px;
		background-color: var(--background-secondary);
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
	}

	.reconciliation-stat.stat-warning {
		border-color: var(--color-orange);
	}

	.reconciliation-stat.stat-ok {
		border-color: var(--color-green);
	}

	.stat-value {
		font-size: 1.4em;
		font-weight: 700;
	}

	.stat-warning .stat-value {
		color: var(--color-orange);
	}

	.stat-ok .stat-value {
		color: var(--color-green);
	}

	.stat-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-top: 2px;
	}

	.reconciliation-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.reconciliation-item {
		padding: 6px 8px;
		background-color: var(--background-secondary);
		border-radius: 4px;
		border-left: 3px solid var(--color-green);
	}

	.reconciliation-item.recon-overdue {
		border-left-color: var(--color-orange);
	}

	.recon-account-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.recon-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.recon-indicator.indicator-ok {
		background-color: var(--color-green);
	}

	.recon-indicator.indicator-overdue {
		background-color: var(--color-orange);
	}

	.recon-account-name {
		font-size: var(--font-ui-small);
		font-weight: 500;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recon-detail-row {
		margin-left: 12px; /* align with text after indicator dot */
		margin-top: 1px;
	}

	.recon-detail {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.recon-sep {
		margin: 0 3px;
		color: var(--text-faint);
	}

	.recon-never {
		color: var(--color-orange);
		font-style: italic;
	}
</style>