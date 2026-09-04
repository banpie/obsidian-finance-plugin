// src/utils/directives/indicatorDirectives.ts

import type BeancountPlugin from '../../main';
import type { IndicatorDirectiveParams } from './types';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

export async function createIndicatorDirective(
	plugin: BeancountPlugin,
	params: IndicatorDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'event');
		if (!filePath) return { success: false, error: 'Events file path not set. Please configure the plugin.' };

		const normalizedPath = convertWslPathToWindows(filePath);

		const lines = [
			`${params.startDate} event "Indicator" "${params.type}"`,
			`\taccountQuery: "${params.accountQuery}"`,
			`\tname: "${params.name}"`,
			`\tcycle: "${params.cycle}"`,
			`\tisRollover: ${params.isRollover ? 1 : 0}`,
			`\ttarget: ${params.target.toFixed(2)}`,
			`\tcurrency: "${params.currency}"`,
		];
		if (params.tag && params.tag.trim()) {
			lines.push(`\ttag: "${params.tag.trim()}"`);
			lines.push(`\ttagMode: "${params.tagMode || 'has'}"`);
		}
		const directiveText = lines.join('\n');

		await createBackupFile(plugin, normalizedPath, createBackup, 'createIndicatorDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newContent = content.endsWith('\n')
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createIndicatorDirective] Saved ${params.type} indicator "${params.name}"`);
		return { success: true };
	} catch (error) {
		Logger.error('[createIndicatorDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateIndicatorDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	params: IndicatorDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'updateIndicatorDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Indicator"'))
			return { success: false, error: `Line ${lineno} does not appear to be an Indicator event directive` };

		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		const newDirectiveLines = [
			`${params.startDate} event "Indicator" "${params.type}"`,
			`\taccountQuery: "${params.accountQuery}"`,
			`\tname: "${params.name}"`,
			`\tcycle: "${params.cycle}"`,
			`\tisRollover: ${params.isRollover ? 1 : 0}`,
			`\ttarget: ${params.target.toFixed(2)}`,
			`\tcurrency: "${params.currency}"`,
		];
		if (params.tag && params.tag.trim()) {
			newDirectiveLines.push(`\ttag: "${params.tag.trim()}"`);
			newDirectiveLines.push(`\ttagMode: "${params.tagMode || 'has'}"`);
		}

		lines.splice(lineIndex, endIndex - lineIndex, ...newDirectiveLines);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[updateIndicatorDirective] Updated indicator directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateIndicatorDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteIndicatorDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'deleteIndicatorDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Indicator"'))
			return { success: false, error: `Line ${lineno} does not appear to be an Indicator event directive` };

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

		Logger.log(`[deleteIndicatorDirective] Deleted indicator directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteIndicatorDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
