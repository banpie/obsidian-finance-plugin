import { describe, expect, it } from 'vitest';
import { createLedgerProfileId, createLegacyLedgerProfile, normalizeLedgerFolder } from '../src/utils/ledgerProfiles';

describe('ledger profiles', () => {
	it('normalizes only vault-relative ledger folders', () => {
		expect(normalizeLedgerFolder('./02_财务/财务OS/ledger/')).toBe('02_财务/财务OS/ledger');
		expect(normalizeLedgerFolder('/private/ledger')).toBeNull();
		expect(normalizeLedgerFolder('../ledger')).toBeNull();
	});

	it('migrates a configured ledger into the default profile', () => {
			expect(createLegacyLedgerProfile({
			structuredFolderName: 'Finances',
			operatingCurrency: 'USD',
			fileOrganization: 'yearly',
		})).toEqual({
			id: 'default',
			name: '默认账套',
			structuredFolderName: 'Finances',
			operatingCurrency: 'USD',
			fileOrganization: 'yearly',
			readOnly: false,
			reportingMode: 'personal',
		});
	});

	it('creates stable unique identifiers even for Chinese profile names', () => {
		expect(createLedgerProfileId('叹号科技外账', ['ledger'])).toBe('ledger-2');
	});
});
