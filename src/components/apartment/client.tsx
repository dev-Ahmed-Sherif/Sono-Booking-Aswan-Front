"use client";

import ApartmentForm from "@/components/apartment/apartment-form";
import { ApartmentFormValues } from "@/schemas";

type ApartmentClientProps = {
  defaultValues?: Partial<ApartmentFormValues>;
  genderOptions?: Array<{ id: string; nameAr: string; nameEn?: string }>;
  allocationTypeOptions?: Array<{ id: string; nameAr: string; nameEn?: string }>;
  apartmentTypeOptions?: Array<{ id: string; nameAr: string; nameEn?: string }>;
  statusOptions?: Array<{ id: string; nameAr: string; nameEn?: string }>;
  governorateOptions?: Array<{ id: string; nameAr: string; nameEn?: string }>;
  cityOptions?: Array<{ id: string; nameAr: string; governorateId: string }>;
  onSubmit?: (values: ApartmentFormValues) => void | Promise<void>;
};

const ApartmentClient = ({
  defaultValues,
  genderOptions,
  allocationTypeOptions,
  apartmentTypeOptions,
  statusOptions,
  governorateOptions,
  cityOptions,
  onSubmit,
}: ApartmentClientProps) => {
  return (
    <ApartmentForm
      defaultValues={defaultValues}
      genderOptions={genderOptions}
      allocationTypeOptions={allocationTypeOptions}
      apartmentTypeOptions={apartmentTypeOptions}
      statusOptions={statusOptions}
      governorateOptions={governorateOptions}
      cityOptions={cityOptions}
      onSubmit={onSubmit}
    />
  );
};

export default ApartmentClient;
