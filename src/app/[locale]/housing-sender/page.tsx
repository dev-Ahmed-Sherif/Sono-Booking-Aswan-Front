"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getRequestTypes } from "@/actions/settings/requestTypeService";
import { getAllExtensions } from "@/actions/settings/extensionService";
import { decideHousingRequest } from "@/actions/decideHousingRequest";
import { getAllRequests } from "@/actions/requestService";
import { canAccessHousingSenderFromCandidates } from "@/lib/role-utils";
import { useEffectiveRole } from "@/hooks/use-effective-role";
import { useRequireRole } from "@/hooks/use-require-role";
import {
  extractApplicantDisplayNameFromRequest,
  extractRequestTypeId,
  mapApiExtensionToTableRow,
  mapApiRequestToTableRow,
  parseExtensionsListFromApi,
  parseRequestsListFromApi,
  toYmd,
  type HousingRequestTableRow,
} from "@/lib/housing-request-list";
import {
  extractRequestUserId,
  type LeaderRequestDecision,
} from "@/lib/housing-request-detail";
import {
  getLookupArray,
  mapGenericOptions,
  type GenericOption,
} from "@/lib/availability-inquiry";
import { cn } from "@/lib/utils";
import { ClipboardList, Home, Loader2 } from "lucide-react";

import {
  HousingSenderDecisionDialog,
} from "@/components/housing-sender/housing-sender-decision-dialog";
import { HousingRequestDetailModal } from "@/components/reservation/housing-request-detail-modal";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type SenderView = "new" | "approved" | "extension";

const senderFilterFieldClassName =
  "h-12 min-h-12 border-2 border-black dark:border-white bg-white text-base text-gray-800";

const senderFilterSelectTriggerClassName = cn(
  senderFilterFieldClassName,
  "text-right [&>span]:w-full [&>span]:text-right",
);

const senderTableHeadClassName = "text-center align-middle";
const senderTableBodyClassName =
  "[&_td]:text-center [&_td]:align-middle [&_td]:[&>div]:mx-auto [&_td]:[&>div]:flex [&_td]:[&>div]:flex-wrap [&_td]:[&>div]:justify-center [&_td]:[&>div]:gap-2 [&_td]:[&>button]:mx-auto";
const senderTableCellClassName = cn(
  "text-center align-middle",
  "[&>div]:mx-auto [&>div]:flex [&>div]:flex-wrap [&>div]:justify-center [&>div]:gap-2",
  "[&>button]:mx-auto",
);
const senderTableButtonClassName =
  "h-10 min-h-10 px-4 text-base font-medium";

type SenderTableRow = {
  /** Entity id for `getRequestById` (parent request when row is an extension). */
  requestId: string;
  /** `RequestDto.UserId` — passed to companions API as `UserId` header for leaders. */
  requestOwnerUserId: string;
  requestNumber: string;
  housingTableRow: HousingRequestTableRow;
  applicant: string;
  requestTypeId: string;
  reason: string;
  startDate: string;
  endDate: string;
  nights?: number;
  status: string;
};

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function formatEndDateFromRaw(raw: Record<string, unknown>): string {
  return toYmd(raw.endDate ?? raw.EndDate) ?? "—";
}

function mapToSenderTableRow(
  raw: Record<string, unknown>,
  tableRow: HousingRequestTableRow,
): SenderTableRow {
  const isExtension = tableRow.entryKind === "extension";
  const requestId = isExtension
    ? pickStr(raw, "requestId", "RequestId")
    : tableRow.id;

  return {
    requestId,
    requestOwnerUserId: extractRequestUserId(raw),
    requestNumber: tableRow.requestNo,
    housingTableRow: tableRow,
    applicant: extractApplicantDisplayNameFromRequest(raw),
    requestTypeId: extractRequestTypeId(raw),
    reason: tableRow.requestType,
    startDate: tableRow.startDate,
    endDate: formatEndDateFromRaw(raw),
    nights: tableRow.nights,
    status: tableRow.status,
  };
}

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

const matchesFilters = (
  row: Pick<SenderTableRow, "requestTypeId" | "reason">,
  startDate: string,
  endDate: string,
  selectedType: string,
  selectedDate: string,
  requestTypeLabelsById: Map<string, string>,
) => {
  const matchesType =
    selectedType === "all" ||
    (row.requestTypeId !== "" && row.requestTypeId === selectedType) ||
    row.reason === requestTypeLabelsById.get(selectedType);
  const matchesDate =
    !selectedDate ||
    startDate === selectedDate ||
    endDate === selectedDate;
  return matchesType && matchesDate;
};

const viewTitles: Record<SenderView, { title: string; description: string }> = {
  new: {
    title: "قسم الطلبات الجديدة",
    description: "مراجعة الطلبات الجديدة واتخاذ الإجراء المناسب",
  },
  approved: {
    title: "قسم الطلبات الموافق عليها مؤخرًا",
    description: "آخر الطلبات التي تمت الموافقة عليها",
  },
  extension: {
    title: "قسم طلبات التمديد",
    description: "مراجعة طلبات تمديد الإقامة",
  },
};

function getLoggedInUserId(): string {
  try {
    const raw =
      typeof window !== "undefined" ? window.localStorage.getItem("user") : null;
    if (!raw || raw === "undefined" || raw === "null") return "";
    const u = JSON.parse(raw) as { id?: string };
    return String(u?.id ?? "").trim();
  } catch {
    return "";
  }
}

const HousingSenderPage = () => {
  const { roleCandidates, isRoleReady } = useEffectiveRole();
  const allowed = canAccessHousingSenderFromCandidates(roleCandidates);
  useRequireRole({ allowed });
  const { toast } = useToast();

  const [activeView, setActiveView] = useState<SenderView>("new");
  const [selectedType, setSelectedType] = useState("all");
  const [requestTypeOptions, setRequestTypeOptions] = useState<GenericOption[]>(
    [],
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [pendingRequests, setPendingRequests] = useState<SenderTableRow[]>([]);
  const [recentlyApprovedRequests, setRecentlyApprovedRequests] = useState<
    SenderTableRow[]
  >([]);
  const [extensionRequests, setExtensionRequests] = useState<SenderTableRow[]>(
    [],
  );
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalRequestId, setDetailModalRequestId] = useState<
    string | null
  >(null);
  const [detailModalRow, setDetailModalRow] =
    useState<HousingRequestTableRow | null>(null);
  const [detailModalStatus, setDetailModalStatus] = useState("");
  const [detailModalOwnerUserId, setDetailModalOwnerUserId] = useState("");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionKind, setDecisionKind] = useState<LeaderRequestDecision | null>(
    null,
  );
  const [decisionTarget, setDecisionTarget] = useState<SenderTableRow | null>(
    null,
  );
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const fetchTicketRef = useRef(0);

  const requestTypeLabelsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of requestTypeOptions) {
      map.set(opt.value, opt.label);
    }
    return map;
  }, [requestTypeOptions]);

  const openRequestDetails = useCallback((row: SenderTableRow) => {
    if (!row.requestId.trim()) return;
    setDetailModalRequestId(row.requestId);
    setDetailModalOwnerUserId(row.requestOwnerUserId);
    setDetailModalRow(row.housingTableRow);
    setDetailModalStatus(row.status);
    setDetailModalOpen(true);
  }, []);

  const closeRequestDetails = useCallback(() => {
    setDetailModalOpen(false);
    setDetailModalRequestId(null);
    setDetailModalOwnerUserId("");
    setDetailModalRow(null);
    setDetailModalStatus("");
  }, []);

  const openDecisionModal = useCallback(
    (row: SenderTableRow, kind: LeaderRequestDecision) => {
      if (!row.requestId.trim()) return;
      setDecisionTarget(row);
      setDecisionKind(kind);
      setDecisionNote("");
      setDecisionOpen(true);
    },
    [],
  );

  const closeDecisionModal = useCallback(() => {
    if (decisionSubmitting) return;
    setDecisionOpen(false);
    setDecisionKind(null);
    setDecisionTarget(null);
    setDecisionNote("");
  }, [decisionSubmitting]);

  const loadSenderData = useCallback(async () => {
    const typeLabels = requestTypeLabelsById;
    const ticket = ++fetchTicketRef.current;
    setDataLoading(true);
    setDataLoadError(null);

    try {
      const [requestsRes, extensionsRes] = await Promise.all([
        getAllRequests(),
        getAllExtensions(),
      ]);
      if (ticket !== fetchTicketRef.current) return;

      if (
        requestsRes &&
        typeof requestsRes === "object" &&
        "error" in requestsRes
      ) {
        const err = requestsRes as { message?: string; error?: string };
        setPendingRequests([]);
        setRecentlyApprovedRequests([]);
        setExtensionRequests([]);
        setDataLoadError(
          String(err.message ?? err.error ?? "تعذر تحميل الطلبات."),
        );
        return;
      }

      const pending: SenderTableRow[] = [];
      const approved: SenderTableRow[] = [];

      for (const item of parseRequestsListFromApi(requestsRes)) {
        if (!item || typeof item !== "object") continue;
        const raw = item as Record<string, unknown>;
        const tableRow = mapApiRequestToTableRow(raw, {
          requestTypeLabelsById: typeLabels,
        });
        if (!tableRow) continue;
        const row = mapToSenderTableRow(raw, tableRow);
        if (tableRow.status === "قيد المراجعة") {
          pending.push(row);
        } else if (tableRow.status === "تمت الموافقة") {
          approved.push(row);
        }
      }

      const extensions: SenderTableRow[] = [];
      if (
        extensionsRes &&
        typeof extensionsRes === "object" &&
        !("error" in extensionsRes)
      ) {
        for (const item of parseExtensionsListFromApi(extensionsRes)) {
          if (!item || typeof item !== "object") continue;
          const raw = item as Record<string, unknown>;
          const tableRow = mapApiExtensionToTableRow(raw, {
            requestTypeLabelsById: typeLabels,
          });
          if (!tableRow) continue;
          const row = mapToSenderTableRow(raw, tableRow);
          if (tableRow.status === "قيد المراجعة") {
            extensions.push(row);
          }
        }
      }

      setPendingRequests(pending);
      setRecentlyApprovedRequests(approved);
      setExtensionRequests(extensions);
    } catch {
      if (ticket !== fetchTicketRef.current) return;
      setPendingRequests([]);
      setRecentlyApprovedRequests([]);
      setExtensionRequests([]);
      setDataLoadError("تعذر تحميل الطلبات.");
    } finally {
      if (ticket === fetchTicketRef.current) {
        setDataLoading(false);
      }
    }
  }, [requestTypeLabelsById]);

  useEffect(() => {
    if (!isRoleReady || !allowed) return;
    void (async () => {
      const res = await getRequestTypes();
      if (res && typeof res === "object" && "error" in res) return;
      const mapped = mapGenericOptions(res);
      if (mapped.length > 0) setRequestTypeOptions(mapped);
    })();
  }, [isRoleReady, allowed]);

  const handleDecisionConfirm = useCallback(async () => {
    if (!decisionTarget || !decisionKind) return;

    const leaderUserId = getLoggedInUserId();
    if (!leaderUserId) {
      toast({
        variant: "destructive",
        title: "تعذر تنفيذ الإجراء",
        description: "لم يتم العثور على بيانات المستخدم الحالي.",
      });
      return;
    }

    if (decisionKind === "reject" && !decisionNote.trim()) {
      toast({
        variant: "destructive",
        title: "سبب الرفض مطلوب",
        description: "يرجى إدخال سبب الرفض قبل المتابعة.",
      });
      return;
    }

    const requestId = decisionTarget.requestId.trim();
    setDecisionSubmitting(true);

    try {
      const result = await decideHousingRequest({
        requestId,
        decision: decisionKind,
        leaderUserId,
        ownerUserId: decisionTarget.requestOwnerUserId.trim() || undefined,
        rejectionReason: decisionNote,
      });

      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "فشل تحديث الطلب",
          description: result.message,
        });
        return;
      }

      toast({
        title: decisionKind === "approve" ? "تمت الموافقة" : "تم الرفض",
        description:
          decisionKind === "approve"
            ? result.reservationWarning
              ? "تم تحديث الطلب وإنشاء الحجز مع تنبيهات — راجع التفاصيل أدناه."
              : "تم تحديث حالة الطلب وإنشاء الحجز."
            : "تم تحديث حالة الطلب إلى مرفوض.",
      });

      if (result.unitReserveWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه: حالة الوحدات",
          description: result.unitReserveWarning,
        });
      }

      if (result.reservationWarning) {
        toast({
          variant: "destructive",
          title: "تنبيه: إنشاء الحجز",
          description: result.reservationWarning,
        });
      }

      closeDecisionModal();
      void loadSenderData();
    } catch {
      toast({
        variant: "destructive",
        title: "فشل تحديث الطلب",
        description: "حدث خطأ غير متوقع أثناء حفظ القرار.",
      });
    } finally {
      setDecisionSubmitting(false);
    }
  }, [
    closeDecisionModal,
    decisionKind,
    decisionNote,
    decisionTarget,
    loadSenderData,
    toast,
  ]);

  useEffect(() => {
    if (!isRoleReady || !allowed) return;
    void loadSenderData();
    return () => {
      fetchTicketRef.current += 1;
      setDataLoading(false);
    };
  }, [isRoleReady, allowed, loadSenderData]);

  const filteredPending = useMemo(
    () =>
      pendingRequests.filter((r) =>
        matchesFilters(
          r,
          r.startDate,
          r.endDate,
          selectedType,
          selectedDate,
          requestTypeLabelsById,
        ),
      ),
    [pendingRequests, requestTypeLabelsById, selectedDate, selectedType],
  );

  const filteredApproved = useMemo(
    () =>
      recentlyApprovedRequests.filter((r) =>
        matchesFilters(
          r,
          r.startDate,
          r.endDate,
          selectedType,
          selectedDate,
          requestTypeLabelsById,
        ),
      ),
    [
      recentlyApprovedRequests,
      requestTypeLabelsById,
      selectedDate,
      selectedType,
    ],
  );

  const filteredExtension = useMemo(
    () =>
      extensionRequests.filter((r) =>
        matchesFilters(
          r,
          r.startDate,
          r.endDate,
          selectedType,
          selectedDate,
          requestTypeLabelsById,
        ),
      ),
    [extensionRequests, requestTypeLabelsById, selectedDate, selectedType],
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
                  لوحة تحكم مسؤول أسوان
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
                      <CardTitle className="text-base">أقسام الطلبات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("new")}
                          variant={activeView === "new" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          قسم الطلبات الجديدة
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("approved")}
                          variant={activeView === "approved" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          قسم الطلبات الموافق عليها مؤخرًا
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("extension")}
                          variant={activeView === "extension" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          قسم طلبات التمديد
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
                      <div className="rounded-2xl border border-blue-100 bg-slate-50/80 p-4">
                        <p className="mb-3 text-right text-sm font-medium text-gray-700">
                          فلترة
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-sm text-gray-700">حسب نوع الطلب</Label>
                            <Select
                              value={selectedType}
                              onValueChange={setSelectedType}
                              dir="rtl"
                            >
                              <SelectTrigger className={senderFilterSelectTriggerClassName}>
                                <SelectValue placeholder="الكل" />
                              </SelectTrigger>
                              <SelectContent className="z-50 text-right">
                                <SelectItem value="all">الكل</SelectItem>
                                {requestTypeOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm text-gray-700">حسب التاريخ</Label>
                            <Input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className={cn(senderFilterFieldClassName, "text-right")}
                            />
                          </div>
                        </div>
                      </div>

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
                          {dataLoading && (
                            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>جاري تحميل الطلبات...</span>
                            </div>
                          )}
                          {!dataLoading && activeView === "new" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className={senderTableHeadClassName}>
                                    رقم الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    اسم الطالب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    سبب الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ البداية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ النهاية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={senderTableBodyClassName}>
                                {filteredPending.map((request) => (
                                  <TableRow key={request.requestId || request.requestNumber}>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.requestNumber}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.applicant}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.reason}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.startDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.endDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        <Button
                                          type="button"
                                          className={cn(
                                            senderTableButtonClassName,
                                            "bg-[#00005c] text-white hover:bg-[#00004a]",
                                          )}
                                          disabled={
                                            decisionSubmitting ||
                                            !request.requestId
                                          }
                                          onClick={() =>
                                            openDecisionModal(
                                              request,
                                              "approve",
                                            )
                                          }
                                        >
                                          موافقة
                                        </Button>
                                        <Button
                                          type="button"
                                          className={cn(
                                            senderTableButtonClassName,
                                            "bg-red-600 text-white hover:bg-red-700",
                                          )}
                                          disabled={
                                            decisionSubmitting ||
                                            !request.requestId
                                          }
                                          onClick={() =>
                                            openDecisionModal(
                                              request,
                                              "reject",
                                            )
                                          }
                                        >
                                          رفض
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={senderTableButtonClassName}
                                          disabled={!request.requestId}
                                          onClick={() =>
                                            openRequestDetails(request)
                                          }
                                        >
                                          تفاصيل
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {filteredPending.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={6}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}

                          {!dataLoading && activeView === "approved" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className={senderTableHeadClassName}>
                                    رقم الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    اسم الطالب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    سبب الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ البداية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ النهاية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    عدد الليالي
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={senderTableBodyClassName}>
                                {filteredApproved.map((request) => (
                                  <TableRow key={request.requestId || request.requestNumber}>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.requestNumber}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.applicant}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.reason}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.startDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.endDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.nights ?? "—"}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className={senderTableButtonClassName}
                                        disabled={!request.requestId}
                                        onClick={() =>
                                          openRequestDetails(request)
                                        }
                                      >
                                        تفاصيل
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {filteredApproved.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={7}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}

                          {!dataLoading && activeView === "extension" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className={senderTableHeadClassName}>
                                    رقم الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    اسم الطالب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    سبب الطلب
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ البداية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    تاريخ النهاية
                                  </TableHead>
                                  <TableHead className={senderTableHeadClassName}>
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className={senderTableBodyClassName}>
                                {filteredExtension.map((request) => (
                                  <TableRow key={request.requestId || request.requestNumber}>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.requestNumber}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.applicant}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.reason}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.startDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      {request.endDate}
                                    </TableCell>
                                    <TableCell className={senderTableCellClassName}>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        <Button
                                          className={cn(
                                            senderTableButtonClassName,
                                            "bg-[#00005c] text-white hover:bg-[#00004a]",
                                          )}
                                        >
                                          موافقة
                                        </Button>
                                        <Button
                                          className={cn(
                                            senderTableButtonClassName,
                                            "bg-red-600 text-white hover:bg-red-700",
                                          )}
                                        >
                                          رفض
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={senderTableButtonClassName}
                                          disabled={!request.requestId}
                                          onClick={() =>
                                            openRequestDetails(request)
                                          }
                                        >
                                          تفاصيل
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {filteredExtension.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={6}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
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

      {detailModalOpen && detailModalRequestId ? (
        <HousingRequestDetailModal
          open={detailModalOpen}
          mode="view"
          requestId={detailModalRequestId}
          requestOwnerUserId={detailModalOwnerUserId}
          statusLabel={detailModalStatus}
          tableRow={detailModalRow}
          onClose={closeRequestDetails}
        />
      ) : null}

      <HousingSenderDecisionDialog
        open={decisionOpen}
        kind={decisionKind}
        requestNumber={decisionTarget?.requestNumber}
        note={decisionNote}
        submitting={decisionSubmitting}
        onNoteChange={setDecisionNote}
        onOpenChange={(open) => {
          if (!open) closeDecisionModal();
        }}
        onConfirm={() => void handleDecisionConfirm()}
      />
    </main>
  );
};

export default HousingSenderPage;
