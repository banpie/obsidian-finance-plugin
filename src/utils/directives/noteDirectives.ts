// src/utils/directives/noteDirectives.ts

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../../main';
import type { NoteData, FileLineRow } from './types';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { runQuery } from '../queryRunner';
import { Logger } from '../logger';

export async function createNote(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	comment: string,
	tags?: string[],
	links?: string[],
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'note', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const parts = [date, 'note', account, `"${comment}"`];
		if (tags) for (const t of tags) { const c = t.replace(/^#/, ''); if (c) parts.push(`#${c}`); }
		if (links) for (const l of links) parts.push(`^${l}`);
		const directiveText = parts.join(' ');

		await createBackupFile(plugin, normalizedPath, createBackup, 'createNote');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createNote] Saved note for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateNote(
	plugin: BeancountPlugin,
	noteId: string,
	noteData: NoteData
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const parts = noteId.split('_');
		if (parts.length < 3 || parts[0] !== 'note')
			return { success: false, error: `Invalid note ID format: ${noteId}` };

		const date = parts[1];
		const account = parts.slice(2).join(':');

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='note' AND date=${date} AND '${account}' IN accounts`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0)
			return { success: false, error: `Note not found for ${account} on ${date}` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[updateNote] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'updateNote');
		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const noteParts = [noteData.date, 'note', noteData.account, `"${noteData.comment}"`];
		if (noteData.tags) for (const t of noteData.tags) { const c = t.replace(/^#/, ''); if (c) noteParts.push(`#${c}`); }
		if (noteData.links) for (const l of noteData.links) noteParts.push(`^${l}`);

		lines[lineno - 1] = noteParts.join(' ');
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));
		Logger.log(`[updateNote] Updated ${noteId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteNote(
	plugin: BeancountPlugin,
	noteId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const parts = noteId.split('_');
		if (parts.length < 3 || parts[0] !== 'note')
			return { success: false, error: `Invalid note ID format: ${noteId}` };

		const date = parts[1];
		const account = parts.slice(2).join(':');

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='note' AND date=${date} AND '${account}' IN accounts`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0)
			return { success: false, error: `Note not found for ${account} on ${date}` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[deleteNote] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'deleteNote');
		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		lines.splice(lineno - 1, 1);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));
		Logger.log(`[deleteNote] Deleted ${noteId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
