<!-- src/ui/modals/transaction-edit/NoteTabForm.svelte -->
<script lang="ts">
	import { nativeDatePicker } from "../../actions/nativeDatePicker";

	export let date: string;
	export let noteAccount: string;
	export let noteComment: string;
</script>

<div class="form-grid">
	<div class="form-group">
		<label for="note-date">Date *</label>
		<input
			type="date"
			id="note-date"
			bind:value={date}
			use:nativeDatePicker
			required
		/>
	</div>

	<div class="form-group">
		<label for="note-account">Account *</label>
		<input
			type="text"
			id="note-account"
			bind:value={noteAccount}
			list="accounts-list"
			placeholder="Account for the note"
			required
		/>
	</div>

	<div class="form-group full-width">
		<label for="note-comment">Comment *</label>
		<textarea
			id="note-comment"
			bind:value={noteComment}
			placeholder="Note content"
			required
			rows="3"
		></textarea>
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
</style>
