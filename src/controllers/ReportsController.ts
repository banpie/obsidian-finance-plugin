import { writable, type Writable, get } from 'svelte/store';
import { parse as parseCsv } from 'csv-parse/sync';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { Logger } from '../utils/logger';

export type ReportsPeriodMode = 'month' | 'year';
export type ReportsPeriodPreset = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom-month' | 'custom-year';
export type ReportsView = 'cashflow' | 'assets';

export interface ReportRow {
	label: string;
	account?: string;
	commodity?: string;
	commodityName?: string;
	amount: number;
	percent: number;
}

export interface ReportTransaction {
	date: string;
	payee: string;
	narration: string;
	account: string;
	counterpartAccounts: string[];
	amount: number;
}

export interface ReportInvestmentTransaction {
	date: string;
	payee: string;
	narration: string;
	account: string;
	position: string;
}

export interface ReportsState {
	isLoading: boolean;
	error: string | null;
	currency: string;
	activeView: ReportsView;
	periodPreset: ReportsPeriodPreset;
	periodMode: ReportsPeriodMode;
	year: number;
	month: number;
	periodLabel: string;
	startDate: string;
	endDate: string;
	totalIncome: number;
	totalExpenses: number;
	netIncome: number;
	totalAssets: number;
	totalLiabilities: number;
	netWorth: number;
	incomeByCategory: ReportRow[];
	expensesByCategory: ReportRow[];
	incomeByAccount: ReportRow[];
	expensesByAccount: ReportRow[];
	incomeTransactions: ReportTransaction[];
	expenseTransactions: ReportTransaction[];
	assetsByCategory: ReportRow[];
	assetsByAccount: ReportRow[];
	liabilitiesByCategory: ReportRow[];
	liabilitiesByAccount: ReportRow[];
	investmentsByType: ReportRow[];
	investmentsByAccount: ReportRow[];
	topInvestments: ReportRow[];
	incomeChartConfig: ChartConfiguration | null;
	expensesChartConfig: ChartConfiguration | null;
	assetsChartConfig: ChartConfiguration | null;
	investmentsChartConfig: ChartConfiguration | null;
}

type CsvRow = string[];

const CHART_COLORS = [
	'#2563eb',
	'#16a34a',
	'#dc2626',
	'#9333ea',
	'#ca8a04',
	'#0891b2',
	'#ea580c',
	'#4f46e5',
	'#65a30d',
	'#be123c',
	'#0d9488',
	'#7c3aed',
];

export class ReportsController {
	private plugin: BeancountPlugin;
	public state: Writable<ReportsState>;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		const today = new Date();
		const year = today.getFullYear();
		const month = today.getMonth() + 1;
		const range = this.getPeriodRange('month', year, month);

		this.state = writable({
			isLoading: true,
			error: null,
			currency: plugin.settings.operatingCurrency || 'USD',
			activeView: 'cashflow',
			periodPreset: 'this-month',
			periodMode: 'month',
			year,
			month,
			periodLabel: range.label,
			startDate: range.startDate,
			endDate: range.endDate,
			totalIncome: 0,
			totalExpenses: 0,
			netIncome: 0,
			totalAssets: 0,
			totalLiabilities: 0,
			netWorth: 0,
			incomeByCategory: [],
			expensesByCategory: [],
			incomeByAccount: [],
			expensesByAccount: [],
			incomeTransactions: [],
			expenseTransactions: [],
			assetsByCategory: [],
			assetsByAccount: [],
			liabilitiesByCategory: [],
			liabilitiesByAccount: [],
			investmentsByType: [],
			investmentsByAccount: [],
			topInvestments: [],
			incomeChartConfig: null,
			expensesChartConfig: null,
			assetsChartConfig: null,
			investmentsChartConfig: null,
		});
	}

	setActiveView(activeView: ReportsView) {
		this.state.update(s => ({ ...s, activeView }));
	}

	async loadInvestmentTransactions(row: ReportRow, endDate: string): Promise<ReportInvestmentTransaction[]> {
		if (!row.account || !row.commodity || !endDate) return [];
		const csv = await this.plugin.runQuery(queries.getInvestmentTransactionsQuery(row.account, row.commodity, endDate));
		return this.parseInvestmentTransactionRows(csv);
	}

	async setPeriodMode(periodMode: ReportsPeriodMode) {
		const current = get(this.state);
		await this.loadData(periodMode, current.year, current.month, periodMode === 'year' ? 'custom-year' : 'custom-month');
	}

	async setPeriodPreset(periodPreset: ReportsPeriodPreset) {
		const selected = this.resolvePresetDate(periodPreset, new Date());
		await this.loadData(selected.mode, selected.year, selected.month, periodPreset);
	}

	async setMonth(month: number) {
		const current = get(this.state);
		const normalizedMonth = Math.min(12, Math.max(1, Math.trunc(month)));
		await this.loadData('month', current.year, normalizedMonth, 'custom-month');
	}

	async setYear(year: number) {
		const current = get(this.state);
		const normalizedYear = Number.isFinite(year) ? Math.max(1, Math.trunc(year)) : new Date().getFullYear();
		await this.loadData(current.periodMode, normalizedYear, current.month, current.periodMode === 'year' ? 'custom-year' : 'custom-month');
	}

	async movePeriod(delta: -1 | 1) {
		const current = get(this.state);
		let { year, month } = current;
		if (current.periodMode === 'month') {
			month += delta;
			if (month < 1) {
				month = 12;
				year -= 1;
			} else if (month > 12) {
				month = 1;
				year += 1;
			}
		} else {
			year += delta;
		}
		await this.loadData(current.periodMode, year, month, current.periodMode === 'year' ? 'custom-year' : 'custom-month');
	}

	async loadData(
		periodMode = get(this.state).periodMode,
		year = get(this.state).year,
		month = get(this.state).month,
		periodPreset = get(this.state).periodPreset
	) {
		const currency = this.plugin.settings.operatingCurrency;
		if (!currency) {
			this.state.update(s => ({ ...s, isLoading: false, error: 'Operating currency not set.' }));
			return;
		}

		const normalizedYear = Number.isFinite(year) ? Math.max(1, Math.trunc(year)) : new Date().getFullYear();
		const normalizedMonth = Number.isFinite(month) ? Math.min(12, Math.max(1, Math.trunc(month))) : new Date().getMonth() + 1;
		const range = this.getPeriodRange(periodMode, normalizedYear, normalizedMonth);
		this.state.update(s => ({
			...s,
			isLoading: true,
			error: null,
			currency,
			periodPreset,
			periodMode,
			year: normalizedYear,
			month: normalizedMonth,
			periodLabel: range.label,
			startDate: range.startDate,
			endDate: range.endDate,
		}));

		try {
			const [
				incomeCsv,
				expensesCsv,
				totalAssetsCsv,
				totalLiabilitiesCsv,
				netWorthCsv,
				incomeTransactionsCsv,
				expenseTransactionsCsv,
				counterpartAccountsCsv,
				assetsCsv,
				liabilitiesCsv,
				investmentsCsv,
			] = await Promise.all([
				this.plugin.runQuery(queries.getPeriodIncomeBreakdownQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodExpenseBreakdownQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getTotalAssetsQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getTotalLiabilitiesQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getTotalWorthQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getPeriodIncomeTransactionsQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodExpenseTransactionsQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodCounterpartAccountsQuery(range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getAssetAllocationQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getLiabilityAllocationQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getInvestmentAllocationQuery(currency, 2, range.endDate)),
			]);

			const incomeByAccount = this.parseAccountRows(incomeCsv);
			const expensesByAccount = this.parseAccountRows(expensesCsv);
			const incomeByCategory = this.groupRows(incomeByAccount, row => this.accountSegment(row.account, 1));
			const expensesByCategory = this.groupRows(expensesByAccount, row => this.accountSegment(row.account, 1));
			const assetsByAccount = this.parseAccountRows(assetsCsv).filter(row => row.amount > 0);
			const liabilitiesByAccount = this.parseAccountRows(liabilitiesCsv).filter(row => row.amount > 0);
			const assetsByCategory = this.groupRows(assetsByAccount, row => this.accountSegment(row.account, 1), true);
			const liabilitiesByCategory = this.groupRows(liabilitiesByAccount, row => this.accountSegment(row.account, 1), true);
			const investmentRows = this.parseInvestmentRows(investmentsCsv);
			const investmentsByType = this.groupRows(investmentRows, row => this.investmentType(row.account), true);
			const topInvestments = this.withPercent(
				investmentRows
					.filter(row => Math.abs(row.amount) >= 0.01)
					.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
					.slice(0, 20),
				investmentRows.reduce((sum, row) => sum + row.amount, 0)
			);

			const totalIncome = incomeByAccount.reduce((sum, row) => sum + row.amount, 0);
			const totalExpenses = expensesByAccount.reduce((sum, row) => sum + row.amount, 0);
			const totalAssets = this.parseSingleNumber(totalAssetsCsv);
			const totalLiabilities = this.parseSingleNumber(totalLiabilitiesCsv);
			const netWorth = this.parseSingleNumber(netWorthCsv);
			const counterpartAccounts = this.parseCounterpartRows(counterpartAccountsCsv);

			this.state.update(s => ({
				...s,
				isLoading: false,
				error: null,
				totalIncome,
				totalExpenses,
				netIncome: totalIncome - totalExpenses,
				totalAssets,
				totalLiabilities,
				netWorth,
				incomeByCategory: this.withPercent(incomeByCategory, totalIncome),
				expensesByCategory: this.withPercent(expensesByCategory, totalExpenses),
				incomeByAccount: this.withPercent(incomeByAccount, totalIncome),
				expensesByAccount: this.withPercent(expensesByAccount, totalExpenses),
				incomeTransactions: this.parseTransactionRows(incomeTransactionsCsv, counterpartAccounts),
				expenseTransactions: this.parseTransactionRows(expenseTransactionsCsv, counterpartAccounts),
				assetsByCategory: this.withPercent(assetsByCategory, totalAssets),
				assetsByAccount: this.withPercent(assetsByAccount, totalAssets),
				liabilitiesByCategory: this.withPercent(liabilitiesByCategory, totalLiabilities),
				liabilitiesByAccount: this.withPercent(liabilitiesByAccount, totalLiabilities),
				investmentsByType: this.withPercent(investmentsByType, investmentRows.reduce((sum, row) => sum + row.amount, 0)),
				investmentsByAccount: this.withPercent(investmentRows, investmentRows.reduce((sum, row) => sum + row.amount, 0)),
				topInvestments,
				incomeChartConfig: this.buildDoughnutConfig('Income', incomeByCategory, totalIncome, currency),
				expensesChartConfig: this.buildDoughnutConfig('Expenses', expensesByCategory, totalExpenses, currency),
				assetsChartConfig: this.buildDoughnutConfig('Assets', assetsByCategory, totalAssets, currency),
				investmentsChartConfig: this.buildDoughnutConfig('Investments', investmentsByType, investmentRows.reduce((sum, row) => sum + row.amount, 0), currency),
			}));
		} catch (e) {
			Logger.error('Error loading reports:', e);
			this.state.update(s => ({ ...s, isLoading: false, error: e instanceof Error ? e.message : String(e) }));
		}
	}

	private parseRows(rawCsv: string): CsvRow[] {
		const clean = rawCsv.replace(/\r/g, '').trim();
		if (!clean) return [];
		const records = parseCsv(clean, { columns: false, skip_empty_lines: true, relax_column_count: true }) as CsvRow[];
		if (records.length === 0) return [];
		const firstCell = (records[0]?.[0] || '').toLowerCase();
		const firstRowIsHeader = firstCell.includes('account') || firstCell.startsWith('_') || firstCell.includes('round(') || firstCell.includes('neg(');
		return firstRowIsHeader ? records.slice(1) : records;
	}

	private parseAccountRows(rawCsv: string): ReportRow[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 2)
			.map(row => ({
				label: this.accountLabel(row[0]),
				account: row[0],
				amount: this.parseNumber(row[1]),
				percent: 0,
			}))
			.filter(row => Math.abs(row.amount) >= 0.01)
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	}

	private parseInvestmentRows(rawCsv: string): ReportRow[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 3)
			.map(row => ({
				label: this.accountLabel(row[0]),
				account: row[0],
				commodity: row[1],
				commodityName: row.length >= 4 ? row[2] : undefined,
				amount: this.parseNumber(row.length >= 4 ? row[3] : row[2]),
				percent: 0,
			}))
			.filter(row => Math.abs(row.amount) >= 0.01)
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	}

	private parseTransactionRows(rawCsv: string, counterpartAccounts = new Map<string, string[]>()): ReportTransaction[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 5)
			.map(row => ({
				date: row[0],
				payee: row[1],
				narration: row[2],
				account: row[3],
				counterpartAccounts: counterpartAccounts.get(this.transactionKey(row[0], row[1], row[2])) || [],
				amount: this.parseNumber(row[4]),
			}))
			.filter(row => row.date && row.account && Math.abs(row.amount) >= 0.01);
	}

	private parseInvestmentTransactionRows(rawCsv: string): ReportInvestmentTransaction[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(row[0]))
			.map(row => ({
				date: row[0],
				payee: row[1],
				narration: row[2],
				account: row[3],
				position: row[4],
			}))
			.filter(row => row.position);
	}

	private parseCounterpartRows(rawCsv: string): Map<string, string[]> {
		const rowsByTransaction = new Map<string, string[]>();
		for (const row of this.parseRows(rawCsv)) {
			if (row.length < 4 || !row[0] || !row[3]) continue;
			const key = this.transactionKey(row[0], row[1], row[2]);
			const accounts = rowsByTransaction.get(key) || [];
			if (!accounts.includes(row[3])) accounts.push(row[3]);
			rowsByTransaction.set(key, accounts);
		}
		return rowsByTransaction;
	}

	private transactionKey(date: string, payee: string, narration: string): string {
		return [date || '', payee || '', narration || ''].join('\u001f');
	}

	private parseSingleNumber(rawCsv: string): number {
		const rows = this.parseRows(rawCsv);
		if (rows.length === 0 || rows[0].length === 0) return 0;
		return this.parseNumber(rows[0][0]);
	}

	private parseNumber(value: string): number {
		const match = (value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
		return match ? Number(match[0]) : 0;
	}

	private groupRows(rows: ReportRow[], labelFor: (row: ReportRow) => string, excludeNegative = false): ReportRow[] {
		const grouped = new Map<string, number>();
		for (const row of rows) {
			if (excludeNegative && row.amount <= 0) continue;
			const label = labelFor(row);
			grouped.set(label, (grouped.get(label) || 0) + row.amount);
		}
		return Array.from(grouped.entries())
			.map(([label, amount]) => ({ label, amount, percent: 0 }))
			.filter(row => Math.abs(row.amount) >= 0.01)
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	}

	private withPercent(rows: ReportRow[], total: number): ReportRow[] {
		if (!total) return rows.map(row => ({ ...row, percent: 0 }));
		return rows.map(row => ({ ...row, percent: (row.amount / total) * 100 }));
	}

	private accountSegment(account: string | undefined, index: number): string {
		const segment = (account || '').split(':')[index];
		return segment || account || 'Other';
	}

	private accountLabel(account: string | undefined): string {
		const parts = (account || '').split(':');
		return parts[parts.length - 1] || account || 'Other';
	}

	private investmentType(account: string | undefined): string {
		const segment = this.accountSegment(account, 2);
		return segment.split('-', 1)[0] || segment;
	}

	private getPeriodRange(periodMode: ReportsPeriodMode, year: number, month: number): { startDate: string; endDate: string; label: string } {
		if (periodMode === 'year') {
			return {
				startDate: `${year}-01-01`,
				endDate: `${year + 1}-01-01`,
				label: `${year}`,
			};
		}
		const start = new Date(year, month - 1, 1);
		const end = new Date(year, month, 1);
		return {
			startDate: this.formatDate(start),
			endDate: this.formatDate(end),
			label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
		};
	}

	private resolvePresetDate(periodPreset: ReportsPeriodPreset, now: Date): { mode: ReportsPeriodMode; year: number; month: number } {
		const current = get(this.state);
		switch (periodPreset) {
			case 'last-month': {
				const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				return { mode: 'month', year: previousMonth.getFullYear(), month: previousMonth.getMonth() + 1 };
			}
			case 'this-year':
				return { mode: 'year', year: now.getFullYear(), month: now.getMonth() + 1 };
			case 'last-year':
				return { mode: 'year', year: now.getFullYear() - 1, month: now.getMonth() + 1 };
			case 'custom-month':
				return { mode: 'month', year: current.year, month: current.month };
			case 'custom-year':
				return { mode: 'year', year: current.year, month: current.month };
			case 'this-month':
			default:
				return { mode: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
		}
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private buildDoughnutConfig(title: string, rows: ReportRow[], total: number, currency: string): ChartConfiguration | null {
		const chartRows = rows
			.filter(row => row.amount > 0)
			.slice(0, 8);
		if (chartRows.length === 0 || total <= 0) return null;

		return {
			type: 'doughnut',
			data: {
				labels: chartRows.map(row => row.label),
				datasets: [{
					data: chartRows.map(row => row.amount),
					backgroundColor: chartRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
					borderWidth: 1,
				}],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: { display: true, text: `${title} (${currency})` },
					legend: { position: 'bottom' },
					tooltip: {
						callbacks: {
							label: (context: { label: string; parsed: number }) => {
								const value = context.parsed || 0;
								const percent = total ? (value / total) * 100 : 0;
								return `${context.label}: ${value.toLocaleString()} ${currency} (${percent.toFixed(1)}%)`;
							},
						},
					},
				},
			},
		};
	}
}
