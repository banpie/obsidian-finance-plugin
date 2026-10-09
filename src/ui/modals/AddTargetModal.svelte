<!-- src/ui/modals/AddTargetModal.svelte -->
<script lang="ts">
	import { tr } from "../../i18n";
	import { createEventDispatcher, onMount } from 'svelte';
	import { groupCurrencyOptions } from '../../utils';
	import { nativeDatePicker } from '../actions/nativeDatePicker';
	import { buildAccountQuery, parseAccountQuery } from '../../utils';
	import AccountQueryRow from './AccountQueryRow.svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let accounts: string[] = [];
	export let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP'];
	export let defaultCurrency: string = 'USD';
	export let editingIndicator: any = null;

	// Form state
	let name: string = '';
	let accountRows: string[] = [''];
	let cycle: 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly' = 'Monthly';
	let target: string = '';
	let currency: string = defaultCurrency;
	let isRollover: boolean = false;
	let startDate: string = new Date().toISOString().split('T')[0];
	let tag: string = '';
	let tagMode: 'has' | 'not_has' = 'has';

	// UI state
	let nameError: string = '';
	let accountError: string = '';
	let targetError: string = '';

	// Filtered asset accounts
	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));
	$: currencyGroups = groupCurrencyOptions(currencies, [defaultCurrency, editingIndicator?.currency]);

	function addAccountRow() {
		accountRows = [...accountRows, ''];
	}

	function removeAccountRow(index: number) {
		const next = accountRows.filter((_, i) => i !== index);
		accountRows = next.length > 0 ? next : [''];
	}

	onMount(() => {
		if (editingIndicator) {
			name = editingIndicator.name || '';
			accountRows = parseAccountQuery(editingIndicator.accountString || '');
			if (accountRows.length === 0) accountRows = [''];
			cycle = editingIndicator.period || 'Monthly';
			target = String(editingIndicator.targetAmount || '');
			currency = editingIndicator.currency || defaultCurrency;
			isRollover = editingIndicator.isRollOver || false;
			startDate = editingIndicator.startDate || new Date().toISOString().split('T')[0];
			tag = editingIndicator.tag || '';
			tagMode = editingIndicator.tagMode || 'has';
		} else {
			currency = defaultCurrency;
		}
	});

	function validate(): boolean {
		let valid = true;
		nameError = '';
		accountError = '';
		targetError = '';

		if (!name.trim()) {
			nameError = '请输入名称';
			valid = false;
		}
		if (!accountRows.some(r => r.trim())) {
			accountError = '请至少选择一个资产科目';
			valid = false;
		}
		const t = parseFloat(target);
		if (!target || isNaN(t) || t <= 0) {
			targetError = '请输入大于 0 的金额';
			valid = false;
		}
		return valid;
	}

	function handleSave() {
		if (!validate()) return;
		const cleanedAccounts = accountRows.map(r => r.trim()).filter(Boolean);
		dispatch('save', {
			name: name.trim(),
			accountQuery: buildAccountQuery(cleanedAccounts),
			cycle,
			target: parseFloat(target),
			currency,
			isRollover,
			startDate,
			tag: tag.trim() || undefined,
			tagMode: tag.trim() ? tagMode : undefined,
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="indicator-modal">
	<h2>{editingIndicator ? $tr("编辑目标") : $tr("新增目标")}</h2>

	<div class="form-grid">
		<div class="form-group full-width">
			<label for="target-name">{$tr("名称")} <span class="required">*</span></label>
			<input
				id="target-name"
				type="text"
				bind:value={name}
				placeholder={$tr("例如：应急基金")}
				class:error={nameError}
			/>
			{#if nameError}<span class="error-msg">{nameError}</span>{/if}
		</div>

		<div class="form-group full-width">
			<label for="target-account">{$tr("资产科目")} <span class="required">*</span></label>
			<div class="account-rows">
				{#each accountRows as row, i (i)}
					<AccountQueryRow
						bind:value={accountRows[i]}
						accounts={assetAccounts}
						showRemove={accountRows.length > 1}
						placeholder={$tr("例如：Assets:Savings")}
						hasError={!!accountError}
						on:remove={() => removeAccountRow(i)}
					/>
				{/each}
			</div>
			<button type="button" class="add-row-btn" on:click={addAccountRow}>{$tr("+ 添加科目")}</button>
			{#if accountError}<span class="error-msg">{accountError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="target-cycle">{$tr("周期")}</label>
			<select id="target-cycle" bind:value={cycle}>
				<option value="Monthly">{$tr("每月")}</option>
				<option value="Weekly">{$tr("每周")}</option>
				<option value="Quarterly">{$tr("每季度")}</option>
				<option value="Yearly">{$tr("每年")}</option>
			</select>
		</div>

		<div class="form-group">
			<label for="target-amount">{$tr("目标金额")} <span class="required">*</span></label>
			<input
				id="target-amount"
				type="number"
				min="0"
				step="0.01"
				bind:value={target}
				placeholder="0.00"
				class:error={targetError}
			/>
			{#if targetError}<span class="error-msg">{targetError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="target-currency">{$tr("货币")}</label>
			<select id="target-currency" bind:value={currency}>
				{#each currencyGroups as group}
					<optgroup label={$tr(group.label)}>
						{#each group.options as c}
							<option value={c}>{c}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>

		<div class="form-group rollover-row">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={isRollover} />
				{$tr("结转")}
			</label>
		</div>

		{#if isRollover}
			<div class="form-group full-width">
				<label for="target-start">{$tr("开始日期")}</label>
				<input id="target-start" type="date" bind:value={startDate} use:nativeDatePicker />
			</div>
		{/if}

		<div class="form-group full-width">
			<label for="target-tag">{$tr("标签")} <span class="optional">{$tr("（可选）")}</span></label>
			<div class="tag-row">
				<select id="target-tag-mode" bind:value={tagMode}>
					<option value="has">{$tr("包含标签")}</option>
					<option value="not_has">{$tr("不包含标签")}</option>
				</select>
				<input id="target-tag" type="text" bind:value={tag} placeholder={$tr("例如：savings")} />
			</div>
		</div>
	</div>

	<div class="modal-footer">
		<button class="cancel-btn" on:click={handleCancel}>{$tr("取消")}</button>
		<button class="save-btn" on:click={handleSave}>{editingIndicator ? $tr("保存修改") : $tr("保存目标")}</button>
	</div>
</div>

<style>
	.indicator-modal {
		padding: var(--size-4-4);
	}

	.indicator-modal h2 {
		margin: 0 0 var(--size-4-4);
		font-size: var(--font-ui-larger);
		color: var(--text-normal);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-3);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.required {
		color: var(--text-error);
	}

	input[type='text'],
	input[type='number'],
	input[type='date'],
	select {
		padding: var(--size-4-1) var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		width: 100%;
	}

	input.error,
	select.error {
		border-color: var(--text-error);
	}

	.error-msg {
		color: var(--text-error);
		font-size: var(--font-ui-smaller);
	}

	.account-rows {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.add-row-btn {
		align-self: flex-start;
		margin-top: var(--size-4-1);
		padding: 2px 0;
		background: transparent;
		border: none;
		box-shadow: none;
		color: var(--text-accent);
		cursor: pointer;
		font-size: var(--font-ui-smaller);
	}

	.add-row-btn:hover {
		text-decoration: underline;
	}

	.rollover-row {
		flex-direction: row;
		align-items: center;
		margin-top: auto;
		margin-bottom: auto;
		padding-top: var(--size-4-1);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.optional {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.tag-row {
		display: flex;
		gap: var(--size-4-2);
	}

	.tag-row select {
		flex-shrink: 0;
		width: auto;
	}

	.tag-row input {
		flex: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-2);
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.cancel-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn:hover {
		background: var(--interactive-accent-hover);
	}
</style>
