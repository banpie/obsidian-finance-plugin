// src/utils/directives/scheduleDirectives.ts

import type BeancountPlugin from '../../main';
import type { ScheduleDirectiveParams, PostingStub } from './types';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

/**
 * A single representative "amount" for a schedule with multiple postings:
 * the sum of every positive-amount posting that shares the currency of the
 * first positive posting encountered (postings in other currencies, or with
 * a negative/blank amount, don't contribute). Returns `null` when no posting
 * has an explicit positive amount (e.g. every leg is blank or negative).
 */
export function computeScheduleDisplayAmount(postings: PostingStub[]): { amount: number; currency: string } | null {
	const positiveLegs = postings.filter((p) => p.amount !== undefined && p.amount > 0 && p.currency);
	if (positiveLegs.length === 0) return null;
	const currency = positiveLegs[0].currency as string;
	const amount = positiveLegs
		.filter((p) => p.currency === currency)
		.reduce((sum, p) => sum + (p.amount ?? 0), 0);
	return { amount, currency };
}

function buildDirectiveLines(params: ScheduleDirectiveParams): string[] {
	const lines = [
		`${params.startDate} event "Recurring" "${params.name}"`,
		`\tfrequency: "${params.frequency}"`,
		`\tstartDate: "${params.startDate}"`,
		`\tnextDate: "${params.nextDate}"`,
		`\tactive: ${params.active ? 1 : 0}`,
	];
	if (params.lastGenerated) lines.push(`\tlastGenerated: "${params.lastGenerated}"`);
	if (params.payee) lines.push(`\tpayee: "${params.payee}"`);
	if (params.narration) lines.push(`\tnarration: "${params.narration}"`);
	lines.push(`\tflag: "${params.flag || '*'}"`);
	if (params.tags && params.tags.length > 0) lines.push(`\ttags: "${params.tags.join(',')}"`);
	if (params.links && params.links.length > 0) lines.push(`\tlinks: "${params.links.join(',')}"`);
	if (params.displayAmount !== undefined && params.displayCurrency) {
		lines.push(`\tdisplayAmount: ${params.displayAmount}`);
		lines.push(`\tdisplayCurrency: "${params.displayCurrency}"`);
	}
	lines.push(`\tpostingCount: ${params.postings.length}`);
	params.postings.forEach((posting, i) => {
		const n = i + 1;
		lines.push(`\tposting${n}Account: "${posting.account}"`);
		// Blank/elided posting (beancount infers the amount to balance the
		// transaction) — omit Amount/Currency entirely, mirroring how
		// generateTransactionText() omits them for a real transaction posting.
		if (posting.amount !== undefined && posting.currency) {
			lines.push(`\tposting${n}Amount: ${posting.amount}`);
			lines.push(`\tposting${n}Currency: "${posting.currency}"`);
		}
	});
	return lines;
}

export async function createScheduleDirective(
	plugin: BeancountPlugin,
	params: ScheduleDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'event');
		if (!filePath) return { success: false, error: 'Events file path not set. Please configure the plugin.' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = buildDirectiveLines(params).join('\n');

		await createBackupFile(plugin, normalizedPath, createBackup, 'createScheduleDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newContent = content.endsWith('\n')
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createScheduleDirective] Saved schedule "${params.name}"`);
		return { success: true };
	} catch (error) {
		Logger.error('[createScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateScheduleDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	params: ScheduleDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'updateScheduleDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Recurring"'))
			return { success: false, error: `Line ${lineno} does not appear to be a Recurring event directive` };

		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		const newDirectiveLines = buildDirectiveLines(params);
		lines.splice(lineIndex, endIndex - lineIndex, ...newDirectiveLines);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[updateScheduleDirective] Updated schedule directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteScheduleDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'deleteScheduleDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Recurring"'))
			return { success: false, error: `Line ${lineno} does not appear to be a Recurring event directive` };

		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		let startIndex = lineIndex;
		if (startIndex > 0 && lines[startIndex - 1].trim() === '') {
			startIndex--;
		}

		lines.splice(startIndex, endIndex - startIndex);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[deleteScheduleDirective] Deleted schedule directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Advances `dateStr` by one cycle of `frequency`. Returns `null` for
 * `'One-time'` (no further occurrence — caller should deactivate instead).
 *
 * Month/quarter/year arithmetic clamps the day-of-month into the target
 * month (e.g. Jan 31 + Monthly → Feb 28/29) and does NOT re-snap back to the
 * original day in a later, longer month — once clamped, the schedule keeps
 * advancing from the clamped day.
 */
export function advanceScheduleDate(dateStr: string, frequency: string): string | null {
	const [y, m, d] = dateStr.split('-').map(Number);
	if (!y || !m || !d) return null;

	const toISO = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

	switch (frequency) {
		case 'One-time':
			return null;
		case 'Weekly': {
			const date = new Date(y, m - 1, d + 7);
			return toISO(date);
		}
		case 'Monthly':
			return addMonthsClamped(y, m, d, 1);
		case 'Quarterly':
			return addMonthsClamped(y, m, d, 3);
		case 'Yearly':
			return addMonthsClamped(y, m, d, 12);
		default:
			return null;
	}
}

function addMonthsClamped(year: number, month: number, day: number, monthsToAdd: number): string {
	const targetMonthIndex = month - 1 + monthsToAdd; // 0-based, may exceed 11
	const targetYear = year + Math.floor(targetMonthIndex / 12);
	const targetMonth = ((targetMonthIndex % 12) + 12) % 12; // 0-based, normalized
	const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
	const clampedDay = Math.min(day, daysInTargetMonth);
	return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Every occurrence of a schedule that's due as of `todayISO`, oldest first —
 * walks forward from `nextDate` via `advanceScheduleDate()` collecting every
 * date `<= todayISO`. A schedule that's fallen behind by several cycles
 * returns all of them (not just the next one), so the confirm-due UI can
 * offer each missed occurrence independently. `'One-time'` schedules return
 * at most one entry, since there's no further occurrence to advance to.
 */
export function computeDueOccurrences(nextDate: string, frequency: string, todayISO: string): string[] {
	const occurrences: string[] = [];
	let cursor: string | null = nextDate;
	while (cursor !== null && cursor <= todayISO) {
		occurrences.push(cursor);
		if (frequency === 'One-time') break;
		cursor = advanceScheduleDate(cursor, frequency);
	}
	return occurrences;
}
