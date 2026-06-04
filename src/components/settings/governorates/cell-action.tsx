"use client";

import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash } from "lucide-react";
import { GovernorateColumn } from "@/components/settings/governorates/columns";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { deleteGovernorateById } from "@/actions/settings/governorateService";

type CellActionProps = { data: GovernorateColumn };

const CellAction = ({ data }: CellActionProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const [loading, toggleLoading] = useToggleState(false);
  const [open, toggleOpen] = useToggleState(false);

  const onDelete = async () => {
    try {
      toggleLoading();
      const result = await deleteGovernorateById(data.id);
      if (result?.error) {
        toast({
          variant: "destructive",
          title: "خطأ في الحذف",
          description: result.message || "❌ لم يتم الحذف",
          duration: 3000,
        });
        toggleLoading();
        toggleOpen();
        return;
      }
      toast({ description: "👍👍 تم الحذف بنجاح", duration: 2000 });
      toggleOpen();
      toggleLoading();
      setTimeout(() => {
        router.refresh();
        setTimeout(() => window.location.reload(), 500);
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "❌ لم يتم الحذف";
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: message,
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            router.push(`/${params.locale}/settings/governorates/${data.id}`)
          }
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
          onClick={() => toggleOpen()}
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
