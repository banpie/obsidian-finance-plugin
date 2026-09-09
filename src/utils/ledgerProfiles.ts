import type { FileOrganization, LedgerProfile } from '../settings';

export type LedgerProfileDraft = Omit<LedgerProfile, 'id'>;

export function normalizeLedgerFolder(folder: string): string | null {
	const normalized = folder.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
	if (!normalized || normalized.startsWith('/') || normalized.split('/').some(part => part === '..')) {
		return null;
	}
	return normalized;
}

export function createLedgerProfileId(name: string, existingIds: Iterable<string>): string {
	const existing = new Set(existingIds);
	const stem = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'ledger';
	let candidate = stem;
	let suffix = 2;
	while (existing.has(candidate)) candidate = `${stem}-${suffix++}`;
	return candidate;
}

export function createLegacyLedgerProfile(settings: {
	structuredFolderName: string;
	operatingCurrency: string;
	fileOrganization: FileOrganization;
}): LedgerProfile {
	return {
		id: 'default',
		name: '默认账套',
		structuredFolderName: settings.structuredFolderName,
		operatingCurrency: settings.operatingCurrency,
		fileOrganization: settings.fileOrganization,
		readOnly: false,
		reportingMode: 'personal',
	};
}
