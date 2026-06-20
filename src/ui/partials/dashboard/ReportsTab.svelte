<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import type { ReportsController, ReportsState, ReportRow, ReportsPeriodMode, ReportsView } from '../../../controllers/ReportsController';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';

	export let controller: ReportsController;

	const placeholderState: Writable<ReportsState> = writable({
		isLoading: true,
		error: null,
		currency: 'USD',
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
		assetsByCategory: [],
		investmentsByType: [],
		topInvestments: [],
		incomeChartConfig: null,
		expensesChartConfig: null,
		assetsChartConfig: null,
		investmentsChartConfig: null,
	});

	let activeView: ReportsView = 'cashflow';
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

	function amountClass(value: number): string {
		if (value > 0) return 'positive';
		if (value < 0) return 'negative';
		return '';
	}

	async function handlePeriodModeChange(mode: ReportsPeriodMode) {
		if (controller && mode !== state.periodMode) await controller.setPeriodMode(mode);
	}

	async function handleMonthChange(event: Event) {
		const value = Number((event.target as HTMLSelectElement).value);
		if (controller) await controller.setMonth(value);
	}

	async function handleYearChange(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		if (controller && Number.isFinite(value)) await controller.setYear(value);
	}

	async function handleMove(delta: -1 | 1) {
		if (controller) await controller.movePeriod(delta);
	}

	async function handleRefresh() {
		if (controller) await controller.loadData();
	}
</script>

<div class="reports-tab">
	<div class="reports-header">
		<div>
			<h2>Reports</h2>
			<div class="period-label">{state.periodLabel}</div>
		</div>

		<div class="report-controls">
			<div class="segmented-control" aria-label="Report view">
				<button class:active={activeView === 'cashflow'} on:click={() => (activeView = 'cashflow')}>Cash Flow</button>
				<button class:active={activeView === 'assets'} on:click={() => (activeView = 'assets')}>Assets</button>
			</div>

			<div class="period-controls">
				<button class="icon-button" on:click={() => handleMove(-1)} disabled={state.isLoading} aria-label="Previous period">‹</button>
				<div class="segmented-control" aria-label="Period mode">
					<button class:active={state.periodMode === 'month'} on:click={() => handlePeriodModeChange('month')} disabled={state.isLoading}>Month</button>
					<button class:active={state.periodMode === 'year'} on:click={() => handlePeriodModeChange('year')} disabled={state.isLoading}>Year</button>
				</div>
				{#if state.periodMode === 'month'}
					<select value={state.month} on:change={handleMonthChange} disabled={state.isLoading} aria-label="Month">
						{#each months as month}
							<option value={month.value}>{month.label}</option>
						{/each}
					</select>
				{/if}
				<input type="number" min="1970" max="9999" value={state.year} on:change={handleYearChange} disabled={state.isLoading} aria-label="Year" />
				<button class="icon-button" on:click={() => handleMove(1)} disabled={state.isLoading} aria-label="Next period">›</button>
				<button class="refresh-button" on:click={handleRefresh} disabled={state.isLoading}>Refresh</button>
			</div>
		</div>
	</div>

	{#if state.isLoading}
		<SkeletonLoader type="table" />
	{:else if state.error}
		<ErrorBanner message={state.error} on:retry={handleRefresh} />
	{:else if activeView === 'cashflow'}
		<div class="metric-grid">
			<div class="metric-card">
				<span>Income</span>
				<strong>{formatCurrency(state.totalIncome)}</strong>
			</div>
			<div class="metric-card">
				<span>Expenses</span>
				<strong>{formatCurrency(state.totalExpenses)}</strong>
			</div>
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
						<div class="breakdown-row">
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
						</div>
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
						<div class="breakdown-row">
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
						</div>
					{/each}
				</div>
			</section>
		</div>

		<section class="report-section">
			<div class="section-header">
				<h3>Account Detail</h3>
			</div>
			<div class="detail-grid">
				<div class="detail-table-wrap">
					<h4>Income Accounts</h4>
					<table class="reports-table">
						<thead>
							<tr>
								<th>Account</th>
								<th class="align-right">Amount</th>
								<th class="align-right">Share</th>
							</tr>
						</thead>
						<tbody>
							{#each state.incomeByAccount as row}
								<tr>
									<td title={row.account || row.label}>{row.label}</td>
									<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
									<td class="align-right">{formatPercent(row.percent)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="detail-table-wrap">
					<h4>Expense Accounts</h4>
					<table class="reports-table">
						<thead>
							<tr>
								<th>Account</th>
								<th class="align-right">Amount</th>
								<th class="align-right">Share</th>
							</tr>
						</thead>
						<tbody>
							{#each state.expensesByAccount as row}
								<tr>
									<td title={row.account || row.label}>{row.label}</td>
									<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
									<td class="align-right">{formatPercent(row.percent)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	{:else}
		<div class="metric-grid">
			<div class="metric-card">
				<span>Total Assets</span>
				<strong>{formatCurrency(state.totalAssets)}</strong>
			</div>
			<div class="metric-card">
				<span>Liabilities</span>
				<strong>{formatCurrency(state.totalLiabilities)}</strong>
			</div>
			<div class="metric-card">
				<span>Net Worth</span>
				<strong>{formatCurrency(state.netWorth)}</strong>
			</div>
			<div class="metric-card">
				<span>Investment Assets</span>
				<strong>{formatCurrency(state.investmentsByType.reduce((sum, row) => sum + row.amount, 0))}</strong>
			</div>
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
						<div class="breakdown-row">
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
						</div>
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
						<div class="breakdown-row">
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
						</div>
					{/each}
				</div>
			</section>
		</div>

		<section class="report-section">
			<div class="section-header">
				<h3>Top Investments</h3>
			</div>
			<div class="detail-table-wrap">
				<h4>Current Holdings</h4>
				<table class="reports-table">
					<thead>
						<tr>
							<th>Account</th>
							<th>Commodity</th>
							<th class="align-right">Amount</th>
							<th class="align-right">Share</th>
						</tr>
					</thead>
					<tbody>
						{#each state.topInvestments as row}
							<tr>
								<td title={row.account || row.label}>{row.label}</td>
								<td>{row.commodity || ''}</td>
								<td class={`align-right ${amountClass(row.amount)}`}>{formatCurrency(row.amount)}</td>
								<td class="align-right">{formatPercent(row.percent)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
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
		gap: var(--size-4-2);
		flex-wrap: wrap;
	}

	.segmented-control {
		display: inline-flex;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
		background: var(--background-secondary);
	}

	.segmented-control button,
	.icon-button,
	.refresh-button {
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		min-height: 30px;
		padding: 4px 10px;
	}

	.segmented-control button.active {
		background: var(--background-primary);
		color: var(--text-accent);
		font-weight: 600;
	}

	.icon-button {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		font-size: 18px;
		min-width: 30px;
		padding: 0 8px;
	}

	.refresh-button {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
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
		gap: 4px;
	}

	.breakdown-main,
	.row-meta {
		display: flex;
		justify-content: space-between;
		gap: var(--size-4-3);
		font-size: var(--font-ui-small);
	}

	.row-label {
		color: var(--text-normal);
		overflow-wrap: anywhere;
	}

	.row-value,
	.row-meta {
		color: var(--text-muted);
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

	.reports-table td:first-child {
		max-width: 360px;
		overflow-wrap: anywhere;
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
	}
</style>
