// src/lang/beancount-snippets.ts
// CodeMirror 6 snippet completions for Beancount directive keywords.
// Activates at the start of a line (column 0) when the user types a directive
// keyword prefix, and expands a fully-formed template with Tab-navigable
// placeholders via the @codemirror/autocomplete snippet() helper.

import {
    snippet,
    type CompletionContext,
    type CompletionResult,
    type Completion,
} from '@codemirror/autocomplete';
import type BeancountPlugin from '../main';

// ---------------------------------------------------------------------------
// Date helper — returns today as YYYY-MM-DD
// ---------------------------------------------------------------------------

function todayStr(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Snippet definitions
// Each `apply` function is built from snippet() so CM6 handles placeholder
// navigation with Tab automatically.
// ---------------------------------------------------------------------------

function makeSnippets(): Completion[] {
    const today = todayStr();

    return [
        {
            label: 'txn',
            detail: 'transaction snippet',
            type: 'keyword',
            info: 'Expand a full transaction block',
            apply: snippet(
                `${today} * "\${payee}" "\${narration}"\n` +
                `  \${1:Assets:Checking}       \${2:-0.00} \${3:USD}\n` +
                `  \${4:Expenses:Uncategorized}`
            ),
            boost: 10,
        },
        {
            label: 'open',
            detail: 'open account snippet',
            type: 'keyword',
            info: 'Expand an open directive',
            apply: snippet(
                `${today} open \${1:Assets:Checking} \${2:USD}`
            ),
            boost: 10,
        },
        {
            label: 'close',
            detail: 'close account snippet',
            type: 'keyword',
            info: 'Expand a close directive',
            apply: snippet(
                `${today} close \${1:Assets:Checking}`
            ),
            boost: 10,
        },
        {
            label: 'bal',
            detail: 'balance assertion snippet',
            type: 'keyword',
            info: 'Expand a balance directive',
            apply: snippet(
                `${today} balance \${1:Assets:Checking}   \${2:0.00} \${3:USD}`
            ),
            boost: 10,
        },
        {
            label: 'pad',
            detail: 'pad directive snippet',
            type: 'keyword',
            info: 'Expand a pad directive',
            apply: snippet(
                `${today} pad \${1:Assets:Checking} \${2:Equity:Opening-Balances}`
            ),
            boost: 10,
        },
        {
            label: 'price',
            detail: 'price directive snippet',
            type: 'keyword',
            info: 'Expand a price directive',
            apply: snippet(
                `${today} price \${1:USD} \${2:1.00} \${3:EUR}`
            ),
            boost: 10,
        },
        {
            label: 'note',
            detail: 'note directive snippet',
            type: 'keyword',
            info: 'Expand a note directive',
            apply: snippet(
                `${today} note \${1:Assets:Checking} "\${2:memo}"`
            ),
            boost: 10,
        },
    ];
}

// ---------------------------------------------------------------------------
// CompletionSource — only fires at column 0 (start of line)
// ---------------------------------------------------------------------------

/**
 * Raw CompletionSource for directive snippet templates.
 * Activates only when the cursor is at the very beginning of a line
 * (no leading whitespace before the typed keyword).
 * Exported for composition into a shared autocompletion() extension.
 */
export function beancountSnippetSource(context: CompletionContext): CompletionResult | null {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);

    // Only activate when cursor is at the very start of the line content
    const lineUpToCursor = line.text.slice(0, pos - line.from);
    const matchAtStart = lineUpToCursor.match(/^([a-z]*)$/);
    if (!matchAtStart) return null;

    const typed = matchAtStart[1];
    const snippets = makeSnippets();
    const options = snippets.filter((s) =>
        (s.label).startsWith(typed)
    );

    if (options.length === 0) return null;

    return {
        from: line.from,
        options,
        filter: false,
    };
}

// ---------------------------------------------------------------------------
// User-Defined Transaction Snippets
// ---------------------------------------------------------------------------

/**
 * Parses user-defined snippet transactions from the contents of snippets.beancount.
 * Extracts the Snippet metadata value as the suggestion label, updates the date
 * to today's date, and strips the Snippet metadata line.
 */
export function parseSnippetsFile(fileContent: string): Completion[] {
    const completions: Completion[] = [];
    const lines = fileContent.split(/\r?\n/);
    
    let currentTxnLines: string[] = [];
    let currentSnippetName: string | null = null;
    let insideTxn = false;

    // Helper to get today's date format (YYYY-MM-DD)
    const today = todayStr();

    const finalizeTxn = () => {
        if (currentTxnLines.length > 0 && currentSnippetName) {
            const cleanedLines: string[] = [];
            
            // First line processing: replace the date prefix (YYYY-MM-DD) with today's date
            const firstLine = currentTxnLines[0];
            const dateRegex = /^(\d{4}-\d{2}-\d{2})/;
            const updatedFirstLine = firstLine.replace(dateRegex, today);
            cleanedLines.push(updatedFirstLine);

            for (let i = 1; i < currentTxnLines.length; i++) {
                const line = currentTxnLines[i];
                // Check if this line is the Snippet metadata definition
                if (/^\s*Snippet:\s*/i.test(line)) {
                    continue; // Skip the Snippet metadata line
                }
                cleanedLines.push(line);
            }

            const template = cleanedLines.join('\n');

            completions.push({
                label: currentSnippetName,
                detail: 'snippet',
                type: 'keyword',
                info: `Snippet: ${currentSnippetName}\n\n${template}`,
                apply: snippet(template),
                boost: 9,
            });
        }
        currentTxnLines = [];
        currentSnippetName = null;
        insideTxn = false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeader = /^\d{4}-\d{2}-\d{2}/.test(line);

        if (isHeader) {
            if (insideTxn) {
                finalizeTxn();
            }
            insideTxn = true;
            currentTxnLines.push(line);
        } else if (insideTxn) {
            const trimmed = line.trim();
            const startsWithWhitespace = /^\s/.test(line);
            
            if (startsWithWhitespace || trimmed === '' || trimmed.startsWith(';')) {
                currentTxnLines.push(line);
                
                // Extract snippet name from Metadata
                const match = line.match(/^\s*Snippet:\s*(.+)$/i);
                if (match) {
                    let name = match[1].trim();
                    if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'"))) {
                        name = name.slice(1, -1);
                    }
                    currentSnippetName = name;
                }
            } else {
                finalizeTxn();
            }
        }
    }
    
    finalizeTxn();

    return completions;
}

/**
 * CompletionSource for user-defined transaction snippets.
 * Activates when the cursor is at the very beginning of a line.
 */
export function beancountUserSnippetSource(plugin: BeancountPlugin) {
    return (context: CompletionContext): CompletionResult | null => {
        const { state, pos } = context;
        const line = state.doc.lineAt(pos);

        // Only activate when cursor is at the very start of the line content
        const lineUpToCursor = line.text.slice(0, pos - line.from);
        const matchAtStart = lineUpToCursor.match(/^([a-zA-Z0-9_-]*)$/);
        if (!matchAtStart) return null;

        const typed = matchAtStart[1];
        const snippets = plugin.snippetCompletions || [];
        const options = snippets.filter((s) =>
            s.label.toLowerCase().startsWith(typed.toLowerCase())
        );

        if (options.length === 0) return null;

        return {
            from: line.from,
            options,
            filter: false,
        };
    };
}
