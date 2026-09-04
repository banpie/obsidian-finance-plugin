// src/utils/directives/queryDirectives.ts

import type BeancountPlugin from '../../main';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

export function parseQueryDirectives(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	const pattern = /^\d{4}-\d{2}-\d{2}\s+query\s+"([^"]+)"\s+"((?:[^"\\]|\\.)*)"/gm;
	let match;
	while ((match = pattern.exec(content)) !== null) {
		const [, name, sql] = match;
		result[name] = sql;
	}
	return result;
}

export async function createQueryDirective(
	plugin: BeancountPlugin,
	date: string,
	name: string,
	sql: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'query');
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const escapedSql = sql.replace(/"/g, '\\"');
		const directiveText = `${date} query "${name}" "${escapedSql}"`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'createQueryDirective');

		let content: string;
		try {
			content = await readFileContent(plugin, normalizedPath);
		} catch {
			content = `;; Named Queries\n;; Managed by Beancount for Obsidian\n\n`;
		}

		const newContent = content.endsWith('\n')
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;

		await atomicFileWrite(plugin, normalizedPath, newContent);
		Logger.log(`[createQueryDirective] Saved query directive "${name}"`);
		return { success: true };
	} catch (error) {
		Logger.error('[createQueryDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteQueryDirective(
	plugin: BeancountPlugin,
	name: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'query');
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'deleteQueryDirective');

		const content = await readFileContent(plugin, normalizedPath);
		const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const linePattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+query\\s+"${escapedName}"[^\n]*\n?`, 'gm');
		const newContent = content.replace(linePattern, '');

		await atomicFileWrite(plugin, normalizedPath, newContent);
		Logger.log(`[deleteQueryDirective] Deleted query directive "${name}"`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteQueryDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function getQueryDirectives(
	plugin: BeancountPlugin
): Promise<Record<string, string>> {
	try {
		const filePath = getTargetFile(plugin, 'query');
		if (!filePath) return {};

		const normalizedPath = convertWslPathToWindows(filePath);
		const content = await readFileContent(plugin, normalizedPath);
		return parseQueryDirectives(content);
	} catch {
		return {};
	}
}
