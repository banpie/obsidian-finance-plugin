<!-- src/ui/modals/OnboardingModal.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { App, Notice, TFile, Platform } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import { DEMO_LEDGER_CONTENT } from '../../services/demo-ledger';
	import { Logger } from '../../utils/logger';
	import { migrateToStructuredLayout } from '../../utils/structuredLayout';
	import { SystemDetector } from '../../utils/SystemDetector';
	import { UNIFIED_DASHBOARD_VIEW_TYPE } from '../views/dashboard/unified-dashboard-view';

	// Props passed from Modal wrapper
	export let app: App;
	export let plugin: BeancountPlugin;
	export let modal: any;

	// ── Step state ──
	let currentStep: 'connect' | 'organize' | 'ready' = 'connect';

	// ── Step 1: Connect state ──
	let isDetecting = true;
	let beanQueryValid = false;
	let beanQueryCommand: string | null = null;
	let beanQueryVersion: string | null = null;
	let beanPriceValid = false;
	let beanPriceCommand: string | null = null;
	let beanPriceVersion: string | null = null;

	// Manual command entry
	let manualCommand = '';
	let isVerifying = false;
	let verifyResult: 'idle' | 'success' | 'error' = 'idle';
	let verifyMessage = '';
	let isEditing = false;

	// Platform
	let platformDisplay = 'Unknown';
	let activeInstallTab: 'windows' | 'macos' | 'linux-native' | 'linux-sandbox' = 'windows';

	// ── Step 2: Organize state ──
	let dataChoice: 'demo' | 'existing' | null = null;
	let existingFilePath = '';
	let structuredFolderName = 'Finances';
	let fileOrganization: 'yearly' | 'monthly' = 'yearly';
	let operatingCurrency = plugin.settings.operatingCurrency || 'USD';
	let beancountFiles: string[] = [];
	let isSubmitting = false;
	let showManualPathInput = false;

	onMount(async () => {
		// Detect platform for install tab defaults
		const detector = SystemDetector.getInstance();
		try {
			const systemInfo = await detector.getSystemInfo();
			platformDisplay = systemInfo.platformDisplay || 'Unknown';
			if (systemInfo.platform === 'win32') activeInstallTab = 'windows';
			else if (systemInfo.platform === 'darwin') activeInstallTab = 'macos';
			else activeInstallTab = 'linux-native';
		} catch {
			platformDisplay = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
		}

		// List .beancount files for Step 2
		const allFiles = app.vault.getFiles();
		beancountFiles = allFiles
			.filter(file => file.extension === 'beancount')
			.map(file => file.path);
		if (beancountFiles.length > 0) {
			existingFilePath = beancountFiles[0];
		}

		// Auto-detect bean-query
		await detectBeanQuery();
	});

	// ── Detection ──
	async function detectBeanQuery() {
		if (!Platform.isDesktop) {
			Logger.warn('[Onboarding] CLI detection skipped: Not running on desktop platform.');
			isDetecting = false;
			return;
		}
		isDetecting = true;
		try {
			const detector = SystemDetector.getInstance();

			// Detect bean-query
			Logger.log('[Onboarding] Detecting bean-query...');
			let bqResult = await detector.detectBeanQueryCommand(false);

			// If auto-detection failed, try saved setting
			if (!bqResult.isValid && plugin.settings.beancountCommand) {
				Logger.log(`[Onboarding] Trying saved command: ${plugin.settings.beancountCommand}`);
				const testResult = await detector.testCommand(plugin.settings.beancountCommand, ['--version']);
				if (testResult.success) {
					const versionMatch = (testResult.output || '').match(/(\d+\.\d+\.\d+)/);
					bqResult = {
						command: plugin.settings.beancountCommand,
						version: versionMatch ? versionMatch[1] : 'unknown',
						isValid: true,
						errors: []
					};
				}
			}

			beanQueryValid = bqResult.isValid;
			beanQueryCommand = bqResult.command;
			beanQueryVersion = bqResult.version;

			// Save if valid
			if (beanQueryValid && beanQueryCommand) {
				plugin.settings.beancountCommand = beanQueryCommand;
				manualCommand = beanQueryCommand;
			}

			// Detect bean-price (optional, non-blocking)
			Logger.log('[Onboarding] Detecting bean-price...');
			const bpResult = await detector.detectBeanPriceCommand(false);
			beanPriceValid = bpResult.isValid;
			beanPriceCommand = bpResult.command;
			beanPriceVersion = bpResult.version;

			if (beanPriceValid && beanPriceCommand) {
				plugin.settings.beanPriceCommand = beanPriceCommand;
			}

			await plugin.saveSettings();

			Logger.log('[Onboarding] Detection complete', { beanQueryValid, beanPriceValid });
		} catch (error) {
			Logger.error('[Onboarding] Detection failed', error);
		} finally {
			isDetecting = false;
		}
	}

	async function verifyManualCommand() {
		const cmd = manualCommand.trim();
		if (!cmd) {
			verifyResult = 'error';
			verifyMessage = 'Please enter a command.';
			return;
		}

		isVerifying = true;
		verifyResult = 'idle';
		verifyMessage = '';

		try {
			const detector = SystemDetector.getInstance();

			// First try --version
			let result = await detector.testCommand(cmd, ['--version'], 5000);
			if (!result.success) {
				// Fallback to --help
				result = await detector.testCommand(cmd, ['--help'], 5000);
			}

			if (result.success) {
				const versionMatch = (result.output || '').match(/(\d+\.\d+\.\d+)/);
				beanQueryValid = true;
				beanQueryCommand = cmd;
				beanQueryVersion = versionMatch ? versionMatch[1] : 'unknown';
				verifyResult = 'success';
				verifyMessage = `Verified! ${beanQueryVersion !== 'unknown' ? `v${beanQueryVersion}` : ''}`;

				// Save to settings
				plugin.settings.beancountCommand = cmd;
				await plugin.saveSettings();

				isEditing = false;
			} else {
				verifyResult = 'error';
				verifyMessage = `Command failed: ${result.error || 'Not found or not executable'}`;
			}
		} catch (error: any) {
			verifyResult = 'error';
			verifyMessage = `Error: ${error?.message || 'Unknown error'}`;
		} finally {
			isVerifying = false;
		}
	}

	function startEditing() {
		isEditing = true;
		manualCommand = beanQueryCommand || plugin.settings.beancountCommand || '';
		verifyResult = 'idle';
		verifyMessage = '';
	}

	function cancelEditing() {
		isEditing = false;
		verifyResult = 'idle';
		verifyMessage = '';
	}

	function selectDataChoice(choice: 'demo' | 'existing') {
		dataChoice = choice;
		if (choice === 'demo') {
			operatingCurrency = 'USD';
		}
	}

	// ── Step 2: File setup ──
	async function handleFinish() {
		if (isSubmitting) return;

		if (!dataChoice) {
			new Notice('Please select an option');
			return;
		}

		if (dataChoice === 'existing' && !existingFilePath.trim()) {
			new Notice('Please select or enter an existing Beancount file path');
			return;
		}

		isSubmitting = true;

		try {
			if (dataChoice === 'demo') {
				await handleDemoStructured();
			} else {
				await handleExistingStructured();
			}

			// Atomically commit settings only after filesystem migration succeeds
			plugin.settings.fileOrganization = fileOrganization;
			plugin.settings.onboardingCompleted = true;
			await plugin.saveSettings();

			// Update runtime connection state
			plugin.isConnectionReady = beanQueryValid;

			currentStep = 'ready';
			new Notice('🎉 Setup completed successfully!');
		} catch (error: any) {
			Logger.error('[Onboarding] Setup failed', error);
			const msg = error?.message || 'Setup failed. See console for details.';
			new Notice(`Setup failed: ${msg}`, 8000);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDemoStructured() {
		Logger.log('Onboarding: Demo + Structured Setup');
		const tempFilePath = '_demo_temp.beancount';
		const adapter = app.vault.adapter;

		if (await adapter.exists(tempFilePath)) {
			try {
				await adapter.remove(tempFilePath);
				await new Promise(r => setTimeout(r, 200));
			} catch (e: any) {
				throw new Error(`Could not delete existing temp file: ${e.message}`);
			}
		}

		await adapter.write(tempFilePath, DEMO_LEDGER_CONTENT);
		await new Promise(r => setTimeout(r, 300));

		const tempFile = app.vault.getAbstractFileByPath(tempFilePath) as TFile;
		if (!tempFile) {
			throw new Error('Failed to register temporary demo file in vault');
		}

		// @ts-ignore
		const tempAbsolutePath = adapter.getFullPath(tempFile.path);

		const result = await migrateToStructuredLayout(plugin, structuredFolderName, tempAbsolutePath);
		if (!result.success) {
			throw new Error(`Migration failed: ${result.error}`);
		}

		// Clean up
		try {
			await app.vault.delete(tempFile);
		} catch (cleanupErr) {
			Logger.warn('Onboarding: Failed to clean up temp file', cleanupErr);
		}
	}

	async function handleExistingStructured() {
		Logger.log('Onboarding: Existing + Structured Setup');
		let sourcePath = existingFilePath;

		// Convert vault-relative to absolute if needed
		if (!sourcePath.match(/^[a-zA-Z]:[\\\/]/) && !sourcePath.startsWith('/')) {
			const file = app.vault.getAbstractFileByPath(sourcePath);
			if (file && file instanceof TFile) {
				// @ts-ignore
				sourcePath = app.vault.adapter.getFullPath(file.path);
			} else {
				throw new Error(`Could not find file in vault: ${sourcePath}`);
			}
		}

		const result = await migrateToStructuredLayout(plugin, structuredFolderName, sourcePath);
		if (!result.success) {
			throw new Error(`Migration failed: ${result.error}`);
		}
	}

	function skipOnboarding() {
		new Notice('You can set up bean-query anytime in Settings → Connection.');
		modal.close();
	}

	async function finishAndOpenDashboard() {
		// @ts-ignore
		await plugin.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab');
		modal.close();
	}

	// ── Helpers ──
	function getTransactionExample(): string {
		if (fileOrganization === 'monthly') {
			return `${structuredFolderName}/transactions/2026/2026-07.beancount`;
		}
		return `${structuredFolderName}/transactions/2026.beancount`;
	}

	$: folderPreviewFiles = [
		`${structuredFolderName}/`,
		`  ledger.beancount`,
		`  accounts.beancount`,
		`  commodities.beancount`,
		`  prices.beancount`,
		`  transactions/`,
		...(fileOrganization === 'monthly'
			? [`    2026/`, `      2026-01.beancount`]
			: [`    2026.beancount`])
	];
</script>

<div class="onboarding-container">
	<!-- Header -->
	<div class="onboarding-header">
		<h2>Welcome to Obsidian Finance</h2>
		<!-- Step progress bar -->
		<div class="step-bar">
			<button
				class="step-node"
				class:is-active={currentStep === 'connect'}
				class:is-done={currentStep === 'organize' || currentStep === 'ready'}
				on:click={() => { if (currentStep !== 'connect') currentStep = 'connect'; }}
			>
				<span class="step-circle">1</span>
				<span class="step-label">Connect</span>
			</button>
			<div class="step-line" class:is-done={currentStep === 'organize' || currentStep === 'ready'}></div>
			<button
				class="step-node"
				class:is-active={currentStep === 'organize'}
				class:is-done={currentStep === 'ready'}
				disabled={!beanQueryValid && currentStep === 'connect'}
				on:click={() => { if (beanQueryValid && currentStep !== 'organize') currentStep = 'organize'; }}
			>
				<span class="step-circle">2</span>
				<span class="step-label">Organize</span>
			</button>
			<div class="step-line" class:is-done={currentStep === 'ready'}></div>
			<button
				class="step-node"
				class:is-active={currentStep === 'ready'}
				disabled
			>
				<span class="step-circle">3</span>
				<span class="step-label">Ready</span>
			</button>
		</div>
	</div>

	<!-- Step Content -->
	<div class="onboarding-body">

		<!-- ═══════════════════════════════════════════════ -->
		<!-- STEP 1: CONNECT                                -->
		<!-- ═══════════════════════════════════════════════ -->
		{#if currentStep === 'connect'}
			<p class="step-description">
				This plugin uses <strong>bean-query</strong> — a command-line tool from the Beancount ecosystem — to query your financial data.
				Obsidian must be able to run it.
			</p>

			{#if isDetecting}
				<!-- Loading state -->
				<div class="detect-loading">
					<div class="spinner"></div>
					<span>Detecting bean-query on your system…</span>
				</div>
			{:else}
				<!-- ── bean-query status ── -->
				<div class="command-status-card" class:is-valid={beanQueryValid} class:is-invalid={!beanQueryValid} class:is-error={verifyResult === 'error'}>
					<div class="command-status-header">
						<div class="command-status-left">
							<span class="status-dot" class:is-active={beanQueryValid}></span>
							<strong>bean-query</strong>
							<span class="required-badge">required</span>
						</div>
						{#if beanQueryValid && beanQueryVersion}
							<span class="version-badge">v{beanQueryVersion}</span>
						{/if}
					</div>

					{#if beanQueryValid && !isEditing}
						<!-- Found state -->
						<div class="command-status-body">
							<div class="command-display">
								<code>{beanQueryCommand}</code>
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<span class="edit-link" on:click={startEditing}>Edit</span>
							</div>
						</div>
					{:else}
						<!-- Not found OR editing state -->
						<div class="command-status-body">
							{#if !beanQueryValid && !isEditing}
								<p class="not-found-text">
									Not detected automatically. If it's installed, enter the full command below.
								</p>
							{/if}
							<div class="manual-entry">
								<div class="manual-input-row">
									<input
										type="text"
										bind:value={manualCommand}
										placeholder="bean-query, /usr/local/bin/bean-query, wsl bean-query…"
										on:keydown={(e) => { if (e.key === 'Enter') verifyManualCommand(); }}
									/>
									<button class="mod-cta verify-btn" on:click={verifyManualCommand} disabled={isVerifying || !manualCommand.trim()}>
										{isVerifying ? '⏳ Verifying…' : 'Verify'}
									</button>
									{#if isEditing}
										<button class="cancel-edit-btn" on:click={cancelEditing}>Cancel</button>
									{/if}
								</div>
								{#if verifyResult !== 'idle'}
									<div class="verify-feedback" class:is-success={verifyResult === 'success'} class:is-error={verifyResult === 'error'}>
										{verifyMessage}
									</div>
								{/if}
								<p class="command-hint">
									💡 This is the exact command Obsidian will execute. Common values:
									<code>bean-query</code>, <code>wsl bean-query</code>,
									<code>/home/user/.local/bin/bean-query</code>
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- ── bean-price (optional info) moved directly below bean-query ── -->
				<div class="optional-dep">
					<div class="optional-dep-header">
						<span class="status-dot" class:is-active={beanPriceValid}></span>
						<strong>bean-price</strong>
						<span class="optional-badge">optional</span>
					</div>
					<div class="optional-dep-body">
						{#if beanPriceValid}
							<code>{beanPriceCommand}</code>
							{#if beanPriceVersion}<span class="version-text">v{beanPriceVersion}</span>{/if}
							— automatic commodity price fetching available.
						{:else}
							Not detected. Install with <code>pip install beanprice</code> to enable automatic price fetching. You can set this up later in Settings.
						{/if}
					</div>
				</div>

				<!-- ── Installation help (only when NOT found) ── -->
				{#if !beanQueryValid}
					<div class="install-help">
						<h4>📦 How to install</h4>

						<!-- Platform tabs -->
						<div class="install-tabs">
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span class="install-tab" class:is-active={activeInstallTab === 'windows'} on:click={() => activeInstallTab = 'windows'}>Windows</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span class="install-tab" class:is-active={activeInstallTab === 'macos'} on:click={() => activeInstallTab = 'macos'}>macOS</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span class="install-tab" class:is-active={activeInstallTab === 'linux-native'} on:click={() => activeInstallTab = 'linux-native'}>Linux (AppImage / Deb)</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span class="install-tab" class:is-active={activeInstallTab === 'linux-sandbox'} on:click={() => activeInstallTab = 'linux-sandbox'}>Linux (Flatpak / Snap)</span>
						</div>

						<div class="install-content">
							{#if activeInstallTab === 'windows'}
								<ol>
									<li>Install <a href="https://www.python.org/downloads/" target="_blank">Python 3.8+</a> (check "Add to PATH" during install)</li>
									<li>Open PowerShell and run:
										<pre><code>pip install beancount beanquery beanprice</code></pre>
									</li>
									<li>Verify: <code>bean-query --version</code></li>
								</ol>
								<div class="install-note">
									<strong>WSL users:</strong> If you prefer running Beancount inside WSL,
									install it there and use <code>wsl bean-query</code> as the command.
								</div>

							{:else if activeInstallTab === 'macos'}
								<ol>
									<li>Open Terminal and run:
										<pre><code>pip3 install beancount beanquery beanprice</code></pre>
									</li>
									<li>Verify: <code>bean-query --version</code></li>
								</ol>
								<div class="install-note">
									<strong>Note:</strong> GUI apps on macOS may not see <code>~/.local/bin</code>.
									If auto-detection fails, enter the full path:
									<code>/Users/you/.local/bin/bean-query</code>
									(find it with <code>which bean-query</code> in Terminal).
								</div>

							{:else if activeInstallTab === 'linux-native'}
								<ol>
									<li>Open your terminal and install via pip (recommended):
										<pre><code>pip install --user beancount beanquery beanprice</code></pre>
									</li>
									<li>Verify in terminal: <code>bean-query --version</code></li>
								</ol>
								<div class="install-note">
									<strong>Note on System Packages:</strong> Using <code>apt</code>, <code>dnf</code>, or <code>pacman</code> directly often installs Beancount v2. You must install <code>beanquery</code> via pip separately.
								</div>

							{:else if activeInstallTab === 'linux-sandbox'}
								<p class="sandbox-intro">Sandboxed packages cannot see your host Python environment by default. Follow this step-by-step guide to grant access:</p>
								
								<div class="sandbox-section">
									<strong>Flatpak — Recommended Setup</strong>
									<ol class="sandbox-steps expanded-steps">
										<li>
											<strong>Install the packages</strong> via pip on your host machine:
											<pre><code>pip install --user beancount beanquery beanprice</code></pre>
										</li>
										<li>
											<strong>Find your binary path</strong> by running this in your terminal:
											<pre><code>which bean-query</code></pre>
											<div class="step-hint">Note the folder directory (e.g., if the output is <code>~/.local/bin/bean-query</code>, your folder is <code>~/.local/bin</code>).</div>
										</li>
										<li>
											<strong>Grant Obsidian filesystem access</strong> to that folder using <code>flatpak override</code>:
											<pre><code>sudo flatpak override --filesystem=~/.local/bin md.obsidian.Obsidian</code></pre>
											<div class="sandbox-footnote">
												💡 <em>Replace <code>~/.local/bin</code> with your actual folder from Step 2 if different (e.g., <code>/usr/bin</code> for system packages or <code>~/miniconda3/bin</code> for conda).</em>
											</div>
										</li>
										<li>
											<strong>Restart Obsidian completely</strong> so the sandbox recognizes the new filesystem permissions.
										</li>
										<li>
											<strong>Configure & Verify:</strong> Enter the full absolute path from Step 2 (e.g., <code>/home/you/.local/bin/bean-query</code> or <code>~/.local/bin/bean-query</code>) into the command box above and click Verify.
										</li>
									</ol>
								</div>

								<div class="sandbox-section">
									<strong>Snap</strong>
									<ol class="sandbox-steps">
										<li>Find the absolute path on your host by running <code>which bean-query</code> in your terminal.</li>
										<li>Enter the full path into the command box above (e.g., <code>/home/you/.local/bin/bean-query</code>) and click Verify.</li>
									</ol>
									<div class="install-note">
										ℹ️ <strong>Note on Confinement:</strong> If your Snap installation is strictly confined and blocks host CLI execution, we recommend switching to the official AppImage or Flatpak release.
									</div>
								</div>
							{/if}
						</div>

						<div class="install-docs-link">
							📖 <a href="https://beancount.github.io/docs/installing_beancount/" target="_blank">Official Beancount installation guide</a>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Action buttons -->
			<div class="action-row">
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<span class="skip-link" on:click={skipOnboarding}>Skip for now</span>
				<div class="action-buttons">
					<!-- Dynamically apply mod-cta when detection fails; revert to secondary when valid -->
					<button
						class="re-detect-btn"
						class:mod-cta={!beanQueryValid}
						on:click={detectBeanQuery}
						disabled={isDetecting}
					>
						{isDetecting ? '⏳ Detecting…' : 'Re-detect'}
					</button>
					<button
						class="mod-cta next-btn"
						on:click={() => currentStep = 'organize'}
						disabled={!beanQueryValid}
					>
						Next: Organize →
					</button>
				</div>
			</div>


		<!-- ═══════════════════════════════════════════════ -->
		<!-- STEP 2: ORGANIZE                               -->
		<!-- ═══════════════════════════════════════════════ -->
		{:else if currentStep === 'organize'}
			<p class="step-description">
				Choose how to start and configure your folder layout. All your finance files will be organized in a single folder.
			</p>

			<!-- Data choice cards -->
			<div class="setup-cards-grid">
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div class="setup-card" class:is-selected={dataChoice === 'demo'} on:click={() => selectDataChoice('demo')}>
					<div class="card-badge">✨ Recommended for beginners</div>
					<div class="card-icon">📊</div>
					<h4>Start with Demo Data</h4>
					<p>A complete sample ledger with realistic accounts and transactions so you can explore the dashboard immediately.</p>
				</div>

				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div class="setup-card" class:is-selected={dataChoice === 'existing'} on:click={() => selectDataChoice('existing')}>
					<div class="card-icon">📁</div>
					<h4>Use My Existing Ledger</h4>
					<p>Select your existing Beancount file to migrate it into the structured folder layout.</p>
				</div>
			</div>

			<!-- Config form -->
			{#if dataChoice}
				<div class="setup-form">
					{#if dataChoice === 'existing'}
						{#if beancountFiles.length > 0 && !showManualPathInput}
							<div class="setting-item">
								<div class="setting-item-info">
									<div class="setting-item-name">Select Beancount file</div>
									<div class="setting-item-description">
										Choose from existing .beancount files in your vault, or
										<!-- svelte-ignore a11y-click-events-have-key-events -->
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<span class="setup-link" on:click={() => { showManualPathInput = true; existingFilePath = ''; }}>enter path manually</span>.
									</div>
								</div>
								<div class="setting-item-control">
									<select bind:value={existingFilePath}>
										{#each beancountFiles as file}
											<option value={file}>{file}</option>
										{/each}
									</select>
								</div>
							</div>
						{:else}
							<div class="setting-item">
								<div class="setting-item-info">
									<div class="setting-item-name">Beancount file path</div>
									<div class="setting-item-description">
										Vault-relative path to your ledger file (must be inside your vault).
										{#if beancountFiles.length > 0}
											<!-- svelte-ignore a11y-click-events-have-key-events -->
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											Or <span class="setup-link" on:click={() => { showManualPathInput = false; existingFilePath = beancountFiles[0]; }}>choose file from vault</span>.
										{/if}
									</div>
								</div>
								<div class="setting-item-control">
									<input type="text" bind:value={existingFilePath} placeholder="ledger.beancount" />
								</div>
							</div>
						{/if}
					{/if}

					<!-- Structured Folder Name -->
					<div class="setting-item">
						<div class="setting-item-info">
							<div class="setting-item-name">Folder name</div>
							<div class="setting-item-description">Folder in your vault where organized finance files will live</div>
						</div>
						<div class="setting-item-control">
							<input type="text" bind:value={structuredFolderName} placeholder="Finances" />
						</div>
					</div>

					<!-- Transaction File Organization -->
					<div class="setting-item">
						<div class="setting-item-info">
							<div class="setting-item-name">Transaction file period</div>
							<div class="setting-item-description">How transaction files are organized inside the folder</div>
						</div>
						<div class="setting-item-control">
							<select bind:value={fileOrganization}>
								<option value="yearly">Yearly (e.g. 2026.beancount)</option>
								<option value="monthly">Monthly (e.g. 2026/2026-07.beancount)</option>
							</select>
						</div>
					</div>

					<!-- Operating Currency -->
					<div class="setting-item">
						<div class="setting-item-info">
							<div class="setting-item-name">Operating currency</div>
							<div class="setting-item-description">Primary currency for your financial records</div>
						</div>
						<div class="setting-item-control">
							<input
								type="text"
								bind:value={operatingCurrency}
								placeholder="USD"
								on:input={() => operatingCurrency = operatingCurrency.toUpperCase()}
							/>
						</div>
					</div>

					{#if dataChoice === 'demo'}
						<p class="currency-hint">
							💡 Demo data uses USD. You can change the currency later in Settings.
						</p>
					{/if}

					<!-- Live folder tree preview -->
					<div class="folder-preview">
						<h4>📂 Folder structure preview</h4>
						<div class="tree">
							{#each folderPreviewFiles as line}
								<div class="tree-line">{line}</div>
							{/each}
							<div class="tree-line tree-more">  …and more</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="action-row">
				<button on:click={() => currentStep = 'connect'}>← Back</button>
				<div class="action-buttons">
					<button class="mod-warning" on:click={() => modal.close()}>Cancel</button>
					<button class="mod-cta" on:click={handleFinish} disabled={isSubmitting || !dataChoice}>
						{isSubmitting ? '⏳ Setting up…' : '🚀 Set Up'}
					</button>
				</div>
			</div>


		<!-- ═══════════════════════════════════════════════ -->
		<!-- STEP 3: READY                                  -->
		<!-- ═══════════════════════════════════════════════ -->
		{:else if currentStep === 'ready'}
			<div class="success-banner">
				<span class="success-icon">🎉</span>
				<h3>You're all set!</h3>
			</div>

			<div class="summary-card">
				<h4>Configuration Summary</h4>
				<div class="summary-grid">
					<div class="summary-row">
						<span class="summary-label">bean-query</span>
						<span class="summary-value"><code>{beanQueryCommand}</code> {#if beanQueryVersion}<span class="version-text">v{beanQueryVersion}</span>{/if}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">bean-price</span>
						<span class="summary-value">{beanPriceValid ? beanPriceCommand : 'Not configured (optional)'}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Folder</span>
						<span class="summary-value"><code>{structuredFolderName}/</code></span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Data source</span>
						<span class="summary-value">{dataChoice === 'demo' ? 'Demo Data' : 'Existing Ledger'}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Currency</span>
						<span class="summary-value currency">{operatingCurrency}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Transactions</span>
						<span class="summary-value">{fileOrganization === 'monthly' ? 'Monthly' : 'Yearly'} files</span>
					</div>
				</div>
			</div>

			<div class="next-steps">
				<h4>🚀 Next steps</h4>
				<ol>
					<li>Open the <strong>Finance Dashboard</strong> to explore your data</li>
					<li>Browse the 5 tabs: Overview, Transactions, Journal, Balance Sheet, Commodities</li>
					<li>Try BQL queries in your Markdown notes using <code>```bql</code> code blocks</li>
					{#if beanPriceValid}
						<li>Enable <strong>Automatic Price Fetching</strong> in Settings → General</li>
					{/if}
					<li>Manage commands anytime in <strong>Settings → Connection</strong></li>
				</ol>
			</div>

			<div class="action-row centered">
				<button on:click={() => modal.close()}>Close</button>
				<button class="mod-cta" on:click={finishAndOpenDashboard}>Open Dashboard</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* ═══ Container ═══ */
	.onboarding-container {
		padding: var(--size-4-4);
		max-width: 680px;
		margin: 0 auto;
	}

	/* ═══ Header ═══ */
	.onboarding-header h2 {
		margin: 0 0 var(--size-4-3) 0;
		color: var(--text-normal);
		font-size: var(--font-ui-large);
		text-align: center;
	}

	/* ═══ Step progress bar ═══ */
	.step-bar {
		display: flex;
		align-items: flex-start; /* Align top edges so we can position the line relative to the circle centers */
		justify-content: center;
		gap: 0;
		margin-bottom: var(--size-4-4);
	}

	.step-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0 !important;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
		min-width: 70px;
	}

	.step-node:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.step-circle {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-secondary-alt);
		font-weight: 600;
		font-size: 13px;
		transition: all 0.2s;
	}

	.step-node.is-active .step-circle {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb, 0, 122, 255), 0.2);
	}

	.step-node.is-active .step-label {
		color: var(--text-normal);
		font-weight: 600;
	}

	.step-node.is-done .step-circle {
		background: var(--background-modifier-success);
		color: var(--text-on-accent);
		border-color: var(--text-success);
	}

	.step-label {
		font-size: 11px;
		color: inherit;
	}

	.step-line {
		width: 50px;
		height: 2px;
		background: var(--background-modifier-border);
		margin-top: 13px; /* Positions the 2px line exactly at the 14px vertical center of the 28px circle */
		transition: background 0.3s;
	}

	.step-line.is-done {
		background: var(--text-success);
	}

	/* ═══ Body ═══ */
	.onboarding-body {
		min-height: 300px;
	}

	.step-description {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		margin: 0 0 var(--size-4-4) 0;
		line-height: var(--line-height-normal);
	}

	/* ═══ Detection loading ═══ */
	.detect-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-3);
		padding: var(--size-4-6) 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--background-modifier-border);
		border-top-color: var(--interactive-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ═══ Command status card ═══ */
	.command-status-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-3) var(--size-4-4);
		margin-bottom: var(--size-4-4);
		transition: border-color 0.2s;
	}

	.command-status-card.is-valid {
		border-left: 4px solid var(--text-success);
	}

	/* Default unconfigured state: neutral border instead of red */
	.command-status-card.is-invalid {
		border-left: 4px solid var(--background-modifier-border-hover);
	}

	/* Only flash red if manual verification explicitly fails */
	.command-status-card.is-error {
		border-left: 4px solid var(--text-error);
	}

	.command-status-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-2);
	}

	.command-status-left {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-muted);
		display: inline-block;
	}

	.status-dot.is-active {
		background: var(--text-success);
	}

	.required-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}

	.version-badge {
		font-size: var(--font-ui-smaller);
		font-weight: 600;
		color: var(--text-success);
		background: rgba(0, 180, 0, 0.1);
		padding: 2px 8px;
		border-radius: var(--radius-s);
	}

	.command-status-body {
		font-size: var(--font-ui-small);
	}

	.command-display {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
	}

	.command-display code {
		background: var(--background-primary);
		padding: 4px 10px;
		border-radius: var(--radius-s);
		font-size: 12px;
		flex: 1;
	}

	.edit-link {
		color: var(--text-accent);
		cursor: pointer;
		font-size: var(--font-ui-smaller);
		text-decoration: underline;
	}

	.edit-link:hover {
		color: var(--text-accent-hover);
	}

	.not-found-text {
		color: var(--text-muted);
		margin: 0 0 var(--size-4-2) 0;
		font-size: var(--font-ui-smaller);
	}

	/* ── Manual entry ── */
	.manual-entry {
		margin-top: var(--size-4-2);
	}

	.manual-input-row {
		display: flex;
		gap: var(--size-4-2);
		align-items: center;
	}

	.manual-input-row input {
		flex: 1;
		height: 32px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 0 12px;
		color: var(--text-normal);
		font-size: 13px;
	}

	.manual-input-row input:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.verify-btn {
		height: 32px;
		white-space: nowrap;
		font-size: 13px;
		padding: 0 16px;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cancel-edit-btn {
		height: 32px;
		font-size: 13px;
		padding: 0 12px;
		border-radius: var(--radius-s);
		white-space: nowrap;
	}

	.verify-feedback {
		margin-top: var(--size-4-2);
		padding: 6px 10px;
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
	}

	.verify-feedback.is-success {
		background: rgba(0, 180, 0, 0.1);
		color: var(--text-success);
	}

	.verify-feedback.is-error {
		background: rgba(220, 50, 50, 0.1);
		color: var(--text-error);
	}

	.command-hint {
		margin: var(--size-4-2) 0 0 0;
		font-size: 11px;
		color: var(--text-faint);
		line-height: 1.5;
	}

	.command-hint code {
		background: var(--background-primary);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
	}

	/* ═══ Install help ═══ */
	.install-help {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.install-help h4 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.install-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--background-modifier-border);
		margin-bottom: var(--size-4-3);
	}

	.install-tab {
		padding: 6px 16px;
		font-size: var(--font-ui-small);
		cursor: pointer;
		color: var(--text-muted);
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
		user-select: none;
	}

	.install-tab:hover {
		color: var(--text-normal);
	}

	.install-tab.is-active {
		color: var(--interactive-accent);
		border-bottom-color: var(--interactive-accent);
		font-weight: 600;
	}

	.install-content {
		font-size: var(--font-ui-small);
		line-height: var(--line-height-normal);
		max-height: 340px;
		overflow-y: auto;
		padding-right: var(--size-4-2);
	}

	/* Ensure smooth scrollbar styling across platforms */
	.install-content::-webkit-scrollbar {
		width: 6px;
	}

	.install-content::-webkit-scrollbar-thumb {
		background-color: var(--background-modifier-border);
		border-radius: var(--radius-s);
	}

	.install-content ol {
		margin: 0;
		padding-left: var(--size-4-5);
	}

	.install-content li {
		margin-bottom: var(--size-4-2);
	}

	.install-content pre {
		background: var(--background-primary);
		padding: var(--size-4-2);
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		font-size: 11px;
		overflow-x: auto;
		margin: var(--size-4-1) 0;
	}

	.install-note {
		margin-top: var(--size-4-3);
		padding: var(--size-4-2) var(--size-4-3);
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.06);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		line-height: 1.5;
	}

	.sandbox-intro {
		margin: 0 0 var(--size-4-3) 0;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* Clean typography sub-sections instead of nested boxes */
	.sandbox-section {
		margin-top: var(--size-4-4);
		font-size: var(--font-ui-smaller);
		line-height: 1.5;
	}

	.sandbox-section:first-of-type {
		margin-top: var(--size-4-2);
	}

	.sandbox-section > strong {
		color: var(--text-normal);
		display: block;
		margin-bottom: var(--size-4-2);
		font-size: var(--font-ui-small);
	}

	.sandbox-section p {
		margin: 0 0 var(--size-4-2) 0;
		color: var(--text-muted);
	}

	.sandbox-section pre {
		background: var(--background-secondary);
		padding: var(--size-4-2);
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		font-size: 11px;
		margin: 0;
	}

	.sandbox-steps {
		margin: var(--size-4-2) 0 0 0;
		padding-left: var(--size-4-4);
	}

	.sandbox-steps li {
		margin-bottom: var(--size-4-2);
		color: var(--text-muted);
	}

	.sandbox-steps li:last-child {
		margin-bottom: 0;
	}

	.sandbox-footnote {
		margin-top: 6px;
		padding: 6px 8px;
		background: var(--background-primary);
		border-left: 2px solid var(--interactive-accent);
		border-radius: 0 var(--radius-s) var(--radius-s) 0;
		font-size: 11px;
		color: var(--text-faint);
		line-height: 1.4;
	}

	.expanded-steps li {
		margin-bottom: var(--size-4-3);
	}

	.expanded-steps strong {
		color: var(--text-normal);
		font-weight: 600;
	}

	.step-hint {
		font-size: 11px;
		color: var(--text-faint);
		margin-top: 4px;
		font-style: italic;
	}



	.install-docs-link {
		margin-top: var(--size-4-3);
		font-size: var(--font-ui-smaller);
	}

	/* ═══ Optional dependency ═══ */
	.optional-dep {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-left: 4px solid var(--background-modifier-border-hover);
		border-radius: var(--radius-m);
		padding: var(--size-4-2) var(--size-4-3);
		margin-bottom: var(--size-4-4);
		font-size: var(--font-ui-small);
	}

	.optional-dep:has(.status-dot.is-active) {
		border-left-color: var(--text-success);
	}

	.optional-dep-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		margin-bottom: 4px;
	}

	.optional-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}

	.optional-dep-body {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		padding-left: 18px;
	}

	.optional-dep-body code {
		background: var(--background-primary);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
	}

	.version-text {
		color: var(--text-success);
		font-weight: 600;
		font-size: var(--font-ui-smaller);
	}

	/* ═══ Action row & Buttons ═══ */
	.action-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.action-row.centered {
		justify-content: center;
		gap: var(--size-4-3);
	}

	.action-buttons {
		display: flex;
		gap: var(--size-4-2);
	}

	.re-detect-btn, .next-btn {
		height: 32px;
		font-size: 13px;
		padding: 0 16px;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Default secondary styling for Re-detect when beanQueryValid is true */
	.re-detect-btn:not(.mod-cta) {
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
	}

	.re-detect-btn:not(.mod-cta):hover:not(:disabled) {
		background: var(--interactive-hover);
	}

	.skip-link {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		cursor: pointer;
		text-decoration: underline;
		transition: color 0.15s;
	}

	.skip-link:hover {
		color: var(--text-normal);
	}

	.next-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ═══ Step 2: Setup cards ═══ */
	.setup-cards-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.setup-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-l);
		padding: var(--size-4-4);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		position: relative;
		transition: all 0.2s ease-in-out;
	}

	.setup-card:hover {
		border-color: var(--interactive-accent);
		transform: translateY(-2px);
		background: var(--background-secondary-alt);
	}

	.setup-card.is-selected {
		border-color: var(--interactive-accent);
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.05);
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}

	.card-badge {
		position: absolute;
		top: -10px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-size: 9px;
		font-weight: bold;
		padding: 2px 8px;
		border-radius: 10px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.card-icon {
		font-size: 32px;
		margin-bottom: var(--size-4-2);
	}

	.setup-card h4 {
		margin: 0 0 var(--size-4-1) 0;
		color: var(--text-normal);
		font-size: var(--font-ui-medium);
	}

	.setup-card p {
		margin: 0;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		line-height: var(--line-height-normal);
	}

	/* ═══ Setup form ═══ */
	.setup-form {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.setting-item {
		border-top: none;
		border-bottom: 1px solid var(--background-modifier-border);
		padding: var(--size-4-3) 0;
	}

	.setting-item:last-of-type {
		border-bottom: none;
	}

	.setting-item-name {
		font-weight: 500;
	}

	input[type='text'], select {
		width: 100%;
		max-width: 220px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
	}

	input[type='text']:focus, select:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.setup-link {
		color: var(--text-accent);
		cursor: pointer;
		text-decoration: underline;
	}

	.setup-link:hover {
		color: var(--text-accent-hover);
	}

	.currency-hint {
		margin: var(--size-4-2) 0 0 0;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-style: italic;
	}

	/* ═══ Folder preview ═══ */
	.folder-preview {
		margin-top: var(--size-4-3);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.folder-preview h4 {
		margin: 0 0 var(--size-4-2) 0;
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}

	.tree {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-2) var(--size-4-3);
		font-family: var(--font-monospace);
		font-size: 11px;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.tree-line {
		white-space: pre;
	}

	.tree-more {
		color: var(--text-faint);
		font-style: italic;
	}

	/* ═══ Step 3: Success ═══ */
	.success-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-4);
		color: var(--text-success);
	}

	.success-banner h3 {
		margin: 0;
		font-size: var(--font-ui-large);
		color: var(--text-success);
	}

	.success-icon {
		font-size: 28px;
	}

	.summary-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-left: 4px solid var(--text-success);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.summary-card h4 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.summary-grid {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		font-size: var(--font-ui-small);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.summary-row:last-child {
		border-bottom: none;
	}

	.summary-label {
		color: var(--text-muted);
		font-weight: 500;
	}

	.summary-value {
		color: var(--text-normal);
	}

	.summary-value code {
		background: var(--background-primary);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		font-size: 11px;
	}

	.summary-value.currency {
		color: var(--text-success);
		font-weight: 600;
	}

	/* ═══ Next steps ═══ */
	.next-steps {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-4);
	}

	.next-steps h4 {
		margin: 0 0 var(--size-4-2) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.next-steps ol {
		margin: 0;
		padding-left: var(--size-4-5);
		font-size: var(--font-ui-small);
		line-height: var(--line-height-normal);
	}

	.next-steps li {
		margin-bottom: var(--size-4-1);
	}
</style>
