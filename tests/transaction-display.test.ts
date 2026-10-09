import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type BeancountPlugin from '../src/main';
import { TransactionController } from '../src/controllers/TransactionController';
import { getTransactionsQuery } from '../src/queries';
import { displayTransactionAmount, presentTransactionRow, presentAmount, presentInventoryAmounts, monetaryPrecision, presentScheduledAmount } from '../src/utils/transactionDisplay';
import type { ScheduledTransactionItem } from '../src/models/schedule';

describe('transaction cash direction display', () => {
    it('does not classify a scheduled expense or internal transfer as income from its cached positive magnitude', () => {
        const schedule = { displayCurrency: 'CNY', displayAmount: 50, postings: [
            { account: 'Assets:Bank', amount: -50, currency: 'CNY' },
            { account: 'Expenses:Rent', amount: 50, currency: 'CNY' },
        ] } as ScheduledTransactionItem;
        expect(presentScheduledAmount(schedule).text).toBe('-50.00 CNY');
        schedule.postings = [{ account: 'Income:Salary', amount: -50, currency: 'CNY' }];
        expect(presentScheduledAmount(schedule).text).toBe('+50.00 CNY');
        schedule.postings = [{ account: 'Expenses:Rent', amount: -50, currency: 'CNY' }];
        expect(presentScheduledAmount(schedule).text).toBe('+50.00 CNY');
        schedule.postings = [
            { account: 'Assets:Bank', amount: -50, currency: 'CNY' },
            { account: 'Assets:Cash', amount: 50, currency: 'CNY' },
        ];
        expect(presentScheduledAmount(schedule)).toEqual({ text: '50.00 CNY', value: 0, color: 'neutral' });
    });

    it('shares the same formatting across numeric reports and grouped CSV strings', () => {
        expect(presentAmount(2400, 'CNY').text).toBe('+2,400.00 CNY');
        expect(presentAmount('2,400.00 CNY').text).toBe('+2,400.00 CNY');
        expect(presentAmount(600, 'CNY', -1).text).toBe('-600.00 CNY');
        expect(presentAmount(null, 'CNY').text).toBe('—');
        expect(presentAmount(1e-8, 'BTC').text).toBe('+0.00000001 BTC');
        expect(presentAmount(1e-8, 'CNY').text).toBe('+0.00000001 CNY');
        expect(monetaryPrecision('CNY', 0)).toBe(2);
        expect(monetaryPrecision('JPY', 2)).toBe(0);
    });

    it('keeps currency signs separate without splitting grouping or lot annotations', () => {
        expect(presentInventoryAmounts('(-1,000.31 CNY, 0.01 USD)', 'Income:Rental').map(x => x.text))
            .toEqual(['+1,000.31 CNY', '-0.01 USD']);
        expect(presentInventoryAmounts('(0.000001 BTC {10000 USD, 2026-09-01}, -3 HKD)').map(x => x.text))
            .toEqual(['+0.000001 BTC {10000 USD, 2026-09-01}', '-3.00 HKD']);
    });
    it.each([
        ['Income:Rental', '-2400.0 CNY', '+2,400.00 CNY', 2400, 'positive'],
        ['Income:Rental', '600.0 CNY', '-600.00 CNY', -600, 'negative'],
        ['Expenses:Charging', '25 CNY', '-25.00 CNY', -25, 'negative'],
        ['Expenses:Charging', '-5 CNY', '+5.00 CNY', 5, 'positive'],
        ['Assets:Bank', '25 CNY', '+25.00 CNY', 25, 'positive'],
        ['Liabilities:Card', '-25 CNY', '-25.00 CNY', -25, 'negative'],
    ])('shows the cash direction of %s / %s', (account, raw, text, value, color) => {
        expect(displayTransactionAmount(raw, account)).toEqual({ text, value, color });
    });

    it('preserves small receipts, commodity precision and cost annotation direction', () => {
        expect(displayTransactionAmount('-0.31 CNY', 'Income:Interest').text).toBe('+0.31 CNY');
        expect(displayTransactionAmount('-0.00 CNY', 'Income:Interest')).toEqual({ text: '0.00 CNY', value: 0, color: 'neutral' });
        expect(displayTransactionAmount('0.00000001 BTC {10000 USD, 2026-09-01}', 'Assets:Investments').text)
            .toBe('+0.00000001 BTC {10000 USD, 2026-09-01}');
    });

    it('colors multi-currency net balances individually without converting or adding them', () => {
        const row = ['2026-09-30', '', 'Receipt', '-0.31 CNY', '(-2400.31 CNY, 0.01 USD)', 'Income:Rental'];
        const before = [...row];
        expect(presentTransactionRow(row).balance).toEqual([
            { text: '+2,400.31 CNY', value: 2400.31, color: 'positive' },
            { text: '-0.01 USD', value: -0.01, color: 'negative' },
        ]);
        expect(row).toEqual(before);
    });

    it('keeps calculated totals readable and respects currency precision without hiding tiny receipts', () => {
        expect(displayTransactionAmount('-20492.63465679409025466778278 CNY', 'Income:Investments').text).toBe('+20,492.63 CNY');
        expect(displayTransactionAmount('-0.001 CNY', 'Income:Interest').text).toBe('+0.001 CNY');
        expect(displayTransactionAmount('2400 JPY', 'Expenses:Travel').text).toBe('-2,400 JPY');
    });

    it('keeps precise CSV and the posting account through controller loading, including mixed filters', async () => {
        const plugin = {
            settings: { maxTransactionResults: 1000 },
            runQuery: vi.fn().mockResolvedValue('date,payee,narration,position,balance,account\r\n2026-09-30,,Interest,-0.31 CNY,"(-0.31 CNY, 0.01 USD)",Income:Interest\r\n2026-09-30,,Refund,-5 CNY,(-5 CNY),Expenses:Charging\r\n'),
        } as unknown as BeancountPlugin;
        const controller = new TransactionController(plugin);
        await controller.handleFilterChange({ account: '(Income|Expenses)' });
        const state = get(controller.state);
        expect(state.error).toBeNull();
        const display = state.currentTransactions.map(presentTransactionRow);
        expect(display.map(row => row.amount.text)).toEqual(['+0.31 CNY', '+5.00 CNY']);
        expect([...display].sort((a, b) => b.amount.value - a.amount.value).map(row => row.narration)).toEqual(['Refund', 'Interest']);
        expect(state.currentTransactions[0][3]).toBe('-0.31 CNY');
    });

    it('requests exact strings while avoiding running inventories for an unscoped ledger', () => {
        const scoped = getTransactionsQuery({ account: 'Income' });
        expect(scoped).toContain('str(position) AS position, str(units(balance)) AS balance, account');
        expect(getTransactionsQuery({})).toContain("str(position) AS position, '' AS balance, account");
        expect(getTransactionsQuery({})).not.toContain('units(balance)');
        expect(presentTransactionRow(['2026-09-30', '', '', '1 CNY', '', 'Assets:Cash']).balance).toEqual([]);
    });
});
