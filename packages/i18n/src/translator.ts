import type { i18n } from "i18next";
import { NAMESPACES, type Namespace } from "./locale";

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

function splitKey(key: string): { ns: Namespace; path: string } {
  const dot = key.indexOf(".");
  if (dot > 0) {
    const head = key.slice(0, dot);
    if ((NAMESPACES as readonly string[]).includes(head)) {
      return { ns: head as Namespace, path: key.slice(dot + 1) };
    }
  }
  return { ns: "common", path: key };
}

export function getTranslator(instance: i18n, locale?: string): TranslateFn {
  const fixed = locale ? instance.getFixedT(locale) : null;
  return (key, params) => {
    const { ns, path } = splitKey(key);
    const options = { ...(params ?? {}), ns } as never;
    const result = fixed
      ? fixed(path as never, options)
      : instance.t(path as never, options);
    return typeof result === "string" ? result : key;
  };
}
