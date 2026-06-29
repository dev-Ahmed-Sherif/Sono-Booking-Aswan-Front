"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHART_PERIOD_OPTIONS,
  type ChartPeriod,
} from "@/lib/dashboard-chart";

type DashboardPeriodSelectProps = {
  value: ChartPeriod;
  onChange: (value: ChartPeriod) => void;
};

export function DashboardPeriodSelect({
  value,
  onChange,
}: DashboardPeriodSelectProps) {
  return (
    <div className="flex justify-center">
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as ChartPeriod)}
      >
        <SelectTrigger className="w-[220px]" dir="rtl">
          <SelectValue placeholder="اختر الفترة" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {CHART_PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
