const MONEY_CURRENCY_CODES = new Set([
	'AED',
	'AUD',
	'BRL',
	'CAD',
	'CHF',
	'CNH',
	'CNY',
	'EUR',
	'GBP',
	'HKD',
	'IDR',
	'INR',
	'JPY',
	'KRW',
	'MOP',
	'MYR',
	'NZD',
	'SGD',
	'THB',
	'TRY',
	'TWD',
	'USD',
	'VND',
]);

export function normalizeMoneyCurrencyOptions(rawCurrencies: string[], operatingCurrency: string): string[] {
	const seen = new Set<string>();
	const normalized = [operatingCurrency, ...rawCurrencies]
		.map((currency) => String(currency || '').trim().toUpperCase())
		.filter((currency) => currency && MONEY_CURRENCY_CODES.has(currency))
		.filter((currency) => {
			if (seen.has(currency)) return false;
			seen.add(currency);
			return true;
		});

	return normalized.length > 0 ? normalized : [operatingCurrency || 'USD'];
}
