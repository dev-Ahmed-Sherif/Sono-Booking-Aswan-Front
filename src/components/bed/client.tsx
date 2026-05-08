"use client";

import BedForm from "@/components/bed/bed-form";
import { BedFormValues } from "@/schemas";

type BedClientProps = {
  defaultValues?: Partial<BedFormValues>;
  statusOptions?: string[];
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
