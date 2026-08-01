import type { $ZodIssue, $ZodRawIssue } from "zod/v4/core";

const KEY_PATTERN = /^(common|validation|errors)(\.[a-zA-Z0-9_]+)+$/;

export function isTranslationKey(message: string): boolean {
  return KEY_PATTERN.test(message);
}

export interface ResolvedIssueKey {
  key: string;
  params: Record<string, unknown>;
}

const KNOWN_ORIGINS = new Set(["string", "number", "array"]);
const KNOWN_FORMATS = new Set(["email", "url", "uuid", "datetime"]);

export type IssueLike = $ZodIssue | $ZodRawIssue;

export function resolveZodIssueKey(issue: IssueLike): ResolvedIssueKey {
  const path = (issue.path ?? []).join(".");
  const resolved = resolveByCode(issue, path);

  const message = (issue as { message?: unknown }).message;
  if (typeof message === "string" && isTranslationKey(message)) {
    return { key: message, params: resolved.params };
  }
  return resolved;
}

function resolveByCode(issue: IssueLike, path: string): ResolvedIssueKey {
  switch (issue.code) {
    case "too_small": {
      const origin = KNOWN_ORIGINS.has(issue.origin) ? issue.origin : "default";
      return {
        key: `validation.zod.tooSmall.${origin}`,
        params: { min: issue.minimum, count: Number(issue.minimum), path },
      };
    }
    case "too_big": {
      const origin = KNOWN_ORIGINS.has(issue.origin) ? issue.origin : "default";
      return {
        key: `validation.zod.tooBig.${origin}`,
        params: { max: issue.maximum, count: Number(issue.maximum), path },
      };
    }
    case "invalid_format": {
      const format = KNOWN_FORMATS.has(issue.format) ? issue.format : "default";
      return {
        key: `validation.zod.invalidFormat.${format}`,
        params: { path },
      };
    }
    case "invalid_type":
      return {
        key: "validation.zod.invalidType",
        params: { expected: issue.expected, path },
      };
    case "invalid_value":
      return { key: "validation.zod.invalidValue", params: { path } };
    case "not_multiple_of":
      return {
        key: "validation.zod.notMultipleOf",
        params: { divisor: issue.divisor, path },
      };
    case "unrecognized_keys":
      return {
        key: "validation.zod.unrecognizedKeys",
        params: { keys: issue.keys.join(", "), path },
      };
    case "invalid_union":
      return {
        key: issue.discriminator
          ? "validation.zod.invalidUnion.discriminator"
          : "validation.zod.invalidUnion.default",
        params: { discriminator: issue.discriminator, path },
      };
    case "invalid_key":
      return {
        key: "validation.zod.invalidKey",
        params: { origin: issue.origin, path },
      };
    case "invalid_element":
      return {
        key: "validation.zod.invalidElement",
        params: { origin: issue.origin, path },
      };
    case "custom":
      return {
        key: "validation.zod.custom",
        params: { ...(issue.params ?? {}), path },
      };
    default:
      return { key: "validation.zod.generic", params: { path } };
  }
}
