import assert from 'node:assert/strict';
import { parseExternalPriceResult } from '../src/services/external-price-result';


const success = parseExternalPriceResult(JSON.stringify({
	status: 'success',
	positions: 15,
	updated_positions: 12,
	changed_price_records: 8,
	skipped_count: 2,
	failed_count: 1,
	latest_price_date: '2026-08-28',
	restored: false,
}));

assert.equal(success.backend, 'external');
assert.equal(success.savedCount, 8);
assert.equal(success.failed.length, 0);
assert.equal(success.summary, '12/15 positions refreshed · 8 price records written · 2 skipped · 1 need review · latest 2026-08-28');

const failed = parseExternalPriceResult(JSON.stringify({
	status: 'failed',
	restored: true,
	error: 'bean-check failed',
}));

assert.equal(failed.failed[0].error, 'bean-check failed');
assert.equal(failed.restored, true);
assert.match(failed.summary ?? '', /price file restored/);

console.log('external price result tests passed');
