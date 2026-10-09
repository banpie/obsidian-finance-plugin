import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import type BeancountPlugin from '../src/main';
import { IncomeStatementController } from '../src/controllers/IncomeStatementController';

describe('income statement trend direction', () => {
    it('plots expense months below zero and net refunds above zero, with matching tooltips', () => {
        const plugin = { settings: { operatingCurrency: 'CNY' } } as unknown as BeancountPlugin;
        const controller = new IncomeStatementController(plugin);
        const process = controller as unknown as {
            _processChartData(csv: string, interval: string, currency: string, type: string): void;
        };
        process._processChartData('year,month,value\n2026,8,80\n2026,9,-5\n', 'month', 'CNY', 'expense');
        const state = get(controller.state);
        expect(state.chartError).toBeNull();
        const dataset = state.chartConfig?.data.datasets[0];
        expect(dataset?.data).toEqual([-80, 5]);
        expect(dataset?.backgroundColor).toEqual(['rgba(255, 99, 99, 0.7)', 'rgba(75, 192, 130, 0.7)']);
        const tooltip = state.chartConfig?.options?.plugins?.tooltip?.callbacks?.label as unknown as (context: { parsed: { y: number } }) => string;
        expect(tooltip({ parsed: { y: -80 } })).toBe('Expense: -80.00 CNY');
        expect(tooltip({ parsed: { y: 5 } })).toBe('Expense: +5.00 CNY');
    });
});
