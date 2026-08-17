import { describe, it, expect } from 'vitest';
import { countDecimals, parseCurrencyNumberCSV, buildPrecisionMap } from '../src/utils/currencyPrecision';
import { formatAmount, formatCurrency, formatSignificantAmount } from '../src/utils/formatters';

describe('countDecimals', () => {
	it('counts fractional digits', () => {
		expect(countDecimals('123.45')).toBe(2);
		expect(countDecimals('0.00003421')).toBe(8);
		expect(countDecimals('100')).toBe(0);
		expect(countDecimals('-5.5')).toBe(1);
	});
});

describe('parseCurrencyNumberCSV', () => {
	it('parses a two-column CSV with a header row', () => {
		const csv = ['currency,number', 'USD,10.00', 'BTC,0.00234567'].join('\n');
		expect(parseCurrencyNumberCSV(csv)).toEqual([
			['USD', '10.00'],
			['BTC', '0.00234567'],
		]);
	});

	it('parses a two-column CSV without a header row', () => {
		const csv = ['USD,10.00', 'BTC,0.00234567'].join('\n');
		expect(parseCurrencyNumberCSV(csv)).toEqual([
			['USD', '10.00'],
			['BTC', '0.00234567'],
		]);
	});

	it('skips malformed or blank rows and returns empty for blank input', () => {
		expect(parseCurrencyNumberCSV('')).toEqual([]);
		const csv = ['currency,number', 'USD,10.00', 'INCOMPLETE'].join('\n');
		expect(parseCurrencyNumberCSV(csv)).toEqual([['USD', '10.00']]);
	});
});

describe('buildPrecisionMap', () => {
	it('picks the most common decimal count per currency', () => {
		const rows: Array<[string, string]> = [
			['USD', '10.00'], ['USD', '5.50'], ['USD', '3.999'],
			['BTC', '0.00234567'], ['BTC', '0.00100000'],
			['JPY', '1500'], ['JPY', '200'],
		];
		const map = buildPrecisionMap(rows);
		expect(map.get('USD')).toBe(2);
		expect(map.get('BTC')).toBe(8);
		expect(map.get('JPY')).toBe(0);
	});

	it('is absent for currencies with no rows (caller applies the default)', () => {
		const map = buildPrecisionMap([['USD', '1.00']]);
		expect(map.has('EUR')).toBe(false);
	});
});

describe('formatAmount / formatCurrency', () => {
	it('formats to a fixed decimal count', () => {
		expect(formatAmount(1234.5, 2)).toBe('1234.50');
		expect(formatAmount(1234.5, 0)).toBe('1235');
		expect(formatCurrency(1234.5, 'USD', 2)).toBe('1234.50 USD');
	});

	it('applies thousands separators when grouped', () => {
		expect(formatAmount(1234.5, 2, true)).toBe('1,234.50');
	});
});

describe('formatSignificantAmount', () => {
	it('does not truncate low-value amounts to 0.00', () => {
		expect(formatSignificantAmount(0.00003421)).toBe('0.00003421');
	});

	it('does not pad clean values with trailing zeros beyond the minimum', () => {
		expect(formatSignificantAmount(43567.89)).toBe('43,567.89');
	});
});
