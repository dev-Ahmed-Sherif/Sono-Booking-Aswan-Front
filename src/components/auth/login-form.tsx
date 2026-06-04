"use client";

import { useEffect, useState, useTransition } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useDispatch } from "react-redux";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Bed,
  Bookmark,
  Building2,
  CalendarDays,
  CalendarIcon,
  CheckCircle2,
  Home,
  LogIn,
  Moon,
  Search,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { getUserData, Login } from "@/actions/auth";
import type { AvailableUnitType } from "@/actions/availabilityService";
import { getGenders } from "@/actions/settings/genderService";
import { getAllocationTypes } from "@/actions/settings/allocationTypeService";
import { getRequestTypes } from "@/actions/settings/requestTypeService";
import {
  setGovernorateId,
  setOrganizationId,
  setRole,
  setUserId,
} from "@/redux/userReducer";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { LoginSchema } from "@/schemas";
import type { AvailabilityUnitCard, GenericOption } from "@/lib/availability-inquiry";
import {
  ALL_UNIT_TYPE_OPTIONS,
  getUnavailableUnitTypesMessage,
  UNIT_TYPE_LABEL_AR,
  availabilityCardKey,
  fetchMergedAvailabilityCards,
  getLookupArray,
  mapGenericOptions,
  normalizeInquiryStartYmd,
  orderedUnitKindsFromSelection,
  toReservationStoredUnits,
} from "@/lib/availability-inquiry";
import { getPostLoginPath } from "@/lib/role-utils";
import { FlexibleAllocationNotice } from "@/components/reservation/allocation-type-notices";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LoginFormProps = {
  Cookie: any | null;
};

type LoginActionResult =
  | { error: string; message?: string }
  | Record<string, unknown>;

function extractLoginPayload(
  data: LoginActionResult,
): { isLogedIn: boolean; refreshToken?: string } | null {
  if ("error" in data && data.error) return null;
  const root = data as Record<string, unknown>;
  const payload = (root.data ?? root) as Record<string, unknown>;
  const isLogedIn = Boolean(payload.isLogedIn ?? payload.isLoggedIn);
  const refreshToken =
    typeof payload.refreshToken === "string" ? payload.refreshToken : undefined;
  return { isLogedIn, refreshToken };
}

/** Wait for login server action to persist access token before tokendata. */
const POST_LOGIN_TOKEN_DELAY_MS = 400;

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
type RequestTypeOption = { value: string; label: string };
type AllocationTypeOption = { value: string; label: string };

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOADER_DURATION_MS = 1500;

/** Set a cookie in the browser (client-only). Uses 30 days if env is missing or invalid. */
function setClientCookie(
  name: string,
  value: string,
  lifeSecondsEnv?: string,
): void {
  if (typeof document === "undefined") return;
  const nameTrimmed = (name || "").trim() || "Ref_Tok_Housing_Aswan";
  const lifeSeconds = parseInt(String(lifeSecondsEnv || "0").trim(), 10);
  const defaultSeconds = 30 * 24 * 60 * 60;
  const seconds =
    Number.isNaN(lifeSeconds) || lifeSeconds <= 0
      ? defaultSeconds
      : lifeSeconds;
  const expires = new Date(Date.now() + seconds * 1000).toUTCString();
  const encoded = encodeURIComponent(value);
  document.cookie = `${nameTrimmed}=${encoded};path=/;expires=${expires};SameSite=Lax`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LoginForm({ Cookie }: LoginFormProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const { toast } = useToast();
  const dispatch = useDispatch();
  const nav = useLocalStorage("Nav");
  const user = useLocalStorage("user");
  const reservation = useLocalStorage("reservation");

  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // Availability check state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [nights, setNights] = useState("");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<AvailableUnitType[]>(
    [],
  );
  const [requestType, setRequestType] = useState("");
  const [selectedGenders, setSelectedGenders] = useState<GenderOption["value"][]>(
    [],
  );
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
  const [genderOptions, setGenderOptions] = useState<GenderOption[]>([
    { value: "male", label: "رجال" },
    { value: "female", label: "سيدات" },
  ]);
  const [requestTypeOptions, setRequestTypeOptions] = useState<
    RequestTypeOption[]
  >([]);
  const [allocationTypeOptions, setAllocationTypeOptions] = useState<
    AllocationTypeOption[]
  >([]);

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Redirect if already logged in
  useEffect(() => {
    const hasAccess = Cookie != null && (Cookie as { value?: string })?.value;
    if (!hasAccess || typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    const isLoginPage =
      currentPath === `/${locale}` ||
      currentPath === `/${locale}/` ||
      currentPath === "/ar" ||
      currentPath === "/en";
    if (!isLoginPage) return;

    const timeoutId = setTimeout(() => {
      const savedNav = nav.getItem();
      const lastRoute =
        typeof savedNav === "string" && savedNav.trim().length > 0
          ? savedNav.trim()
          : null;
      const isLoginRoot =
        lastRoute === "/ar" ||
        lastRoute === "/en" ||
        lastRoute === "/ar/" ||
        lastRoute === "/en/";
      if (
        lastRoute &&
        !isLoginRoot &&
        (lastRoute.startsWith("/ar/") || lastRoute.startsWith("/en/"))
      ) {
        router.replace(lastRoute);
        return;
      }

      const storedRole = user.getItem()?.role;
      const referrer = document.referrer || "";
      let redirectPath = getPostLoginPath(locale, storedRole);
      if (referrer) {
        try {
          const refUrl = new URL(referrer);
          const sameOrigin = refUrl.origin === window.location.origin;
          const refPath = refUrl.pathname;
          const isReferrerLoginRoot =
            refPath === "/ar" ||
            refPath === "/en" ||
            refPath === "/ar/" ||
            refPath === "/en/";
          const isAppRoute =
            refPath.startsWith("/ar/") || refPath.startsWith("/en/");
          if (sameOrigin && !isReferrerLoginRoot && isAppRoute) {
            redirectPath = `${refPath}${refUrl.search}`;
          }
        } catch {
          // keep default redirectPath
        }
      }
      router.replace(redirectPath);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [Cookie, locale, nav, router, user]);

  // Clear user state on mount when not authenticated
  useEffect(() => {
    const hasAccess = Cookie != null && (Cookie as { value?: string })?.value;
    if (hasAccess || typeof window === "undefined") return;
    user.removeItem();
    dispatch(setUserId(""));
    dispatch(setOrganizationId(""));
    dispatch(setRole(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Cookie]);

  // Loader hide after delay
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), LOADER_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Reset availability result when any field changes
  useEffect(() => {
    setAvailabilitySearchStatus("idle");
    setAvailabilityCards([]);
    setSelectedAvailabilityKeys([]);
    setAvailabilityErrors({});
  }, [startDate, nights, selectedUnitTypes, requestType, selectedGenders, allocationType]);

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

    const loadGenderOptions = async () => {
      const response = await getGenders();
      if ((response as { error?: string } | null)?.error) return;

      const rawList = getLookupArray(response);

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
    };

    void loadGenderOptions();
  }, []);

  useEffect(() => {
    const loadRequestTypeOptions = async () => {
      const response = await getRequestTypes();
      if ((response as { error?: string } | null)?.error) return;

      const mapped = mapGenericOptions(response);

      if (mapped.length > 0) setRequestTypeOptions(mapped);
    };

    void loadRequestTypeOptions();
  }, []);

  useEffect(() => {
    const loadAllocationTypeOptions = async () => {
      const response = await getAllocationTypes();
      if ((response as { error?: string } | null)?.error) return;

      const mapped = mapGenericOptions(response);

      if (mapped.length > 0) setAllocationTypeOptions(mapped);
    };

    void loadAllocationTypeOptions();
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
      (value) =>
        UNIT_TYPE_LABEL_AR[value] ?? value,
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

    reservation.setItem({
      savedAt: new Date().toISOString(),
      locale,
      form: {
        startDate: startDate ? startDate.toISOString() : null,
        startDateDisplay: startDate
          ? format(startDate, "yyyy-MM-dd", { locale: ar })
          : null,
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
  };

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    startTransition(() => {
      Login(values)
        .then(async (data) => {
          const login = extractLoginPayload(data as LoginActionResult);
          if (!login?.isLogedIn) return;

          const { refreshToken } = login;
          await delayMs(POST_LOGIN_TOKEN_DELAY_MS);

          try {
            const result = await getUserData();
            if (result.error) {
              toast({
                variant: "destructive",
                title: "خطأ",
                description: result.message || "فشل في جلب بيانات المستخدم",
              });
              return;
            }
            if (!result.data?.data) return;

            const {
              id,
              role,
              name,
              organizationId,
              governorateId,
              employeeId,
              EmployeeId,
            } = result.data.data;
            const resolvedEmployeeId = employeeId ?? EmployeeId;
            user.setItem({
              id,
              role,
              name,
              organizationId: organizationId ?? "",
              governorateId: governorateId ?? "",
              ...(resolvedEmployeeId != null && resolvedEmployeeId !== ""
                ? { employeeId: resolvedEmployeeId }
                : {}),
            });
            dispatch(setUserId(id));
            dispatch(setOrganizationId(organizationId));
            dispatch(setRole(role));
            dispatch(setGovernorateId(governorateId ?? ""));
            if (refreshToken && typeof refreshToken === "string") {
              const cookieName =
                (process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE ?? "").trim() ||
                "Ref_Tok_Housing_Aswan";
              const cookieLife =
                process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE_LIFE ?? "";
              setTimeout(() => {
                setClientCookie(cookieName, refreshToken, cookieLife);
              }, 0);
            }
            if (id) {
              const guideCookieName =
                (process.env.NEXT_PUBLIC_REFRESH_GUDIE_COOKIE ?? "").trim() ||
                "Ref_Guid_Housing_Aswan";
              const guideCookieLife =
                process.env.NEXT_PUBLIC_REFRESH_GUDIE_LIFE ?? "";
              setTimeout(() => {
                setClientCookie(guideCookieName, String(id), guideCookieLife);
              }, 0);
            }
            const targetRoute = getPostLoginPath(locale, role);
            nav.setItem(targetRoute);
            setTimeout(() => {
              router.push(targetRoute);
              setTimeout(() => window.location.reload(), 700);
            }, 35);
          } catch (err) {
            console.error("Error getting user data:", err);
            toast({
              variant: "destructive",
              title: "حدث خطأ !",
              description: "يرجى تسجيل الدخول مرة أخرى",
            });
            setTimeout(() => router.push(`/${locale}`), 42);
          }
        })
        .catch((err) => {
          if (err.message?.includes("401") || err.message?.includes("404")) {
            toast({
              variant: "destructive",
              title: "حدث خطأ !",
              description: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
              action: (
                <ToastAction altText="Try again">حاول مرة أخرى</ToastAction>
              ),
            });
          } else {
            toast({
              variant: "destructive",
              title: "حدث خطأ !",
              description: "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً",
              action: (
                <ToastAction altText="Try again">حاول مرة أخرى</ToastAction>
              ),
            });
          }
        });
    });
  };

  if (isLoading) return null;

  return (
    <motion.div
      className="relative min-h-screen w-full flex flex-col"
      dir="rtl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-gray-50 z-0" aria-hidden />

      {/* ── Header ── */}
      <motion.header
        className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm mt-8"
        style={{ backgroundColor: "#00005c" }}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
            <Home className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl md:text-3xl font-bold text-white tracking-wide">
              نظام إدارة إسكان محافظة أسوان
            </h1>
            {/* <p className="text-xs md:text-sm text-white/70 mt-0.5">
              Aswan Governorate Housing Management System
            </p> */}
          </div>
        </div>
      </motion.header>

      {/* ── Main Content ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ═══════════════════════════════════════════
              Right Panel  —  استعلام عن الوحدات
          ═══════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.4,
              duration: 0.6,
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
                    استعلام عن الوحدات المتاحة
                  </CardTitle>
                </div>
                <p className="text-gray-500 text-sm mt-1 pe-1">
                  تحقق من توفر الوحدات السكنية في التاريخ المطلوب
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    تاريخ البدء
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        dir="rtl"
                        className={cn(
                          "w-full justify-between text-right font-normal bg-white border-2 border-black dark:border-white text-gray-800 hover:bg-gray-50",
                          !startDate && "text-muted-foreground",
                        )}
                      >
                        <span>
                          {startDate
                            ? format(startDate, "PPP", { locale: ar })
                            : "اختر التاريخ"}
                        </span>
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="z-50 w-auto p-0"
                      align="start"
                      dir="rtl"
                    >
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        locale={ar}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                        captionLayout="dropdown"
                        toYear={new Date().getFullYear() + 2}
                      />
                    </PopoverContent>
                  </Popover>
                  {availabilityErrors.startDate ? (
                    <p className="text-xs text-red-600">
                      {availabilityErrors.startDate}
                    </p>
                  ) : null}
                </div>

                {/* Number of nights */}
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
                    className="bg-white border-black text-gray-800 placeholder:text-sm placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/30"
                  />
                  {availabilityErrors.nights ? (
                    <p className="text-xs text-red-600">
                      {availabilityErrors.nights}
                    </p>
                  ) : null}
                </div>

                {/* Unit Type */}
                <div className="space-y-1.5">
                  <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    نوع الوحدة
                    <span className="text-red-500 text-xs">*</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      (يمكن اختيار أكثر من نوع)
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2" dir="rtl" lang="ar">
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

                {/* Request Type */}
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

                {/* Gender — required */}
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

                {/* Allocation Type */}
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
                  <FlexibleAllocationNotice />
                </div>

                {/* Check button */}
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

                {/* Result: empty list */}
                {availabilitySearchStatus === "success" &&
                  (() => {
                    const searchedKinds =
                      orderedUnitKindsFromSelection(selectedUnitTypes);
                    const unavailableMessage = getUnavailableUnitTypesMessage(
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

                {/* Result: cards */}
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
                        يوجد {availabilityCards.length.toLocaleString("ar-EG")}{" "}
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
                                  onChange={() => toggleAvailabilityCard(cKey)}
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
                                  {card.buildingNumberAr || card.city ? (
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
          </motion.div>

          {/* ═══════════════════════════════════════════
              Left Panel  —  دخول المستخدمين
          ═══════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.5,
              duration: 0.6,
              type: "spring",
              stiffness: 90,
            }}
            className="h-[32rem] md:h-[36rem]"
          >
            <Card className="h-full w-full border-2 border-green-200 rounded-3xl shadow-lg bg-white text-gray-800 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-50 border border-green-200">
                    <LogIn className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle className="text-lg md:text-xl text-gray-800">
                    دخول المستخدمين
                  </CardTitle>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  خاص بإدارة المستخدمين والموظفين المعتمدين
                </p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-center overflow-hidden">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 w-full"
                  >
                    {/* Email */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 text-base">
                            البريد الإلكتروني
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="example@aswan.gov.eg"
                              type="email"
                              className="bg-white border-black text-gray-800 placeholder:text-sm placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400/30"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Password */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 text-base">
                            كلمة المرور
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="••••••••"
                              type="password"
                              className="bg-white border-black text-gray-800 placeholder:text-sm placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400/30"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Forgot password link */}
                    <div className="flex justify-start">
                      <span
                        className="text-xs text-gray-400 cursor-not-allowed select-none"
                        title="ستكون متاحة في مرحلة قادمة"
                      >
                        نسيت كلمة المرور؟
                        <span className="ms-1 text-[10px] text-gray-300">
                          (قريباً)
                        </span>
                      </span>
                    </div>

                    {/* Login button */}
                    <Button
                      disabled={isPending}
                      type="submit"
                      className="w-full py-5 rounded-2xl font-semibold text-base text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "#00005c" }}
                    >
                      {isPending ? (
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
                          جارٍ الدخول...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <LogIn className="h-4 w-4" />
                          دخول
                        </span>
                      )}
                    </Button>

                    <div className="relative flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-gray-400 text-xs shrink-0">أو</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Register button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(`/${locale}/register`)}
                      className="w-full py-5 rounded-2xl font-semibold text-base border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        تسجيل جديد
                      </span>
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <div className="mb-20 text-transparent">t</div>
    </motion.div>
  );
}
