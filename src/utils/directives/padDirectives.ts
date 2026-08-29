// src/utils/directives/padDirectives.ts

import type BeancountPlugin from '../../main';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';

/**
 * Inserts a `pad` directive at the given date. Pads/balances live in
 * separate, unsharded files (pads.beancount / balances.beancount, see
 * structuredLayout.ts) so an append here never lands in the wrong physical
 * file regardless of date.
 *
 * IMPORTANT: `date` must be strictly BEFORE the failing balance assertion's
 * date, not the same day — verified directly against bean-check/bean-query
 * that a same-date pad does not satisfy the following balance. Callers
 * (see ForceReconcileModal) are responsible for passing a date earlier than
 * the balance it's meant to fix; this function does no date arithmetic of
 * its own.
 *
 * This is the plugin's first code path that ever writes a `pad` directive —
 * every other entry point (UnifiedTransactionModal) explicitly refuses to
 * create one.
 */
export async function createPadDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	padAccount: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'pad', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = `${date} pad ${account} ${padAccount}`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'createPadDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createPadDirective] Inserted pad directive for ${account} <- ${padAccount}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createPadDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
