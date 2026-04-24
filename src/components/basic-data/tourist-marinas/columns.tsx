"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/basic-data/tourist-marinas/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { getFullFileUrl } from "@/lib/file-viewer";

export type TouristMarinaColumn = {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  cityNameAr?: string;
  length?: number;
  northSide?: string;
  southSide?: string;
  northGeo?: string;
  eastGeo?: string;
  geoPointId?: string;
  note?: string;
  imageUrl?: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

const ImageCell = ({ src, alt }: { src?: string; alt: string }) => {
  const [open, setOpen] = useState(false);
  if (!src) return <span>-</span>;

  const fullSrc =
    getFullFileUrl(src) ??
    (src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
      ? src
      : `/${src}`);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Eye className="h-4 w-4" />
        عرض
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">
              صورة المرسي السياحي
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullSrc}
              alt={alt}
              className="max-h-[70vh] w-auto rounded-md border object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<TouristMarinaColumn>[] {
  const base: ColumnDef<TouristMarinaColumn>[] = [
    {
      accessorKey: "code",
      header: "الكود",
      cell: ({ row }) => row.original.code || "-",
    },
    { accessorKey: "nameAr", header: "الاسم العربي" },
    {
      accessorKey: "nameEn",
      header: "الاسم الإنجليزي",
      cell: ({ row }) => row.original.nameEn || "-",
    },
    {
      accessorKey: "imageUrl",
      header: "الصورة",
      cell: ({ row }) => (
        <ImageCell src={row.original.imageUrl} alt={row.original.nameAr} />
      ),
    },
    {
      accessorKey: "cityNameAr",
      header: "المدينة",
      cell: ({ row }) => row.original.cityNameAr || "-",
    },
    {
      accessorKey: "length",
      header: "الطول",
      cell: ({ row }) => row.original.length ?? "-",
    },
    {
      accessorKey: "northSide",
      header: "الحد البحرى",
      cell: ({ row }) => row.original.northSide || "-",
    },
    {
      accessorKey: "southSide",
      header: "الحد القبلي",
      cell: ({ row }) => row.original.southSide || "-",
    },
  ];

  const auditCols: ColumnDef<TouristMarinaColumn>[] = [
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
