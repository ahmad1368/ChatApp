export type Locale = "en" | "fa";

export const RTL_LOCALES = new Set<Locale>(["fa"]);

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
};

const translations = {
  en: {
    title: "ChatApp",
    placeholder: "Type a message",
    send: "Send",
  },
  fa: {
    title: "چت‌اپ",
    placeholder: "پیام خود را بنویسید",
    send: "ارسال",
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)["en"];

export function translate(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.en[key];
}

export function directionFor(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
