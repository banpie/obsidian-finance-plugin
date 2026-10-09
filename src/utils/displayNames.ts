/** Presentation only: never use these names as ledger keys or grouping keys. */
const investmentChannels = new Set([
	'BBAE', '众安', '余利宝', '余额宝', '兴银', '华宝', '华西', '周利宝',
	'增利宝', '多渠道', '富途', '工银', '广发', '微众', '支付宝', '月利宝',
	'汇丰', '理财通', '盈立', '稳利宝', '网商', '长桥', '雪球', '香港汇丰', '香港华泰',
]);

const investmentKeyPrefix = /^(?:BiddingClub|Bond|CallDeposit|Deposit|ETF|Fund|Insurance|MMF|QDII|Repo|RoboAdvisor|Stock|Wealth)-[a-zA-Z0-9]{5,8}-/;
const loanKeyPrefix = /^(?:Lend|Borrow)-[a-fA-F0-9]{6}-/;
const loanTypePrefix = /^(?:Loan|PrivateLoan|FXQuota|FamilyAdvance|PurchaseAdvance|CompanyLoan|HomePurchase|InvestmentProxy|Clearing|ConsumerLoan|SocialSecurity|Renovation|BiddingClub)-/;

export function normalizeNameSeparators(value: string): string {
	return value.trim()
		.replace(/[【】]/g, '-')
		.replace(/\s*-\s*/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '');
}

/** Remove whole leading channel tokens, never substrings of an issuer/product. */
export function formatInvestmentDisplayName(value: string): string {
	const name = normalizeNameSeparators(value);
	const parts = name.split('-');
	while (parts.length > 1 && investmentChannels.has(parts[0])) parts.shift();
	return parts.join('-');
}

/** Keep counterparties, purpose, dates and amounts supplied by the source. */
export function formatLoanDisplayName(value: string): string {
	const name = normalizeNameSeparators(value);
	if (!loanKeyPrefix.test(name)) return name;
	return name.replace(loanKeyPrefix, '').replace(loanTypePrefix, '');
}

export function formatAccountDisplayName(account: string | undefined, fallback: string): string {
	if (account?.startsWith('Assets:Investments:')) {
		return formatInvestmentDisplayName(normalizeNameSeparators(fallback).replace(investmentKeyPrefix, ''));
	}
	if (account?.startsWith('Assets:Loans:') || account?.startsWith('Liabilities:Loans:')) {
		return formatLoanDisplayName(fallback);
	}
	return fallback;
}

/** Small account reference separate from the product/purpose title. */
export function getAccountDisplayContext(account: string | undefined): string {
	const leaf = (account || '').split(':').pop() || '';
	const investment = account?.startsWith('Assets:Investments:') && investmentKeyPrefix.test(leaf);
	const loan = (account?.startsWith('Assets:Loans:') || account?.startsWith('Liabilities:Loans:')) && loanKeyPrefix.test(leaf);
	if (!investment && !loan) return '';
	const parts = leaf.split('-');
	if (investment && investmentChannels.has(parts[2])) return `${parts[2]}-${parts[1]}`;
	return parts[1];
}
