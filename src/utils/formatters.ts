// src/utils/formatters.ts
// Pure data-formatting helpers: amounts, currencies, dates, metadata strings, debounce.

import { Logger } from './logger';



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
