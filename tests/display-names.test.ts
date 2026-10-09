import { describe, expect, it } from 'vitest';
import {
	formatAccountDisplayName,
	formatInvestmentDisplayName,
	formatLoanDisplayName,
	getAccountDisplayContext,
	normalizeNameSeparators,
} from '../src/utils/displayNames';
import { getBalanceAccountDisplayName } from '../src/utils/accountLabels';
import { matchesReportSearch } from '../src/utils/reportFilters';

describe('financial display names', () => {
	it('gives bracketed and hyphenated channel prefixes the same product title', () => {
		expect(formatInvestmentDisplayName('【余利宝】示例理财-30天持有1号T')).toBe('示例理财-30天持有1号T');
		expect(formatInvestmentDisplayName('余利宝-示例理财-30天持有1号T')).toBe('示例理财-30天持有1号T');
	});

	it('removes a channel token without removing the fund issuer or share class', () => {
		expect(formatInvestmentDisplayName('香港华泰-华泰美元货币市场基金A-华泰乐盈宝')).toBe('华泰美元货币市场基金A-华泰乐盈宝');
		expect(formatInvestmentDisplayName('高腾微财货币基金A HKD Acc')).toBe('高腾微财货币基金A HKD Acc');
		expect(formatInvestmentDisplayName('【富途】示例ETF-02834')).toBe('示例ETF-02834');
	});

	it('keeps meaningful classifications and unknown prefixes', () => {
		expect(formatInvestmentDisplayName('【标会】示例-20240415')).toBe('标会-示例-20240415');
		expect(formatInvestmentDisplayName('【投顾】稳健组合')).toBe('投顾-稳健组合');
		expect(formatInvestmentDisplayName('【新平台】示例基金')).toBe('新平台-示例基金');
	});

	it('does not empty a channel-only name or strip technical-looking product codes', () => {
		expect(formatInvestmentDisplayName('【余利宝】')).toBe('余利宝');
		expect(formatInvestmentDisplayName('ETF-123456-指数产品')).toBe('ETF-123456-指数产品');
		expect(formatInvestmentDisplayName('')).toBe('');
	});

	it('normalizes separators while retaining spaces inside share classes', () => {
		expect(normalizeNameSeparators(' 【示例】  - 产品 - A HKD Acc ')).toBe('示例-产品-A HKD Acc');
	});

	it('hides internal account prefixes but preserves insurance and holding identifiers', () => {
		const account = 'Assets:Investments:Insurance-a1b2c3-示例养老年金保险';
		expect(getBalanceAccountDisplayName(account, account.split(':').pop()!)).toBe('示例养老年金保险');
		const reholding = 'Assets:Investments:Wealth-a1b2c3-余利宝-示例产品-202609再持有';
		expect(formatAccountDisplayName(reholding, reholding.split(':').pop()!)).toBe('示例产品-202609再持有');
	});

	it('retains loan purpose, date and original principal without inventing a balance', () => {
		expect(formatLoanDisplayName('Lend-a1b2c3-CompanyLoan-小林-分红转借款-202401-10W')).toBe('小林-分红转借款-202401-10W');
		expect(formatLoanDisplayName('借出-小林-分红转借款')).toBe('借出-小林-分红转借款');
		expect(formatLoanDisplayName('Borrow-a1b2c3-NewPurpose-小林')).toBe('NewPurpose-小林');
	});

	it('leaves bank accounts and category identity intact', () => {
		const bank = 'CMB-CNY-招商银行-信用卡-1234';
		expect(formatAccountDisplayName(`Liabilities:Accounts:${bank}`, bank)).toBe(bank);
		expect(getBalanceAccountDisplayName('Assets:Loans', 'Loans')).toBe('Loan Receivables');
		expect(getBalanceAccountDisplayName('Liabilities:Loans', 'Loans')).toBe('Loan Payables');
		expect(formatAccountDisplayName(undefined, 'Other')).toBe('Other');
	});

	it('keeps separate account references when two channels hold the same product', () => {
		const accounts = ['Assets:Investments:ETF-a1b2c3-富途-示例ETF-02834', 'Assets:Investments:ETF-d4e5f6-长桥-示例ETF-02834'];
		const titles = accounts.map(account => formatAccountDisplayName(account, account.split(':').pop()!));
		expect(titles).toEqual(['示例ETF-02834', '示例ETF-02834']);
		expect(accounts.map(getAccountDisplayContext)).toEqual(['富途-a1b2c3', '长桥-d4e5f6']);
		expect(getAccountDisplayContext('Liabilities:Loans:Borrow-a1b2c3-Loan-小林')).toBe('a1b2c3');
		expect(getAccountDisplayContext('Assets:Accounts:CNY')).toBe('');
	});

	it('supports both the old source name and the visible title in searches', () => {
		const source = '【余利宝】示例产品';
		const title = formatInvestmentDisplayName(source);
		expect(matchesReportSearch(source, [source, title])).toBe(true);
		expect(matchesReportSearch(title, [source, title])).toBe(true);
		expect(matchesReportSearch('余利宝', [source, title])).toBe(true);
	});

	it('is idempotent for already formatted product and purpose titles', () => {
		for (const raw of ['【余利宝】示例-30天持有A', '【投顾】稳健组合', '高腾微财货币基金A HKD Acc']) {
			const name = formatInvestmentDisplayName(raw);
			expect(formatInvestmentDisplayName(name)).toBe(name);
		}
		const loan = formatLoanDisplayName('Lend-a1b2c3-Loan-小林-分红转借款');
		expect(formatLoanDisplayName(loan)).toBe(loan);
	});
});
