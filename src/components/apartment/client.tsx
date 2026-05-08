"use client";

import ApartmentForm from "@/components/apartment/apartment-form";
import { ApartmentFormValues } from "@/schemas";

type ApartmentClientProps = {
  defaultValues?: Partial<ApartmentFormValues>;
  allocationOptions?: string[];
  allocationTypeOptions?: string[];
  statusOptions?: string[];
  governorateOptions?: Array<{ id: string; nameAr: string }>;
  cityOptions?: Array<{ id: string; nameAr: string; governorateId: string }>;
  onSubmit?: (values: ApartmentFormValues) => void | Promise<void>;
};

const ApartmentClient = ({
  defaultValues,
  allocationOptions,
  allocationTypeOptions,
  statusOptions,
  governorateOptions,
  cityOptions,
  onSubmit,
}: ApartmentClientProps) => {
  return (
    <ApartmentForm
      defaultValues={defaultValues}
      allocationOptions={allocationOptions}
      allocationTypeOptions={allocationTypeOptions}
      statusOptions={statusOptions}
      governorateOptions={governorateOptions}
      cityOptions={cityOptions}
      onSubmit={onSubmit}
    />
  );
};

export default ApartmentClient;
