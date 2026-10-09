import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type BeancountPlugin from '../src/main';
import { ReportsController } from '../src/controllers/ReportsController';
import * as queries from '../src/queries';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

describe('ReportsController', () => {
    it('normalizes expense detail purchases and refunds without flipping already signed income', async () => {
        const runQuery = vi.fn(async (query: string) => {
            if (query === queries.getPeriodExpenseTransactionsQuery('CNY', 2, '2026-09-01', '2026-10-01')) return 'date,payee,narration,account,amount\n2026-09-01,Shop,Purchase,Expenses:Charging,25\n2026-09-08,Shop,Refund,Expenses:Charging,-5\n';
            if (query === queries.getPeriodIncomeTransactionsQuery('CNY', 2, '2026-09-01', '2026-10-01')) return 'date,payee,narration,account,amount\n2026-09-01,Tenant,Rent,Income:Rental,2400\n2026-09-08,Tenant,Return,Income:Rental,-600\n';
            return 'value\n0\n';
        });
        const plugin = {
            settings: { activeLedgerProfileId: 'personal', operatingCurrency: 'CNY' },
            getActiveLedgerProfile: () => ({ reportingMode: 'personal' }),
            app: { vault: { adapter: { read: vi.fn().mockResolvedValue('') } } }, runQuery,
        } as unknown as BeancountPlugin;
        const controller = new ReportsController(plugin);
        await controller.loadData('month', 2026, 9, 'custom-month');
        const state = get(controller.state);
        expect(state.error).toBeNull();
        expect(state.expenseTransactions.map(row => row.amount)).toEqual([-25, 5]);
        expect(state.incomeTransactions.map(row => row.amount)).toEqual([2400, -600]);
    });

    it('retains reverse asset and liability balances in the period detail rows', async () => {
        const end = '2026-10-01', valuation = '2026-09-30';
        const runQuery = vi.fn(async (query: string) => {
            if (query === queries.getAssetAllocationQuery('CNY', 2, end, valuation)) return 'account,amount\nAssets:Cash:Wallet,100\nAssets:Loans:Receivable,-20\n';
            if (query === queries.getLiabilityAllocationQuery('CNY', 2, end, valuation)) return 'account,amount\nLiabilities:Card:A,100\nLiabilities:Card:Prepaid,-5\n';
            return 'value\n0\n';
        });
        const plugin = {
            settings: { activeLedgerProfileId: 'personal', operatingCurrency: 'CNY', investmentGainLossColors: 'international' },
            getActiveLedgerProfile: () => ({ reportingMode: 'personal' }),
            app: { vault: { adapter: { read: vi.fn().mockResolvedValue('') } } },
            runQuery,
        } as unknown as BeancountPlugin;
        const controller = new ReportsController(plugin);
        await controller.loadData('month', 2026, 9, 'custom-month');
        const state = get(controller.state);
        expect(state.error).toBeNull();
        expect(state.assetsByAccount.map(row => row.amount)).toEqual([100, -20]);
        expect(state.assetsByCategory.reduce((sum, row) => sum + row.amount, 0)).toBe(80);
        expect(state.liabilitiesByAccount.map(row => row.amount)).toEqual([100, -5]);
    });

	it('keeps the latest selected period when an earlier profile load finishes later', async () => {
		const firstResult = deferred<string>();
		let useFirstBatch = true;
		const settings = {
			activeLedgerProfileId: 'corporate',
			operatingCurrency: 'CNY',
			investmentGainLossColors: 'china',
			structuredFolderName: 'ledger',
		};
		const plugin = {
			settings,
			getActiveLedgerProfile: () => ({
				reportingMode: settings.activeLedgerProfileId === 'corporate' ? 'corporate' : 'personal',
			}),
			app: { vault: { adapter: { read: vi.fn() } } },
			runQuery: vi.fn(() => useFirstBatch ? firstResult.promise : Promise.resolve('value\n20\n')),
		} as unknown as BeancountPlugin;

		const controller = new ReportsController(plugin);
		const earlierLoad = controller.loadData('month', 2026, 8, 'custom-month');
		await vi.waitFor(() => expect(plugin.runQuery).toHaveBeenCalledTimes(20));

		useFirstBatch = false;
		settings.activeLedgerProfileId = 'personal';
		await controller.loadData('month', 2026, 7, 'custom-month');

		firstResult.resolve('value\n10\n');
		await earlierLoad;

		const state = get(controller.state);
		expect(state.periodLabel).toBe('2026-07');
		expect(state.currency).toBe('CNY');
		expect(state.error).toBeNull();
	});
});
