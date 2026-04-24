"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IsDeletedFilter } from "@/lib/filter-by-is-deleted";

type IsDeletedFilterRadiosProps = {
  value: IsDeletedFilter;
  onChange: (value: IsDeletedFilter) => void;
  className?: string;
};

const OPTIONS: { value: IsDeletedFilter; label: string }[] = [
  { value: "active", label: "الفعلى" },
  { value: "deleted", label: "المحذوف" },
  { value: "all", label: "الكل" },
];

export function IsDeletedFilterRadios({
  value,
  onChange,
  className,
}: IsDeletedFilterRadiosProps) {
  const uid = useId();
  const name = `is-deleted-${uid}`;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-center gap-6",
        className,
      )}
      dir="rtl"
      role="radiogroup"
      aria-label="تصفية حسب الحذف"
    >
      {OPTIONS.map(({ value: optionValue, label }) => (
        <div key={optionValue} className="flex items-center gap-2.5">
          <input
            type="radio"
            id={`${name}-${optionValue}`}
            name={name}
            checked={value === optionValue}
            onChange={() => onChange(optionValue)}
            className="h-5 w-5 accent-primary shrink-0"
          />
          <Label
            htmlFor={`${name}-${optionValue}`}
            className="cursor-pointer text-base font-normal sm:text-lg"
          >
            {label}
          </Label>
        </div>
      ))}
    </div>
  );
}
