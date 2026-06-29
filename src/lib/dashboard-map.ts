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
  occupancyPercent: number;
  apartmentOccupancy: ApartmentOccupancyItem[];
};

export type GovernorDashboardData = {
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
        const apartmentRaw = row.apartmentOccupancy ?? row.ApartmentOccupancy;
        const apartmentOccupancy: ApartmentOccupancyItem[] = Array.isArray(
          apartmentRaw,
        )
          ? apartmentRaw.map((entry) => {
              const apartment = (entry ?? {}) as Record<string, unknown>;
              return {
                unitLabel:
                  pickStr(apartment, ["unitLabel", "UnitLabel"]) || "—",
                percent: pickNum(apartment, ["percent", "Percent"]),
              };
            })
          : [];

        return {
          date: pickStr(row, ["date", "Date"]),
          totalRequests: pickNum(row, ["totalRequests", "TotalRequests"]),
          approvedRequests: pickNum(row, ["approvedRequests", "ApprovedRequests"]),
          rejectedRequests: pickNum(row, ["rejectedRequests", "RejectedRequests"]),
          totalRevenue: pickNum(row, ["totalRevenue", "TotalRevenue"]),
          occupancyPercent: pickNum(row, ["occupancyPercent", "OccupancyPercent"]),
          apartmentOccupancy,
        };
      })
    : [];

  const topLevelOccupancyRaw =
    payload.apartmentOccupancy ?? payload.ApartmentOccupancy;
  const topLevelOccupancy: ApartmentOccupancyItem[] = Array.isArray(
    topLevelOccupancyRaw,
  )
    ? topLevelOccupancyRaw.map((entry) => {
        const apartment = (entry ?? {}) as Record<string, unknown>;
        return {
          unitLabel: pickStr(apartment, ["unitLabel", "UnitLabel"]) || "—",
          percent: pickNum(apartment, ["percent", "Percent"]),
        };
      })
    : [];

  const occupancyData =
    dailyStats.length > 0
      ? dailyStats[dailyStats.length - 1].apartmentOccupancy
      : topLevelOccupancy;

  return {
    occupancyData,
    approvedRequests,
    dailyStats,
  };
}
