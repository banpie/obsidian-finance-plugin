// src/services/reconciliation.service.ts

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import { runQuery } from '../utils/queryRunner';
import { getReconcileAccountsQuery, getLastBalanceDateQuery, getLatestBalanceStatusQuery } from '../queries/index';
import { Logger } from '../utils/logger';

/**
 * Per-account reconciliation status.
 */
export interface ReconciliationAccountStatus {
	/** Fully-qualified account name. */
	account: string;
	/** Desired reconciliation interval (days), from the open directive metadata. */
	reconcileDays: number;
	/** ISO date of the most recent balance assertion, or null if never reconciled. */
	lastBalanceDate: string | null;
	/** Number of days since the last balance assertion, or null if never reconciled. */
	daysSinceLastBalance: number | null;
	/** True when the account needs attention: past its reconciliation window, OR its latest balance assertion is currently failing (see #272). */
	isOverdue: boolean;
	/** True when the account's MOST RECENT balance assertion (pass or fail) is currently failing. */
	isFailing: boolean;
	/** Date of the failing balance assertion, when isFailing is true. */
	failingDate: string | null;
	/** Discrepancy amount of the failing balance assertion (raw string, e.g. "12.34 USD"), when isFailing is true. */
	failingDiscrepancy: string | null;
}

/**
 * Given a reconcile interval and the last PASSING balance-assertion date,
 * computes days-since and overdue status. `lastBalanceDateStr === null`
 * means "never reconciled" — overdue by definition.
 */
export function computeReconciliationStatus(
	reconcileDays: number,
	lastBalanceDateStr: string | null
): { daysSinceLastBalance: number | null; isOverdue: boolean } {
	if (!lastBalanceDateStr) return { daysSinceLastBalance: null, isOverdue: true };

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const lastDate = new Date(lastBalanceDateStr);
	lastDate.setHours(0, 0, 0, 0);
	const daysSinceLastBalance = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
	return { daysSinceLastBalance, isOverdue: daysSinceLastBalance > reconcileDays };
}

/**
 * Aggregate reconciliation health for the whole ledger.
 */
export interface ReconciliationStatus {
	overdueCount: number;
	upToDateCount: number;
	/** Detailed per-account breakdown (sorted: overdue first, then by days-since desc). */
	accounts: ReconciliationAccountStatus[];
}

/**
 * Computes reconciliation status for every open account that carries
 * a `reconcile: <days>` metadata key on its `open` directive.
 *
 * Runs two BQL queries in parallel:
 *   1. Accounts with `reconcile` metadata  (`#accounts` table)
 *   2. Latest balance date per account      (`#balances` table)
 * Then joins client-side and classifies each account.
 */
export async function getReconciliationStatus(plugin: BeancountPlugin): Promise<ReconciliationStatus> {
	Logger.log('[Reconciliation] Fetching reconciliation status');

	const [reconcileAccountsCsv, balanceDatesCsv, latestBalanceStatusCsv] = await Promise.all([
		runQuery(plugin, getReconcileAccountsQuery()),
		runQuery(plugin, getLastBalanceDateQuery()),
		runQuery(plugin, getLatestBalanceStatusQuery()),
	]);

	// --- Parse reconcile accounts ---
	const reconcileRows = parseCsv(reconcileAccountsCsv, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as unknown as { account: string; reconcile_days: string }[];

	Logger.log('[Reconciliation] Accounts with reconcile metadata:', reconcileRows.length);

	if (reconcileRows.length === 0) {
		return { overdueCount: 0, upToDateCount: 0, accounts: [] };
	}

	// --- Parse balance dates into a lookup map ---
	const balanceRows = parseCsv(balanceDatesCsv, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as unknown as { account: string; last_balance_date: string }[];

	const balanceDateMap = new Map<string, string>();
	for (const row of balanceRows) {
		if (row.account && row.last_balance_date) {
			balanceDateMap.set(row.account, row.last_balance_date);
		}
	}

	// --- Parse latest balance status (pass or fail) into a lookup map ---
	const latestStatusRows = parseCsv(latestBalanceStatusCsv, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as unknown as { account: string; last_date: string; last_discrepancy: string }[];

	const failingStatusMap = new Map<string, { date: string; discrepancy: string | null }>();
	for (const row of latestStatusRows) {
		if (row.account && row.last_discrepancy) {
			failingStatusMap.set(row.account, { date: row.last_date || '', discrepancy: row.last_discrepancy });
		}
	}

	// --- Compute per-account status ---
	const accounts: ReconciliationAccountStatus[] = [];

	for (const row of reconcileRows) {
		const reconcileDays = parseInt(row.reconcile_days, 10);
		if (isNaN(reconcileDays) || reconcileDays <= 0) {
			Logger.log(`[Reconciliation] Skipping ${row.account}: invalid reconcile_days="${row.reconcile_days}"`);
			continue;
		}

		const lastBalanceDateStr = balanceDateMap.get(row.account) ?? null;
		const { daysSinceLastBalance, isOverdue: isPastWindow } = computeReconciliationStatus(reconcileDays, lastBalanceDateStr);

		const failingStatus = failingStatusMap.get(row.account) ?? null;
		const isFailing = !!failingStatus;

		accounts.push({
			account: row.account,
			reconcileDays,
			lastBalanceDate: lastBalanceDateStr,
			daysSinceLastBalance,
			// A currently-failing assertion always needs attention, even if an
			// older passing balance is still within the interval window (#272).
			isOverdue: isPastWindow || isFailing,
			isFailing,
			failingDate: failingStatus?.date ?? null,
			failingDiscrepancy: failingStatus?.discrepancy ?? null,
		});
	}

	// Sort: overdue first, then by days-since descending
	accounts.sort((a, b) => {
		if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
		const aDays = a.daysSinceLastBalance ?? Infinity;
		const bDays = b.daysSinceLastBalance ?? Infinity;
		return bDays - aDays;
	});

	const overdueCount = accounts.filter(a => a.isOverdue).length;
	const upToDateCount = accounts.length - overdueCount;

	Logger.log(`[Reconciliation] Result: ${overdueCount} overdue, ${upToDateCount} up to date`);

	return { overdueCount, upToDateCount, accounts };
}
