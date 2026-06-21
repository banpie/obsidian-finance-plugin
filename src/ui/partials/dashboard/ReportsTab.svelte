<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import type { ReportsController, ReportsState, ReportRow, ReportTransaction, ReportInvestmentTransaction, ReportsPeriodPreset, ReportsView } from '../../../controllers/ReportsController';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';

	export let controller: ReportsController;

	type DetailKind = 'income' | 'expense' | 'asset' | 'liability' | 'networth' | 'investment';

	interface DetailSelection {
		kind: DetailKind;
		title: string;
		amount: number;
		category: string | null;
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

	function counterpartLabel(transaction: ReportTransaction): string {
		const accounts = transaction.counterpartAccounts || [];
		if (!accounts.length) return '—';
		return accounts.map(account => detailAccountLabel(account)).join(', ');
	}

	function counterpartTitle(transaction: ReportTransaction): string {
		return (transaction.counterpartAccounts || []).join(', ');
	}

	function isCashFlowDetail(kind: DetailKind): boolean {
		return kind === 'income' || kind === 'expense';
	}

	function detailSectionTitle(kind: DetailKind): string {
		if (kind === 'investment') return detailSelection?.summary ? 'Holdings by Type' : 'Current Holdings';
		if (kind === 'asset' || kind === 'liability' || kind === 'networth') return detailSelection?.summary ? 'Balances by Category' : 'Current Balances';
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
			rows: rowsForCategory(state.assetsByAccount, group.label),
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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (holdingSelection) {
			closeHoldingTransactions();
		} else if (detailSelection) {
			closeDetails();
		}
	}

	$: investmentTotal = state.investmentsByType.reduce((sum, row) => sum + row.amount, 0);
	$: detailAccounts = detailSelection
		? detailSelection.kind === 'income'
			? rowsForCategory(state.incomeByAccount, detailSelection.category)
			: detailSelection.kind === 'expense'
				? rowsForCategory(state.expensesByAccount, detailSelection.category)
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
				: []
		: [];

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

	{:else}
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
							<tr>
								<td title={row.commodityName || row.label}>
									<button type="button" class="table-link" on:click={() => openHoldingTransactions(row)}>
										{commodityNameLabel(row)}
									</button>
								</td>
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
	{/if}

	{#if detailSelection}
		<button type="button" class="detail-modal-backdrop" on:click={closeDetails} aria-label="Close details"></button>
		<section class="detail-modal" role="dialog" aria-modal="true" aria-label="Report details">
			<header class="detail-modal-header">
				<div>
					<h3>{detailSelection.title}</h3>
					<div class="period-label">{state.periodLabel}</div>
				</div>
				<div class="detail-modal-actions">
					<strong class={amountClass(detailSelection.amount)}>{formatCurrency(detailSelection.amount)}</strong>
					<button type="button" class="close-button" on:click={closeDetails} aria-label="Close details">Close</button>
				</div>
			</header>

			<div class="detail-modal-body">
				<div class="detail-table-wrap">
					<h4>{detailSectionTitle(detailSelection.kind)}</h4>
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
										<tr class="child-row">
											<td title={row.account || row.label}>{detailRowLabel(row)}</td>
											{#if detailSelection.kind === 'investment'}
												<td title={row.commodityName || row.label}>
													<button type="button" class="table-link" on:click={() => openHoldingTransactions(row)}>
														{commodityNameLabel(row)}
													</button>
												</td>
												<td>{row.commodity || ''}</td>
											{/if}
											<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
											<td class="align-right">{detailPercent(row.amount, detailSelection.amount)}</td>
										</tr>
									{/each}
								{/each}
							{:else}
								{#each detailAccounts as row}
									<tr>
										<td title={row.account || row.label}>{detailRowLabel(row)}</td>
										{#if detailSelection.kind === 'investment'}
											<td title={row.commodityName || row.label}>
												<button type="button" class="table-link" on:click={() => openHoldingTransactions(row)}>
													{commodityNameLabel(row)}
												</button>
											</td>
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

				{#if isCashFlowDetail(detailSelection.kind)}
					<div class="detail-table-wrap">
						<h4>Transactions</h4>
						<table class="reports-table transaction-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Transaction</th>
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

			<div class="detail-modal-body">
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
		</section>
	{/if}
</div>

<style>
	.reports-tab {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-4);
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

	.reports-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-ui-small);
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
		z-index: 1000;
		border: none;
		border-radius: 0;
		background: rgba(0, 0, 0, 0.48);
		cursor: default;
	}

	.detail-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 1001;
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
	}

	.detail-modal-body {
		overflow: auto;
		padding: var(--size-4-4);
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
