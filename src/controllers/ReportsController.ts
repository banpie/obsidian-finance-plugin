import { writable, type Writable, get } from 'svelte/store';
import { parse as parseCsv } from 'csv-parse/sync';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { Logger } from '../utils/logger';

export type ReportsPeriodMode = 'month' | 'year';
export type ReportsPeriodPreset = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom-month' | 'custom-year';
export type ReportsView = 'cashflow' | 'assets' | 'projects';

export interface ReportRow {
	label: string;
	account?: string;
	commodity?: string;
	commodityName?: string;
	amount: number;
	percent: number;
	quantity?: number | null;
	quantityRaw?: string;
	currentPrice?: number | null;
	costBasis?: number | null;
	costBasisRaw?: string;
	averageCost?: number | null;
	unrealizedGain?: number | null;
	unrealizedGainPercent?: number | null;
	costStatus?: 'available' | 'missing' | 'mixed-currency';
}

export interface ReportTransaction {
	date: string;
	payee: string;
	narration: string;
	account: string;
	counterpartAccounts: string[];
	amount: number;
}

export interface ReportProjectRow {
	label: string;
	tag: string;
	income: number;
	expenses: number;
	netIncome: number;
	transactionCount: number;
}

export interface ReportProjectTransaction extends ReportTransaction {
	projectLabel: string;
	projectTag: string;
	type: 'Income' | 'Expense';
}

export interface ReportInvestmentTransaction {
	key: string;
	date: string;
	payee: string;
	narration: string;
	type: string;
	quantity: string;
	unitCost: string;
	cashAmount: string;
	costBasis: string;
	accounts: string;
	postings: ReportInvestmentPosting[];
}

export interface ReportInvestmentPosting {
	account: string;
	position: string;
}

export interface ReportAccountTransaction {
	date: string;
	payee: string;
	narration: string;
	account: string;
	position: string;
	balance: string;
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
	projects: ReportProjectRow[];
	projectTransactions: ReportProjectTransaction[];
	incomeChartConfig: ChartConfiguration | null;
	expensesChartConfig: ChartConfiguration | null;
	assetsChartConfig: ChartConfiguration | null;
	investmentsChartConfig: ChartConfiguration | null;
}

type CsvRow = string[];

interface AmountCommodity {
	amount: number;
	commodity: string;
}

interface InvestmentCostBasis {
	amount: number;
	rawAmount: number;
	rawCommodity: string;
	source: 'cost' | 'total-price';
}

interface InvestmentPostingRow {
	date: string;
	payee: string;
	narration: string;
	account: string;
	position: string;
	units: string;
	cost: string;
}

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
		const defaultPreset = this.getDefaultPeriodPreset();
		const defaultPeriod = this.resolvePresetDate(defaultPreset, today);
		const range = this.getPeriodRange(defaultPeriod.mode, defaultPeriod.year, defaultPeriod.month);

		this.state = writable({
			isLoading: true,
			error: null,
			currency: plugin.settings.operatingCurrency || 'USD',
			activeView: 'cashflow',
			periodPreset: defaultPreset,
			periodMode: defaultPeriod.mode,
			year: defaultPeriod.year,
			month: defaultPeriod.month,
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
			projects: [],
			projectTransactions: [],
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
		const targetCsv = await this.plugin.runQuery(queries.getInvestmentTransactionsQuery(row.account, row.commodity, endDate));
		const targetPostings = this.parseInvestmentPostingRows(targetCsv);
		if (!targetPostings.length) return [];

		const earliestDate = targetPostings.reduce((min, posting) => posting.date < min ? posting.date : min, targetPostings[0].date);
		const allPostingsCsv = await this.plugin.runQuery(queries.getInvestmentTransactionPostingsQuery(earliestDate, endDate));
		const allPostings = this.parseInvestmentPostingRows(allPostingsCsv);
		return this.buildInvestmentTransactions(targetPostings, allPostings, row.account, row.commodity);
	}

	async loadAccountTransactions(row: ReportRow, startDate: string, endDate: string): Promise<ReportAccountTransaction[]> {
		if (!row.account || !startDate || !endDate) return [];
		const csv = await this.plugin.runQuery(queries.getAccountTransactionsQuery(row.account, startDate, endDate));
		return this.parseAccountTransactionRows(csv);
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
				projectIncomeCsv,
				projectExpensesCsv,
				projectTransactionsCsv,
				assetsCsv,
				liabilitiesCsv,
				investmentsCsv,
				investmentCostPostingsCsv,
			] = await Promise.all([
				this.plugin.runQuery(queries.getPeriodIncomeBreakdownQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodExpenseBreakdownQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getTotalAssetsQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getTotalLiabilitiesQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getTotalWorthQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getPeriodIncomeTransactionsQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodExpenseTransactionsQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodCounterpartAccountsQuery(range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodProjectIncomeQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodProjectExpenseQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getPeriodProjectTransactionsQuery(currency, 2, range.startDate, range.endDate)),
				this.plugin.runQuery(queries.getAssetAllocationQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getLiabilityAllocationQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getInvestmentAllocationQuery(currency, 2, range.endDate)),
				this.plugin.runQuery(queries.getInvestmentCostPostingsQuery(currency, range.endDate)),
			]);

			const incomeByAccount = this.parseAccountRows(incomeCsv);
			const expensesByAccount = this.parseAccountRows(expensesCsv);
			const incomeByCategory = this.groupRows(incomeByAccount, row => this.accountSegment(row.account, 1));
			const expensesByCategory = this.groupRows(expensesByAccount, row => this.accountSegment(row.account, 1));
			const assetsByAccount = this.parseAccountRows(assetsCsv).filter(row => row.amount > 0);
			const liabilitiesByAccount = this.parseAccountRows(liabilitiesCsv).filter(row => row.amount > 0);
			const assetsByCategory = this.groupRows(assetsByAccount, row => this.accountSegment(row.account, 1), true);
			const liabilitiesByCategory = this.groupRows(liabilitiesByAccount, row => this.accountSegment(row.account, 1), true);
			const investmentCostBasis = this.parseInvestmentCostBasisRows(investmentCostPostingsCsv, currency);
			const investmentRows = this.parseInvestmentRows(investmentsCsv, investmentCostBasis, currency);
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
			const projectTransactions = this.parseProjectTransactionRows(projectTransactionsCsv, counterpartAccounts);
			const projects = this.buildProjectRows(projectIncomeCsv, projectExpensesCsv, projectTransactions);

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
				projects,
				projectTransactions,
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

	private parseInvestmentRows(rawCsv: string, costBasisByHolding = new Map<string, InvestmentCostBasis>(), operatingCurrency = this.plugin.settings.operatingCurrency): ReportRow[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 3)
			.map(row => this.parseInvestmentRow(row, costBasisByHolding, operatingCurrency))
			.filter(row => Math.abs(row.amount) >= 0.01)
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	}

	private parseInvestmentRow(row: CsvRow, costBasisByHolding: Map<string, InvestmentCostBasis>, operatingCurrency: string): ReportRow {
		const hasNameColumn = row.length >= 4;
		const account = row[0];
		const commodity = row[1];
		const commodityName = hasNameColumn ? row[2] : undefined;
		const amount = this.parseNumber(hasNameColumn ? row[3] : row[2]);
		const quantityRaw = hasNameColumn ? row[4] || '' : '';
		const aggregateCostBasisRaw = hasNameColumn ? row[5] || '' : '';
		const aggregateCostBasis = hasNameColumn ? this.parseOptionalNumber(row[6] || '') : null;
		const quantityAmount = this.parseAmountCommodity(quantityRaw).amount;
		const currentPrice = quantityAmount ? Math.abs(amount / quantityAmount) : null;
		const aggregateCostCommodity = this.parseAmountCommodity(aggregateCostBasisRaw).commodity;
		const derivedCostBasis = costBasisByHolding.get(this.investmentHoldingKey(account, commodity));
		const aggregateHasCost = aggregateCostCommodity && (aggregateCostCommodity !== commodity || commodity === operatingCurrency);
		const costBasis = derivedCostBasis
			? this.roundCurrency(derivedCostBasis.amount)
			: aggregateHasCost
				? aggregateCostBasis
				: null;
		const costBasisRaw = derivedCostBasis
			? this.formatInvestmentCostBasisRaw(derivedCostBasis, operatingCurrency)
			: aggregateCostBasisRaw;
		const costBasisCommodity = derivedCostBasis ? operatingCurrency : aggregateCostCommodity;
		const costStatus = this.investmentCostStatus(costBasis, costBasisRaw, costBasisCommodity, commodity, amount);
		const averageCost = costStatus === 'available' && costBasis !== null && quantityAmount
			? Math.abs(costBasis / quantityAmount)
			: null;
		const unrealizedGain = costStatus === 'available' && costBasis !== null
			? this.roundCurrency(amount - costBasis)
			: null;
		const unrealizedGainPercent = unrealizedGain !== null && costBasis
			? (unrealizedGain / Math.abs(costBasis)) * 100
			: null;

		return {
			label: this.accountLabel(account),
			account,
			commodity,
			commodityName,
			amount,
			percent: 0,
			quantity: quantityAmount || null,
			quantityRaw,
			currentPrice,
			costBasis,
			costBasisRaw,
			averageCost,
			unrealizedGain,
			unrealizedGainPercent,
			costStatus,
		};
	}

	private investmentCostStatus(
		costBasis: number | null,
		costBasisRaw: string,
		costBasisCommodity: string,
		holdingCommodity: string,
		currentValue: number
	): ReportRow['costStatus'] {
		const hasCurrentValue = Math.abs(currentValue) >= 0.01;
		const normalizedCostRaw = costBasisRaw.trim();
		if (hasCurrentValue && costBasis === 0) {
			return 'missing';
		}
		if (costBasis !== null) return 'available';
		if (!normalizedCostRaw || normalizedCostRaw === '()') return 'missing';
		if (costBasisCommodity && costBasisCommodity !== holdingCommodity) return 'mixed-currency';
		return 'missing';
	}

	private parseInvestmentCostBasisRows(rawCsv: string, operatingCurrency: string): Map<string, InvestmentCostBasis> {
		const costByHolding = new Map<string, InvestmentCostBasis>();
		for (const row of this.parseRows(rawCsv)) {
			if (row.length < 6) continue;
			const [account, commodity, position, units, costRaw, costConvertedRaw, sourcePriceRaw, confirmedPriceRaw] = row;
			const quantity = this.parseAmountCommodity(units || position);
			if (!account || !commodity || !quantity.amount) continue;

			const costRawAmount = this.parseAmountCommodity(costRaw);
			const convertedCost = this.parseOptionalNumber(costConvertedRaw);
			const sourcePrice = this.parseOptionalNumber(sourcePriceRaw || '');
			const confirmedPrice = this.parseOptionalNumber(confirmedPriceRaw || '');
			let costAmount: number | null = null;
			let rawAmount: number | null = null;
			let rawCommodity = '';
			let source: InvestmentCostBasis['source'] = 'cost';

			if (costRawAmount.commodity && costRawAmount.commodity !== commodity && convertedCost !== null) {
				costAmount = convertedCost;
				rawAmount = costRawAmount.amount;
				rawCommodity = costRawAmount.commodity;
			} else if (sourcePrice !== null || confirmedPrice !== null) {
				costAmount = quantity.amount * (sourcePrice ?? confirmedPrice ?? 0);
				rawAmount = costAmount;
				rawCommodity = operatingCurrency;
				source = 'total-price';
			} else if (commodity === operatingCurrency && costRawAmount.commodity === operatingCurrency) {
				costAmount = costRawAmount.amount;
				rawAmount = costRawAmount.amount;
				rawCommodity = operatingCurrency;
			}

			if (costAmount === null || rawAmount === null) continue;
			const key = this.investmentHoldingKey(account, commodity);
			const current = costByHolding.get(key);
			const nextAmount = (current?.amount || 0) + costAmount;
			const canKeepRawCost = !current || current.rawCommodity === rawCommodity;
			costByHolding.set(key, {
				amount: nextAmount,
				rawAmount: current
					? canKeepRawCost
						? current.rawAmount + rawAmount
						: nextAmount
					: rawAmount,
				rawCommodity: canKeepRawCost ? rawCommodity : operatingCurrency,
				source: current?.source === 'cost' && source === 'cost' ? 'cost' : source,
			});
		}
		return costByHolding;
	}

	private investmentHoldingKey(account: string, commodity: string): string {
		return `${account}\u001f${commodity}`;
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

	private parseProjectTransactionRows(rawCsv: string, counterpartAccounts = new Map<string, string[]>()): ReportProjectTransaction[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 7)
			.map(row => {
				const rawAmount = this.parseNumber(row[6]);
				const type: 'Income' | 'Expense' = row[3].startsWith('Income') ? 'Income' : 'Expense';
				return {
					date: row[0],
					payee: row[1],
					narration: row[2],
					account: row[3],
					counterpartAccounts: counterpartAccounts.get(this.transactionKey(row[0], row[1], row[2])) || [],
					projectLabel: this.projectLabel(row[4], row[5]),
					projectTag: this.projectTag(row[5]),
					type,
					amount: -rawAmount,
				};
			})
			.filter(row => row.date && row.account && Math.abs(row.amount) >= 0.01);
	}

	private buildProjectRows(
		incomeCsv: string,
		expensesCsv: string,
		transactions: ReportProjectTransaction[]
	): ReportProjectRow[] {
		const projects = new Map<string, ReportProjectRow>();
		const ensureProject = (label: string, tag: string): ReportProjectRow => {
			const normalizedLabel = this.projectLabel(label, tag);
			const normalizedTag = this.projectTag(tag);
			const key = this.projectKey(normalizedLabel, normalizedTag);
			const existing = projects.get(key);
			if (existing) return existing;
			const row = {
				label: normalizedLabel,
				tag: normalizedTag,
				income: 0,
				expenses: 0,
				netIncome: 0,
				transactionCount: 0,
			};
			projects.set(key, row);
			return row;
		};

		for (const row of this.parseRows(incomeCsv).filter(row => row.length >= 3)) {
			const project = ensureProject(row[0], row[1]);
			project.income += this.parseNumber(row[2]);
		}

		for (const row of this.parseRows(expensesCsv).filter(row => row.length >= 3)) {
			const project = ensureProject(row[0], row[1]);
			project.expenses += this.parseNumber(row[2]);
		}

		const transactionKeysByProject = new Map<string, Set<string>>();
		for (const transaction of transactions) {
			const project = ensureProject(transaction.projectLabel, transaction.projectTag);
			const key = this.projectKey(project.label, project.tag);
			const transactionKeys = transactionKeysByProject.get(key) || new Set<string>();
			transactionKeys.add(this.transactionKey(transaction.date, transaction.payee, transaction.narration));
			transactionKeysByProject.set(key, transactionKeys);
		}

		return Array.from(projects.values())
			.map(row => ({
				...row,
				income: this.roundCurrency(row.income),
				expenses: this.roundCurrency(row.expenses),
				netIncome: this.roundCurrency(row.income - row.expenses),
				transactionCount: transactionKeysByProject.get(this.projectKey(row.label, row.tag))?.size || 0,
			}))
			.filter(row => Math.abs(row.income) >= 0.01 || Math.abs(row.expenses) >= 0.01 || row.transactionCount > 0)
			.sort((a, b) => {
				if (a.label === 'Unassigned') return 1;
				if (b.label === 'Unassigned') return -1;
				return Math.abs(b.netIncome) - Math.abs(a.netIncome);
			});
	}

	private parseInvestmentPostingRows(rawCsv: string): InvestmentPostingRow[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(row[0]))
			.map(row => ({
				date: row[0],
				payee: row[1],
				narration: row[2],
				account: row[3],
				position: row[4],
				units: row[5] || '',
				cost: row[6] || '',
			}))
			.filter(row => row.position);
	}

	private parseAccountTransactionRows(rawCsv: string): ReportAccountTransaction[] {
		return this.parseRows(rawCsv)
			.filter(row => row.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(row[0]))
			.map(row => ({
				date: row[0],
				payee: row[1],
				narration: row[2],
				account: row[3],
				position: row[4],
				balance: row[5] || '',
			}))
			.filter(row => row.position);
	}

	private buildInvestmentTransactions(
		targetPostings: InvestmentPostingRow[],
		allPostings: InvestmentPostingRow[],
		targetAccount: string,
		commodity: string
	): ReportInvestmentTransaction[] {
		const targetByKey = this.groupByTransaction(targetPostings);
		const allByKey = this.groupByTransaction(allPostings);

		return Array.from(targetByKey.entries()).map(([key, targetRows]) => {
			const postings = allByKey.get(key) || targetRows;
			const targetQuantity = this.sumAmounts(targetRows.map(row => this.parseAmountCommodity(row.units || row.position)), commodity);
			const targetCost = this.sumAmountStrings(targetRows.map(row => row.cost).filter(Boolean));
			const cashAmount = this.sumAmountStrings(
				postings
					.filter(posting => !this.positionUsesCommodity(posting.position, commodity) && this.isBalanceSheetAccount(posting.account))
					.map(posting => posting.position)
			);
			const unitCost = targetCost.amount !== null && targetQuantity.amount
				? this.formatAmountCommodity(Math.abs(targetCost.amount / targetQuantity.amount), targetCost.commodity)
				: '';
			const transferAccounts = postings
				.filter(posting => this.positionUsesCommodity(posting.position, commodity))
				.map(posting => ({
					account: posting.account,
					amount: this.parseAmountCommodity(posting.units || posting.position).amount,
				}));
			const fromAccounts = transferAccounts.filter(row => row.amount < 0).map(row => row.account);
			const toAccounts = transferAccounts.filter(row => row.amount > 0).map(row => row.account);
			const first = targetRows[0];

			return {
				key,
				date: first.date,
				payee: first.payee,
				narration: first.narration,
				type: this.inferInvestmentTransactionType(targetQuantity.amount, fromAccounts, toAccounts, targetAccount, cashAmount.amount),
				quantity: this.formatAmountCommodity(targetQuantity.amount, commodity),
				unitCost,
				cashAmount: cashAmount.amount !== null ? this.formatAmountCommodity(cashAmount.amount, cashAmount.commodity) : '',
				costBasis: targetCost.amount !== null ? this.formatAmountCommodity(targetCost.amount, targetCost.commodity) : '',
				accounts: this.investmentTransactionAccounts(fromAccounts, toAccounts, targetAccount),
				postings: postings.map(posting => ({
					account: posting.account,
					position: posting.position,
				})),
			};
		});
	}

	private groupByTransaction(rows: InvestmentPostingRow[]): Map<string, InvestmentPostingRow[]> {
		const grouped = new Map<string, InvestmentPostingRow[]>();
		for (const row of rows) {
			const key = this.transactionKey(row.date, row.payee, row.narration);
			const group = grouped.get(key) || [];
			group.push(row);
			grouped.set(key, group);
		}
		return grouped;
	}

	private inferInvestmentTransactionType(quantity: number, fromAccounts: string[], toAccounts: string[], targetAccount: string, cashAmount: number | null): string {
		const hasTransferCounterpart = quantity > 0
			? fromAccounts.some(account => account !== targetAccount)
			: toAccounts.some(account => account !== targetAccount);
		if (hasTransferCounterpart) return 'Transfer';
		if (quantity > 0 && cashAmount !== null && cashAmount < 0) return 'Buy';
		if (quantity < 0 && cashAmount !== null && cashAmount > 0) return 'Sell';
		if (quantity > 0) return 'Increase';
		if (quantity < 0) return 'Decrease';
		return 'Other';
	}

	private investmentTransactionAccounts(fromAccounts: string[], toAccounts: string[], targetAccount: string): string {
		const from = this.uniqueAccounts(fromAccounts.filter(account => account !== targetAccount)).map(account => this.accountLabel(account)).join(', ');
		const to = this.uniqueAccounts(toAccounts.filter(account => account !== targetAccount)).map(account => this.accountLabel(account)).join(', ');
		if (from || to) return `${from || this.accountLabel(targetAccount)} -> ${to || this.accountLabel(targetAccount)}`;
		return this.accountLabel(targetAccount);
	}

	private uniqueAccounts(accounts: string[]): string[] {
		return Array.from(new Set(accounts));
	}

	private isBalanceSheetAccount(account: string): boolean {
		return /^(Assets|Liabilities):/.test(account);
	}

	private positionUsesCommodity(position: string, commodity: string): boolean {
		return this.parseAmountCommodity(position).commodity === commodity;
	}

	private sumAmounts(amounts: AmountCommodity[], preferredCommodity?: string): AmountCommodity {
		const commodity = preferredCommodity || amounts.find(amount => amount.commodity)?.commodity || '';
		return {
			amount: amounts.filter(amount => amount.commodity === commodity).reduce((sum, amount) => sum + amount.amount, 0),
			commodity,
		};
	}

	private sumAmountStrings(values: string[]): { amount: number | null; commodity: string } {
		const amounts = values.map(value => this.parseAmountCommodity(value)).filter(value => value.commodity);
		if (!amounts.length) return { amount: null, commodity: '' };
		const commodity = amounts[0].commodity;
		const sameCurrencyAmounts = amounts.filter(amount => amount.commodity === commodity);
		if (sameCurrencyAmounts.length !== amounts.length) return { amount: null, commodity: '' };
		return {
			amount: sameCurrencyAmounts.reduce((sum, amount) => sum + amount.amount, 0),
			commodity,
		};
	}

	private parseAmountCommodity(value: string): AmountCommodity {
		const match = (value || '').replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9._-]*)/);
		return {
			amount: match ? Number(match[1]) : 0,
			commodity: match ? match[2] : '',
		};
	}

	private parseTotalPrice(value: string): AmountCommodity | null {
		const match = (value || '').replace(/,/g, '').match(/@@\s*(-?\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9._-]*)/);
		if (!match) return null;
		return {
			amount: Number(match[1]),
			commodity: match[2],
		};
	}

	private formatAmountCommodity(amount: number, commodity: string): string {
		if (!commodity) return '';
		const maximumFractionDigits = Number.isInteger(amount) ? 0 : 4;
		return `${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits })} ${commodity}`;
	}

	private formatInvestmentCostBasisRaw(costBasis: InvestmentCostBasis, operatingCurrency: string): string {
		const converted = `${this.roundCurrency(costBasis.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${operatingCurrency}`;
		if (!costBasis.rawCommodity || costBasis.rawCommodity === operatingCurrency) return converted;
		return `${this.formatAmountCommodity(costBasis.rawAmount, costBasis.rawCommodity)} -> ${converted}`;
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

	private parseOptionalNumber(value: string): number | null {
		const match = (value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
		return match ? Number(match[0]) : null;
	}

	private roundCurrency(value: number): number {
		return Math.round(value * 100) / 100;
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

	private projectLabel(label: string | undefined, tag: string | undefined): string {
		const normalized = (label || '').trim();
		if (normalized) return normalized;
		const normalizedTag = this.projectTag(tag);
		return normalizedTag ? normalizedTag : 'Unassigned';
	}

	private projectTag(tag: string | undefined): string {
		return (tag || '').trim();
	}

	private projectKey(label: string, tag: string): string {
		return `${label || 'Unassigned'}\u001f${tag || ''}`;
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
			label: `${year}-${this.pad2(month)}`,
		};
	}

	private resolvePresetDate(periodPreset: ReportsPeriodPreset, now: Date): { mode: ReportsPeriodMode; year: number; month: number } {
		const current = this.state ? get(this.state) : { year: now.getFullYear(), month: now.getMonth() + 1 };
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
		const month = this.pad2(date.getMonth() + 1);
		const day = this.pad2(date.getDate());
		return `${year}-${month}-${day}`;
	}

	private pad2(value: number): string {
		return String(value).padStart(2, '0');
	}

	private getDefaultPeriodPreset(): ReportsPeriodPreset {
		const preset = this.plugin.settings.dashboardDefaultPeriod;
		if (preset === 'last-month' || preset === 'this-year' || preset === 'last-year') {
			return preset;
		}
		return 'this-month';
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
