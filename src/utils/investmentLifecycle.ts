import { parse as parseCsv } from 'csv-parse/sync';

export type InvestmentLifecycleVerification = 'verified' | 'needs-review';

export interface InvestmentLifecycleMetrics {
	commodity: string;
	cumulativeInvested?: number;
	cumulativeRecovered?: number;
	lifetimeProfit?: number;
	totalRoi?: number;
	latestTrade?: string;
	verification: InvestmentLifecycleVerification;
}

type LifecycleCsvRow = Record<string, string>;

function parseNumber(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number(value.replace(/,/g, '').trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number(value.replace('%', '').trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function hasExplicitLifecycleConfirmation(note: string): boolean {
	return note.includes('累计投入') && (note.includes('累计回收') || note.includes('累计卖出') || note.includes('回收及收益'));
}

function isReconciled(buy: number, profit: number, realized: number): boolean {
	const tolerance = Math.max(1, Math.abs(buy) * 0.001);
	return Math.abs(profit - realized) <= tolerance;
}

/**
 * Parse the personal-ledger lifecycle report cache used for closed investments.
 * The cache is display-only; Beancount remains the source of truth.
 */
export function parseInvestmentLifecycleCsv(rawCsv: string, asOfDate?: string): Map<string, InvestmentLifecycleMetrics> {
	const result = new Map<string, InvestmentLifecycleMetrics>();
	const duplicates = new Set<string>();
	if (!rawCsv.trim()) return result;

	const rows: LifecycleCsvRow[] = parseCsv(rawCsv, {
		columns: true,
		skip_empty_lines: true,
		relax_column_count: true,
		trim: true,
	});

	for (const row of rows) {
		const commodity = (row.commodity || '').trim();
		const latestTrade = (row.latest_trade || '').trim();
		if (!commodity || row.status !== 'closed' || !/^true$/i.test(row.system_closed || '')) continue;
		if (asOfDate && latestTrade && latestTrade >= asOfDate) continue;

		const buy = parseNumber(row.cumulative_buy_cny);
		const recovered = parseNumber(row.cumulative_sell_income_cny);
		const profit = parseNumber(row.total_profit_cny);
		const realized = parseNumber(row.local_realized_pnl_cny);
		const roi = parsePercent(row.total_roi);
		const complete = buy !== null && buy > 0 && recovered !== null && profit !== null && roi !== null;
		const verified = complete && (
			hasExplicitLifecycleConfirmation(row.price_status || '') ||
			(realized !== null && isReconciled(buy, profit, realized))
		);

		const metrics: InvestmentLifecycleMetrics = verified
			? {
				commodity,
				cumulativeInvested: buy,
				cumulativeRecovered: recovered,
				lifetimeProfit: profit,
				totalRoi: roi,
				latestTrade: latestTrade || undefined,
				verification: 'verified',
			}
			: {
				commodity,
				latestTrade: latestTrade || undefined,
				verification: 'needs-review',
			};

		if (result.has(commodity)) duplicates.add(commodity);
		else result.set(commodity, metrics);
	}

	for (const commodity of duplicates) result.delete(commodity);
	return result;
}
