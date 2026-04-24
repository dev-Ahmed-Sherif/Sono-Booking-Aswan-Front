"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Paperclip } from "lucide-react";
import CellAction from "@/components/operation/maintenance/cell-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import { getFullFileUrl } from "@/lib/file-viewer";

export type MaintenanceColumn = {
  id: string;
  number: number;
  maintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  maintenanceTypeNameAr?: string;
  floatingUnitNameAr?: string;
  maintenanceReport?: string;
  notes?: string | null;
  isDeleted?: boolean;
  createdAt: string;
  modifiedAt?: string;
  createdBy?: string;
  modifiedBy?: string;
};

function maintenanceReportPathFromRow(row: MaintenanceColumn): string | undefined {
  const raw = row.maintenanceReport ?? "";
  if (raw == null) return undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["path", "filePath", "url", "attachmentPath"] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

function isLikelyImagePath(path: string): boolean {
  const base = (path.split("?")[0] ?? "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(base);
}

function MaintenanceReportPreviewCell({ row }: { row: MaintenanceColumn }) {
  const [open, setOpen] = useState(false);
  const path = maintenanceReportPathFromRow(row);
  const href = path ? getFullFileUrl(path) : undefined;
  const fileLabel = path?.split(/[/\\]/).pop()?.split("?")[0] ?? "تقرير الصيانة";
  const showAsImage = path ? isLikelyImagePath(path) : false;

  if (!href) {
    return <span className="text-center block text-muted-foreground">—</span>;
  }

  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-primary shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          title="عرض المرفق"
        >
          <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">عرض محتوى المرفق</span>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col gap-2 p-4 sm:p-6">
          <DialogHeader className="px-2 py-1 text-center sm:text-center">
            <DialogTitle className="truncate text-center">{fileLabel}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20">
            {showAsImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote attachment URL
              <img
                src={href}
                alt=""
                className="mx-auto block max-h-[min(75vh,80vw)] w-full object-contain"
              />
            ) : (
              <iframe
                src={href}
                title={fileLabel}
                className="h-[min(75vh,70vw)] w-full min-h-[50vh] border-0 bg-white dark:bg-gray-950"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<MaintenanceColumn>[] {
  const base: ColumnDef<MaintenanceColumn>[] = [
    { accessorKey: "number", header: "رقم الصيانة" },
    {
      accessorKey: "maintenanceTypeNameAr",
      header: "نوع الصيانة",
      cell: ({ row }) => row.original.maintenanceTypeNameAr || "-",
    },
    {
      accessorKey: "floatingUnitNameAr",
      header: "الوحدة العائمة",
      cell: ({ row }) => row.original.floatingUnitNameAr || "-",
    },
    {
      accessorKey: "maintenanceDate",
      header: "تاريخ الصيانة",
      cell: ({ row }) =>
        row.original.maintenanceDate
          ? formatUtcToCairo(row.original.maintenanceDate)
          : "-",
    },
    {
      accessorKey: "nextMaintenanceDate",
      header: "تاريخ الصيانة القادم",
      cell: ({ row }) =>
        row.original.nextMaintenanceDate
          ? formatUtcToCairo(row.original.nextMaintenanceDate)
          : "-",
    },
    {
      accessorKey: "maintenanceReport",
      header: "تقرير الصيانة",
      cell: ({ row }) => <MaintenanceReportPreviewCell row={row.original} />,
    },
  ];

  const auditCols: ColumnDef<MaintenanceColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => formatUtcToCairo(row.original.createdAt),
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) =>
        row.original.modifiedAt
          ? formatUtcToCairo(row.original.modifiedAt)
          : "-",
    },
    { accessorKey: "modifiedBy", header: "المعدل بواسطة" },
  ];

  return [
    ...base,
    ...(showAuditColumns ? auditCols : []),
    { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
  ];
}

export const columns = createColumns();
