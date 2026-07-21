// tests/mocks/obsidian.ts
export class App {}
export class Plugin {}
export class Notice {
	constructor(public message: string) {}
}
export class TFile {
	path = '';
	extension = '';
}
export const Platform = {
	isDesktop: true,
	isMobile: false,
};
