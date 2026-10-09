import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { ChartConfiguration } from 'chart.js';
import { normalizeLanguage, resolveLocale, setLanguage, translate, tr } from '../src/i18n';
import { en } from '../src/i18n/en';
import { zhCN } from '../src/i18n/zh-CN';
import { localizeChartConfig } from '../src/i18n/chart';
import { DEFAULT_SETTINGS } from '../src/settings';

afterEach(() => setLanguage('en'));

describe('interface language', () => {
    it('follows Obsidian and respects an explicit language, including migrated settings', () => {
        expect(DEFAULT_SETTINGS.language).toBe('auto');
        expect(normalizeLanguage(undefined)).toBe('auto');
        expect(normalizeLanguage('invalid')).toBe('auto');
        expect(resolveLocale('auto', 'zh')).toBe('zh-CN');
        expect(resolveLocale('auto', 'zh-TW')).toBe('zh-CN');
        expect(resolveLocale('auto', 'fr')).toBe('en');
        expect(resolveLocale('en', 'zh')).toBe('en');
        expect(resolveLocale('zh-CN', 'en')).toBe('zh-CN');
    });

    it('updates Svelte subscribers immediately in both directions', () => {
        const seen: string[] = [];
        const unsubscribe = tr.subscribe(t => seen.push(t('Overview')));
        setLanguage('zh-CN');
        expect(get(tr)('Reports')).toBe('报表');
        setLanguage('en');
        unsubscribe();
        expect(seen.slice(-2)).toEqual(['总览', 'Overview']);
    });

    it('falls back for unknown messages and preserves interpolated ledger data', () => {
        const account = 'Assets:Investments:中文基金';
        expect(translate('zh-CN', 'Account {0} opened successfully', [account])).toBe(`已开设账户 ${account}`);
        expect(translate('zh-CN', 'Unrecognized source message')).toBe('Unrecognized source message');
        expect(translate('en', '账套')).toBe('Ledger profile');
        expect(translate('zh-CN', 'Amount ({0})', ['CNY'])).toBe('金额（CNY）');
        expect(translate('zh-CN', 'Amount ({0})')).toBe('金额（{0}）');
    });

    it('has matching message IDs and interpolation placeholders in both catalogs', () => {
        expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
        for (const key of Object.keys(en)) {
            const placeholders = (value: string) => [...new Set(value.match(/\{\d+\}/g) || [])].sort();
            expect(placeholders(zhCN[key]), key).toEqual(placeholders(en[key]));
            expect(zhCN[key].trim(), key).not.toBe('');
        }
    });

    it('translates chart labels without changing numeric data or drill-down callbacks', () => {
        const onClick = () => {};
        const source: ChartConfiguration = {
            type: 'doughnut',
            data: { labels: ['Investments', 'Loan Receivables', '自定义分类'], datasets: [{ label: 'Assets (CNY)', data: [200, 30, 10] }] },
            options: { onClick, plugins: { title: { text: 'Assets (CNY)' } } },
        };
        const zh = localizeChartConfig(source, 'zh-CN');
        expect(zh.data.labels).toEqual(['投资', '借出款项', '自定义分类']);
        expect(zh.data.datasets[0].data).toEqual([200, 30, 10]);
        expect(zh.options?.onClick).toBe(onClick);
        expect(zh.options?.plugins?.title?.text).toBe('资产 (CNY)');
        expect(source.data.labels?.[0]).toBe('Investments');
        expect(localizeChartConfig(source, 'en').data.labels?.[0]).toBe('Investments');
    });
});
