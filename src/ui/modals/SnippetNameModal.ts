import { App, Modal, Setting, TextComponent, Notice } from 'obsidian';

export class SnippetNameModal extends Modal {
    private snippetName = '';
    private onSubmit: (name: string) => void;

    constructor(app: App, defaultName: string, onSubmit: (name: string) => void) {
        super(app);
        this.snippetName = defaultName;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Save as transaction snippet' });
        contentEl.createEl('p', { text: 'Enter a name for this transaction snippet. This name will be suggested when autocompleting.' });

        let textComponent: TextComponent | null = null;
        new Setting(contentEl)
            .setName('Snippet name')
            .addText(text => {
                textComponent = text;
                text.setValue(this.snippetName)
                    .onChange(value => {
                        this.snippetName = value;
                    });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Save snippet')
                .setCta()
                .onClick(() => {
                    const trimmed = this.snippetName.trim();
                    if (!trimmed) {
                        new Notice('Snippet name cannot be empty.');
                        return;
                    }
                    this.onSubmit(trimmed);
                    this.close();
                }));

        // Focus the text input and select the default text for easy editing
        window.setTimeout(() => {
            if (textComponent !== null && textComponent.inputEl) {
                textComponent.inputEl.focus();
                textComponent.inputEl.select();
            }
        }, 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
