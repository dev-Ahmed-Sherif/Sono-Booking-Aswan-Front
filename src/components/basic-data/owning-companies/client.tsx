"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";
import {
  OwningCompanyColumn,
  createColumns,
} from "@/components/basic-data/owning-companies/columns";
import { IsDeletedFilterRadios } from "@/components/Shared/is-deleted-filter-radios";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  filterByIsDeleted,
  type IsDeletedFilter,
} from "@/lib/filter-by-is-deleted";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ClientProps = {
  data: OwningCompanyColumn[] | null;
  /** Card id = organization category id. Used for add path and passed to form for add/update. */
  organizationCategoryId: string;
  showFloatingRequirementsColumn?: boolean;
  showTouristMarinasColumn?: boolean;
  locale: string;
};

const Client = memo(
  ({
    data,
    organizationCategoryId,
    showFloatingRequirementsColumn = true,
    showTouristMarinasColumn = false,
    locale,
  }: ClientProps) => {
  const router = useRouter();
  const user = useLocalStorage("user");
  const addPath = `/${locale}/basic-data/owning-companies/${organizationCategoryId}/new`;
  const backPath = `/${locale}/basic-data/owning-companies`;
  const isSuperAdmin = useMemo(
    () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
    [user],
  );
  const columns = createColumns(
    showFloatingRequirementsColumn,
    showTouristMarinasColumn,
    isSuperAdmin,
  );
  const [deletedFilter, setDeletedFilter] = useState<IsDeletedFilter>("active");
  const tableData = useMemo(() => {
    const rows = data != null ? data : [];
    return isSuperAdmin ? filterByIsDeleted(rows, deletedFilter) : rows;
  }, [data, isSuperAdmin, deletedFilter]);

  return (
    <div className="mt-7 sm:mt-0 space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(backPath)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto text-center sm:text-right">
          <Heading title={`عدد البيانات (${tableData.length})`} description="إدارة الشركات المالكة" />
        </div>
        <Button onClick={() => router.push(addPath)} className="w-full sm:w-auto hover:bg-primary/90 transition-colors text-sm py-2" size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" /> إضافة جديد
        </Button>
      </div>
      <Separator className="my-2" />
      <div className="overflow-x-auto rounded-md">
        {isSuperAdmin ? (
          <IsDeletedFilterRadios
            value={deletedFilter}
            onChange={setDeletedFilter}
            className="mb-3 px-1"
          />
        ) : null}
        <DataTable
          searchKey="nameAr"
          columns={columns}
          data={tableData}
        />
      </div>
    </div>
  );
});
Client.displayName = "Client";
export default Client;
