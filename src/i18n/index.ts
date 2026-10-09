import { derived, get, writable } from 'svelte/store';
import { en } from './en';
import { zhCN } from './zh-CN';

export type LanguagePreference = 'auto' | 'en' | 'zh-CN';
export type Locale = 'en' | 'zh-CN';
export type MessageValues = ReadonlyArray<string | number | null | undefined>;
export const locale = writable<Locale>('en');

export function normalizeLanguage(value: unknown): LanguagePreference {
    return value === 'en' || value === 'zh-CN' ? value : 'auto';
}

export function resolveLocale(preference: LanguagePreference, obsidianLanguage = 'en'): Locale {
    if (preference !== 'auto') return preference;
    return /^zh(?:-|_|$)/i.test(obsidianLanguage) ? 'zh-CN' : 'en';
}

export function setLanguage(preference: LanguagePreference, obsidianLanguage = 'en'): void {
    locale.set(resolveLocale(preference, obsidianLanguage));
}

/** Interpolate after lookup; values such as account paths and user names stay untouched. */
export function translate(language: Locale, message: string, values: MessageValues = []): string {
    const catalog = language === 'zh-CN' ? zhCN : en;
    const template = catalog[message] ?? en[message] ?? message;
    return template.replace(/\{(\d+)\}/g, (token, index: string) => {
        const value = values[Number(index)];
        return value === undefined || value === null ? token : String(value);
    });
}

/** Use in native settings, commands and notices. */
export function t(message: string, values: MessageValues = []): string {
    return translate(get(locale), message, values);
}

/** Svelte's $tr subscribes so labels update when the preference changes. */
export const tr = derived(locale, language => (message: string, values?: MessageValues) => translate(language, message, values));
