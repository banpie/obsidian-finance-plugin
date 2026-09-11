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
		expect(state.netWorth).toBe('20.00 CNY');
		expect(state.error).toBeNull();
	});
});
