import { beforeEach, describe, expect, it, vi } from 'vitest';
import type BeancountPlugin from '../src/main';

const execSafeMock = vi.hoisted(() => vi.fn());
const getMainLedgerPathMock = vi.hoisted(() => vi.fn());
const loggerLogMock = vi.hoisted(() => vi.fn());

vi.mock('../src/utils/execSafe', () => ({ execSafe: execSafeMock }));
vi.mock('../src/utils/structuredLayout', () => ({ getMainLedgerPath: getMainLedgerPathMock }));
vi.mock('../src/utils/fileEditor', () => ({ convertWindowsPathToWsl: (path: string) => path }));
vi.mock('../src/utils/logger', () => ({ Logger: { log: loggerLogMock } }));

import { runQuery } from '../src/utils/queryRunner';

describe('runQuery', () => {
	const plugin = {
		settings: { beancountCommand: 'bean-query' },
	} as unknown as BeancountPlugin;

	beforeEach(() => {
		vi.clearAllMocks();
		getMainLedgerPathMock.mockReturnValue('/ledger.beancount');
	});

	it('keeps successful bean-query output when stderr only has cache diagnostics', async () => {
		execSafeMock.mockResolvedValue({
			stdout: 'value\n42\n',
			stderr: 'WARNING:root:Could not remove picklecache file\n',
		});

		await expect(runQuery(plugin, 'SELECT 42;')).resolves.toBe('value\n42');
		expect(loggerLogMock).toHaveBeenCalledWith(expect.stringContaining('Command stderr (informational)'));
	});

	it('still rejects when bean-query exits unsuccessfully', async () => {
		execSafeMock.mockRejectedValue(new Error('Command failed with exit status 1'));

		await expect(runQuery(plugin, 'SELECT invalid;')).rejects.toThrow('exit status 1');
	});
});
