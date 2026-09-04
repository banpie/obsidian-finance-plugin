import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		alias: {
			obsidian: path.resolve(__dirname, 'tests/mocks/obsidian.ts'),
		},
	},
	plugins: [
		{
			name: 'svelte-mock-plugin',
			load(id) {
				if (id.endsWith('.svelte')) {
					return `
						export default class SvelteComponent {
							$on() {}
							$set() {}
							$destroy() {}
						}
					`;
				}
				return null;
			},
		},
	],
});
