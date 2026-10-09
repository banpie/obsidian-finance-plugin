import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile, preprocess } from 'svelte/compiler';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { presentTransactionRow } from '../src/utils/transactionDisplay';
// Resolve the package's actual CJS export instead of Vite's synthetic named exports.
const { sveltePreprocess } = createRequire(import.meta.url)('svelte-preprocess') as typeof import('svelte-preprocess');

function componentFiles(folder: string): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const name = path.join(folder, entry.name);
        return entry.isDirectory() ? componentFiles(name) : name.endsWith('.svelte') ? [name] : [];
    });
}

describe('localized Svelte components', () => {
    it('sorts the real transaction table by displayed income direction', async () => {
        const filename = path.resolve('src/ui/partials/dashboard/TransactionsTab.svelte');
        const result = await preprocess(readFileSync(filename, 'utf8'), sveltePreprocess(), { filename });
        const sortFunction = result.code.match(/function sortTransactions\(transactions\)\s*\{[\s\S]*?\n\s*function handleSort/)?.[0].replace(/\s*function handleSort$/, '');
        expect(sortFunction).toBeTruthy();
        const rows = [
            ['2026-09-30', '', 'Receipt', '-2400 CNY', '', 'Income:Rental'],
            ['2026-09-30', '', 'Returned income', '600 CNY', '', 'Income:Rental'],
            ['2026-09-30', '', 'Interest', '-0.31 CNY', '', 'Income:Interest'],
        ];
        const sorted = runInNewContext(`let sortedTransactions; ${sortFunction}; sortTransactions(rows); sortedTransactions`, {
            rows, presentTransactionRow, sortColumn: 'amount', sortDirection: 'desc',
        }) as ReturnType<typeof presentTransactionRow>[];
        expect(sorted.map(row => row.amount.text)).toEqual(['+2,400.00 CNY', '+0.31 CNY', '-600.00 CNY']);
    });

    it('keeps purchases and refunds in the expense filter when their display labels are translated', async () => {
        const filename = path.resolve('src/ui/partials/dashboard/ReportsTab.svelte');
        const result = await preprocess(readFileSync(filename, 'utf8'), sveltePreprocess(), { filename });
        const typeFunction = result.code.match(/function transactionType\(transaction\)\s*\{[\s\S]*?\n\s*\}/)?.[0];
        const expression = result.code.match(/\$:\s*filteredDetailTransactions\s*=\s*([\s\S]*?);/)?.[1];
        expect(typeFunction).toBeTruthy();
        expect(expression).toBeTruthy();
        // Execute the real component's filter, with localized display text supplied.
        const purchase = { type: 'Expense', amount: -20 };
        const refund = { type: 'Expense', amount: 5 };
        const income = { type: 'Income', amount: 100 };
        const rows = [purchase, refund, income];
        const apply = (type: string): unknown[] => runInNewContext(`${typeFunction}\n${expression}`, {
            detailTransactions: rows,
            detailTransactionTypeFilter: type,
            detailTransactionSearch: '',
            matchesReportSearch: () => true,
            transactionSearchValues: () => [],
            transactionTypeLabel: () => '退款／支出冲减',
        }) as unknown[];
        expect(apply('Expense')).toEqual([purchase, refund]);
        expect(apply('Income')).toEqual([income]);
        expect(apply('all')).toEqual(rows);
    });

    it('compiles every real component without undefined translation functions or translated option values', async () => {
        for (const filename of componentFiles(path.resolve('src/ui'))) {
            const source = readFileSync(filename, 'utf8');
            // Localizing option values would break filtering and stored directive enums.
            expect(source, filename).not.toMatch(/value\s*[:=]\s*\{?\$tr\(/);
            const result = await preprocess(source, sveltePreprocess(), { filename });
            const compiled = compile(result.code, { filename, generate: 'dom' });
            expect(compiled.warnings.filter(w => w.code === 'missing-declaration'), filename).toEqual([]);
        }
    }, 60000);
});
