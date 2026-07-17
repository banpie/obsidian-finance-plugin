export interface BeanQueryCommandDetector {
	testCommand(
		command: string,
		args?: string[],
		timeout?: number,
	): Promise<{ success: boolean }>;
	detectBeanQueryCommand(
		useWSL?: boolean,
		beancountFilePath?: string,
	): Promise<{ command: string | null; isValid: boolean }>;
}

export type BeanQueryCommandResolutionStatus =
	| 'ready'
	| 'recovered'
	| 'unavailable'
	| 'missing';

export interface BeanQueryCommandResolution {
	status: BeanQueryCommandResolutionStatus;
	command: string | null;
	shouldPersist: boolean;
}

/**
 * Resolve the bean-query command without destructively clearing a shared setting.
 * A transient failure on one synced device must not break other devices.
 */
export async function resolveBeanQueryCommand(
	detector: BeanQueryCommandDetector,
	configuredCommand: string,
	beancountFilePath?: string,
): Promise<BeanQueryCommandResolution> {
	const savedCommand = configuredCommand.trim();

	if (savedCommand) {
		const versionResult = await detector.testCommand(
			savedCommand,
			['--version'],
			5000,
		);
		if (versionResult.success) {
			return {
				status: 'ready',
				command: savedCommand,
				shouldPersist: false,
			};
		}
	}

	const detected = await detector.detectBeanQueryCommand(
		false,
		beancountFilePath,
	);
	if (detected.isValid && detected.command) {
		return {
			status: 'recovered',
			command: detected.command,
			shouldPersist: detected.command !== savedCommand,
		};
	}

	if (savedCommand) {
		return {
			status: 'unavailable',
			command: savedCommand,
			shouldPersist: false,
		};
	}

	return {
		status: 'missing',
		command: null,
		shouldPersist: false,
	};
}
