---
sidebar_position: 3
---

# First-Time Setup

This guide walks you through the **3-step onboarding wizard** that appears when you first enable the plugin.

## 🚀 Launching the Onboarding

The **Onboarding Modal** appears automatically when:
- You enable the plugin for the first time
- No Beancount file is configured in settings

**Manual Launch:**
Open Command Palette (`Ctrl/Cmd + P`) → **"Obsidian Finance: Run Setup/Onboarding"**

![Onboarding Welcome](/img/Onboarding-modal1.png)

---

## Step 1: Connect 🔌

The plugin uses **`bean-query`** (a command-line tool from the Beancount ecosystem) to query your financial data. Obsidian must be able to detect and execute it.

### Required & Optional Components

- **`bean-query` (Required):** Essential for running BQL queries and powering the financial dashboard.
- **`bean-price` (Optional):** Used for automatic commodity price fetching.

### Detection & Manual Verification

1. **Automatic Detection:** Upon opening Step 1, the plugin automatically scans your system environment for `bean-query` and `bean-price`.
2. **Manual Entry:** If automatic detection fails, you can enter your exact executable command or absolute file path into the command input box.
   - *Common Command Values:* `bean-query`, `wsl bean-query`, `/home/user/.local/bin/bean-query`, `/opt/homebrew/bin/bean-query`
3. **Verify:** Click the **Verify** button to test execution and check the version output immediately.

![Connect Onboarding Step](/img/Onboarding-checkingPreRequisites.png)

### In-Modal Installation Guides ("📦 How to install")

For convenience, Step 1 includes tabbed installation instructions directly inside the onboarding wizard:

#### 🪟 Windows
1. Install [Python 3.8+](https://www.python.org/downloads/) (make sure to check **"Add Python to PATH"** during installation).
2. Open PowerShell and run:
   ```powershell
   pip install beancount beanquery beanprice
   ```
3. Verify in PowerShell: `bean-query --version`
4. **WSL Users:** If you prefer running Beancount inside WSL, install it in your WSL distro and set `wsl bean-query` as your command.

#### 🍎 macOS
1. Open Terminal and run:
   ```bash
   pip3 install beancount beanquery beanprice
   ```
2. Verify in Terminal: `bean-query --version`
3. **PATH Note for GUI Apps:** macOS GUI applications do not automatically inherit `~/.local/bin` from your shell. If auto-detection fails, enter your full absolute path (e.g., `/Users/<your-username>/.local/bin/bean-query`). Find it in Terminal with `which bean-query`.

#### 🐧 Linux (AppImage / Deb)
1. Open terminal and install via `pip` (recommended):
   ```bash
   pip install --user beancount beanquery beanprice
   ```
2. Verify in terminal: `bean-query --version`
3. **System Packages Note:** Installing Beancount via system package managers (`apt`, `dnf`, `pacman`) often installs Beancount v2. You must install `beanquery` via `pip` separately.

#### 📦 Linux (Flatpak / Snap)

**Flatpak (Recommended Setup):**
1. Install packages via pip on host machine:
   ```bash
   pip install --user beancount beanquery beanprice
   ```
2. Find binary path by running `which bean-query` in terminal (e.g., `~/.local/bin/bean-query`).
3. Grant Obsidian filesystem access to that directory using `flatpak override`:
   ```bash
   sudo flatpak override --filesystem=~/.local/bin md.obsidian.Obsidian
   ```
4. Restart Obsidian completely so the Flatpak sandbox recognizes the filesystem permission change.
5. Enter the full path (e.g., `/home/user/.local/bin/bean-query`) into the command box in Step 1 and click **Verify**.

**Snap:**
1. Find absolute path on host running `which bean-query`.
2. Enter full path into command box and click **Verify**.
3. **Confinement Note:** If strictly confined Snap blocks host CLI execution, switch to the official AppImage or Flatpak release.

### Step Controls

- **Re-detect:** Re-scans your system environment for `bean-query` and `bean-price`.
- **Skip for now:** Bypasses CLI verification so you can proceed with setting up your ledger folder (*Note: Dashboard features require `bean-query` to be configured later in Settings → Connection*).
- **Next: Organize →:** Proceeds to Step 2.

---

## Step 2: Organize 📁

Choose how to start and configure your structured ledger folder layout. All your finance files will be organized inside a single folder in your vault.

![File Setup Section](/img/Onboarding-FileSetup_topPart.png)

### Data Choice Options

#### 📊 Option 1: Start with Demo Data (Recommended for beginners)
- A complete sample ledger with realistic accounts, commodities, and transactions.
- Allows you to explore the dashboard immediately without existing files.
- Includes sample checking, savings, credit card, investment, income, and expense entries.

#### 📁 Option 2: Use My Existing Ledger
- Select an existing `.beancount` file in your vault (or enter a path manually) to migrate it into the structured folder layout.
- *Note:* Requires `bean-query` to be configured and verified in Step 1.

### Configuration Options

1. **Folder name:** Specifies the vault folder where organized finance files live (default: `Finances`).
2. **Transaction file period:** Choose how transaction files are grouped inside `transactions/`:
   - **Yearly:** `Finances/transactions/2026.beancount`
   - **Monthly:** `Finances/transactions/2026/2026-07.beancount`
3. **Operating currency:** Primary currency for your records (e.g. `USD`, `EUR`, `GBP`).
4. **Folder structure preview:** Live tree view showing exact files and directories that will be created.

---

## Step 3: Ready 🎉

After setup completes, Step 3 displays a success screen and configuration summary:

![Verification Summary](/img/Onboarding-verification_topPart.png)

### Configuration Summary

- **bean-query Command & Version**
- **bean-price Status** (Command or Not Configured)
- **Structured Folder Location**
- **Data Source** (Demo Data or Existing Ledger)
- **Operating Currency**
- **Transaction Period** (Yearly or Monthly)

Click **"🚀 Open Dashboard"** to finish setup and launch the unified Obsidian Finance dashboard!

---

## Structured Layout

Both options create a **structured folder layout** by default. This modern organization approach keeps your ledger maintainable as it grows.

**Why Structured Layout?**
- **Organized**: Directives grouped by type
- **Scalable**: Works well for ledgers of any size
- **Navigable**: Easy to find specific entries
- **Version Control**: Better git diffs and merge handling
- **Collaborative**: Multiple people can work on different files

**Folder Structure Created:**
```
Finances/                      # Your chosen folder name
├── ledger.beancount          # Main file (includes all others)
├── accounts.beancount        # Account opening directives
├── commodities.beancount     # Commodity declarations
├── prices.beancount          # Price directives
├── balances.beancount        # Balance assertions
├── pads.beancount           # Pad directives
├── notes.beancount          # Note directives
├── events.beancount         # Event directives
└── transactions/            # Transaction files by period
    ├── 2024.beancount
    ├── 2025.beancount
    └── 2026.beancount
```

## 🔄 Re-running Onboarding

You can run the onboarding wizard anytime:

1. Open Command Palette (`Ctrl/Cmd + P`)
2. Type **"Obsidian Finance: Run Setup/Onboarding"**
3. Follow the wizard to reconfigure or start fresh

**Use Cases:**
- Switching from demo data to real data
- Changing folder names or organization
- Importing a different ledger file
- Re-detecting or updating `bean-query` / `bean-price` commands

## ⚙️ Post-Setup Configuration

After onboarding completes:

### Verify Connection
1. Open **Settings → Beancount Ledger → Connection**
2. Check for green checkmarks on all tests
3. If any tests fail, review the [Troubleshooting Guide](../troubleshooting.md)

### Configure Preferences
- **Operating Currency**: Set your default currency (USD, EUR, etc.)
- **Automatic Price Fetching**: If `bean-price` was detected, enable this in **Settings → General** to keep commodity prices up to date automatically
- **Performance**: Adjust limits based on your ledger size
- **BQL**: Configure query display preferences
- **Backups**: Enable automatic backups (recommended)

---

## 🎓 Learning Path

### For New Beancount Users

1. **Start with Demo Data**: Explore the sample ledger
2. **Open Dashboard**: See your financial overview
3. **Examine Transactions**: Look at the demo entries in the Journal tab
4. **Try Editing**: Modify a demo transaction to understand the workflow
5. **Learn BQL**: Execute some sample queries
6. **Read Beancount Docs**: Visit [Beancount Documentation](https://beancount.github.io/docs/)

### For Existing Beancount Users

1. **Point to Your Ledger**: Use existing file option
2. **Test Connection**: Ensure `bean-query` works
3. **Explore Dashboard**: See your real data visualized
4. **Try Features**: Test transaction editing, BQL queries
5. **Consider Migration**: Optionally migrate to structured layout
6. **Customize Settings**: Adjust to your preferences

---

## 💡 Tips

**Demo Data:**
- Safe to experiment with - can't hurt your real finances
- Delete the demo folder anytime: just remove `Finances/` folder
- Great reference for Beancount syntax examples

**File Paths:**
- Use absolute paths for reliability
- WSL users: use `wsl bean-query` command and Linux-style paths
- Inside vault: plugin handles path conversion automatically

**Structured Layout:**
- Organized by directive type for better maintainability
- Recommended for all ledgers, especially those with > 500 transactions
- Easy to navigate and version control

---

## 🆘 Troubleshooting Onboarding

### Onboarding Modal Doesn't Appear
- Check if onboarding is already completed in settings
- Manually run: Command Palette → **"Obsidian Finance: Run Setup/Onboarding"**

### File Path Invalid
- Ensure the file exists and has `.beancount` extension
- Check file permissions (readable by Obsidian)
- For WSL: verify path format is correct

### Bean-query Not Found
- Install Beancount & beanquery: `pip install beancount beanquery`
- Verify installation: `bean-query --version` in terminal
- Set manual path in Connection settings or Step 1 manual command input if auto-detect fails
- If using Flatpak, grant filesystem permission via `flatpak override --filesystem=...`

For more help, see the [Troubleshooting Guide](../troubleshooting.md).
