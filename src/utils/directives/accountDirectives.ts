// src/utils/directives/accountDirectives.ts

import type BeancountPlugin from '../../main';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

export async function saveOpenDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	currencies?: string[],
	booking?: string,
	metadata?: Record<string, string>,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'account', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const parts = [date, 'open', account];
		if (currencies && currencies.length > 0) parts.push(currencies.join(','));
		if (booking) parts.push(`"${booking}"`);

		const directiveLines = [parts.join(' ')];
		if (metadata) {
			for (const [key, value] of Object.entries(metadata)) {
				directiveLines.push(`  ${key}: ${value}`);
			}
		}
		const directiveText = directiveLines.join('\n');

		await createBackupFile(plugin, normalizedPath, createBackup, 'saveOpenDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[saveOpenDirective] Saved open directive for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[saveOpenDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function saveCloseDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'account', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = `${date} close ${account}`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'saveCloseDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[saveCloseDirective] Saved close directive for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[saveCloseDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateOperatingCurrency(
	plugin: BeancountPlugin,
	currency: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const { getMainLedgerPath } = await import('../structuredLayout');
		const ledgerPath = getMainLedgerPath(plugin);
		if (!ledgerPath) return { success: false, error: 'Main ledger path not set' };

		const normalizedPath = convertWslPathToWindows(ledgerPath);
		await createBackupFile(plugin, normalizedPath, createBackup, 'updateOperatingCurrency');

		const content = await readFileContent(plugin, normalizedPath);
		const pattern = /^(option\s+"operating_currency"\s+)"[^"]*"/m;

		if (!pattern.test(content)) {
			return { success: false, error: 'Could not find option "operating_currency" in ledger file' };
		}

		const updated = content.replace(pattern, `$1"${currency}"`);
		await atomicFileWrite(plugin, normalizedPath, updated);

		Logger.log(`[updateOperatingCurrency] Updated operating_currency to ${currency}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateOperatingCurrency] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
