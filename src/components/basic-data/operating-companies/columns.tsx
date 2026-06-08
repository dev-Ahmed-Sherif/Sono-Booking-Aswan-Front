"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Paperclip } from "lucide-react";
import CellAction from "@/components/basic-data/operating-companies/cell-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import { getFullFileUrl } from "@/lib/file-viewer";
import { pathLooksLikeImage } from "@/lib/image-file";

export type OperatingCompanyColumn = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  phone: string;
  fax: string;
  mobile: string;
  email: string;
  website: string;
  commercialRegistrationNumber: string;
  commercialRegistrationAttachment?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

function commercialAttachmentPathFromRow(
  row: OperatingCompanyColumn,
): string | undefined {
  const raw = row.commercialRegistrationAttachment ?? "";
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
  return pathLooksLikeImage(path);
}

function CommercialAttachmentPreviewCell({
  row,
}: {
  row: OperatingCompanyColumn;
}) {
  const [open, setOpen] = useState(false);
  const path = commercialAttachmentPathFromRow(row);
  const href = path ? getFullFileUrl(path) : undefined;
  const fileLabel =
    path?.split(/[/\\]/).pop()?.split("?")[0] ?? "مرفق السجل التجاري";
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
            <DialogTitle className="truncate text-center">
              {fileLabel}
            </DialogTitle>
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
): ColumnDef<OperatingCompanyColumn>[] {
  const base: ColumnDef<OperatingCompanyColumn>[] = [
    { accessorKey: "code", header: "الكود" },
    { accessorKey: "nameAr", header: "الاسم العربي" },
    { accessorKey: "nameEn", header: "الاسم الإنجليزي" },
    { accessorKey: "phone", header: "الهاتف" },
    { accessorKey: "fax", header: "الفاكس" },
    { accessorKey: "mobile", header: "الموبايل" },
    { accessorKey: "email", header: "الإيميل" },
    {
      accessorKey: "commercialRegistrationAttachment",
      header: "مرفق السجل التجاري",
      cell: ({ row }) => (
        <CommercialAttachmentPreviewCell row={row.original} />
      ),
    },
  ];

  const auditCols: ColumnDef<OperatingCompanyColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => formatUtcToCairo(row.original.createdAt),
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => formatUtcToCairo(row.original.modifiedAt),
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
