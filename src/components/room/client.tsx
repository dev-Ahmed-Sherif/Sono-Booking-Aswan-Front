"use client";

import RoomForm from "@/components/room/room-form";
import { RoomFormValues } from "@/schemas";

type RoomClientProps = {
  defaultValues?: Partial<RoomFormValues>;
  statusOptions?: string[];
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
