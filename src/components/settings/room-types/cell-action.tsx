"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { useToast } from "@/hooks/use-toast";
import * as service from "@/actions/settings/roomTypeService";
import { RoomTypeColumn } from "@/components/settings/room-types/columns";

type CellActionProps = { data: RoomTypeColumn };
type ServiceFn = (arg: any) => Promise<any>;

const svc = service as unknown as Record<string, ServiceFn | undefined>;
const deleteFn = svc["deleteRoomTypeById"];
const softDeleteFn = svc["softDeleteRoomTypeById"];

const CellAction = ({ data }: CellActionProps) => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const onDelete = async () => {
    if (!deleteFn && !softDeleteFn) {
      toast({ variant: "destructive", description: "لا توجد دالة حذف متاحة حاليا" });
      return;
    }

    try {
      toggleLoading();
      const fn = softDeleteFn ?? deleteFn;
      const result = await fn?.(data.id);
      if (result?.error) throw new Error(result.message || "فشل الحذف");
      toast({ description: "تم حذف البيان بنجاح" });
      toggleOpen();
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: error?.message || "لم يتم الحذف",
      });
    } finally {
      toggleLoading();
    }
  };

  return (
    <>
      <AlertModal isOpen={open} loading={loading} onClose={toggleOpen} onConfirm={onDelete} />
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push(`/${params.locale}/settings/room-types/${data.id}`)}
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
