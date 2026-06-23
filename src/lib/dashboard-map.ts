export type ApartmentOccupancyItem = {
  unitLabel: string;
  percent: number;
};

export type ApprovedRequestItem = {
  id: string;
  name: string;
  reason: string;
  date: string;
};

export type DashboardDailyStat = {
  date: string;
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalRevenue: number;
};

export type GovernorDashboardData = {
  kpiItems: Array<{ label: string; value: string }>;
  occupancyData: ApartmentOccupancyItem[];
  approvedRequests: ApprovedRequestItem[];
  dailyStats: DashboardDailyStat[];
};

function pickNum(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pickStr(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function formatRevenueAr(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString("ar-EG")} جنيه`;
}

export function parseGovernorDashboardResponse(
  response: unknown,
): GovernorDashboardData | { error: string; message: string } {
  if (!response || typeof response !== "object") {
    return { error: "Invalid Response", message: "تعذر قراءة بيانات لوحة التحكم." };
  }

  const envelope = response as Record<string, unknown>;
  if (envelope.error) {
    return {
      error: String(envelope.error),
      message: String(envelope.message ?? "حدث خطأ أثناء تحميل لوحة التحكم."),
    };
  }

  const payload =
    envelope.data && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : envelope;

  const todayTotal = pickNum(payload, ["todayTotalRequests", "TodayTotalRequests"]);
  const todayApproved = pickNum(payload, [
    "todayApprovedRequests",
    "TodayApprovedRequests",
  ]);
  const todayRejected = pickNum(payload, [
    "todayRejectedRequests",
    "TodayRejectedRequests",
  ]);
  const occupancyPercent = pickNum(payload, ["occupancyPercent", "OccupancyPercent"]);
  const totalRevenue = pickNum(payload, ["totalRevenue", "TotalRevenue"]);

  const occupancyRaw = payload.apartmentOccupancy ?? payload.ApartmentOccupancy;
  const occupancyData: ApartmentOccupancyItem[] = Array.isArray(occupancyRaw)
    ? occupancyRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          unitLabel: pickStr(row, ["unitLabel", "UnitLabel"]) || "—",
          percent: pickNum(row, ["percent", "Percent"]),
        };
      })
    : [];

  const approvedRaw =
    payload.latestApprovedRequests ?? payload.LatestApprovedRequests;
  const approvedRequests: ApprovedRequestItem[] = Array.isArray(approvedRaw)
    ? approvedRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          id: pickStr(row, ["id", "Id"]),
          name: pickStr(row, ["name", "Name"]),
          reason: pickStr(row, ["reason", "Reason"]),
          date: pickStr(row, ["date", "Date"]),
        };
      })
    : [];

  const dailyRaw = payload.dailyStats ?? payload.DailyStats;
  const dailyStats: DashboardDailyStat[] = Array.isArray(dailyRaw)
    ? dailyRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          date: pickStr(row, ["date", "Date"]),
          totalRequests: pickNum(row, ["totalRequests", "TotalRequests"]),
          approvedRequests: pickNum(row, ["approvedRequests", "ApprovedRequests"]),
          rejectedRequests: pickNum(row, ["rejectedRequests", "RejectedRequests"]),
          totalRevenue: pickNum(row, ["totalRevenue", "TotalRevenue"]),
        };
      })
    : [];

  return {
    kpiItems: [
      { label: "إجمالي طلبات اليوم", value: String(todayTotal) },
      { label: "الطلبات الموافق عليها", value: String(todayApproved) },
      { label: "الطلبات المرفوضة", value: String(todayRejected) },
      { label: "نسبة الإشغال", value: `${occupancyPercent}%` },
      { label: "إجمالي الإيرادات", value: formatRevenueAr(totalRevenue) },
    ],
    occupancyData,
    approvedRequests,
    dailyStats,
  };
}
