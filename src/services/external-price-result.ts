import type { PriceFetchResult } from '../types';

interface ExternalPipelinePayload {
	status?: string;
	positions?: number;
	updated_positions?: number;
	changed_price_records?: number;
	skipped_count?: number;
	failed_count?: number;
	latest_price_date?: string;
	restored?: boolean;
	error?: string;
}

function numeric(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseExternalPriceResult(stdout: string): PriceFetchResult {
	const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
	const jsonLine = [...lines].reverse().find(line => line.startsWith('{') && line.endsWith('}'));
	if (!jsonLine) {
		throw new Error('External price pipeline did not emit a JSON result.');
	}

	let payload: ExternalPipelinePayload;
	try {
		payload = JSON.parse(jsonLine) as ExternalPipelinePayload;
	} catch {
		throw new Error('External price pipeline emitted invalid JSON.');
	}

	const positions = numeric(payload.positions);
	const updatedPositions = numeric(payload.updated_positions);
	const savedCount = numeric(payload.changed_price_records);
	const skippedCount = numeric(payload.skipped_count);
	const failedCount = numeric(payload.failed_count);
	const latestPriceDate = typeof payload.latest_price_date === 'string' ? payload.latest_price_date : '';
	const pipelineFailed = payload.status !== 'success';
	const error = typeof payload.error === 'string' && payload.error.trim()
		? payload.error.trim()
		: 'External price pipeline failed.';
	const summaryParts = [
		`${updatedPositions}/${positions} positions refreshed`,
		`${savedCount} price records written`,
	];
	if (skippedCount > 0) summaryParts.push(`${skippedCount} skipped`);
	if (failedCount > 0) summaryParts.push(`${failedCount} need review`);
	if (latestPriceDate) summaryParts.push(`latest ${latestPriceDate}`);
	if (payload.restored) summaryParts.push('price file restored');

	return {
		successful: [],
		failed: pipelineFailed ? [{ commodity: '*', source: 'external', error }] : [],
		fetchedCount: updatedPositions,
		savedCount,
		backend: 'external',
		summary: summaryParts.join(' · '),
		positions,
		updatedPositions,
		skippedCount,
		failedCount,
		latestPriceDate,
		restored: Boolean(payload.restored),
	};
}
