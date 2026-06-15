"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hash,
  Layers,
  Moon,
  Tag,
  XCircle,
} from "lucide-react";
import { useLocale } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtendDetailTile } from "@/components/reservation/extend-detail-tile";
import {
  getHousingRequestStatusPreviewMessage,
  isHousingRequestApproved,
  type HousingRequestTableRow,
} from "@/lib/housing-request-list";
import { formatLocaleNumber, getDateFnsLocale } from "@/lib/locale-format";
import { cn } from "@/lib/utils";

type ExtendSubmittedRequestPanelProps = {
  request: HousingRequestTableRow;
};

function formatDisplayDate(ymd: string, locale: string): string {
  if (!ymd || ymd === "—") return "—";
  try {
    return format(new Date(`${ymd.slice(0, 10)}T12:00:00`), "PPP", {
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return ymd;
  }
}

function statusVisual(status: string): {
  icon: typeof Clock3;
  badgeClass: string;
  iconClass: string;
} {
  switch (status) {
    case "تمت الموافقة":
      return {
        icon: CheckCircle2,
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
        iconClass: "text-emerald-600",
      };
    case "مرفوض":
    case "ملغى":
      return {
        icon: XCircle,
        badgeClass: "border-red-200 bg-red-50 text-red-800",
        iconClass: "text-red-600",
      };
    default:
      return {
        icon: Clock3,
        badgeClass: "border-amber-200 bg-amber-50 text-amber-900",
        iconClass: "text-amber-600",
      };
  }
}

export function ExtendSubmittedRequestPanel({
  request,
}: ExtendSubmittedRequestPanelProps) {
  const locale = useLocale();
  const isApproved = isHousingRequestApproved(request.status);
  const visual = statusVisual(request.status);
  const StatusIcon = visual.icon;
  const statusMessage = getHousingRequestStatusPreviewMessage(request.status);

  return (
    <div className="space-y-4 text-start">
      {isApproved ? (
        <Card className="overflow-hidden border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 shadow-md">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-100">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-emerald-900 sm:text-2xl">
                  تمت الموافقة على طلب التمديد
                </p>
                <p className="text-sm text-emerald-800/90">{statusMessage}</p>
              </div>
              <div
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold",
                  visual.badgeClass,
                )}
              >
                <StatusIcon className={cn("h-5 w-5", visual.iconClass)} />
                <span>{request.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-brand/25 bg-gradient-to-br from-brand-muted/50 via-card to-card shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="space-y-3 text-center">
              <p className="text-xl font-bold text-foreground">تم تقديم طلب تمديد</p>
              <div
                className={cn(
                  "mx-auto inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold",
                  visual.badgeClass,
                )}
              >
                <StatusIcon className={cn("h-5 w-5", visual.iconClass)} />
                <span>{request.status}</span>
              </div>
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-start gap-2 text-base">
            <FileText className="h-4 w-4 shrink-0 text-brand" />
            معاينة طلب التمديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">بيانات الطلب</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ExtendDetailTile
                label="رقم الطلب"
                value={request.requestNo}
                icon={Hash}
              />
              <ExtendDetailTile
                label="تصنيف الطلب"
                value={request.requestClassification}
                icon={Tag}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">تفاصيل الحجز</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ExtendDetailTile
                label="نوع الطلب"
                value={request.requestType}
                icon={Layers}
              />
              <ExtendDetailTile
                label="نوع الحجز"
                value={request.requestAllocationType}
                icon={Layers}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">فترة التمديد</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ExtendDetailTile
                label="تاريخ البدء"
                value={formatDisplayDate(request.startDate, locale)}
                icon={CalendarDays}
              />
              <ExtendDetailTile
                label="عدد الليالي"
                value={
                  request.nights > 0
                    ? formatLocaleNumber(request.nights, locale)
                    : "—"
                }
                icon={Moon}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
