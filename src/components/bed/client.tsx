"use client";

import BedForm from "@/components/bed/bed-form";
import { BedFormValues } from "@/schemas";

type LookupOption = { id: string; nameAr: string; nameEn?: string };

type BedClientProps = {
  defaultValues?: Partial<BedFormValues>;
  statusOptions?: LookupOption[];
  onSubmit?: (values: BedFormValues) => void | Promise<void>;
};

const BedClient = ({ defaultValues, statusOptions, onSubmit }: BedClientProps) => {
  return (
    <BedForm
      defaultValues={defaultValues}
      statusOptions={statusOptions}
      onSubmit={onSubmit}
    />
  );
};

export default BedClient;
