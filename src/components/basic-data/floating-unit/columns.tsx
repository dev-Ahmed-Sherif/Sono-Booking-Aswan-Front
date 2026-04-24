"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import CellAction from "@/components/basic-data/floating-unit/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import { getFullFileUrl } from "@/lib/file-viewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FloatingUnitColumn = {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  licenseNumber?: string;
  unitType?: string;
  manufactureYear?: string;
  lastMaintenanceDate?: string;
  passengerNumber?: number;
  roomNumber?: number;
  length?: number;
  width?: number;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<FloatingUnitColumn>[] {
  const base: ColumnDef<FloatingUnitColumn>[] = [
    { accessorKey: "code", header: "الكود" },
    { accessorKey: "nameAr", header: "الاسم العربي" },
    {
      accessorKey: "nameEn",
      header: "الاسم الإنجليزي",
      cell: ({ row }) => row.original.nameEn || "-",
    },
    {
      accessorKey: "licenseNumber",
      header: "رقم الترخيص",
      cell: ({ row }) => row.original.licenseNumber || "-",
    },
    {
      accessorKey: "unitType",
      header: "نوع الوحدة",
      cell: ({ row }) => row.original.unitType || "-",
    },
    {
      accessorKey: "manufactureYear",
      header: "سنة الصنع",
      cell: ({ row }) => row.original.manufactureYear || "-",
    },
    {
      accessorKey: "lastMaintenanceDate",
      header: "آخر صيانة",
      cell: ({ row }) => row.original.lastMaintenanceDate || "-",
    },
    {
      accessorKey: "passengerNumber",
      header: "عدد الركاب",
      cell: ({ row }) => row.original.passengerNumber || "-",
    },
    {
      accessorKey: "roomNumber",
      header: "عدد الغرف",
      cell: ({ row }) => row.original.roomNumber || "-",
    },
    {
      accessorKey: "length",
      header: "الطول",
      cell: ({ row }) => row.original.length || "-",
    },
    {
      accessorKey: "width",
      header: "العرض",
      cell: ({ row }) => row.original.width || "-",
    },
  ];

  const auditCols: ColumnDef<FloatingUnitColumn>[] = [
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
