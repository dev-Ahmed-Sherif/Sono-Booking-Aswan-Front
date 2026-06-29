"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGovernorDashboardSummary } from "@/actions/dashboardService";
import {
  parseGovernorDashboardResponse,
  type ApprovedRequestItem,
  type ApartmentOccupancyItem,
  type DashboardDailyStat,
} from "@/lib/dashboard-map";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { DashboardPeriodSelect } from "@/components/dashboard/dashboard-period-select";
import { GovernorDashboardChartsSection } from "@/components/dashboard/governor-dashboard-charts-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useEffectiveRole } from "@/hooks/use-effective-role";
import {
  getAllowedNavRoutes,
  getFirstAllowedNavRoute,
} from "@/lib/nav-routes";
import type { ChartPeriod } from "@/lib/dashboard-chart";
import {
  buildDashboardKpis,
  buildDashboardOccupancy,
  getPeriodSummaryLabel,
} from "@/lib/dashboard-period";

type KpiItem = { label: string; value: string };

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const { roleCandidates, isRoleReady } = useEffectiveRole();

  const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
  const [occupancyData, setOccupancyData] = useState<ApartmentOccupancyItem[]>(
    [],
  );
  const [approvedRequests, setApprovedRequests] = useState<
    ApprovedRequestItem[]
  >([]);
  const [dailyStats, setDailyStats] = useState<DashboardDailyStat[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>("month");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await getGovernorDashboardSummary();
      const parsed = parseGovernorDashboardResponse(response);

      if ("error" in parsed) {
        setKpiItems([]);
        setOccupancyData([]);
        setApprovedRequests([]);
        setDailyStats([]);
        setLoadError(parsed.message);
        return;
      }

      setApprovedRequests(parsed.approvedRequests);
      setDailyStats(parsed.dailyStats);
    } catch {
      setKpiItems([]);
      setOccupancyData([]);
      setApprovedRequests([]);
      setDailyStats([]);
      setLoadError("تعذر تحميل بيانات لوحة التحكم.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isRoleReady) return;
    const dashboardHref = `/${locale}/dashboard`;
    const allowedRoutes = getAllowedNavRoutes(locale, roleCandidates);
    if (!allowedRoutes.some((route) => route.href === dashboardHref)) {
      router.replace(getFirstAllowedNavRoute(locale, roleCandidates));
    }
  }, [isRoleReady, locale, roleCandidates, router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (dailyStats.length === 0) {
      setKpiItems([]);
      setOccupancyData([]);
      return;
    }

    setKpiItems(buildDashboardKpis(dailyStats, period));
    setOccupancyData(buildDashboardOccupancy(dailyStats, period));
  }, [dailyStats, period]);

  const periodSummaryLabel = useMemo(
    () => getPeriodSummaryLabel(period),
    [period],
  );

  const {
    paginatedItems: paginatedApprovedRequests,
    page: approvedRequestsPage,
    setPage: setApprovedRequestsPage,
    pageCount: approvedRequestsPageCount,
    pageSize: approvedRequestsPageSize,
    totalItems: approvedRequestsTotalItems,
  } = useTablePagination(approvedRequests);

  return (
    <main dir="rtl" className="min-h-screen bg-muted p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>جاري تحميل تقرير المحافظ...</span>
          </div>
        ) : null}

        {!loading && loadError ? (
          <Card className="border-destructive/30 bg-card">
            <CardContent className="py-8 text-center text-destructive">
              {loadError}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !loadError ? (
          <>
            <motion.section
              className="space-y-4"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <h2 className="text-right text-2xl font-semibold text-foreground">
                تقرير للمحافظ
              </h2>
              <DashboardPeriodSelect value={period} onChange={setPeriod} />
              <p className="text-center text-sm text-muted-foreground">
                {periodSummaryLabel}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {kpiItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45 + index * 0.06, duration: 0.35 }}
                  >
                    <Card className="border-0 bg-card shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-center text-base font-medium text-muted-foreground">
                          {item.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-center text-4xl font-bold text-brand-accent">
                          {item.value}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              <GovernorDashboardChartsSection data={dailyStats} period={period} />
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              <Card className="border-0 bg-card shadow-none">
                <CardHeader>
                  <CardTitle className="text-right text-2xl font-semibold text-foreground">
                    إشغال كل شقة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {occupancyData.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">
                      لا توجد بيانات إشغال للشقق حالياً.
                    </p>
                  ) : (
                    <div className="grid min-h-[280px] grid-cols-2 items-end gap-4 rounded-md bg-background p-4 sm:grid-cols-3 md:grid-cols-5">
                      {occupancyData.map((item) => (
                        <div
                          key={item.unitLabel}
                          className="flex h-full flex-col items-center justify-end"
                        >
                          <div className="relative flex h-52 w-full items-end rounded-sm bg-muted">
                            <div
                              className="w-full rounded-sm bg-brand-accent transition-all"
                              style={{
                                height: `${Math.max(item.percent, 10)}%`,
                              }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center text-sm">
                              <p className="font-semibold text-brand-accent">
                                {item.percent}%
                              </p>
                              <p className="font-medium text-foreground">
                                {item.unitLabel}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <Card className="border-0 bg-card shadow-none">
                <CardHeader>
                  <CardTitle className="text-right text-2xl font-semibold text-foreground">
                    آخر 10 طلبات موافق عليها
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">
                            رقم الطلب
                          </TableHead>
                          <TableHead className="text-right">
                            اسم الطالب
                          </TableHead>
                          <TableHead className="text-right">
                            سبب الطلب
                          </TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedRequests.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="py-10 text-center text-muted-foreground"
                            >
                              لا توجد طلبات موافق عليها لعرضها.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedApprovedRequests.map((request) => (
                            <TableRow key={`${request.id}-${request.date}`}>
                              <TableCell className="font-medium">
                                {request.id}
                              </TableCell>
                              <TableCell>{request.name}</TableCell>
                              <TableCell>{request.reason}</TableCell>
                              <TableCell>{request.date}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <TablePagination
                      totalItems={approvedRequestsTotalItems}
                      page={approvedRequestsPage}
                      pageCount={approvedRequestsPageCount}
                      pageSize={approvedRequestsPageSize}
                      onPageChange={setApprovedRequestsPage}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : null}
      </div>
      <div className="mb-14 h-24 text-transparent">t</div>
    </main>
  );
};

export default DashboardPage;
