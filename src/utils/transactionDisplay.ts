import { isFiatCurrencyCode } from './formatters';

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

/** Income credits and expense debits use the opposite sign to their cash effect. */
export function transactionDisplayDirection(account: string): 1 | -1 {
    return /^(Income|Expenses)(?::|$)/.test(account) ? -1 : 1;
}

export function displayTransactionAmount(raw: string, account: string): TransactionAmountDisplay {
    const match = raw.trim().match(/^([+-]?\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9'._-]*)(.*)$/);
    if (!match) return { text: raw.trim(), value: 0, color: 'neutral' };
    const [, number, currency, annotation] = match;
    const value = Number(number) * transactionDisplayDirection(account);
    const [integer, fraction = ''] = number.replace(/^[+-]/, '').split('.');
    let magnitude = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
    if (isFiatCurrencyCode(currency)) {
        const decimals = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
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
