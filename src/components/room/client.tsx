"use client";

import RoomForm from "@/components/room/room-form";
import { RoomFormValues } from "@/schemas";

type LookupOption = { id: string; nameAr: string; nameEn?: string };

type RoomClientProps = {
  defaultValues?: Partial<RoomFormValues>;
  statusOptions?: LookupOption[];
  onSubmit?: (values: RoomFormValues) => void | Promise<void>;
};

const RoomClient = ({ defaultValues, statusOptions, onSubmit }: RoomClientProps) => {
  return (
    <RoomForm
      defaultValues={defaultValues}
      statusOptions={statusOptions}
      onSubmit={onSubmit}
    />
  );
};

export default RoomClient;
