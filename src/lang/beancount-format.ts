// src/lang/beancount-format.ts
// Pure formatting function and CodeMirror command for Beancount files.
//
// formatBeancount(text):
//   • Normalises posting indentation to exactly 2 spaces
//   • Right-aligns amounts within each transaction block (column alignment)
//   • Normalises spacing around @ and @@ price annotations
//   • Preserves blank lines between transactions / directives

import type { EditorView } from '@codemirror/view';

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/** A posting line: optional whitespace, account name, optional amount+currency */
const POSTING_LINE_RE = /^(\s+)([A-Z][A-Za-z0-9]*(?::[A-Za-z0-9][A-Za-z0-9_-]*)*)(\s+.*)?$/;

/** A directive-start line (date YYYY-MM-DD or special keywords) */
const DIRECTIVE_START_RE = /^(?:\d{4}-\d{2}-\d{2}|option\b|plugin\b|include\b|pushtag\b|poptag\b|query\b|custom\b)/;

/** Match the numeric amount part: e.g. "  -1,234.56 USD" */
const AMOUNT_RE = /^(\s*)(-?[\d,]+(?:\.\d+)?)(\s+)([A-Z][A-Z0-9'._-]*)(.*)$/;

/** Match @ or @@ price annotation (possibly with extra spaces) */
const PRICE_RE  = /\s*(@{1,2})\s*/g;

// ---------------------------------------------------------------------------
// Block splitting — a "block" is a group of lines separated by blank lines
// ---------------------------------------------------------------------------

function splitIntoBlocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let current: string[] = [];
    for (const line of lines) {
        if (line.trim() === '') {
            if (current.length > 0) {
                blocks.push(current);
                current = [];
            }
            blocks.push([line]); // preserve the blank line as its own block
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) blocks.push(current);
    return blocks;
}

// ---------------------------------------------------------------------------
// Per-block formatting
// ---------------------------------------------------------------------------

/**
 * Returns true if the block looks like a transaction (first line is a date directive
 * with a flag * or ! and has posting lines beneath it).
 */
function isTransactionBlock(block: string[]): boolean {
    if (block.length < 2) return false;
    return /^\d{4}-\d{2}-\d{2}\s+[*!]/.test(block[0]);
}

/**
 * Format a single transaction block:
 *   1. Keep the header line as-is (date + flag + payee/narration)
 *   2. Normalise posting indent to exactly 2 spaces
 *   3. Right-align amounts to the widest amount column within the block
 *   4. Normalise @ / @@ spacing
 */
function formatTransactionBlock(block: string[]): string[] {
    const [header, ...rest] = block;

    // Parse each posting line into components
    interface Posting {
        raw: string;
        account: string;
        amountStr: string | null;
        currency: string | null;
        tail: string;          // everything after currency (cost, price annotation, comments)
        isComment: boolean;
        isBlank: boolean;
    }

    const postings: Posting[] = rest.map((line) => {
        if (line.trim() === '') return { raw: line, account: '', amountStr: null, currency: null, tail: '', isComment: false, isBlank: true };
        if (line.trimStart().startsWith(';')) return { raw: line, account: line.trimStart(), amountStr: null, currency: null, tail: '', isComment: true, isBlank: false };

        const postingMatch = POSTING_LINE_RE.exec(line);
        if (!postingMatch) return { raw: line, account: line.trimStart(), amountStr: null, currency: null, tail: '', isComment: false, isBlank: false };

        const account = postingMatch[2];
        const afterAccount = (postingMatch[3] ?? '').trim();

        // Try to parse amount + currency from afterAccount
        const amountMatch = AMOUNT_RE.exec(` ${afterAccount}`);
        if (amountMatch) {
            const amountStr = amountMatch[2];
            const currency = amountMatch[4];
            let tail = amountMatch[5].trim();
            // Normalise @ and @@ spacing
            tail = tail.replace(/\s*(@{1,2})\s*/g, ' $1 ').trim();
            return { raw: line, account, amountStr, currency, tail, isComment: false, isBlank: false };
        }

        // No amount: account-only posting or metadata
        return { raw: line, account: afterAccount ? `${account} ${afterAccount}` : account, amountStr: null, currency: null, tail: '', isComment: false, isBlank: false };
    });

    // Find the widest account name among postings that have amounts
    let maxAccountLen = 0;
    for (const p of postings) {
        if (p.amountStr !== null && !p.isComment && !p.isBlank) {
            maxAccountLen = Math.max(maxAccountLen, p.account.length);
        }
    }

    // Find the widest amount string (for right-alignment)
    let maxAmountLen = 0;
    for (const p of postings) {
        if (p.amountStr !== null && !p.isComment && !p.isBlank) {
            maxAmountLen = Math.max(maxAmountLen, p.amountStr.length);
        }
    }

    const result: string[] = [header];
    for (const p of postings) {
        if (p.isBlank) { result.push(''); continue; }
        if (p.isComment) {
            result.push(`  ${p.account}`);
            continue;
        }
        if (p.amountStr === null) {
            // Metadata or account-only posting
            result.push(`  ${p.account}`);
            continue;
        }

        // Align: 2 spaces + account padded to maxAccountLen + 2 spaces + right-aligned amount + space + currency [+ tail]
        const accountPad = p.account.padEnd(maxAccountLen);
        const amountPad  = p.amountStr.padStart(maxAmountLen);
        const tail = p.tail ? `  ${p.tail}` : '';
        result.push(`  ${accountPad}  ${amountPad} ${p.currency}${tail}`);
    }

    return result;
}

/**
 * Format a non-transaction directive block: normalise indentation of any
 * sub-lines (metadata) to 2 spaces, leaving the first line untouched.
 */
function formatDirectiveBlock(block: string[]): string[] {
    return block.map((line, i) => {
        if (i === 0) return line; // directive header — keep as-is
        if (line.trim() === '') return line;
        if (line.trimStart().startsWith(';')) return `  ${line.trimStart()}`;
        // metadata: re-indent to 2 spaces
        return `  ${line.trimStart()}`;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a full Beancount document string.
 * - Normalises posting indentation to 2 spaces
 * - Right-aligns amounts within each transaction block
 * - Normalises @ / @@ price annotation spacing
 * - Preserves blank lines between blocks
 */
export function formatBeancount(text: string): string {
    // Detect the original line ending so we can restore it
    const crlf = text.includes('\r\n');
    const lines = text.split(/\r?\n/);

    // Remove trailing whitespace from each line
    const cleanedLines = lines.map((l) => l.replace(/\s+$/, ''));

    const blocks = splitIntoBlocks(cleanedLines);

    const formatted: string[] = [];
    for (const block of blocks) {
        if (block.length === 1 && block[0].trim() === '') {
            formatted.push(block[0]);
        } else if (isTransactionBlock(block)) {
            formatted.push(...formatTransactionBlock(block));
        } else if (DIRECTIVE_START_RE.test(block[0])) {
            formatted.push(...formatDirectiveBlock(block));
        } else {
            formatted.push(...block);
        }
    }

    const sep = crlf ? '\r\n' : '\n';
    return formatted.join(sep);
}

// ---------------------------------------------------------------------------
// CodeMirror command
// ---------------------------------------------------------------------------

/**
 * A CodeMirror command that formats the entire document in-place.
 * Returns true if a change was made, false otherwise (no-op when content is already clean).
 */
export function formatBeancountCommand(view: EditorView): boolean {
    const current = view.state.doc.toString();
    const next    = formatBeancount(current);
    if (current === next) return false;

    view.dispatch({
        changes: { from: 0, to: current.length, insert: next },
        // Preserve cursor position at end if possible
        scrollIntoView: true,
    });
    return true;
}
