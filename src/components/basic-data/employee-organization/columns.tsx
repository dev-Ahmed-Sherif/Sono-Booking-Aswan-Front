"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Paperclip } from "lucide-react";
import CellAction from "@/components/basic-data/employee-organization/cell-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFullFileUrl } from "@/lib/file-viewer";
import { pathLooksLikeImage } from "@/lib/image-file";

export type EmployeeOrganizationColumn = {
  id: string;
  name: string;
  job: string;
  isDeleted?: boolean;
  mobile: string;
  phone?: string;
  phoneExtension?: string;
  email: string;
  nationalId?: string;
  isDelegate?: boolean;
  delegateAttachment?: string;
  /** Some API responses use PascalCase */
  DelegateAttachment?: unknown;
};

const centerHeader = (label: string) => (
  <span className="text-center block">{label}</span>
);

/** Raw API value: relative path, full URL, or nested `{ path | url | ... }`. */
function delegateAttachmentPathFromRow(
  row: EmployeeOrganizationColumn,
): string | undefined {
  const raw = row.delegateAttachment ?? row.DelegateAttachment;
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

function DelegateAttachmentPreviewCell({
  row,
}: {
  row: EmployeeOrganizationColumn;
}) {
  const [open, setOpen] = useState(false);
  const path = delegateAttachmentPathFromRow(row);
  const href = path ? getFullFileUrl(path) : undefined;
  const fileLabel = path?.split(/[/\\]/).pop()?.split("?")[0] ?? "مرفق التفويض";
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
              // eslint-disable-next-line @next/next/no-img-element -- remote staff attachment URL
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
  onEditClick?: (row: EmployeeOrganizationColumn) => void,
  showDelegateColumns: boolean = true,
  onDeleteSuccess?: (id: string) => void,
): ColumnDef<EmployeeOrganizationColumn>[] {
  const baseColumns: ColumnDef<EmployeeOrganizationColumn>[] = [
    { accessorKey: "name", header: () => centerHeader("الاسم") },
    {
      accessorKey: "nationalId",
      header: () => centerHeader("الرقم القومي"),
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.nationalId ?? "—"}
        </span>
      ),
    },
    { accessorKey: "email", header: () => centerHeader("الإيميل") },
    { accessorKey: "job", header: () => centerHeader("الوظيفة") },
    {
      accessorKey: "mobile",
      header: () => centerHeader("رقم الموبايل"),
      cell: ({ row }) => (
        <span className="text-center block">{row.original.mobile}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: () => centerHeader("هاتف مباشر"),
      cell: ({ row }) => (
        <span className="text-center block">{row.original.phone ?? "—"}</span>
      ),
    },
    {
      accessorKey: "phoneExtension",
      header: () => centerHeader("التحويلة"),
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.phoneExtension ?? "—"}
        </span>
      ),
    },
  ];

  const delegateColumns: ColumnDef<EmployeeOrganizationColumn>[] = [
    {
      accessorKey: "isDelegate",
      header: () => centerHeader("مفوض"),
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.isDelegate ? "نعم" : "لا"}
        </span>
      ),
    },
    {
      accessorKey: "delegateAttachment",
      id: "delegateAttachment",
      header: () => centerHeader("مرفق التفويض"),
      cell: ({ row }) => <DelegateAttachmentPreviewCell row={row.original} />,
    },
  ];

  const actionColumn: ColumnDef<EmployeeOrganizationColumn> = {
    id: "actions",
    header: () => centerHeader(""),
    cell: ({ row }) => (
      <div className="text-center">
        <CellAction
          data={row.original}
          onEditClick={onEditClick}
          onDeleteSuccess={onDeleteSuccess}
        />
      </div>
    ),
  };

  const columns: ColumnDef<EmployeeOrganizationColumn>[] = [
    ...baseColumns,
    ...(showDelegateColumns ? delegateColumns : []),
    actionColumn,
  ];

  return columns;
}

export const columns = createColumns();
