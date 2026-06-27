"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { ForgotPassword, getUserData, Login, verifyAccessTokenCookie } from "@/actions/auth";
import { PASSWORD_RESET_CONTACT_ADMIN_MESSAGE } from "@/lib/auth-messages";
import {
  guideCookieName,
  refreshTokenCookieName,
} from "@/lib/auth-cookies";
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
import { ForgotPasswordSchema, LoginSchema } from "@/schemas";
import type {
  AvailabilityUnitCard,
  GenericOption,
} from "@/lib/availability-inquiry";
import {
  ALL_UNIT_TYPE_OPTIONS,
  getUnavailableUnitTypesMessage,
  availabilityCardKey,
  fetchMergedAvailabilityCards,
  getLookupArray,
  mapGenericOptions,
  normalizeInquiryStartYmd,
  orderedUnitKindsFromSelection,
  toReservationStoredUnits,
  buildPreservedInquiryFieldsFromUnits,
} from "@/lib/availability-inquiry";
import {
  getFirstAllowedNavRoute,
  isAllowedNavRoute,
} from "@/lib/nav-routes";
import {
  buildStoredUserFromAuthDto,
  roleCandidatesFromAuthUser,
  unwrapAuthUserDto,
} from "@/lib/auth-user";
import {
  clearStoredNavRoute,
  getStoredNavRoute,
  setStoredNavRoute,
} from "@/lib/nav-storage";
import { FlexibleAllocationNotice } from "@/components/reservation/allocation-type-notices";
import { AvailabilityUnitCardParents } from "@/components/reservation/availability-unit-card-parents";
import { AvailabilityUnitCardPhotos } from "@/components/reservation/availability-unit-card-photos";
import { AvailabilityUnitCardPrice } from "@/components/reservation/availability-unit-card-price";
import { AvailabilityUnitCardBedsCount } from "@/components/reservation/availability-unit-card-beds-count";
import {
  fetchAllowedDaysBeforeReservationOffset,
  formatMinReservationStartMessage,
  isReservationStartDateAllowed,
  minReservationStartDateFromOffset,
} from "@/lib/allowed-day-before-reservation";

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
): {
  isLogedIn: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
} | null {
  if ("error" in data && data.error) return null;
  const root = data as Record<string, unknown>;
  const payload = (root.data ?? root) as Record<string, unknown>;
  const isLogedIn = Boolean(payload.isLogedIn ?? payload.isLoggedIn);
  const accessTokenRaw =
    payload.accessToken ??
    payload.AccessToken ??
    (payload as { access_token?: string }).access_token;
  const accessToken =
    typeof accessTokenRaw === "string" && accessTokenRaw.trim()
      ? accessTokenRaw.trim()
      : undefined;
  const refreshToken =
    typeof payload.refreshToken === "string" && payload.refreshToken.trim()
      ? payload.refreshToken.trim()
      : undefined;
  const userIdRaw = payload.userId ?? payload.UserId ?? payload.id ?? payload.Id;
  const userId = normalizeAuthUserId(userIdRaw);
  return { isLogedIn, accessToken, refreshToken, userId };
}

/** Login API may return user id as string or number. */
function normalizeAuthUserId(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  return undefined;
}

const AUTH_COOKIE_VERIFY_TIMEOUT_MS = 4000;
const AUTH_COOKIE_VERIFY_INTERVAL_MS = 75;

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncServerAccessToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const hit = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  if (!hit) return null;
  const raw = hit.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setLoginAuthCookies(tokens: {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
}): void {
  // Access token is httpOnly and set server-side (Login action + /api/auth/set-session).
  if (tokens.refreshToken) {
    setClientCookie(
      refreshTokenCookieName(),
      tokens.refreshToken,
      process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE_LIFE ?? "",
    );
  }
  if (tokens.userId) {
    setClientCookie(
      guideCookieName(),
      tokens.userId,
      process.env.NEXT_PUBLIC_REFRESH_GUDIE_LIFE ?? "",
    );
  }
}

async function waitForClientCookieValues(
  expected: Array<{ name: string; value: string }>,
  timeoutMs = AUTH_COOKIE_VERIFY_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const allMatch = expected.every(
      ({ name, value }) => getClientCookie(name) === value,
    );
    if (allMatch) return true;
    await delayMs(AUTH_COOKIE_VERIFY_INTERVAL_MS);
  }
  return false;
}

async function waitForServerAccessTokenCookie(
  timeoutMs = AUTH_COOKIE_VERIFY_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { ok } = await verifyAccessTokenCookie();
    if (ok) return true;
    await delayMs(AUTH_COOKIE_VERIFY_INTERVAL_MS);
  }
  return false;
}

/** Sets login cookies, verifies client + server visibility, then returns success. */
async function ensureLoginCookiesReady(tokens: {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
}): Promise<boolean> {
  await syncServerAccessToken(tokens.accessToken);
  setLoginAuthCookies(tokens);

  // Only non-httpOnly cookies are visible to document.cookie.
  const clientExpected: Array<{ name: string; value: string }> = [];
  if (tokens.refreshToken) {
    clientExpected.push({
      name: refreshTokenCookieName(),
      value: tokens.refreshToken,
    });
  }

  const [clientOk, serverOk] = await Promise.all([
    clientExpected.length > 0
      ? waitForClientCookieValues(clientExpected)
      : Promise.resolve(true),
    waitForServerAccessTokenCookie(),
  ]);

  return clientOk && serverOk;
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

function hasAccessCookieValue(cookie: LoginFormProps["Cookie"]): boolean {
  return cookie != null && Boolean((cookie as { value?: string })?.value);
}

function resolvePostAuthRedirectPath(
  locale: string,
  authUser: Record<string, unknown> | null | undefined,
): string {
  const roleCandidates = roleCandidatesFromAuthUser(authUser);
  const userId = String(authUser?.id ?? authUser?.Id ?? "").trim();

  if (userId) {
    const savedPath = getStoredNavRoute(userId);
    if (savedPath && isAllowedNavRoute(locale, roleCandidates, savedPath)) {
      return savedPath;
    }
  }

  return getFirstAllowedNavRoute(locale, roleCandidates);
}

function LoginBlockingOverlay({
  title = "جارٍ تحميل لوحة التحكم...",
  subtitle = "يرجى الانتظار",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <Loader2 className="h-12 w-12 animate-spin text-brand" />
      <p className="mt-5 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

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
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? ";Secure"
      : "";
  document.cookie = `${nameTrimmed}=${encoded};path=/;expires=${expires};SameSite=Lax${secure}`;
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
  const user = useLocalStorage("user");
  const reservation = useLocalStorage("reservation");

  const hasAccessCookie = hasAccessCookieValue(Cookie);

  const [isPending, startTransition] = useTransition();
  const [isForgotPasswordPending, startForgotPasswordTransition] = useTransition();
  const [isBootstrapping, setIsBootstrapping] = useState(!hasAccessCookie);
  const [isRedirecting, setIsRedirecting] = useState(hasAccessCookie);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const loginRedirectInProgressRef = useRef(false);

  // Availability check state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [nights, setNights] = useState("");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<
    AvailableUnitType[]
  >([]);
  const [requestType, setRequestType] = useState("");
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
  const [allowedDaysOffset, setAllowedDaysOffset] = useState(0);

  const minReservationStartDate = useMemo(
    () => minReservationStartDateFromOffset(allowedDaysOffset),
    [allowedDaysOffset],
  );

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const forgotPasswordForm = useForm<z.infer<typeof ForgotPasswordSchema>>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: "" },
  });

  // Redirect immediately if already logged in — hydrate user first, then route
  useEffect(() => {
    if (!hasAccessCookie || typeof window === "undefined") return;
    if (loginRedirectInProgressRef.current) return;

    const currentPath = window.location.pathname;
    const isLoginPage =
      currentPath === `/${locale}` ||
      currentPath === `/${locale}/` ||
      currentPath === "/ar" ||
      currentPath === "/en";
    if (!isLoginPage) return;

    let cancelled = false;
    setIsRedirecting(true);

    void (async () => {
      try {
        let authUser = user.getItem() as Record<string, unknown> | undefined;
        const hasRole = Boolean(
          authUser?.role ??
            authUser?.Role ??
            authUser?.roleName ??
            authUser?.RoleName,
        );

        if (!authUser?.id || !hasRole) {
          const result = await getUserData();
          if (result?.error) {
            throw new Error(result.message || "Failed to load user profile");
          }
          const userData = unwrapAuthUserDto(result?.data ?? result);
          if (userData) {
            authUser = buildStoredUserFromAuthDto(userData);
            user.setItem(authUser);
            const id = String(authUser.id ?? "").trim();
            const role = authUser.role;
            if (id) {
              dispatch(setUserId(id));
              dispatch(setOrganizationId(String(authUser.organizationId ?? "")));
              dispatch(setRole(String(role ?? "")));
              dispatch(setGovernorateId(String(authUser.governorateId ?? "")));
            }
          }
        }

        if (cancelled) return;

        const redirectPath = resolvePostAuthRedirectPath(locale, authUser);
        const userId = String(authUser?.id ?? authUser?.Id ?? "").trim();
        if (userId) {
          setStoredNavRoute(userId, redirectPath);
        }
        loginRedirectInProgressRef.current = true;
        window.location.replace(redirectPath);
      } catch (error) {
        console.error("Post-auth redirect failed:", error);
        if (!cancelled) {
          setIsRedirecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, hasAccessCookie, locale, user]);

  // Clear user state on mount when not authenticated
  useEffect(() => {
    if (hasAccessCookie || typeof window === "undefined") return;
    clearStoredNavRoute();
    user.removeItem();
    dispatch(setUserId(""));
    dispatch(setOrganizationId(""));
    dispatch(setRole(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccessCookie]);

  // Initial splash only for guests — authenticated users redirect without showing login UI
  useEffect(() => {
    if (hasAccessCookie) return;
    const timer = setTimeout(() => setIsBootstrapping(false), LOADER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hasAccessCookie]);

  // Reset availability result when any field changes
  useEffect(() => {
    setAvailabilitySearchStatus("idle");
    setAvailabilityCards([]);
    setSelectedAvailabilityKeys([]);
    setAvailabilityErrors({});
  }, [
    startDate,
    nights,
    selectedUnitTypes,
    requestType,
    selectedGenders,
    allocationType,
  ]);

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

  useEffect(() => {
    const loadAllowedDaysOffset = async () => {
      const offset = await fetchAllowedDaysBeforeReservationOffset();
      setAllowedDaysOffset(offset);
    };

    void loadAllowedDaysOffset();
  }, []);

  const handleCheckAvailability = async () => {
    const nextErrors: AvailabilityErrors = {};
    const nightsNumber = Number(nights);

    if (!startDate) nextErrors.startDate = "يرجى اختيار تاريخ البدء";
    else if (!isReservationStartDateAllowed(startDate, minReservationStartDate)) {
      nextErrors.startDate = formatMinReservationStartMessage(minReservationStartDate);
    }
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
      const inquiryGenders = selectedGenders.filter(
        (g): g is "male" | "female" => g === "male" || g === "female",
      );
      const { cards, fatalError, partialFailure } =
        await fetchMergedAvailabilityCards(
          kinds,
          inquiryStartYmd
            ? {
                startDateYmd: inquiryStartYmd,
                nights: nightsNumber,
                genders: inquiryGenders,
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

    const storedUnits = toReservationStoredUnits(selectedUnits);
    const preserved = buildPreservedInquiryFieldsFromUnits(storedUnits);
    const requestTypeLabel =
      requestTypeOptions.find((o) => o.value === requestType)?.label ??
      requestType;
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
        unitTypes: preserved.unitTypes,
        unitTypeLabels: preserved.unitTypeLabels,
        unitType: preserved.unitTypes[0] ?? "",
        unitTypeLabel: preserved.unitTypeLabel,
        requestType,
        requestTypeLabel,
        genders: preserved.genders,
        genderLabels: preserved.genderLabels,
        allocationType: preserved.allocationType ?? allocationType,
        allocationTypeLabel:
          preserved.allocationTypeLabel ?? allocationTypeLabel,
      },
      selectedUnits: storedUnits,
    });

    toast({
      description:
        "تم حفظ بيانات الاستعلام بنجاح ويرجى تسجيل الدخول لتقديم طلب الحجز",
    });
  };

  const onForgotPasswordSubmit = (values: z.infer<typeof ForgotPasswordSchema>) => {
    startForgotPasswordTransition(() => {
      ForgotPassword(values)
        .then((result) => {
          if ("error" in result && result.error) {
            toast({
              variant: "destructive",
              title: "خطأ",
              description: result.message || "تعذر إعادة تعيين كلمة المرور",
            });
            return;
          }

          const description =
            result.message ||
            "إذا كان الحساب موجوداً، ستصلك كلمة المرور الجديدة على بريدك الإلكتروني.";

          if (description === PASSWORD_RESET_CONTACT_ADMIN_MESSAGE) {
            toast({
              title: "تنبيه",
              description,
            });
          } else {
            toast({
              title: "تم الإرسال",
              description,
            });
          }
          forgotPasswordForm.reset();
          setForgotPasswordOpen(false);
        })
        .catch(() => {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: "تعذر إعادة تعيين كلمة المرور. يُرجى المحاولة لاحقاً.",
          });
        });
    });
  };

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    setIsLoggingIn(true);
    startTransition(() => {
      Login(values)
        .then(async (data) => {
          const login = extractLoginPayload(data as LoginActionResult);
          if (!login?.isLogedIn) {
            setIsLoggingIn(false);
            return;
          }

          if (!login.accessToken) {
            setIsLoggingIn(false);
            toast({
              variant: "destructive",
              title: "خطأ",
              description: "لم يتم استلام رمز الدخول من الخادم",
            });
            return;
          }

          const cookiesReady = await ensureLoginCookiesReady({
            accessToken: login.accessToken,
            refreshToken: login.refreshToken,
            userId: login.userId,
          });

          if (!cookiesReady) {
            setIsLoggingIn(false);
            toast({
              variant: "destructive",
              title: "خطأ",
              description: "فشل في حفظ بيانات الجلسة، يرجى المحاولة مرة أخرى",
            });
            return;
          }

          try {
            const result = await getUserData();
            if (result?.error) {
              setIsLoggingIn(false);
              toast({
                variant: "destructive",
                title: "خطأ",
                description: result.message || "فشل في جلب بيانات المستخدم",
              });
              return;
            }

            const userData = unwrapAuthUserDto(result?.data ?? result);
            if (!userData) {
              setIsLoggingIn(false);
              toast({
                variant: "destructive",
                title: "خطأ",
                description: "تعذر قراءة بيانات المستخدم بعد تسجيل الدخول",
              });
              return;
            }

            const id = userData.id ?? userData.Id;
            const role = userData.role ?? userData.Role;
            const organizationId =
              userData.organizationId ?? userData.OrganizationId;
            const governorateId =
              userData.governorateId ?? userData.GovernorateId;
            const roleCandidates = roleCandidatesFromAuthUser(userData);
            const storedUser = buildStoredUserFromAuthDto(userData);
            const userId = String(id ?? "").trim();

            if (userId) {
              setClientCookie(
                guideCookieName(),
                userId,
                process.env.NEXT_PUBLIC_REFRESH_GUDIE_LIFE ?? "",
              );
              const guideReady = await waitForClientCookieValues([
                { name: guideCookieName(), value: userId },
              ]);
              if (!guideReady) {
                console.warn(
                  "Guide cookie was not readable after set:",
                  guideCookieName(),
                );
              }
            }

            user.setItem(storedUser);
            dispatch(setUserId(userId));
            dispatch(setOrganizationId(String(organizationId ?? "")));
            dispatch(setRole(String(role ?? "")));
            dispatch(setGovernorateId(String(governorateId ?? "")));

            const targetRoute = getFirstAllowedNavRoute(locale, roleCandidates);
            clearStoredNavRoute();
            if (userId) {
              setStoredNavRoute(userId, targetRoute);
            }
            loginRedirectInProgressRef.current = true;
            window.location.replace(targetRoute);
          } catch (err) {
            setIsLoggingIn(false);
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
          setIsLoggingIn(false);
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

  if (isBootstrapping || isRedirecting || isLoggingIn) {
    return (
      <LoginBlockingOverlay
        title={
          isLoggingIn || isRedirecting
            ? "جارٍ تحميل لوحة التحكم..."
            : "جارٍ التحميل..."
        }
      />
    );
  }

  return (
    <motion.div
      className="relative min-h-screen w-full flex flex-col"
      dir="rtl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-muted z-0" aria-hidden />

      {/* ── Main Content ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-5xl flex flex-col gap-6 md:grid md:grid-cols-2">
          {/* ═══════════════════════════════════════════
              Right Panel  —  استعلام عن الوحدات
          ═══════════════════════════════════════════ */}
          <motion.div
            className="order-1"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.4,
              duration: 0.6,
              type: "spring",
              stiffness: 90,
            }}
          >
            <Card className="h-full border-2 border-border rounded-3xl shadow-lg bg-card text-card-foreground">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-brand-muted border border-border">
                    <Search className="h-5 w-5 text-brand" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    استعلام عن الوحدات المتاحة
                  </CardTitle>
                </div>
                <p className="text-muted-foreground text-sm mt-1 pe-1">
                  تحقق من توفر الوحدات السكنية في التاريخ المطلوب
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1.5 text-base">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    تاريخ البدء
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        dir="rtl"
                        className={cn(
                          "w-full justify-between text-right font-normal bg-background border-2 border-border text-foreground hover:bg-muted",
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
                        disabled={(date) => date < minReservationStartDate}
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
                  <Label className="text-foreground flex items-center gap-1.5 text-base">
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
                    className="bg-background border-border text-foreground placeholder:text-sm placeholder:text-muted-foreground focus:border-brand focus:ring-brand/30"
                  />
                  {availabilityErrors.nights ? (
                    <p className="text-xs text-red-600">
                      {availabilityErrors.nights}
                    </p>
                  ) : null}
                </div>

                {/* Unit Type */}
                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1.5 text-base">
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
                            ? "bg-brand border-brand text-brand-foreground shadow-md shadow-brand/25 scale-[1.02]"
                            : "bg-muted border-border text-foreground hover:bg-brand-muted hover:border-brand/40"
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
                  <Label className="text-foreground text-base flex items-center gap-1">
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
                            ? "bg-brand border-brand text-brand-foreground shadow-lg shadow-brand/30 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:bg-brand-muted hover:border-brand/40"
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
                  <Label className="text-foreground text-base flex items-center gap-1">
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
                            ? "bg-brand border-brand text-brand-foreground shadow-lg shadow-brand/30 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:bg-brand-muted hover:border-brand/40"
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
                  <Label className="text-foreground text-base flex items-center gap-1">
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
                            ? "bg-brand border-brand text-brand-foreground shadow-lg shadow-brand/30 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:bg-brand-muted hover:border-brand/40"
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
                  className="w-full py-5 rounded-2xl font-semibold text-base bg-brand text-brand-foreground shadow-lg transition-all duration-300 hover:scale-[1.02] hover:bg-brand-hover hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
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

              </CardContent>
            </Card>
          </motion.div>

          {availabilitySearchStatus === "success" && availabilityCards.length > 0 && (
            <Card className="order-2 md:order-3 md:col-span-2 border-2 border-border rounded-3xl shadow-lg bg-card text-card-foreground">
              <CardHeader className="pb-3">
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 font-semibold text-base bg-emerald-50 border-emerald-200 text-emerald-950"
                >
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                  يوجد {availabilityCards.length.toLocaleString("ar-EG")}{" "}
                  {availabilityCards.length === 1 ? "وحدة متاحة" : "وحدات متاحة"}
                </motion.div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 max-h-[min(520px,65vh)] overflow-y-auto pr-1">
                  {availabilityCards.map((card, cardIdx) => {
                    const cKey = availabilityCardKey(card);
                    const isSelected = selectedAvailabilityKeys.includes(cKey);
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
                          isSelected && "ring-2 ring-offset-1 ring-brand border-brand/50",
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
                            className="h-4 w-4 shrink-0 rounded border-slate-400 text-brand focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
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
                                      dir="rtl"
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <p className="font-bold text-base leading-tight text-slate-900">
                                        {card.title}
                                      </p>
                                      <AvailabilityUnitCardPrice card={card} />
                            </div>
                            <AvailabilityUnitCardParents card={card} />
                            <AvailabilityUnitCardBedsCount card={card} />
                            <AvailabilityUnitCardPhotos card={card} />
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
                                    <span className="text-slate-600">المدينة: </span>
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
                    className="w-full py-4 rounded-2xl font-semibold text-base bg-brand text-brand-foreground shadow-md transition-all duration-300 hover:bg-brand-hover hover:opacity-95"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <Bookmark className="h-4 w-4 shrink-0" />
                      حفظ المحدد والبيانات (
                      {selectedAvailabilityKeys.length.toLocaleString("ar-EG")})
                    </span>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}

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
            className="order-3 md:order-2 md:h-[36rem]"
          >
            <Card className="h-full w-full border-2 border-border rounded-3xl shadow-lg bg-card text-card-foreground flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-brand-muted border border-border">
                    <LogIn className="h-5 w-5 text-brand" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    دخول المستخدمين
                  </CardTitle>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  خاص بإدارة المستخدمين والموظفين المعتمدين
                </p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-center overflow-y-auto">
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
                          <FormLabel className="text-foreground text-base">
                            البريد الإلكتروني
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="example@aswan.gov.eg"
                              type="email"
                              className="bg-background border-border text-foreground placeholder:text-sm placeholder:text-muted-foreground focus:border-brand focus:ring-brand/30"
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
                          <FormLabel className="text-foreground text-base">
                            كلمة المرور
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="••••••••"
                              type="password"
                              className="bg-background border-border text-foreground placeholder:text-sm placeholder:text-muted-foreground focus:border-brand focus:ring-brand/30"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Forgot password link */}
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          const currentEmail = form.getValues("email")?.trim();
                          if (currentEmail) {
                            forgotPasswordForm.setValue("email", currentEmail);
                          }
                          setForgotPasswordOpen(true);
                        }}
                        className="text-base text-brand hover:text-brand-hover hover:underline transition-colors"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>

                    {/* Login button */}
                    <Button
                      disabled={isPending || isLoggingIn}
                      type="submit"
                      className="w-full py-5 rounded-2xl font-semibold text-base bg-brand text-brand-foreground shadow-lg transition-all duration-300 hover:scale-[1.02] hover:bg-brand-hover hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isPending || isLoggingIn ? (
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
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-muted-foreground text-xs shrink-0">أو</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Register button */}
                    <Button
                      asChild
                      variant="outline"
                      className="w-full py-5 rounded-2xl font-semibold text-base border-2 border-border bg-background text-foreground hover:bg-muted hover:border-brand/40 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <Link href={`/${locale}/register`}>
                        <UserPlus className="h-4 w-4" />
                        تسجيل جديد
                      </Link>
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <div className="mb-20 text-transparent">t</div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>نسيت كلمة المرور؟</DialogTitle>
            <DialogDescription>
              أدخل بريدك الإلكتروني وسنرسل كلمة مرور جديدة إلى بريدك المسجل.
            </DialogDescription>
          </DialogHeader>
          <Form {...forgotPasswordForm}>
            <form
              onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}
              className="space-y-4"
            >
              <FormField
                control={forgotPasswordForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        inputMode="email"
                        disabled={isForgotPasswordPending}
                        placeholder="example@aswan.gov.eg"
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  disabled={isForgotPasswordPending}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={isForgotPasswordPending}>
                  {isForgotPasswordPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جارٍ الإرسال...
                    </span>
                  ) : (
                    "إرسال كلمة مرور جديدة"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
