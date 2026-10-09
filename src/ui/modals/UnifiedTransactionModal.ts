import { t } from "../../i18n";
// src/ui/modals/UnifiedTransactionModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import type { JournalTransaction, JournalEntry } from '../../models/journal';
// Import the component statically to avoid dynamic import delay
import TransactionEditModal from './TransactionEditModal.svelte';
import { Logger } from '../../utils/logger';
import { getOpenAccounts, getPayees, getTags, getCommodities, createTransaction, updateTransaction, deleteTransaction, createBalanceAssertion, saveOpenDirective, saveCloseDirective, createNote, updateBalance, deleteBalance, updateNote, deleteNote, createQueryDirective, type BalanceData, type NoteData } from '../../utils';
import { SvelteComponent } from 'svelte';

export interface EntryDataPayload {
    type: string;
    date: string;
    account?: string;
    amount?: string | number;
    currency?: string;
    tolerance?: number;
    currencies?: string[];
    booking?: string;
    comment?: string;
    tags?: string[];
    links?: string[];
    name?: string;
    sql?: string;
}

export class UnifiedTransactionModal extends Modal {
    plugin: BeancountPlugin;
    private component: SvelteComponent | null = null;
    private transaction: JournalTransaction | null;
    private entry: JournalEntry | null;
    private mode: 'add' | 'edit';
    private onRefreshCallback?: () => Promise<void>; // Add refresh callback
    private prefill?: { tab: 'balance'; account: string };

    constructor(
        app: App,
        plugin: BeancountPlugin,
        entryOrTransaction: JournalEntry | JournalTransaction | null = null,
        onRefresh?: () => Promise<void>, // Add optional refresh callback
        prefill?: { tab: 'balance'; account: string } // Preselect a tab + account in add mode (e.g. "Balance" quick-action)
    ) {
        super(app);
        this.plugin = plugin;
        this.onRefreshCallback = onRefresh;
        this.prefill = prefill;
        
        // Handle both transaction (legacy) and entry (new) parameters
        if (entryOrTransaction?.type === 'transaction') {
            this.transaction = entryOrTransaction;
            this.entry = entryOrTransaction;
        } else if (entryOrTransaction) {
            this.transaction = null;
            this.entry = entryOrTransaction;
        } else {
            this.transaction = null;
            this.entry = null;
        }
        
        this.mode = entryOrTransaction ? 'edit' : 'add';
    }

    async onOpen() {
        Logger.log('Opening UnifiedTransactionModal', { mode: this.mode });
        const { contentEl } = this;
        contentEl.empty();
        
        // Set modal container to be wider
        this.modalEl.setCssStyles({ maxWidth: '1200px', width: '95vw' });

        // Set initial title (fallback, component will update it)
        this.setTitle(this.mode === 'edit' ? 'Edit Transaction' : 'Add Transaction');

        // Initialize with empty data
        const accounts: string[] = [];
        const payees: string[] = [];
        const tags: string[] = [];
        const currencies: string[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']; // Default fallback

        // Create component immediately with static import
        this.component = new (TransactionEditModal)({
            target: contentEl,
            props: {
                transaction: this.transaction,
                entry: this.entry,
                accounts,
                payees,
                tags,
                currencies, // Add currencies for autocomplete
                mode: this.mode,
                operatingCurrency: this.plugin.settings.operatingCurrency,
                plugin: this.plugin,
                initialTab: this.prefill?.tab ?? null,
                initialAccount: this.prefill?.account ?? null
            }
        });

        // Handle events
        this.component.$on('add', (e: CustomEvent<unknown>) => { void this.onAdd(e.detail as EntryDataPayload); });
        this.component.$on('save', (e: CustomEvent<unknown>) => { void this.onSave(e.detail as EntryDataPayload); });
        this.component.$on('delete', (e: CustomEvent<string>) => { void this.onDelete(e.detail); });
        this.component.$on('cancel', () => this.close());
        this.component.$on('titleChange', (e: CustomEvent<string>) => this.setTitle(e.detail)); // Listen for title changes

        // Fetch data in background
        void this.fetchData();
    }

    async fetchData() {
        try {
            // Use direct BQL queries instead of backend API
            // Run all requests in parallel for better performance
            const [accountsResult, payeesResult, tagsResult, commoditiesResult] = await Promise.allSettled([
                getOpenAccounts(this.plugin),
                getPayees(this.plugin),
                getTags(this.plugin),
                getCommodities(this.plugin)
            ]);

            const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : [];
            const payees = payeesResult.status === 'fulfilled' ? payeesResult.value : [];
            const tags = tagsResult.status === 'fulfilled' ? tagsResult.value : [];
            const fetchedCurrencies = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value.map(c => c.name) : [];

            const currencies = fetchedCurrencies.length > 0 ? fetchedCurrencies : ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];

            // Update component props
            if (this.component) {
                this.component.$set({
                    accounts,
                    payees,
                    tags,
                    currencies
                });
            }
        } catch (error) {
            console.error('Error loading form data:', error);
        }
    }

    async onAdd(entryData: EntryDataPayload) {
        try {
            Logger.log('Adding entry', entryData);
            
            // Handle different entry types
            if (entryData.type === 'transaction') {
                // Use direct file writing for transactions
                const result = await createTransaction(this.plugin, entryData);
                
                if (result.success) {
                    new Notice(t("Transaction added successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided (legacy)
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to add transaction: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'balance') {
                // Use direct file writing for balance assertions
                const result = await createBalanceAssertion(
                    this.plugin,
                    entryData.date,
                    entryData.account!,
                    String(entryData.amount),
                    entryData.currency!,
                    entryData.tolerance !== undefined ? String(entryData.tolerance) : undefined,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice(t("Balance assertion added successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to add balance: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'open') {
                // Use direct file writing for open directives
                const result = await saveOpenDirective(
                    this.plugin,
                    entryData.date,
                    entryData.account!,
                    entryData.currencies || [],
                    entryData.booking,
                    undefined,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice(t("Open directive added successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to add open directive: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'close') {
                // Use direct file writing for close directives
                const result = await saveCloseDirective(
                    this.plugin,
                    entryData.date,
                    entryData.account!,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice(t("Close directive added successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to add close directive: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'note') {
                // Use direct file writing for notes
                const result = await createNote(
                    this.plugin,
                    entryData.date,
                    entryData.account!,
                    entryData.comment!,
                    entryData.tags || [],
                    entryData.links || [],
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice(t("Note added successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to add note: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'query') {
                const result = await createQueryDirective(
                    this.plugin,
                    entryData.date,
                    entryData.name!,
                    entryData.sql!,
                    this.plugin.settings.createBackups ?? true
                );

                if (result.success) {
                    new Notice(t("Query \"{0}\" saved successfully! Use `bql-q:{1}` in your notes.", [entryData.name, entryData.name]));
                    // Invalidate inline processor cache so new query is immediately available
                    this.plugin.inlineBqlProcessor.invalidateQueryCache();
                    this.close();
                } else {
                    new Notice(t("Failed to save query: {0}", [result.error || 'Unknown error']));
                }
            } else {
                // Pad entries have no UI - this code path is unreachable
                new Notice(t("Creating {0} entries is not supported through the UI.", [entryData.type]));
                Logger.warn(`Attempted to create ${entryData.type} entry without UI support`);
            }
        } catch (error) {
            Logger.error('Error adding entry:', error);
            new Notice(t("Failed to add {0}. Check console for details.", [entryData.type]));
        }
    }

    async onSave(entryData: EntryDataPayload) {
        if (!this.transaction && !this.entry) return;
        
        try {
            const entryId = this.transaction?.id || this.entry?.id;
            Logger.log('Updating entry', { id: entryId, data: entryData });
            
            // Handle different entry types
            if (entryData.type === 'transaction') {
                // Use direct file writing for transactions
                const result = await updateTransaction(this.plugin, entryId!, entryData);
                
                if (result.success) {
                    new Notice(t("Transaction updated successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to update transaction: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'balance') {
                // Use direct file writing for balance updates
                const result = await updateBalance(this.plugin, entryId!, entryData as unknown as BalanceData);
                
                if (result.success) {
                    new Notice(t("Balance updated successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to update balance: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryData.type === 'note') {
                // Use direct file writing for note updates
                const result = await updateNote(this.plugin, entryId!, entryData as unknown as NoteData);
                
                if (result.success) {
                    new Notice(t("Note updated successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to update note: {0}", [result.error || 'Unknown error']));
                }
            } else {
                // Open/Close entries have no edit UI - this code path is unreachable
                new Notice(t("Updating {0} entries is not supported through the UI.", [entryData.type]));
                Logger.warn(`Attempted to update ${entryData.type} entry without UI support`);
            }
        } catch (error) {
            Logger.error('Error updating entry:', error);
            new Notice(t("Failed to update {0}. Check console for details.", [entryData.type]));
        }
    }

    async onDelete(entryId: string) {
        try {
            Logger.log('Deleting entry', entryId);
            
            // Determine entry type
            const entryType = this.transaction?.type || this.entry?.type || 'transaction';
            
            if (entryType === 'transaction') {
                // Use direct file writing for transactions
                const result = await deleteTransaction(this.plugin, entryId);
                
                if (result.success) {
                    new Notice(t("Transaction deleted successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to delete transaction: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryType === 'balance') {
                // Use direct file deletion for balance
                const result = await deleteBalance(this.plugin, entryId);
                if (result.success) {
                    new Notice(t("Balance deleted successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to delete balance: {0}", [result.error || 'Unknown error']));
                }
            } else if (entryType === 'note') {
                // Use direct file deletion for note
                const result = await deleteNote(this.plugin, entryId);
                if (result.success) {
                    new Notice(t("Note deleted successfully!"));
                    
                    // Refresh the store
                    await this.plugin.journalStore.refresh();

                    // Call refresh callback if provided
                    if (this.onRefreshCallback) {
                        try {
                            await this.onRefreshCallback();
                        } catch (error) {
                            console.error('Error refreshing dashboard:', error);
                        }
                    }
                    
                    this.close();
                } else {
                    new Notice(t("Failed to delete note: {0}", [result.error || 'Unknown error']));
                }
            } else {
                // Open/Close entries have no delete UI - this code path is unreachable
                const entryType = entryId.split('_')[0];
                new Notice(t("Deleting {0} entries is not supported through the UI.", [entryType]));
                Logger.warn(`Attempted to delete ${entryType} entry without UI support`);
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            new Notice(t("Failed to delete entry. Check console for details."));
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) {
            this.component.$destroy();
        }
    }
}
