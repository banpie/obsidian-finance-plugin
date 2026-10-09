import { isFiatCurrencyCode } from './formatters';
import type { ScheduledTransactionItem } from '../models/schedule';

export interface TransactionAmountDisplay {
    text: string;
    value: number;
    color: 'positive' | 'negative' | 'neutral';
}

export interface TransactionDisplayRow {
    date: string;
    payee: string;
    narration: string;
    amount: TransactionAmountDisplay;
    balance: TransactionAmountDisplay[];
}

/** Convert income credits and expense debits to the report's presentation direction. */
export function transactionDisplayDirection(account: string): 1 | -1 {
    return /^(Income|Expenses)(?::|$)/.test(account) ? -1 : 1;
}

export function monetaryPrecision(currency: string, fallback = 2): number {
    return isFiatCurrencyCode(currency)
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
        : fallback;
}

export function displayTransactionAmount(raw: string, account: string): TransactionAmountDisplay {
    const match = raw.trim().match(/^([+-]?\d+(?:,\d{3})*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([A-Z][A-Z0-9'._-]*)(.*)$/);
    if (!match) return { text: raw.trim(), value: 0, color: 'neutral' };
    const [, number, currency, annotation] = match;
    const numeric = number.replace(/,/g, '');
    const value = Number(numeric) * transactionDisplayDirection(account);
    const [integer, fraction = ''] = expandDecimal(numeric.replace(/^[+-]/, '')).split('.');
    let magnitude = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
    if (isFiatCurrencyCode(currency)) {
        const decimals = monetaryPrecision(currency);
        const absolute = Math.abs(value);
        // Monetary totals may contain long calculated decimals. Use currency precision, but
        // retain genuinely tiny nonzero receipts instead of presenting them as signed zero.
        magnitude = absolute > 0 && absolute < 0.5 * 10 ** -decimals
            ? `${integer}.${fraction.padEnd(decimals, '0')}`
            : absolute.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return {
        text: `${sign}${magnitude} ${currency}${annotation}`,
        value,
        color: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
    };
}

function expandDecimal(number: string): string {
    const [mantissa, exponent] = number.toLowerCase().split('e');
    if (exponent === undefined) return mantissa;
    const [integer, fraction = ''] = mantissa.split('.');
    const digits = integer + fraction;
    const point = integer.length + Number(exponent);
    if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
    if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
    return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** Monetary UI values share signs, currency precision and zero treatment. */
export function presentAmount(value: number | string | null | undefined, currency = '', direction: 1 | -1 = 1, account = ''): TransactionAmountDisplay {
    if (value === null || value === undefined || value === '') return { text: '—', value: 0, color: 'neutral' };
    const raw = `${value}${currency ? ` ${currency}` : ''}`.trim();
    return displayTransactionAmount(raw, account || (direction === -1 ? 'Expenses' : ''));
}

export function presentInventoryAmounts(raw: string, account = '', direction: 1 | -1 = 1): TransactionAmountDisplay[] {
    const inventory = raw.trim().replace(/^\(|\)$/g, '');
    if (!inventory) return [];
    const parts: string[] = [];
    let start = 0, depth = 0;
    for (let index = 0; index < inventory.length; index++) {
        if (inventory[index] === '{') depth++;
        if (inventory[index] === '}') depth--;
        if (inventory[index] === ',' && depth === 0 && /(?:\s[A-Z][A-Z0-9'._-]*|\})$/.test(inventory.slice(start, index).trim())) {
            parts.push(inventory.slice(start, index));
            start = index + 1;
        }
    }
    parts.push(inventory.slice(start));
    return parts.map(part => presentAmount(part.trim(), '', direction, account));
}

/** Use explicit template postings for direction; the legacy cached amount is only a magnitude. */
export function presentScheduledAmount(item: ScheduledTransactionItem): TransactionAmountDisplay {
    const currency = item.displayCurrency;
    if (!currency) return presentAmount(null);
    const postings = item.postings.filter(p => p.currency === currency && p.amount !== undefined);
    const profitAndLoss = postings.filter(p => /^(Income|Expenses)(?::|$)/.test(p.account));
    if (profitAndLoss.length) return presentAmount(-profitAndLoss.reduce((sum, p) => sum + (p.amount ?? 0), 0), currency);
    const assetMovement = postings.filter(p => /^Assets(?::|$)/.test(p.account)).reduce((sum, p) => sum + (p.amount ?? 0), 0);
    if (assetMovement) return presentAmount(assetMovement, currency);
    const reference = presentAmount(item.displayAmount, currency);
    return { ...reference, text: reference.text.replace(/^\+/, ''), value: 0, color: 'neutral' };
}

/** Presentation only: the CSV rows and underlying ledger remain in double-entry notation. */
export function presentTransactionRow(row: string[]): TransactionDisplayRow {
    const [date = '', payee = '', narration = '', position = '', balance = '', account = ''] = row;
    const inventory = balance.trim().replace(/^\(|\)$/g, '');
    return {
        date, payee, narration,
        amount: displayTransactionAmount(position, account),
        // units(balance) has no lot annotations; each currency keeps its own sign and color.
        balance: inventory ? inventory.split(',').map(part => displayTransactionAmount(part, account)) : [],
    };
}
