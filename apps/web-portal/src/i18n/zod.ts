import { getTranslator } from "@repo/i18n/instance";
import { makeZodErrorMap } from "@repo/i18n/zod";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { i18n } from "i18next";
import { z } from "zod";

export const bindZodLocale = createIsomorphicFn()
  // Intentional no-op: `z.config` is process-global, so binding it per SSR
  // request would leak one request's locale into concurrent requests on the
  // same server. A future server function that needs to translate a
  // ZodError should resolve issues directly with the request-scoped
  // translator instead — see `translateZodIssues` / `resolveZodIssueKey`
  // in `@repo/i18n/zod` (the pattern `AllExceptionsFilter` already uses).
  .server((_instance: i18n) => {})
  .client((instance: i18n) => {
    z.config({ customError: makeZodErrorMap(getTranslator(instance)) });
  });
