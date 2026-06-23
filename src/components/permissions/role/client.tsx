"use client";

import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { getRoles } from "@/actions/permissions/roleService";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";

import {
  RoleColumn,
  createColumns,
} from "@/components/permissions/role/columns";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ClientProps = {
  data: RoleColumn[] | null;
  path: string;
  viewOnly?: boolean;
};

const Client = memo(({ data, path, viewOnly = false }: ClientProps) => {
  const router = useRouter();
  const user = useLocalStorage("user");
  const [rows, setRows] = useState<RoleColumn[]>(data ?? []);
  const [loading, setLoading] = useState(!data?.length);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isSuperAdmin = useMemo(
    () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
    [user],
  );
  const columns = useMemo(
    () => createColumns(isSuperAdmin, viewOnly),
    [isSuperAdmin, viewOnly],
  );

  useEffect(() => {
    let cancelled = false;

    const loadRoles = async () => {
      setLoading(true);
      setLoadError(null);

      const result = await getRoles();
      if (cancelled) return;

      if (result && "error" in result) {
        setRows([]);
        setLoadError(result.message || "تعذر تحميل الأدوار.");
        setLoading(false);
        return;
      }

      if ("data" in result && Array.isArray(result.data)) {
        setRows(result.data as RoleColumn[]);
      } else {
        setRows([]);
      }

      setLoading(false);
    };

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-7 sm:mt-0 space-y-4">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto text-center sm:text-right">
          <Heading
            title={`عدد البيانات (${rows.length})`}
            description={
              viewOnly ? "عرض أدوار النظام" : "Manage Roles for your store"
            }
          />
        </div>
        {!viewOnly ? (
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
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>جاري تحميل الأدوار...</span>
        </div>
      ) : loadError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-destructive">
          {loadError}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md">
          <DataTable searchKey="nameAr" columns={columns} data={rows} />
        </div>
      )}
    </div>
  );
});

Client.displayName = "Client";

export default Client;

