---
sidebar_position: 3
---

# Journal Tab

![Journal Tab](/img/JournalTab.png)

The **Journal Tab** provides a comprehensive chronological log of every directive inside your ledger—similar to the interface offered by Fava.

---

## 📋 Features

### Complete Entry Stream
Unlike the Transactions tab which focuses solely on postings, the Journal view displays **all** Beancount directive types in a unified stream:
*   **Transactions**: Standard double-entry entries.
*   **Notes**: Informational text notes attached to accounts.
*   **Balance Assertions**: Reconciliations asserting account balances.
*   **Other Directives**: Events, commodity declarations, document linkages, etc.

### Full Management Capabilities
Action buttons are compact, icon-only layouts tailored to each directive type:
*   **View Details**: Click any card/entry to expand it and see full metadata, tags, and file locations.
*   **Edit (✏️)**: Open the directive in the transaction modal or editor. You can also right-click to open the file editor directly.
*   **Save as Snippet (📋)**: *(Transactions only)* Save the selected transaction as a template to `snippets.beancount` under a custom name for easy replication later.
*   **Delete (❌)**: Safely delete directives directly from the stream (requires confirmation).
*   **Live Search**: Instantly filters entries as you type in the search bar.

### Advanced Filtering
*   **Date Range**: Filter entries by start and end dates.
*   **Account Filter**: Display only entries involving a specific account subtree.
*   **Entry Type**: Toggle checkboxes to show/hide specific directive types (Transactions, Notes, Balances).


