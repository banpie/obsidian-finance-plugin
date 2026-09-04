// src/utils/directives/commodityDirectives.ts

import type BeancountPlugin from '../../main';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

export async function createCommodity(
	plugin: BeancountPlugin,
	symbol: string,
	date: string,
	priceMetadata?: string,
	logoUrl?: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'commodity', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		if (!symbol || !/^[A-Z0-9._-]+$/i.test(symbol))
			return { success: false, error: 'Invalid commodity symbol. Use alphanumeric characters, dots, underscores, or hyphens.' };

		const normalizedPath = convertWslPathToWindows(filePath);
		let directiveText = `${date} commodity ${symbol.toUpperCase()}`;
		const metadataLines: string[] = [];
		if (priceMetadata) metadataLines.push(`  price: "${priceMetadata}"`);
		if (logoUrl) metadataLines.push(`  logo: "${logoUrl}"`);

		await createBackupFile(plugin, normalizedPath, createBackup, 'createCommodity');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		if (metadataLines.length > 0) directiveText += newline + metadataLines.join(newline);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createCommodity] Created commodity ${symbol}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createCommodity] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function saveCommodityMetadata(
	plugin: BeancountPlugin,
	symbol: string,
	metadata: Record<string, unknown>,
	filename: string,
	lineno: number,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'saveCommodityMetadata');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const commodityLine = lines[lineIndex];

		if (!commodityLine.includes('commodity') || !commodityLine.includes(symbol))
			return { success: false, error: `Line ${lineno} does not appear to be a commodity directive for ${symbol}` };

		// Remove existing metadata lines (indented lines immediately after commodity line)
		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		// Build new metadata lines
		const newMetadataLines = Object.entries(metadata)
			.filter(([key]) => key !== 'filename' && key !== 'lineno')
			.map(([key, value]) => `  ${key}: "${String(value)}"`);

		lines.splice(lineIndex + 1, endIndex - lineIndex - 1, ...newMetadataLines);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[saveCommodityMetadata] Saved metadata for ${symbol}`);
		return { success: true };
	} catch (error) {
		Logger.error('[saveCommodityMetadata] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteCommodityDirective(
	plugin: BeancountPlugin,
	symbol: string,
	filename: string,
	lineno: number,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'deleteCommodityDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const commodityLine = lines[lineIndex];

		if (!commodityLine.includes('commodity') || !commodityLine.includes(symbol))
			return { success: false, error: `Line ${lineno} does not appear to be a commodity directive for ${symbol}` };

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

		Logger.log(`[deleteCommodityDirective] Deleted commodity directive for ${symbol}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteCommodityDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function createPriceDirective(
	plugin: BeancountPlugin,
	date: string,
	commodity: string,
	amount: number,
	currency: string,
	createBackup = true
): Promise<{ success: boolean; filePath?: string; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'price', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Invalid date format.' };
		if (!commodity || !/^[A-Z0-9._-]+$/i.test(commodity)) return { success: false, error: 'Invalid commodity symbol.' };
		if (!amount || isNaN(amount)) return { success: false, error: 'Invalid amount.' };
		if (!currency || !/^[A-Z]{3,}$/i.test(currency)) return { success: false, error: 'Invalid currency code.' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = `${date} price ${commodity.toUpperCase()} ${amount.toFixed(2)} ${currency.toUpperCase()}`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'createPriceDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createPriceDirective] Created price directive for ${commodity}`);
		return { success: true, filePath: normalizedPath };
	} catch (error) {
		Logger.error('[createPriceDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function validateCommodityLocation(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	symbol: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		const _rawContent = await readFileContent(plugin, normalizedPath);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const line = lines[lineno - 1];
		if (!line.toLowerCase().includes('commodity') || !line.includes(symbol))
			return { success: false, error: `Line ${lineno} is not a commodity directive for ${symbol}` };

		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
