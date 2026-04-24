"use client";

import { useState, useEffect } from "react";
import { options } from "@/lib/date-timeOptions";

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

    try {
      const date =
        typeof dateValue === "string" ? new Date(dateValue) : dateValue;

      if (isNaN(date.getTime())) {
        setFormattedDate("تاريخ غير صحيح");
        return;
      }

      // Format the date and normalize by removing Arabic comma
      const formatted = date.toLocaleString("ar-EG", options);
      // Replace Arabic comma (،) with space to ensure consistency
      setFormattedDate(formatted.replace(/،/g, " ").trim());
    } catch (error) {
      console.error("Error formatting date:", error);
      setFormattedDate("تاريخ غير صحيح");
    }
  }, [dateValue, isMounted]);

  // During SSR and initial render, return a placeholder that matches the expected format
  if (!isMounted) {
    return <span suppressHydrationWarning>...</span>;
  }

  return <span suppressHydrationWarning>{formattedDate}</span>;
}
