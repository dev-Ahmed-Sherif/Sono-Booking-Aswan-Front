"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApartmentColumn } from "@/components/settings/unit-data/columns";

type CellActionProps = { data: ApartmentColumn };

const CellAction = ({ data }: CellActionProps) => {
  const params = useParams();
  const router = useRouter();

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => router.push(`/${params.locale}/settings/unit-data/${data.id}`)}
        title="تعديل"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">تعديل</span>
      </Button>
    </div>
  );
};

export default CellAction;
