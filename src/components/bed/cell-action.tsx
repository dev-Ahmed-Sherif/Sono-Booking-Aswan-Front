"use client";

import { Pencil, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BedColumn } from "@/components/bed/columns";

type CellActionProps = {
  data: BedColumn;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const CellAction = ({ data, onEdit, onDelete }: CellActionProps) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onEdit?.(data.id)}
        title="تعديل"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">تعديل</span>
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="h-8 w-8"
        onClick={() => onDelete?.(data.id)}
        title="حذف"
      >
        <Trash className="h-3.5 w-3.5" />
        <span className="sr-only">حذف</span>
      </Button>
    </div>
  );
};

export default CellAction;
