"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cancelHousingReservation } from "@/actions/cancelHousingReservation";
import { checkoutHousingReservation } from "@/actions/checkoutHousingReservation";
import { getAllReservations } from "@/actions/reservationService";
import { getAllRequests, getRequestUnitsAll } from "@/actions/requestService";
import { getApartments } from "@/actions/settings/apartmentService";
import { getBeds } from "@/actions/settings/bedService";
import { getRooms } from "@/actions/settings/roomService";
import { canAccessHousingReceiverFromCandidates } from "@/lib/role-utils";
import { useEffectiveRole } from "@/hooks/use-effective-role";
import { useRequireRole } from "@/hooks/use-require-role";
import {
  buildReceiverReservationRows,
  filterActiveReservationsToday,
  filterUpcomingReservations,
  type ReceiverReservationRow,
} from "@/lib/reservation-receiver-list";
import { RESERVATION_STATUS_RESERVED } from "@/lib/reservation-map";
import { motion } from "framer-motion";
import { ClipboardList, Home, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReceiverView = "active" | "upcoming";

const pageContentVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.1, 0.25, 1] as const,
      staggerChildren: 0.12,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const mainCardVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const mainCardChildrenVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const receiverTableHeadClassName = "text-center align-middle";
const receiverTableBodyClassName =
  "[&_td]:text-center [&_td]:align-middle [&_td]:[&>div]:mx-auto [&_td]:[&>div]:flex [&_td]:[&>div]:flex-wrap [&_td]:[&>div]:justify-center [&_td]:[&>div]:gap-2 [&_td]:[&>button]:mx-auto";
const receiverTableCellClassName = cn(
  "text-center align-middle",
  "[&>div]:mx-auto [&>div]:flex [&>div]:flex-wrap [&>div]:justify-center [&>div]:gap-2",
  "[&>button]:mx-auto",
);
const receiverTableButtonClassName =
  "h-10 min-h-10 px-4 text-base font-medium";

const viewTitles: Record<ReceiverView, { title: string; description: string }> = {
  active: {
    title: "قسم الحجوزات النشطة اليوم",
    description: "عرض الحجوزات الحالية وإجراءات تأكيد الوصول",
  },
  upcoming: {
    title: "قسم الحجوزات المستقبلية الموافق عليها",
    description: "عرض الحجوزات القادمة المعتمدة",
  },
};

function ReservationTableEmpty({
  message,
  colSpan = 4,
}: {
  message: string;
  colSpan?: number;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-10 text-center text-gray-500"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

function canCancelReceiverReservation(status: ReceiverReservationRow["status"]) {
  return status === RESERVATION_STATUS_RESERVED;
}

function canCheckoutReceiverReservation(status: ReceiverReservationRow["status"]) {
  return status === RESERVATION_STATUS_RESERVED;
}

type ReceiverRowAction = "cancel" | "checkout";

const HousingReceiverPage = () => {
  const { roleCandidates, isRoleReady } = useEffectiveRole();
  const allowed = canAccessHousingReceiverFromCandidates(roleCandidates);
  useRequireRole({ allowed });
  const { toast } = useToast();

  const [activeView, setActiveView] = useState<ReceiverView>("active");
  const [allRows, setAllRows] = useState<ReceiverReservationRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    kind: ReceiverRowAction;
  } | null>(null);
  const fetchTicketRef = useRef(0);

  const loadReceiverData = useCallback(async () => {
    const ticket = ++fetchTicketRef.current;
    setDataLoading(true);
    setDataLoadError(null);

    try {
      const [
        reservationsRes,
        requestsRes,
        requestUnitsRes,
        bedsRes,
        roomsRes,
        apartmentsRes,
      ] = await Promise.all([
        getAllReservations(),
        getAllRequests(),
        getRequestUnitsAll(),
        getBeds(),
        getRooms(),
        getApartments(),
      ]);

      if (ticket !== fetchTicketRef.current) return;

      const built = buildReceiverReservationRows({
        reservationsRes,
        requestsRes,
        requestUnitsRes,
        bedsRes,
        roomsRes,
        apartmentsRes,
      });

      if (!built.ok) {
        setAllRows([]);
        setDataLoadError(built.message);
        return;
      }

      setAllRows(built.rows);
    } catch {
      if (ticket !== fetchTicketRef.current) return;
      setAllRows([]);
      setDataLoadError("تعذر تحميل الحجوزات.");
    } finally {
      if (ticket === fetchTicketRef.current) {
        setDataLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isRoleReady || !allowed) return;
    void loadReceiverData();
    return () => {
      fetchTicketRef.current += 1;
      setDataLoading(false);
    };
  }, [isRoleReady, allowed, loadReceiverData]);

  const activeReservations = useMemo(
    () => filterActiveReservationsToday(allRows),
    [allRows],
  );

  const upcomingReservations = useMemo(
    () => filterUpcomingReservations(allRows),
    [allRows],
  );

  const tableRows =
    activeView === "active" ? activeReservations : upcomingReservations;

  const runRowAction = useCallback(
    async (row: ReceiverReservationRow, kind: ReceiverRowAction) => {
      const isCancel = kind === "cancel";
      if (isCancel && !canCancelReceiverReservation(row.status)) return;
      if (!isCancel && !canCheckoutReceiverReservation(row.status)) return;

      const confirmed = window.confirm(
        isCancel
          ? `هل تريد إلغاء حجز ${row.userName}؟\nلا يمكن التراجع عن هذا الإجراء.`
          : `هل تريد تسجيل مغادرة ${row.userName} وإنهاء الإقامة؟`,
      );
      if (!confirmed) return;

      setPendingAction({ id: row.id, kind });
      try {
        const result = isCancel
          ? await cancelHousingReservation({
              id: row.id,
              requestId: row.requestId,
              startDateYmd: row.startDateYmd,
              endDateYmd: row.endDateYmd,
            })
          : await checkoutHousingReservation({
              id: row.id,
              requestId: row.requestId,
              startDateYmd: row.startDateYmd,
              endDateYmd: row.endDateYmd,
            });

        if (!result.ok) {
          toast({
            variant: "destructive",
            title: isCancel ? "فشل إلغاء الحجز" : "فشل تسجيل المغادرة",
            description: result.message,
          });
          return;
        }

        toast({
          title: isCancel ? "تم إلغاء الحجز" : "تم تسجيل المغادرة",
          description: isCancel
            ? `تم إلغاء حجز ${row.userName} بنجاح.`
            : `تم إنهاء إقامة ${row.userName} وتسجيل المغادرة.`,
        });

        if (result.unitReleaseWarning) {
          toast({
            variant: "destructive",
            title: "تنبيه: حالة الوحدات",
            description: result.unitReleaseWarning,
          });
        }

        void loadReceiverData();
      } catch {
        toast({
          variant: "destructive",
          title: isCancel ? "فشل إلغاء الحجز" : "فشل تسجيل المغادرة",
          description: "حدث خطأ غير متوقع.",
        });
      } finally {
        setPendingAction(null);
      }
    },
    [loadReceiverData, toast],
  );

  if (!isRoleReady || !allowed) {
    return null;
  }

  return (
    <main className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto" dir="rtl">
      <motion.div
        className="container mx-auto px-2 py-4 sm:px-4 md:px-6 lg:px-8"
        variants={mainCardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden rounded-3xl border-2 border-blue-100 shadow-xl">
          <motion.header
            className="relative z-10 flex items-center justify-center gap-3 border-b border-[#00004a] px-6 py-5 shadow-sm"
            style={{ backgroundColor: "#00005c" }}
            variants={mainCardChildrenVariants}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-green-500 to-blue-600 p-2 shadow-lg">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-wide text-white md:text-3xl">
                  نظام إدارة إسكان محافظة أسوان
                </h1>
                <p className="mt-1 text-sm text-white/85 md:text-base">
                  لوحة تحكم مسؤول الاستقبال
                </p>
              </div>
            </div>
          </motion.header>

          <motion.div
            className="px-2 py-4 sm:px-4 md:px-6 lg:px-8"
            variants={mainCardChildrenVariants}
          >
            <motion.div
              className="w-full"
              variants={pageContentVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[270px_1fr]">
                <motion.div variants={sectionVariants}>
                  <Card className="rounded-2xl border-2 border-blue-100">
                    <CardHeader>
                      <CardTitle className="text-base">الأقسام</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("active")}
                          variant={activeView === "active" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          الحجوزات النشطة
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("upcoming")}
                          variant={activeView === "upcoming" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          الحجوزات المستقبلية
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.section className="min-h-[420px]" variants={sectionVariants}>
                  <Card className="h-full rounded-3xl border-2 border-blue-200 bg-white text-gray-800 shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-gray-800 md:text-xl">
                            {viewTitles[activeView].title}
                          </CardTitle>
                          <p className="mt-1 pe-1 text-sm text-gray-500">
                            {viewTitles[activeView].description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {dataLoadError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {dataLoadError}
                        </p>
                      )}

                      <motion.div
                        key={activeView}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.1,
                          duration: 0.45,
                          type: "spring",
                          stiffness: 90,
                        }}
                      >
                        <div className="overflow-x-auto rounded-md border border-gray-200">
                          {dataLoading ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span>جاري تحميل الحجوزات…</span>
                            </div>
                          ) : activeView === "active" ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className={receiverTableHeadClassName}>
                                    صاحب الحجز
                                  </TableHead>
                                  <TableHead className={receiverTableHeadClassName}>
                                    الشقة/الغرفة/السرير
                                  </TableHead>
                                  <TableHead className={receiverTableHeadClassName}>
                                    تاريخ الوصول
                                  </TableHead>
                                  <TableHead className={receiverTableHeadClassName}>
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={receiverTableBodyClassName}>
                                {tableRows.map((reservation) => (
                                  <TableRow key={reservation.id}>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.userName}
                                    </TableCell>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.room}
                                    </TableCell>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.arrivalDate}
                                    </TableCell>
                                    <TableCell className={receiverTableCellClassName}>
                                      <div className="flex flex-wrap items-center justify-center gap-2">
                                        <Button
                                          type="button"
                                          disabled={
                                            !canCheckoutReceiverReservation(
                                              reservation.status,
                                            ) ||
                                            pendingAction?.id === reservation.id
                                          }
                                          onClick={() =>
                                            void runRowAction(
                                              reservation,
                                              "checkout",
                                            )
                                          }
                                          className={cn(
                                            receiverTableButtonClassName,
                                            "bg-emerald-700 text-white hover:bg-emerald-800",
                                          )}
                                        >
                                          {pendingAction?.id ===
                                            reservation.id &&
                                          pendingAction.kind === "checkout" ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            "تسجيل مغادرة"
                                          )}
                                        </Button>
                                        <Button
                                          type="button"
                                          disabled={
                                            reservation.status !==
                                              RESERVATION_STATUS_RESERVED ||
                                            pendingAction?.id === reservation.id
                                          }
                                          className={cn(
                                            receiverTableButtonClassName,
                                            "bg-[#00005c] text-white hover:bg-[#00004a]",
                                          )}
                                        >
                                          تأكيد وصول
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          disabled={
                                            !canCancelReceiverReservation(
                                              reservation.status,
                                            ) ||
                                            pendingAction?.id === reservation.id
                                          }
                                          onClick={() =>
                                            void runRowAction(
                                              reservation,
                                              "cancel",
                                            )
                                          }
                                          className={cn(
                                            receiverTableButtonClassName,
                                            "border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800",
                                          )}
                                        >
                                          {pendingAction?.id ===
                                            reservation.id &&
                                          pendingAction.kind === "cancel" ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            "إلغاء الحجز"
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {tableRows.length === 0 && (
                                  <ReservationTableEmpty message="لا توجد حجوزات نشطة اليوم." />
                                )}
                              </TableBody>
                            </Table>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className={receiverTableHeadClassName}>
                                    صاحب الحجز
                                  </TableHead>
                                  <TableHead className={receiverTableHeadClassName}>
                                    الشقة/الغرفة/السرير
                                  </TableHead>
                                  <TableHead className={receiverTableHeadClassName}>
                                    تاريخ الوصول
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={receiverTableBodyClassName}>
                                {tableRows.map((reservation) => (
                                  <TableRow key={reservation.id}>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.userName}
                                    </TableCell>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.room}
                                    </TableCell>
                                    <TableCell className={receiverTableCellClassName}>
                                      {reservation.arrivalDate}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {tableRows.length === 0 && (
                                  <ReservationTableEmpty
                                    colSpan={3}
                                    message="لا توجد حجوزات مستقبلية."
                                  />
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.section>
              </div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </main>
  );
};

export default HousingReceiverPage;
