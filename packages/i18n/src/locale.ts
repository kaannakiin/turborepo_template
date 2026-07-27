export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "tr";

export const LOCALE_COOKIE = "locale";

export const NAMESPACES = ["common", "validation", "errors"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function parseAcceptLanguage(
  header: string | undefined,
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  if (!header) return fallback;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return {
        tag: tag.trim().toLowerCase(),
        q: q === undefined ? 1 : Number(q),
      };
    })
    .filter(
      (entry) => entry.tag !== "" && !Number.isNaN(entry.q) && entry.q > 0,
    )
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isSupportedLocale(primary)) return primary;
  }
  return fallback;
}
