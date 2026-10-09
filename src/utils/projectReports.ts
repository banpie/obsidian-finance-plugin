/** A project tag is its identity; a display label may be absent or renamed. */
export function projectReportKey(label: string | null | undefined, tag: string | undefined): string {
	const normalizedTag = (tag || '').trim();
	return normalizedTag ? `tag:${normalizedTag}` : `label:${(label || '').trim() || 'Unassigned'}`;
}

export function projectTransactionTypeLabelKey(type: 'Income' | 'Expense', amount: number): string {
	if (type === 'Expense' && amount > 0) return 'Refund / expense reduction';
	if (type === 'Income' && amount < 0) return 'Income reversal';
	return type;
}
