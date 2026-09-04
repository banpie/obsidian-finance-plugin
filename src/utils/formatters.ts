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


// --- CURRENCY / AMOUNT FORMATTING ---

/**
 * Formats a numeric amount to a fixed decimal count, with optional thousands separators.
 * `decimals` should come from a per-currency precision lookup (see CurrencyPrecisionService)
 * rather than being hardcoded, so e.g. crypto and zero-decimal currencies render correctly.
 */
export function formatAmount(amount: number, decimals = 2, grouped = false): string {
    if (grouped) {
        return amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return amount.toFixed(decimals);
}

/** Formats a numeric amount with a trailing currency code, e.g. "1234.50 USD". */
export function formatCurrency(amount: number, currency: string, decimals = 2, grouped = false): string {
    return `${formatAmount(amount, decimals, grouped)} ${currency}`;
}

/**
 * Formats a rate/price value with as many decimals as needed to stay meaningful
 * (up to `maxDecimals`), without padding "clean" values with trailing zeros.
 * Unlike formatCurrency's fixed decimal count, this suits unit prices, where a
 * single currency-typical precision (e.g. 2 for USD) would round low-value
 * commodities (e.g. a token priced at 0.00003421 USD) down to "0.00".
 */
export function formatSignificantAmount(amount: number, minDecimals = 2, maxDecimals = 8): string {
    return amount.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });
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

// --- PERIOD LABEL PARSER ---

/**
 * Parses a chart period label or date key into a startDate and endDate string range (YYYY-MM-DD).
 * @param label The period label or date key (e.g. "2025-10", "OCT 2025", "2025-10-12", "Oct 12, 25").
 * @param interval The chart granularity ('month' | 'week').
 */
export function parsePeriodLabel(label: string, interval: 'month' | 'week'): { startDate: string; endDate: string } {
    if (!label || typeof label !== 'string') {
        return { startDate: '', endDate: '' };
    }

    const trimmed = label.trim();

    if (interval === 'month') {
        let year: number | null = null;
        let month: number | null = null;

        const yearOnlyMatch = /^(\d{4})$/.exec(trimmed);
        if (yearOnlyMatch) {
            const y = parseInt(yearOnlyMatch[1], 10);
            return {
                startDate: `${y}-01-01`,
                endDate: `${y}-12-31`
            };
        }

        const isoMatch = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(trimmed);
        if (isoMatch) {
            year = parseInt(isoMatch[1], 10);
            month = parseInt(isoMatch[2], 10);
        } else {
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const textMatch = /([a-zA-Z]+)\s+(\d{4})/.exec(trimmed) || /(\d{4})\s+([a-zA-Z]+)/.exec(trimmed);
            if (textMatch) {
                const monthStr = (textMatch[1].length === 4 ? textMatch[2] : textMatch[1]).toLowerCase();
                const yearStr = textMatch[1].length === 4 ? textMatch[1] : textMatch[2];
                const monthIdx = months.findIndex(m => monthStr.startsWith(m));
                if (monthIdx !== -1) {
                    month = monthIdx + 1;
                    year = parseInt(yearStr, 10);
                }
            }
            if (!year || !month) {
                const d = new Date(trimmed);
                if (!isNaN(d.getTime())) {
                    year = d.getFullYear();
                    month = d.getMonth() + 1;
                }
            }
        }

        if (year && month && month >= 1 && month <= 12) {
            const padMonth = month.toString().padStart(2, '0');
            const lastDay = new Date(year, month, 0).getDate();
            const padLastDay = lastDay.toString().padStart(2, '0');
            return {
                startDate: `${year}-${padMonth}-01`,
                endDate: `${year}-${padMonth}-${padLastDay}`
            };
        }
    } else {
        let endD: Date | null = null;
        const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
        if (isoMatch) {
            const y = parseInt(isoMatch[1], 10);
            const m = parseInt(isoMatch[2], 10) - 1;
            const d = parseInt(isoMatch[3], 10);
            endD = new Date(y, m, d);
        } else {
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
                endD = d;
                if (endD.getFullYear() < 100) {
                    endD.setFullYear(endD.getFullYear() + 2000);
                }
            }
        }

        if (endD && !isNaN(endD.getTime())) {
            const startD = new Date(endD.getTime());
            startD.setDate(startD.getDate() - 6);

            const formatISO = (date: Date) => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };

            return {
                startDate: formatISO(startD),
                endDate: formatISO(endD)
            };
        }
    }

    return { startDate: '', endDate: '' };
}
