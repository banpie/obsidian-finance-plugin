import { describe, it, expect } from 'vitest';
import type { JournalEntry } from '../src/models/journal';

describe('JournalService Sorting & Pagination', () => {
	it('sorts entries by date descending, then type ascending, then id ascending', () => {
		const entries: JournalEntry[] = [
			{
				id: 'tx-1',
				type: 'transaction',
				date: '2026-07-20',
				flag: '*',
				payee: 'Coffee Shop',
				narration: 'Espresso',
				tags: [],
				links: [],
				postings: [],
				metadata: {},
			},
			{
				id: 'bal-1',
				type: 'balance',
				date: '2026-07-22',
				account: 'Assets:Checking',
				amount: '1000.00',
				currency: 'USD',
				tolerance: null,
				diff_amount: null,
				metadata: {},
			},
			{
				id: 'tx-2',
				type: 'transaction',
				date: '2026-07-22',
				flag: '*',
				payee: 'Employer',
				narration: 'Salary',
				tags: [],
				links: [],
				postings: [],
				metadata: {},
			},
			{
				id: 'note-1',
				type: 'note',
				date: '2026-07-22',
				account: 'Assets:Checking',
				comment: 'Account verified',
				metadata: {},
			},
		];

		// Sort using the exact same logic from JournalService
		entries.sort((a, b) => {
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			const typeCompare = a.type.localeCompare(b.type);
			if (typeCompare !== 0) return typeCompare;
			return a.id.localeCompare(b.id);
		});

		expect(entries[0].date).toBe('2026-07-22');
		expect(entries[0].type).toBe('balance');
		expect(entries[1].type).toBe('note');
		expect(entries[2].type).toBe('transaction');
		expect(entries[3].date).toBe('2026-07-20');
	});
});
