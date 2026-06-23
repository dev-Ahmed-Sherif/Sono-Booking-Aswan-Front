import type { DashboardDailyStat } from "@/lib/dashboard-map";

export type ChartPeriod = "day" | "week" | "month" | "3month" | "6month" | "1year";

export type DashboardChartMetric =
  | "totalRequests"
  | "approvedRequests"
  | "rejectedRequests"
  | "totalRevenue";

type BucketMode = "day" | "week" | "month";

export type ChartPeriodOption = {
  value: ChartPeriod;
  label: string;
  days: number;
  bucket: BucketMode;
};

export const CHART_PERIOD_OPTIONS: ChartPeriodOption[] = [
  { value: "day", label: "يوم", days: 1, bucket: "day" },
  { value: "week", label: "أسبوع", days: 7, bucket: "day" },
  { value: "month", label: "شهر", days: 30, bucket: "day" },
  { value: "3month", label: "3 أشهر", days: 90, bucket: "week" },
  { value: "6month", label: "6 أشهر", days: 180, bucket: "week" },
  { value: "1year", label: "سنة", days: 365, bucket: "month" },
];

export type ChartPoint = {
  label: string;
  value: number;
  date: string;
};

function formatDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${day}/${month}`;
}

function formatMonthLabel(date: string): string {
  const [year, month] = date.split("-");
  if (!year || !month) return date;
  return `${month}/${year}`;
}

function getPeriodOption(period: ChartPeriod): ChartPeriodOption {
  return (
    CHART_PERIOD_OPTIONS.find((option) => option.value === period) ??
    CHART_PERIOD_OPTIONS[2]
  );
}

function sliceDailyStats(
  data: DashboardDailyStat[],
  days: number,
): DashboardDailyStat[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(Math.max(0, sorted.length - days));
}

function bucketByWeek(
  rows: DashboardDailyStat[],
  metric: DashboardChartMetric,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  for (let index = 0; index < rows.length; index += 7) {
    const chunk = rows.slice(index, index + 7);
    if (chunk.length === 0) continue;

    points.push({
      date: chunk[0].date,
      label: formatDayLabel(chunk[0].date),
      value: chunk.reduce((sum, row) => sum + row[metric], 0),
    });
  }

  return points;
}

function bucketByMonth(
  rows: DashboardDailyStat[],
  metric: DashboardChartMetric,
): ChartPoint[] {
  const grouped = new Map<string, DashboardDailyStat[]>();

  for (const row of rows) {
    const monthKey = row.date.slice(0, 7);
    const bucket = grouped.get(monthKey) ?? [];
    bucket.push(row);
    grouped.set(monthKey, bucket);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, chunk]) => ({
      date: `${monthKey}-01`,
      label: formatMonthLabel(`${monthKey}-01`),
      value: chunk.reduce((sum, row) => sum + row[metric], 0),
    }));
}

export function buildMetricChartData(
  data: DashboardDailyStat[],
  period: ChartPeriod,
  metric: DashboardChartMetric,
): ChartPoint[] {
  const option = getPeriodOption(period);
  const sliced = sliceDailyStats(data, option.days);

  if (sliced.length === 0) return [];

  if (option.bucket === "week") {
    return bucketByWeek(sliced, metric);
  }

  if (option.bucket === "month") {
    return bucketByMonth(sliced, metric);
  }

  return sliced.map((row) => ({
    date: row.date,
    label: formatDayLabel(row.date),
    value: row[metric],
  }));
}

export function getChartTickInterval(pointCount: number): number {
  if (pointCount <= 7) return 0;
  if (pointCount <= 30) return 2;
  if (pointCount <= 90) return 4;
  return Math.max(1, Math.floor(pointCount / 8));
}

export function formatChartMetricValue(
  metric: DashboardChartMetric,
  value: number,
): string {
  if (metric === "totalRevenue") {
    return `${Math.round(value).toLocaleString("ar-EG")} جنيه`;
  }
  return String(value);
}

export const DASHBOARD_CHART_METRICS: Array<{
  metric: DashboardChartMetric;
  title: string;
  description: string;
  color: string;
}> = [
  {
    metric: "totalRequests",
    title: "إجمالي الطلبات",
    description: "الطلبات المقدمة في ذلك اليوم",
    color: "hsl(224 64% 33%)",
  },
  {
    metric: "approvedRequests",
    title: "الطلبات الموافق عليها",
    description: "الطلبات الموافق عليها المقدمة في ذلك اليوم",
    color: "hsl(142 71% 35%)",
  },
  {
    metric: "rejectedRequests",
    title: "الطلبات المرفوضة",
    description: "الطلبات المرفوضة المقدمة في ذلك اليوم",
    color: "hsl(0 72% 51%)",
  },
  {
    metric: "totalRevenue",
    title: "إجمالي الإيرادات",
    description: "مجموع مبالغ الدفع للحجوزات النشطة في ذلك اليوم",
    color: "hsl(32 95% 44%)",
  },
];
