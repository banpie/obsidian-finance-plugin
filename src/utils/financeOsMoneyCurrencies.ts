import type BeancountPlugin from '../main';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from './logger';

const ACCOUNT_MAP_PATH = '02_财务/财务OS/ledger/account-map.csv';
const PRICES_PATH = '02_财务/财务OS/ledger/prices.beancount';
const MONEY_CURRENCY_PATTERN = /^[A-Z]{3}$/;

async function readVaultFile(plugin: BeancountPlugin, path: string): Promise<string | null> {
    try {
        const exists = await plugin.app.vault.adapter.exists(path);
        if (!exists) return null;
        return await plugin.app.vault.adapter.read(path);
    } catch (error) {
        Logger.warn(`[FinanceOS currencies] Failed to read ${path}:`, error);
        return null;
    }
}

function addCurrency(currencies: Set<string>, value: unknown): void {
    const currency = String(value || '').trim().toUpperCase();
    if (MONEY_CURRENCY_PATTERN.test(currency)) {
        currencies.add(currency);
    }
}

function parseAccountMapCurrencies(csv: string): string[] {
    const rows = parseCsv(csv, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: true,
    }) as Record<string, string>[];
    const currencies = new Set<string>();
    for (const row of rows) {
        addCurrency(currencies, row.currency);
    }
    return Array.from(currencies);
}

function parseFxPriceCurrencies(text: string): string[] {
    const currencies = new Set<string>();
    const pattern = /^\d{4}-\d{2}-\d{2}\s+price\s+([A-Z]{3})\s+[-0-9.]+\s+CNY\s*$/;
    for (const line of text.split(/\r?\n/)) {
        const match = pattern.exec(line.trim());
        if (match) addCurrency(currencies, match[1]);
    }
    return Array.from(currencies);
}

export async function loadFinanceOsMoneyCurrencies(plugin: BeancountPlugin): Promise<string[]> {
    const currencies = new Set<string>();

    const accountMap = await readVaultFile(plugin, ACCOUNT_MAP_PATH);
    if (accountMap) {
        try {
            for (const currency of parseAccountMapCurrencies(accountMap)) currencies.add(currency);
        } catch (error) {
            Logger.warn('[FinanceOS currencies] Failed to parse account-map.csv:', error);
        }
    }

    const prices = await readVaultFile(plugin, PRICES_PATH);
    if (prices) {
        try {
            for (const currency of parseFxPriceCurrencies(prices)) currencies.add(currency);
        } catch (error) {
            Logger.warn('[FinanceOS currencies] Failed to parse prices.beancount:', error);
        }
    }

    return Array.from(currencies).sort();
}
