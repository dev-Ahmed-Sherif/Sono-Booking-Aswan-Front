"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import { RelationshipColumn, columns } from "@/components/settings/relationships/columns";

type RelationshipClientProps = {
  data: RelationshipColumn[] | null;
  path: string;
};

const Client = memo(({ data, path }: RelationshipClientProps) => {
  const router = useRouter();
  const rows = data ?? [];

  return (
    <div className="mt-7 sm:mt-0 space-y-4">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto text-center sm:text-right">
          <Heading
            pageName="العلاقات الأسرية"
            title={`عدد البيانات (${rows.length})`}
            description="إدارة بيانات الضبط والإعدادات"
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
        <DataTable searchKey="nameAr" columns={columns} data={rows} />
      </div>
    </div>
  );
});

Client.displayName = "RelationshipClient";

export default Client;
