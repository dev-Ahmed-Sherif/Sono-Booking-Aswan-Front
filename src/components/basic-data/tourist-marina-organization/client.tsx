"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";
import {
  TouristMarinaOrganizationColumn,
  createColumns,
} from "@/components/basic-data/tourist-marina-organization/columns";

type ClientProps = {
  data: TouristMarinaOrganizationColumn[] | null;
  onEditClick?: (row: TouristMarinaOrganizationColumn) => void;
  onDeleteSuccess?: (id: string) => void;
};

const Client = memo(({ data, onEditClick, onDeleteSuccess }: ClientProps) => {
  const [tableData, setTableData] = useState<TouristMarinaOrganizationColumn[]>(
    data ?? [],
  );

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

  return (
    <div className="mt-7 sm:mt-0 space-y-4">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
        <div className="w-full sm:w-auto text-center sm:text-right">
          <Heading
            title={`عدد البيانات (${tableData.length})`}
            description="إدارة جهات المراسي السياحية"
          />
        </div>
      </div>
      <Separator className="my-2" />
      <div className="overflow-x-auto rounded-md">
        <DataTable searchKey="licenseNumber" columns={columns} data={tableData} />
      </div>
    </div>
  );
});

Client.displayName = "Client";
export default Client;
