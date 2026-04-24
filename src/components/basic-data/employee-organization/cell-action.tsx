"use client";

import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { Pencil, Trash } from "lucide-react";
import { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import {
  deleteOrganizationStaffById,
  softDeleteOrganizationStaffById,
} from "@/actions/basic-data/organizationStaffService";

type CellActionProps = {
  data: EmployeeOrganizationColumn;
  onEditClick?: (data: EmployeeOrganizationColumn) => void;
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
  const [loading, toggleLoading] = useToggleState(false);
  const [open, toggleOpen] = useToggleState(false);

  const user = useLocalStorage("user");

  const onDelete = async () => {
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteOrganizationStaffById
        : softDeleteOrganizationStaffById;
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
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            onEditClick
              ? onEditClick(data)
              : router.push(
                  `/${params.locale}/basic-data/employee-organization/${data.id}`,
                )
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
