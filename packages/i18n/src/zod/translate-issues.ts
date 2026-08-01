import type { TranslateFn } from "../translator";
import { resolveZodIssueKey, type IssueLike } from "./issue-map";

export interface TranslatedIssue {
  path: string;
  code: string;
  message: string;
}

export function translateZodIssues(
  issues: readonly IssueLike[],
  t: TranslateFn,
): TranslatedIssue[] {
  return issues.map((issue) => {
    const { key, params } = resolveZodIssueKey(issue);
    return {
      path: (issue.path ?? []).join("."),
      code: key,
      message: t(key, params),
    };
  });
}
