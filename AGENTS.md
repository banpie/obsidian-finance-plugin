# AGENTS.md

## Branch Management

- `master` tracks `mkshp-dev/master`. Keep it clean and fast-forward it from `upstream/master`; do not do feature work directly on `master`.
- `codex/local-current` is Banpie's personal integration branch. It should include the latest upstream `master` plus Banpie's local optimizations.
- Before creating a branch, fetch all remotes with `git fetch origin --prune` and check whether a topic branch already exists.
- Reuse the existing topic branch when one matches the work area. For Reports work, use `codex/reports-dashboard`.
- Create each new optimization on a dedicated `codex/<topic>` branch from `codex/local-current` only when no suitable existing topic branch exists and the work depends on Banpie's integrated local improvements.
- Create upstream-facing PR branches from `master` when the change can be isolated cleanly for `mkshp-dev/obsidian-finance-plugin`.
- Do not open upstream PRs directly from `codex/local-current` unless the intent is to submit every accumulated local optimization in that branch.
- After upstream `master` changes, sync `master` first, then merge `upstream/master` into `codex/local-current`, resolve conflicts, build, and push.
- After a feature branch is validated, merge it back into `codex/local-current`, build, push `codex/local-current`, and deploy that branch to Banpie's local Obsidian plugin directory for testing.
- Banpie's Obsidian test version always comes from `codex/local-current`, not from an isolated feature branch.
- Use `/Users/banpie/dev/banpie-skills/obsidian-finance-plugin-deploy/scripts/deploy-local.mjs` for local deployment. Do not add machine-specific deploy scripts, package scripts, vault paths, or plugin paths to this repository.
- If the same feature should be proposed upstream, prepare a separate minimal PR branch from `master` or cherry-pick the relevant commits after Banpie has tested the `codex/local-current` deployment.

Current feature branch:

- `codex/investment-cost-basis` is for making investment holding cost basis easier to inspect.

## Investment Cost Basis Direction

- Treat commodity metadata and investment holdings separately. The Commodity dashboard includes currencies, prices, logos, and exchange-rate-like commodities; many of these do not have a meaningful holding cost basis.
- Show cost basis in investment-oriented views, especially Reports -> Assets -> Investment holdings, rather than assuming every commodity has cost.
- Derive holding cost basis from Beancount investment postings and their cost annotations, scoped to asset investment accounts and the selected as-of date.
- If a holding has no cost annotation or uses mixed cost currencies, show an explicit unavailable state instead of a misleading zero.
- Useful columns for investment holding rows: current value, quantity, total cost basis, average unit cost, unrealized gain/loss, gain/loss percent, and a cost status.
- Keep row click-through transaction details; they already expose per-transaction unit cost and cost basis, and can be reused to explain aggregate numbers.
