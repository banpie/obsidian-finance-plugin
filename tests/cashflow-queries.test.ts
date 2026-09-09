import { describe, expect, it } from 'vitest';
import {
	cashFlowEntryClause,
	periodCloseEntryClause,
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

	it('uses only the period-close marker for corporate accrual profit and loss', () => {
		const clause = periodCloseEntryClause();
		expect(clause).toContain("NOT entry_meta('reporting_role') = 'period_close'");

		for (const query of [
			getPeriodIncomeBreakdownQuery('CNY', 2, '2026-01-01', '2027-01-01', 'accrual'),
			getPeriodExpenseBreakdownQuery('CNY', 2, '2026-01-01', '2027-01-01', 'accrual'),
			getPeriodIncomeTransactionsQuery('CNY', 2, '2026-01-01', '2027-01-01', 'accrual'),
			getPeriodSavingsQuery('CNY', 2, '2026-01-01', '2027-01-01', 'accrual'),
		]) {
			expect(query).toContain(clause.trim());
			expect(query).not.toContain("cashflow_treatment");
			expect(query).not.toContain("finance_os_type");
		}
	});
});
