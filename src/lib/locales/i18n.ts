import { language } from "$lib/store/language";
import { derived } from "svelte/store";
import translations from "./translations";
import type { Dictionary, Locales } from "$lib/types/locales";

export const locales = Object.keys(translations);

function translate(locale: Locales, key: Dictionary, vars: any) {
    if (!key) throw new Error("no key provided to $t()");
    if (!locale) throw new Error(`no translation for key "${key}"`);

    let text = translations[locale][key];

    if (!text) throw new Error(`no translation found for ${locale}.${key}`);

    Object.keys(vars).map((k) => {
        text = text.replaceAll(`{{${k}}}`, vars[k]);
    });

    return text;
}

export const t = derived(language, ($locale) => (key: Dictionary, vars = {}) =>
    translate($locale, key, vars)
);
