import { describe, it, expect } from 'vitest';
import { parseCombinedCommodityDataCSV, parseCommoditiesListCSV } from '../src/utils/csvParsers';

describe('CSV Parsers', () => {
	it('parses commodities list CSV correctly', () => {
		const csv = [
			'currency_',
			'USD',
			'EUR',
			'AAPL',
		].join('\n');

		const result = parseCommoditiesListCSV(csv);
		expect(result).toEqual(['USD', 'EUR', 'AAPL']);
	});

	it('parses combined commodity holdings and prices correctly from 6-column CSV', () => {
		const csv = [
			'currency_,displayname_,units_,valueOp_,price_,logo_',
			'QQQ,Invesco QQQ,12.5 QQQ,1000.25 USD,80.02,https://example.com/qqq.png',
			'CLOSED,Closed Account,-0.125 CLOSED,-10.50 USD,84,None',
			'UNPRICED,Unpriced Item,-2 UNPRICED,-2 UNPRICED,None,None',
		].join('\n');

		const result = parseCombinedCommodityDataCSV(csv, 'USD');

		expect(result.get('QQQ')?.displayName).toBe('Invesco QQQ');
		expect(result.get('QQQ')?.holdings).toBe(12.5);
		expect(result.get('QQQ')?.valueOp).toBe(1000.25);
		expect(result.get('QQQ')?.holdingsRaw).toBe('12.5 QQQ');

		expect(result.get('CLOSED')?.holdings).toBe(-0.125);
		expect(result.get('CLOSED')?.valueOp).toBe(-10.5);
		expect(result.get('CLOSED')?.holdingsRaw).toBe('-0.125 CLOSED');

		expect(result.get('UNPRICED')?.holdings).toBe(-2);
		expect(result.get('UNPRICED')?.valueOp).toBe(0);
		expect(result.get('UNPRICED')?.price).toBeNull();
		expect(result.get('UNPRICED')?.logo).toBeNull();
	});
});
