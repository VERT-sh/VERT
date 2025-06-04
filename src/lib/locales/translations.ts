import type { Dictionary, Locales } from "$lib/types/locales";
import en from "./translations/en";
import it from "./translations/it";


const translation: Record<Locales, Record<Dictionary, string>> = {
    en: en,
    it: it
}

export default translation;