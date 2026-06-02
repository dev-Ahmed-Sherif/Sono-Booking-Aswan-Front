"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { oncePerSession } from "@/lib/server-action-cache";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import {
  Bed,
  Bookmark,
  Building2,
  CalendarIcon,
  CalendarDays,
  CheckCircle2,
  Home,
  Loader2,
  Moon,
  Search,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";
import {
  ALL_UNIT_TYPE_OPTIONS,
  UNIT_TYPE_LABEL_AR,
  availabilityCardKey,
  fetchMergedAvailabilityCards,
  getLookupArray,
  getUnavailableUnitTypesMessage,
  mapGenericOptions,
  normalizeInquiryStartYmd,
  orderedUnitKindsFromSelection,
  toReservationStoredUnits,
} from "@/lib/availability-inquiry";
import type { AvailableUnitType } from "@/actions/availabilityService";
import { getGenders } from "@/actions/settings/genderService";
import { getAllocationTypes } from "@/actions/settings/allocationTypeService";
import { getRequestTypes } from "@/actions/settings/requestTypeService";
import { getRequests } from "@/actions/requestService";
import { getExtensions } from "@/actions/settings/extensionService";
import ReservationRequestForm from "@/components/reservation/reservation-request-form";
import {
  deleteHousingRequest,
  HousingRequestDetailModal,
  HousingRequestRowActions,
} from "@/components/reservation/housing-request-detail-modal";
import {
  EmployeeDiscountNotice,
  FlexibleAllocationNotice,
} from "@/components/reservation/allocation-type-notices";
import { userHasEmployeeId } from "@/lib/user-employee-id";
import {
  mapExtensionsToTableRows,
  mapRequestsToTableRows,
  mergeAndSortHistoryTableRows,
  parseExtensionsListFromApi,
  parseRequestsListFromApi,
  type HousingRequestTableRow,
} from "@/lib/housing-request-list";

type ReservationView = "new" | "extend" | "history";
type AvailabilitySearchStatus = "idle" | "loading" | "success" | "error";
type AvailabilityErrors = {
  startDate?: string;
  nights?: string;
  unitType?: string;
  requestType?: string;
  gender?: string;
  allocationType?: string;
};
type GenderOption = { value: "male" | "female"; label: "رجال" | "سيدات" };
type AllocationTypeOption = { value: string; label: string };
type RequestTypeOption = { value: string; label: string };

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

function storedUserId(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const u = raw as Record<string, unknown>;
  return String(u.id ?? u.Id ?? "").trim();
}

const ReservationPage = () => {
  const { toast } = useToast();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const reservation = useLocalStorage("reservation");
  const userStorage = useLocalStorage("user");
  const reduxUserId = useSelector((state: { user?: { id?: string } }) =>
    String(state.user?.id ?? "").trim(),
  );

  const [activeView, setActiveView] = useState<ReservationView>("new");
  const [showReservationRequestForm, setShowReservationRequestForm] =
    useState(false);

  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState("");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<
    AvailableUnitType[]
  >([]);
  const [selectedGenders, setSelectedGenders] = useState<
    GenderOption["value"][]
  >([]);
  const [allocationType, setAllocationType] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availabilitySearchStatus, setAvailabilitySearchStatus] =
    useState<AvailabilitySearchStatus>("idle");
  const [availabilityCards, setAvailabilityCards] = useState<
    AvailabilityUnitCard[]
  >([]);
  const [selectedAvailabilityKeys, setSelectedAvailabilityKeys] = useState<
    string[]
  >([]);
  const [availabilityErrors, setAvailabilityErrors] =
    useState<AvailabilityErrors>({});
  const [requestType, setRequestType] = useState("");
  const [requestTypeOptions, setRequestTypeOptions] = useState<
    RequestTypeOption[]
  >([]);
  const [genderOptions, setGenderOptions] = useState<GenderOption[]>([
    { value: "male", label: "رجال" },
    { value: "female", label: "سيدات" },
  ]);
  const [allocationTypeOptions, setAllocationTypeOptions] = useState<
    AllocationTypeOption[]
  >([]);
  const [showEmployeeDiscountNotice, setShowEmployeeDiscountNotice] =
    useState(false);
  const [historyRequests, setHistoryRequests] = useState<
    HousingRequestTableRow[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalMode, setHistoryModalMode] = useState<"view" | "edit">(
    "view",
  );
  const [historyModalRequestId, setHistoryModalRequestId] = useState<
    string | null
  >(null);
  const [historyModalRow, setHistoryModalRow] =
    useState<HousingRequestTableRow | null>(null);
  const [historyModalStatus, setHistoryModalStatus] = useState("");
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(
    null,
  );
  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);
  const minSelectableDate = new Date();
  minSelectableDate.setHours(0, 0, 0, 0);

  const inquiryResetSkipRef = useRef(true);

  /** Reset availability results when the user changes inquiry fields (not on first mount). */
  useEffect(() => {
    if (inquiryResetSkipRef.current) {
      inquiryResetSkipRef.current = false;
      return;
    }
    setAvailabilitySearchStatus("idle");
    setAvailabilityCards([]);
    setSelectedAvailabilityKeys([]);
    setAvailabilityErrors({});
    setShowReservationRequestForm(false);
  }, [
    startDate,
    nights,
    selectedUnitTypes,
    requestType,
    selectedGenders,
    allocationType,
  ]);

  useEffect(() => {
    setAvailabilitySearchStatus("idle");
    setAvailabilityCards([]);
    setSelectedAvailabilityKeys([]);
    setAvailabilityErrors({});
  }, [activeView]);

  useEffect(() => {
    setShowEmployeeDiscountNotice(userHasEmployeeId(userStorage.getItem()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read user snapshot once after mount
  }, []);

  /** If inquiry + units were saved before, show the request form on the «new stay» tab. */
  useEffect(() => {
    if (activeView !== "new") return;
    if (typeof window === "undefined") return;
    try {
      const item = window.localStorage.getItem("reservation");
      if (!item || item === "undefined" || item === "null") return;
      const raw = JSON.parse(item) as {
        form?: unknown;
        selectedUnits?: unknown;
      };
      if (
        raw?.form &&
        typeof raw.form === "object" &&
        Array.isArray(raw.selectedUnits) &&
        raw.selectedUnits.length > 0
      ) {
        setShowReservationRequestForm(true);
      }
    } catch {
      // ignore invalid JSON
    }
  }, [activeView]);

  const historyFetchTicketRef = useRef(0);

  const requestTypeLabelsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of requestTypeOptions) {
      const id = String(opt.value ?? "").trim();
      if (!id) continue;
      map.set(id, String(opt.label ?? opt.value).trim() || id);
    }
    return map;
  }, [requestTypeOptions]);

  const requestTypeLabelsByIdRef = useRef(requestTypeLabelsById);
  requestTypeLabelsByIdRef.current = requestTypeLabelsById;

  const getCurrentUserId = useCallback(() => {
    if (reduxUserId) return reduxUserId;
    return storedUserId(userStorage.getItem());
  }, [reduxUserId, userStorage]);

  const loadHistoryRequests = useCallback(async () => {
    const ticket = ++historyFetchTicketRef.current;
    setHistoryLoading(true);
    setHistoryLoadError(null);

    const userId = getCurrentUserId();

    try {
      const [requestsRes, extensionsRes] = await Promise.all([
        getRequests(userId),
        getExtensions(userId),
      ]);
      if (ticket !== historyFetchTicketRef.current) return;

      if (
        requestsRes &&
        typeof requestsRes === "object" &&
        "error" in requestsRes
      ) {
        const err = requestsRes as { message?: string; error?: string };
        setHistoryRequests([]);
        setHistoryLoadError(
          String(err.message ?? err.error ?? "تعذر تحميل الطلبات."),
        );
        return;
      }

      const mapOptions = {
        userId: userId || undefined,
        requestTypeLabelsById: requestTypeLabelsByIdRef.current,
      };

      const requestItems = parseRequestsListFromApi(requestsRes);
      const requestRows = mapRequestsToTableRows(requestItems, mapOptions);

      let extensionRows: HousingRequestTableRow[] = [];
      if (
        extensionsRes &&
        typeof extensionsRes === "object" &&
        !("error" in extensionsRes)
      ) {
        const extensionItems = parseExtensionsListFromApi(extensionsRes);
        extensionRows = mapExtensionsToTableRows(extensionItems, mapOptions);
      }

      setHistoryRequests(
        mergeAndSortHistoryTableRows(requestRows, extensionRows),
      );
    } catch {
      if (ticket !== historyFetchTicketRef.current) return;
      setHistoryRequests([]);
      setHistoryLoadError("تعذر تحميل الطلبات.");
    } finally {
      if (ticket === historyFetchTicketRef.current) {
        setHistoryLoading(false);
      }
    }
  }, [getCurrentUserId]);

  useEffect(() => {
    if (activeView !== "history") return;
    void loadHistoryRequests();
    return () => {
      historyFetchTicketRef.current += 1;
      setHistoryLoading(false);
    };
  }, [activeView, loadHistoryRequests]);

  const openHistoryModal = (
    row: HousingRequestTableRow,
    modalMode: "view" | "edit",
  ) => {
    setHistoryModalRequestId(row.id);
    setHistoryModalRow(row);
    setHistoryModalStatus(row.status);
    setHistoryModalMode(modalMode);
    setHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setHistoryModalRequestId(null);
    setHistoryModalRow(null);
    setHistoryModalStatus("");
  };

  const reloadHistoryRequests = useCallback(() => {
    if (activeView !== "history") return;
    void loadHistoryRequests();
  }, [activeView, loadHistoryRequests]);

  const handleDeleteHistoryRequest = async (id: string) => {
    if (
      !window.confirm(
        "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن الحذف.",
      )
    ) {
      return;
    }
    setDeletingRequestId(id);
    try {
      const result = await deleteHousingRequest(id);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "فشل الحذف",
          description: result.message,
        });
        return;
      }
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح." });
      reloadHistoryRequests();
    } finally {
      setDeletingRequestId(null);
    }
  };

  useEffect(() => {
    const normalizeGenderValue = (raw: unknown): "male" | "female" | null => {
      const text = String(raw ?? "")
        .trim()
        .toLowerCase();
      if (
        text === "male" ||
        text === "ذكر" ||
        text === "man" ||
        text === "m" ||
        text === "1"
      ) {
        return "male";
      }
      if (
        text === "female" ||
        text === "أنثى" ||
        text === "انثى" ||
        text === "woman" ||
        text === "f" ||
        text === "2"
      ) {
        return "female";
      }
      return null;
    };

    void oncePerSession("reservation:inquiry-lookups", async () => {
      const [requestTypesRes, gendersRes, allocationTypesRes] =
        await Promise.all([
          getRequestTypes(),
          getGenders(),
          getAllocationTypes(),
        ]);
      return {
        requestTypesRes,
        gendersRes,
        allocationTypesRes,
      };
    }).then(
      ({ requestTypesRes, gendersRes, allocationTypesRes }) => {
        if (!(requestTypesRes as { error?: string } | null)?.error) {
          const mapped = mapGenericOptions(requestTypesRes);
          if (mapped.length > 0) setRequestTypeOptions(mapped);
        }

        if (!(gendersRes as { error?: string } | null)?.error) {
          const rawList = getLookupArray(gendersRes);
          const uniqueValues = new Set<"male" | "female">();
          const mapped = rawList
            .map((item) => item as Record<string, unknown>)
            .map((item) =>
              normalizeGenderValue(
                item?.nameEn ?? item?.nameAr ?? item?.value ?? item?.id,
              ),
            )
            .filter((value): value is "male" | "female" => Boolean(value))
            .filter((value) => {
              if (uniqueValues.has(value)) return false;
              uniqueValues.add(value);
              return true;
            })
            .map((value) => ({
              value,
              label: value === "male" ? ("رجال" as const) : ("سيدات" as const),
            }));

          if (mapped.length > 0) setGenderOptions(mapped);
        }

        if (!(allocationTypesRes as { error?: string } | null)?.error) {
          const mapped = mapGenericOptions(allocationTypesRes);
          if (mapped.length > 0) setAllocationTypeOptions(mapped);
        }
      },
    );
  }, []);

  const handleCheckAvailability = async () => {
    const nextErrors: AvailabilityErrors = {};
    const nightsNumber = Number(nights);

    if (!startDate) nextErrors.startDate = "يرجى اختيار تاريخ البدء";
    if (!nights) nextErrors.nights = "يرجى إدخال عدد الليالي";
    else if (!Number.isFinite(nightsNumber) || nightsNumber < 1) {
      nextErrors.nights = "عدد الليالي يجب أن يكون 1 على الأقل";
    } else if (nightsNumber > 21) {
      nextErrors.nights = "عدد الليالي يجب ألا يتجاوز 21 ليلة";
    }
    if (selectedUnitTypes.length === 0)
      nextErrors.unitType = "يرجى اختيار نوع الوحدة (خيار واحد أو أكثر)";
    if (!requestType) nextErrors.requestType = "يرجى اختيار نوع الطلب";
    if (selectedGenders.length === 0)
      nextErrors.gender = "يرجى اختيار الجنس (خيار واحد أو أكثر)";
    if (!allocationType) nextErrors.allocationType = "يرجى اختيار نوع الحجز";

    if (Object.keys(nextErrors).length > 0) {
      setAvailabilityErrors(nextErrors);
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى تعبئة جميع الحقول للتحقق من التوفر",
      });
      return;
    }

    const kinds = orderedUnitKindsFromSelection(selectedUnitTypes);
    if (kinds.length === 0) {
      setAvailabilityErrors((prev) => ({
        ...prev,
        unitType: "نوع الوحدة غير صالح",
      }));
      toast({
        variant: "destructive",
        title: "نوع الوحدة",
        description: "يرجى اختيار سرير أو غرفة أو شقة",
      });
      return;
    }

    setAvailabilityErrors({});
    setIsChecking(true);
    setAvailabilitySearchStatus("loading");
    setAvailabilityCards([]);
    setSelectedAvailabilityKeys([]);

    try {
      const inquiryStartYmd = normalizeInquiryStartYmd(startDate);
      const { cards, fatalError, partialFailure } =
        await fetchMergedAvailabilityCards(
          kinds,
          inquiryStartYmd
            ? {
                startDateYmd: inquiryStartYmd,
                nights: nightsNumber,
              }
            : undefined,
        );
      if (fatalError) {
        setAvailabilitySearchStatus("error");
        toast({
          variant: "destructive",
          title: "فشل التحقق من التوفر",
          description: fatalError,
        });
        return;
      }
      setAvailabilityCards(cards);
      setAvailabilitySearchStatus("success");
      if (partialFailure) {
        toast({
          title: "تنبيه",
          description: "تم تحميل بعض أنواع الوحدات فقط؛ تعذر تحميل البقية.",
        });
      }
    } catch {
      setAvailabilitySearchStatus("error");
      toast({
        variant: "destructive",
        title: "فشل التحقق من التوفر",
        description: "حدث خطأ غير متوقع",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const toggleAvailabilityCard = (key: string) => {
    setSelectedAvailabilityKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSaveReservationSelection = () => {
    const selectedUnits = availabilityCards.filter((c) =>
      selectedAvailabilityKeys.includes(availabilityCardKey(c)),
    );
    if (selectedUnits.length === 0) {
      toast({
        variant: "destructive",
        title: "لا يوجد اختيار",
        description: "يرجى تحديد وحدة واحدة على الأقل",
      });
      return;
    }

    const unitTypeLabels = selectedUnitTypes.map(
      (value) => UNIT_TYPE_LABEL_AR[value] ?? value,
    );
    const unitTypeLabel = unitTypeLabels.join("، ");
    const requestTypeLabel =
      requestTypeOptions.find((o) => o.value === requestType)?.label ??
      requestType;
    const genderLabels = selectedGenders.map(
      (value) => genderOptions.find((o) => o.value === value)?.label ?? value,
    );
    const allocationTypeLabel =
      allocationTypeOptions.find((o) => o.value === allocationType)?.label ??
      allocationType;

    const startIso = startDate
      ? new Date(`${startDate}T12:00:00`).toISOString()
      : null;
    const startDisplay = startDate
      ? format(new Date(`${startDate}T12:00:00`), "yyyy-MM-dd", { locale: ar })
      : null;

    reservation.setItem({
      savedAt: new Date().toISOString(),
      locale,
      form: {
        startDateYmd: startDate || null,
        startDate: startIso,
        startDateDisplay: startDisplay,
        nights,
        unitTypes: [...selectedUnitTypes],
        unitTypeLabels,
        unitType: selectedUnitTypes[0] ?? "",
        unitTypeLabel,
        requestType,
        requestTypeLabel,
        genders: [...selectedGenders],
        genderLabels,
        allocationType,
        allocationTypeLabel,
      },
      selectedUnits: toReservationStoredUnits(selectedUnits),
    });

    toast({
      description:
        "تم حفظ بيانات الاستعلام بنجاح ويرجى تسجيل الدخول لتقديم طلب الحجز",
    });

    if (activeView === "new") {
      setShowReservationRequestForm(true);
    }
  };

  const isAvailabilityView = activeView === "new" || activeView === "extend";

  const applicantDisplayName = (() => {
    const u = userStorage.getItem() as { name?: string } | undefined;
    const n = u?.name;
    return typeof n === "string" && n.trim().length > 0
      ? n.trim()
      : "مقدم الطلب";
  })();

  const initialNightsForRequest = (() => {
    const n = Number(String(nights).trim());
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(21, Math.floor(n));
  })();

  return (
    <main className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
      <motion.div
        className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4"
        variants={mainCardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden border-2 border-blue-100 rounded-3xl shadow-xl">
          <motion.header
            className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm"
            style={{ backgroundColor: "#00005c" }}
            variants={mainCardChildrenVariants}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl md:text-3xl font-bold text-white tracking-wide">
                  نظام إدارة إسكان محافظة أسوان
                </h1>
              </div>
            </div>
          </motion.header>

          <motion.div
            className="px-2 sm:px-4 md:px-6 lg:px-8 py-4"
            variants={mainCardChildrenVariants}
          >
            <motion.div
              className="w-full"
              variants={pageContentVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-4">
                <motion.div variants={sectionVariants}>
                  <Card className="border-2 border-blue-100 rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">الخدمات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("new")}
                          variant={activeView === "new" ? "default" : "outline"}
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          طلب إقامة جديد
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("extend")}
                          variant={
                            activeView === "extend" ? "default" : "outline"
                          }
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          تمديد إقامة
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("history")}
                          variant={
                            activeView === "history" ? "default" : "outline"
                          }
                          className="h-auto min-h-11 w-full justify-start py-3 text-base"
                        >
                          طلباتى السابقة
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.section
                  className="min-h-[420px]"
                  variants={sectionVariants}
                >
                  {isAvailabilityView ? (
                    <motion.div
                      key={activeView}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.15,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 90,
                      }}
                    >
                      <Card className="h-full border-2 border-blue-200 rounded-3xl shadow-lg bg-white text-gray-800">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                              <Search className="h-5 w-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-lg md:text-xl text-gray-800">
                              {activeView === "new"
                                ? "طلب إقامة جديد"
                                : "تمديد إقامة"}
                            </CardTitle>
                          </div>
                          <p className="text-gray-500 text-sm mt-1 pe-1">
                            تحقق من توفر الوحدات السكنية في التاريخ المطلوب
                          </p>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                              <CalendarDays className="h-4 w-4 text-blue-500" />
                              تاريخ البدء
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  dir="rtl"
                                  className={cn(
                                    "h-[3.75rem] min-h-[3.75rem] w-full justify-between text-right text-base font-normal leading-[3.75rem] bg-white border-2 border-black text-gray-800 hover:bg-gray-50 px-3 py-0",
                                    !startDate && "text-muted-foreground",
                                  )}
                                >
                                  <span>
                                    {startDate
                                      ? format(
                                          new Date(`${startDate}T12:00:00`),
                                          "PPP",
                                          { locale: ar },
                                        )
                                      : "اختر التاريخ"}
                                  </span>
                                  <CalendarIcon className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="z-[10002] w-auto p-0 pointer-events-auto"
                                align="start"
                                dir="rtl"
                              >
                                <Calendar
                                  mode="single"
                                  selected={
                                    startDate
                                      ? new Date(`${startDate}T12:00:00`)
                                      : undefined
                                  }
                                  onSelect={(date) =>
                                    setStartDate(
                                      date ? format(date, "yyyy-MM-dd") : "",
                                    )
                                  }
                                  locale={ar}
                                  disabled={(date) =>
                                    date > maxSelectableDate ||
                                    date < minSelectableDate
                                  }
                                  initialFocus
                                  captionLayout="dropdown"
                                  toYear={currentYear + 5}
                                />
                              </PopoverContent>
                            </Popover>
                            {availabilityErrors.startDate ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.startDate}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                              <Moon className="h-4 w-4 text-blue-500" />
                              عدد الليالي
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={21}
                              placeholder="أدخل عدد الليالي"
                              value={nights}
                              onChange={(e) => setNights(e.target.value)}
                              className="h-[3.75rem] min-h-[3.75rem] bg-white border-black text-gray-800 text-base leading-[3.75rem] placeholder:text-sm placeholder:text-gray-400 placeholder:leading-[3.75rem] focus:border-blue-400 focus:ring-blue-400/30"
                            />
                            {availabilityErrors.nights ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.nights}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              نوع الوحدة
                              <span className="text-red-500 text-xs">*</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                (يمكن اختيار أكثر من نوع)
                              </span>
                            </Label>
                            <div
                              className="grid grid-cols-3 gap-2"
                              dir="rtl"
                              lang="ar"
                            >
                              {ALL_UNIT_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    const v = opt.value as AvailableUnitType;
                                    setSelectedUnitTypes((prev) =>
                                      prev.includes(v)
                                        ? prev.filter((x) => x !== v)
                                        : [...prev, v],
                                    );
                                    setAvailabilityErrors((prev) => ({
                                      ...prev,
                                      unitType: undefined,
                                    }));
                                  }}
                                  className={`py-2.5 px-2 rounded-xl border-2 font-semibold text-sm transition-all duration-200 whitespace-nowrap text-center leading-snug ${
                                    selectedUnitTypes.includes(
                                      opt.value as AvailableUnitType,
                                    )
                                      ? "bg-[#00005c] border-[#00005c] text-white shadow-md shadow-[#00005c]/25 scale-[1.02]"
                                      : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {availabilityErrors.unitType ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.unitType}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 text-base flex items-center gap-1">
                              نوع الطلب
                              <span className="text-red-500 text-xs">*</span>
                            </Label>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {requestTypeOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setRequestType(opt.value);
                                    setAvailabilityErrors((prev) => ({
                                      ...prev,
                                      requestType: undefined,
                                    }));
                                  }}
                                  className={`py-2.5 px-3 rounded-xl border-2 font-medium text-sm transition-all duration-200 whitespace-nowrap shrink-0 min-w-[calc((100%-1rem)/3)] ${
                                    requestType === opt.value
                                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                                      : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {availabilityErrors.requestType ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.requestType}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 text-base flex items-center gap-1">
                              الجنس
                              <span className="text-red-500 text-xs">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              {genderOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setSelectedGenders((prev) =>
                                      prev.includes(opt.value)
                                        ? prev.filter((v) => v !== opt.value)
                                        : [...prev, opt.value],
                                    );
                                    setAvailabilityErrors((prev) => ({
                                      ...prev,
                                      gender: undefined,
                                    }));
                                  }}
                                  className={`py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                                    selectedGenders.includes(opt.value)
                                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                                      : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {availabilityErrors.gender ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.gender}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 text-base flex items-center gap-1">
                              نوع الحجز
                              <span className="text-red-500 text-xs">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              {allocationTypeOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setAllocationType(opt.value);
                                    setAvailabilityErrors((prev) => ({
                                      ...prev,
                                      allocationType: undefined,
                                    }));
                                  }}
                                  className={`py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                                    allocationType === opt.value
                                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                                      : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {availabilityErrors.allocationType ? (
                              <p className="text-xs text-red-600">
                                {availabilityErrors.allocationType}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <FlexibleAllocationNotice />
                            {showEmployeeDiscountNotice ? (
                              <EmployeeDiscountNotice />
                            ) : null}
                          </div>

                          <Button
                            type="button"
                            onClick={handleCheckAvailability}
                            disabled={isChecking}
                            className="w-full py-5 rounded-2xl font-semibold text-base text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ backgroundColor: "#00005c" }}
                          >
                            {isChecking ? (
                              <span className="flex items-center gap-2">
                                <motion.div
                                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                />
                                جارٍ التحقق...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                تحقق من التوفر
                              </span>
                            )}
                          </Button>

                          {availabilitySearchStatus === "success" &&
                            (() => {
                              const searchedKinds =
                                orderedUnitKindsFromSelection(
                                  selectedUnitTypes,
                                );
                              const unavailableMessage =
                                getUnavailableUnitTypesMessage(
                                  searchedKinds,
                                  availabilityCards,
                                );
                              if (!unavailableMessage) return null;
                              return (
                                <motion.div
                                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{ duration: 0.4 }}
                                  className="flex items-center gap-3 p-4 rounded-2xl border-2 font-semibold text-base bg-rose-50 border-rose-200 text-rose-900"
                                >
                                  <XCircle className="h-6 w-6 shrink-0 text-rose-600" />
                                  {unavailableMessage}
                                </motion.div>
                              );
                            })()}

                          {availabilitySearchStatus === "success" &&
                            availabilityCards.length > 0 && (
                              <div className="space-y-3">
                                <motion.div
                                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{ duration: 0.4 }}
                                  className="flex items-center gap-3 p-4 rounded-2xl border-2 font-semibold text-base bg-emerald-50 border-emerald-200 text-emerald-950"
                                >
                                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                                  يوجد{" "}
                                  {availabilityCards.length.toLocaleString(
                                    "ar-EG",
                                  )}{" "}
                                  {availabilityCards.length === 1
                                    ? "وحدة متاحة"
                                    : "وحدات متاحة"}
                                </motion.div>
                                <div className="grid gap-3 sm:grid-cols-2 max-h-[min(360px,50vh)] overflow-y-auto pr-1">
                                  {availabilityCards.map((card, cardIdx) => {
                                    const cKey = availabilityCardKey(card);
                                    const isSelected =
                                      selectedAvailabilityKeys.includes(cKey);
                                    const checkboxId =
                                      `avail-${cardIdx}-${card.unitKind}-${card.id}`.replace(
                                        /[^a-zA-Z0-9_-]/g,
                                        "_",
                                      );
                                    return (
                                      <motion.div
                                        key={cKey}
                                        layout
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                          "rounded-2xl border-2 p-4 text-right shadow-sm transition-shadow hover:shadow-md",
                                          card.unitKind === "bed" &&
                                            "bg-gradient-to-br from-sky-50 via-white to-slate-50/80 border-sky-200",
                                          card.unitKind === "room" &&
                                            "bg-gradient-to-br from-teal-50 via-white to-slate-50/80 border-teal-200",
                                          card.unitKind === "apartment" &&
                                            "bg-gradient-to-br from-violet-50 via-white to-slate-50/80 border-violet-200",
                                          isSelected &&
                                            "ring-2 ring-offset-1 ring-blue-500 border-blue-300",
                                        )}
                                      >
                                        <label
                                          htmlFor={checkboxId}
                                          className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-200/70 pb-2 mb-3"
                                        >
                                          <span className="text-xs font-medium text-slate-600">
                                            إضافة للاختيار
                                          </span>
                                          <input
                                            id={checkboxId}
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleAvailabilityCard(cKey)
                                            }
                                            className="h-4 w-4 shrink-0 rounded border-slate-400 text-[#00005c] focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                                          />
                                        </label>
                                        <div className="flex items-start gap-3">
                                          <div
                                            className={cn(
                                              "shrink-0 rounded-xl p-2.5",
                                              card.unitKind === "bed" &&
                                                "bg-sky-100 text-sky-800 border border-sky-200/80",
                                              card.unitKind === "room" &&
                                                "bg-teal-100 text-teal-800 border border-teal-200/80",
                                              card.unitKind === "apartment" &&
                                                "bg-violet-100 text-violet-800 border border-violet-200/80",
                                            )}
                                          >
                                            {card.unitKind === "bed" ? (
                                              <Bed className="h-5 w-5" />
                                            ) : card.unitKind === "room" ? (
                                              <Home className="h-5 w-5" />
                                            ) : (
                                              <Building2 className="h-5 w-5" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1 space-y-1.5">
                                            <div
                                              className="flex items-start justify-between gap-3"
                                              dir="rtl"
                                            >
                                              <p className="min-w-0 flex-1 font-bold text-base leading-tight text-slate-900">
                                                {card.title}
                                              </p>
                                              {card.priceLabel ? (
                                                <p className="shrink-0 text-xl font-extrabold leading-none tracking-tight text-emerald-700 tabular-nums sm:text-2xl">
                                                  {card.priceLabel}
                                                </p>
                                              ) : null}
                                            </div>
                                            {card.genderType ? (
                                              <p className="text-base font-bold leading-snug text-slate-800">
                                                <span className="font-semibold text-slate-600">
                                                  نوع الجنس:{" "}
                                                </span>
                                                {card.genderType}
                                              </p>
                                            ) : null}
                                            {card.buildingNumberAr ||
                                            card.city ? (
                                              <div className="space-y-0.5 text-sm font-semibold leading-snug text-slate-800">
                                                {card.buildingNumberAr ? (
                                                  <p>
                                                    <span className="text-slate-600">
                                                      رقم المبنى:{" "}
                                                    </span>
                                                    <span className="font-bold tabular-nums text-slate-900">
                                                      {card.buildingNumberAr}
                                                    </span>
                                                  </p>
                                                ) : null}
                                                {card.city ? (
                                                  <p>
                                                    <span className="text-slate-600">
                                                      المدينة:{" "}
                                                    </span>
                                                    <span className="font-bold text-slate-900">
                                                      {card.city}
                                                    </span>
                                                  </p>
                                                ) : null}
                                              </div>
                                            ) : null}
                                            <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
                                              {card.subtitle}
                                            </p>
                                          </div>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                                {selectedAvailabilityKeys.length > 0 ? (
                                  <Button
                                    type="button"
                                    onClick={handleSaveReservationSelection}
                                    className="w-full py-4 rounded-2xl font-semibold text-base text-white shadow-md transition-all duration-300 hover:opacity-95"
                                    style={{ backgroundColor: "#00005c" }}
                                  >
                                    <span className="inline-flex items-center justify-center gap-2">
                                      <Bookmark className="h-4 w-4 shrink-0" />
                                      حفظ المحدد والبيانات (
                                      {selectedAvailabilityKeys.length.toLocaleString(
                                        "ar-EG",
                                      )}
                                      )
                                    </span>
                                  </Button>
                                ) : null}
                              </div>
                            )}
                        </CardContent>
                      </Card>

                      {activeView === "new" && showReservationRequestForm ? (
                        <motion.div
                          className="mt-6"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                        >
                          <ReservationRequestForm
                            applicantName={applicantDisplayName}
                            initialStartDate={startDate}
                            initialNumberOfNights={initialNightsForRequest}
                            onNavigateToHistory={() => {
                              setShowReservationRequestForm(false);
                              setActiveView("history");
                            }}
                            onStorageCleared={() =>
                              setShowReservationRequestForm(false)
                            }
                          />
                        </motion.div>
                      ) : null}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Card className="border-2 border-blue-100 rounded-2xl">
                        <CardHeader>
                          <CardTitle>آخر طلبات الإقامة</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-md border">
                            <Table className="text-base">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-center h-11">
                                    رقم الطلب
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    تصنيف الطلب
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    نوع الطلب
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    نوع الحجز
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    تاريخ البدء
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    الليالي
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    الحالة
                                  </TableHead>
                                  <TableHead className="text-center h-11">
                                    إجراءات
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {historyLoading &&
                                historyRequests.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={9}
                                      className="py-10 text-center text-base text-muted-foreground"
                                    >
                                      <span className="inline-flex items-center justify-center gap-2">
                                        <Loader2
                                          className="h-5 w-5 animate-spin"
                                          aria-hidden
                                        />
                                        جاري تحميل الطلبات...
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ) : historyLoadError &&
                                  historyRequests.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={9}
                                      className="py-8 text-center text-base text-destructive"
                                    >
                                      {historyLoadError}
                                    </TableCell>
                                  </TableRow>
                                ) : historyRequests.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={9}
                                      className="py-8 text-center text-base text-muted-foreground"
                                    >
                                      لا توجد طلبات سابقة.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  historyRequests.map((row) => (
                                    <TableRow key={row.id}>
                                      <TableCell className="text-center py-3">
                                        {row.requestNo}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.requestClassification}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.requestType}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.requestAllocationType}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.startDate}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.nights.toLocaleString("ar-EG")}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.status}
                                      </TableCell>
                                      <TableCell className="text-center py-3">
                                        {row.entryKind === "request" ? (
                                          <HousingRequestRowActions
                                            row={row}
                                            deleting={
                                              deletingRequestId === row.id
                                            }
                                            onView={(r) =>
                                              openHistoryModal(r, "view")
                                            }
                                            onEdit={(r) =>
                                              openHistoryModal(r, "edit")
                                            }
                                            onDelete={
                                              handleDeleteHistoryRequest
                                            }
                                          />
                                        ) : (
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                          {historyModalOpen && historyModalRequestId ? (
                            <HousingRequestDetailModal
                              open={historyModalOpen}
                              mode={historyModalMode}
                              requestId={historyModalRequestId}
                              statusLabel={historyModalStatus}
                              tableRow={historyModalRow}
                              requestTypeLabelsById={requestTypeLabelsById}
                              onClose={closeHistoryModal}
                              onChanged={reloadHistoryRequests}
                            />
                          ) : null}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </motion.section>
              </div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
      <div className="mb-14 text-transparent">t</div>
    </main>
  );
};

export default ReservationPage;
