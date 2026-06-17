"use client";

import { Button } from "@/components/ui/button";

export type TablePaginationProps = {
  totalItems: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function TablePagination({
  totalItems,
  page,
  pageCount,
  pageSize,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (totalItems <= pageSize) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
      }
    >
      <p className="text-sm text-muted-foreground">
        عرض {rangeStart.toLocaleString("ar-EG")}–
        {rangeEnd.toLocaleString("ar-EG")} من{" "}
        {totalItems.toLocaleString("ar-EG")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          السابق
        </Button>
        <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-muted-foreground">
          {page.toLocaleString("ar-EG")} / {pageCount.toLocaleString("ar-EG")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
