// src/types/navigation.ts

export type DashboardTabId =
	| 'overview'
	| 'transactions'
	| 'journal'
	| 'balancesheet'
	| 'incomestatement'
	| 'commodities';

export interface NavigationFilters {
	account?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	payee?: string | null;
	tag?: string | null;
	searchTerm?: string | null;
}

export interface NavRequest {
	tab: DashboardTabId;
	filters?: NavigationFilters;
}

/**
 * Picks the destination tab for a "view this filtered" click: Transactions by
 * default, or Journal when the user Ctrl/Cmd-clicked.
 */
export function resolveNavTab(event?: { ctrlKey?: boolean; metaKey?: boolean } | null): 'transactions' | 'journal' {
	return event && (event.ctrlKey || event.metaKey) ? 'journal' : 'transactions';
}
