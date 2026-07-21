<!-- src/ui/modals/onboarding/InstallationHelp.svelte -->
<script lang="ts">
	export let activeInstallTab: 'windows' | 'macos' | 'linux-native' | 'linux-sandbox' = 'windows';
</script>

<div class="install-help">
	<h4>📦 How to install</h4>

	<!-- Platform tabs -->
	<div class="install-tabs">
		<button class="install-tab" class:is-active={activeInstallTab === 'windows'} on:click={() => activeInstallTab = 'windows'}>Windows</button>
		<button class="install-tab" class:is-active={activeInstallTab === 'macos'} on:click={() => activeInstallTab = 'macos'}>macOS</button>
		<button class="install-tab" class:is-active={activeInstallTab === 'linux-native'} on:click={() => activeInstallTab = 'linux-native'}>Linux (AppImage / Deb)</button>
		<button class="install-tab" class:is-active={activeInstallTab === 'linux-sandbox'} on:click={() => activeInstallTab = 'linux-sandbox'}>Linux (Flatpak / Snap)</button>
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

<style>
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
		background: transparent;
		border: none;
		box-shadow: none;
		border-radius: 0;
		font-family: inherit;
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

	.sandbox-steps {
		margin: var(--size-4-2) 0 0 0;
		padding-left: var(--size-4-4);
	}

	.sandbox-steps li {
		margin-bottom: var(--size-4-2);
		color: var(--text-muted);
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
</style>
