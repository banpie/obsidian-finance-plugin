// src/models/schedule.ts
// Shared types for scheduled/recurring transaction directives.

import type { PostingStub } from '../utils/directives/types';

/**
 * Represents a parsed "Recurring" event directive (a scheduled/recurring
 * transaction template). Mirrors the shape used in
 * UpcomingTransactionsSection.svelte and AddScheduleModal.svelte.
 */
export interface ScheduledTransactionItem {
	name: string;
	frequency: 'One-time' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | (string & {});
	startDate: string;
	nextDate: string;
	lastGenerated?: string;
	active: boolean;
	payee?: string;
	narration?: string;
	flag?: string;
	tags: string[];
	links: string[];
	postings: PostingStub[];
	/** Sum of positive-amount postings, computed and saved at write time — see computeScheduleDisplayAmount(). */
	displayAmount?: number;
	displayCurrency?: string;
	filename?: string;
	lineno?: number;
	/** True when `nextDate` is today or earlier — computed client-side. */
	isDue: boolean;
}

/** One specific missed/due occurrence of a schedule — a schedule that's
 * fallen behind by several cycles produces several of these. */
export interface DueOccurrence {
	schedule: ScheduledTransactionItem;
	date: string;
}
