import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type BeancountPlugin from '../src/main';
import { ReportsController } from '../src/controllers/ReportsController';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

describe('ReportsController', () => {
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
