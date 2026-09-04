// src/utils/currencyPrecision.ts
// Pure helpers for inferring per-currency decimal precision from ledger data,
// mirroring Beancount's own DisplayContext: the decimal count actually used
// for a currency in the file (most common occurrence) rather than a fixed guess.

import { parse as parseCsv } from 'csv-parse/sync';

/** Counts the number of digits after the decimal point in a numeric string (0 if none/integer). */
export function countDecimals(numberStr: string): number {
    const dot = numberStr.indexOf('.');
    return dot === -1 ? 0 : numberStr.length - dot - 1;
}

/**
 * Parses a two-column "currency,number" CSV (with or without a header row)
 * into [currency, numberStr] tuples, skipping malformed/blank rows.
 */
export function parseCurrencyNumberCSV(csv: string): Array<[string, string]> {
    const clean = csv.replace(/\r/g, '').trim();
    if (!clean) return [];

    let records: string[][];
    try {
        records = parseCsv(clean, { columns: false, skip_empty_lines: true, relax_column_count: true });
    } catch {
        return [];
    }

    const firstIsHeader = /^[a-zA-Z_]+$/.test(records[0]?.[0] ?? '') && isNaN(parseFloat(records[0]?.[1] ?? ''));
    const rows = firstIsHeader ? records.slice(1) : records;

    const out: Array<[string, string]> = [];
    for (const row of rows) {
        const currency = row?.[0]?.trim();
        const numberStr = row?.[1]?.trim();
        if (currency && numberStr) out.push([currency, numberStr]);
    }
    return out;
}

/**
 * Builds a per-currency decimal-precision map from raw (currency, number) pairs,
 * picking the most frequently occurring decimal count for each currency — the
 * same "most common" strategy Beancount's DisplayContext uses for legible display.
 */
export function buildPrecisionMap(rows: Array<[currency: string, numberStr: string]>): Map<string, number> {
    const histograms = new Map<string, Map<number, number>>();

    for (const [currency, numberStr] of rows) {
        const decimals = countDecimals(numberStr);
        let histogram = histograms.get(currency);
        if (!histogram) {
            histogram = new Map();
            histograms.set(currency, histogram);
        }
        histogram.set(decimals, (histogram.get(decimals) ?? 0) + 1);
    }

    const result = new Map<string, number>();
    for (const [currency, histogram] of histograms) {
        let bestDecimals = 2;
        let bestCount = -1;
        for (const [decimals, count] of histogram) {
            if (count > bestCount) {
                bestCount = count;
                bestDecimals = decimals;
            }
        }
        result.set(currency, bestDecimals);
    }
    return result;
}
