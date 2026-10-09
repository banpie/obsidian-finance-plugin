import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type BeancountPlugin from '../src/main';
import { OverviewController } from '../src/controllers/OverviewController';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

describe('OverviewController', () => {
    it('does not round CNY money to integers when typical ledger postings use zero decimals', async () => {
        const runQuery = vi.fn().mockResolvedValue('value\n20.31\n');
        const plugin = {
            settings: { activeLedgerProfileId: 'personal', operatingCurrency: 'CNY' },
            getActiveLedgerProfile: () => ({ reportingMode: 'personal' }),
            currencyPrecisionService: { ensureLoaded: vi.fn().mockResolvedValue(undefined), getDecimals: () => 0 },
            runQuery,
        } as unknown as BeancountPlugin;
        const controller = new OverviewController(plugin);
        await controller.loadData();
        expect(get(controller.state).error).toBeNull();
        expect(get(controller.state).periodIncome).toBe('20.31 CNY');
        expect(runQuery.mock.calls).toHaveLength(4);
        for (const [query] of runQuery.mock.calls) expect(query).toContain(', 2)');
    });

	it('does not let a previous ledger request overwrite the newly selected profile', async () => {
		const firstResult = deferred<string>();
		let useFirstBatch = true;
		const settings = {
			activeLedgerProfileId: 'corporate',
			operatingCurrency: 'CNY',
		};
		const plugin = {
			settings,
			getActiveLedgerProfile: () => ({
				reportingMode: settings.activeLedgerProfileId === 'corporate' ? 'corporate' : 'personal',
			}),
			currencyPrecisionService: {
				ensureLoaded: vi.fn().mockResolvedValue(undefined),
				getDecimals: vi.fn().mockReturnValue(2),
			},
			runQuery: vi.fn(() => useFirstBatch ? firstResult.promise : Promise.resolve('value\n20\n')),
		} as unknown as BeancountPlugin;

		const controller = new OverviewController(plugin);
		const earlierLoad = controller.loadData();
		await vi.waitFor(() => expect(plugin.runQuery).toHaveBeenCalledTimes(4));

		useFirstBatch = false;
		settings.activeLedgerProfileId = 'personal';
		await controller.loadData();

		firstResult.resolve('value\n10\n');
		await earlierLoad;

		const state = get(controller.state);
		expect(state.reportingMode).toBe('personal');
		expect(state.netWorth).toBe('20 CNY');
		expect(state.error).toBeNull();
	});
});
