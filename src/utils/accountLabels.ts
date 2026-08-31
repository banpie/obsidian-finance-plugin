/**
 * Returns a user-facing label for a balance-sheet major category.
 *
 * Beancount keeps receivables and payables under similarly named loan
 * account trees. The account root is part of the meaning, so displaying
 * only the raw `Loans` segment is ambiguous in balance and allocation views.
 */
export function getBalanceCategoryLabel(account: string | undefined): string {
	const parts = (account || '').split(':');
	const root = parts[0];
	const category = parts[1];

	if (root === 'Assets' && category === 'Loans') return 'Loan Receivables';
	if (root === 'Liabilities' && category === 'Loans') return 'Loan Payables';
	return category || account || 'Other';
}

/**
 * Returns the display name for an account node in the balance-sheet tree.
 */
export function getBalanceAccountDisplayName(accountPath: string, fallback: string): string {
	if (accountPath === 'Assets:Loans') return 'Loan Receivables';
	if (accountPath === 'Liabilities:Loans') return 'Loan Payables';
	return fallback;
}
