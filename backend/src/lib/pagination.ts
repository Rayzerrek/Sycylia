/** Clamped integer query parsing for pagination. */

export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
}

/** Query object shape returned by Hono's `c.req.query()`. */
export type QueryParams = Record<string, string | string[] | undefined>;

export function readPageQuery(
  params: QueryParams,
  options: {
    defaultPageSize: number;
    maxPageSize: number;
    defaultPage?: number;
  },
): PageQuery {
  const defaultPage = options.defaultPage ?? 1;
  return {
    page: readClampedInt(params.page, defaultPage, 1, Number.MAX_SAFE_INTEGER),
    pageSize: readClampedInt(params.pageSize, options.defaultPageSize, 1, options.maxPageSize),
  };
}

export function readClampedInt(
  raw: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string" || !Number.isInteger(Number(first))) {
    return fallback;
  }
  return Math.min(Math.max(Number(first), min), max);
}
