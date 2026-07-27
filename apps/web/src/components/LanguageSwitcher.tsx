import { SUPPORTED_LOCALES, type SupportedLocale } from "@repo/i18n/locale";
import { useTranslation } from "react-i18next";
import { setLocaleCookie } from "../i18n/locale";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const switchTo = (locale: SupportedLocale) => {
    setLocaleCookie(locale);
    // react-i18next re-renders every consumer; the html attribute is outside
    // that tree, so it's synced by hand. SSR picks the cookie up next visit.
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale);
  };

  return (
    <label className="flex items-center gap-2 text-sm text-gray-500">
      {t("language")}
      <select
        className="rounded border border-gray-200 px-2 py-1 text-sm"
        value={i18n.language}
        onChange={(e) => switchTo(e.target.value as SupportedLocale)}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {locale.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
