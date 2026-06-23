"use client";

import { useState, useEffect } from "react";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

interface DateCellProps {
  dateValue: string | Date | null | undefined;
}

export function DateCell({ dateValue }: DateCellProps) {
  const [formattedDate, setFormattedDate] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!dateValue) {
      setFormattedDate("غير متوفر");
      return;
    }

    const formatted = formatUtcToCairo(dateValue);
    setFormattedDate(formatted === "-" ? "تاريخ غير صحيح" : formatted);
  }, [dateValue, isMounted]);

  if (!isMounted) {
    return <span suppressHydrationWarning>...</span>;
  }

  return <span suppressHydrationWarning>{formattedDate}</span>;
}
