"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export function useTablePagination<T>(
  items: readonly T[],
  pageSize: number = DEFAULT_TABLE_PAGE_SIZE,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageCount,
    pageSize,
    paginatedItems,
    totalItems: items.length,
  };
}
