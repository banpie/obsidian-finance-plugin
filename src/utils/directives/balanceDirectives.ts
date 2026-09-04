// src/utils/directives/balanceDirectives.ts

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../../main';
import type { BalanceData, FileLineRow } from './types';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { runQuery } from '../queryRunner';
import { Logger } from '../logger';

export async function createBalanceAssertion(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	amount: string,
	currency: string,
	tolerance?: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'balance', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		let directiveText = `${date} balance ${account}  ${amount} ${currency}`;
		if (tolerance) directiveText += ` ~ ${tolerance}`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'createBalanceAssertion');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createBalanceAssertion] Saved balance for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createBalanceAssertion] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateBalance(
	plugin: BeancountPlugin,
	balanceId: string,
	balanceData: BalanceData
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const parts = balanceId.split('_');
		if (parts.length < 3 || parts[0] !== 'balance')
			return { success: false, error: `Invalid balance ID format: ${balanceId}` };

		const date = parts[1];
		const account = parts.slice(2).join(':');

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='balance' AND date=${date} AND '${account}' IN accounts`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0)
			return { success: false, error: `Balance assertion not found for ${account} on ${date}` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[updateBalance] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'updateBalance');
		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		let newBalanceText = `${balanceData.date} balance ${balanceData.account}  ${balanceData.amount} ${balanceData.currency}`;
		if (balanceData.tolerance) newBalanceText += ` ~ ${balanceData.tolerance}`;

		lines[lineno - 1] = newBalanceText;
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));
		Logger.log(`[updateBalance] Updated ${balanceId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateBalance] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteBalance(
	plugin: BeancountPlugin,
	balanceId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const parts = balanceId.split('_');
		if (parts.length < 3 || parts[0] !== 'balance')
			return { success: false, error: `Invalid balance ID format: ${balanceId}` };

		const date = parts[1];
		const account = parts.slice(2).join(':');

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='balance' AND date=${date} AND '${account}' IN accounts`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0)
			return { success: false, error: `Balance assertion not found for ${account} on ${date}` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[deleteBalance] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'deleteBalance');
		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		lines.splice(lineno - 1, 1);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));
		Logger.log(`[deleteBalance] Deleted ${balanceId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteBalance] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
