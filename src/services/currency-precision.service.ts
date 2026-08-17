// src/services/currency-precision.service.ts

import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseCurrencyNumberCSV, buildPrecisionMap } from '../utils/currencyPrecision';
import { Logger } from '../utils/logger';

const DEFAULT_DECIMALS = 2;

/**
 * Infers each currency's typical decimal precision from the ledger — how many
 * decimals it's actually written with in postings and price directives — so
 * display formatting doesn't hardcode 2 decimals for every currency (which
 * truncates crypto/low-value commodities and pads zero-decimal currencies).
 * Mirrors Beancount's own DisplayContext "most common" precision inference.
 */
export class CurrencyPrecisionService {
    private plugin: BeancountPlugin;
    private precision: Map<string, number> = new Map();
    private loadPromise: Promise<void> | null = null;

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
    }

    /** Returns the inferred decimal precision for a currency, defaulting to 2 if unseen. */
    public getDecimals(currency: string | undefined | null): number {
        if (!currency) return DEFAULT_DECIMALS;
        return this.precision.get(currency) ?? DEFAULT_DECIMALS;
    }

    /** Loads the precision map if not already loaded/loading. Safe to call repeatedly. */
    public ensureLoaded(): Promise<void> {
        if (!this.loadPromise) {
            this.loadPromise = this.load();
        }
        return this.loadPromise;
    }

    /** Forces a fresh reload (e.g. after fetching new prices or editing the ledger). */
    public refresh(): Promise<void> {
        this.loadPromise = this.load();
        return this.loadPromise;
    }

    private async load(): Promise<void> {
        try {
            const [postingsCsv, pricesCsv] = await Promise.all([
                this.plugin.runQuery(queries.getPostingsCurrencyNumberQuery()),
                this.plugin.runQuery(queries.getPriceDirectivesCurrencyAmountQuery()),
            ]);

            const rows = [
                ...parseCurrencyNumberCSV(postingsCsv),
                ...parseCurrencyNumberCSV(pricesCsv),
            ];

            this.precision = buildPrecisionMap(rows);
            Logger.log(`[CurrencyPrecisionService] loaded precision for ${this.precision.size} currencies`);
        } catch (error) {
            // Keep whatever precision data we already had (or the empty default)
            // rather than throwing — this is a display-quality enhancement, not
            // something that should block the rest of the plugin from working.
            Logger.warn('[CurrencyPrecisionService] failed to load precision map:', error);
        }
    }
}
