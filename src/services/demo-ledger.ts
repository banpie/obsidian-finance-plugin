// src/services/demo-ledger.ts
//
// Generates the onboarding demo ledger content. All dates are computed
// relative to `referenceDate` (defaults to "now") rather than hardcoded, so
// the demo always reads as current — roughly six months of transaction
// history ending today, plus a handful of scheduled/recurring transactions
// due in the near future — regardless of when a user actually onboards.

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `daysAgo` days before `ref` (or after, if negative). Pure day-count offset
 * — always well-defined and safe (no calendar-month edge cases), unlike
 * month/day-of-month arithmetic against a moving "today". */
function isoDays(ref: Date, daysAgo: number): string {
	const d = new Date(ref);
	d.setDate(d.getDate() - daysAgo);
	return toISO(d);
}

function fmt(n: number): string {
	return n.toFixed(2);
}

export function getDemoLedgerContent(referenceDate: Date = new Date()): string {
	const ref = referenceDate;
	const d = (daysAgo: number) => isoDays(ref, daysAgo);

	// Six historical "months", oldest → newest, expressed as a days-ago
	// anchor for that month's 1st. Non-uniform gaps (31/30/31/30/31 days)
	// mirror real calendar months so the narrative reads naturally. The most
	// recent anchor (18) is intentionally close to "today" — later deltas
	// within that month (transport/interest/savings-transfer, delta 19+)
	// naturally fall in the future and get skipped, so the current month
	// reads as "in progress" rather than magically complete.
	const monthAnchors = [171, 140, 110, 79, 49, 18];
	const ccPayment = [300, 318, 285, 260, 295, 270];
	const utilities = [105, 118, 98, 112, 102, 108];
	const groceries1 = [120, 140, 130, 145, 128, 140];
	const groceries2 = [95, 110, 102, 118, 135, 102];
	const dining = [58, 72, 64, 80, 52, 45];
	const transport = [52, 48, 55, 50, 58];
	const interest = [12.50, 13.10, 14.20, 15.80, 16.40];

	// The promotion (and accompanying raise) lands partway through month
	// index 3 — salary paid before it is still the old amount, after it is
	// the new amount. Expressed as a days-ago threshold so it's independent
	// of which literal transaction happens to trigger it.
	const raiseThresholdDaysAgo = monthAnchors[3] - 2; // 2 days after that month's 1st
	const salaryAmount = (daysAgo: number) => (daysAgo < raiseThresholdDaysAgo ? 3400 : 3200);

	const blocks: string[] = [];

	blocks.push(`${d(monthAnchors[0])} * "Opening Balance"
  Assets:Checking             5000.00 USD
  Assets:Savings             10000.00 USD
  Liabilities:CreditCard      -300.00 USD
  Equity:Opening-Balances  -14700.00 USD`);

	for (let i = 0; i < monthAnchors.length; i++) {
		const anchor = monthAnchors[i];
		const isLast = i === monthAnchors.length - 1;
		const within = (delta: number) => anchor - delta >= 0;

		blocks.push(`${d(anchor)} * "Landlord" "Monthly rent" #rent
  Expenses:Rent      1450.00 USD
  Assets:Checking   -1450.00 USD`);

		blocks.push(`${d(anchor)} * "Employer" "Semi-monthly salary" ^paycheck-${i}a
  Assets:Checking   ${fmt(salaryAmount(anchor))} USD
  Income:Salary    -${fmt(salaryAmount(anchor))} USD`);

		if (within(2)) blocks.push(`${d(anchor - 2)} * "Credit Card Co" "Payment towards balance" ^cc-payment-${i}
  Liabilities:CreditCard   ${fmt(ccPayment[i])} USD
  Assets:Checking         -${fmt(ccPayment[i])} USD`);

		if (within(4)) blocks.push(`${d(anchor - 4)} * "Utility Co" "Electric & water" #utilities
  Expenses:Utilities   ${fmt(utilities[i])} USD
  Assets:Checking     -${fmt(utilities[i])} USD`);

		if (within(7)) blocks.push(`${d(anchor - 7)} * "Grocery Store" "Weekly groceries" #food #groceries
  Expenses:Food:Groceries   ${fmt(groceries1[i])} USD
  Liabilities:CreditCard   -${fmt(groceries1[i])} USD`);

		if (within(11)) blocks.push(`${d(anchor - 11)} * "Bistro Nine" "Dinner out" #dining #food
  Expenses:Food:Dining   ${fmt(dining[i])} USD
  Liabilities:CreditCard -${fmt(dining[i])} USD`);

		if (!isLast && within(14)) blocks.push(`${d(anchor - 14)} * "Netflix" "Monthly subscription" #subscriptions
  Expenses:Subscriptions   15.99 USD
  Assets:Checking          -15.99 USD`);

		if (within(14)) blocks.push(`${d(anchor - 14)} * "Employer" "Semi-monthly salary" ^paycheck-${i}b
  Assets:Checking   ${fmt(salaryAmount(anchor - 14))} USD
  Income:Salary    -${fmt(salaryAmount(anchor - 14))} USD`);

		if (within(16)) blocks.push(`${d(anchor - 16)} * "Grocery Store" "Weekly groceries" #food #groceries
  Expenses:Food:Groceries   ${fmt(groceries2[i])} USD
  Liabilities:CreditCard   -${fmt(groceries2[i])} USD`);

		if (within(19)) blocks.push(`${d(anchor - 19)} * "Gas Station" "Fuel" #transport
  Expenses:Transport   ${fmt(transport[i])} USD
  Assets:Checking     -${fmt(transport[i])} USD`);

		if (within(27)) blocks.push(`${d(anchor - 27)} * "Bank" "Interest payment"
  Assets:Savings    ${fmt(interest[i])} USD
    interest: "0.25% APY"
  Income:Interest  -${fmt(interest[i])} USD`);

		if (within(28)) blocks.push(`${d(anchor - 28)} * "Self" "Monthly savings transfer"
  Assets:Savings     1000.00 USD
  Assets:Checking   -1000.00 USD`);
	}

	// One-off "special" transactions — investments, multi-currency, life
	// events tied to the ledger — placed at fixed days-ago offsets within
	// the same six-month window.
	blocks.push(`${d(162)} * "Broker" "Buy Apple shares"
  Assets:Investments          10 AAPL {187.00 USD, ${d(162)}}
  Expenses:Commissions      8.95 USD
  Assets:Checking       -1878.95 USD`);

	blocks.push(`${d(150)} * "Cinema City" "Movie night" #entertainment
  Expenses:Entertainment   45.00 USD
  Liabilities:CreditCard  -45.00 USD`);

	blocks.push(`${d(137)} * "Downtown Clinic" "Doctor copay" #health
  Expenses:Health   85.00 USD
  Assets:Checking  -85.00 USD`);

	blocks.push(`${d(131)} * "Broker" "Buy Alphabet shares"
  Assets:Investments          5 GOOGL {144.00 USD, ${d(131)}}
  Expenses:Commissions     6.95 USD
  Assets:Checking        -726.95 USD`);

	blocks.push(`${d(116)} * "Outfitters" "New work wardrobe" #shopping
  Expenses:Shopping   210.00 USD
  Liabilities:CreditCard  -210.00 USD`);

	blocks.push(`${d(105)} * "Exchange" "Buy Bitcoin"
  Assets:Investments:Crypto        0.03 BTC {42000.00 USD, ${d(105)}}
  Expenses:Commissions        12.50 USD
  Assets:Checking          -1272.50 USD`);

	blocks.push(`${d(101)} * "Currency Exchange" "Convert USD to CAD for trip"
  Assets:Savings:CAD    1500.00 CAD @ 0.79 USD
  Assets:Checking       -1185.00 USD`);

	blocks.push(`${d(89)} * "Cinema City" "Movie night" #entertainment
  Expenses:Entertainment   38.00 USD
  Liabilities:CreditCard  -38.00 USD`);

	blocks.push(`${d(86)} * "Broker" "Buy Microsoft shares"
  Assets:Investments           3 MSFT {418.00 USD, ${d(86)}}
  Expenses:Commissions      7.95 USD
  Assets:Checking        -1261.95 USD`);

	blocks.push(`${d(74)} * "Maple Leaf Tours" "Weekend trip" #travel
  Expenses:Travel          450.00 CAD
  Assets:Savings:CAD      -450.00 CAD`);

	blocks.push(`${d(70)} * "Broker" "Sell Apple shares - partial position"
  Assets:Investments        -3 AAPL {187.00 USD, ${d(162)}} @ 205.00 USD
  Expenses:Commissions    6.95 USD
  Assets:Investments     608.05 USD
  Income:CapitalGains    -54.00 USD`);

	blocks.push(`${d(58)} * "Downtown Clinic" "Pharmacy" #health
  Expenses:Health   40.00 USD
  Assets:Checking  -40.00 USD`);

	blocks.push(`${d(55)} * "Broker" "Apple quarterly dividend"
  Assets:Investments   38.50 USD
  Income:Dividends    -38.50 USD`);

	blocks.push(`${d(48)} * "SafeGuard Insurance" "Quarterly home & auto insurance" #insurance
  Expenses:Insurance   450.00 USD
  Assets:Checking     -450.00 USD`);

	blocks.push(`${d(40)} * "Broker" "Alphabet quarterly dividend"
  Assets:Investments   22.10 USD
  Income:Dividends    -22.10 USD`);

	blocks.push(`${d(28)} * "Cinema City" "Concert tickets" #entertainment
  Expenses:Entertainment   62.00 USD
  Liabilities:CreditCard  -62.00 USD`);

	blocks.push(`${d(25)} * "Broker" "Microsoft quarterly dividend"
  Assets:Investments   19.80 USD
  Income:Dividends    -19.80 USD`);

	blocks.push(`${d(20)} * "Outfitters" "Summer sale" #shopping
  Expenses:Shopping   175.00 USD
  Liabilities:CreditCard  -175.00 USD`);

	blocks.push(`${d(10)} ! "Bank" "Monthly maintenance fee (needs review)"
  ; Intentionally unbalanced by $2 to demonstrate how the plugin's
  ; Errors tab surfaces a real Beancount validation problem.
  Expenses:Utilities   4.00 USD
  Assets:Checking     -2.00 USD`);

	blocks.push(`${d(2)} ! "Online Store" "Pending charge" #shopping
  Expenses:Shopping   89.99 USD
  Liabilities:CreditCard  -89.99 USD`);

	const transactionsSection = blocks.join('\n\n');

	return `;; Beancount Demo Ledger
;; Created by Beancount for Obsidian
;; Comprehensive example demonstrating all major Beancount features
;; (dates are generated relative to today, so this file always reads as current)

;; ============================================================================
;; Global Options
;; ============================================================================

option "title" "Personal Finance Demo"
option "operating_currency" "USD"

;; ============================================================================
;; Commodities
;; ============================================================================

1970-01-01 commodity USD
  name: "US Dollar"
  asset-class: "cash"
1970-01-01 commodity EUR
  name: "Euro"
  asset-class: "cash"
2020-01-01 commodity AAPL
  name: "Apple Inc."
  price: "USD:yahoo/AAPL"
  logo: "https://logos.hunter.io/apple.com"
  asset-class: "stock"
2020-01-01 commodity GOOGL
  name: "Alphabet Inc."
  price: "USD:yahoo/GOOGL"
  logo: "https://logos.hunter.io/google.com"
  asset-class: "stock"
2020-01-01 commodity MSFT
  name: "Microsoft Corporation"
  price: "USD:yahoo/MSFT"
  logo: "https://logos.hunter.io/microsoft.com"
  asset-class: "stock"
2020-01-01 commodity CAD
  name: "Canadian Dollar"
  asset-class: "cash"
2020-01-01 commodity BTC
  name: "Bitcoin"
  asset-class: "crypto"

;; ============================================================================
;; Accounts
;; ============================================================================

2020-01-01 open Assets:Checking                                 USD
  description: "Primary checking account"
  reconcile: 14
2020-01-01 open Assets:Savings                                  USD
  description: "High-yield savings account"
  reconcile: 30
2020-01-01 open Assets:Savings:CAD                              USD, CAD
  description: "CAD savings account for travel"
  reconcile: 60
2020-01-01 open Assets:Investments                              USD, MSFT, GOOGL, AAPL
  description: "Investment brokerage account"
2020-01-01 open Assets:Investments:Crypto                       USD, BTC
  description: "Crypto portfolio account"
2020-01-01 open Liabilities:CreditCard                          USD
  description: "Credit card account"
  reconcile: 30
2020-01-01 open Income:Salary                                   USD
  description: "Employment income"
2020-01-01 open Income:Interest                                 USD
  description: "Interest income from savings"
2020-01-01 open Income:Dividends                                USD
  description: "Dividend income from investments"
2020-01-01 open Income:CapitalGains                             USD
  description: "Capital gains from investment sales"
2020-01-01 open Expenses:Food:Groceries                         USD
2020-01-01 open Expenses:Food:Dining                            USD
2020-01-01 open Expenses:Rent                                   USD
2020-01-01 open Expenses:Utilities                              USD
2020-01-01 open Expenses:Transport                               USD
2020-01-01 open Expenses:Shopping                                USD
2020-01-01 open Expenses:Commissions                             USD
2020-01-01 open Expenses:Subscriptions                           USD
2020-01-01 open Expenses:Entertainment                           USD
2020-01-01 open Expenses:Health                                  USD
2020-01-01 open Expenses:Insurance                                USD
2020-01-01 open Expenses:Travel                                   USD, CAD
2020-01-01 open Equity:Opening-Balances                          USD

;; ============================================================================
;; Price History
;; ============================================================================

${d(171)} price AAPL                               187.00 USD
${d(171)} price GOOGL                              144.00 USD
${d(171)} price MSFT                               418.00 USD
${d(171)} price EUR                                  1.11 USD
${d(171)} price CAD                                  0.79 USD
${d(171)} price BTC                              38000.00 USD

${d(110)} price AAPL                               201.40 USD
${d(110)} price GOOGL                              151.20 USD
${d(110)} price MSFT                               430.10 USD
${d(110)} price EUR                                  1.10 USD
${d(110)} price CAD                                  0.79 USD
${d(110)} price BTC                              42000.00 USD

${d(49)} price AAPL                               210.30 USD
${d(49)} price GOOGL                              156.40 USD
${d(49)} price MSFT                               441.20 USD
${d(49)} price EUR                                  1.10 USD
${d(49)} price CAD                                  0.78 USD
${d(49)} price BTC                              48000.00 USD

${d(4)} price AAPL                               218.90 USD
${d(4)} price GOOGL                              160.20 USD
${d(4)} price MSFT                               452.30 USD
${d(4)} price BTC                              54500.00 USD

;; ============================================================================
;; Pad Directives
;; ============================================================================
;; (none in this demo)

;; ============================================================================
;; Balance Assertions
;; ============================================================================

${d(49)} balance Assets:Savings                                  14055.60 USD
${d(14)} balance Assets:Savings:CAD                                1050.00 CAD
${d(7)} balance Liabilities:CreditCard                             -791.00 USD
${d(4)} balance Assets:Checking                                  17683.70 USD

;; ============================================================================
;; Named Queries
;; ============================================================================

${d(0)} query "monthly-expenses" "
  SELECT date, narration, COST(position) AS amount
  FROM account ~ 'Expenses:'
  WHERE year = YEAR(TODAY()) AND month = MONTH(TODAY())
"

;; ============================================================================
;; Notes
;; ============================================================================

${d(171)} note Assets:Checking "Primary checking account - switched from old bank"
${d(126)} note Liabilities:CreditCard "APR is 18.99% - keep paying down monthly"
${d(101)} note Assets:Savings:CAD "Funded for the summer trip to Canada"
${d(78)} note Income:Salary "Raise took effect with the promotion"

;; ============================================================================
;; Events
;; ============================================================================

${d(171)} event "location" "New York"
${d(126)} event "tax-filing" "Filed last year's tax return"
${d(78)} event "employer" "Promoted to Senior Position"

${d(171)} event "Indicator" "Budget"
  accountQuery: "Expenses:Food"
  name: "Monthly Food Budget"
  cycle: "Monthly"
  isRollover: 0
  target: 500.00
  currency: "USD"
${d(171)} event "Indicator" "Budget"
  accountQuery: "Expenses:(Shopping|Entertainment)"
  name: "Fun Budget"
  cycle: "Monthly"
  isRollover: 1
  target: 300.00
  currency: "USD"
${d(171)} event "Indicator" "Target"
  accountQuery: "Assets:Savings"
  name: "Emergency Fund"
  cycle: "Yearly"
  isRollover: 1
  target: 15000.00
  currency: "USD"

;; Scheduled / recurring transactions — showcases every frequency
;; (Weekly/Monthly/Quarterly/One-time) and both due-now and upcoming states.
${d(18)} event "Recurring" "Rent"
	frequency: "Monthly"
	startDate: "${isoDays(ref, -13)}"
	nextDate: "${isoDays(ref, -13)}"
	active: 1
	payee: "Landlord"
	narration: "Monthly rent"
	flag: "*"
	tags: "rent"
	displayAmount: 1450
	displayCurrency: "USD"
	postingCount: 2
	posting1Account: "Expenses:Rent"
	posting1Amount: 1450
	posting1Currency: "USD"
	posting2Account: "Assets:Checking"
	posting2Amount: -1450
	posting2Currency: "USD"
${d(18)} event "Recurring" "Netflix"
	frequency: "Monthly"
	startDate: "${isoDays(ref, -6)}"
	nextDate: "${isoDays(ref, -6)}"
	active: 1
	payee: "Netflix"
	narration: "Monthly subscription"
	flag: "*"
	tags: "subscriptions"
	displayAmount: 15.99
	displayCurrency: "USD"
	postingCount: 2
	posting1Account: "Expenses:Subscriptions"
	posting1Amount: 15.99
	posting1Currency: "USD"
	posting2Account: "Assets:Checking"
	posting2Amount: -15.99
	posting2Currency: "USD"
${d(48)} event "Recurring" "Home & Auto Insurance"
	frequency: "Quarterly"
	startDate: "${isoDays(ref, -43)}"
	nextDate: "${isoDays(ref, -43)}"
	active: 1
	payee: "SafeGuard Insurance"
	narration: "Quarterly premium"
	flag: "*"
	tags: "insurance"
	displayAmount: 450
	displayCurrency: "USD"
	postingCount: 2
	posting1Account: "Expenses:Insurance"
	posting1Amount: 450
	posting1Currency: "USD"
	posting2Account: "Assets:Checking"
	posting2Amount: -450
	posting2Currency: "USD"
${d(45)} event "Recurring" "Gym Membership"
	frequency: "Weekly"
	startDate: "${d(45)}"
	nextDate: "${d(3)}"
	active: 1
	payee: "FitLife Gym"
	narration: "Weekly membership fee"
	flag: "*"
	tags: "health"
	displayAmount: 20
	displayCurrency: "USD"
	postingCount: 2
	posting1Account: "Expenses:Health"
	posting1Amount: 20
	posting1Currency: "USD"
	posting2Account: "Assets:Checking"
	posting2Amount: -20
	posting2Currency: "USD"
${d(9)} event "Recurring" "New Laptop"
	frequency: "One-time"
	startDate: "${isoDays(ref, -27)}"
	nextDate: "${isoDays(ref, -27)}"
	active: 1
	payee: "Tech Store"
	narration: "Replace aging work laptop"
	flag: "*"
	tags: "shopping"
	displayAmount: 1500
	displayCurrency: "USD"
	postingCount: 2
	posting1Account: "Expenses:Shopping"
	posting1Amount: 1500
	posting1Currency: "USD"
	posting2Account: "Assets:Savings"

;; ============================================================================
;; Transactions
;; ============================================================================

${transactionsSection}
`;
}
