"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { memo, useMemo } from "react";

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
};

const Client = memo(({ data, path }: ClientProps) => {
  const router = useRouter();
  const user = useLocalStorage("user");
  const isSuperAdmin = useMemo(
    () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
    [user],
  );
  const columns = useMemo(
    () => createColumns(isSuperAdmin),
    [isSuperAdmin],
  );

  return (
    <div className="mt-7 sm:mt-0 space-y-4">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto text-center sm:text-right">
          <Heading
            title={`عدد البيانات (${
              data && data.length !== 0 ? data.length : 0
            })`}
            description="Manage Roles for your store"
          />
        </div>
        <Button
          onClick={() => router.push(path)}
          className="w-full sm:w-auto hover:bg-primary/90 transition-colors text-sm py-2"
          size="sm"
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          إضافة جديد
        </Button>
      </div>
      <Separator className="my-2" />
      <div className="overflow-x-auto rounded-md">
        <DataTable
          searchKey="nameAr"
          columns={columns}
          data={data != null ? data : []}
        />
      </div>
    </div>
  );
});

Client.displayName = "Client";

export default Client;

