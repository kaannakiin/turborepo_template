import type { $ZodErrorMap } from "zod/v4/core";
import type { TranslateFn } from "../translator";
import { resolveZodIssueKey } from "./issue-map";

export function makeZodErrorMap(t: TranslateFn): $ZodErrorMap {
  return (issue) => {
    const { key, params } = resolveZodIssueKey(issue);
    return t(key, params);
  };
}
