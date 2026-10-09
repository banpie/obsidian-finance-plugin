import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile, preprocess } from 'svelte/compiler';
import { createRequire } from 'node:module';
// Resolve the package's actual CJS export instead of Vite's synthetic named exports.
const { sveltePreprocess } = createRequire(import.meta.url)('svelte-preprocess') as typeof import('svelte-preprocess');

function componentFiles(folder: string): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const name = path.join(folder, entry.name);
        return entry.isDirectory() ? componentFiles(name) : name.endsWith('.svelte') ? [name] : [];
    });
}

describe('localized Svelte components', () => {
    it('compiles every real component without undefined translation functions or translated option values', async () => {
        for (const filename of componentFiles(path.resolve('src/ui'))) {
            const source = readFileSync(filename, 'utf8');
            // Localizing option values would break filtering and stored directive enums.
            expect(source, filename).not.toMatch(/value\s*[:=]\s*\{?\$tr\(/);
            const result = await preprocess(source, sveltePreprocess(), { filename });
            const compiled = compile(result.code, { filename, generate: 'dom' });
            expect(compiled.warnings.filter(w => w.code === 'missing-declaration'), filename).toEqual([]);
        }
    }, 60000);
});
