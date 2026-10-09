<script lang="ts">
	import { tr, type LanguagePreference } from "../../../i18n";
    import { onMount } from 'svelte';

    // Components
    import TabBar from '../../common/TabBar.svelte';
    import OverviewTab from '../../partials/dashboard/OverviewTab.svelte';
    import TransactionsTab from '../../partials/dashboard/TransactionsTab.svelte';
    import BalanceSheetTab from '../../partials/dashboard/BalanceSheetTab.svelte';
    import CommoditiesTab from '../../partials/dashboard/CommoditiesTab.svelte';
    import JournalTab from '../../partials/dashboard/JournalTab.svelte';
    import IncomeStatementTab from '../../partials/dashboard/IncomeStatementTab.svelte';
    import ReportsTab from '../../partials/dashboard/ReportsTab.svelte';

    // Types
    import type { OverviewController } from '../../../controllers/OverviewController';
    import type { TransactionController } from '../../../controllers/TransactionController';
    import type { BalanceSheetController } from '../../../controllers/BalanceSheetController';
    import type { CommoditiesController } from '../../../controllers/CommoditiesController';
    import type { IncomeStatementController } from '../../../controllers/IncomeStatementController';
    import type { ReportsController } from '../../../controllers/ReportsController';
    import type { NavRequest } from '../../../types/navigation';

    // Props
    export let overviewController: OverviewController;
    export let transactionController: TransactionController;
    export let balanceSheetController: BalanceSheetController;
    export let commoditiesController: CommoditiesController;
    export let incomeStatementController: IncomeStatementController;
    export let reportsController: ReportsController;
    export let journalStore: any;
    export let plugin: any = null; // Add plugin prop
    export let ledgerProfileName = '';
    export let ledgerProfiles: Array<{ id: string; name: string; readOnly?: boolean }> = [];
    export let activeLedgerProfileId = '';
    export let languagePreference: LanguagePreference = 'auto';

    export let activeTab = 'overview';
    let isSwitchingLedger = false;

    export function navigate(req: NavRequest) {
        if (!req || !req.tab) return;
        if (req.tab === 'transactions') {
            const filters = req.filters || {};
            transactionController.setPendingFilters(filters);
            void transactionController.handleFilterChange(filters);
        } else if (req.tab === 'journal') {
            if (req.filters) {
                void journalStore.setFilters(req.filters);
            }
        }
        activeTab = req.tab;
    }

    function handleNavigateEvent(e: CustomEvent<NavRequest>) {
        if (e && e.detail) {
            navigate(e.detail);
        }
    }

    async function handleLedgerProfileChange(event: Event) {
        const profileId = (event.currentTarget as HTMLSelectElement).value;
        if (!plugin || !profileId || profileId === activeLedgerProfileId || isSwitchingLedger) return;

        isSwitchingLedger = true;
        const result = await plugin.switchLedgerProfile(profileId);
        if (!result.success) {
            // The plugin keeps the active selection unchanged when it cannot switch.
            activeLedgerProfileId = plugin.settings.activeLedgerProfileId;
            (event.currentTarget as HTMLSelectElement).value = activeLedgerProfileId;
        }
        isSwitchingLedger = false;
    }

    async function handleLanguageChange(event: Event) {
        languagePreference = (event.currentTarget as HTMLSelectElement).value as LanguagePreference;
        await plugin?.changeLanguage(languagePreference);
    }

    $: tabs = [
        { value: 'overview', label: $tr("Overview") },
        { value: 'reports', label: $tr("Reports") },
        { value: 'transactions', label: $tr("Transactions") },
        { value: 'journal', label: $tr("Journal") },
        { value: 'balancesheet', label: $tr("Accounts & Balances") },
        { value: 'incomestatement', label: $tr("Income Statement") },
        { value: 'commodities', label: $tr("Commodities") }
    ];
</script>

<div class="beancount-dashboard">

    {#if ledgerProfiles.length > 0}
        <div class="ledger-profile-bar">
            <label for="ledger-profile-switcher">{$tr("账套")}</label>
            <select
                id="ledger-profile-switcher"
                value={activeLedgerProfileId}
                disabled={isSwitchingLedger}
                on:change={handleLedgerProfileChange}
                aria-label={$tr("切换账套")}
            >
                {#each ledgerProfiles as profile}
                    <option value={profile.id}>{profile.name}{profile.readOnly ? $tr("（只读）") : ''}</option>
                {/each}
            </select>
        </div>
    {:else if ledgerProfileName}
        <div class="ledger-profile-bar">{$tr("账套：")}{ledgerProfileName}</div>
    {/if}
    <div class="tabs-header">
        <TabBar {tabs} bind:value={activeTab} fullWidth={false} ariaLabel={$tr("Dashboard sections")} />
        <select class="language-switcher" value={languagePreference} on:change={handleLanguageChange} aria-label={$tr('Interface language')} title={$tr('Interface language')}>
            <option value="auto">{$tr('Follow Obsidian')}</option>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
        </select>
    </div>

    <div class="tab-content">
        {#if activeTab === 'overview'}
            <OverviewTab controller={overviewController} {plugin} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'reports'}
            <ReportsTab controller={reportsController} />
        {:else if activeTab === 'transactions'}
            <TransactionsTab 
                controller={transactionController}
                {navigate}
                on:navigate={handleNavigateEvent}
                on:filtersChange={e => transactionController.handleFilterChange(e.detail)}
            />
        {:else if activeTab === 'journal'}
            <JournalTab store={journalStore} {plugin} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'balancesheet'}
            <BalanceSheetTab controller={balanceSheetController} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'incomestatement'}
            <IncomeStatementTab controller={incomeStatementController} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'commodities'}
            <CommoditiesTab controller={commoditiesController} on:navigate={handleNavigateEvent} on:openCommodity on:addCommodity />
        {/if}
    </div>
</div>

<style>
    .beancount-dashboard {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .tabs-header {
        display: flex;
        padding: var(--size-4-2) var(--size-4-3);
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        overflow-x: auto;
        align-items: center;
        gap: var(--size-4-3);
    }

    .language-switcher {
        margin-left: auto;
        flex-shrink: 0;
        font-size: var(--font-ui-small);
        max-width: 10rem;
    }

    .ledger-profile-bar {
        display: flex;
        align-items: center;
        gap: var(--size-4-2);
        padding: var(--size-4-2) var(--size-4-3);
        color: var(--text-muted);
        font-size: var(--font-ui-small);
        background: var(--background-secondary);
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .ledger-profile-bar select {
        max-width: min(22rem, 70vw);
        min-height: 30px;
        color: var(--text-normal);
        font: inherit;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--size-4-4);
        background: var(--background-primary);
    }
</style>
