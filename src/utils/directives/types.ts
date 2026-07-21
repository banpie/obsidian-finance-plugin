// src/utils/directives/types.ts

export interface FileLineRow {
	filename: string;
	lineno: string;
}

export interface BalanceData {
	date: string;
	account: string;
	amount: string | number;
	currency: string;
	tolerance?: string | number;
}

export interface NoteData {
	date: string;
	account: string;
	comment: string;
	tags?: string[];
	links?: string[];
}

export interface CostData {
	number?: string | number;
	currency?: string;
	isTotal?: boolean;
	date?: string;
	label?: string;
}

export interface PriceDataPayload {
	amount?: string | number;
	currency?: string;
	isTotal?: boolean;
}

export interface PostingData {
	flag?: string;
	account: string;
	amount?: string | number;
	currency?: string;
	cost?: CostData;
	price?: PriceDataPayload;
	comment?: string;
	metadata?: Record<string, string>;
}

export interface TransactionData {
	date: string;
	flag?: string;
	payee?: string;
	narration?: string;
	tags?: string[];
	links?: string[];
	metadata?: Record<string, string>;
	postings?: PostingData[];
}

export interface IndicatorDirectiveParams {
	type: 'Budget' | 'Target';
	name: string;
	accountQuery: string;
	cycle: 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly' | (string & {});
	target: number;
	currency: string;
	isRollover: boolean;
	startDate: string; // ISO date string YYYY-MM-DD
	tag?: string;      // optional tag name (without #)
	tagMode?: 'has' | 'not_has';
}
