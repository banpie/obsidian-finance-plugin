import { t } from "../../i18n";
import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import CommodityCreateModalComponent from './CommodityCreateModal.svelte';
import type { CommoditiesController } from '../../controllers/CommoditiesController';
import { Logger } from '../../utils/logger';
import { SvelteComponent } from 'svelte';

export class CommodityCreateModal extends Modal {
    plugin: BeancountPlugin;
    private component: SvelteComponent | null = null;
    private controller: CommoditiesController;
    private onSuccess?: () => void;

    constructor(
        app: App, 
        plugin: BeancountPlugin, 
        controller: CommoditiesController,
        onSuccess?: () => void
    ) {
        super(app);
        this.plugin = plugin;
        this.controller = controller;
        this.onSuccess = onSuccess;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.setCssStyles({ maxWidth: '600px', width: '90vw' });

        Logger.log('[CommodityCreateModal] Opening modal');

        this.component = new (CommodityCreateModalComponent)({
            target: contentEl,
            props: {}
        });

        // Listen to save event
        this.component.$on('save', (e: CustomEvent<{ symbol: string; date: string; priceMetadata: string; logoUrl: string }>) => {
            void (async () => {
                const { symbol, date, priceMetadata, logoUrl } = e.detail;
                Logger.log('[CommodityCreateModal] save event', { symbol, date, priceMetadata, logoUrl });

                try {
                    const result = await this.controller.createCommodity(
                        symbol,
                        date,
                        priceMetadata,
                        logoUrl
                    );

                    if (result.success) {
                        new Notice(t("Successfully created commodity {0}", [symbol]));
                        this.close();
                        
                        // Call success callback if provided
                        if (this.onSuccess) {
                            this.onSuccess();
                        }
                    } else {
                        new Notice(t("Failed to create commodity: {0}", [result.error || 'Unknown error']));
                    }
                } catch (error) {
                    Logger.error('[CommodityCreateModal] Error creating commodity:', error);
                    new Notice(t("Error: {0}", [error instanceof Error ? error.message : 'Unknown error']));
                }
            })();
        });

        // Listen to cancel event
        this.component.$on('cancel', () => {
            Logger.log('[CommodityCreateModal] cancel event');
            this.close();
        });

        // Listen to test-price event
        this.component.$on('test-price', (e: CustomEvent<{ symbol: string; priceMetadata: string }>) => {
            void (async () => {
                const { symbol, priceMetadata } = e.detail;
                Logger.log('[CommodityCreateModal] test-price event', { symbol, priceMetadata });

                try {
                    const result = await this.controller.testPriceSource(symbol);
                    
                    if (result && result.success) {
                        new Notice(t("✅ Price source test successful"));
                    } else {
                        new Notice(t("❌ Price test failed: {0}", [result?.error || 'Unable to fetch price']));
                    }
                } catch (error) {
                    Logger.error('[CommodityCreateModal] test-price error:', error);
                    new Notice(t("❌ Price test failed: {0}", [error instanceof Error ? error.message : 'Unknown error']));
                }
            })();
        });

        // Listen to test-logo event
        this.component.$on('test-logo', (e: CustomEvent<{ symbol: string; url: string }>) => {
            void (async () => {
                const { symbol, url } = e.detail;
                Logger.log('[CommodityCreateModal] test-logo event', { symbol, url });

                try {
                    const result = await this.controller.testLogoUrl(symbol, url);
                    
                    if (result && result.success) {
                        new Notice(t("✅ Logo URL is valid"));
                    } else {
                        new Notice(t("❌ Logo test failed: {0}", [result?.error || 'Invalid URL']));
                    }
                } catch (error) {
                    Logger.error('[CommodityCreateModal] test-logo error:', error);
                    new Notice(t("❌ Logo test failed: {0}", [error instanceof Error ? error.message : 'Unknown error']));
                }
            })();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) {
            this.component.$destroy();
        }
    }
}
