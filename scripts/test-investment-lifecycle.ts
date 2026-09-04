/**
 * Run:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"lib":["ES2020","DOM"]}' scripts/test-investment-lifecycle.ts
 */

import { strict as assert } from 'assert';
import { parseInvestmentLifecycleCsv } from '../src/utils/investmentLifecycle';

const header = 'status,commodity,cumulative_buy_cny,cumulative_sell_income_cny,total_profit_cny,total_roi,local_realized_pnl_cny,system_closed,price_status,latest_trade';
const csv = [
	header,
	'closed,BC-450BC2,67160.00,80200.20,13040.20,19.42%,13040.00,TRUE,"跳过：已清仓｜累计投入67160元、累计回收及收益80200.20元",2026-08-31',
	'closed,OLD,332950.00,342190.00,9240.00,2.78%,33240.00,TRUE,跳过：已清仓,2024-04-12',
	'active,OPEN,100.00,0.00,10.00,10.00%,0.00,FALSE,,2026-08-30',
].join('\n');

const august = parseInvestmentLifecycleCsv(csv, '2026-09-01');
assert.deepEqual(august.get('BC-450BC2'), {
	commodity: 'BC-450BC2',
	cumulativeInvested: 67160,
	cumulativeRecovered: 80200.2,
	lifetimeProfit: 13040.2,
	totalRoi: 19.42,
	latestTrade: '2026-08-31',
	verification: 'verified',
});
assert.deepEqual(august.get('OLD'), {
	commodity: 'OLD',
	latestTrade: '2024-04-12',
	verification: 'needs-review',
});
assert.equal(august.has('OPEN'), false);
assert.equal(parseInvestmentLifecycleCsv(csv, '2026-08-31').has('BC-450BC2'), false);

const duplicated = parseInvestmentLifecycleCsv(`${csv}\nclosed,BC-450BC2,10.00,12.00,2.00,20.00%,2.00,TRUE,,2026-08-01`, '2026-09-01');
assert.equal(duplicated.has('BC-450BC2'), false);

console.log('investment lifecycle parser tests passed');
