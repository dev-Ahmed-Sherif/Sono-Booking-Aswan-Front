"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildMetricChartData,
  formatChartMetricValue,
  getChartTickInterval,
  type ChartPeriod,
  type DashboardChartMetric,
} from "@/lib/dashboard-chart";
import type { DashboardDailyStat } from "@/lib/dashboard-map";

type GovernorDashboardMetricChartProps = {
  title: string;
  description: string;
  metric: DashboardChartMetric;
  color: string;
  data: DashboardDailyStat[];
  period: ChartPeriod;
};

export function GovernorDashboardMetricChart({
  title,
  description,
  metric,
  color,
  data,
  period,
}: GovernorDashboardMetricChartProps) {
  const chartData = useMemo(
    () => buildMetricChartData(data, period, metric),
    [data, metric, period],
  );

  const tickInterval = getChartTickInterval(chartData.length);
  const isRevenue = metric === "totalRevenue";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-1 text-right">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {chartData.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-16 text-center text-muted-foreground">
          لا توجد بيانات كافية لعرض الرسم البياني.
        </p>
      ) : (
        <div className="h-[280px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={tickInterval}
                minTickGap={12}
              />
              <YAxis
                allowDecimals={isRevenue}
                tick={{ fontSize: 11 }}
                width={isRevenue ? 52 : 36}
                tickFormatter={(value: number) =>
                  isRevenue && value >= 1000
                    ? `${Math.round(value / 1000)}k`
                    : String(value)
                }
              />
              <Tooltip
                contentStyle={{ direction: "rtl", textAlign: "right" }}
                formatter={(value) => [
                  formatChartMetricValue(metric, Number(value ?? 0)),
                  title,
                ]}
                labelFormatter={(label) => `التاريخ: ${label}`}
              />
              <Bar
                dataKey="value"
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
