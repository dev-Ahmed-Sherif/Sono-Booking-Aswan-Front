"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Trash } from "lucide-react";
import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { partiesOfficialsSchema } from "@/schemas";
import {
  addPartiesOfficial,
  deletePartiesOfficialById,
  softDeletePartiesOfficialById,
  updatePartiesOfficialById,
} from "@/actions/basic-data/partiesOfficialService";
import EmployeeOrganizationForm from "@/components/basic-data/employee-organization/employee-organization-form";
import EmployeeOrganizationClient from "@/components/basic-data/employee-organization/client";
import type { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";
import { ToastAction } from "@radix-ui/react-toast";

type FormProps = {
  initialData: unknown | null;
  name: string;
  staffData?: EmployeeOrganizationColumn[] | null;
};
type FormValues = z.infer<typeof partiesOfficialsSchema>;

type PartiesOfficialData = {
  id?: string;
  code?: string;
  nameAr?: string;
  isReport?: boolean;
  address?: string;
  phone?: string;
  fax?: string;
  mobile?: string;
  email?: string;
};

type SaveResponse = {
  error?: string;
  message?: string;
  id?: string;
  data?: { id?: string; [key: string]: unknown } | string;
  [key: string]: unknown;
};

const defaultFormValues: FormValues = {
  code: "",
  nameAr: "",
  isReport: false,
  address: "",
  phone: "",
  fax: "",
  mobile: "",
  email: "",
};

const extractIdFromResponse = (res: SaveResponse): string => {
  if (typeof res.id === "string" && res.id) return res.id;
  if (typeof res.data === "string" && res.data) return res.data;
  if (res.data && typeof res.data === "object" && "id" in res.data) {
    const nestedId = (res.data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) return nestedId;
  }
  return "";
};

const PartiesOfficialsForm = ({
  initialData,
  name,
  staffData = null,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [employeePromptOpen, setEmployeePromptOpen] = useState(false);
  const [pendingSavedId, setPendingSavedId] = useState("");
  const [activeTab, setActiveTab] = useState("geha");
  const [addEmployeeKey, setAddEmployeeKey] = useState(0);
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeOrganizationColumn | null>(null);
  const postUpdateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const data = initialData as PartiesOfficialData | null;
  const locale = (params?.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/parties-officials`;
  const clearPostUpdateIdleTimer = () => {
    if (postUpdateIdleTimerRef.current) {
      clearTimeout(postUpdateIdleTimerRef.current);
      postUpdateIdleTimerRef.current = null;
    }
  };
  const startPostUpdateIdleTimer = () => {
    clearPostUpdateIdleTimer();
    postUpdateIdleTimerRef.current = setTimeout(() => {
      router.push(listBackPath);
    }, 30000);
  };
  const isRtl = locale === "ar" || locale.startsWith("ar-");
  const title = data ? `تعديل ${name}` : `حفظ ${name}`;
  const description = data ? "تعديل" : "حفظ جديد";
  const toastMessage = data ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = data ? "تعديل" : "حفظ";

  const user = useLocalStorage("user");

  const form = useForm<FormValues>({
    resolver: zodResolver(partiesOfficialsSchema),
    defaultValues: data
      ? {
          code: data.code ?? "",
          nameAr: data.nameAr ?? "",
          isReport: data.isReport ?? false,
          address: data.address ?? "",
          phone: data.phone ?? "",
          fax: data.fax ?? "",
          mobile: data.mobile ?? "",
          email: data.email ?? "",
        }
      : defaultFormValues,
  });

  const onSubmit = async (values: FormValues) => {
    try {
      toggleLoading();
      let savedId = "";

      if (data?.id) {
        const res = await updatePartiesOfficialById({ ...values, id: data.id });
        if (res?.error) throw new Error(res.message || res.error);
        startPostUpdateIdleTimer();
      } else {
        const res = (await addPartiesOfficial(values)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        savedId = extractIdFromResponse(res);
      }

      toast({ description: `🎉 ${toastMessage}` });
      router.refresh();
      const organizationHasNoEmployees =
        Array.isArray(staffData) && staffData.length === 0;
      const shouldOpenEmployeePrompt = !data?.id || organizationHasNoEmployees;
      if (shouldOpenEmployeePrompt) {
        setPendingSavedId(savedId);
        setEmployeePromptOpen(true);
      } else {
        setPendingSavedId("");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        duration: 3000,
        title: "حدث خطأ !",
        description: (() => {
          const e = err as {
            response?: {
              status?: number | string;
              data?: { status?: number | string; message?: string };
            };
            status?: number | string;
            data?: { status?: number | string; message?: string };
          };
          const statusTexts = [
            e.response?.status,
            e.status,
            e.response?.data?.status,
            e.data?.status,
          ]
            .map((x) => String(x ?? "").toLowerCase())
            .join(" ");
          const backendMessage = String(
            e.response?.data?.message ?? e.data?.message ?? "",
          ).toLowerCase();
          const msg = String(errorMessage).toLowerCase();
          const isConflict =
            statusTexts.includes("409") ||
            statusTexts.includes("conflict") ||
            msg.includes("409") ||
            msg.includes("conflict") ||
            msg.includes("code 409") ||
            msg.includes("duplicated") ||
            backendMessage.includes("duplicated") ||
            backendMessage.includes("conflict");
          return isConflict ? `❌ ${toastMessageError}` : `❌ ${errorMessage}`;
        })(),
        action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
      });
    } finally {
      toggleLoading();
    }
  };

  /** Re-save organization after مسؤولين add/update/delete so the backend stays in sync with current form fields. */
  const syncPartiesOfficialAfterEmployeeChange = async () => {
    if (!data?.id) return;
    try {
      const values = form.getValues();
      const res = (await updatePartiesOfficialById({
        ...values,
        id: data.id,
      })) as SaveResponse;
      if (res?.error) {
        toast({
          variant: "destructive",
          description: String(
            res.message || res.error || "تعذر مزامنة بيانات الجهة",
          ),
        });
        return;
      }
      startPostUpdateIdleTimer();
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    }
  };

  const onDelete = async () => {
    if (!data?.id) return;
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deletePartiesOfficialById
        : softDeletePartiesOfficialById;
      const result = await deleteFn(data.id);
      if (result?.error) {
        toast({
          variant: "destructive",
          title: "خطأ في الحذف",
          description: result.message || "❌ لم يتم الحذف",
          duration: 3000,
        });
        toggleLoading();
        toggleOpen();
        return;
      }
      toast({
        description: superAdmin
          ? "👍👍 تم الحذف بنجاح"
          : "👍👍 تم الحذف (Soft) بنجاح",
        duration: 2000,
      });
      toggleOpen();
      toggleLoading();
      setTimeout(() => {
        router.push(`/${params.locale}/basic-data/parties-officials`);
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err instanceof Error ? err.message : "❌ لم يتم الحذف",
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
    }
  };

  const onSkipEmployees = () => {
    clearPostUpdateIdleTimer();
    setEmployeePromptOpen(false);
    setPendingSavedId("");
    router.push(listBackPath);
  };

  const onCompleteEmployees = () => {
    clearPostUpdateIdleTimer();
    setEmployeePromptOpen(false);

    if (data?.id) return;

    if (pendingSavedId) {
      router.push(`/${locale}/basic-data/parties-officials/${pendingSavedId}`);
      setPendingSavedId("");
      return;
    }

    toast({
      variant: "destructive",
      description: "تم الحفظ ولكن تعذر فتح صفحة استكمال بيانات الموظفين.",
      duration: 3000,
    });
    setPendingSavedId("");
    router.push(listBackPath);
  };

  useEffect(() => {
    return () => {
      clearPostUpdateIdleTimer();
    };
  }, []);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={isRtl ? "text-right" : "text-left"}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(listBackPath)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      <Dialog
        open={employeePromptOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onSkipEmployees();
            return;
          }
          setEmployeePromptOpen(true);
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={onSkipEmployees}
        >
          <DialogHeader>
            <DialogTitle>استكمال بيانات الموظفين</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            هل تريد استكمال بيانات الموظفين الآن؟
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSkipEmployees}>
              لا
            </Button>
            <Button type="button" onClick={onCompleteEmployees}>
              نعم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="my-6 flex items-center justify-between">
        <Heading title={title} description={description} />
        {data?.id && (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => toggleOpen()}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <Tabs
        defaultValue="geha"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "masoolin") clearPostUpdateIdleTimer();
        }}
        className="w-full mt-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="geha">الجهة</TabsTrigger>
          <TabsTrigger value="masoolin" disabled={!data?.id}>
            المسؤلين
          </TabsTrigger>
        </TabsList>
        <TabsContent value="geha" className="space-y-6 mt-4 text-start">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8 w-full"
            >
              <div className="space-y-8">
                <section className="space-y-4 rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <h3 className="text-base font-semibold">البيانات الأساسية</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الكود</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled
                              readOnly
                              type="text"
                              placeholder="الكود"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nameAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الاسم</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الاسم"
                              onKeyDown={(e) => {
                                if (
                                  (e as unknown as { isComposing?: boolean })
                                    .isComposing
                                )
                                  return;

                                const controlKeys = [
                                  "Backspace",
                                  "Delete",
                                  "ArrowLeft",
                                  "ArrowRight",
                                  "ArrowUp",
                                  "ArrowDown",
                                  "Home",
                                  "End",
                                  "Tab",
                                  "Enter",
                                ];
                                if (controlKeys.includes(e.key)) return;

                                if (e.key.length === 1) {
                                  const isAllowed = /^[\u0600-\u06FF\s-]$/.test(
                                    e.key,
                                  );
                                  if (!isAllowed) e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(
                                  /[0-9]|[^ \u0600-\u06FF-]/g,
                                  "",
                                );
                                field.onChange(cleaned);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isReport"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-8">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value ?? false}
                              onChange={(e) => field.onChange(e.target.checked)}
                              disabled={loading}
                              className="h-4 w-4 rounded border-input"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">
                            جهة إستقبال بلاغات
                          </FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="space-y-4 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <h3 className="text-base font-semibold">بيانات التواصل</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الهاتف</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="tel"
                              placeholder="مثال: 2465321"
                              className="text-center"
                              maxLength={11}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onChange={(e) => {
                                const onlyDigits = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 11);
                                field.onChange(onlyDigits);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الفاكس</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="tel"
                              placeholder="مثال: 2465321"
                              className="text-center"
                              maxLength={11}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onChange={(e) => {
                                const onlyDigits = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 11);
                                field.onChange(onlyDigits);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المحمول</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="tel"
                              placeholder="مثال: 01012345678"
                              className="text-center"
                              maxLength={11}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onChange={(e) => {
                                const onlyDigits = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 11);
                                field.onChange(onlyDigits);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>العنوان</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="العنوان"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الإيميل</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="email"
                              placeholder="الإيميل"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>
              </div>
              <div className="flex justify-center">
                <Button
                  disabled={loading}
                  className="text-center h-11 min-w-32 px-6"
                >
                  {loading && <Loader2 className="h-6 w-6" />}
                  {action}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="masoolin" className="space-y-6 mt-4 text-start">
          {data?.id && (
            <>
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <EmployeeOrganizationForm
                  key={addEmployeeKey}
                  initialData={null}
                  name="مسئول الجهة"
                  hideDelegate
                  organizationId={data.id}
                  defaultPhone={form.watch("phone") ?? ""}
                  hideBackButton
                  onSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncPartiesOfficialAfterEmployeeChange();
                    setAddEmployeeKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="mb-8 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h1 className="mb-4 text-2xl font-semibold text-center">
                  قائمة المسؤولين
                </h1>
                <div className="mb-8">
                  <EmployeeOrganizationClient
                    data={staffData ?? null}
                    onEditClick={(row) => {
                      clearPostUpdateIdleTimer();
                      setSelectedEmployee(row);
                      setEditEmployeeModalOpen(true);
                    }}
                    onDeleteSuccess={async () => {
                      clearPostUpdateIdleTimer();
                      await syncPartiesOfficialAfterEmployeeChange();
                    }}
                    showDelegateColumns={false}
                  />
                </div>
              </div>
              <Dialog
                open={editEmployeeModalOpen}
                onOpenChange={setEditEmployeeModalOpen}
              >
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="my-7">
                    <DialogTitle></DialogTitle>
                  </DialogHeader>
                  {selectedEmployee && (
                    <EmployeeOrganizationForm
                      key={selectedEmployee.id}
                      initialData={{
                        id: selectedEmployee.id,
                        name: selectedEmployee.name,
                        job: selectedEmployee.job,
                        nationalId: selectedEmployee.nationalId ?? "",
                        mobile: selectedEmployee.mobile,
                        phone: selectedEmployee.phone ?? "",
                        phoneExtension: selectedEmployee.phoneExtension ?? "",
                        email: selectedEmployee.email,
                        isDelegate: false,
                      }}
                      name="مسئول الجهة"
                      hideDelegate
                      organizationId={data.id}
                      hideBackButton
                      onSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncPartiesOfficialAfterEmployeeChange();
                        setEditEmployeeModalOpen(false);
                        setSelectedEmployee(null);
                      }}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default PartiesOfficialsForm;
