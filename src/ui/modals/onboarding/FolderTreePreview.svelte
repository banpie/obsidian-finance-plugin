<!-- src/ui/modals/onboarding/FolderTreePreview.svelte -->
<script lang="ts">
	export let structuredFolderName = 'Finances';
	export let fileOrganization: 'yearly' | 'monthly' = 'yearly';
</script>

<div class="folder-preview">
	<div class="folder-preview-header">
		<span>Folder structure preview</span>
		<span class="preview-badge">{fileOrganization === 'monthly' ? 'Monthly' : 'Yearly'} layout</span>
	</div>
	<div class="tree-container">
		<div class="tree-item folder-root">
			<span class="tree-icon">📁</span>
			<span class="tree-name">{structuredFolderName}/</span>
		</div>
		<div class="tree-children">
			<div class="tree-item"><span class="tree-icon">📄</span><span class="tree-name">ledger.beancount</span> <span class="tree-desc">master include file</span></div>
			<div class="tree-item"><span class="tree-icon">📄</span><span class="tree-name">accounts.beancount</span> <span class="tree-desc">chart of accounts</span></div>
			<div class="tree-item"><span class="tree-icon">📄</span><span class="tree-name">commodities.beancount</span> <span class="tree-desc">currencies & commodities</span></div>
			<div class="tree-item"><span class="tree-icon">📄</span><span class="tree-name">prices.beancount</span> <span class="tree-desc">price history</span></div>
			<div class="tree-item folder-sub">
				<span class="tree-icon">📁</span>
				<span class="tree-name">transactions/</span>
			</div>
			<div class="tree-children sub-children">
				{#if fileOrganization === 'monthly'}
					<div class="tree-item folder-sub"><span class="tree-icon">📁</span><span class="tree-name">2026/</span></div>
					<div class="tree-children nested-children">
						<div class="tree-item"><span class="tree-icon">📊</span><span class="tree-name">2026-01.beancount</span></div>
						<div class="tree-item"><span class="tree-icon">📊</span><span class="tree-name">2026-02.beancount</span></div>
						<div class="tree-item muted"><span class="tree-icon">…</span><span class="tree-name">monthly transaction files</span></div>
					</div>
				{:else}
					<div class="tree-item"><span class="tree-icon">📊</span><span class="tree-name">2026.beancount</span></div>
					<div class="tree-item muted"><span class="tree-icon">…</span><span class="tree-name">yearly transaction files</span></div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.folder-preview {
		margin-top: var(--size-4-3);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.folder-preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-2);
		font-weight: 600;
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}

	.preview-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-s);
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.1);
		color: var(--text-accent);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tree-container {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-3);
		font-family: var(--font-monospace);
		font-size: 12px;
		line-height: 1.6;
	}

	.tree-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}

	.tree-item.muted {
		color: var(--text-faint);
		font-style: italic;
		font-size: 11px;
	}

	.tree-children {
		padding-left: 18px;
		border-left: 1px dashed var(--background-modifier-border);
		margin-left: 8px;
	}

	.tree-name {
		font-weight: 500;
		color: var(--text-normal);
	}

	.tree-desc {
		font-size: 10px;
		color: var(--text-faint);
		margin-left: 6px;
	}

	.folder-root > .tree-name {
		color: var(--text-accent);
		font-weight: 600;
	}

	.folder-sub > .tree-name {
		color: var(--text-normal);
		font-weight: 600;
	}
</style>
