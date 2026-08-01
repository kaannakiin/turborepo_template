/**
 * Prisma error codes are matched structurally instead of by importing
 * `PrismaClientKnownRequestError` — that class lives behind
 * `@prisma/client/runtime`, which this app does not reach into directly.
 */
export function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

export const isUniqueViolation = (error: unknown): boolean =>
  hasPrismaCode(error, "P2002");

/**
 * Column names reported by a P2002, e.g. `["email"]`. Prisma's classic engine
 * puts them in `meta.target`; the pg driver adapter nests them under
 * `meta.driverAdapterError.cause.constraint.fields` — both are read so this
 * survives either runtime.
 */
export function uniqueViolationTargets(error: unknown): string[] {
  if (!isUniqueViolation(error)) return [];
  const meta = (
    error as {
      meta?: {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      };
    }
  ).meta;
  const fields =
    meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(fields)
    ? fields.filter((f): f is string => typeof f === "string")
    : [];
}
