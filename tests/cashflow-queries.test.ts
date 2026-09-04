import { describe, expect, it } from 'vitest';
import {
	cashFlowEntryClause,
	getPeriodExpenseBreakdownQuery,
	getPeriodIncomeBreakdownQuery,
	getPeriodIncomeTransactionsQuery,
	getPeriodSavingsQuery,
} from '../src/queries';

describe('cash flow queries', () => {
	it('exclude explicitly non-cash accruals and local corrections', () => {
		const clause = cashFlowEntryClause();
		expect(clause).toContain("NOT entry_meta('cashflow_treatment') = 'non_cash'");
		expect(clause).toContain("NOT entry_meta('finance_os_type') = 'local_correction'");

		for (const query of [
			getPeriodIncomeBreakdownQuery('CNY', 2, '2026-01-01', '2027-01-01'),
			getPeriodExpenseBreakdownQuery('CNY', 2, '2026-01-01', '2027-01-01'),
			getPeriodIncomeTransactionsQuery('CNY', 2, '2026-01-01', '2027-01-01'),
			getPeriodSavingsQuery('CNY', 2, '2026-01-01', '2027-01-01'),
		]) {
			expect(query).toContain(clause.trim());
		}
	});
});
