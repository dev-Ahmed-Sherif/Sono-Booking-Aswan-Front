"use client";

import { GovernorDashboardMetricChart } from "@/components/dashboard/governor-dashboard-metric-chart";
import { Card, CardContent } from "@/components/ui/card";
import { DASHBOARD_CHART_METRICS } from "@/lib/dashboard-chart";
import type { DashboardDailyStat } from "@/lib/dashboard-map";

type GovernorDashboardChartsSectionProps = {
  data: DashboardDailyStat[];
};

export function GovernorDashboardChartsSection({
  data,
}: GovernorDashboardChartsSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-right text-2xl font-semibold text-foreground">
        الإحصائيات التفصيلية
      </h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {DASHBOARD_CHART_METRICS.map((item) => (
          <Card key={item.metric} className="border-0 bg-card shadow-none">
            <CardContent className="p-6">
              <GovernorDashboardMetricChart
                title={item.title}
                description={item.description}
                metric={item.metric}
                color={item.color}
                data={data}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
