import { describe, it, expect, vi } from 'vitest';
import { getReconciliationStatus, computeReconciliationStatus } from '../src/services/reconciliation.service';
import type BeancountPlugin from '../src/main';

vi.mock('../src/utils/queryRunner', () => ({
	runQuery: vi.fn((_plugin: unknown, query: string) => {
		if (query.includes('reconcile_days')) {
			return Promise.resolve('account,reconcile_days\nAssets:Checking,30\n');
		}
		if (query.includes('last_balance_date')) {
			// Last PASSING balance was 10 days ago — well within the 30-day window.
			return Promise.resolve(`account,last_balance_date\nAssets:Checking,${daysAgo(10)}\n`);
		}
		if (query.includes('last_discrepancy')) {
			// But the account's MOST RECENT assertion (today) is failing.
			return Promise.resolve(`account,last_date,last_discrepancy\nAssets:Checking,${daysAgo(0)},-50.00 USD\n`);
		}
		throw new Error(`Unexpected query: ${query}`);
	}),
}));

function daysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().split('T')[0];
}

describe('computeReconciliationStatus', () => {
	it('is overdue when never reconciled', () => {
		expect(computeReconciliationStatus(30, null)).toEqual({ daysSinceLastBalance: null, isOverdue: true });
	});

	it('is not overdue within the interval', () => {
		const { isOverdue } = computeReconciliationStatus(30, daysAgo(10));
		expect(isOverdue).toBe(false);
	});

	it('is overdue past the interval', () => {
		const { isOverdue } = computeReconciliationStatus(30, daysAgo(40));
		expect(isOverdue).toBe(true);
	});
});

describe('getReconciliationStatus (#272 regression)', () => {
	it('treats an account with a currently-failing assertion as needing attention, even if an older passing balance is still within the interval window', async () => {
		const plugin = {} as BeancountPlugin;
		const status = await getReconciliationStatus(plugin);

		expect(status.accounts).toHaveLength(1);
		const acct = status.accounts[0];

		expect(acct.isFailing).toBe(true);
		// This is the actual bug: a failing assertion must never be reported as
		// "up to date" just because an older passing balance is still in-window.
		expect(acct.isOverdue).toBe(true);
		expect(status.overdueCount).toBe(1);
		expect(status.upToDateCount).toBe(0);
	});
});
