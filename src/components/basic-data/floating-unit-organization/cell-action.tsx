"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingUnitOrganizationColumn } from "@/components/basic-data/floating-unit-organization/columns";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import {
  deleteFloatingUnitOrganizationById,
  softDeleteFloatingUnitOrganizationById,
} from "@/actions/basic-data/floatingUnitOrganizationService";

type CellActionProps = {
  data: FloatingUnitOrganizationColumn;
  onEditClick?: (data: FloatingUnitOrganizationColumn) => void;
  onDeleteSuccess?: (id: string) => void;
};

const CellAction = ({
  data,
  onEditClick,
  onDeleteSuccess,
}: CellActionProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const user = useLocalStorage("user");
  const [loading, toggleLoading] = useToggleState(false);
  const [open, toggleOpen] = useToggleState(false);
  const locale = (params?.locale as string) ?? "ar";

  const onDelete = async () => {
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteFloatingUnitOrganizationById
        : softDeleteFloatingUnitOrganizationById;
      const result = await deleteFn(data.id);
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
      toast({
        description: superAdmin
          ? "👍👍 تم الحذف بنجاح"
          : "👍👍 تم الحذف (Soft) بنجاح",
        duration: 2000,
      });
      toggleOpen();
      toggleLoading();
      onDeleteSuccess?.(data.id);
      if (!onDeleteSuccess) {
        setTimeout(() => {
          router.refresh();
        }, 300);
      }
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err instanceof Error ? err.message : "❌ لم يتم الحذف",
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
