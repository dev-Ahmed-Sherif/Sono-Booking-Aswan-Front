"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Paperclip } from "lucide-react";
import CellAction from "@/components/basic-data/floating-unit-staff/cell-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFullFileUrl } from "@/lib/file-viewer";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import type { NumericLookupRow } from "@/lib/numeric-lookup";

export type FloatingUnitStaffColumn = {
  id: string;
  name: string;
  job: string;
  mobile: string;
  email: string;
  identity?: string;
  gender?: number | string;
  idType?: number | string;
  nationalityId?: string;
  nationalityNameAr?: string;
  isDelegate?: boolean;
  delegateAttachment?: string;
  DelegateAttachment?: unknown;
  isDeleted?: boolean;
  createdAt?: string;
  modifiedAt?: string;
};

const centerHeader = (label: string) => (
  <span className="text-center block">{label}</span>
);

function delegateAttachmentPathFromRow(
  row: FloatingUnitStaffColumn,
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
  const base = (path.split("?")[0] ?? "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(base);
}

function DelegateAttachmentPreviewCell({
  row,
}: {
  row: FloatingUnitStaffColumn;
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
          <Paperclip className="h-4 w-4" />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-center">{fileLabel}</DialogTitle>
          </DialogHeader>
          {showAsImage ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={href}
                alt={fileLabel}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          ) : (
            <iframe
              src={href}
              className="h-[70vh] w-full rounded-md border"
              title={fileLabel}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const genderLabelLegacy = (v: number | undefined) =>
  v === 2 ? "أنثى" : v === 1 ? "ذكر" : "—";

const idTypeLabelLegacy = (v: number | undefined) =>
  v === 2 ? "جواز سفر" : v === 1 ? "بطاقة شخصية" : "—";

function normalizeEnumValue(
  v: number | string | undefined,
): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : undefined;
    }
  }
  return undefined;
}

function genderLabelFromBackend(v: number | string | undefined): string | null {
  if (typeof v !== "string") return null;
  const raw = v.trim().toLowerCase();
  if (raw === "male") return "ذكر";
  if (raw === "female") return "أنثى";
  return null;
}

function idTypeLabelFromBackend(v: number | string | undefined): string | null {
  if (typeof v !== "string") return null;
  const raw = v.trim().toLowerCase();
  if (raw === "idcard") return "بطاقة شخصية";
  if (raw === "passport") return "جواز سفر";
  return null;
}

function lookupLabel(
  v: number | string | undefined,
  list: NumericLookupRow[] | null | undefined,
  legacy: (x: number | undefined) => string,
  fromBackend?: (x: number | string | undefined) => string | null,
) {
  const backendLabel = fromBackend?.(v);
  if (backendLabel) return backendLabel;
  const normalized = normalizeEnumValue(v);
  if (normalized == null) return "—";
  const hit = list?.find((x) => x.id === normalized);
  if (hit) return hit.nameAr;
  return legacy(normalized);
}

export type FloatingUnitStaffColumnsLookups = {
  genders?: NumericLookupRow[] | null;
  idTypes?: NumericLookupRow[] | null;
};

export function createColumns(
  onEditClick?: (row: FloatingUnitStaffColumn) => void,
  onDeleteSuccess?: (id: string) => void,
  showAuditColumns = false,
  lookups?: FloatingUnitStaffColumnsLookups,
): ColumnDef<FloatingUnitStaffColumn>[] {
  const base: ColumnDef<FloatingUnitStaffColumn>[] = [
    {
      accessorKey: "name",
      header: () => centerHeader("الاسم"),
      cell: ({ row }) => (
        <span className="text-center block">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "job",
      header: () => centerHeader("الوظيفة"),
      cell: ({ row }) => (
        <span className="text-center block">{row.original.job}</span>
      ),
    },
    {
      accessorKey: "mobile",
      header: () => centerHeader("المحمول"),
      cell: ({ row }) => (
        <span className="text-center block">{row.original.mobile}</span>
      ),
    },
    {
      accessorKey: "email",
      header: () => centerHeader("الإيميل"),
      cell: ({ row }) => (
        <span className="text-center block truncate max-w-[200px] mx-auto">
          {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "identity",
      header: () => centerHeader("رقم الهوية"),
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.identity ?? "—"}
        </span>
      ),
    },
    {
      id: "gender",
      header: () => centerHeader("النوع"),
      cell: ({ row }) => (
        <span className="text-center block">
          {lookupLabel(
            row.original.gender,
            lookups?.genders,
            genderLabelLegacy,
            genderLabelFromBackend,
          )}
        </span>
      ),
    },
    {
      id: "idType",
      header: () => centerHeader("نوع الهوية"),
      cell: ({ row }) => (
        <span className="text-center block">
          {lookupLabel(
            row.original.idType,
            lookups?.idTypes,
            idTypeLabelLegacy,
            idTypeLabelFromBackend,
          )}
        </span>
      ),
    },
    {
      id: "nationality",
      header: () => centerHeader("الجنسية"),
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.nationalityNameAr ?? "—"}
        </span>
      ),
    },
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
      id: "delegateAttachment",
      header: () => centerHeader("مرفق التفويض"),
      cell: ({ row }) => <DelegateAttachmentPreviewCell row={row.original} />,
    },
  ];

  const auditCols: ColumnDef<FloatingUnitStaffColumn>[] = [
    {
      accessorKey: "createdAt",
      header: () => centerHeader("تاريخ الإنشاء"),
      cell: ({ row }) => (
        <span className="text-center block text-sm">
          {formatUtcToCairo(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "modifiedAt",
      header: () => centerHeader("تاريخ التعديل"),
      cell: ({ row }) => (
        <span className="text-center block text-sm">
          {formatUtcToCairo(row.original.modifiedAt)}
        </span>
      ),
    },
  ];

  return [
    ...base,
    ...(showAuditColumns ? auditCols : []),
    {
      id: "actions",
      cell: ({ row }) => (
        <CellAction
          data={row.original}
          onEditClick={onEditClick}
          onDeleteSuccess={onDeleteSuccess}
        />
      ),
    },
  ];
}

export const columns = createColumns();
