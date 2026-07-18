---
sidebar_position: 1
---

# Requirements

Before you can use Beancount Ledger, you need to set up the underlying Python and Beancount dependencies on your machine. This guide covers the required software and how to install them on any major operating system.

---

## 📋 System Prerequisites

The plugin requires the following command-line tools to be available:

1.  **Python 3.8 or newer**: The runtime environment for executing Beancount.
2.  **Beancount v3 or newer**: The main plain-text accounting engine.
3.  **bean-query** (via `beanquery`): The query tool for BQL execution. Starting with Beancount v3, `beanquery` is distributed as a separate package and must be installed explicitly.
4.  **bean-price** *(Optional)*: The automated price-fetching tool, distributed as `beanprice`.

---

## 💻 OS-Specific Installation Guide

Select the instructions corresponding to your operating system below:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="windows" label="Windows" default>

### Step 1: Install Python

Download and run the installer from the [official Python downloads page](https://www.python.org/downloads/windows/).

:::important
During installation, make sure to check the box **"Add Python.exe to PATH"**.
:::

### Step 2: Install beancount and tools

Open PowerShell or Command Prompt and run:
```powershell
pip install beancount beanquery beanprice
```

### Step 3: Find where bean-query was installed

Run this command in PowerShell:
```powershell
Get-Command bean-query | Select-Object -ExpandProperty Source
```
Save the full path from the output (e.g., `C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python3X\Scripts\bean-query.exe`).

### Step 4: Restart Obsidian

Close and reopen Obsidian completely so it can pick up any changes to your PATH environment variable.

### Step 5: Configure your plugin

In the plugin settings, set the **bean-query path** to the full path you found in Step 3:
```
C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python3X\Scripts\bean-query.exe
```

:::tip
If you added Python to your PATH correctly, you may also try just `bean-query` as the command. However, using the full path is always safer.
:::

### Step 6: Test

Verify it works by running your plugin's bean-query functionality. You can also confirm the installation in PowerShell:
```powershell
python --version
bean-check --version
bean-query --version
bean-price --version
```

  </TabItem>
  <TabItem value="macos" label="macOS">

### Step 1: Install Homebrew (if needed)

If you don't already have Homebrew, install it by running the following in Terminal:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Or visit [brew.sh](https://brew.sh) for more details.

### Step 2: Install Python

```bash
brew install python
```

### Step 3: Install beancount and tools

```bash
pip3 install beancount beanquery beanprice
```

### Step 4: Find where bean-query was installed

```bash
which bean-query
```
Save the output (e.g., `/opt/homebrew/bin/bean-query` or `/usr/local/bin/bean-query`).

### Step 5: Restart Obsidian

Close and reopen Obsidian completely.

### Step 6: Configure your plugin

In the plugin settings, set the **bean-query path** to the full path from Step 4:
```
/opt/homebrew/bin/bean-query
```

### Step 7: Test

Verify it works by running your plugin's bean-query functionality. You can also confirm the installation in Terminal:
```bash
python3 --version
bean-check --version
bean-query --version
bean-price --version
```

  </TabItem>
  <TabItem value="linux" label="Linux">

### Step 1: Install Python and Pip

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**Fedora/RHEL:**
```bash
sudo dnf install python3 python3-pip
```

**Arch:**
```bash
sudo pacman -S python python-pip
```

### Step 2: Install beancount and tools

```bash
pip3 install beancount beanquery beanprice
```

:::note
If you get a permissions error, use the `--user` flag: `pip3 install --user beancount beanquery beanprice`
:::

### Step 3: Find where bean-query was installed

```bash
which bean-query
```
Save the output. For example: `~/.local/bin/bean-query` or `/usr/local/bin/bean-query`.

### Step 4: Restart Obsidian

Close and reopen Obsidian completely.

### Step 5: Configure your plugin

In the plugin settings, set the **bean-query path** to the full path from Step 3:
```
~/.local/bin/bean-query
```

### Step 6: Test

Verify it works by running your plugin's bean-query functionality. You can also confirm the installation in your terminal:
```bash
python3 --version
bean-check --version
bean-query --version
bean-price --version
```

  </TabItem>
  <TabItem value="wsl" label="WSL">

### Step 1: Open your WSL terminal

Open your WSL terminal (e.g. Ubuntu on Windows).

### Step 2: Install Python and Pip

```bash
sudo apt update
sudo apt install python3 python3-pip
```

### Step 3: Install beancount and tools

```bash
pip3 install beancount beanquery beanprice
```

### Step 4: Find where bean-query was installed

```bash
which bean-query
```
Save the output (e.g., `~/.local/bin/bean-query` or `/usr/local/bin/bean-query`).

### Step 5: Restart Obsidian

Close and reopen Obsidian completely. The plugin will automatically detect WSL on startup and run commands through `wsl <command>`.

:::important
Your vault and files must be accessible within WSL (e.g., located under `/mnt/c/Users/...`). Files stored only in the Windows filesystem are accessible at `/mnt/c/`, while files stored inside WSL are typically not directly accessible from Windows.
:::

### Step 6: Configure your plugin

In the plugin settings, set the **bean-query path** to the full path from Step 4:
```
~/.local/bin/bean-query
```

### Step 7: Test

Verify it works by running your plugin's bean-query functionality.

  </TabItem>
  <TabItem value="linux-flatpak" label="Linux (Flatpak)">

:::note
This guide is for users running Obsidian as a **Flatpak** package. Because Flatpak apps run in a sandbox, Obsidian cannot see system binaries by default. The extra step below grants Obsidian access to your `bean-query` binary.
:::

### Step 1: Install beancount and tools

Install via **pip** (recommended — installs Beancount v3 and `beanquery`):
```bash
pip install --user beancount beanquery beanprice
```

Or via your **system package manager** (installs Beancount v2 only — `beanquery` must still be installed via pip separately):

**Ubuntu/Debian:**
```bash
sudo apt-get install beancount
pip install --user beanquery beanprice
```

**Fedora/RHEL:**
```bash
sudo dnf install beancount
pip install --user beanquery beanprice
```

**Arch:**
```bash
sudo pacman -S beancount
pip install --user beanquery beanprice
```

Or via **conda** (if you have it):
```bash
conda install -c conda-forge beancount beanquery
```

### Step 2: Find where bean-query was installed

```bash
which bean-query
```

Save the output. For example:
- If using pip (user install): `~/.local/bin/bean-query`
- If using system apt: `/usr/bin/bean-query`
- If using conda: `~/miniconda3/bin/bean-query`

### Step 3: Grant Obsidian access to bean-query

Run `flatpak override` to allow Obsidian access to the **directory** containing `bean-query` (replace with the directory portion from Step 2):

```bash
sudo flatpak override --filesystem=/path/to/bin md.obsidian.Obsidian
```

**Examples:**
```bash
# If it's in ~/.local/bin
sudo flatpak override --filesystem=~/.local/bin md.obsidian.Obsidian

# If it's in /usr/bin
sudo flatpak override --filesystem=/usr/bin md.obsidian.Obsidian

# If it's in ~/miniconda3/bin
sudo flatpak override --filesystem=~/miniconda3/bin md.obsidian.Obsidian
```

### Step 4: Restart Obsidian

Close and reopen Obsidian completely.

### Step 5: Configure your plugin

In the plugin settings, set the **bean-query path** to the **full path** of the `bean-query` binary from Step 2:

```
~/.local/bin/bean-query
```

### Step 6: Test

Verify it works by running your plugin's bean-query functionality.

  </TabItem>
</Tabs>
