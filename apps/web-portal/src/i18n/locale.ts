import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isSupportedLocale,
  type SupportedLocale,
} from "@repo/i18n/locale";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

const readLocaleCookie = createIsomorphicFn()
  .server(() => getCookie(LOCALE_COOKIE))
  .client(
    () =>
      document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
        ?.split("=")[1],
  );

export function getRequestLocale(): SupportedLocale {
  const raw = readLocaleCookie();
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}

export function setLocaleCookie(locale: SupportedLocale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
