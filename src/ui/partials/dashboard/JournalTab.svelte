<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { debounce, getOpenAccounts, getPayees, getTags, deleteTransaction, deleteBalance, deleteNote } from '../../../utils/index';
    import SkeletonLoader from '../../common/SkeletonLoader.svelte';
    import ErrorBanner from '../../common/ErrorBanner.svelte';
    import EmptyState from '../../common/EmptyState.svelte';
    import TransactionCard from './cards/TransactionCard.svelte';
    import BalanceCard from './cards/BalanceCard.svelte';
    import NoteCard from './cards/NoteCard.svelte';
    import { UnifiedTransactionModal } from '../../modals/UnifiedTransactionModal';
    import { ConfirmModal } from '../../modals/ConfirmModal';
    import { Notice } from 'obsidian';
    import type { JournalEntry } from '../../../models/journal';
    import { Logger } from '../../../utils/logger';

    // Instead of importing Controller, we receive the Store
    export let store: any;
    // We also need the plugin instance to pass to the modal
    // But store usually doesn't have the plugin instance.
    // The previous code didn't use plugin instance for actions, but UnifiedTransactionModal NEEDS it.
    // How did JournalTab get the plugin?
    // It didn't use it before.
    // UnifiedTransactionModal constructor: (app: App, plugin: BeancountPlugin, ...)
    // We need to access the plugin instance.
    // Usually passed as prop or context.
    // Let's assume it's available via a method on the store or we need to find a way.
    // In UnifiedDashboardView.svelte, JournalTab is rendered.
    // UnifiedDashboardView receives `controller` which has `plugin`.
    // JournalTab receives `store`.
    // We might need to pass `plugin` prop to JournalTab.
    // Let's check UnifiedDashboardView.svelte again.

    // For now, I'll add `plugin` export and update the caller if needed.
    // Or I can access it via the store if the store holds a reference?
    // The store is a Svelte store, likely not holding the plugin directly in a public way.
    // `journal.store.ts` imports `JournalService`.

    // The `UnifiedDashboardView.svelte` passes `store={journalStore}`.
    // I should check `UnifiedDashboardView.svelte` to see if I can pass `plugin`.

    export let plugin: any = null; // We will need to update the parent to pass this.

    // Destructure store for easier access
    const {
        entries,
        filters,
        loading,
        error,
        currentPage,
        pageSize,
        totalCount,
        hasMore,
        loadEntries,
        setFilters,
        clearFilters,
        setPage,
        refresh
    } = store;

    // Local filter state
    let searchTerm = '';
    let selectedAccount = '';
    let startDate = '';
    let endDate = '';
    let payeeFilter = '';
    let tagFilter = '';
    let typeFilter = 'all';
    
    // Flag to prevent filter application during initialization
    let isInitialized = false;

    // Suggestions lists
    let availableAccounts: string[] = [];
    let availablePayees: string[] = [];
    let availableTags: string[] = [];

    const updateFiltersDebounced = debounce(() => {
        // Prevent filter updates if not initialized or already loading
        if (!isInitialized || isLoading) {
            return;
        }
        applyFilters();
    }, 800);

    async function fetchSuggestions() {
        if (!plugin) return;
        try {
            // Run requests in parallel - now using BQL directly instead of backend API
            const [accountsRes, payeesRes, tagsRes] = await Promise.allSettled([
                getOpenAccounts(plugin),
                getPayees(plugin),
                getTags(plugin)
            ]);

            // Limit suggestions to avoid DOM freezing with large datasets
            // Reduced to 200 to ensure responsiveness even on slower devices
            const MAX_SUGGESTIONS = 200;

            if (accountsRes.status === 'fulfilled') {
                availableAccounts = accountsRes.value.slice(0, MAX_SUGGESTIONS);
            }
            if (payeesRes.status === 'fulfilled') {
                const payees = payeesRes.value || [];
                availablePayees = payees.slice(0, MAX_SUGGESTIONS);
            }
            if (tagsRes.status === 'fulfilled') {
                const tags = tagsRes.value || [];
                availableTags = tags.slice(0, MAX_SUGGESTIONS);
            }

        } catch (err) {
            console.error('Failed to load suggestions:', err);
        }
    }

    function applyFilters() {
        // Prevent concurrent filter applications or premature calls
        if (!isInitialized || isLoading) {
            return;
        }
        setFilters({
            searchTerm: searchTerm || undefined,
            account: selectedAccount || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            payee: payeeFilter || undefined,
            tag: tagFilter || undefined,
            entryTypes: typeFilter !== 'all' ? [typeFilter] : undefined
        });
    }

    function handleClear() {
        searchTerm = '';
        selectedAccount = '';
        startDate = '';
        endDate = '';
        payeeFilter = '';
        tagFilter = '';
        typeFilter = 'all';
        clearFilters();
    }

    function handleEdit(entry: JournalEntry) {
        if (!plugin) {
            console.error("Plugin instance not found");
            return;
        }
        new UnifiedTransactionModal(plugin.app, plugin, entry, async () => {
            await refresh();
        }).open();
    }

    function handleDelete(entry: JournalEntry) {
        if (!plugin) {
            console.error("Plugin instance not found");
            return;
        }

        new ConfirmModal(
            plugin.app,
            '删除条目',
            `确定要删除这条 ${entry.type} 吗？`,
            async () => {
                try {
                    let result;
                    
                    // Call the appropriate delete function based on entry type
                    if (entry.type === 'transaction') {
                        result = await deleteTransaction(plugin, entry.id);
                    } else if (entry.type === 'balance') {
                        result = await deleteBalance(plugin, entry.id);
                    } else if (entry.type === 'note') {
                        result = await deleteNote(plugin, entry.id);
                    } else {
                        new Notice(`暂不支持删除 ${entry.type} 类型条目。`);
                        return;
                    }
                    
                    if (result.success) {
                        new Notice('条目已删除。');
                        await refresh();
                    } else {
                        new Notice(`删除失败：${result.error || '未知错误'}`);
                    }
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    new Notice('删除失败，请查看控制台详情。');
                }
            }
        ).open();
    }

    onMount(() => {
        Logger.log('JournalTab mounted');
        // Sync local state with store filters
        const currentFilters = $filters;
        searchTerm = currentFilters.searchTerm || '';
        selectedAccount = currentFilters.account || '';
        startDate = currentFilters.startDate || '';
        endDate = currentFilters.endDate || '';
        payeeFilter = currentFilters.payee || '';
        tagFilter = currentFilters.tag || '';

        if (currentFilters.entryTypes && currentFilters.entryTypes.length === 1) {
            typeFilter = currentFilters.entryTypes[0];
        } else {
            typeFilter = 'all';
        }

        fetchSuggestions();
        loadEntries().then(() => {
            // Set initialized flag after initial load completes
            isInitialized = true;
        });
    });

    // Use non-reactive variables and update them manually
    let hasVisibleEntries = false;
    let visibleEntriesArray: JournalEntry[] = [];
    let isLoading = false;
    let totalEntries = 0;
    let currentPageNum = 1;
    let pageSizeNum = 200;
    let hasMorePages = false;
    
    // Subscribe to stores manually and update local state
    const unsubEntries = entries.subscribe((value: JournalEntry[]) => {
        const allEntries = value || [];
        visibleEntriesArray = allEntries.filter((e: JournalEntry) =>
            e && ['transaction', 'balance', 'note'].includes(e.type)
        );
        hasVisibleEntries = visibleEntriesArray.length > 0;
    });
    
    const unsubLoading = loading.subscribe((value: boolean) => { isLoading = value; });
    const unsubTotalCount = totalCount.subscribe((value: number) => { totalEntries = value; });
    const unsubCurrentPage = currentPage.subscribe((value: number) => { currentPageNum = value; });
    const unsubPageSize = pageSize.subscribe((value: number) => { pageSizeNum = value; });
    const unsubHasMore = hasMore.subscribe((value: boolean) => { hasMorePages = value; });
    
    // Cleanup subscriptions
    onDestroy(() => {
        unsubEntries();
        unsubLoading();
        unsubTotalCount();
        unsubCurrentPage();
        unsubPageSize();
        unsubHasMore();
    });
</script>

<div class="journal-tab">
    <!-- Filters Toolbar -->
    <div class="filters-container">
        <div class="filter-row">
            <div class="filter-group">
                <label for="search">搜索</label>
                <input type="text" id="search" bind:value={searchTerm} on:input={updateFiltersDebounced} placeholder="搜索交易对象、说明或账户..." disabled={isLoading} />
            </div>
            <div class="filter-group">
                <label for="type">类型</label>
                <select id="type" bind:value={typeFilter} on:change={applyFilters} disabled={isLoading}>
                    <option value="all">全部类型</option>
                    <option value="transaction">交易</option>
                    <option value="note">备注</option>
                    <option value="balance">余额断言</option>
                </select>
            </div>
             <div class="filter-group">
                <label for="account">账户</label>
                <input type="text" id="account" bind:value={selectedAccount} on:input={updateFiltersDebounced} list="account-suggestions" placeholder="账户..." disabled={isLoading} />
                <datalist id="account-suggestions">
                    {#each availableAccounts as account}
                        <option value={account} />
                    {/each}
                </datalist>
            </div>
        </div>

        <div class="filter-row">
             <div class="filter-group">
                <label for="start">开始</label>
                <input type="date" id="start" bind:value={startDate} on:change={applyFilters} disabled={isLoading} />
            </div>
             <div class="filter-group">
                <label for="end">结束</label>
                <input type="date" id="end" bind:value={endDate} on:change={applyFilters} disabled={isLoading} />
            </div>
            <div class="filter-group">
                <label for="payee">交易对象</label>
                <input type="text" id="payee" bind:value={payeeFilter} on:input={updateFiltersDebounced} list="payee-suggestions" placeholder="交易对象..." disabled={isLoading} />
                <datalist id="payee-suggestions">
                    {#each availablePayees as payee}
                        <option value={payee} />
                    {/each}
                </datalist>
            </div>
            <div class="filter-group">
                <label for="tag">标签</label>
                <input type="text" id="tag" bind:value={tagFilter} on:input={updateFiltersDebounced} list="tag-suggestions" placeholder="标签..." disabled={isLoading} />
                <datalist id="tag-suggestions">
                    {#each availableTags as tag}
                        <option value={tag} />
                    {/each}
                </datalist>
                <!-- Datalist temporarily removed for debugging -->
            </div>
            <div class="filter-actions">
                 <button class="btn" on:click={handleClear} disabled={isLoading}>清除</button>
                 <button class="btn btn-primary" on:click={() => refresh()} disabled={isLoading}>刷新</button>
            </div>
        </div>
    </div>

    <!-- Error Banner -->
    {#if $error}
        <ErrorBanner message={$error} on:retry={() => refresh()} />
    {/if}

    <!-- Cards List -->
    <div class="cards-container">
        {#if isLoading}
            <SkeletonLoader type="list" rows={5} />
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length === 0}
            <EmptyState icon="📓" title="没有找到条目" description="没有交易、备注或余额断言匹配当前搜索和筛选条件。" />
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length > 0}
            {#each visibleEntriesArray as entry (entry.id)}
                {#if entry.type === 'transaction'}
                    <TransactionCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {:else if entry.type === 'balance'}
                    <BalanceCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {:else if entry.type === 'note'}
                    <NoteCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {/if}
            {/each}
        {/if}
    </div>

    <!-- Pagination -->
    {#if totalEntries > 0}
    <div class="pagination-container">
        <span class="pagination-info">
            显示第 <span class="font-semibold">{(currentPageNum - 1) * pageSizeNum + 1}</span> 到 <span class="font-semibold">{Math.min(currentPageNum * pageSizeNum, totalEntries)}</span> 条，共 <span class="font-semibold">{totalEntries}</span> 条
        </span>
        <div class="pagination-controls">
            <button class="btn-small" on:click={() => setPage(currentPageNum - 1)} disabled={currentPageNum === 1}>
                上一页
            </button>
            <button class="btn-small" on:click={() => setPage(currentPageNum + 1)} disabled={!hasMorePages}>
                下一页
            </button>
        </div>
    </div>
    {/if}
</div>

<style>
    .journal-tab {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 0;
        gap: 1rem;
    }

    .filters-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--background-secondary);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
    }

    .filter-row {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        align-items: flex-end;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        min-width: 120px;
    }

    .filter-group label {
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .filter-group input, .filter-group select {
        padding: 0.4rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.9rem;
    }

    .filter-actions {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
    }

    .btn {
        padding: 0.4rem 0.8rem;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.9rem;
    }

    .btn:hover {
        background: var(--interactive-hover);
    }

    .btn-primary {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
    }

    .btn-primary:hover {
        background: var(--interactive-accent-hover);
    }

    .error-banner {
        padding: 0.75rem;
        background: var(--background-modifier-error);
        color: var(--text-on-accent); /* Ensure readability on red background */
        border-radius: 6px;
        border: 1px solid var(--text-error);
        margin-bottom: 1rem;
        font-weight: 500;
    }

    .cards-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px; /* Space for scrollbar */
    }

    .loading-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-muted);
        font-size: 1.1rem;
        border: 1px dashed var(--background-modifier-border);
        border-radius: 8px;
    }

    .pagination-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 0.5rem;
    }

    .pagination-info {
        font-size: 0.9rem;
        color: var(--text-muted);
    }

    .pagination-controls {
        display: flex;
        gap: 0.5rem;
    }

    .btn-small {
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.85rem;
    }

    .btn-small:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
