import { log } from "$lib/logger";
import type { Locales } from "$lib/types/locales";
import { writable } from "svelte/store";

export const language = writable<Locales>("en");
export function setLanguage(locale: Locales) {
    localStorage.setItem("language", locale);
    log(["language"], `set to ${locale}`);
    document.documentElement.lang = locale;
    language.set(locale);
}
