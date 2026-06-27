// src/utils/formatters.ts
// Pure data-formatting helpers: amounts, currencies, dates, metadata strings, debounce.

import { Logger } from './logger';

const FIAT_CURRENCY_CODES = new Set([
    'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
    'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
    'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
    'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
    'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
    'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
    'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
    'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
    'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
    'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
    'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
    'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
    'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
    'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
    'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
    'YER', 'ZAR', 'ZMW', 'ZWL',
    // Common Beancount symbols for offshore/onshore variants that are not ISO 4217 codes.
    'CNH',
]);

// --- AMOUNT PARSERS ---

/**
 * Extracts the numeric amount for a specific currency from a multi-currency inventory string.
 */
export function extractConvertedAmountNumber(inventoryString: string, targetCurrency: string): number {
    const regex = new RegExp(`(-?[\\d,]+\\.?\\d*)\\s*${targetCurrency}`);
    const match = inventoryString.match(regex);
    if (match) {
        return parseFloat(match[1].replace(/,/g, '')) || 0;
    }
    return 0;
}

/**
 * Extracts amounts for all currencies EXCEPT the operating currency.
 */
export function extractNonReportingCurrencies(inventoryString: string, operatingCurrency: string): string {
    const currencyRegex = /(-?[\d,]+\.?\d*)\s*([A-Z]{3,4})/g;
    const matches: string[] = [];
    let match;

    while ((match = currencyRegex.exec(inventoryString)) !== null) {
        const amount = match[1];
        const currency = match[2];
        if (currency !== operatingCurrency) {
            const numAmount = parseFloat(amount.replace(/,/g, ''));
            if (numAmount !== 0) {
                matches.push(`${amount} ${currency}`);
            }
        }
    }
    return matches.join('\n');
}

export function isFiatCurrencyCode(code: string): boolean {
    return FIAT_CURRENCY_CODES.has(code.trim().toUpperCase());
}

export interface CurrencyOptionGroup {
    label: string;
    options: string[];
}

function normalizeCurrencyOptions(currencies: Array<string | undefined | null>): string[] {
    return currencies
        .filter((currency): currency is string => Boolean(currency))
        .map(currency => currency.trim())
        .filter(Boolean);
}

function sortCurrencyOptions(currencies: string[], preferredOrder: Map<string, number>): string[] {
    return [...currencies].sort((a, b) => {
        const aPreferred = preferredOrder.get(a);
        const bPreferred = preferredOrder.get(b);
        if (aPreferred !== undefined && bPreferred !== undefined) return aPreferred - bPreferred;
        if (aPreferred !== undefined) return -1;
        if (bPreferred !== undefined) return 1;
        return a.localeCompare(b);
    });
}

export function groupCurrencyOptions(currencies: string[], preferred: Array<string | undefined | null> = []): CurrencyOptionGroup[] {
    const preferredOptions = normalizeCurrencyOptions(preferred);
    const options = [...new Set([...preferredOptions, ...normalizeCurrencyOptions(currencies)])];
    const preferredOrder = new Map(preferredOptions.map((currency, index) => [currency, index]));

    const fiat = sortCurrencyOptions(options.filter(isFiatCurrencyCode), preferredOrder);
    const other = sortCurrencyOptions(options.filter(currency => !isFiatCurrencyCode(currency)), preferredOrder);
    const groups: CurrencyOptionGroup[] = [];

    if (fiat.length > 0) groups.push({ label: '法定货币', options: fiat });
    if (other.length > 0) groups.push({ label: '其他商品', options: other });

    return groups;
}


// --- METADATA PARSER ---

/**
 * Parses a BQL metadata dictionary string (e.g. "{'key': 'value'}") into a plain object.
 * Handles empty dicts and malformed strings gracefully.
 */
export function parseMetadataString(metaStr: string): Record<string, unknown> {
    try {
        if (!metaStr || metaStr.trim() === '{}' || metaStr.trim() === '') return {};
        // Convert BQL single-quotes to JSON double-quotes
        const jsonStr = metaStr.replace(/'/g, '"').trim();
        return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
        Logger.warn('Failed to parse metadata string:', metaStr, e);
        return {};
    }
}

// --- DEBOUNCE ---

/**
 * Creates a debounced version of a function.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout !== null) {
            window.clearTimeout(timeout);
        }
        timeout = window.setTimeout(later, wait);
    };
}
