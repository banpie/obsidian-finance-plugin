<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import type { ReportsController, ReportsState, ReportRow, ReportTransaction, ReportInvestmentTransaction, ReportAccountTransaction, ReportProjectRow, ReportProjectTransaction, ReportsPeriodPreset, ReportsView } from '../../../controllers/ReportsController';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';

	export let controller: ReportsController;

	type DetailKind = 'income' | 'expense' | 'asset' | 'liability' | 'networth' | 'investment' | 'project';

	interface DetailSelection {
		kind: DetailKind;
		title: string;
		amount: number;
		category: string | null;
		projectTag?: string;
		projectType?: 'Income' | 'Expense';
		summary?: boolean;
	}

	interface DetailGroup {
		label: string;
		amount: number;
		rows: ReportRow[];
	}

	const placeholderState: Writable<ReportsState> = writable({
		isLoading: true,
		error: null,
		currency: 'USD',
		activeView: 'cashflow',
		periodPreset: 'this-month',
		periodMode: 'month',
		year: new Date().getFullYear(),
		month: new Date().getMonth() + 1,
		periodLabel: '',
		startDate: '',
		endDate: '',
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

	let detailSelection: DetailSelection | null = null;
	let holdingSelection: ReportRow | null = null;
	let holdingTransactions: ReportInvestmentTransaction[] = [];
	let holdingTransactionsLoading = false;
	let holdingTransactionsError: string | null = null;
	let expandedHoldingTransactions = new Set<string>();
	let accountSelection: ReportRow | null = null;
	let accountTransactions: ReportAccountTransaction[] = [];
	let accountTransactionsLoading = false;
	let accountTransactionsError: string | null = null;
	const months = [
		{ value: 1, label: 'January' },
		{ value: 2, label: 'February' },
		{ value: 3, label: 'March' },
		{ value: 4, label: 'April' },
		{ value: 5, label: 'May' },
		{ value: 6, label: 'June' },
		{ value: 7, label: 'July' },
		{ value: 8, label: 'August' },
		{ value: 9, label: 'September' },
		{ value: 10, label: 'October' },
		{ value: 11, label: 'November' },
		{ value: 12, label: 'December' },
	];
	const periodPresets = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'last-year', label: 'Last Year' },
		{ value: 'custom-month', label: 'Custom Month' },
		{ value: 'custom-year', label: 'Custom Year' },
	];

	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;

	function formatCurrency(value: number): string {
		return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.currency}`;
	}

	function formatPercent(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	function barWidth(row: ReportRow): string {
		return `${Math.min(Math.abs(row.percent), 100).toFixed(1)}%`;
	}

	function detailPercent(amount: number, total: number): string {
		if (!total) return '0.0%';
		return formatPercent((amount / total) * 100);
	}

	function amountClass(value: number): string {
		if (value > 0) return 'positive';
		if (value < 0) return 'negative';
		return '';
	}

	function majorCategory(account: string | undefined): string {
		const parts = (account || '').split(':');
		return parts[1] || account || 'Other';
	}

	function investmentType(account: string | undefined): string {
		const segment = (account || '').split(':')[2] || account || 'Other';
		return segment.split('-', 1)[0] || segment;
	}

	function detailAccountLabel(account: string | undefined): string {
		const parts = (account || '').split(':');
		return parts.slice(2).join(':') || parts[1] || account || 'Other';
	}

	function rowsForCategory<T extends { account?: string }>(rows: T[], category: string | null): T[] {
		if (!category) return rows;
		return rows.filter(row => majorCategory(row.account) === category);
	}

	function rowsForInvestmentType(rows: ReportRow[], type: string | null): ReportRow[] {
		if (!type) return rows;
		return rows.filter(row => investmentType(row.account) === type);
	}

	function asNetWorthLiabilityRow(row: ReportRow): ReportRow {
		return {
			...row,
			amount: -row.amount,
		};
	}

	function transactionLabel(transaction: ReportTransaction): string {
		return transaction.narration || transaction.payee || '';
	}

	function transactionTypeLabel(transaction: ReportTransaction): string {
		return 'type' in transaction ? (transaction as ReportProjectTransaction).type : '';
	}

	function counterpartLabel(transaction: ReportTransaction): string {
		const accounts = transaction.counterpartAccounts || [];
		if (!accounts.length) return '—';
		return accounts.map(account => detailAccountLabel(account)).join(', ');
	}

	function counterpartTitle(transaction: ReportTransaction): string {
		return (transaction.counterpartAccounts || []).join(', ');
	}

	function isCashFlowDetail(kind: DetailKind): boolean {
		return kind === 'income' || kind === 'expense' || kind === 'project';
	}

	function detailSectionTitle(kind: DetailKind): string {
		if (kind === 'investment') return detailSelection?.summary ? 'Holdings by Type' : 'Current Holdings';
		if (kind === 'asset' || kind === 'liability' || kind === 'networth') return detailSelection?.summary ? 'Balances by Category' : 'Current Balances';
		if (kind === 'project') return 'Project Transactions';
		if (detailSelection?.category) return 'Selected Category';
		return 'Category Breakdown';
	}

	function detailRowLabel(row: ReportRow): string {
		return row.account ? detailAccountLabel(row.account) : row.label;
	}

	function commodityNameLabel(row: ReportRow): string {
		const name = (row.commodityName || '').trim();
		if (name && row.commodity !== state.currency) return name;
		return row.label || row.commodity || '';
	}

	function assetDetailGroups(): DetailGroup[] {
		return state.assetsByCategory.map(group => ({
			label: group.label,
			amount: group.amount,
			rows: group.label === 'Investments'
				? state.investmentsByAccount
				: rowsForCategory(state.assetsByAccount, group.label),
		}));
	}

	function liabilityDetailGroups(): DetailGroup[] {
		return state.liabilitiesByCategory.map(group => ({
			label: group.label,
			amount: group.amount,
			rows: rowsForCategory(state.liabilitiesByAccount, group.label),
		}));
	}

	function netWorthDetailGroups(): DetailGroup[] {
		return [
			...assetDetailGroups(),
			...state.liabilitiesByCategory.map(group => ({
				label: `Liabilities / ${group.label}`,
				amount: -group.amount,
				rows: rowsForCategory(state.liabilitiesByAccount, group.label).map(asNetWorthLiabilityRow),
			})),
		];
	}

	function investmentDetailGroups(): DetailGroup[] {
		return state.investmentsByType.map(group => ({
			label: group.label,
			amount: group.amount,
			rows: rowsForInvestmentType(state.investmentsByAccount, group.label),
		}));
	}

	function openDetails(kind: DetailKind, title: string, amount: number, category: string | null = null, summary = false) {
		detailSelection = { kind, title, amount, category, summary };
	}

	function openProjectDetails(project: ReportProjectRow) {
		detailSelection = {
			kind: 'project',
			title: project.label,
			amount: project.netIncome,
			category: project.label,
			projectTag: project.tag,
		};
	}

	function openProjectSummaryDetails(title: string, amount: number, projectType?: 'Income' | 'Expense') {
		detailSelection = {
			kind: 'project',
			title,
			amount,
			category: null,
			projectType,
			summary: true,
		};
	}

	function canGoBackInDetails(): boolean {
		if (!detailSelection) return false;
		if (detailSelection.kind === 'income') return detailSelection.title !== 'Income';
		if (detailSelection.kind === 'expense') return detailSelection.title !== 'Expenses';
		if (detailSelection.kind === 'project') return !detailSelection.summary;
		return Boolean(
			detailSelection?.category
			&& (detailSelection.kind === 'income' || detailSelection.kind === 'expense' || detailSelection.kind === 'project')
		);
	}

	function goBackInDetails() {
		if (!detailSelection) return;
		if (detailSelection.kind === 'income') {
			openDetails('income', 'Income', state.totalIncome);
		} else if (detailSelection.kind === 'expense') {
			openDetails('expense', 'Expenses', state.totalExpenses);
		} else if (detailSelection.kind === 'project') {
			openProjectSummaryDetails('Project Net Income', projectNetIncomeTotal);
		}
	}

	function closeOnBlankClick(event: MouseEvent, close: () => void) {
		const target = event.target as HTMLElement | null;
		const contentSelector = 'table, button, a, input, select, textarea, [role="button"], .chart-box, .metric-card, .breakdown-row';
		if (!target || !target.closest(contentSelector)) {
			close();
		}
	}

	function canOpenHoldingTransactions(row: ReportRow): boolean {
		return Boolean(row.account && row.commodity);
	}

	function canOpenAccountTransactions(row: ReportRow): boolean {
		return Boolean(row.account && !row.commodity);
	}

	function canOpenDetailRow(row: ReportRow): boolean {
		return canOpenHoldingTransactions(row) || canOpenAccountTransactions(row);
	}

	function canOpenCashFlowCategory(row: ReportRow): boolean {
		return Boolean(
			detailSelection
			&& (detailSelection.kind === 'income' || detailSelection.kind === 'expense')
			&& !detailSelection.category
			&& row.label
		);
	}

	function detailDisplayLabel(row: ReportRow): string {
		if (detailSelection?.kind !== 'investment' && row.commodity) return commodityNameLabel(row);
		return detailRowLabel(row);
	}

	function closeDetails() {
		detailSelection = null;
	}

	async function openHoldingTransactions(row: ReportRow) {
		holdingSelection = row;
		holdingTransactions = [];
		holdingTransactionsError = null;
		holdingTransactionsLoading = true;
		expandedHoldingTransactions = new Set();
		try {
			holdingTransactions = controller ? await controller.loadInvestmentTransactions(row, state.endDate) : [];
		} catch (error) {
			holdingTransactionsError = error instanceof Error ? error.message : String(error);
		} finally {
			holdingTransactionsLoading = false;
		}
	}

	function closeHoldingTransactions() {
		holdingSelection = null;
		holdingTransactions = [];
		holdingTransactionsError = null;
		holdingTransactionsLoading = false;
		expandedHoldingTransactions = new Set();
	}

	async function openAccountTransactions(row: ReportRow) {
		if (!canOpenAccountTransactions(row)) return;
		accountSelection = row;
		accountTransactions = [];
		accountTransactionsError = null;
		accountTransactionsLoading = true;
		try {
			accountTransactions = controller ? await controller.loadAccountTransactions(row, state.startDate, state.endDate) : [];
		} catch (error) {
			accountTransactionsError = error instanceof Error ? error.message : String(error);
		} finally {
			accountTransactionsLoading = false;
		}
	}

	function closeAccountTransactions() {
		accountSelection = null;
		accountTransactions = [];
		accountTransactionsError = null;
		accountTransactionsLoading = false;
	}

	function toggleHoldingTransaction(key: string) {
		const next = new Set(expandedHoldingTransactions);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		expandedHoldingTransactions = next;
	}

	function holdingTransactionLabel(transaction: ReportInvestmentTransaction): string {
		return transaction.narration || transaction.payee || '';
	}

	function accountTransactionLabel(transaction: ReportAccountTransaction): string {
		return transaction.narration || transaction.payee || '';
	}

	function handleHoldingRowKeydown(event: KeyboardEvent, row: ReportRow) {
		if (!canOpenDetailRow(row)) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		if (canOpenHoldingTransactions(row)) {
			openHoldingTransactions(row);
		} else {
			openAccountTransactions(row);
		}
	}

	function handleProjectRowKeydown(event: KeyboardEvent, project: ReportProjectRow) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openProjectDetails(project);
	}

	function handleCashFlowCategoryRow(row: ReportRow) {
		if (!detailSelection || !canOpenCashFlowCategory(row)) return;
		openDetails(detailSelection.kind, row.label, row.amount, row.label);
	}

	function handleCashFlowCategoryKeydown(event: KeyboardEvent, row: ReportRow) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!canOpenCashFlowCategory(row)) return;
		event.preventDefault();
		handleCashFlowCategoryRow(row);
	}

	function handleHoldingRowClick(event: MouseEvent, row: ReportRow) {
		if (!canOpenDetailRow(row)) return;
		const selection = window.getSelection();
		if (selection && selection.toString()) return;
		if (event.detail === 0) return;
		if (canOpenHoldingTransactions(row)) {
			openHoldingTransactions(row);
		} else {
			openAccountTransactions(row);
		}
	}

	function rowsForProjectTransactions(
		rows: ReportProjectTransaction[],
		label: string | null,
		tag: string | undefined,
		type: 'Income' | 'Expense' | undefined
	): ReportProjectTransaction[] {
		return rows.filter(row => {
			const projectMatches = label === null && tag === undefined
				? true
				: row.projectLabel === (label || 'Unassigned') && row.projectTag === (tag || '');
			const typeMatches = type ? row.type === type : true;
			return projectMatches && typeMatches;
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (holdingSelection) {
			closeHoldingTransactions();
		} else if (accountSelection) {
			closeAccountTransactions();
		} else if (detailSelection) {
			closeDetails();
		}
	}

	$: investmentTotal = state.investmentsByType.reduce((sum, row) => sum + row.amount, 0);
	$: detailAccounts = detailSelection
		? detailSelection.kind === 'income'
			? detailSelection.category
				? state.incomeByCategory.filter(row => row.label === detailSelection?.category)
				: state.incomeByCategory
			: detailSelection.kind === 'expense'
				? detailSelection.category
					? state.expensesByCategory.filter(row => row.label === detailSelection?.category)
					: state.expensesByCategory
				: detailSelection.kind === 'asset'
					? detailSelection.summary ? [] : rowsForCategory(state.assetsByAccount, detailSelection.category)
					: detailSelection.kind === 'liability'
						? detailSelection.summary ? [] : rowsForCategory(state.liabilitiesByAccount, detailSelection.category)
						: detailSelection.kind === 'investment'
							? detailSelection.summary ? [] : rowsForInvestmentType(state.investmentsByAccount, detailSelection.category)
							: []
		: [];
	$: detailGroups = detailSelection?.summary
		? detailSelection.kind === 'asset'
			? assetDetailGroups()
			: detailSelection.kind === 'liability'
				? liabilityDetailGroups()
				: detailSelection.kind === 'networth'
					? netWorthDetailGroups()
					: detailSelection.kind === 'investment'
						? investmentDetailGroups()
						: []
		: [];
	$: detailTransactions = detailSelection
		? detailSelection.kind === 'income'
			? rowsForCategory(state.incomeTransactions, detailSelection.category)
			: detailSelection.kind === 'expense'
				? rowsForCategory(state.expenseTransactions, detailSelection.category)
				: detailSelection.kind === 'project'
					? rowsForProjectTransactions(state.projectTransactions, detailSelection.category, detailSelection.projectTag, detailSelection.projectType)
					: []
		: [];
	$: projectIncomeTotal = state.projects.reduce((sum, row) => sum + row.income, 0);
	$: projectExpensesTotal = state.projects.reduce((sum, row) => sum + row.expenses, 0);
	$: projectNetIncomeTotal = state.projects.reduce((sum, row) => sum + row.netIncome, 0);

	async function handlePeriodPresetChange(event: Event) {
		const preset = (event.currentTarget as HTMLSelectElement).value as ReportsPeriodPreset;
		if (controller) await controller.setPeriodPreset(preset);
	}

	function handleViewChange(view: ReportsView) {
		controller?.setActiveView(view);
	}

	async function handleMonthChange(event: Event) {
		const value = Number((event.target as HTMLSelectElement).value);
		if (controller) await controller.setMonth(value);
	}

	async function handleYearChange(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		if (controller && Number.isFinite(value)) await controller.setYear(value);
	}

	async function handleRefresh() {
		if (controller) await controller.loadData();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="reports-tab">
	<div class="reports-header">
		<div>
			<h2>Reports</h2>
			<div class="period-label">{state.periodLabel}</div>
		</div>

		<div class="report-controls">
			<div class="toolbar-group">
				<div class="segmented-control primary-switch" aria-label="Report view">
					<button class:active={state.activeView === 'cashflow'} on:click={() => handleViewChange('cashflow')}>Cash Flow</button>
					<button class:active={state.activeView === 'assets'} on:click={() => handleViewChange('assets')}>Assets</button>
					<button class:active={state.activeView === 'projects'} on:click={() => handleViewChange('projects')}>Projects</button>
				</div>
			</div>
			<div class="period-controls">
				<div class="toolbar-group period-picker">
					<label>
						<span>Period</span>
						<select value={state.periodPreset} on:change={handlePeriodPresetChange} disabled={state.isLoading}>
							{#each periodPresets as preset}
								<option value={preset.value}>{preset.label}</option>
							{/each}
						</select>
					</label>
					{#if state.periodPreset === 'custom-month' || state.periodPreset === 'custom-year'}
						<label>
							<span>Year</span>
							<input type="number" min="1970" max="9999" step="1" value={state.year} on:change={handleYearChange} disabled={state.isLoading} />
						</label>
					{/if}
					{#if state.periodPreset === 'custom-month'}
						<label>
							<span>Month</span>
							<select value={state.month} on:change={handleMonthChange} disabled={state.isLoading}>
								{#each months as month}
									<option value={month.value}>{month.label}</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>
				<button class="refresh-button" on:click={handleRefresh} disabled={state.isLoading}>Refresh</button>
			</div>
		</div>
	</div>

	{#if state.isLoading}
		<SkeletonLoader type="table" />
	{:else if state.error}
		<ErrorBanner message={state.error} on:retry={handleRefresh} />
	{:else if state.activeView === 'cashflow'}
		<div class="metric-grid">
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('income', 'Income', state.totalIncome)}>
				<span>Income</span>
				<strong>{formatCurrency(state.totalIncome)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('expense', 'Expenses', state.totalExpenses)}>
				<span>Expenses</span>
				<strong>{formatCurrency(state.totalExpenses)}</strong>
			</button>
			<div class="metric-card">
				<span>Net Income</span>
				<strong class={amountClass(state.netIncome)}>{formatCurrency(state.netIncome)}</strong>
			</div>
			<div class="metric-card">
				<span>Savings Rate</span>
				<strong>{state.totalIncome > 0 ? formatPercent((state.netIncome / state.totalIncome) * 100) : 'N/A'}</strong>
			</div>
		</div>

		<div class="two-column">
			<section class="report-section">
				<div class="section-header">
					<h3>Income Structure</h3>
				</div>
				{#if state.incomeChartConfig}
					<div class="chart-box"><ChartComponent config={state.incomeChartConfig} height="260px" /></div>
				{/if}
				<div class="breakdown-list">
					{#each state.incomeByCategory as row}
						<button
							type="button"
							class="breakdown-row interactive"
							class:active={detailSelection?.kind === 'income' && detailSelection?.category === row.label}
							on:click={() => openDetails('income', row.label, row.amount, row.label)}
							title="View details"
						>
							<div class="breakdown-main">
								<span class="row-label">{row.label}</span>
								<span class="row-value">{formatCurrency(row.amount)}</span>
							</div>
							<div class="bar-track">
								<div class="bar-fill" class:negative={row.amount < 0} style={`width: ${barWidth(row)}`}></div>
							</div>
							<div class="row-meta">
								<span>{formatPercent(row.percent)}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>

			<section class="report-section">
				<div class="section-header">
					<h3>Expense Structure</h3>
				</div>
				{#if state.expensesChartConfig}
					<div class="chart-box"><ChartComponent config={state.expensesChartConfig} height="260px" /></div>
				{/if}
				<div class="breakdown-list">
					{#each state.expensesByCategory as row}
						<button
							type="button"
							class="breakdown-row interactive"
							class:active={detailSelection?.kind === 'expense' && detailSelection?.category === row.label}
							on:click={() => openDetails('expense', row.label, row.amount, row.label)}
							title="View details"
						>
							<div class="breakdown-main">
								<span class="row-label">{row.label}</span>
								<span class="row-value">{formatCurrency(row.amount)}</span>
							</div>
							<div class="bar-track">
								<div class="bar-fill" class:negative={row.amount < 0} style={`width: ${barWidth(row)}`}></div>
							</div>
							<div class="row-meta">
								<span>{formatPercent(row.percent)}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>
		</div>

	{:else if state.activeView === 'assets'}
		<div class="metric-grid">
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('asset', 'Total Assets', state.totalAssets, null, true)}>
				<span>Total Assets</span>
				<strong>{formatCurrency(state.totalAssets)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('liability', 'Liabilities', state.totalLiabilities, null, true)}>
				<span>Liabilities</span>
				<strong>{formatCurrency(state.totalLiabilities)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('networth', 'Net Worth', state.netWorth, null, true)}>
				<span>Net Worth</span>
				<strong>{formatCurrency(state.netWorth)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openDetails('investment', 'Investment Assets', investmentTotal, null, true)}>
				<span>Investment Assets</span>
				<strong>{formatCurrency(investmentTotal)}</strong>
			</button>
		</div>

		<div class="two-column">
			<section class="report-section">
				<div class="section-header">
					<h3>Asset Allocation</h3>
				</div>
				{#if state.assetsChartConfig}
					<div class="chart-box"><ChartComponent config={state.assetsChartConfig} height="260px" /></div>
				{/if}
				<div class="breakdown-list">
					{#each state.assetsByCategory as row}
						<button
							type="button"
							class="breakdown-row interactive"
							class:active={detailSelection?.kind === 'asset' && detailSelection?.category === row.label}
							on:click={() => openDetails('asset', row.label, row.amount, row.label)}
							title="View details"
						>
							<div class="breakdown-main">
								<span class="row-label">{row.label}</span>
								<span class="row-value">{formatCurrency(row.amount)}</span>
							</div>
							<div class="bar-track">
								<div class="bar-fill" class:negative={row.amount < 0} style={`width: ${barWidth(row)}`}></div>
							</div>
							<div class="row-meta">
								<span>{formatPercent(row.percent)}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>

			<section class="report-section">
				<div class="section-header">
					<h3>Investment Allocation</h3>
				</div>
				{#if state.investmentsChartConfig}
					<div class="chart-box"><ChartComponent config={state.investmentsChartConfig} height="260px" /></div>
				{/if}
				<div class="breakdown-list">
					{#each state.investmentsByType as row}
						<button
							type="button"
							class="breakdown-row interactive"
							class:active={detailSelection?.kind === 'investment' && detailSelection?.category === row.label}
							on:click={() => openDetails('investment', row.label, row.amount, row.label)}
							title="View details"
						>
							<div class="breakdown-main">
								<span class="row-label">{row.label}</span>
								<span class="row-value">{formatCurrency(row.amount)}</span>
							</div>
							<div class="bar-track">
								<div class="bar-fill" class:negative={row.amount < 0} style={`width: ${barWidth(row)}`}></div>
							</div>
							<div class="row-meta">
								<span>{formatPercent(row.percent)}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>
		</div>

		<section class="report-section">
			<div class="section-header">
				<h3>Top Holdings</h3>
			</div>
			<div class="detail-table-wrap">
				<h4>Current Holdings</h4>
				<table class="reports-table">
					<thead>
						<tr>
							<th>Commodity Name</th>
							<th>Commodity</th>
							<th>Ledger Account</th>
							<th class="align-right">Amount</th>
							<th class="align-right">Share</th>
						</tr>
					</thead>
					<tbody>
						{#each state.topInvestments as row}
							<tr
								class="clickable-row"
								role="button"
								tabindex="0"
								on:click={(event) => handleHoldingRowClick(event, row)}
								on:keydown={(event) => handleHoldingRowKeydown(event, row)}
								title="View holding transactions"
							>
								<td title={row.commodityName || row.label}><span class="table-link">{commodityNameLabel(row)}</span></td>
								<td>{row.commodity || ''}</td>
								<td title={row.account || row.label}>{row.label}</td>
								<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
								<td class="align-right">{formatPercent(row.percent)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<div class="metric-grid">
			<button type="button" class="metric-card interactive-card" on:click={() => openProjectSummaryDetails('Project Income', projectIncomeTotal, 'Income')}>
				<span>Project Income</span>
				<strong>{formatCurrency(projectIncomeTotal)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openProjectSummaryDetails('Project Expenses', projectExpensesTotal, 'Expense')}>
				<span>Project Expenses</span>
				<strong>{formatCurrency(projectExpensesTotal)}</strong>
			</button>
			<button type="button" class="metric-card interactive-card" on:click={() => openProjectSummaryDetails('Project Net Income', projectNetIncomeTotal)}>
				<span>Project Net Income</span>
				<strong class={amountClass(projectNetIncomeTotal)}>{formatCurrency(projectNetIncomeTotal)}</strong>
			</button>
			<div class="metric-card">
				<span>Projects</span>
				<strong>{state.projects.filter(row => row.label !== 'Unassigned').length}</strong>
			</div>
		</div>

		<section class="report-section">
			<div class="section-header">
				<h3>Project Performance</h3>
			</div>
			<div class="detail-table-wrap">
				<table class="reports-table project-table">
					<thead>
						<tr>
							<th>Project</th>
							<th>Tag</th>
							<th class="align-right">Income</th>
							<th class="align-right">Expenses</th>
							<th class="align-right">Net Income</th>
							<th class="align-right">Transactions</th>
						</tr>
					</thead>
					<tbody>
						{#each state.projects as project}
							<tr
								class="clickable-row"
								role="button"
								tabindex="0"
								on:click={() => openProjectDetails(project)}
								on:keydown={(event) => handleProjectRowKeydown(event, project)}
								title="View project transactions"
							>
								<td><span class="table-link">{project.label}</span></td>
								<td>{project.tag || '—'}</td>
								<td class="align-right">{formatCurrency(project.income)}</td>
								<td class="align-right">{formatCurrency(project.expenses)}</td>
								<td class={`align-right ${amountClass(project.netIncome)}`}>{formatCurrency(project.netIncome)}</td>
								<td class="align-right">{project.transactionCount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	{#if detailSelection}
		<button type="button" class="detail-modal-backdrop" on:click={closeDetails} aria-label="Close details"></button>
		<section class="detail-modal" role="dialog" aria-modal="true" aria-label="Report details">
			<header class="detail-modal-header">
				<div class="detail-modal-title">
					<div>
						<h3>{detailSelection.title}</h3>
						<div class="period-label">{state.periodLabel}</div>
					</div>
				</div>
				<div class="detail-modal-actions">
					{#if canGoBackInDetails()}
						<button type="button" class="back-button" on:click={goBackInDetails} aria-label="Back to summary" title="Back to summary">&larr;</button>
					{/if}
					<strong class={amountClass(detailSelection.amount)}>{formatCurrency(detailSelection.amount)}</strong>
					<button type="button" class="close-button" on:click={closeDetails} aria-label="Close details">Close</button>
				</div>
			</header>

			<div class="detail-modal-body" role="presentation" on:click={(event) => closeOnBlankClick(event, closeDetails)}>
				<div class="detail-modal-content" role="presentation" on:click={(event) => closeOnBlankClick(event, closeDetails)}>
				{#if detailSelection.kind !== 'project'}
					<div class="detail-table-wrap">
					<div class="detail-section-heading">
						<h4>{detailSectionTitle(detailSelection.kind)}</h4>
						{#if canGoBackInDetails()}
							<button type="button" class="section-back-button" on:click={goBackInDetails} aria-label="Back to summary" title="Back to summary">&larr;</button>
						{/if}
					</div>
					<table class="reports-table">
						<thead>
							<tr>
								<th>Category</th>
								{#if detailSelection.kind === 'investment'}
									<th>Commodity Name</th>
									<th>Commodity</th>
								{/if}
								<th class="align-right">Amount</th>
								<th class="align-right">Share</th>
							</tr>
						</thead>
						<tbody>
							{#if detailGroups.length}
								{#each detailGroups as group}
									<tr class="group-row">
										<td colspan={detailSelection.kind === 'investment' ? 3 : 1}>{group.label}</td>
										<td class={`align-right ${amountClass(group.amount)}`}>{formatCurrency(group.amount)}</td>
										<td class="align-right">{detailPercent(group.amount, detailSelection.amount)}</td>
									</tr>
									{#each group.rows as row}
										<tr
											class:clickable-row={canOpenDetailRow(row)}
											role={canOpenDetailRow(row) ? 'button' : undefined}
											tabindex={canOpenDetailRow(row) ? 0 : undefined}
											on:click={(event) => handleHoldingRowClick(event, row)}
											on:keydown={(event) => handleHoldingRowKeydown(event, row)}
											class="child-row"
										>
											<td title={row.account || row.label}>{detailDisplayLabel(row)}</td>
											{#if detailSelection.kind === 'investment'}
												<td title={row.commodityName || row.label}><span class="table-link">{commodityNameLabel(row)}</span></td>
												<td>{row.commodity || ''}</td>
											{/if}
											<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
											<td class="align-right">{detailPercent(row.amount, detailSelection.amount)}</td>
										</tr>
									{/each}
								{/each}
							{:else}
								{#each detailAccounts as row}
									<tr
										class:clickable-row={canOpenDetailRow(row) || canOpenCashFlowCategory(row)}
										role={canOpenDetailRow(row) || canOpenCashFlowCategory(row) ? 'button' : undefined}
										tabindex={canOpenDetailRow(row) || canOpenCashFlowCategory(row) ? 0 : undefined}
										on:click={(event) => canOpenCashFlowCategory(row) ? handleCashFlowCategoryRow(row) : handleHoldingRowClick(event, row)}
										on:keydown={(event) => canOpenCashFlowCategory(row) ? handleCashFlowCategoryKeydown(event, row) : handleHoldingRowKeydown(event, row)}
									>
										<td title={row.account || row.label}>{detailDisplayLabel(row)}</td>
										{#if detailSelection.kind === 'investment'}
											<td title={row.commodityName || row.label}><span class="table-link">{commodityNameLabel(row)}</span></td>
											<td>{row.commodity || ''}</td>
										{/if}
										<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
										<td class="align-right">{detailPercent(row.amount, detailSelection.amount)}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
					</div>
				{/if}

				{#if isCashFlowDetail(detailSelection.kind)}
					<div class="detail-table-wrap">
						<h4>{detailSelection.kind === 'project' ? 'Project Transactions' : 'Transactions'}</h4>
						<table class="reports-table transaction-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Transaction</th>
									{#if detailSelection.kind === 'project'}
										<th>Type</th>
									{/if}
									<th>Counterpart</th>
									<th>Category</th>
									<th class="align-right">Amount</th>
								</tr>
							</thead>
							<tbody>
								{#each detailTransactions as transaction}
									<tr>
										<td>{transaction.date}</td>
										<td title={transaction.payee}>{transactionLabel(transaction)}</td>
										{#if detailSelection.kind === 'project'}
											<td>{transactionTypeLabel(transaction)}</td>
										{/if}
										<td title={counterpartTitle(transaction)}>{counterpartLabel(transaction)}</td>
										<td title={transaction.account}>{detailAccountLabel(transaction.account)}</td>
										<td class={`align-right ${amountClass(transaction.amount)}`}>{formatCurrency(transaction.amount)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if holdingSelection}
		<button type="button" class="detail-modal-backdrop" on:click={closeHoldingTransactions} aria-label="Close holding transactions"></button>
		<section class="detail-modal" role="dialog" aria-modal="true" aria-label="Holding transactions">
			<header class="detail-modal-header">
				<div>
					<h3>{commodityNameLabel(holdingSelection)}</h3>
					<div class="period-label">{holdingSelection.commodity || ''} · {holdingSelection.label}</div>
				</div>
				<div class="detail-modal-actions">
					<strong class={amountClass(holdingSelection.amount)}>{formatCurrency(holdingSelection.amount)}</strong>
					<button type="button" class="close-button" on:click={closeHoldingTransactions} aria-label="Close holding transactions">Close</button>
				</div>
			</header>

			<div class="detail-modal-body" role="presentation" on:click={(event) => closeOnBlankClick(event, closeHoldingTransactions)}>
				<div class="detail-modal-content" role="presentation" on:click={(event) => closeOnBlankClick(event, closeHoldingTransactions)}>
				<div class="detail-table-wrap">
					<h4>Transactions</h4>
					{#if holdingTransactionsLoading}
						<SkeletonLoader rows={4} />
					{:else if holdingTransactionsError}
						<ErrorBanner message={holdingTransactionsError} />
					{:else if holdingTransactions.length}
						<table class="reports-table transaction-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Transaction</th>
									<th>Type</th>
									<th class="align-right">Quantity</th>
									<th class="align-right">Unit Cost</th>
									<th class="align-right">Cash Amount</th>
									<th class="align-right">Cost Basis</th>
									<th>Accounts</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each holdingTransactions as transaction}
									<tr>
										<td>{transaction.date}</td>
										<td title={transaction.payee}>{holdingTransactionLabel(transaction)}</td>
										<td>{transaction.type}</td>
										<td class="align-right">{transaction.quantity}</td>
										<td class="align-right">{transaction.unitCost || '—'}</td>
										<td class="align-right">{transaction.cashAmount || '—'}</td>
										<td class="align-right">{transaction.costBasis || '—'}</td>
										<td title={transaction.accounts}>{transaction.accounts}</td>
										<td class="align-right">
											<button type="button" class="table-link detail-toggle" on:click={() => toggleHoldingTransaction(transaction.key)}>
												{expandedHoldingTransactions.has(transaction.key) ? 'Hide' : 'Details'}
											</button>
										</td>
									</tr>
									{#if expandedHoldingTransactions.has(transaction.key)}
										<tr class="posting-detail-row">
											<td colspan={9}>
												<table class="reports-table posting-table">
													<thead>
														<tr>
															<th>Posting Account</th>
															<th class="align-right">Posting</th>
														</tr>
													</thead>
													<tbody>
														{#each transaction.postings as posting}
															<tr>
																<td title={posting.account}>{detailAccountLabel(posting.account)}</td>
																<td class="align-right">{posting.position}</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="empty-state">No transactions found for this holding.</div>
					{/if}
				</div>
				</div>
			</div>
		</section>
	{/if}

	{#if accountSelection}
		<button type="button" class="detail-modal-backdrop" on:click={closeAccountTransactions} aria-label="Close account transactions"></button>
		<section class="detail-modal" role="dialog" aria-modal="true" aria-label="Account transactions">
			<header class="detail-modal-header">
				<div>
					<h3>{detailRowLabel(accountSelection)}</h3>
					<div class="period-label">{state.periodLabel} · {accountSelection.account}</div>
				</div>
				<div class="detail-modal-actions">
					<strong class={amountClass(accountSelection.amount)}>{formatCurrency(accountSelection.amount)}</strong>
					<button type="button" class="close-button" on:click={closeAccountTransactions} aria-label="Close account transactions">Close</button>
				</div>
			</header>

			<div class="detail-modal-body" role="presentation" on:click={(event) => closeOnBlankClick(event, closeAccountTransactions)}>
				<div class="detail-modal-content" role="presentation" on:click={(event) => closeOnBlankClick(event, closeAccountTransactions)}>
				<div class="detail-table-wrap">
					<h4>Account Transactions</h4>
					{#if accountTransactionsLoading}
						<SkeletonLoader rows={4} />
					{:else if accountTransactionsError}
						<ErrorBanner message={accountTransactionsError} />
					{:else if accountTransactions.length}
						<table class="reports-table transaction-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Transaction</th>
									<th class="align-right">Posting</th>
									<th class="align-right">Balance</th>
								</tr>
							</thead>
							<tbody>
								{#each accountTransactions as transaction}
									<tr>
										<td>{transaction.date}</td>
										<td title={transaction.payee}>{accountTransactionLabel(transaction)}</td>
										<td class="align-right">{transaction.position}</td>
										<td class="align-right">{transaction.balance || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="empty-state">No transactions found for this account in the selected period.</div>
					{/if}
				</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.reports-tab {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-4);
		user-select: text;
	}

	.reports-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--size-4-4);
		flex-wrap: wrap;
	}

	h2, h3, h4 {
		margin: 0;
	}

	h2 {
		font-size: var(--font-ui-large);
	}

	h3 {
		font-size: var(--font-ui-medium);
	}

	h4 {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: var(--size-4-2);
	}

	.period-label {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		margin-top: 2px;
	}

	.report-controls,
	.period-controls {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
		flex-wrap: wrap;
	}

	.report-controls {
		justify-content: flex-end;
	}

	.toolbar-group {
		display: inline-flex;
		align-items: center;
		gap: var(--size-4-2);
		padding: 3px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}

	.period-picker {
		align-items: center;
		flex-wrap: wrap;
	}

	.period-picker label {
		display: inline-flex;
		align-items: center;
		gap: var(--size-4-1);
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.period-picker select,
	.period-picker input {
		min-height: 30px;
	}

	.segmented-control {
		display: inline-flex;
		border: none;
		border-radius: var(--radius-s);
		overflow: hidden;
		background: transparent;
	}

	.segmented-control button,
	.refresh-button {
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		min-height: 30px;
		padding: 4px 12px;
	}

	.segmented-control button.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.primary-switch button {
		min-width: 86px;
	}

	.refresh-button {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		font-weight: 500;
	}

	select,
	input {
		min-height: 30px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		padding: 4px 8px;
	}

	input[type="number"] {
		width: 84px;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--size-4-3);
	}

	.metric-card {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-3);
		background: var(--background-secondary);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 74px;
		user-select: text;
	}

	button.metric-card {
		width: 100%;
		height: auto;
		text-align: left;
		color: inherit;
		box-shadow: none;
		cursor: pointer;
	}

	button.metric-card:hover,
	button.metric-card:focus-visible {
		border-color: var(--interactive-accent);
		background: var(--background-secondary-alt);
	}

	.metric-card span {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.metric-card strong {
		font-size: var(--font-ui-medium);
		font-weight: 650;
		color: var(--text-normal);
	}

	.two-column,
	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: var(--size-4-4);
	}

	.report-section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chart-box {
		height: 280px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-2);
	}

	.breakdown-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.breakdown-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 6px;
		width: 100%;
		padding: var(--size-4-2);
		border: 1px solid transparent;
		border-radius: var(--radius-s);
		background: transparent;
		color: inherit;
		cursor: default;
		height: auto;
		min-height: 0;
		box-shadow: none;
		line-height: 1.35;
		text-align: left;
		user-select: text;
	}

	.breakdown-row.interactive {
		cursor: pointer;
	}

	.breakdown-row.interactive:hover,
	.breakdown-row.interactive:focus-visible,
	.breakdown-row.active {
		background: var(--background-secondary);
		border-color: var(--background-modifier-border);
	}

	.breakdown-main,
	.row-meta {
		display: flex;
		justify-content: space-between;
		gap: var(--size-4-3);
		font-size: var(--font-ui-small);
		line-height: 1.35;
	}

	.row-label {
		color: var(--text-normal);
		overflow-wrap: anywhere;
	}

	.row-value,
	.row-meta {
		color: var(--text-muted);
	}

	.row-value {
		white-space: nowrap;
	}

	.bar-track {
		height: 7px;
		border-radius: var(--radius-s);
		background: var(--background-modifier-border);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-s);
		background: var(--interactive-accent);
	}

	.bar-fill.negative {
		background: var(--text-error);
	}

	.detail-table-wrap {
		overflow-x: auto;
	}

	.detail-table-wrap + .detail-table-wrap {
		margin-top: var(--size-4-4);
	}

	.detail-section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--size-4-3);
	}

	.detail-section-heading h4 {
		margin: 0 0 var(--size-4-2) 0;
	}

	.section-back-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 30px;
		min-width: 30px;
		height: 30px;
		min-height: 30px;
		margin-bottom: var(--size-4-2);
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		box-shadow: none;
		cursor: pointer;
		font-size: var(--font-ui-medium);
		line-height: 1;
		user-select: none;
	}

	.section-back-button:hover,
	.section-back-button:focus-visible {
		background: var(--interactive-hover);
	}

	.reports-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-ui-small);
		user-select: text;
	}

	.reports-table th,
	.reports-table td {
		border-bottom: 1px solid var(--background-modifier-border);
		padding: 7px 8px;
		vertical-align: top;
	}

	.reports-table th {
		color: var(--text-muted);
		text-align: left;
		font-weight: 600;
		background: var(--background-secondary);
	}

	.reports-table .group-row td {
		background: var(--background-secondary);
		color: var(--text-normal);
		font-weight: 650;
	}

	.reports-table .child-row td:first-child {
		padding-left: 24px;
	}

	.reports-table .clickable-row {
		cursor: pointer;
		user-select: text;
	}

	.reports-table .clickable-row:hover td,
	.reports-table .clickable-row:focus-visible td {
		background: var(--background-secondary);
	}

	.reports-table .clickable-row:focus {
		outline: none;
	}

	.reports-table .clickable-row:focus-visible td:first-child {
		box-shadow: inset 3px 0 0 var(--interactive-accent);
	}

	.reports-table td:first-child {
		max-width: 360px;
		overflow-wrap: anywhere;
	}

	.table-link {
		display: inline;
		width: auto;
		height: auto;
		min-height: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		color: var(--text-accent);
		font: inherit;
		line-height: inherit;
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
		cursor: pointer;
	}

	.table-link:hover,
	.table-link:focus-visible {
		background: transparent;
		color: var(--text-accent-hover);
		text-decoration: underline;
	}

	.transaction-table {
		margin-top: var(--size-4-3);
	}

	.detail-toggle {
		white-space: nowrap;
	}

	.posting-detail-row td {
		background: var(--background-secondary);
		padding: var(--size-4-2) var(--size-4-3);
	}

	.posting-table {
		margin: 0;
		font-size: var(--font-ui-smaller);
	}

	.posting-table th,
	.posting-table td {
		background: transparent;
	}

	.empty-state {
		margin-top: var(--size-4-3);
		padding: var(--size-4-3);
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.detail-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		border: none;
		border-radius: 0;
		background-color: rgba(0, 0, 0, 0.48);
		cursor: default;
	}

	.detail-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 10001;
		width: min(1100px, calc(100vw - 48px));
		max-height: min(820px, calc(100vh - 48px));
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-primary);
		box-shadow: var(--shadow-l);
		overflow: hidden;
	}

	.detail-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--size-4-4);
		padding: var(--size-4-4);
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
	}

	.detail-modal-title {
		display: flex;
		align-items: flex-start;
		gap: var(--size-4-2);
		min-width: 0;
	}

	.detail-modal-title h3 {
		margin-top: 0;
		overflow-wrap: anywhere;
	}

	.back-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 30px;
		min-width: 30px;
		height: 30px;
		min-height: 30px;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		box-shadow: none;
		cursor: pointer;
		font-size: var(--font-ui-medium);
		line-height: 1;
		user-select: none;
	}

	.back-button:hover,
	.back-button:focus-visible {
		background: var(--interactive-hover);
	}

	.detail-modal-actions {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
		white-space: nowrap;
	}

	.close-button {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
		min-height: 30px;
		padding: 4px 10px;
		user-select: none;
	}

	.detail-modal-body {
		position: relative;
		overflow: auto;
		padding: var(--size-4-4);
		user-select: text;
	}

	.detail-modal-content {
		position: relative;
		z-index: 1;
	}

	.align-right {
		text-align: right !important;
		white-space: nowrap;
	}

	.positive {
		color: var(--text-success);
	}

	.negative {
		color: var(--text-error);
	}

	@media (max-width: 720px) {
		.reports-header {
			flex-direction: column;
		}

		.report-controls {
			width: 100%;
			align-items: flex-start;
			flex-direction: column;
		}

		.period-controls {
			width: 100%;
		}

		.two-column,
		.detail-grid {
			grid-template-columns: 1fr;
		}

		.detail-modal {
			width: calc(100vw - 24px);
			max-height: calc(100vh - 24px);
		}

		.detail-modal-header {
			flex-direction: column;
		}

		.detail-modal-actions {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
