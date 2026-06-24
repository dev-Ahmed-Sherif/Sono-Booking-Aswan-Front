"use client";

import RoomForm from "@/components/room/room-form";
import { RoomFormValues } from "@/schemas";

type LookupOption = { id: string; nameAr: string; nameEn?: string };

type RoomClientProps = {
  defaultValues?: Partial<RoomFormValues>;
  statusOptions?: LookupOption[];
  apartmentTypeOptions?: LookupOption[];
  apartmentTypeId?: string;
  apartmentRefreshKey?: number;
  onSubmit?: (values: RoomFormValues) => void | Promise<void>;
};

const RoomClient = ({
  defaultValues,
  statusOptions,
  apartmentTypeOptions,
  apartmentTypeId,
  apartmentRefreshKey,
  onSubmit,
}: RoomClientProps) => {
  return (
    <RoomForm
      defaultValues={defaultValues}
      statusOptions={statusOptions}
      apartmentTypeOptions={apartmentTypeOptions}
      apartmentTypeId={apartmentTypeId}
      apartmentRefreshKey={apartmentRefreshKey}
      onSubmit={onSubmit}
    />
  );
};

export default RoomClient;
