"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cancelHousingReservation } from "@/actions/cancelHousingReservation";
import { checkInHousingReservation } from "@/actions/checkInHousingReservation";
import { checkoutHousingReservation } from "@/actions/checkoutHousingReservation";
import { restoreHousingReservation } from "@/actions/restoreHousingReservation";
import { getCompanions } from "@/actions/companionService";
import { getAllReservations } from "@/actions/reservationService";
import {
  getAllRequests,
  getRequestParticipantsAll,
  getRequestUnitsAll,
} from "@/actions/requestService";
import { getApartments } from "@/actions/settings/apartmentService";
import { getBeds } from "@/actions/settings/bedService";
import { getRelationships } from "@/actions/settings/relationshipService";
import { getRooms } from "@/actions/settings/roomService";
import { getLookupArray, mapGenericOptions } from "@/lib/availability-inquiry";
import { canAccessHousingReceiverFromCandidates } from "@/lib/role-utils";
import {
  computeFinalAmountAfterDiscount,
  formatReservationAmountAr,
} from "@/lib/reservation-discount";
import {
  PAYMENT_METHOD_CASH,
  PAYMENT_METHOD_OPTIONS,
  parsePaymentMethodInput,
  type PaymentMethod,
} from "@/lib/payment-map";
import {
  RESERVATION_STATUS_CANCELED,
  RESERVATION_STATUS_COMPLETED,
  RESERVATION_STATUS_NO_SHOW,
  RESERVATION_STATUS_RESERVED,
} from "@/lib/reservation-map";
import {
  buildReceiverReservationRows,
  filterActiveReservationsToday,
  filterUpcomingReservations,
  formatReceiverDisplayDate,
  formatReceiverDisplayDateTime,
  isReservationStillInHouse,
  parseCompanionMetaFromApi,
  type ReceiverCompanionMeta,
  type ReceiverReservationRow,
} from "@/lib/reservation-receiver-list";
import { useEffectiveRole } from "@/hooks/use-effective-role";
import { useRequireRole } from "@/hooks/use-require-role";
import { motion } from "framer-motion";
import { ClipboardList, Eye, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ReceiverView = "active" | "upcoming" | "canceled";

type ReceiverRowAction = "restore";

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

const viewTitles: Record<ReceiverView, { title: string; description: string }> =
  {
    active: {
      title: "قسم الحجوزات النشطة",
      description:
        "حجوزات وصول اليوم والنزلاء المقيمون من إقامات سابقة (تأكيد وصول ومغادرة)",
    },
    upcoming: {
      title: "قسم الحجوزات المستقبلية الموافق عليها",
      description: "عرض الحجوزات القادمة المعتمدة",
    },
    canceled: {
      title: "قسم الحجوزات الملغاة ولم يظهر",
      description:
        "عرض الحجوزات الملغاة أو التي لم يظهر ضيفها وإمكانية إعادتها إلى محجوز",
    },
  };

const emptyMessages: Record<ReceiverView, string> = {
  active: "لا توجد حجوزات وصول اليوم ولا نزلاء مقيمون حالياً.",
  upcoming: "لا توجد حجوزات مستقبلية.",
  canceled: "لا توجد حجوزات ملغاة أو لم يظهر ضيفها.",
};

function ReservationTableEmpty({
  message,
  colSpan,
}: {
  message: string;
  colSpan: number;
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

function canCancel(status: ReceiverReservationRow["status"]) {
  return status === RESERVATION_STATUS_RESERVED;
}

function canCheckIn(status: ReceiverReservationRow["status"]) {
  return status === RESERVATION_STATUS_RESERVED;
}

function canCheckout(row: ReceiverReservationRow) {
  return isReservationStillInHouse(row);
}

function canRestore(status: ReceiverReservationRow["status"]) {
  return (
    status === RESERVATION_STATUS_CANCELED ||
    status === RESERVATION_STATUS_NO_SHOW
  );
}

function showCancelationReasonColumn(rows: ReceiverReservationRow[]) {
  return rows.some((row) => row.status !== RESERVATION_STATUS_RESERVED);
}

function buildRelationshipLabelById(
  relationshipsRes: unknown,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const option of mapGenericOptions(relationshipsRes)) {
    const value = String(option.value ?? "").trim();
    const label = String(option.label ?? "").trim();
    if (!value || !label) continue;
    map.set(value, label);
    map.set(value.toLowerCase(), label);
  }
  return map;
}

function buildCompanionById(
  companionsRes: unknown,
  relationshipLabelById: Map<string, string>,
): Map<string, ReceiverCompanionMeta> {
  const map = new Map<string, ReceiverCompanionMeta>();
  for (const raw of getLookupArray(companionsRes)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? item.Id ?? "").trim();
    if (!id) continue;
    const meta = parseCompanionMetaFromApi(item, relationshipLabelById);
    map.set(id, meta);
    map.set(id.toLowerCase(), meta);
  }
  return map;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <div className="text-base text-gray-900">{children}</div>
    </div>
  );
}

export default function HousingReceiverDashboard() {
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
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [detailRow, setDetailRow] = useState<ReceiverReservationRow | null>(
    null,
  );
  const [cancelRow, setCancelRow] = useState<ReceiverReservationRow | null>(
    null,
  );
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [checkInRow, setCheckInRow] = useState<ReceiverReservationRow | null>(
    null,
  );
  const [checkoutRow, setCheckoutRow] = useState<ReceiverReservationRow | null>(
    null,
  );
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PAYMENT_METHOD_CASH,
  );
  const [viewCancelReasonRow, setViewCancelReasonRow] =
    useState<ReceiverReservationRow | null>(null);

  const fetchTicketRef = useRef(0);

  const loadReceiverData = useCallback(async () => {
    const ticket = ++fetchTicketRef.current;
    setDataLoading(true);
    setDataLoadError(null);

    try {
      const [
        reservationsRes,
        requestsRes,
        participantsRes,
        requestUnitsRes,
        bedsRes,
        roomsRes,
        apartmentsRes,
        relationshipsRes,
        companionsRes,
      ] = await Promise.all([
        getAllReservations(),
        getAllRequests(),
        getRequestParticipantsAll(),
        getRequestUnitsAll(),
        getBeds(),
        getRooms(),
        getApartments(),
        getRelationships(),
        getCompanions(),
      ]);

      if (ticket !== fetchTicketRef.current) return;

      const relationshipLabelById =
        buildRelationshipLabelById(relationshipsRes);
      const companionById = buildCompanionById(
        companionsRes,
        relationshipLabelById,
      );

      const built = buildReceiverReservationRows({
        reservationsRes,
        requestsRes,
        participantsRes,
        requestUnitsRes,
        bedsRes,
        roomsRes,
        apartmentsRes,
        companionById,
        relationshipLabelById,
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

  const canceledReservations = useMemo(
    () =>
      allRows.filter(
        (row) =>
          row.status === RESERVATION_STATUS_CANCELED ||
          row.status === RESERVATION_STATUS_NO_SHOW,
      ),
    [allRows],
  );

  const tableRows = useMemo(() => {
    if (activeView === "active") return activeReservations;
    if (activeView === "upcoming") return upcomingReservations;
    return canceledReservations;
  }, [
    activeView,
    activeReservations,
    upcomingReservations,
    canceledReservations,
  ]);

  const showCancelReasonCol = showCancelationReasonColumn(tableRows);

  const {
    paginatedItems: paginatedTableRows,
    page: receiverTablePage,
    setPage: setReceiverTablePage,
    pageCount: receiverTablePageCount,
    pageSize: receiverTablePageSize,
    totalItems: receiverTableTotalItems,
  } = useTablePagination(tableRows, undefined, activeView);

  const tableColSpan = useMemo(() => {
    if (activeView === "upcoming") return 4;
    return 5 + (showCancelReasonCol ? 1 : 0);
  }, [activeView, showCancelReasonCol]);

  const checkInFinalAmount = useMemo(() => {
    if (!checkInRow) return 0;
    const pct = Number(discountPercent);
    return computeFinalAmountAfterDiscount(
      checkInRow.totalAmount,
      Number.isFinite(pct) ? pct : 0,
    );
  }, [checkInRow, discountPercent]);

  const handleCheckoutSubmit = useCallback(async () => {
    if (!checkoutRow || !canCheckout(checkoutRow)) return;

    setModalSubmitting(true);
    try {
      const result = await checkoutHousingReservation({
        id: checkoutRow.id,
        requestId: checkoutRow.requestId,
        startDateYmd: checkoutRow.startDateYmd,
        endDateYmd: checkoutRow.endDateYmd,
      });

      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "فشل تسجيل المغادرة",
          description: result.message,
        });
        return;
      }

      toast({
        title: "تم تسجيل المغادرة",
        description: `تم إنهاء إقامة ${checkoutRow.userName} وتسجيل المغادرة.`,
      });

      if ("unitReleaseWarning" in result && result.unitReleaseWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه: حالة الوحدات",
          description: String(result.unitReleaseWarning),
        });
      }

      setCheckoutRow(null);
      void loadReceiverData();
    } catch {
      toast({
        variant: "destructive",
        title: "فشل تسجيل المغادرة",
        description: "حدث خطأ غير متوقع.",
      });
    } finally {
      setModalSubmitting(false);
    }
  }, [checkoutRow, loadReceiverData, toast]);

  const runRowAction = useCallback(
    async (row: ReceiverReservationRow, kind: ReceiverRowAction) => {
      if (kind === "restore" && !canRestore(row.status)) return;

      const confirmed = window.confirm(
        `هل تريد إعادة حجز ${row.userName} إلى حالة «محجوز»؟`,
      );
      if (!confirmed) return;

      setPendingAction({ id: row.id, kind });
      try {
        const result = await restoreHousingReservation({
          id: row.id,
          requestId: row.requestId,
          startDateYmd: row.startDateYmd,
          endDateYmd: row.endDateYmd,
        });

        if (!result.ok) {
          toast({
            variant: "destructive",
            title: "فشل إعادة الحجز",
            description: result.message,
          });
          return;
        }

        toast({
          title: "تمت إعادة الحجز",
          description: `تم إعادة حجز ${row.userName} إلى محجوز.`,
        });

        if ("unitReserveWarning" in result && result.unitReserveWarning) {
          toast({
            variant: "destructive",
            title: "تنبيه: حالة الوحدات",
            description: String(result.unitReserveWarning),
          });
        }

        void loadReceiverData();
      } catch {
        toast({
          variant: "destructive",
          title: "فشل إعادة الحجز",
          description: "حدث خطأ غير متوقع.",
        });
      } finally {
        setPendingAction(null);
      }
    },
    [loadReceiverData, toast],
  );

  const handleCancelSubmit = useCallback(async () => {
    if (!cancelRow) return;
    const reason = cancelReasonText.trim();
    if (!reason) {
      toast({
        variant: "destructive",
        title: "سبب الإلغاء مطلوب",
        description: "يرجى إدخال سبب الإلغاء قبل المتابعة.",
      });
      return;
    }

    setModalSubmitting(true);
    try {
      const result = await cancelHousingReservation({
        id: cancelRow.id,
        requestId: cancelRow.requestId,
        startDateYmd: cancelRow.startDateYmd,
        endDateYmd: cancelRow.endDateYmd,
        cancelationReason: reason,
      });

      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "فشل إلغاء الحجز",
          description: result.message,
        });
        return;
      }

      toast({
        title: "تم إلغاء الحجز",
        description: `تم إلغاء حجز ${cancelRow.userName} بنجاح.`,
      });

      if (result.unitReleaseWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه: حالة الوحدات",
          description: String(result.unitReleaseWarning),
        });
      }

      setCancelRow(null);
      setCancelReasonText("");
      void loadReceiverData();
    } catch {
      toast({
        variant: "destructive",
        title: "فشل إلغاء الحجز",
        description: "حدث خطأ غير متوقع.",
      });
    } finally {
      setModalSubmitting(false);
    }
  }, [cancelReasonText, cancelRow, loadReceiverData, toast]);

  const handleCheckInSubmit = useCallback(async () => {
    if (!checkInRow) return;
    const pct = Number(discountPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast({
        variant: "destructive",
        title: "نسبة خصم غير صالحة",
        description: "نسبة الخصم يجب أن تكون بين 0 و 100.",
      });
      return;
    }

    setModalSubmitting(true);
    try {
      const result = await checkInHousingReservation({
        id: checkInRow.id,
        requestId: checkInRow.requestId,
        startDateYmd: checkInRow.startDateYmd,
        endDateYmd: checkInRow.endDateYmd,
        discountPercent: pct,
        baseTotalAmount: checkInRow.totalAmount,
        paymentMethod,
      });

      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "فشل تأكيد الوصول",
          description: result.message,
        });
        return;
      }

      toast({
        title: "تم تأكيد الوصول",
        description: `تم تأكيد وصول ${checkInRow.userName} وتسجيل الدفع.`,
      });

      if (result.paymentWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه الدفع",
          description: String(result.paymentWarning),
        });
      }

      if (result.unitOccupancyWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه: حالة الوحدات",
          description: String(result.unitOccupancyWarning),
        });
      }

      setCheckInRow(null);
      setDiscountPercent("0");
      setPaymentMethod(PAYMENT_METHOD_CASH);
      void loadReceiverData();
    } catch {
      toast({
        variant: "destructive",
        title: "فشل تأكيد الوصول",
        description: "حدث خطأ غير متوقع.",
      });
    } finally {
      setModalSubmitting(false);
    }
  }, [checkInRow, discountPercent, paymentMethod, loadReceiverData, toast]);

  const openCancelModal = useCallback((row: ReceiverReservationRow) => {
    setCancelRow(row);
    setCancelReasonText("");
  }, []);

  const openCheckInModal = useCallback((row: ReceiverReservationRow) => {
    setCheckInRow(row);
    setDiscountPercent("0");
    setPaymentMethod(PAYMENT_METHOD_CASH);
  }, []);

  const openCheckoutModal = useCallback((row: ReceiverReservationRow) => {
    setCheckoutRow(row);
  }, []);

  const renderDetailButton = (row: ReceiverReservationRow) => (
    <Button
      type="button"
      variant="outline"
      className={receiverTableButtonClassName}
      onClick={() => setDetailRow(row)}
    >
      <Eye className="ms-1 h-4 w-4" />
      عرض التفاصيل
    </Button>
  );

  const renderActiveActions = (row: ReceiverReservationRow) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {renderDetailButton(row)}
      {canCheckIn(row.status) ? (
        <Button
          type="button"
          disabled={modalSubmitting}
          onClick={() => openCheckInModal(row)}
          className={cn(
            receiverTableButtonClassName,
            "bg-brand text-brand-foreground hover:bg-brand-hover",
          )}
        >
          تأكيد وصول
        </Button>
      ) : null}
      {canCheckout(row) ? (
        <Button
          type="button"
          disabled={modalSubmitting}
          onClick={() => openCheckoutModal(row)}
          className={cn(
            receiverTableButtonClassName,
            "bg-emerald-700 text-white hover:bg-emerald-800",
          )}
        >
          تسجيل مغادرة
        </Button>
      ) : null}
      {canCancel(row.status) ? (
        <Button
          type="button"
          variant="outline"
          disabled={modalSubmitting}
          onClick={() => openCancelModal(row)}
          className={cn(
            receiverTableButtonClassName,
            "border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800",
          )}
        >
          إلغاء الحجز
        </Button>
      ) : null}
    </div>
  );

  const renderCanceledActions = (row: ReceiverReservationRow) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {renderDetailButton(row)}
      <Button
        type="button"
        variant="outline"
        className={receiverTableButtonClassName}
        onClick={() => setViewCancelReasonRow(row)}
      >
        عرض سبب الإلغاء
      </Button>
      {canRestore(row.status) ? (
        <Button
          type="button"
          disabled={pendingAction?.id === row.id}
          onClick={() => void runRowAction(row, "restore")}
          className={cn(
            receiverTableButtonClassName,
            "bg-brand text-brand-foreground hover:bg-brand-hover",
          )}
        >
          {pendingAction?.id === row.id &&
          pendingAction.kind === "restore" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "إعادة إلى محجوز"
          )}
        </Button>
      ) : null}
    </div>
  );

  const renderUpcomingActions = (row: ReceiverReservationRow) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {renderDetailButton(row)}
    </div>
  );

  if (!isRoleReady || !allowed) {
    return null;
  }

  return (
    <main
      className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto"
      dir="rtl"
    >
      <motion.div
        className="container mx-auto px-2 py-4 sm:px-4 md:px-6 lg:px-8"
        variants={mainCardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden rounded-3xl border-2 border-blue-100 shadow-xl">
          <div className="border-b border-brand-border/15 bg-brand-muted px-6 py-4 text-center">
            <h2 className="text-lg font-bold text-brand md:text-xl">
              لوحة تحكم مسؤول الاستقبال
            </h2>
          </div>

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
                      {(
                        [
                          ["active", "الحجوزات النشطة"],
                          ["upcoming", "الحجوزات المستقبلية"],
                          ["canceled", "الحجوزات الملغاة"],
                        ] as const
                      ).map(([view, label]) => (
                        <motion.div
                          key={view}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <Button
                            type="button"
                            onClick={() => setActiveView(view)}
                            variant={
                              activeView === view ? "default" : "outline"
                            }
                            className="h-auto min-h-11 w-full justify-start py-3 text-base"
                          >
                            {label}
                          </Button>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.section
                  className="min-h-[420px]"
                  variants={sectionVariants}
                >
                  <Card className="h-full rounded-3xl border-2 border-border bg-card text-card-foreground shadow-lg">
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
                      {dataLoadError ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {dataLoadError}
                        </p>
                      ) : null}

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
                          ) : (
                            <>
                              <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead
                                    className={receiverTableHeadClassName}
                                  >
                                    صاحب الحجز
                                  </TableHead>
                                  <TableHead
                                    className={receiverTableHeadClassName}
                                  >
                                    الشقة/الغرفة/السرير
                                  </TableHead>
                                  <TableHead
                                    className={receiverTableHeadClassName}
                                  >
                                    تاريخ الوصول
                                  </TableHead>
                                  {activeView !== "upcoming" ? (
                                    <TableHead
                                      className={receiverTableHeadClassName}
                                    >
                                      تاريخ المغادرة
                                    </TableHead>
                                  ) : null}
                                  {showCancelReasonCol ? (
                                    <TableHead
                                      className={receiverTableHeadClassName}
                                    >
                                      سبب الإلغاء
                                    </TableHead>
                                  ) : null}
                                  <TableHead
                                    className={receiverTableHeadClassName}
                                  >
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={receiverTableBodyClassName}>
                                {paginatedTableRows.map((reservation) => (
                                  <TableRow key={reservation.id}>
                                    <TableCell
                                      className={receiverTableCellClassName}
                                    >
                                      {reservation.userName}
                                    </TableCell>
                                    <TableCell
                                      className={receiverTableCellClassName}
                                    >
                                      {reservation.room}
                                    </TableCell>
                                    <TableCell
                                      className={receiverTableCellClassName}
                                    >
                                      {reservation.arrivalDate}
                                    </TableCell>
                                    {activeView !== "upcoming" ? (
                                      <TableCell
                                        className={receiverTableCellClassName}
                                      >
                                        {formatReceiverDisplayDate(
                                          reservation.endDateYmd,
                                        )}
                                      </TableCell>
                                    ) : null}
                                    {showCancelReasonCol ? (
                                      <TableCell
                                        className={receiverTableCellClassName}
                                      >
                                        {reservation.cancelationReason?.trim() ||
                                          "—"}
                                      </TableCell>
                                    ) : null}
                                    <TableCell
                                      className={receiverTableCellClassName}
                                    >
                                      {activeView === "active"
                                        ? renderActiveActions(reservation)
                                        : activeView === "canceled"
                                          ? renderCanceledActions(reservation)
                                          : renderUpcomingActions(reservation)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {tableRows.length === 0 ? (
                                  <ReservationTableEmpty
                                    message={emptyMessages[activeView]}
                                    colSpan={tableColSpan}
                                  />
                                ) : null}
                              </TableBody>
                            </Table>
                            <TablePagination
                              totalItems={receiverTableTotalItems}
                              page={receiverTablePage}
                              pageCount={receiverTablePageCount}
                              pageSize={receiverTablePageSize}
                              onPageChange={setReceiverTablePage}
                            />
                            </>
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

      <Dialog
        open={detailRow != null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <DialogContent dir="rtl" className="max-w-lg text-right">
          <DialogHeader>
            <DialogTitle>تفاصيل الحجز</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="صاحب الحجز">{detailRow.userName}</DetailField>
              <DetailField label="الوحدات">
                {detailRow.reservationUnits.length > 0
                  ? detailRow.reservationUnits.join("، ")
                  : detailRow.room}
              </DetailField>
              <DetailField label="تاريخ الوصول">
                {detailRow.arrivalDate}
              </DetailField>
              <DetailField label="تاريخ المغادرة">
                {formatReceiverDisplayDate(detailRow.endDateYmd)}
              </DetailField>
              <DetailField label="مبلغ الحجز">
                {formatReservationAmountAr(detailRow.totalAmount)}
              </DetailField>
              <DetailField label="تأكيد الوصول">
                {formatReceiverDisplayDateTime(detailRow.checkInAt)}
              </DetailField>
              <DetailField label="تسجيل المغادرة">
                {formatReceiverDisplayDateTime(detailRow.actualCheckOutAt)}
              </DetailField>
              {detailRow.cancelationReason?.trim() ? (
                <DetailField label="سبب الإلغاء">
                  {detailRow.cancelationReason}
                </DetailField>
              ) : null}
              <div className="sm:col-span-2">
                <DetailField label="المرافقون">
                  {detailRow.companions.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1 text-right">
                      {detailRow.companions.map((c, index) => (
                        <li key={`${c.name}-${index}`}>
                          {c.name}
                          {c.relationship ? ` — ${c.relationship}` : ""}
                          {c.age != null ? ` — العمر: ${c.age}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </DetailField>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="outline" onClick={() => setDetailRow(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelRow(null);
            setCancelReasonText("");
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>إلغاء الحجز</DialogTitle>
            {cancelRow ? (
              <p className="text-sm text-muted-foreground">
                حجز: {cancelRow.userName}
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">سبب الإلغاء</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReasonText}
              onChange={(e) => setCancelReasonText(e.target.value)}
              rows={4}
              className="resize-none text-right"
              disabled={modalSubmitting}
              placeholder="أدخل سبب الإلغاء..."
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={modalSubmitting}
              onClick={() => {
                setCancelRow(null);
                setCancelReasonText("");
              }}
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={modalSubmitting}
              onClick={() => void handleCancelSubmit()}
            >
              {modalSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد الإلغاء"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkoutRow != null}
        onOpenChange={(open) => {
          if (!open) setCheckoutRow(null);
        }}
      >
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>تسجيل مغادرة</DialogTitle>
            {checkoutRow ? (
              <p className="text-sm text-muted-foreground">
                حجز: {checkoutRow.userName}
              </p>
            ) : null}
          </DialogHeader>
          {checkoutRow ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                هل تريد تسجيل مغادرة {checkoutRow.userName} وإنهاء الإقامة؟
              </p>
              <div className="space-y-3 rounded-md border bg-muted/40 p-3">
                <div className="space-y-1">
                  <Label>الوحدة</Label>
                  <p className="text-base">{checkoutRow.room}</p>
                </div>
                <div className="space-y-1">
                  <Label>تاريخ الوصول</Label>
                  <p className="text-base">{checkoutRow.arrivalDate}</p>
                </div>
                {checkoutRow.checkInAt ? (
                  <div className="space-y-1">
                    <Label>تأكيد الوصول</Label>
                    <p className="text-base">
                      {formatReceiverDisplayDateTime(checkoutRow.checkInAt)}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label>مبلغ الحجز</Label>
                  <p className="text-base font-medium">
                    {formatReservationAmountAr(checkoutRow.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={modalSubmitting}
              onClick={() => setCheckoutRow(null)}
            >
              تراجع
            </Button>
            <Button
              type="button"
              disabled={modalSubmitting}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              onClick={() => void handleCheckoutSubmit()}
            >
              {modalSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد تسجيل المغادرة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkInRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setCheckInRow(null);
            setDiscountPercent("0");
            setPaymentMethod(PAYMENT_METHOD_CASH);
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>تأكيد وصول</DialogTitle>
            {checkInRow ? (
              <p className="text-sm text-muted-foreground">
                حجز: {checkInRow.userName}
              </p>
            ) : null}
          </DialogHeader>
          {checkInRow ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>مبلغ الحجز</Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-base">
                  {formatReservationAmountAr(checkInRow.totalAmount)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-percent">نسبة الخصم (%)</Label>
                <Input
                  id="discount-percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  disabled={modalSubmitting}
                  className="text-right"
                />
              </div>
              <div className="space-y-1">
                <Label>المبلغ بعد الخصم</Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-base font-medium">
                  {formatReservationAmountAr(checkInFinalAmount)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">طريقة الدفع</Label>
                <Select
                  value={String(paymentMethod)}
                  onValueChange={(value) => {
                    const parsed = parsePaymentMethodInput(value);
                    if (parsed != null) setPaymentMethod(parsed);
                  }}
                  disabled={modalSubmitting}
                >
                  <SelectTrigger
                    id="payment-method"
                    className="w-full text-right"
                    dir="rtl"
                  >
                    <SelectValue placeholder="اختر طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent className="text-right" dir="rtl">
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={modalSubmitting}
              onClick={() => {
                setCheckInRow(null);
                setDiscountPercent("0");
                setPaymentMethod(PAYMENT_METHOD_CASH);
              }}
            >
              تراجع
            </Button>
            <Button
              type="button"
              disabled={modalSubmitting}
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
              onClick={() => void handleCheckInSubmit()}
            >
              {modalSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد الوصول"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewCancelReasonRow != null}
        onOpenChange={(open) => {
          if (!open) setViewCancelReasonRow(null);
        }}
      >
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle>سبب الإلغاء</DialogTitle>
            {viewCancelReasonRow ? (
              <p className="text-sm text-muted-foreground">
                حجز: {viewCancelReasonRow.userName}
              </p>
            ) : null}
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-3 text-base">
            {viewCancelReasonRow?.cancelationReason?.trim() || "—"}
          </p>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewCancelReasonRow(null)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
