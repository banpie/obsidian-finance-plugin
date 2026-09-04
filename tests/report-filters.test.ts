import { describe, expect, it } from 'vitest';
import {
	getInvestmentTypeKey,
	getInvestmentTypeLabel,
	lifecycleFilterNeedsHistory,
	matchesLifecycleFilter,
	matchesReportSearch,
} from '../src/utils/reportFilters';

describe('report filters', () => {
	it('matches Chinese names, codes, and account fragments case-insensitively', () => {
		expect(matchesReportSearch('标会', ['【标会】金水', 'HK07266'])).toBe(true);
		expect(matchesReportSearch('hk07266', ['【标会】金水', 'HK07266'])).toBe(true);
		expect(matchesReportSearch('biddingclub', ['Assets:Investments:BiddingClub-金水'])).toBe(true);
		expect(matchesReportSearch('股票', ['HK07266'])).toBe(false);
	});

	it('derives stable investment types and bilingual labels', () => {
		expect(getInvestmentTypeKey('Assets:Investments:BiddingClub-金水')).toBe('BiddingClub');
		expect(getInvestmentTypeLabel('BiddingClub')).toBe('标会 / BiddingClub');
		expect(getInvestmentTypeLabel('Custom')).toBe('Custom');
	});

	it('separates current, historical, review, and all lifecycle rows', () => {
		expect(matchesLifecycleFilter('active', 'current')).toBe(true);
		expect(matchesLifecycleFilter('needs-review', 'current')).toBe(true);
		expect(matchesLifecycleFilter('closed', 'current')).toBe(false);
		expect(matchesLifecycleFilter('closed', 'closed')).toBe(true);
		expect(matchesLifecycleFilter('inactive', 'closed')).toBe(true);
		expect(matchesLifecycleFilter('needs-review', 'needs-review')).toBe(true);
		expect(matchesLifecycleFilter('active', 'all')).toBe(true);
		expect(lifecycleFilterNeedsHistory('current')).toBe(false);
		expect(lifecycleFilterNeedsHistory('closed')).toBe(true);
	});
});
