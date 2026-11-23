import { z } from 'zod';
import { apiRequest } from './http';

/** One page of a cursor-paginated list (docs/api.md, "Pagination"). */
export interface Page<T> {
  items: T[];
  /** The cursor of the next page; null on the last one. */
  nextCursor: string | null;
}

const pageMetaSchema = z.object({ nextCursor: z.string().nullable() });

/** A path with its query string; parameters without a value are left out. */
export function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) query.set(name, value);
  }
  const text = query.toString();
  return text === '' ? path : `${path}?${text}`;
}

/** Reads one page of a list: GET path?cursor=… */
export async function apiPage<T>(
  path: string,
  itemSchema: z.ZodType<T>,
  { cursor, signal }: { cursor: string | null; signal?: AbortSignal | undefined },
): Promise<Page<T>> {
  const { data, meta } = await apiRequest(withQuery(path, { cursor }), z.array(itemSchema), {
    signal,
  });
  return { items: data, nextCursor: pageMetaSchema.parse(meta).nextCursor };
}

/** The options every infinite list shares: it starts without a cursor and follows nextCursor. */
export const pageParams = {
  initialPageParam: null as string | null,
  getNextPageParam: (page: Page<unknown>): string | null => page.nextCursor,
};
