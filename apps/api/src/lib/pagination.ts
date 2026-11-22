import { z } from 'zod';
import type { Config } from '../config/env';

/**
 * Query of a cursor-paginated list: ?cursor=<id>&limit=<n>.
 * The default and the maximum limit come from PAGINATION_DEFAULT_LIMIT and PAGINATION_MAX_LIMIT.
 */
export function createPaginationQuerySchema({ defaultLimit, maxLimit }: Config['pagination']) {
  return z.object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().positive().max(maxLimit).default(defaultLimit),
  });
}

export interface Page<T> {
  items: T[];
  /** Pass it as ?cursor= to get the next page; null on the last page. */
  nextCursor: string | null;
}

/** Prisma arguments to read limit + 1 rows after the cursor (the extra row reveals a next page). */
export function pageArgs({ cursor, limit }: { cursor?: string | undefined; limit: number }) {
  return {
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  };
}

/** A page whose items go through an async mapper (one that signs file URLs, for example). */
export async function mapPage<T, U>(page: Page<T>, map: (item: T) => Promise<U>): Promise<Page<U>> {
  return { items: await Promise.all(page.items.map(map)), nextCursor: page.nextCursor };
}

/** Turns the limit + 1 rows read with pageArgs() into a page. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last !== undefined ? cursorOf(last) : null };
}
