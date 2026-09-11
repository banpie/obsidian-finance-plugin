import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const reportsTabSource = readFileSync(
	resolve(process.cwd(), 'src/ui/partials/dashboard/ReportsTab.svelte'),
	'utf8',
);

describe('ReportsTab empty states', () => {
	it('keeps inline empty states in normal layout flow', () => {
		const emptyStateRule = reportsTabSource.match(/\.empty-state\s*\{([\s\S]*?)\n\t\}/)?.[1];

		expect(emptyStateRule).toBeDefined();
		expect(emptyStateRule).toMatch(/position:\s*relative;/);
		expect(emptyStateRule).toMatch(/width:\s*auto;/);
		expect(emptyStateRule).toMatch(/height:\s*auto;/);
	});
});
