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
