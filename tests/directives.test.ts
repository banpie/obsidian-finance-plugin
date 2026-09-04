import { describe, it, expect } from 'vitest';
import { generateTransactionText } from '../src/utils/directives/transactionDirectives';
import { parseQueryDirectives } from '../src/utils/directives/queryDirectives';
import type { TransactionData } from '../src/utils/directives/types';

describe('Transaction Directives', () => {
	it('formats a basic transaction with payee, narration, and postings', () => {
		const txData: TransactionData = {
			date: '2026-07-22',
			flag: '*',
			payee: 'Grocery Store',
			narration: 'Weekly groceries',
			tags: ['groceries', 'food'],
			links: ['receipt-123'],
			postings: [
				{
					account: 'Expenses:Food:Groceries',
					amount: '120.50',
					currency: 'USD',
				},
				{
					account: 'Assets:Checking',
					amount: '-120.50',
					currency: 'USD',
				},
			],
		};

		const result = generateTransactionText(txData, '\n');
		expect(result).toContain('2026-07-22 * "Grocery Store" "Weekly groceries" #groceries #food ^receipt-123');
		expect(result).toContain('  Expenses:Food:Groceries  120.50 USD');
		expect(result).toContain('  Assets:Checking  -120.50 USD');
	});

	it('handles postings with cost and price', () => {
		const txData: TransactionData = {
			date: '2026-07-22',
			flag: '*',
			payee: 'Brokerage',
			narration: 'Buy AAPL stock',
			postings: [
				{
					account: 'Assets:Investments:AAPL',
					amount: '10',
					currency: 'AAPL',
					cost: {
						number: '150.00',
						currency: 'USD',
						isTotal: false,
					},
					price: {
						amount: '150.00',
						currency: 'USD',
						isTotal: false,
					},
				},
				{
					account: 'Assets:Cash',
					amount: '-1500.00',
					currency: 'USD',
				},
			],
		};

		const result = generateTransactionText(txData, '\n');
		expect(result).toContain('{150.00 USD}');
		expect(result).toContain('@ 150.00 USD');
	});
});

describe('Query Directives', () => {
	it('parses named query directives correctly', () => {
		const fileContent = `
;; Named Queries
2026-01-01 query "monthly_expenses" "SELECT account, sum(position) WHERE account ~ 'Expenses' GROUP BY account"
2026-01-01 query "net_worth" "SELECT sum(position) WHERE account ~ 'Assets|Liabilities'"
`;

		const queries = parseQueryDirectives(fileContent);
		expect(queries['monthly_expenses']).toBe("SELECT account, sum(position) WHERE account ~ 'Expenses' GROUP BY account");
		expect(queries['net_worth']).toBe("SELECT sum(position) WHERE account ~ 'Assets|Liabilities'");
	});
});
