"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import { ApartmentTypeColumn, createColumns } from "@/components/settings/apartment-types/columns";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ApartmentTypeClientProps = {
  data: ApartmentTypeColumn[] | null;
  path: string;
};

const Client = memo(({ data, path }: ApartmentTypeClientProps) => {
  const router = useRouter();
  const user = useLocalStorage("user");
  const rows = data ?? [];
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
          <Heading title={`عدد البيانات (${rows.length})`} description="إدارة بيانات الضبط والإعدادات" />
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
        <DataTable searchKey="nameAr" columns={columns} data={rows} />
      </div>
    </div>
  );
});

Client.displayName = "ApartmentTypeClient";

export default Client;
