import type { ChartConfiguration } from 'chart.js';
import { translate, type Locale } from './index';

/** Localize chart presentation without mutating values, callbacks or drill-down keys. */
export function localizeChartConfig(config: ChartConfiguration, language: Locale): ChartConfiguration {
    const label = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        const match = /^(.*?) (\([A-Z][A-Z0-9._-]*\))$/.exec(value);
        if (match) return `${String(label(match[1]))} ${match[2]}`;
        const trend = /^(.*?) Trend$/.exec(value);
        if (trend) return translate(language, '{0} Trend', [translate(language, trend[1])]);
        return translate(language, value);
    };
    const options = config.options || {};
    const plugins = options.plugins || {};
    const title = plugins.title;
    return {
        ...config,
        data: {
            ...config.data,
            labels: config.data.labels?.map(label),
            datasets: config.data.datasets.map(dataset => ({ ...dataset, label: label(dataset.label) as string | undefined })),
        },
        options: {
            ...options,
            scales: Object.fromEntries(Object.entries(options.scales || {}).map(([key, scale]) => [
                key,
                scale && { ...scale, ...('title' in scale && scale.title && { title: { ...scale.title, text: label(scale.title.text) as string } }) },
            ])),
            plugins: {
                ...plugins,
                ...(title && { title: { ...title, text: Array.isArray(title.text) ? title.text.map(text => label(text) as string) : label(title.text) as string } }),
            },
        },
    };
}
