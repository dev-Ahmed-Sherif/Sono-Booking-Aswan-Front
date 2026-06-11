"use client";

import { format } from "date-fns";
import { CalendarDays, Loader2, Moon } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExtendDetailTile } from "@/components/reservation/extend-detail-tile";
import { countNightsBetweenStartAndEnd } from "@/lib/housing-request-list";
import { getDateFnsLocale, formatLocaleNumber } from "@/lib/locale-format";
import {
  formatReservationStatusAr,
  type ReservationDtoPayload,
} from "@/lib/reservation-map";

type ExtendStayReservationCardProps = {
  reservation: ReservationDtoPayload;
  loading?: boolean;
  extendStarted?: boolean;
  onExtend: () => void;
};

function formatDisplayDate(ymd: string, locale: string): string {
  try {
    return format(new Date(`${ymd.slice(0, 10)}T12:00:00`), "PPP", {
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return ymd;
  }
}

export function ExtendStayReservationCard({
  reservation,
  loading,
  extendStarted = false,
  onExtend,
}: ExtendStayReservationCardProps) {
  const locale = useLocale();
  const nights = countNightsBetweenStartAndEnd(
    reservation.startDate,
    reservation.endDate,
  );

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-card to-card shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5 text-start">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">آخر إقامة مكتملة</p>
          <p className="text-base font-semibold text-foreground">
            {formatReservationStatusAr(reservation.status)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ExtendDetailTile
            label="تاريخ البدء"
            value={formatDisplayDate(reservation.startDate, locale)}
            icon={CalendarDays}
          />
          <ExtendDetailTile
            label="تاريخ الانتهاء"
            value={formatDisplayDate(reservation.endDate, locale)}
            icon={CalendarDays}
          />
          <ExtendDetailTile
            label="الليالي"
            value={
              nights > 0 ? formatLocaleNumber(nights, locale) : "—"
            }
            icon={Moon}
          />
        </div>

        <Button
          type="button"
          className="w-full py-5 rounded-2xl font-semibold text-base"
          disabled={loading || extendStarted}
          onClick={onExtend}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ التحميل...
            </span>
          ) : extendStarted ? (
            "تم بدء تمديد الإقامة"
          ) : (
            "تمديد إقامة"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
