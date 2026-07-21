<!-- src/ui/modals/onboarding/StepOrganize.svelte -->
<script lang="ts">
	import FolderTreePreview from './FolderTreePreview.svelte';

	export let beanQueryValid = false;
	export let dataChoice: 'demo' | 'existing' | null = 'demo';
	export let beancountFiles: string[] = [];
	export let existingFilePath = '';
	export let structuredFolderName = 'Finances';
	export let fileOrganization: 'yearly' | 'monthly' = 'yearly';
	export let operatingCurrency = 'USD';
	export let folderNameError = '';
	export let isFolderNameValid = true;
	export let isSubmitting = false;

	export let onSelectDataChoice: (choice: 'demo' | 'existing') => void;
	export let onBack: () => void;
	export let onCancel: () => void;
	export let onSubmit: () => void;
</script>

<p class="step-description">
	Choose how to start and configure your folder layout. All your finance files will be organized in a single folder.
</p>

{#if !beanQueryValid}
	<div class="onboarding-warning-callout">
		<strong>⚠️ bean-query not configured</strong> — Dashboard features won't work until it's set up in Settings → Connection.
		You can still create the folder structure with demo data now.
	</div>
{/if}

<!-- Data choice cards -->
<div class="setup-cards-grid">
	<div
		class="setup-card"
		class:is-selected={dataChoice === 'demo'}
		role="button"
		tabindex="0"
		on:click={() => onSelectDataChoice('demo')}
		on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectDataChoice('demo'); }}
	>
		<div class="card-badge">✨ Recommended for beginners</div>
		<div class="card-icon">📊</div>
		<h4>Start with Demo Data</h4>
		<p>A complete sample ledger with realistic accounts and transactions so you can explore the dashboard immediately.</p>
	</div>

	<div
		class="setup-card"
		class:is-selected={dataChoice === 'existing'}
		class:is-disabled={!beanQueryValid}
		role="button"
		tabindex={beanQueryValid ? 0 : -1}
		on:click={() => onSelectDataChoice('existing')}
		on:keydown={(e) => { if (beanQueryValid && (e.key === 'Enter' || e.key === ' ')) onSelectDataChoice('existing'); }}
	>
		<div class="card-icon">📁</div>
		<h4>Use My Existing Ledger</h4>
		<p>Select your existing Beancount file to migrate it into the structured folder layout.</p>
		{#if !beanQueryValid}
			<div class="card-disabled-hint">Requires bean-query</div>
		{/if}
	</div>
</div>

<!-- Config form -->
{#if dataChoice}
	<div class="setup-form">
		{#if dataChoice === 'existing'}
			<div class="setting-item">
				<div class="setting-item-info">
					<div class="setting-item-name">Select Beancount file</div>
					<div class="setting-item-description">
						{#if beancountFiles.length > 0}
							Choose your existing Beancount file from your vault
						{:else}
							No <code>.beancount</code> files were found in your vault
						{/if}
					</div>
				</div>
				<div class="setting-item-control">
					{#if beancountFiles.length > 0}
						<select bind:value={existingFilePath}>
							{#each beancountFiles as file}
								<option value={file}>{file}</option>
							{/each}
						</select>
					{:else}
						<span class="no-files-badge">No files found</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Structured Folder Name -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Folder name</div>
				<div class="setting-item-description">Folder in your vault where organized finance files will live</div>
			</div>
			<div class="setting-item-control">
				<input type="text" bind:value={structuredFolderName} placeholder="Finances" class:is-invalid={!isFolderNameValid} />
			</div>
			{#if folderNameError}
				<div class="validation-error">{folderNameError}</div>
			{/if}
		</div>

		<!-- Transaction File Period -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Transaction file period</div>
				<div class="setting-item-description">How transaction files are organized inside the folder</div>
			</div>
			<div class="setting-item-control">
				<select bind:value={fileOrganization}>
					<option value="yearly">Yearly (e.g. 2026.beancount)</option>
					<option value="monthly">Monthly (e.g. 2026/2026-07.beancount)</option>
				</select>
			</div>
		</div>

		<!-- Operating Currency -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Operating currency</div>
				<div class="setting-item-description">Primary currency for your financial records</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					bind:value={operatingCurrency}
					placeholder="USD"
					disabled={dataChoice === 'demo'}
					on:input={() => operatingCurrency = operatingCurrency.toUpperCase()}
				/>
			</div>
		</div>

		{#if dataChoice === 'demo'}
			<p class="currency-hint">
				💡 Demo data uses USD. You can change the currency later in Settings.
			</p>
		{/if}

		<!-- Live folder tree preview -->
		<FolderTreePreview {structuredFolderName} {fileOrganization} />
	</div>
{/if}

<!-- Action buttons -->
<div class="action-row">
	<button on:click={onBack}>← Back</button>
	<div class="action-buttons">
		<button class="mod-warning" on:click={onCancel}>Cancel</button>
		<button
			class="mod-cta"
			on:click={onSubmit}
			disabled={isSubmitting || !dataChoice || !isFolderNameValid || (dataChoice === 'existing' && beancountFiles.length === 0)}
		>
			{isSubmitting ? '⏳ Setting up…' : '🚀 Set Up'}
		</button>
	</div>
</div>

<style>
	.step-description {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		margin: 0 0 var(--size-4-4) 0;
		line-height: var(--line-height-normal);
	}

	.onboarding-warning-callout {
		background: rgba(255, 165, 0, 0.1);
		border-left: 4px solid var(--text-warning);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
		margin-bottom: var(--size-4-4);
		font-size: var(--font-ui-small);
		color: var(--text-normal);
		line-height: var(--line-height-normal);
	}

	.setup-cards-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-4);
		margin-top: var(--size-4-3);
		margin-bottom: var(--size-4-4);
	}

	.setup-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-l);
		padding: var(--size-4-4);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		position: relative;
		transition: all 0.2s ease-in-out;
		font-family: inherit;
		box-shadow: none;
		box-sizing: border-box;
		user-select: none;
	}

	.setup-card:hover:not(.is-disabled) {
		border-color: var(--interactive-accent);
		transform: translateY(-2px);
		background: var(--background-secondary-alt);
	}

	.setup-card:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.setup-card.is-selected {
		border-color: var(--interactive-accent);
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.05);
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}

	.setup-card.is-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		border-style: dashed;
	}

	.setup-card.is-disabled:hover {
		transform: none;
		border-color: var(--background-modifier-border);
		background: var(--background-secondary);
	}

	.card-disabled-hint {
		margin-top: var(--size-4-2);
		font-size: var(--font-ui-smaller);
		color: var(--text-error);
		font-weight: 500;
	}

	.card-badge {
		position: absolute;
		top: -10px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-size: 9px;
		font-weight: bold;
		padding: 2px 8px;
		border-radius: 10px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.card-icon {
		font-size: 32px;
		margin-bottom: var(--size-4-2);
	}

	.setup-card h4 {
		margin: 0 0 var(--size-4-1) 0;
		color: var(--text-normal);
		font-size: var(--font-ui-medium);
	}

	.setup-card p {
		margin: 0;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		line-height: var(--line-height-normal);
		white-space: normal;
	}

	.setup-form {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.setting-item {
		border-top: none;
		border-bottom: 1px solid var(--background-modifier-border);
		padding: var(--size-4-3) 0;
	}

	.setting-item:last-of-type {
		border-bottom: none;
	}

	.setting-item-name {
		font-weight: 500;
	}

	input[type='text'], select {
		width: 100%;
		max-width: 220px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
	}

	input[type='text']:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: var(--background-secondary-alt);
		border-color: var(--background-modifier-border);
	}

	.no-files-badge {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		background: var(--background-primary);
		padding: 4px 10px;
		border-radius: var(--radius-s);
		border: 1px dashed var(--background-modifier-border);
	}

	input[type='text']:focus, select:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.setup-link {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 0;
		font-family: inherit;
		color: var(--text-accent);
		cursor: pointer;
		text-decoration: underline;
		display: inline;
	}

	.setup-link:hover {
		color: var(--text-accent-hover);
	}

	.validation-error {
		color: var(--text-error);
		font-size: var(--font-ui-smaller);
		margin-top: var(--size-4-1);
		font-weight: 500;
	}

	input[type='text'].is-invalid {
		border-color: var(--text-error);
	}

	.currency-hint {
		margin: var(--size-4-2) 0 0 0;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-style: italic;
	}

	.action-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.action-buttons {
		display: flex;
		gap: var(--size-4-2);
	}
</style>
