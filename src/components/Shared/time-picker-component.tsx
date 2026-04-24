"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TimePickerComponent: React.FC<{
  id?: string;
  className?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  defaultValue?: string;
}> = ({
  id = "time-picker",
  className = "",
  value,
  onChange,
  defaultValue = "10:30:00",
  ...props
}) => {
  const [time, setTime] = React.useState(value || defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
    onChange?.(e);
  };

  React.useEffect(() => {
    if (value !== undefined) setTime(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      {/* <Label htmlFor={id} className="px-1">Time</Label> */}
      <Input
        dir="rtl"
        type="time"
        id={id}
        step="1"
        value={time}
        onChange={handleChange}
        className={
          "justify-end bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none " +
          className
        }
        {...props}
      />
    </div>
  );
};

export default TimePickerComponent;
