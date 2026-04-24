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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { getUserData, Login } from "@/actions/auth";
import {
  setGovernorateId,
  setOrganizationId,
  setRole,
  setUserId,
} from "@/redux/userReducer";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { LoginSchema } from "@/schemas";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LoginFormProps = {
  Cookie: any | null;
};

type AvailabilityResult = "available" | "unavailable" | null;

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

  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // Availability check state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [nights, setNights] = useState("");
  const [unitType, setUnitType] = useState("");
  const [gender, setGender] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult>(null);

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

      const referrer = document.referrer || "";
      let redirectPath = `/${locale}/dashboard`;
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
  }, [Cookie, locale, router]);

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
    setAvailability(null);
  }, [startDate, nights, unitType, gender]);



  const handleCheckAvailability = () => {
    if (!startDate || !nights || !unitType || !gender) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى تعبئة جميع الحقول للتحقق من التوفر",
      });
      return;
    }
    setIsChecking(true);
    setAvailability(null);
    // Placeholder: replace with real API call
    setTimeout(() => {
      setAvailability(Math.random() > 0.4 ? "available" : "unavailable");
      setIsChecking(false);
    }, 1200);
  };

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    // startTransition(() => {
    //   Login(values)
    //     .then((data) => {
    //       const { isLogedIn, refreshToken } = data.data;
    //       if (!isLogedIn) return;
    //       getUserData()
    //         .then((result) => {
    //           if (result.error) {
    //             toast({
    //               variant: "destructive",
    //               title: "خطأ",
    //               description: result.message || "فشل في جلب بيانات المستخدم",
    //             });
    //             return;
    //           }
    //           if (result.data?.data) {
    //             const { id, role, name, organizationId, governorateId } =
    //               result.data.data;
    //             user.setItem({
    //               id,
    //               role,
    //               name,
    //               organizationId: organizationId ?? "",
    //               governorateId: governorateId ?? "",
    //             });
    //             dispatch(setUserId(id));
    //             dispatch(setOrganizationId(organizationId));
    //             dispatch(setRole(role));
    //             dispatch(setGovernorateId(governorateId ?? ""));
    //             if (refreshToken && typeof refreshToken === "string") {
    //               const cookieName =
    //                 (
    //                   process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE ?? ""
    //                 ).trim() || "Ref_Tok_Housing_Aswan";
    //               const cookieLife =
    //                 process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE_LIFE ?? "";
    //               setTimeout(() => {
    //                 setClientCookie(cookieName, refreshToken, cookieLife);
    //               }, 0);
    //             }
    //             if (id) {
    //               const guideCookieName =
    //                 (
    //                   process.env.NEXT_PUBLIC_REFRESH_GUDIE_COOKIE ?? ""
    //                 ).trim() || "Ref_Guid_Housing_Aswan";
    //               const guideCookieLife =
    //                 process.env.NEXT_PUBLIC_REFRESH_GUDIE_LIFE ?? "";
    //               setTimeout(() => {
    //                 setClientCookie(
    //                   guideCookieName,
    //                   String(id),
    //                   guideCookieLife,
    //                 );
    //               }, 0);
    //             }
    //             nav.setItem(`/${locale}/dashboard`);
    //             setTimeout(() => {
    //               router.push(`/${locale}/dashboard`);
    //               setTimeout(() => window.location.reload(), 700);
    //             }, 35);
    //           }
    //         })
    //         .catch((err) => {
    //           console.error("Error getting user data:", err);
    //           toast({
    //             variant: "destructive",
    //             title: "حدث خطأ !",
    //             description: "يرجى تسجيل الدخول مرة أخرى",
    //           });
    //           setTimeout(() => router.push(`/${locale}`), 42);
    //         });
    //     })
    //     .catch((err) => {
    //       if (err.message?.includes("401") || err.message?.includes("404")) {
    //         toast({
    //           variant: "destructive",
    //           title: "حدث خطأ !",
    //           description: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    //           action: (
    //             <ToastAction altText="Try again">حاول مرة أخرى</ToastAction>
    //           ),
    //         });
    //       } else {
    //         toast({
    //           variant: "destructive",
    //           title: "حدث خطأ !",
    //           description: "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً",
    //           action: (
    //             <ToastAction altText="Try again">حاول مرة أخرى</ToastAction>
    //           ),
    //         });
    //       }
    //     });
    // });
    router.push(`/${locale}/reservation`);
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
                  <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    تاريخ البدء
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        dir="rtl"
                        className={cn(
                          "w-full justify-between text-right font-normal bg-white border-gray-300 text-gray-800 hover:bg-gray-50",
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
                    <PopoverContent className="z-50 w-auto p-0" align="start" dir="rtl">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        locale={ar}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        captionLayout="dropdown"
                        toYear={new Date().getFullYear() + 2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Number of nights */}
                <div className="space-y-1.5">
                  <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                    <Moon className="h-4 w-4 text-blue-500" />
                    عدد الليالي
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    placeholder="أدخل عدد الليالي"
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                    className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/30"
                  />
                </div>

                {/* Unit Type */}
                <div className="space-y-1.5">
                  <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    نوع الوحدة
                  </Label>
                  <Select value={unitType} onValueChange={setUnitType} dir="rtl">
                    <SelectTrigger className="bg-white border-gray-300 text-gray-800 focus:ring-blue-400/30 focus:border-blue-400 text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر نوع الوحدة" />
                    </SelectTrigger>
                    <SelectContent className="z-50" dir="rtl">
                      <SelectItem value="bed">سرير</SelectItem>
                      <SelectItem value="room">غرفة</SelectItem>
                      <SelectItem value="apartment">شقة كاملة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender — required */}
                <div className="space-y-1.5">
                  <Label className="text-gray-700 text-sm flex items-center gap-1">
                    الجنس
                    <span className="text-red-500 text-xs">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "male", label: "رجال" },
                      { value: "female", label: "سيدات" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGender(opt.value)}
                        className={`py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                          gender === opt.value
                            ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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

                {/* Result message */}
                {availability && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 font-semibold text-base ${
                      availability === "available"
                        ? "bg-green-500/20 border-green-400/50 text-green-300"
                        : "bg-red-500/20 border-red-400/50 text-red-300"
                    }`}
                  >
                    {availability === "available" ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-400" />
                        يوجد أماكن متاحة في التاريخ المطلوب
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 shrink-0 text-red-400" />
                        لا يوجد أماكن متاحة في هذا التاريخ
                      </>
                    )}
                  </motion.div>
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
          >
            <Card className="h-full border-2 border-green-200 rounded-3xl shadow-lg bg-white text-gray-800">
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

              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    {/* Email */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 text-sm">
                            البريد الإلكتروني
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="example@aswan.gov.eg"
                              type="email"
                              className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400/30"
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
                          <FormLabel className="text-gray-700 text-sm">
                            كلمة المرور
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="••••••••"
                              type="password"
                              className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400/30"
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

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-3 text-gray-400 text-xs bg-white border-t border-gray-200">
        جميع الحقوق محفوظة © {new Date().getFullYear()} — محافظة أسوان
      </footer>
    </motion.div>
  );
}
