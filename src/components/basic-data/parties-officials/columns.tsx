"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/basic-data/parties-officials/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type PartiesOfficialColumn = {
  id: string;
  code: string;
  nameAr: string;
  isDeleted?: boolean;
  phone: string;
  fax: string;
  mobile: string;
  email: string;
  isReport: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<PartiesOfficialColumn>[] {
  const base: ColumnDef<PartiesOfficialColumn>[] = [
    { accessorKey: "code", header: "الكود" },
    { accessorKey: "nameAr", header: "الاسم العربي" },
    {
      accessorKey: "isReport",
      header: "جهة استقبال بلاغات",
      cell: ({ row }) => (row.original.isReport ? "نعم" : "لا"),
    },
    { accessorKey: "phone", header: "رقم الهاتف" },
    { accessorKey: "fax", header: "رقم الفاكس" },
    { accessorKey: "mobile", header: "رقم المحمول" },
    { accessorKey: "email", header: "الإيميل" },
  ];

  const auditCols: ColumnDef<PartiesOfficialColumn>[] = [
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
