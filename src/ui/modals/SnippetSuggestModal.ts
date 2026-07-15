import { App, FuzzySuggestModal } from 'obsidian';
import type { Completion } from '@codemirror/autocomplete';

export class SnippetSuggestModal extends FuzzySuggestModal<Completion> {
    private items: Completion[];
    private onSelect: (item: Completion) => void;

    constructor(app: App, items: Completion[], onSelect: (item: Completion) => void) {
        super(app);
        this.items = items;
        this.onSelect = onSelect;
        this.setPlaceholder("Search transaction snippet...");
    }

    getItems(): Completion[] {
        return this.items;
    }

    getItemText(item: Completion): string {
        return item.label;
    }

    onChooseItem(item: Completion, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item);
    }
}
