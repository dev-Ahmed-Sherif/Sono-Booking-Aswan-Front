"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarIcon, Loader2, Trash } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { touristMarinaOrganizations } from "@/schemas";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@radix-ui/react-toast";
import {
  addTouristMarinaOrganization,
  deleteTouristMarinaOrganizationById,
  softDeleteTouristMarinaOrganizationById,
  updateTouristMarinaOrganizationById,
} from "@/actions/basic-data/touristMarinaOrganizationService";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { getOrganizationCategories } from "@/actions/settings/organizationCategoryService";
import { cn } from "@/lib/utils";
import { getTouristMarinaOrganizations } from "@/actions/basic-data/touristMarinaOrganizationService";

type Option = { id: string; nameAr: string };

type FormProps = {
  initialData: unknown | null;
  name: string;
  touristMarinaOptions?: Option[];
  organizationOptions?: Option[];
  touristMarinaId?: string;
  lockOrganizationId?: boolean;
  onSubmitData?: (values: FormValues) => Promise<void> | void;
  onDeleteData?: (id: string) => Promise<void> | void;
  hideBackButton?: boolean;
  onSuccess?: () => void;
};

type FormValues = z.infer<typeof touristMarinaOrganizations>;

function dateOnlyToStringLocal(date: unknown): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TouristMarinaOrganizationForm = ({
  initialData,
  name,
  organizationOptions = [],
  touristMarinaId,
  lockOrganizationId = false,
  onSubmitData,
  onDeleteData,
  hideBackButton = false,
  onSuccess,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const user = useLocalStorage("user");
  const [ownerOptions, setOwnerOptions] =
    useState<Option[]>(organizationOptions);

  const data = initialData as {
    id?: string;
    licenseNumber?: string;
    touristMarinaId?: string;
    organizationId?: string;
    fromDate?: string | Date;
    toDate?: string | Date;
    isActive?: boolean;
  } | null;

  const resolvedId = (() => {
    const raw = (data as unknown as Record<string, unknown> | null)?.id ??
      (data as unknown as Record<string, unknown> | null)?.Id ??
      (data as unknown as Record<string, unknown> | null)
        ?.touristMarinaOrganizationId ??
      (data as unknown as Record<string, unknown> | null)
        ?.TouristMarinaOrganizationId ??
      "";
    if (typeof raw === "string") return raw;
    if (raw === undefined || raw === null) return "";
    return String(raw);
  })();

  const title = resolvedId ? `تعديل ${name}` : `حفظ ${name}`;
  const description = resolvedId ? "تعديل" : "حفظ جديد";
  const action = resolvedId ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data`;
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;
  const toastMessage = resolvedId
    ? "تم التعديل بنجاح"
    : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);

  useEffect(() => {
    if (organizationOptions.length > 0) {
      setOwnerOptions(organizationOptions);
      return;
    }

    const isMarinaCategory = (item: Record<string, unknown>) => {
      const candidates = [
        item.organizationCategoryNameAr,
        item.organizationCategoryNameEn,
        item.categoryNameAr,
        item.categoryNameEn,
        item.organizationCategoryName,
      ]
        .filter((x): x is string => typeof x === "string")
        .join(" ")
        .toLowerCase();

      return (
        candidates.includes("مراسى") ||
        candidates.includes("مراسي") ||
        candidates.includes("marina")
      );
    };

    const normalizeName = (item: Record<string, unknown>) => {
      const ar = item.nameAr;
      if (typeof ar === "string" && ar.trim()) return ar.trim();
      const en = item.nameEn;
      if (typeof en === "string" && en.trim()) return en.trim();
      return "";
    };

    const fetchMarinaOwners = async () => {
      // First try the same category-driven approach used by owning-companies pages.
      const catRes = await getOrganizationCategories();
      const catRaw = ((catRes as { data?: unknown })?.data ??
        catRes) as unknown;
      let marinaCategoryId = "";
      if (Array.isArray(catRaw)) {
        const marinaCategory = catRaw
          .map((x) => x as Record<string, unknown>)
          .find((item) => {
            const nameAr =
              typeof item.nameAr === "string" ? item.nameAr.trim() : "";
            const nameEn =
              typeof item.nameEn === "string" ? item.nameEn.trim() : "";
            const lower = `${nameAr} ${nameEn}`.toLowerCase();
            return (
              nameAr.includes("مراسى") ||
              nameAr.includes("مراسي") ||
              lower.includes("marina")
            );
          });
        marinaCategoryId =
          marinaCategory && typeof marinaCategory.id === "string"
            ? marinaCategory.id
            : "";
      }

      const res = marinaCategoryId
        ? await getOwningCompanies(marinaCategoryId, "OwnerCompany")
        : await getOwningCompanies(undefined, "OwnerCompany");
      if (!res || (res as { error?: string }).error) return;

      const raw = ((res as { data?: unknown }).data ?? res) as unknown;
      if (!Array.isArray(raw)) return;

      // Hide owners that are already linked to this tourist marina.
      const linkedOrganizationIds = new Set<string>();
      if (touristMarinaId) {
        const linkedRes = await getTouristMarinaOrganizations(touristMarinaId);
        if (linkedRes && !(linkedRes as { error?: string }).error) {
          const linkedRaw =
            ((linkedRes as { data?: unknown }).data ?? linkedRes) as unknown;
          if (Array.isArray(linkedRaw)) {
            linkedRaw.forEach((row) => {
              const rec = row as Record<string, unknown>;
              const orgId =
                (typeof rec.organizationId === "string" && rec.organizationId) ||
                (typeof rec.OrganizationId === "string" && rec.OrganizationId) ||
                "";
              if (orgId) linkedOrganizationIds.add(orgId);
            });
          }
        }
      }

      // In edit mode keep current selected organization visible.
      const currentOrganizationId =
        (typeof data?.organizationId === "string" && data.organizationId) || "";
      if (currentOrganizationId) linkedOrganizationIds.delete(currentOrganizationId);

      const mapped = raw
        .map((x) => x as Record<string, unknown>)
        .filter((x) => (marinaCategoryId ? true : isMarinaCategory(x)))
        .filter((x) => {
          const id = typeof x.id === "string" ? x.id : "";
          return !linkedOrganizationIds.has(id);
        })
        .map((x) => {
          const id = typeof x.id === "string" ? x.id : "";
          const nameAr = normalizeName(x);
          return { id, nameAr };
        })
        .filter((x) => x.id && x.nameAr);

      setOwnerOptions(mapped);
    };

    void fetchMarinaOwners();
  }, [organizationOptions, touristMarinaId, data?.organizationId]);

  const form = useForm<FormValues>({
    resolver: zodResolver(touristMarinaOrganizations),
    defaultValues: {
      id: resolvedId,
      licenseNumber: data?.licenseNumber ?? "",
      touristMarinaId: data?.touristMarinaId ?? touristMarinaId ?? "",
      organizationId: data?.organizationId ?? "",
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      isActive: data?.isActive ?? false,
    },
  });

  useEffect(() => {
    if (touristMarinaId) {
      form.setValue("touristMarinaId", touristMarinaId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [form, touristMarinaId]);

  const onSubmit = async (values: FormValues) => {
    try {
      toggleLoading();
      if (onSubmitData) {
        await onSubmitData(values);
      } else {
        const payload = {
          ...values,
          touristMarinaId: touristMarinaId ?? values.touristMarinaId,
          fromDate: dateOnlyToStringLocal(values.fromDate),
          toDate: dateOnlyToStringLocal(values.toDate),
        };
        const res = resolvedId
          ? await updateTouristMarinaOrganizationById({
              ...payload,
              id: resolvedId,
            })
          : await addTouristMarinaOrganization(payload);
        if (res?.error) throw new Error(res.message || res.error);
      }
      toast({ description: `🎉 ${toastMessage}` });
      onSuccess?.();
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        duration: 3000,
        title: "حدث خطأ !",
        description:
          ((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status === 409 || (err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status === 409 || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.message ?? "").toLowerCase().includes("duplicated") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.message ?? "").toLowerCase().includes("duplicated") || String(errorMessage).includes("409") || String(errorMessage).toLowerCase().includes("conflict") || String(errorMessage).toLowerCase().includes("code 409") || String(errorMessage).toLowerCase().includes("duplicated"))
            ? `❌ ${toastMessageError}`
            : `❌ ${errorMessage}`,
        action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
      });
    } finally {
      toggleLoading();
    }
  };

  const onDelete = async () => {
    if (!resolvedId) return;
    try {
      toggleLoading();
      if (onDeleteData) {
        await onDeleteData(resolvedId);
      } else {
        const superAdmin = isSuperAdminRoleCandidates(
          user.getItem() as RoleCandidates,
        );
        const deleteFn = superAdmin
          ? deleteTouristMarinaOrganizationById
          : softDeleteTouristMarinaOrganizationById;
        const result = await deleteFn(resolvedId);
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
      }
      toggleOpen();
      onSuccess?.();
      router.refresh();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err instanceof Error ? err.message : "❌ لم يتم الحذف",
        duration: 3000,
      });
    } finally {
      toggleLoading();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      {!hideBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(listBackPath)}
          className="mb-2 h-10 px-4 gap-2 text-base"
        >
          <ArrowRight className="h-5 w-5" />
          رجوع
        </Button>
      )}
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {resolvedId && (
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
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-full"
        >
          <section className="space-y-4 rounded-lg border border-blue-200/60 bg-blue-50/40 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الترخيص</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        placeholder="رقم الترخيص"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={14}
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
                          if (e.key.length === 1 && !/^\d$/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const onlyDigits = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 14);
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
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الملاك</FormLabel>
                    <Select
                      disabled={loading || lockOrganizationId}
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      dir="rtl"
                    >
                      <FormControl>
                        <SelectTrigger className="text-right [&>span]:w-full [&>span]:text-right">
                          <SelectValue placeholder="اختر الجهة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ownerOptions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fromDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>من تاريخ</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-between text-right font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                            dir="rtl"
                          >
                            <span>
                              {field.value instanceof Date &&
                              !Number.isNaN(field.value.getTime())
                                ? format(field.value, "PPP", { locale: dateFnsLocale })
                                : "اختر التاريخ"}
                            </span>
                            <CalendarIcon className="h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="z-[10002] w-auto p-0 pointer-events-auto"
                        align="end"
                        dir="rtl"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={dateFnsLocale}
                          disabled={(date) =>
                            date > maxSelectableDate ||
                            date < new Date("1900-01-01")
                          }
                          initialFocus
                          captionLayout="dropdown"
                          toYear={currentYear + 5}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>إلى تاريخ</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-between text-right font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                            dir="rtl"
                          >
                            <span>
                              {field.value instanceof Date &&
                              !Number.isNaN(field.value.getTime())
                                ? format(field.value, "PPP", { locale: dateFnsLocale })
                                : "اختر التاريخ"}
                            </span>
                            <CalendarIcon className="h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="z-[10002] w-auto p-0 pointer-events-auto"
                        align="end"
                        dir="rtl"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={dateFnsLocale}
                          disabled={(date) =>
                            date > maxSelectableDate ||
                            date < new Date("1900-01-01")
                          }
                          initialFocus
                          captionLayout="dropdown"
                          toYear={currentYear + 5}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0 pt-8">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(e) => field.onChange(e.target.checked)}
                        disabled={loading}
                        className="h-5 w-5"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">نشط</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <div className="flex justify-center">
            <Button
              disabled={loading}
              className="text-center h-11 min-w-32 px-6"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {action}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default TouristMarinaOrganizationForm;
