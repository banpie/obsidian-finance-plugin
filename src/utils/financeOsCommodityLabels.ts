import type BeancountPlugin from '../main';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from './logger';

export interface FinanceOsCommodityLabel {
    displayCode?: string;
    displayName?: string;
    pricePoints?: number;
    firstPriceDate?: string;
}

const PRICE_HISTORY_PATH = '02_财务/财务OS/reports/price-history-daily.csv';
const PRICE_COMMODITIES_PATH = '02_财务/财务OS/reports/price-commodities.csv';
const COMMODITY_MAP_PATH = '02_财务/财务OS/ledger/commodity-map.csv';

function cleanCell(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function marketPrefix(market: string): string {
    if (market === '中国') return 'CN';
    if (market === '香港') return 'HK';
    if (market === '美国') return 'US';
    return market.toUpperCase();
}

async function readVaultFile(plugin: BeancountPlugin, path: string): Promise<string | null> {
    try {
        const exists = await plugin.app.vault.adapter.exists(path);
        if (!exists) return null;
        return await plugin.app.vault.adapter.read(path);
    } catch (error) {
        Logger.warn(`[FinanceOS labels] Failed to read ${path}:`, error);
        return null;
    }
}

function mergeLabel(
    labels: Map<string, FinanceOsCommodityLabel>,
    commodity: string,
    label: FinanceOsCommodityLabel
): void {
    if (!commodity) return;
    const current = labels.get(commodity) || {};
    labels.set(commodity, {
        displayCode: current.displayCode || label.displayCode,
        displayName: current.displayName || label.displayName,
        pricePoints: current.pricePoints ?? label.pricePoints,
        firstPriceDate: current.firstPriceDate || label.firstPriceDate,
    });
}

function parsePriceHistoryLabels(csv: string): Map<string, FinanceOsCommodityLabel> {
    const labels = new Map<string, FinanceOsCommodityLabel>();
    const rows = parseCsv(csv, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: true,
    }) as Record<string, string>[];

    for (const row of rows) {
        const commodity = cleanCell(row.commodity);
        mergeLabel(labels, commodity, {
            displayCode: cleanCell(row.asset_code) || undefined,
            displayName: cleanCell(row.display_name) || undefined,
            pricePoints: cleanCell(row.price_points) ? Number(cleanCell(row.price_points)) : undefined,
            firstPriceDate: cleanCell(row.first_price_date) || undefined,
        });
    }

    return labels;
}

function parseCommodityMapLabels(csv: string): Map<string, FinanceOsCommodityLabel> {
    const labels = new Map<string, FinanceOsCommodityLabel>();
    const rows = parseCsv(csv, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: true,
    }) as Record<string, string>[];

    for (const row of rows) {
        const commodity = cleanCell(row.commodity);
        const code = cleanCell(row.code);
        const market = cleanCell(row.market);
        const investment = cleanCell(row.investment);
        const displayCode = code && code !== '/'
            ? `${marketPrefix(market)}:${code}`
            : undefined;

        mergeLabel(labels, commodity, {
            displayCode,
            displayName: investment || undefined,
        });
    }

    return labels;
}

export async function loadFinanceOsCommodityLabels(plugin: BeancountPlugin): Promise<Map<string, FinanceOsCommodityLabel>> {
    const labels = new Map<string, FinanceOsCommodityLabel>();

    const priceCommoditiesCsv = await readVaultFile(plugin, PRICE_COMMODITIES_PATH);
    if (priceCommoditiesCsv) {
        try {
            for (const [commodity, label] of parsePriceHistoryLabels(priceCommoditiesCsv)) {
                mergeLabel(labels, commodity, label);
            }
        } catch (error) {
            Logger.warn('[FinanceOS labels] Failed to parse price-commodities.csv:', error);
        }
    }

    const priceHistoryCsv = await readVaultFile(plugin, PRICE_HISTORY_PATH);
    if (priceHistoryCsv) {
        try {
            for (const [commodity, label] of parsePriceHistoryLabels(priceHistoryCsv)) {
                mergeLabel(labels, commodity, label);
            }
        } catch (error) {
            Logger.warn('[FinanceOS labels] Failed to parse price-history-daily.csv:', error);
        }
    }

    const commodityMapCsv = await readVaultFile(plugin, COMMODITY_MAP_PATH);
    if (commodityMapCsv) {
        try {
            for (const [commodity, label] of parseCommodityMapLabels(commodityMapCsv)) {
                mergeLabel(labels, commodity, label);
            }
        } catch (error) {
            Logger.warn('[FinanceOS labels] Failed to parse commodity-map.csv:', error);
        }
    }

    return labels;
}
