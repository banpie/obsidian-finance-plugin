// src/main.ts

import { MarkdownPreviewRenderer, Plugin, Notice, TFile, type MarkdownPostProcessor } from 'obsidian';
import { BeancountSettingTab, type BeancountPluginSettings, type LedgerProfile, DEFAULT_SETTINGS } from './settings';
import type { Completion } from '@codemirror/autocomplete';
import { parseSnippetsFile } from './lang/beancount-snippets';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './ui/views/sidebar/sidebar-view';
import { BeancountFileView, BEANCOUNT_FILE_VIEW_TYPE } from './ui/views/beancount-file-view';
import { UnifiedTransactionModal } from './ui/modals/UnifiedTransactionModal';
import { runQuery, type BQLFormat } from './utils/index';
import { createPluginApi, type BeancountPluginApi } from './api';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from './ui/views/dashboard/unified-dashboard-view';
import { BQLCodeBlockProcessor } from './ui/markdown/BQLCodeBlockProcessor';
import { InlineBQLProcessor } from './ui/markdown/InlineBQLProcessor';
import { OnboardingModal } from './ui/modals/OnboardingModal';
import { ConfirmModal } from './ui/modals/ConfirmModal';
import { formatBeancountCommand } from './lang/beancount-format';
import type { EditorView } from '@codemirror/view';

import { JournalService } from './services/journal.service';
import { PriceService } from './services/price.service';
import { CurrencyPrecisionService } from './services/currency-precision.service';
import { createJournalStore } from './stores/journal.store';
import { Logger } from './utils/logger';
import { SystemDetector } from './utils/SystemDetector';
import { resolveBeanQueryCommand } from './utils/beanQueryCommandRecovery';
import { getMainLedgerPath } from './utils/structuredLayout';
import { createLedgerProfileId, createLegacyLedgerProfile, normalizeLedgerFolder, type LedgerProfileDraft } from './utils/ledgerProfiles';

// --------------------------------------------------

/**
 * Main plugin class for Obsidian Finance (Beancount).
 * Handles plugin lifecycle, settings, service initialization, and UI registration.
 */
export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;
	private bqlProcessor: BQLCodeBlockProcessor;
	private bqlPostProcessor?: MarkdownPostProcessor;
	public inlineBqlProcessor: InlineBQLProcessor;

	/** Cached user-defined transaction snippets. */
	public snippetCompletions: Completion[] = [];

	/** Public API surface for inter-plugin access. */
	public api: BeancountPluginApi;

	// Services
	public journalService: JournalService;
	public priceService: PriceService;
	public currencyPrecisionService: CurrencyPrecisionService;
	public journalStore: ReturnType<typeof createJournalStore>;

	/** Whether bean-query is currently reachable (runtime state, NOT persisted). */
	public isConnectionReady = false;

	/**
	 * Called when the plugin is loaded by Obsidian.
	 * Initializes services, processors, views, commands, and settings.
	 */
	async onload() {
		await this.loadSettings();

		// Initialize Logger
		Logger.setDebugMode(this.settings.debugMode);
		Logger.log('Plugin loading...');

		await this.ensureBeancountCommand();

		// Load snippets if enabled
		if (this.settings.enableUserSnippets) {
			await this.loadSnippets();
		}

		// Expose public API for other plugins
		this.api = createPluginApi(this);

		// Initialize Core Services
		this.journalService = new JournalService(this);
		this.priceService = new PriceService(this);
		this.currencyPrecisionService = new CurrencyPrecisionService(this);
		this.journalStore = createJournalStore(this.journalService);

		// Non-blocking: infer per-currency display precision from the ledger.
		if (this.settings.beancountCommand) {
			void this.currencyPrecisionService.ensureLoaded();
		}

		// Check for onboarding — use dedicated flag instead of structuredFolderName
		if (!this.settings.onboardingCompleted) {
			Logger.log('Onboarding not completed. Triggering onboarding wizard.');
			this.app.workspace.onLayoutReady(() => {
				new OnboardingModal(this.app, this).open();
			});
		}

		// Non-blocking runtime probe to check if bean-query is reachable
		if (this.settings.beancountCommand) {
			void this.probeConnection();
		}

		// Initialize and register BQL code block processor
		this.registerBQLProcessor();

		// Initialize and register inline BQL processor
		this.registerInlineBQLProcessor();

		// Register Views
		this.registerView(
			BEANCOUNT_VIEW_TYPE, // Sidebar Snapshot
			(leaf) => new BeancountView(leaf, this)
		);
		this.registerView(
			UNIFIED_DASHBOARD_VIEW_TYPE,
			(leaf) => new UnifiedDashboardView(leaf, this)
		);
		this.registerView(
			BEANCOUNT_FILE_VIEW_TYPE,
			(leaf) => new BeancountFileView(leaf, this)
		);

		// Register .beancount and .bean files with a plain-text view to avoid Markdown rendering
		this.registerExtensions(['beancount', 'bean'], BEANCOUNT_FILE_VIEW_TYPE);

		// Add Ribbon Icons
		this.addRibbonIcon('plus-circle', 'Add transaction', () => {
			if (!this.requireActiveLedgerWritable('新增交易')) return;
			new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open();
		});
		this.addRibbonIcon('repeat-2', '切换账套', () => {
			void this.switchToNextLedgerProfile();
		});
		this.addRibbonIcon('layout-dashboard', 'Open Beancount dashboard', () => {
			void this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); // Open the NEW view
		});

		// Add Commands
		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount transaction',
			callback: () => {
				if (!this.requireActiveLedgerWritable('新增交易')) return;
				new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open();
			}
		});
		this.addCommand({
			id: 'switch-to-next-ledger-profile',
			name: '切换至下一个账套',
			callback: () => { void this.switchToNextLedgerProfile(); }
		});
		// 'Insert BQL Query Block' command removed — use manual insertion or BQL templates instead
		this.addCommand({
			id: 'open-beancount-unified-dashboard', // This ID now opens the new unified view
			name: 'Open Beancount unified dashboard',
			callback: () => { void this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); }
		});
		this.addCommand({
			id: 'open-beancount-snapshot',
			name: 'Open Beancount snapshot',
			callback: () => { void this.activateView(BEANCOUNT_VIEW_TYPE, 'right'); }
		});
		this.addCommand({
			id: 'run-beancount-onboarding',
			name: 'Run setup/onboarding',
			callback: () => {
				if (this.settings.onboardingCompleted) {
					new ConfirmModal(
						this.app,
						"Run Setup / Onboarding",
						"You have already completed setup. Running the onboarding wizard again will allow you to recreate the structured folder layout or migrate another ledger. Do you want to proceed?",
						() => {
							new OnboardingModal(this.app, this).open();
						}
					).open();
				} else {
					new OnboardingModal(this.app, this).open();
				}
			}
		});
		this.addCommand({
			id: 'format-beancount-document',
			name: 'Format Beancount document',
			callback: () => {
				const active = this.app.workspace.getActiveViewOfType(BeancountFileView);
				if (active) {
					formatBeancountCommand((active as unknown as { editorView: EditorView }).editorView);
				} else {
					new Notice('Open a .beancount file first.');
				}
			}
		});

		// Add Fetch Commodity Prices command
		this.addCommand({
			id: 'fetch-commodity-prices',
			name: 'Fetch commodity prices',
			callback: async () => {
				if (!this.requireActiveLedgerWritable('更新价格')) return;
				// Find the unified dashboard view and call fetchPrices on commodities controller
				const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
				for (const leaf of leaves) {
					if (leaf.view instanceof UnifiedDashboardView) {
						await leaf.view.commoditiesController?.fetchPrices();
						return;
					}
				}
				// If dashboard not open, just run the service directly
				Logger.log('[Main] Fetching prices via command (dashboard not open)');
				const result = await this.priceService.fetchAndSavePrices();
				if (result.failed.length > 0) {
					const suffix = result.restored ? ' The original price file was restored.' : '';
					new Notice(`Price update failed: ${result.failed[0].error}.${suffix}`);
				} else if (result.summary) {
					new Notice(`✓ ${result.summary}`);
				} else if (result.savedCount > 0) {
					new Notice(`✓ Fetched and saved ${result.savedCount} price(s)`);
				} else {
					new Notice('No prices fetched. Check commodity price sources.');
				}
			}
		});

		// Setup automatic price fetching if enabled
		if (this.settings.autoPriceFetch) {
			this.setupAutomaticPriceFetching();
		}


		// Register vault listeners for real-time snippets reloading
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					void this.loadSnippets();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					void this.loadSnippets();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					this.snippetCompletions = [];
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				const snippetsPath = `${folderName}/snippets.beancount`;
				if (file instanceof TFile) {
					if (file.path === snippetsPath) {
						void this.loadSnippets();
					} else if (oldPath === snippetsPath) {
						this.snippetCompletions = [];
					}
				}
			})
		);

		// Add Command to open snippets file
		this.addCommand({
			id: 'open-beancount-snippets',
			name: 'Open Beancount snippets file',
			callback: async () => {
				const folderName = this.settings.structuredFolderName || 'Finances';
				const snippetsFilePath = `${folderName}/snippets.beancount`;
				const file = this.app.vault.getAbstractFileByPath(snippetsFilePath);
				if (file && file instanceof TFile) {
					await this.app.workspace.getLeaf(true).openFile(file);
				} else {
					// File does not exist yet; loadSnippets() will create it
					await this.loadSnippets();
					const createdFile = this.app.vault.getAbstractFileByPath(snippetsFilePath);
					if (createdFile && createdFile instanceof TFile) {
						await this.app.workspace.getLeaf(true).openFile(createdFile);
					} else {
						new Notice('Could not find or create snippets.beancount');
					}
				}
			}
		});

		this.addSettingTab(new BeancountSettingTab(this.app, this));
	}

	/**
	 * Sets up automatic price fetching on an interval.
	 */
	public setupAutomaticPriceFetching(): void {
		const intervalMs = this.settings.priceFetchIntervalHours * 60 * 60 * 1000;
		Logger.log(`[Main] Setting up automatic price fetching every ${this.settings.priceFetchIntervalHours} hours`);

		// Register interval with Obsidian's lifecycle management
		this.registerInterval(
			window.setInterval(() => {
				void (async () => {
					if (this.isActiveLedgerReadOnly()) {
						Logger.log('[Main] Skipping automatic price fetching for a read-only ledger profile.');
						return;
					}
					Logger.log('[Main] Running automatic price fetch');
					try {
						const result = await this.priceService.fetchAndSavePrices();

						// Update last fetch timestamp
						this.settings.lastAutoPriceFetch = Date.now();
						await this.saveSettings();

						// Only show notice on errors (don't spam on success)
						if (result.failed.length > 0) {
							const failedSymbols = result.failed.map(f => f.commodity).join(', ');
							new Notice(`⚠ Automatic price fetch: Failed for ${failedSymbols}`);
						}

						Logger.log(`[Main] Automatic price fetch complete: ${result.savedCount} saved, ${result.failed.length} failed`);
					} catch (error) {
						Logger.error('[Main] Automatic price fetch error:', error);
					}
				})();
			}, intervalMs)
		);
	}

	/**
	 * Non-blocking runtime probe to check if bean-query is reachable.
	 * Sets the in-memory `isConnectionReady` flag without persisting it.
	 */
	public async probeConnection(): Promise<void> {
		if (!this.settings.beancountCommand) {
			this.isConnectionReady = false;
			return;
		}
		try {
			const detector = SystemDetector.getInstance();
			let result = await detector.testCommand(
				this.settings.beancountCommand, ['--version'], 3000
			);
			if (!result.success) {
				// bean-query does not support --version, so fallback to --help
				result = await detector.testCommand(
					this.settings.beancountCommand, ['--help'], 3000
				);
			}
			this.isConnectionReady = result.success;
			Logger.log(`[Main] Connection probe: ${result.success ? 'ready' : 'not reachable'}`);
		} catch {
			this.isConnectionReady = false;
			Logger.log('[Main] Connection probe: failed (exception)');
		}
	}

	/**
	 * Activates a specific view type in the workspace.
	 *
	 * @param {string} viewType - The type of view to activate.
	 * @param {'tab' | 'right' | 'left'} [location='tab'] - Where to open the view.
	 */
	async activateView(viewType: string, location: 'tab' | 'right' | 'left' = 'tab') {
		// Detach existing leaves of this type first to avoid duplicates
		if (location === 'tab') {
			this.app.workspace.detachLeavesOfType(viewType);
		}
		let leaf;
		if (location === 'right') {
			leaf = this.app.workspace.getRightLeaf(false);
			// If right leaf doesn't exist, create it
			if (!leaf) {
				leaf = this.app.workspace.getLeaf('split', 'vertical');
			}
		} else if (location === 'left') {
			leaf = this.app.workspace.getLeftLeaf(false);
			// If left leaf doesn't exist, create it
			if (!leaf) {
				leaf = this.app.workspace.getLeaf('split', 'horizontal');
			}
		}
		else { // Default to 'tab'
			leaf = this.app.workspace.getLeaf('tab');
		}

		if (leaf) {
			Logger.log(`Activating view: ${viewType} at ${location}`);
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
			await this.app.workspace.revealLeaf(leaf); // Focus the view
		} else {
			Logger.error(`Could not get leaf for location: ${location}`);
		}
	}

	/**
	 * Public wrapper for running BQL queries (used by views and controllers).
	 * @param {string} query - The BQL query.
	 * @param {BQLFormat} [format='csv'] - Output format (csv, text, html).
	 * @returns {Promise<string>} The raw output in the requested format.
	 */
	public runQuery = (query: string, format: BQLFormat = 'csv'): Promise<string> => {
		return runQuery(this, query, undefined, format);
	}

	// Helper method to get dashboard refresh callback
	public getDashboardRefreshCallback(): () => Promise<void> {
		return async () => {
			// Find the unified dashboard view and call its refresh method
			const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
			for (const leaf of leaves) {
				if (leaf.view instanceof UnifiedDashboardView) {
					await leaf.view.refreshAllTabs();
					break;
				}
			}
		};
	}

	/**
	 * Called when the plugin is unloaded.
	 */
	onunload() {
		Logger.log('Plugin unloading...');
		this.bqlProcessor?.dispose();
		if (this.bqlPostProcessor) {
			MarkdownPreviewRenderer.unregisterPostProcessor(this.bqlPostProcessor);
			this.bqlPostProcessor = undefined;
		}
	}

	/** Apply the selected investment-only gain/loss color convention. */
	public applyInvestmentGainLossColors(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE)) {
			if (leaf.view instanceof UnifiedDashboardView) {
				leaf.view.reportsController.setInvestmentGainLossColors(
					this.settings.investmentGainLossColors || DEFAULT_SETTINGS.investmentGainLossColors,
				);
			}
		}
	}

	// Register BQL processor
	private registerBQLProcessor() {
		// Create processor instance
		this.bqlProcessor = new BQLCodeBlockProcessor(this);

		// Register the processor
		this.bqlPostProcessor = this.registerMarkdownCodeBlockProcessor('bql', this.bqlProcessor.getProcessor());
	}

	// Register inline BQL processor
	private registerInlineBQLProcessor() {
		// Create processor instance
		this.inlineBqlProcessor = new InlineBQLProcessor(this);

		// Register the processor for all markdown content with high priority
		this.registerMarkdownPostProcessor(this.inlineBqlProcessor.getProcessor(), -100);
	}

	async loadSettings() {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		let needsSave = false;

		// Migration: consolidate legacy `reportingCurrency` / `defaultCurrency` into `operatingCurrency`
		if (!this.settings.operatingCurrency) {
			const legacyReporting = raw?.reportingCurrency;
			const legacyDefault = raw?.defaultCurrency;
			const migrated = (legacyReporting || legacyDefault || DEFAULT_SETTINGS.operatingCurrency) as string;
			this.settings.operatingCurrency = typeof migrated === 'string' ? migrated.toUpperCase() : DEFAULT_SETTINGS.operatingCurrency;
			// Persist migrated value
			needsSave = true;
		}

		// Migration: upgrade guard to infer onboarding completion for existing users
		if (raw && !('onboardingCompleted' in raw) && this.settings.structuredFolderName) {
			this.settings.onboardingCompleted = true;
			needsSave = true;
		}

		const savedProfiles = Array.isArray(raw?.ledgerProfiles) ? raw.ledgerProfiles : [];
		const profiles = savedProfiles.filter((profile): profile is LedgerProfile => {
			if (!profile || typeof profile !== 'object') return false;
			const value = profile as Partial<LedgerProfile>;
			return typeof value.id === 'string'
				&& typeof value.name === 'string'
				&& typeof value.structuredFolderName === 'string'
				&& typeof value.operatingCurrency === 'string'
				&& (value.fileOrganization === 'yearly' || value.fileOrganization === 'monthly')
				&& !!normalizeLedgerFolder(value.structuredFolderName);
		});
		if (profiles.length === 0) {
			this.settings.ledgerProfiles = [createLegacyLedgerProfile(this.settings)];
			this.settings.activeLedgerProfileId = this.settings.ledgerProfiles[0].id;
			needsSave = true;
		} else {
			this.settings.ledgerProfiles = profiles;
			const active = profiles.find(profile => profile.id === raw?.activeLedgerProfileId) || profiles[0];
			this.settings.activeLedgerProfileId = active.id;
			this.applyLedgerProfile(active);
			if (raw?.activeLedgerProfileId !== active.id) needsSave = true;
		}

		if (needsSave) await this.saveSettings();
	}

	public getActiveLedgerProfile(): LedgerProfile | null {
		return this.settings.ledgerProfiles.find(profile => profile.id === this.settings.activeLedgerProfileId) || null;
	}

	public isActiveLedgerReadOnly(): boolean {
		return this.getActiveLedgerProfile()?.readOnly === true;
	}

	public requireActiveLedgerWritable(action: string): boolean {
		const profile = this.getActiveLedgerProfile();
		if (!profile?.readOnly) return true;
		new Notice(`“${profile.name}”是只读账套，不能${action}。`);
		return false;
	}

	public async addLedgerProfile(draft: LedgerProfileDraft): Promise<{ success: boolean; error?: string }> {
		const name = draft.name.trim();
		const folder = normalizeLedgerFolder(draft.structuredFolderName);
		const currency = draft.operatingCurrency.trim().toUpperCase();
		if (!name) return { success: false, error: '请输入账套名称。' };
		if (!folder) return { success: false, error: '账套目录必须在当前 Vault 内，且不能包含 ..。' };
		if (!/^[A-Z]{3}$/.test(currency)) return { success: false, error: '记账币种应为三位大写代码，例如 CNY。' };
		if (this.settings.ledgerProfiles.some(profile => profile.structuredFolderName === folder)) {
			return { success: false, error: '该账套目录已存在。' };
		}
		if (!(await this.app.vault.adapter.exists(`${folder}/ledger.beancount`))) {
			return { success: false, error: '目录中未找到 ledger.beancount。' };
		}
		this.settings.ledgerProfiles = [
			...this.settings.ledgerProfiles,
			{
				id: createLedgerProfileId(name, this.settings.ledgerProfiles.map(profile => profile.id)),
				name,
				structuredFolderName: folder,
				operatingCurrency: currency,
				fileOrganization: draft.fileOrganization,
				readOnly: draft.readOnly === true,
			},
		];
		await this.saveSettings();
		return { success: true };
	}

	public async switchLedgerProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
		const profile = this.settings.ledgerProfiles.find(candidate => candidate.id === profileId);
		if (!profile) return { success: false, error: '未找到该账套。' };
		if (!(await this.app.vault.adapter.exists(`${profile.structuredFolderName}/ledger.beancount`))) {
			return { success: false, error: `找不到 ${profile.name} 的 ledger.beancount。` };
		}
		this.settings.activeLedgerProfileId = profile.id;
		this.applyLedgerProfile(profile);
		await this.saveSettings();
		if (this.settings.enableUserSnippets && !profile.readOnly) {
			await this.loadSnippets();
		} else if (profile.readOnly) {
			this.snippetCompletions = [];
		}
		await this.refreshLedgerViews();
		new Notice(`已切换到“${profile.name}”${profile.readOnly ? '（只读）' : ''}。`);
		return { success: true };
	}

	private async switchToNextLedgerProfile(): Promise<void> {
		const profiles = this.settings.ledgerProfiles;
		if (profiles.length < 2) {
			new Notice('请先在“ledger profiles”设置中新增另一个账套。');
			return;
		}
		const currentIndex = Math.max(0, profiles.findIndex(profile => profile.id === this.settings.activeLedgerProfileId));
		const next = profiles[(currentIndex + 1) % profiles.length];
		const result = await this.switchLedgerProfile(next.id);
		if (!result.success) new Notice(result.error || '无法切换账套。');
	}

	private applyLedgerProfile(profile: LedgerProfile): void {
		this.settings.structuredFolderName = profile.structuredFolderName;
		this.settings.operatingCurrency = profile.operatingCurrency;
		this.settings.fileOrganization = profile.fileOrganization;
	}

	private syncActiveLedgerProfile(): void {
		const index = this.settings.ledgerProfiles.findIndex(profile => profile.id === this.settings.activeLedgerProfileId);
		if (index < 0) return;
		const profile = this.settings.ledgerProfiles[index];
		this.settings.ledgerProfiles[index] = {
			...profile,
			structuredFolderName: this.settings.structuredFolderName,
			operatingCurrency: this.settings.operatingCurrency,
			fileOrganization: this.settings.fileOrganization,
		};
	}

	private async refreshLedgerViews(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
		await Promise.all(leaves.map(async leaf => {
			if (leaf.view instanceof UnifiedDashboardView) {
				await leaf.view.refreshAllTabs();
				leaf.view.setLedgerProfileName(this.getActiveLedgerProfile()?.name || '');
			}
		}));
	}

	private async ensureBeancountCommand(): Promise<void> {
		const detector = SystemDetector.getInstance();
		const savedCommand = this.settings.beancountCommand;
		const resolution = await resolveBeanQueryCommand(
			detector,
			savedCommand,
			getMainLedgerPath(this),
		);

		if (resolution.status === 'ready') {
			return;
		}

		if (resolution.status === 'recovered' && resolution.command) {
			if (resolution.shouldPersist) {
				this.settings.beancountCommand = resolution.command;
				await this.saveSettings();
			}
			const action = savedCommand ? 'Updated' : 'Configured';
			new Notice(`${action} Beancount command to ${resolution.command}`);
			return;
		}

		if (resolution.status === 'unavailable') {
			Logger.warn(`Configured bean-query command is not usable on this device: ${savedCommand}`);
			new Notice('Beancount command is unavailable on this device. The shared setting was preserved.');
			return;
		}

		new Notice('Beancount command is not configured. Install beanquery and set bean-query in plugin settings.');
	}

	async saveSettings() {
		this.syncActiveLedgerProfile();
		await this.saveData(this.settings);
		// Refresh all BQL code blocks with new settings
		if (this.bqlProcessor) {
			this.refreshBQLBlocks();
		}
	}

	// Force refresh all BQL code blocks
	private refreshBQLBlocks() {
		// Use setTimeout to ensure settings are fully saved before refreshing
		window.setTimeout(() => {
			this.bqlProcessor?.refreshAllBlocks();
		}, 50);
	}

	/**
	 * Loads and parses user-defined snippets from snippets.beancount.
	 * If the file doesn't exist, it creates it with basic templates.
	 */
	public async loadSnippets(): Promise<void> {
		if (!this.settings.enableUserSnippets) {
			this.snippetCompletions = [];
			return;
		}

		try {
			const folderName = this.settings.structuredFolderName || 'Finances';
			const snippetsFilePath = `${folderName}/snippets.beancount`;
			const adapter = this.app.vault.adapter;

			const exists = await adapter.exists(snippetsFilePath);
			if (!exists) {
				const initialContent = `;; User-Defined Transaction Snippets
;;
;; Define transactions here with the metadata "Snippet: <name>".
;; These will be suggested when you start typing at the beginning of a line.
;;
;; Example:
2026-01-01 * "Sample Payee" "Sample Narration"
  Snippet: "sampleSnippet"
  Assets:Checking      -150.00 USD
  Expenses:Rent
`;
				// Ensure folder exists before creating the file
				const folderExists = await adapter.exists(folderName);
				if (!folderExists) {
					await this.app.vault.createFolder(folderName);
				}
				await this.app.vault.create(snippetsFilePath, initialContent);
				this.snippetCompletions = [];
				Logger.log('[Main] Created snippets.beancount with initial templates.');
				return;
			}

			const content = await adapter.read(snippetsFilePath);
			this.snippetCompletions = parseSnippetsFile(content);
			Logger.log(`[Main] Loaded ${this.snippetCompletions.length} user snippet(s).`);
		} catch (error) {
			Logger.error('[Main] Failed to load snippets:', error);
			this.snippetCompletions = [];
		}
	}
}
