# AGENTS.md

## Branch Management

- `master` tracks `mkshp-dev/master`. Keep it clean and fast-forward it from `upstream/master`; do not do feature work directly on `master`.
- `codex/local-current` is Banpie's personal integration and deployment branch. It should include the latest upstream `master` plus Banpie's validated local optimizations; do not develop patches directly on it.
- Before starting any code, documentation, build, or configuration patch, fetch all remotes with `git fetch origin --prune` and `git fetch upstream --prune`, then update the local base without discarding unrelated work.
- Start every distinct patch on a new dedicated `codex/<topic>` branch from the current `codex/local-current`. Reuse a topic branch only when continuing the same unfinished patch; sharing a work area such as Reports is not enough reason to reuse an old branch.
- If the current worktree has unrelated changes, preserve them and use a separate Git worktree for the new patch. Never stage, amend, reset, or overwrite another patch's files to make the branch switch easier.
- Create upstream-facing PR branches from `master` when the change can be isolated cleanly for `mkshp-dev/obsidian-finance-plugin`.
- Do not open upstream PRs directly from `codex/local-current` unless the intent is to submit every accumulated local optimization in that branch.
- After upstream `master` changes, sync `master` first, then merge `upstream/master` into `codex/local-current`, resolve conflicts, build, and push.
- After a patch branch is validated, push the topic branch, merge it into `codex/local-current` with a merge commit, run the checks appropriate to the changed files, build when runtime code changed, push `codex/local-current`, and deploy that integration branch for testing.
- Banpie's Obsidian test version always comes from `codex/local-current`, not from an isolated feature branch.
- Use `/Users/banpie/dev/banpie-skills/obsidian-finance-plugin-deploy/scripts/deploy-local.mjs` for local deployment. Do not add machine-specific deploy scripts, package scripts, vault paths, or plugin paths to this repository.
- If the same feature should be proposed upstream, prepare a separate minimal PR branch from `master` or cherry-pick the relevant commits after Banpie has tested the `codex/local-current` deployment.

## Cross-device Source and Deployment

- `/Users/banpie/dev/obsidian-finance-plugin` is a machine-local source checkout. Git remotes synchronize its commits; iCloud does not synchronize this `dev` repository between the iMac and MacBook Pro.
- The Beancount ledger and other Vault data under iCloud Drive can synchronize as data. Treat iCloud completion and conflict handling separately from source-code deployment.
- `.obsidian/plugins/beancount-finance` inside the iCloud Vault contains generated runtime artifacts, not the plugin source of truth. Their arrival on another Mac does not prove that its source checkout, running Obsidian process, or loaded plugin version is current.
- Before deploying on any Mac, identify the actual execution host with `scutil --get ComputerName` and `hostname`; do not infer it from the computer through which a remote session is viewed. Report which host was updated and which hosts still need local synchronization.
- On each Mac that runs or edits the plugin, update `codex/local-current` with a fast-forward-only pull, run the shared deployment script locally, reload Obsidian, and perform a focused smoke test. If that Mac has unrelated source changes, preserve them and stop before a pull or merge that would overwrite them.
- Never let a stale checkout deploy over the shared iCloud runtime directory. Pull and verify `codex/local-current` before every local deployment, and do not treat iCloud synchronization alone as a plugin reload.

## Investment Cost Basis Direction

- Treat commodity metadata and investment holdings separately. The Commodity dashboard includes currencies, prices, logos, and exchange-rate-like commodities; many of these do not have a meaningful holding cost basis.
- Show cost basis in investment-oriented views, especially Reports -> Assets -> Investment holdings, rather than assuming every commodity has cost.
- Derive holding cost basis from Beancount investment postings and their cost annotations, scoped to asset investment accounts and the selected as-of date.
- Preserve the original cost currency in explanatory UI when an investment was bought in a foreign currency, then show the report-currency conversion for portfolio totals.
- If a holding has no cost annotation or uses mixed cost currencies, show an explicit unavailable state instead of a misleading zero.
- Useful columns for investment holding rows: current value, quantity, total cost basis, average unit cost, unrealized gain/loss, gain/loss percent, and a cost status.
- Keep row click-through transaction details; they already expose per-transaction unit cost and cost basis, and can be reused to explain aggregate numbers.
