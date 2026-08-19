// src/views/sidebar-view.ts
import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import type BeancountPlugin from '../../../main';
import BeancountViewComponent from './SidebarView.svelte'; // Assuming this is the correct Svelte component for the sidebar
import { runQuery, execSafe } from '../../../utils/index';
import { getMainLedgerPath } from '../../../utils/structuredLayout';
import { getVaultRelativePath, convertWslPathToWindows } from '../../../utils/fileEditor';
import * as queries from '../../../queries/index';
import { Logger } from '../../../utils/logger';
import { getReconciliationStatus } from '../../../services/reconciliation.service';
import type { ReconciliationAccountStatus } from '../../../services/reconciliation.service';
import { BeancountFileView } from '../beancount-file-view';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from '../dashboard/unified-dashboard-view';
import { resolveNavTab, type NavRequest } from '../../../types/navigation';
// ----------------------------------------

export const BEANCOUNT_VIEW_TYPE = "beancount-view"; // This identifies the Sidebar/Snapshot view

/** A single parsed `bean-query ... ERRORS` line, structured for click-to-jump. */
export interface SnapshotError {
	/** Full path as reported by bean-query (may be a WSL path). */
	filePath: string;
	/** Short filename for display, e.g. "2026.beancount". */
	fileName: string;
	/** 1-based line number. */
	lineNum: number;
	message: string;
}

export class BeancountView extends ItemView {
	plugin: BeancountPlugin;
	private component: BeancountViewComponent;

	// State managed by this view
	private state = {
		isLoading: true,
		assets: "0 USD",
		liabilities: "0 USD",
		netWorth: "0.00 USD",
		kpiError: null as string | null,
		fileStatus: "checking" as "checking" | "ok" | "error",
		fileStatusMessage: "" as string | null,
		errorCount: 0,
		errorList: [] as SnapshotError[],
		// Reconciliation state
		reconciliationOverdue: 0,
		reconciliationUpToDate: 0,
		reconciliationAccounts: [] as ReconciliationAccountStatus[],
		activeTab: 'errors' as 'errors' | 'reconciliation'
	};

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BEANCOUNT_VIEW_TYPE; }
	getDisplayText() { return "Beancount snapshot"; } // Updated display text
	getIcon() { return "landmark"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new BeancountViewComponent({
			target: container,
			props: { ...this.state, plugin: this.plugin }
		});

		// Listen for events
		this.component.$on('refresh', () => { void this.updateView(); });
		this.component.$on('tabChange', (e: CustomEvent<string>) => {
			this.updateProps({ activeTab: e.detail as 'errors' | 'reconciliation' });
		});
		this.component.$on('open-error', (e: CustomEvent<{ filePath: string; lineNum: number }>) => {
			void this.openErrorLocation(e.detail.filePath, e.detail.lineNum);
		});
		this.component.$on('reconcile-click', (e: CustomEvent<{ account: string; lastBalanceDate: string | null; ctrlKey: boolean }>) => {
			void this.openAccountInTransactions(e.detail.account, e.detail.lastBalanceDate, e.detail.ctrlKey);
		});

		window.setTimeout(() => { void this.updateView(); }, 0);
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

	private updateProps(newState: Partial<typeof this.state>) {
		Logger.log('[updateProps] Updating state with:', newState);
		this.state = { ...this.state, ...newState };
		Logger.log('[updateProps] New state:', this.state);
		if (this.component) {
			this.component.$set(this.state);
			Logger.log('[updateProps] Component updated with new state');
		} else {
			Logger.log('[updateProps] Warning: Component not initialized yet');
		}
	}

	// --- Main data update function ---
	async updateView() {
		this.updateProps({ isLoading: true, kpiError: null, fileStatus: "checking", fileStatusMessage: null });
		new Notice('Refreshing snapshot...');
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		if (!reportingCurrency) {
			this.updateProps({ kpiError: "Operating currency is not set in settings.", isLoading: false });
			return;
		}
		try {
			await this.plugin.currencyPrecisionService.ensureLoaded();
			const decimals = this.plugin.currencyPrecisionService.getDecimals(reportingCurrency);

			// Run KPI queries, bean check, and reconciliation concurrently
			const [
				kpiResults,
				checkResult,
				reconciliationResult
			] = await Promise.all([
				Promise.all([
					runQuery(this.plugin, queries.getTotalAssetsQuery(reportingCurrency, decimals)),
					runQuery(this.plugin, queries.getTotalLiabilitiesQuery(reportingCurrency, decimals)),
					runQuery(this.plugin, queries.getTotalWorthQuery(reportingCurrency, decimals)),
				]),
				this.runBeanCheck(),
				getReconciliationStatus(this.plugin).catch(err => {
					Logger.error('[refreshData] Reconciliation fetch failed:', err);
					return { overdueCount: 0, upToDateCount: 0, accounts: [] as ReconciliationAccountStatus[] };
				})
			]);

			const [assetsResult, liabilitiesResult, netWorthResult] = kpiResults;

			const parseNumericResult = (csv: string): number => {
				const lines = csv.split('\n').map(line => line.trim()).filter(Boolean);
				return parseFloat(lines[1]) || 0;
			};

			const assetsNum = parseNumericResult(assetsResult);
			const liabilitiesNum = parseNumericResult(liabilitiesResult);
			const netWorthNum = parseNumericResult(netWorthResult);


			Logger.log('[refreshData] Check result from runBeanCheck:', checkResult);
			Logger.log('[refreshData] Error count:', checkResult.errorCount);
			Logger.log('[refreshData] Error list:', checkResult.errorList);

			this.updateProps({
				assets: `${assetsNum.toFixed(decimals)} ${reportingCurrency}`,
				liabilities: `${liabilitiesNum.toFixed(decimals)} ${reportingCurrency}`,
				netWorth: `${netWorthNum.toFixed(decimals)} ${reportingCurrency}`,
				kpiError: null, 
				fileStatus: checkResult.status, 
				fileStatusMessage: checkResult.message,
				errorCount: checkResult.errorCount,
				errorList: checkResult.errorList,
				reconciliationOverdue: reconciliationResult.overdueCount,
				reconciliationUpToDate: reconciliationResult.upToDateCount,
				reconciliationAccounts: reconciliationResult.accounts
			});

		} catch (error) {
			console.error("Error updating snapshot view:", error);
			this.updateProps({ 
				kpiError: error instanceof Error ? error.message : String(error), 
					fileStatus: "error", 
				fileStatusMessage: "Failed during refresh.",
				errorCount: 0,
				errorList: []
			});
		} finally {
			if(this.state.isLoading) this.updateProps({ isLoading: false });
		}
	}

	// --- Runs bean-check (using ERRORS query) ---
	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null; errorCount: number; errorList: SnapshotError[] }> {
		const filePath = getMainLedgerPath(this.plugin);
		const commandBase = this.plugin.settings.beancountCommand;
		Logger.log('[runBeanCheck] Starting validation check');
		Logger.log('[runBeanCheck] File path:', filePath);
		Logger.log('[runBeanCheck] Command base:', commandBase);
		
		if (!filePath) return { status: "error", message: "File path not set.", errorCount: 0, errorList: [] };
		if (!commandBase) return { status: "error", message: "Command not set.", errorCount: 0, errorList: [] };

		// Convert Windows path to WSL path if using WSL
		let checkFilePath = filePath;
		if (commandBase.includes('wsl')) {
			// Convert Windows path to WSL format
			const match = filePath.match(/^([a-zA-Z]):\\/);
			if (match) {
				const driveLetter = match[1].toLowerCase();
				checkFilePath = filePath.replace(/^[a-zA-Z]:\\/, `/mnt/${driveLetter}/`).replace(/\\/g, '/');
			}
		}

		// --- Use imported query function (uses ERRORS query) ---
		const args = [checkFilePath, 'ERRORS'];
		Logger.log('[runBeanCheck] Executing command (safe):', commandBase, args);

		return new Promise((resolve) => {
			const handleResult = (error: Error | null, stdout: string, stderr: string) => {
				Logger.log('[runBeanCheck] Command completed');
				Logger.log('[runBeanCheck] Error object:', error ? error.message : 'null');
				Logger.log('[runBeanCheck] Stdout length:', stdout?.length || 0);
				Logger.log('[runBeanCheck] Stderr length:', stderr?.length || 0);
				Logger.log('[runBeanCheck] Stdout content:', stdout);
				Logger.log('[runBeanCheck] Stderr content:', stderr);
				
				// Check for command execution errors (not validation errors)
				if (error && stderr && !stdout) {
					// Command failed to execute
					Logger.log('[runBeanCheck] Command execution failed');
					resolve({ 
						status: "error", 
						message: `Failed to run validation: ${stderr}`,
						errorCount: 0,
						errorList: []
					});
					return;
				}

				// Parse formatted output from ERRORS query
				if (stdout && stdout.trim()) {
					Logger.log('[runBeanCheck] Parsing stdout output');
					// Parse error lines from formatted output
					const errorLines = this.parseErrorsFromFormattedOutput(stdout);
					Logger.log('[runBeanCheck] Parsed error lines count:', errorLines.length);
					Logger.log('[runBeanCheck] Parsed error lines:', errorLines);
					
					if (errorLines.length > 0) {
						const result = { 
							status: "error" as const, 
							message: `Found ${errorLines.length} validation error(s)`,
							errorCount: errorLines.length,
							errorList: errorLines
						};
						Logger.log('[runBeanCheck] Returning error result:', result);
						resolve(result);
					} else {
						// Output had no parseable errors
						Logger.log('[runBeanCheck] No parseable errors found in output');
						resolve({ 
							status: "ok", 
							message: "File OK",
							errorCount: 0,
							errorList: []
						});
					}
				} else {
					// No output means no errors
					Logger.log('[runBeanCheck] No stdout output, assuming OK');
					resolve({ 
						status: "ok", 
						message: "File OK",
						errorCount: 0,
						errorList: []
					});
				}
			};

			execSafe(commandBase, args)
				.then(({ stdout, stderr }) => {
					handleResult(null, stdout, stderr);
				})
				.catch((error: unknown) => {
					const err = error as { stdout?: string; stderr?: string; message?: string } & Error;
					handleResult(err, err.stdout || '', err.stderr || err.message || String(error));
				});
		});
	}

	// --- Parse ERRORS query formatted output ---
	private parseErrorsFromFormattedOutput(output: string): SnapshotError[] {
		Logger.log('[parseErrorsFromFormattedOutput] Starting parse');
		Logger.log('[parseErrorsFromFormattedOutput] Output length:', output?.length || 0);
		Logger.log('[parseErrorsFromFormattedOutput] First 500 chars:', output?.substring(0, 500));

		if (!output || !output.trim()) {
			Logger.log('[parseErrorsFromFormattedOutput] Empty output, returning empty array');
			return [];
		}

		const lines = output.split('\n');
		Logger.log('[parseErrorsFromFormattedOutput] Total lines:', lines.length);
		const errorLines: SnapshotError[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			Logger.log(`[parseErrorsFromFormattedOutput] Line ${i}:`, trimmed);

			// Match error lines that follow the pattern: filename:line: Error message
			// Use .+ instead of [^:]+ to handle Windows paths with colons (e.g., C:\path\file.beancount:34: Error)
			const regex = /.+:\d+:\s+.+/;
			const matches = trimmed && trimmed.match(regex);
			Logger.log(`[parseErrorsFromFormattedOutput] Line ${i} matches regex:`, !!matches);

			if (trimmed && matches) {
				// Match filepath (including Windows C:\ paths), line number, and message
				const match = trimmed.match(/(.+):(\d+):\s+(.+)/);
				Logger.log(`[parseErrorsFromFormattedOutput] Line ${i} detail match:`, match ? 'YES' : 'NO');

				if (match) {
					const filePath = match[1];
					const lineNum = parseInt(match[2], 10);
					const message = match[3];
					const fileName = filePath.split(/[/\\]/).pop() || filePath;
					Logger.log(`[parseErrorsFromFormattedOutput] Adding error:`, fileName, lineNum, message);
					errorLines.push({ filePath, fileName, lineNum, message });
				} else {
					// Fallback: no parseable file/line — keep the message, no jump target.
					Logger.log(`[parseErrorsFromFormattedOutput] Using line as-is:`, trimmed);
					errorLines.push({ filePath: '', fileName: '', lineNum: 0, message: trimmed });
				}
			}
		}

		Logger.log('[parseErrorsFromFormattedOutput] Total parsed errors:', errorLines.length);
		Logger.log('[parseErrorsFromFormattedOutput] Error lines:', errorLines);
		return errorLines;
	}

	// --- Open a validation error's source location in the editor ---
	private async openErrorLocation(filePath: string, lineNum: number) {
		if (!filePath) return;
		try {
			const windowsPath = convertWslPathToWindows(filePath);
			const relativePath = getVaultRelativePath(this.plugin, windowsPath);
			const file = this.plugin.app.vault.getAbstractFileByPath(relativePath);
			if (!(file instanceof TFile)) {
				new Notice(`Could not locate file in vault: ${relativePath}`);
				return;
			}
			const leaf = this.plugin.app.workspace.getLeaf(true);
			await leaf.openFile(file);
			if (leaf.view instanceof BeancountFileView) {
				leaf.view.revealLine(lineNum);
			}
		} catch (err) {
			Logger.error('[openErrorLocation] Failed to open error location:', err);
			new Notice('Failed to open file at error location.');
		}
	}

	// --- Open the Transactions (or Journal) tab, filtered by account + reconciliation window ---
	private async openAccountInTransactions(account: string, lastBalanceDate: string | null, ctrlKey: boolean) {
		if (!account) return;
		const req: NavRequest = {
			tab: resolveNavTab({ ctrlKey }),
			filters: { account, ...(lastBalanceDate ? { startDate: lastBalanceDate } : {}) }
		};

		const findDashboardLeaf = () => this.plugin.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE)
			.find(leaf => leaf.view instanceof UnifiedDashboardView);

		let leaf = findDashboardLeaf();
		if (!leaf) {
			await this.plugin.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab');
			leaf = findDashboardLeaf();
		} else {
			await this.plugin.app.workspace.revealLeaf(leaf);
		}

		if (leaf?.view instanceof UnifiedDashboardView) {
			leaf.view.navigate(req);
		}
	}
}


// -------------------------