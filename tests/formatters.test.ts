import { describe, it, expect } from 'vitest';
import { parsePeriodLabel } from '../src/utils/formatters';

describe('parsePeriodLabel', () => {
    it('parses monthly ISO format labels correctly', () => {
        const result = parsePeriodLabel('2025-10', 'month');
        expect(result).toEqual({
            startDate: '2025-10-01',
            endDate: '2025-10-31'
        });
    });

    it('parses monthly formatted text labels correctly', () => {
        const result = parsePeriodLabel('OCT 2025', 'month');
        expect(result).toEqual({
            startDate: '2025-10-01',
            endDate: '2025-10-31'
        });
    });

    it('parses February in leap years correctly', () => {
        const result = parsePeriodLabel('2024-02', 'month');
        expect(result).toEqual({
            startDate: '2024-02-01',
            endDate: '2024-02-29'
        });
    });

    it('parses weekly ISO format labels correctly', () => {
        const result = parsePeriodLabel('2025-10-12', 'week');
        expect(result).toEqual({
            startDate: '2025-10-06',
            endDate: '2025-10-12'
        });
    });

    it('parses yearly labels correctly', () => {
        const result = parsePeriodLabel('2025', 'month');
        expect(result).toEqual({
            startDate: '2025-01-01',
            endDate: '2025-12-31'
        });
    });

    it('handles empty or invalid inputs gracefully', () => {
        expect(parsePeriodLabel('', 'month')).toEqual({ startDate: '', endDate: '' });
        expect(parsePeriodLabel('invalid', 'month')).toEqual({ startDate: '', endDate: '' });
    });
});
