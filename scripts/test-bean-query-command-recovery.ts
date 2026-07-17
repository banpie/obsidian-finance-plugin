import {
	resolveBeanQueryCommand,
	type BeanQueryCommandDetector,
} from '../src/utils/beanQueryCommandRecovery';

interface DetectorOptions {
	configuredWorks?: boolean;
	detectedCommand?: string | null;
}

function createDetector(options: DetectorOptions): {
	detector: BeanQueryCommandDetector;
	getDetectionCalls: () => number;
} {
	let detectionCalls = 0;
	return {
		detector: {
			async testCommand() {
				return { success: options.configuredWorks ?? false };
			},
			async detectBeanQueryCommand() {
				detectionCalls += 1;
				return {
					command: options.detectedCommand ?? null,
					isValid: Boolean(options.detectedCommand),
				};
			},
		},
		getDetectionCalls: () => detectionCalls,
	};
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function main() {
	{
		const mock = createDetector({ configuredWorks: true });
		const result = await resolveBeanQueryCommand(mock.detector, '/saved/bean-query');
		assert(result.status === 'ready', 'A valid saved command should remain ready');
		assert(result.command === '/saved/bean-query', 'The saved command should be preserved');
		assert(!result.shouldPersist, 'A valid saved command should not be rewritten');
		assert(mock.getDetectionCalls() === 0, 'Auto-detection should not run for a valid command');
	}

	{
		const mock = createDetector({ configuredWorks: false });
		const result = await resolveBeanQueryCommand(mock.detector, '/other-device/bean-query');
		assert(result.status === 'unavailable', 'A failed detection should report unavailable');
		assert(result.command === '/other-device/bean-query', 'A failed detection must preserve the shared setting');
		assert(!result.shouldPersist, 'A failed detection must not clear or rewrite the setting');
	}

	{
		const mock = createDetector({ detectedCommand: '/Users/banpie/.local/bin/bean-query' });
		const result = await resolveBeanQueryCommand(mock.detector, '');
		assert(result.status === 'recovered', 'An empty setting should auto-recover');
		assert(result.command === '/Users/banpie/.local/bin/bean-query', 'The detected command should be returned');
		assert(result.shouldPersist, 'A recovered empty setting should be persisted');
	}

	{
		const mock = createDetector({
			configuredWorks: false,
			detectedCommand: '/Users/banpie/.local/bin/bean-query',
		});
		const result = await resolveBeanQueryCommand(mock.detector, '/missing/bean-query');
		assert(result.status === 'recovered', 'An invalid setting should recover to a detected command');
		assert(result.shouldPersist, 'A newly detected replacement should be persisted');
	}

	{
		const mock = createDetector({});
		const result = await resolveBeanQueryCommand(mock.detector, '');
		assert(result.status === 'missing', 'An empty setting without detection should remain missing');
		assert(result.command === null, 'A missing command should remain null');
		assert(!result.shouldPersist, 'A missing command should not write settings');
	}

	console.log('bean-query command recovery tests passed');
}

void main();
