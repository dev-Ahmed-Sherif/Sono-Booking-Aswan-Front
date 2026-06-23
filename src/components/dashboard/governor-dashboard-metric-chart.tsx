"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildMetricChartData,
  CHART_PERIOD_OPTIONS,
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
};

export function GovernorDashboardMetricChart({
  title,
  description,
  metric,
  color,
  data,
}: GovernorDashboardMetricChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("month");

  const chartData = useMemo(
    () => buildMetricChartData(data, period, metric),
    [data, metric, period],
  );

  const tickInterval = getChartTickInterval(chartData.length);
  const isRevenue = metric === "totalRevenue";
  const ChartComponent = isRevenue ? LineChart : BarChart;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-right">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Select
          value={period}
          onValueChange={(value) => setPeriod(value as ChartPeriod)}
        >
          <SelectTrigger className="w-full sm:w-[180px]" dir="rtl">
            <SelectValue placeholder="اختر الفترة" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            {CHART_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-16 text-center text-muted-foreground">
          لا توجد بيانات كافية لعرض الرسم البياني.
        </p>
      ) : (
        <div className="h-[280px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent
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
              {isRevenue ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={chartData.length <= 31}
                  activeDot={{ r: 4 }}
                />
              ) : (
                <Bar
                  dataKey="value"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              )}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
