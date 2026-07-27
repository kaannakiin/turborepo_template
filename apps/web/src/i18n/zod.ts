import { getTranslator } from "@repo/i18n/instance";
import { makeZodErrorMap } from "@repo/i18n/zod";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { i18n } from "i18next";
import { z } from "zod";

export const bindZodLocale = createIsomorphicFn()
  .server((_instance: i18n) => {})
  .client((instance: i18n) => {
    z.config({ customError: makeZodErrorMap(getTranslator(instance)) });
  });
