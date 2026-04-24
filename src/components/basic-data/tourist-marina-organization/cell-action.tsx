"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TouristMarinaOrganizationColumn } from "@/components/basic-data/tourist-marina-organization/columns";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import {
  deleteTouristMarinaOrganizationById,
  softDeleteTouristMarinaOrganizationById,
} from "@/actions/basic-data/touristMarinaOrganizationService";

type CellActionProps = {
  data: TouristMarinaOrganizationColumn;
  onEditClick?: (data: TouristMarinaOrganizationColumn) => void;
  onDeleteSuccess?: (id: string) => void;
};

const CellAction = ({ data, onEditClick, onDeleteSuccess }: CellActionProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const user = useLocalStorage("user");
  const [loading, toggleLoading] = useToggleState(false);
  const [open, toggleOpen] = useToggleState(false);
  const locale = (params?.locale as string) ?? "ar";

  const superAdmin = isSuperAdminRoleCandidates(
    user.getItem() as RoleCandidates,
  );

  const onDelete = async () => {
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteTouristMarinaOrganizationById
        : softDeleteTouristMarinaOrganizationById;
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
      {superAdmin ? (
        <AlertModal
          isOpen={open}
          loading={loading}
          onClose={() => toggleOpen()}
          onConfirm={onDelete}
        />
      ) : null}
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            onEditClick
              ? onEditClick(data)
              : router.push(
                  `/${locale}/basic-data/tourist-marina-organization/${data.id}`,
                )
          }
          title="تعديل"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">تعديل</span>
        </Button>
        {superAdmin ? (
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
        ) : null}
      </div>
    </>
  );
};

export default CellAction;
