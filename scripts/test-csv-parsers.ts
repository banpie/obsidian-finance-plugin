/**
 * Run:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"lib":["ES2020","DOM"]}' scripts/test-csv-parsers.ts
 */

import { strict as assert } from 'assert';
import { parseCombinedCommodityDataCSV, parseCommodityPriceHistoryCSV } from '../src/utils/csvParsers';

function main() {
    const csv = [
        'currency_,displayname_,units_,valueOp_,price_,logo_',
        'QQQ,Nasdaq 100 ETF,12.5 QQQ,1000.25 USD,80.02,https://example.com/qqq.png',
        'CLOSED,Closed holding,-0.125 CLOSED,-10.50 USD,84,None',
        'UNPRICED,Unpriced holding,-2 UNPRICED,-2 UNPRICED,None,None',
    ].join('\n');

    const result = parseCombinedCommodityDataCSV(csv, 'USD');

    assert.equal(result.get('QQQ')?.holdings, 12.5);
    assert.equal(result.get('QQQ')?.valueOp, 1000.25);
    assert.equal(result.get('QQQ')?.holdingsRaw, '12.5 QQQ');

    assert.equal(result.get('CLOSED')?.holdings, -0.125);
    assert.equal(result.get('CLOSED')?.valueOp, -10.5);
    assert.equal(result.get('CLOSED')?.holdingsRaw, '-0.125 CLOSED');

    assert.equal(result.get('UNPRICED')?.holdings, -2);
    assert.equal(result.get('UNPRICED')?.valueOp, 0);
    assert.equal(result.get('UNPRICED')?.price, null);
    assert.equal(result.get('UNPRICED')?.logo, null);

    const priceHistory = parseCommodityPriceHistoryCSV([
        'date_,amount_,currency_',
        '2026-09-04,485.1252,CNY',
        '2026-09-04,567,HKD',
    ].join('\n'));
    assert.deepEqual(priceHistory, [
        { date: '2026-09-04', amount: 485.1252, currency: 'CNY', amountRaw: '485.1252 CNY' },
        { date: '2026-09-04', amount: 567, currency: 'HKD', amountRaw: '567 HKD' },
    ]);

    console.log('csv parser tests passed');
}

main();
