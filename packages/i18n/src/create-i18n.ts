import { createInstance, type i18n, type Module } from "i18next";
import {
  DEFAULT_LOCALE,
  NAMESPACES,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./locale";
import { resources } from "./resources";

export function createI18nInstance(
  locale: SupportedLocale,
  plugins: Module[] = [],
): i18n {
  const instance = createInstance();
  for (const plugin of plugins) instance.use(plugin);
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    resources,
    defaultNS: "common",
    ns: [...NAMESPACES],
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}
