/**
 * Run:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"lib":["ES2020","DOM"]}' scripts/test-investment-lifecycle.ts
 */

import { strict as assert } from 'assert';
import { findInvestmentLifecycle, parseInvestmentLifecycleCsv } from '../src/utils/investmentLifecycle';

const header = 'status,investment,display_name,asset_code,commodity,cumulative_buy_cny,cumulative_sell_income_cny,total_profit_cny,total_roi,local_realized_pnl_cny,system_closed,price_status,latest_trade';
const csv = [
	header,
	'closed,标会-金水-20240415,标会-金水-20240415,BC:450bc2,BC-450BC2,67160.00,80200.20,13040.20,19.42%,13040.00,TRUE,"跳过：已清仓｜累计投入67160元、累计回收及收益80200.20元",2026-08-31',
	'closed,旧投资,旧投资,BC:old001,OLD,332950.00,342190.00,9240.00,2.78%,33240.00,TRUE,跳过：已清仓,2024-04-12',
	'active,进行中,进行中,OPEN:000001,OPEN,100.00,0.00,10.00,10.00%,0.00,FALSE,,2026-08-30',
].join('\n');

const august = parseInvestmentLifecycleCsv(csv, '2026-09-01');
assert.deepEqual(august.get('BC-450BC2'), {
	commodity: 'BC-450BC2',
	investment: '标会-金水-20240415',
	displayName: '标会-金水-20240415',
	assetCode: 'BC:450bc2',
	cumulativeInvested: 67160,
	cumulativeRecovered: 80200.2,
	lifetimeProfit: 13040.2,
	totalRoi: 19.42,
	latestTrade: '2026-08-31',
	verification: 'verified',
});
assert.deepEqual(august.get('OLD'), {
	commodity: 'OLD',
	investment: '旧投资',
	displayName: '旧投资',
	assetCode: 'BC:old001',
	latestTrade: '2024-04-12',
	verification: 'needs-review',
});
assert.equal(august.has('OPEN'), false);
assert.equal(parseInvestmentLifecycleCsv(csv, '2026-08-31').has('BC-450BC2'), false);
assert.equal(findInvestmentLifecycle(august, 'CNY', 'Assets:Investments:BiddingClub-450bc2-标会-金水-20240415')?.commodity, 'BC-450BC2');
assert.equal(findInvestmentLifecycle(august, 'CNY', 'Assets:Investments:Other', 'Other'), undefined);

const duplicated = parseInvestmentLifecycleCsv(`${csv}\nclosed,重复,重复,BC:450bc2,BC-450BC2,10.00,12.00,2.00,20.00%,2.00,TRUE,,2026-08-01`, '2026-09-01');
assert.equal(duplicated.has('BC-450BC2'), false);

console.log('investment lifecycle parser tests passed');
