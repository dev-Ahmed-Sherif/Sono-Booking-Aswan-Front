"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";

import {
  CityColumn,
  createColumns,
} from "@/components/basic-data/city/columns";
import { IsDeletedFilterRadios } from "@/components/Shared/is-deleted-filter-radios";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  filterByIsDeleted,
  type IsDeletedFilter,
} from "@/lib/filter-by-is-deleted";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ClientProps = {
  data: CityColumn[] | null;
  /** When set, shows "إضافة جديد" navigating to this path (e.g. `/ar/basic-data/city/new`). */
  path?: string;
  onEditClick?: (row: CityColumn) => void;
  onDeleteSuccess?: (id: string) => void;
  /** When nested (e.g. governorate tabs), hide رجوع to basic-data. */
  hideBackButton?: boolean;
};

const Client = memo(
  ({
    data,
    path,
    onEditClick,
    onDeleteSuccess,
    hideBackButton = false,
  }: ClientProps) => {
    const params = useParams();
    const router = useRouter();
    const user = useLocalStorage("user");
    const locale = (params?.locale as string) ?? "ar";
    const backPath = `/${locale}/basic-data`;
    const isSuperAdmin = useMemo(
      () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
      [user],
    );
    const [deletedFilter, setDeletedFilter] =
      useState<IsDeletedFilter>("active");
    const [tableData, setTableData] = useState<CityColumn[]>(data ?? []);

    useEffect(() => {
      setTableData(data ?? []);
    }, [data]);

    const columns = useMemo(
      () =>
        createColumns(onEditClick, (id) => {
          setTableData((prev) => prev.filter((r) => r.id !== id));
          onDeleteSuccess?.(id);
        }),
      [onDeleteSuccess, onEditClick],
    );

    const displayRows = useMemo(() => {
      return isSuperAdmin
        ? filterByIsDeleted(tableData, deletedFilter)
        : tableData;
    }, [isSuperAdmin, tableData, deletedFilter]);

    return (
      <div className="mt-7 sm:mt-0 space-y-4">
        {!hideBackButton ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(backPath)}
            className="mb-2 h-10 px-4 gap-2 text-base"
          >
            <ArrowRight className="h-5 w-5" />
            رجوع
          </Button>
        ) : null}
        <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
          <div className="w-full sm:w-auto text-center sm:text-right">
            <Heading
              title={`عدد البيانات (${displayRows.length})`}
              description="إدارة المدن وربطها بالمحافظات"
            />
          </div>
          {path ? (
            <Button
              onClick={() => router.push(path)}
              className="w-full sm:w-auto hover:bg-primary/90 transition-colors text-sm py-2"
              size="sm"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              إضافة جديد
            </Button>
          ) : null}
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
            data={displayRows}
          />
        </div>
      </div>
    );
  },
);

Client.displayName = "Client";

export default Client;
