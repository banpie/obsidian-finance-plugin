<!-- src/ui/modals/AddScheduleModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { nativeDatePicker } from '../actions/nativeDatePicker';
	import PostingRow from './transaction-edit/PostingRow.svelte';
	import TagLinkInput from './transaction-edit/TagLinkInput.svelte';
	import type { JournalPosting } from '../../models/journal';

	const dispatch = createEventDispatcher();

	// Props
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP'];
	export let defaultCurrency: string = 'USD';
	export let editingSchedule: any = null;

	function blankPosting(): JournalPosting {
		return { account: '', amount: '', currency: defaultCurrency, flag: null, comment: null, metadata: {} };
	}

	// Form state
	let name: string = '';
	let frequency: 'One-time' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' = 'Monthly';
	let startDate: string = new Date().toISOString().split('T')[0];
	let payee: string = '';
	let narration: string = '';
	let flag: '*' | '!' = '*';
	let selectedTags: string[] = [];
	let selectedLinks: string[] = [];
	let postings: JournalPosting[] = [blankPosting(), blankPosting()];

	// UI state
	let nameError: string = '';
	let postingsError: string = '';

	onMount(() => {
		if (editingSchedule) {
			name = editingSchedule.name || '';
			frequency = editingSchedule.frequency || 'Monthly';
			startDate = editingSchedule.startDate || new Date().toISOString().split('T')[0];
			payee = editingSchedule.payee || '';
			narration = editingSchedule.narration || '';
			flag = editingSchedule.flag === '!' ? '!' : '*';
			selectedTags = [...(editingSchedule.tags || [])];
			selectedLinks = [...(editingSchedule.links || [])];
			if (editingSchedule.postings && editingSchedule.postings.length > 0) {
				postings = editingSchedule.postings.map((p: any) => ({
					account: p.account,
					amount: p.amount === undefined || p.amount === null ? '' : String(p.amount),
					currency: p.currency || defaultCurrency,
					flag: null,
					comment: null,
					metadata: {},
				}));
			}
		}
	});

	function addPosting() {
		postings = [...postings, blankPosting()];
	}

	function removePosting(index: number) {
		if (postings.length <= 2) return;
		postings = postings.filter((_, i) => i !== index);
	}

	// A posting's amount is blank/elided when left empty — beancount infers it
	// so the transaction balances. At most ONE posting per schedule may be
	// blank (beancount can't infer two unknowns at once).
	function isBlank(p: JournalPosting): boolean {
		return p.amount === null || p.amount === undefined || String(p.amount).trim() === '';
	}

	function validate(): boolean {
		let valid = true;
		nameError = '';
		postingsError = '';

		if (!name.trim()) {
			nameError = 'Name is required';
			valid = false;
		}
		if (postings.length < 2) {
			postingsError = 'At least two postings are required';
			valid = false;
		}

		let blankCount = 0;
		for (const p of postings) {
			if (!p.account || !p.account.trim()) {
				postingsError = 'Every posting needs an account';
				valid = false;
			}
			if (isBlank(p)) {
				blankCount++;
			} else {
				if (isNaN(Number(p.amount))) {
					postingsError = 'Posting amounts must be numbers';
					valid = false;
				}
				if (!p.currency || !p.currency.trim()) {
					postingsError = 'A posting with an amount needs a currency';
					valid = false;
				}
			}
		}
		if (blankCount > 1) {
			postingsError = 'Only one posting may be left blank to auto-balance';
			valid = false;
		}
		return valid;
	}

	function handleSave() {
		if (!validate()) return;
		dispatch('save', {
			name: name.trim(),
			frequency,
			startDate,
			payee: payee.trim() || undefined,
			narration: narration.trim() || undefined,
			flag,
			tags: selectedTags,
			links: selectedLinks,
			postings: postings.map((p) => isBlank(p)
				? { account: p.account.trim(), amount: undefined, currency: undefined }
				: { account: p.account.trim(), amount: Number(p.amount), currency: (p.currency || defaultCurrency).trim() }
			),
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="schedule-modal">
	<h2>{editingSchedule ? 'Edit Scheduled Transaction' : 'Add Scheduled Transaction'}</h2>

	<div class="form-grid">
		<div class="form-group full-width">
			<label for="schedule-name">Name <span class="required">*</span></label>
			<input
				id="schedule-name"
				type="text"
				bind:value={name}
				placeholder="e.g. Rent Payment"
				class:error={nameError}
			/>
			{#if nameError}<span class="error-msg">{nameError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="schedule-frequency">Frequency</label>
			<select id="schedule-frequency" bind:value={frequency}>
				<option value="One-time">One-time</option>
				<option value="Weekly">Weekly</option>
				<option value="Monthly">Monthly</option>
				<option value="Quarterly">Quarterly</option>
				<option value="Yearly">Yearly</option>
			</select>
		</div>

		<div class="form-group">
			<label for="schedule-start">{frequency === 'One-time' ? 'Date' : 'Start Date'}</label>
			<input id="schedule-start" type="date" bind:value={startDate} use:nativeDatePicker />
		</div>

		<div class="form-group">
			<label for="schedule-payee">Payee</label>
			<input id="schedule-payee" type="text" bind:value={payee} list="payees-list" placeholder="e.g. Landlord" />
			<datalist id="payees-list">
				{#each payees as p}<option value={p} />{/each}
			</datalist>
		</div>

		<div class="form-group">
			<label for="schedule-narration">Narration</label>
			<input id="schedule-narration" type="text" bind:value={narration} placeholder="e.g. Monthly rent" />
		</div>
	</div>

	<div class="postings-section">
		<div class="postings-header">
			<h3>Postings</h3>
			<button type="button" class="add-posting-btn" on:click={addPosting}>+ Add Posting</button>
		</div>
		{#if postingsError}<span class="error-msg">{postingsError}</span>{/if}
		<datalist id="accounts-list">
			{#each accounts as acc}<option value={acc} />{/each}
		</datalist>
		<datalist id="currencies-list">
			{#each currencies as c}<option value={c} />{/each}
		</datalist>
		{#each postings as posting, index (index)}
			<PostingRow
				{posting}
				{index}
				totalPostings={postings.length}
				date={startDate}
				operatingCurrency={defaultCurrency}
				showCost={false}
				showPrice={false}
				showPostingFlag={false}
				showPostingComment={false}
				showPostingMetadata={false}
				onToggleCost={() => {}}
				onTogglePrice={() => {}}
				onToggleFlag={() => {}}
				onToggleComment={() => {}}
				onToggleMetadata={() => {}}
				onRemovePosting={removePosting}
				onAddMetadata={() => {}}
				onRemoveMetadata={() => {}}
				onUpdateMetadataKey={() => {}}
			/>
		{/each}
	</div>

	<div class="tags-links-wrapper">
		<TagLinkInput bind:selectedTags bind:selectedLinks tags={[]} />
	</div>

	<div class="modal-footer">
		<button class="cancel-btn" on:click={handleCancel}>Cancel</button>
		<button class="save-btn" on:click={handleSave}>{editingSchedule ? 'Save Changes' : 'Save Schedule'}</button>
	</div>
</div>

<style>
	.schedule-modal {
		padding: var(--size-4-6) var(--size-4-6) var(--size-4-5);
		max-height: 82vh;
		overflow-y: auto;
	}

	.schedule-modal h2 {
		margin: 0 0 var(--size-4-6);
		font-size: var(--font-ui-larger);
		color: var(--text-normal);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-4) var(--size-4-5);
		margin-bottom: var(--size-4-5);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.required { color: var(--text-error); }

	input[type='text'],
	input[type='date'],
	select {
		padding: var(--size-4-2) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		width: 100%;
		box-sizing: border-box;
		min-height: 36px;
	}

	input.error { border-color: var(--text-error); }

	.error-msg {
		color: var(--text-error);
		font-size: var(--font-ui-smaller);
	}

	.postings-section {
		margin-top: var(--size-4-5);
		padding-top: var(--size-4-5);
		border-top: 1px solid var(--background-modifier-border);
	}

	.postings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-3);
	}

	.postings-header h3 {
		margin: 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.add-posting-btn {
		font-size: var(--font-ui-small);
		background: transparent;
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 5px 14px;
		color: var(--text-accent);
		cursor: pointer;
	}

	/* Extra breathing room around the shared PostingRow component's own
	   (scoped-elsewhere) markup, without modifying that shared component. */
	:global(.schedule-modal .posting-container) {
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-3);
	}

	:global(.schedule-modal .posting-row) {
		gap: var(--size-4-3);
	}

	.tags-links-wrapper {
		margin-top: var(--size-4-3);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-3);
		margin-top: var(--size-4-5);
		padding-top: var(--size-4-4);
		border-top: 1px solid var(--background-modifier-border);
	}

	.cancel-btn {
		padding: var(--size-4-2) var(--size-4-5);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn {
		padding: var(--size-4-2) var(--size-4-5);
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn:hover { background: var(--interactive-accent-hover); }
</style>
