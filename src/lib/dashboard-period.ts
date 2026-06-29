import type { ApartmentOccupancyItem, DashboardDailyStat } from "@/lib/dashboard-map";

import type { ChartPeriod } from "@/lib/dashboard-chart";

import {

  CHART_PERIOD_OPTIONS,

  formatChartMetricValue,

} from "@/lib/dashboard-chart";



export type DashboardKpiItem = {

  label: string;

  value: string;

};



function getPeriodOption(period: ChartPeriod) {

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



function getLastDaySnapshot(rows: DashboardDailyStat[]): DashboardDailyStat | null {

  if (rows.length === 0) return null;

  return rows[rows.length - 1];

}



function formatRevenueAr(amount: number): string {

  const rounded = Math.round(amount);

  return `${rounded.toLocaleString("ar-EG")} جنيه`;

}



export function buildDashboardKpis(

  dailyStats: DashboardDailyStat[],

  period: ChartPeriod,

): DashboardKpiItem[] {

  const option = getPeriodOption(period);

  const rows = sliceDailyStats(dailyStats, option.days);

  const snapshot = getLastDaySnapshot(rows);



  const totalRequests = rows.reduce((sum, row) => sum + row.totalRequests, 0);

  const approvedRequests = rows.reduce(

    (sum, row) => sum + row.approvedRequests,

    0,

  );

  const rejectedRequests = rows.reduce(

    (sum, row) => sum + row.rejectedRequests,

    0,

  );

  const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);

  const occupancyPercent = snapshot?.occupancyPercent ?? 0;



  return [

    { label: "إجمالي الطلبات", value: String(totalRequests) },

    { label: "الطلبات الموافق عليها", value: String(approvedRequests) },

    { label: "الطلبات المرفوضة", value: String(rejectedRequests) },

    { label: "نسبة الإشغال", value: `${occupancyPercent}%` },

    { label: "إجمالي الإيرادات", value: formatRevenueAr(totalRevenue) },

  ];

}



export function buildDashboardOccupancy(

  dailyStats: DashboardDailyStat[],

  period: ChartPeriod,

): ApartmentOccupancyItem[] {

  const option = getPeriodOption(period);

  const rows = sliceDailyStats(dailyStats, option.days);

  const snapshot = getLastDaySnapshot(rows);

  return snapshot?.apartmentOccupancy ?? [];

}



export function getPeriodSummaryLabel(period: ChartPeriod): string {

  const option = getPeriodOption(period);

  return `ملخص ${option.label}`;

}



export { formatChartMetricValue };

