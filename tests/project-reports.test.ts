import { describe, expect, it } from 'vitest';
import { ReportsController } from '../src/controllers/ReportsController';
import type BeancountPlugin from '../src/main';
import { projectReportKey, projectTransactionTypeLabelKey } from '../src/utils/projectReports';

// Exercise the CSV-to-report boundary with a cross-month partial refund.
const controller = new ReportsController({ settings: {} } as BeancountPlugin);
const report = controller as unknown as {
	parseProjectTransactionRows(csv: string): ReturnType<typeof transactionRows>;
	buildProjectRows(income: string, expenses: string, transactions: ReturnType<typeof transactionRows>, names: string, inactive?: boolean): Array<{ label: string; tag: string; income: number; expenses: number; netIncome: number; transactionCount: number }>;
};
function transactionRows() {
	return [{ date: '2026-09-08', payee: '', narration: '部分退款', account: 'Expenses:Business:Charging', counterpartAccounts: [], projectLabel: 'p_station', projectTag: 'p_station', type: 'Expense' as const, amount: 5 }];
}

describe('project reports', () => {
	it('uses the same tag for renamed or unnamed rows, keeping distinct tags and untagged names separate', () => {
		expect(projectReportKey('原名称', 'p_station')).toBe(projectReportKey('', 'p_station'));
		expect(projectReportKey('原名称', 'p_station')).toBe(projectReportKey('新名称', 'p_station'));
		expect(projectReportKey('同名', 'p_one')).not.toBe(projectReportKey('同名', 'p_two'));
		expect(projectReportKey('同名', '')).not.toBe(projectReportKey('同名', 'p_one'));
	});

	it('merges an unnamed refund into the project and preserves signed costs and drill-down rows', () => {
		const transactions = transactionRows();
		const projects = report.buildProjectRows('label,tag,income\n经营项目,p_station,100\n', 'label,tag,expense\n经营项目,p_station,20\n,p_station,-5\n', transactions, 'label,tag\n经营项目,p_station\n');
		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({ label: '经营项目', tag: 'p_station', income: 100, expenses: 15, netIncome: 85, transactionCount: 1 });
		expect(transactions[0].projectLabel).toBe('经营项目');
		expect(transactions[0].amount).toBe(5);
	});

	it('uses history for a refund-only month without adding inactive projects', () => {
		const projects = report.buildProjectRows('', 'label,tag,expense\n,p_station,-5\n', transactionRows(), 'label,tag\n经营项目,p_station\n其他项目,p_other\n');
		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({ label: '经营项目', expenses: -5, income: 0, netIncome: 5 });
	});

	it('labels positive expense cash flow as a refund without changing the internal expense type', () => {
		const rows = report.parseProjectTransactionRows('date,payee,narration,account,label,tag,amount\n2026-09-08,,部分退款,Expenses:Business:Charging,,p_station,-5\n');
		expect(rows[0]).toMatchObject({ type: 'Expense', amount: 5 });
		expect(projectTransactionTypeLabelKey(rows[0].type, rows[0].amount)).toBe('Refund / expense reduction');
		expect(projectTransactionTypeLabelKey('Expense', -20)).toBe('Expense');
		expect(projectTransactionTypeLabelKey('Income', -5)).toBe('Income reversal');
	});
});
