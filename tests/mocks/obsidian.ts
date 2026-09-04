// tests/mocks/obsidian.ts
export class App {}
export class Plugin {
	app = new App();
}
export class PluginSettingTab {
	constructor(public app: App, public plugin: Plugin) {}
}
export class Setting {
	constructor(public containerEl: HTMLElement) {}
	setName() { return this; }
	setDescription() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addDropdown() { return this; }
	addButton() { return this; }
}
export class Notice {
	constructor(public message: string) {}
}
export class TFile {
	path = '';
	extension = '';
}
export class TFolder {
	path = '';
}
export class Modal {
	constructor(public app: App) {}
	open() {}
	close() {}
}
export class ItemView {
	constructor(public leaf: unknown) {}
}
export const Platform = {
	isDesktop: true,
	isMobile: false,
};
