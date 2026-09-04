import type { ReportLifecycleStatus } from '../controllers/ReportsController';

export type ReportLifecycleFilter = 'current' | 'closed' | 'needs-review' | 'all';
export type ReportSearchValue = string | number | null | undefined;

export const INVESTMENT_TYPE_LABELS: Record<string, string> = {
	BiddingClub: '标会 / BiddingClub',
	Bond: '债券 / Bond',
	CallDeposit: '通知存款 / CallDeposit',
	Deposit: '定期存款 / Deposit',
	ETF: 'ETF',
	Fund: '基金 / Fund',
	Insurance: '保险 / Insurance',
	MMF: '货币基金 / MMF',
	QDII: 'QDII',
	Repo: '逆回购 / Repo',
	RoboAdvisor: '智能投顾 / RoboAdvisor',
	Stock: '股票 / Stock',
	Wealth: '银行理财 / Wealth',
};

export function normalizeReportSearch(value: ReportSearchValue): string {
	return String(value ?? '').trim().toLocaleLowerCase();
}

export function matchesReportSearch(query: string, values: ReportSearchValue[]): boolean {
	const normalizedQuery = normalizeReportSearch(query);
	if (!normalizedQuery) return true;
	return values.some(value => normalizeReportSearch(value).includes(normalizedQuery));
}

export function getInvestmentTypeKey(account: string | undefined): string {
	const segment = (account || '').split(':')[2] || account || 'Other';
	return segment.split('-', 1)[0] || segment;
}

export function getInvestmentTypeLabel(type: string | undefined): string {
	const normalizedType = type || 'Other';
	return INVESTMENT_TYPE_LABELS[normalizedType] || normalizedType;
}

export function matchesLifecycleFilter(
	status: ReportLifecycleStatus | undefined,
	filter: ReportLifecycleFilter,
): boolean {
	const normalizedStatus = status || 'active';
	if (filter === 'all') return true;
	if (filter === 'needs-review') return normalizedStatus === 'needs-review';
	if (filter === 'current') return normalizedStatus === 'active' || normalizedStatus === 'needs-review';
	return normalizedStatus === 'closed' || normalizedStatus === 'zero-balance' || normalizedStatus === 'inactive';
}

export function lifecycleFilterNeedsHistory(filter: ReportLifecycleFilter): boolean {
	return filter === 'closed' || filter === 'all';
}
