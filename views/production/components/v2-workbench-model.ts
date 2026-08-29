export function paginateV2Rows<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
  const start = (safePage - 1) * safePageSize;
  return rows.slice(start, start + safePageSize);
}
