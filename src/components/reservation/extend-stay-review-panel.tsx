"use client";

import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Bed, Building2, Home, Loader2, Users } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";
import type { ExtendStayCompanionRow } from "@/lib/reservation-extend-submit";
import { AvailabilityUnitCardParents } from "@/components/reservation/availability-unit-card-parents";
import { AvailabilityUnitCardPrice } from "@/components/reservation/availability-unit-card-price";
import { cn } from "@/lib/utils";

type ExtendStayReviewPanelProps = {
  startDate: string;
  nights: string;
  allocationTypeLabel: string;
  requestTypeLabel: string;
  genderLabels: string;
  unitCards: AvailabilityUnitCard[];
  companions: ExtendStayCompanionRow[];
  submitting: boolean;
  onConfirm: () => void;
};

function formatStartDateDisplay(startDate: string): string {
  if (!startDate.trim()) return "—";
  try {
    return format(new Date(`${startDate}T12:00:00`), "PPP", { locale: ar });
  } catch {
    return startDate;
  }
}

export function ExtendStayReviewPanel({
  startDate,
  nights,
  allocationTypeLabel,
  requestTypeLabel,
  genderLabels,
  unitCards,
  companions,
  submitting,
  onConfirm,
}: ExtendStayReviewPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-2xl border-2 border-border bg-muted/20 p-4"
    >
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ملخص طلب التمديد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">تاريخ البدء: </span>
            <span className="font-semibold">{formatStartDateDisplay(startDate)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">عدد الليالي: </span>
            <span className="font-semibold">{nights || "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">نوع الطلب: </span>
            <span className="font-semibold">{requestTypeLabel || "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">الجنس: </span>
            <span className="font-semibold">{genderLabels || "—"}</span>
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">نوع الحجز: </span>
            <span className="font-semibold">{allocationTypeLabel || "—"}</span>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">الوحدات (من الإقامة الحالية)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {unitCards.map((card) => (
            <div
              key={`${card.unitKind}:${card.id}`}
              className={cn(
                "rounded-2xl border-2 p-4 text-right shadow-sm",
                card.unitKind === "bed" &&
                  "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-slate-50/80",
                card.unitKind === "room" &&
                  "border-teal-200 bg-gradient-to-br from-teal-50 via-white to-slate-50/80",
                card.unitKind === "apartment" &&
                  "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-slate-50/80",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "shrink-0 rounded-xl p-2.5",
                    card.unitKind === "bed" &&
                      "border border-sky-200/80 bg-sky-100 text-sky-800",
                    card.unitKind === "room" &&
                      "border border-teal-200/80 bg-teal-100 text-teal-800",
                    card.unitKind === "apartment" &&
                      "border border-violet-200/80 bg-violet-100 text-violet-800",
                  )}
                >
                  {card.unitKind === "bed" ? (
                    <Bed className="h-5 w-5" />
                  ) : card.unitKind === "room" ? (
                    <Home className="h-5 w-5" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-base text-slate-900">{card.title}</p>
                  <AvailabilityUnitCardParents card={card} />
                  <AvailabilityUnitCardPrice card={card} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4" />
          المرافقون
        </h3>
        {companions.length === 0 ? (
          <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            لا يوجد مرافقون في الطلب السابق.
          </p>
        ) : (
          <ul className="space-y-2">
            {companions.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium"
              >
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        disabled={submitting}
        onClick={onConfirm}
        className="w-full py-5 rounded-2xl font-semibold text-base bg-brand text-brand-foreground shadow-lg transition-all duration-300 hover:scale-[1.02] hover:bg-brand-hover hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            جارٍ تأكيد الطلب...
          </span>
        ) : (
          "تاكيد طلب التمديد"
        )}
      </Button>
    </motion.div>
  );
}
