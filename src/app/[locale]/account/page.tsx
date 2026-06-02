"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  useForm,
  useFormContext,
  type FieldErrors,
  type ControllerRenderProps,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  accountPasswordChangeSchema,
  accountSchema,
} from "@/schemas";
import { getUserById, updateUserById } from "@/actions/permissions/userService";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import RegisterCompanionsTab from "@/components/register/register-companions-tab";
import RegistrationProfileFields, {
  profileFieldInputClassName,
} from "@/components/register/registration-profile-fields";
import { cn } from "@/lib/utils";
import {
  mapAccountApiToFormValues,
  toDateOnlyString,
  unwrapAccountUserDto,
} from "@/lib/account-profile-map";
import { documentTypeToApiNumber } from "@/lib/companion-registration";
import { useEffectiveRole } from "@/hooks/use-effective-role";
import {
  isAccountProfileAndCompanionsHidden,
  type RoleCandidates,
} from "@/lib/role-utils";

type AccountPasswordFieldName = "oldPassword" | "newPassword" | "confirmPassword";

/** Shows password errors only when relevant; clears when validation passes. */
function PasswordFormMessage() {
  const { error, isDirty, isTouched } = useFormField();
  const { submitCount } = useFormContext().formState;
  const message = error?.message;

  if (!message) {
    return <div className="min-h-[1.375rem] mt-1" aria-hidden />;
  }

  const show = isDirty || isTouched || submitCount > 0;
  if (!show) {
    return <div className="min-h-[1.375rem] mt-1" aria-hidden />;
  }

  return (
    <div className="min-h-[1.375rem] mt-1" aria-live="polite">
      <p
        role="alert"
        className="text-sm font-semibold leading-snug text-destructive animate-in fade-in-0 duration-200"
      >
        {String(message)}
      </p>
    </div>
  );
}

const Account = () => {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"main" | "companions">("main");
  const [apiRoleCandidates, setApiRoleCandidates] = useState<
    RoleCandidates | undefined
  >(undefined);
  const { effectiveRole } = useEffectiveRole();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [technicalJobCategory, setTechnicalJobCategory] = useState<
    string | null
  >(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { getItem: getUserFromStorage } = useLocalStorage("user");

  type AccountFormValues = z.infer<typeof accountSchema>;

  type AccountProfileSnapshot = {
    id?: string;
    userName: string;
    email: string;
    documentNumber: string;
    documentType: AccountFormValues["documentType"];
    gender: AccountFormValues["gender"];
    birthDate?: Date;
    phone: string;
    documentImageUrl?: string;
  };

  const hideProfileAndCompanions = useMemo(
    () =>
      isAccountProfileAndCompanionsHidden({
        role: effectiveRole || undefined,
        ...apiRoleCandidates,
      }),
    [effectiveRole, apiRoleCandidates],
  );

  const profileSnapshotRef = useRef<AccountProfileSnapshot | null>(null);
  const hideProfileRef = useRef(false);
  hideProfileRef.current = hideProfileAndCompanions;

  const form = useForm<AccountFormValues>({
    mode: "onTouched",
    reValidateMode: "onChange",
    resolver: async (values, context, options) => {
      const schema = hideProfileRef.current
        ? accountPasswordChangeSchema
        : accountSchema;
      return zodResolver(schema)(values, context, options);
    },
    defaultValues: {
      id: undefined,
      userName: "",
      documentType: undefined,
      documentNumber: "",
      gender: undefined,
      birthDate: undefined as unknown as Date,
      phone: "",
      email: "",
      identityAttachment: undefined,
      documentImageUrl: undefined,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const oldPassword = form.watch("oldPassword");
  const isPasswordFieldsDisabled = !oldPassword || oldPassword.trim() === "";

  const revalidatePasswordFields = useCallback(() => {
    const currentOld = form.getValues("oldPassword")?.trim() ?? "";
    if (!currentOld) {
      form.clearErrors(["oldPassword", "newPassword", "confirmPassword"]);
      return;
    }
    void form.trigger(["oldPassword", "newPassword", "confirmPassword"]);
  }, [form]);

  const bindPasswordFieldChange = useCallback(
    (
      field: ControllerRenderProps<AccountFormValues, AccountPasswordFieldName>,
    ) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        field.onChange(event.target.value);
        queueMicrotask(() => revalidatePasswordFields());
      },
    [revalidatePasswordFields],
  );

  useEffect(() => {
    if (!oldPassword?.trim()) {
      form.setValue("newPassword", "", { shouldValidate: false });
      form.setValue("confirmPassword", "", { shouldValidate: false });
      form.clearErrors(["newPassword", "confirmPassword"]);
    }
  }, [oldPassword, form]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        const storedUser = getUserFromStorage() as {
          id?: string;
          role?: string;
        } | null;
        if (storedUser?.role) {
          setApiRoleCandidates((prev) => ({
            ...prev,
            role: storedUser.role,
          }));
        }
        if (!storedUser || !storedUser.id) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description:
              "لم يتم العثور على معرف المستخدم. يرجى تسجيل الدخول مرة أخرى.",
          });
          return;
        }

        const result = await getUserById(storedUser.id);

        if (result?.error) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: result.message || "فشل في جلب بيانات المستخدم",
          });
          return;
        }

        const userData = unwrapAccountUserDto(result);
        if (userData) {
          const mapped = mapAccountApiToFormValues(userData);
          profileSnapshotRef.current = {
            id: mapped.id ?? storedUser.id,
            userName: mapped.userName,
            email: mapped.email,
            documentNumber: mapped.documentNumber,
            documentType: mapped.documentType,
            gender: mapped.gender,
            birthDate: mapped.birthDate,
            phone: mapped.phone,
            documentImageUrl: mapped.documentImageUrl,
          };
          form.reset({
            ...mapped,
            id: mapped.id ?? storedUser.id,
            birthDate: mapped.birthDate ?? (undefined as unknown as Date),
            identityAttachment: undefined,
            oldPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          setUserId(storedUser.id);
          setOrganizationId(
            userData.organizationId ? String(userData.organizationId) : null,
          );
          setRoleId(userData.roleId ? String(userData.roleId) : null);
          setTechnicalJobCategory(
            userData.technicalJobCategory
              ? String(userData.technicalJobCategory)
              : null,
          );
          setApiRoleCandidates({
            role: userData.role ?? userData.Role,
            roleName: userData.roleName ?? userData.RoleName,
            roleEn: userData.roleEn ?? userData.RoleEn,
            roleAr: userData.roleAr ?? userData.RoleAr,
          });
        }
      } catch {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "حدث خطأ أثناء جلب بيانات المستخدم",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const onInvalid = (errors: FieldErrors<AccountFormValues>) => {
    const first = Object.values(errors).find((e) => e?.message);
    toast({
      variant: "destructive",
      title: "تحقق من البيانات",
      description:
        (typeof first?.message === "string" && first.message) ||
        "يرجى تصحيح الحقول المميزة ثم المحاولة مرة أخرى.",
    });
  };

  const onSubmit = (data: AccountFormValues) => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description:
          "لم يتم العثور على معرف المستخدم. يرجى تسجيل الدخول مرة أخرى.",
      });
      return;
    }

    const profileSource = hideProfileAndCompanions
      ? profileSnapshotRef.current
      : data;

    if (hideProfileAndCompanions && !profileSource) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description:
          "تعذر تحميل بيانات الحساب. يرجى تحديث الصفحة والمحاولة مرة أخرى.",
      });
      return;
    }

    const merged = profileSource ?? data;

    startTransition(async () => {
      try {
        const identityFile =
          data.identityAttachment instanceof File
            ? data.identityAttachment
            : undefined;

        const documentImageUrl =
          merged.documentImageUrl?.trim() || data.documentImageUrl?.trim();

        const updatePayload = {
          id: String(merged.id ?? data.id ?? userId),
          userName: String(merged.userName ?? ""),
          email: String(merged.email ?? ""),
          documentNumber: String(merged.documentNumber ?? ""),
          documentType: documentTypeToApiNumber(merged.documentType),
          gender: merged.gender === "female" ? 2 : 1,
          birthDate: toDateOnlyString(merged.birthDate),
          phone: String(merged.phone ?? ""),
          oldPassword: String(data.oldPassword ?? ""),
          newPassword: String(data.newPassword ?? ""),
          confirmPassword: String(data.confirmPassword ?? ""),
          ...(documentImageUrl ? { documentImageUrl } : {}),
          ...(roleId ? { roleId: String(roleId) } : {}),
          ...(organizationId ? { organizationId: String(organizationId) } : {}),
          ...(technicalJobCategory
            ? { technicalJobCategory: String(technicalJobCategory) }
            : {}),
        };

        // `File` cannot be passed to Server Actions (Next RSC serialization).
        // Proxies to backend `PUT .../accounts/updateUserPersonalData` ([FromForm]).
        let result:
          | { success?: boolean; error?: string; message?: string }
          | undefined;

        if (identityFile) {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(updatePayload));
          fd.append("DocumentImage", identityFile);
          const res = await fetch("/api/accounts/update", {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          result = (await res.json()) as typeof result;
          if (!res.ok && !result?.error) {
            result = {
              error: "Failed to update user",
              message: "فشل في تحديث معلومات الحساب",
            };
          }
        } else {
          result = await updateUserById(updatePayload);
        }

        if (result?.error) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: result.message || "فشل في تحديث معلومات الحساب",
          });
          return;
        }

        toast({
          title: "تم التحديث بنجاح!",
          description: "تم حفظ معلومات الحساب بنجاح.",
        });

        form.reset({
          ...data,
          identityAttachment: undefined,
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } catch (err: unknown) {
        console.error("Error updating user:", err);
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "حدث خطأ أثناء تحديث معلومات الحساب";
        toast({
          variant: "destructive",
          title: "خطأ",
          description: message,
        });
      }
    });
  };

  const passwordChangeFields = (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <FormField
        control={form.control}
        name="oldPassword"
        render={({ field, fieldState }) => (
          <FormItem className="md:col-span-2">
            <FormLabel className="font-bold">كلمة المرور الحالية</FormLabel>
            <FormControl>
              <div className="relative w-full">
                <Input
                  {...field}
                  onChange={bindPasswordFieldChange(field)}
                  disabled={isPending}
                  className={cn(
                    profileFieldInputClassName,
                    "pe-10",
                    fieldState.error &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="أدخل كلمة المرور الحالية"
                  type={showCurrentPassword ? "text" : "password"}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 end-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    showCurrentPassword
                      ? "إخفاء كلمة المرور"
                      : "إظهار كلمة المرور"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </FormControl>
            <PasswordFormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="font-bold">كلمة المرور الجديدة</FormLabel>
            <FormControl>
              <div className="relative w-full">
                <Input
                  {...field}
                  onChange={bindPasswordFieldChange(field)}
                  disabled={isPending || isPasswordFieldsDisabled}
                  className={cn(
                    profileFieldInputClassName,
                    "pe-10",
                    fieldState.error &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="أدخل كلمة المرور الجديدة"
                  type={showNewPassword ? "text" : "password"}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isPending || isPasswordFieldsDisabled}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 end-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label={
                    showNewPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </FormControl>
            <PasswordFormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="font-bold">تأكيد كلمة المرور</FormLabel>
            <FormControl>
              <div className="relative w-full">
                <Input
                  {...field}
                  onChange={bindPasswordFieldChange(field)}
                  disabled={isPending || isPasswordFieldsDisabled}
                  className={cn(
                    profileFieldInputClassName,
                    "pe-10",
                    fieldState.error &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="أكد كلمة المرور الجديدة"
                  type={showConfirmPassword ? "text" : "password"}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isPending || isPasswordFieldsDisabled}
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute inset-y-0 end-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label={
                    showConfirmPassword
                      ? "إخفاء كلمة المرور"
                      : "إظهار كلمة المرور"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </FormControl>
            <PasswordFormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const saveButton = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="flex justify-center pt-2"
    >
      <Button
        type="submit"
        form="account-form-main"
        disabled={isPending}
        className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            جاري الحفظ...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            حفظ التغييرات
          </span>
        )}
      </Button>
    </motion.div>
  );

  return (
    <motion.main
      className="container mx-auto px-4 pb-24 min-h-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="pb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h1 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          إدارة الحساب
        </h1>
        <p className="text-muted-foreground text-center text-lg">
          {hideProfileAndCompanions
            ? "قم بتحديث كلمة المرور"
            : "قم بإدارة معلوماتك الشخصية وكلمة المرور والمرافقين"}
        </p>
      </motion.div>

      <motion.div
        className="max-w-4xl mx-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Card className="border-2 mb-16 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="text-center pb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <User className="h-10 w-10 text-white" />
            </motion.div>
            <CardTitle className="text-2xl">بيانات الحساب</CardTitle>
            <CardDescription>
              {hideProfileAndCompanions
                ? "يمكنك تغيير كلمة المرور من هنا"
                : "حدّث بياناتك وكلمة المرور وأضف المرافقين من التبويبات أدناه"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <motion.div
                className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري تحميل البيانات...
              </motion.div>
            ) : (
              <Form {...form}>
                <motion.div className="space-y-6">
                  <form
                    id="account-form-main"
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                    className="space-y-6"
                  >
                    {hideProfileAndCompanions ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="space-y-5"
                      >
                        <h3 className="text-base font-bold">
                          تغيير كلمة المرور
                        </h3>
                        {passwordChangeFields}
                      </motion.div>
                    ) : (
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
                            disabled={!userId}
                          >
                            المرافقين
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="main" className="space-y-6 mt-6">
                          <RegistrationProfileFields
                            form={form}
                            locale={locale}
                            disabled={isPending}
                            nameField="userName"
                            identityRequired={false}
                            documentIdField="documentNumber"
                            phoneField="phone"
                            betweenMainFieldsAndIdentity={
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="md:col-span-2 space-y-5 border-t pt-6"
                              >
                                <h3 className="text-base font-bold">
                                  تغيير كلمة المرور
                                </h3>
                                {passwordChangeFields}
                              </motion.div>
                            }
                          />
                        </TabsContent>

                        <TabsContent
                          value="companions"
                          className="space-y-6 mt-6"
                        >
                          <RegisterCompanionsTab
                            locale={locale}
                            registeredUserId={userId}
                            isActive={activeTab === "companions"}
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  </form>

                  {hideProfileAndCompanions || activeTab === "main"
                    ? saveButton
                    : null}
                </motion.div>
              </Form>
            )}
          </CardContent>
        </Card>
        <div className="mb-44 text-transparent">t</div>
      </motion.div>
    </motion.main>
  );
};

export default Account;
