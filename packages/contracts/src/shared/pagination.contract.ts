import { z } from "zod";

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PageMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type PageMeta = z.infer<typeof PageMetaSchema>;

/**
 * Wraps any item schema in the standard list envelope. Kept as a factory so
 * every paginated endpoint shares one shape instead of re-declaring `meta`.
 */
export function paginated<TItem extends z.ZodType>(item: TItem) {
  return z.object({ items: z.array(item), meta: PageMetaSchema });
}

export type Paginated<TItem> = { items: TItem[]; meta: PageMeta };
