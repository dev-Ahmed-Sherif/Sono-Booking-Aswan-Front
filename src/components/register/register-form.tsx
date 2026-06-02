"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Home, Loader2, Eye, EyeOff } from "lucide-react";

import {
  registrationSchema,
  type RegistrationFormValues,
} from "@/schemas";
import { Register } from "@/actions/auth";
import { extractApiResultString } from "@/lib/companion-registration";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RegisterCompanionsTab from "@/components/register/register-companions-tab";
import RegistrationProfileFields, {
  profileFieldInputClassName,
} from "@/components/register/registration-profile-fields";
import { cn } from "@/lib/utils";

const RegisterForm = () => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"main" | "companions">("main");
  const [postRegisterDialogOpen, setPostRegisterDialogOpen] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  const toDateOnlyString = (input: Date | string): string => {
    if (typeof input === "string") {
      const match = input.match(/^\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : input;
    }
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, "0");
    const day = String(input.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const buildRegisterFormData = (values: RegistrationFormValues): FormData => {
    const formData = new FormData();
    formData.append("Username", values.fullName);
    formData.append("NationalId", values.nationalId);
    formData.append(
      "DocumentType",
      values.documentType === "Passport"
        ? "2"
        : values.documentType === "ResidencePermit"
          ? "3"
          : "1",
    );
    formData.append("Gender", values.gender === "female" ? "2" : "1");
    formData.append("BirthDate", toDateOnlyString(values.birthDate));
    formData.append("Phone", values.mobile);
    formData.append("Email", values.email);
    formData.append("Password", values.password);
    if (values.identityAttachment instanceof File) {
      formData.append("Image", values.identityAttachment);
    }
    return formData;
  };

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      documentType: undefined,
      gender: undefined,
      birthDate: undefined,
      mobile: "",
      email: "",
      password: "",
      identityAttachment: undefined,
      companions: [],
    },
  });

  const onSubmit = async (values: RegistrationFormValues) => {
    try {
      setIsSubmitting(true);

      if (!(values.identityAttachment instanceof File)) {
        toast({
          variant: "destructive",
          title: "صورة المستند مطلوبة",
          description: "يرجى رفع صورة البطاقة / شهادة الميلاد",
        });
        return;
      }

      const result = await Register(buildRegisterFormData(values));
      const errorKind = (result as { error?: string } | undefined)?.error;
      if (errorKind) {
        const status = (result as { status?: number } | undefined)?.status;
        const message =
          (result as { message?: string } | undefined)?.message ||
          "حدث خطأ أثناء إكمال التسجيل";
        toast({
          variant: "destructive",
          title:
            status === 409
              ? "بيانات مكررة"
              : status === 400
                ? "بيانات غير صحيحة"
                : "تعذر إكمال التسجيل",
          description: message,
        });
        return;
      }

      const userId = extractApiResultString(result);
      if (userId) setRegisteredUserId(userId);

      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "يمكنك الآن إضافة بيانات المرافقين أو تسجيل الدخول.",
      });
      setPostRegisterDialogOpen(true);
    } catch {
      toast({
        variant: "destructive",
        title: "خطأ غير متوقع",
        description: "حدث خطأ أثناء إرسال البيانات، يرجى المحاولة لاحقاً.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToCompanions = () => {
    setPostRegisterDialogOpen(false);
    setActiveTab("companions");
  };

  const handleSkipToLogin = () => {
    setPostRegisterDialogOpen(false);
    setRegisteredUserId(null);
    form.reset({
      fullName: "",
      nationalId: "",
      documentType: undefined,
      gender: undefined,
      birthDate: undefined,
      mobile: "",
      email: "",
      password: "",
      identityAttachment: undefined,
      companions: [],
    });
    router.push(`/${locale}`);
  };

  return (
    <>
      <motion.header
        className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm"
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

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <Card className="w-full border-[2.5px] border-slate-300 dark:border-slate-600 shadow-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <CardHeader>
          <CardTitle className="text-2xl font-extrabold">تسجيل جديد</CardTitle>
          <CardDescription>
            أدخل البيانات الأساسية ثم أضف بيانات المرافقين من التبويب المخصص.
          </CardDescription>
          </CardHeader>
        </motion.div>
        <CardContent>
          <Form {...form}>
            <motion.div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "main" | "companions")
              }
              dir="rtl"
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="main" className="font-bold">
                  البيانات الأساسية
                </TabsTrigger>
                <TabsTrigger
                  value="companions"
                  className="font-bold"
                  disabled={!registeredUserId}
                >
                  المرافقين
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6">
                <form
                  id="register-form-main"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.45 }}
                  className="space-y-6"
                >
                  <RegistrationProfileFields
                    form={form}
                    locale={locale}
                    disabled={isSubmitting}
                    nameField="fullName"
                    identityRequired
                    betweenMainFieldsAndIdentity={
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">
                              كلمة المرور
                            </FormLabel>
                            <FormControl>
                              <motion.div className="relative w-full">
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  className={cn(
                                    profileFieldInputClassName,
                                    "pe-10",
                                  )}
                                  placeholder="••••••••"
                                />
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() =>
                                    setShowPassword((prev) => !prev)
                                  }
                                  className="absolute inset-y-0 end-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label={
                                    showPassword
                                      ? "إخفاء كلمة المرور"
                                      : "إظهار كلمة المرور"
                                  }
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </motion.div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    }
                  />
                </motion.div>
                </form>
              </TabsContent>

              <TabsContent value="companions" className="space-y-6">
                <RegisterCompanionsTab
                  locale={locale}
                  registeredUserId={registeredUserId}
                  isActive={activeTab === "companions"}
                />
              </TabsContent>

            </Tabs>
            </motion.div>

            <motion.div
              className="flex justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.45 }}
            >
              <Button
                type="button"
                variant="outline"
                className="ml-3 w-auto"
                onClick={() => router.push(`/${locale}`)}
              >
                رجوع لتسجيل الدخول
              </Button>
              {activeTab === "main" ? (
                <Button
                  type="submit"
                  form="register-form-main"
                  className="ml-4 w-auto bg-[#00005c] hover:bg-[#00004a] text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    "إرسال التسجيل"
                  )}
                </Button>
              ) : null}
            </motion.div>
            </motion.div>
          </Form>
        </CardContent>
      </Card>
      </motion.div>

      <Dialog
        open={postRegisterDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleSkipToLogin();
          else setPostRegisterDialogOpen(true);
        }}
      >
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">
              تم إنشاء الحساب بنجاح
            </DialogTitle>
            <DialogDescription className="text-right">
              هل ترغب في إضافة بيانات المرافقين الآن؟ يمكنك المتابعة إلى تبويب
              المرافقين أو الانتقال مباشرةً إلى صفحة تسجيل الدخول.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row-reverse justify-start gap-2 sm:justify-start">
            <Button
              type="button"
              className="bg-[#00005c] hover:bg-[#00004a] text-white"
              onClick={handleContinueToCompanions}
            >
              نعم، إضافة مرافقين
            </Button>
            <Button type="button" variant="outline" onClick={handleSkipToLogin}>
              لا، الذهاب لتسجيل الدخول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegisterForm;
