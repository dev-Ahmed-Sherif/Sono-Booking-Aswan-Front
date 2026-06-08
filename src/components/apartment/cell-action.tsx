"use client";

import { Pencil, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { ApartmentColumn } from "@/components/apartment/columns";

type CellActionProps = {
  data: ApartmentColumn;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void | Promise<void>;
  deleting?: boolean;
};

const CellAction = ({
  data,
  onEdit,
  onDelete,
  deleting,
}: CellActionProps) => {
  const [open, toggleOpen] = useToggleState(false);

  const onConfirm = async () => {
    if (!onDelete) return;
    await onDelete(data.id);
    toggleOpen();
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={Boolean(deleting)}
        onClose={toggleOpen}
        onConfirm={onConfirm}
      />
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
          onClick={toggleOpen}
          disabled={deleting}
          title="حذف"
        >
          <Trash className="h-3.5 w-3.5" />
          <span className="sr-only">حذف</span>
        </Button>
      </div>
    </>
  );
};

export default CellAction;
