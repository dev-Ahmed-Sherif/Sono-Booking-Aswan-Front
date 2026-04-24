"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { floatingUnitOrganization } from "@/schemas";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@radix-ui/react-toast";
import {
  addFloatingUnitOrganization,
  deleteFloatingUnitOrganizationById,
  getFloatingUnitOrganizations,
  softDeleteFloatingUnitOrganizationById,
  updateFloatingUnitOrganizationById,
} from "@/actions/basic-data/floatingUnitOrganizationService";
import { getOperatingCompanies } from "@/actions/basic-data/operatingCompanyService";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { resolveFloatingUnitOwnerOrganizationCategoryId } from "@/lib/floating-unit-owner-organization-category";
import {
  getFloatingUnitById,
  getFloatingUnits,
} from "@/actions/basic-data/floatingUnitService";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type Option = { id: string; nameAr: string };

/** Stable defaults so `useEffect` deps are not a new `[]` every render. */
const EMPTY_ORG_OPTIONS: Option[] = [];

type FormProps = {
  initialData: unknown | null;
  name: string;
  /** Which organization list to load when `organizationOptions` is not passed. */
  organizationSource?: "owner" | "operating";
  organizationOptions?: Option[];
  floatingUnitOptions?: Option[];
  floatingUnitId?: string;
  lockFloatingUnitId?: boolean;
  onSubmitData?: (values: FormValues) => Promise<void> | void;
  onDeleteData?: (id: string) => Promise<void> | void;
  hideBackButton?: boolean;
  onSuccess?: () => void;
};

type FormValues = z.infer<typeof floatingUnitOrganization>;

function isDuplicateOrConflictMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("409") ||
    m.includes("conflict") ||
    m.includes("duplicated") ||
    m.includes("duplicate") ||
    m.includes("موجود")
  );
}

const FloatingUnitOrganizationForm = ({
  initialData,
  name,
  organizationSource = "owner",
  organizationOptions = EMPTY_ORG_OPTIONS,
  floatingUnitOptions = EMPTY_ORG_OPTIONS,
  floatingUnitId,
  lockFloatingUnitId = false,
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
  const [orgOptions, setOrgOptions] = useState<Option[]>(organizationOptions);
  const [fetchedFloatingOptions, setFetchedFloatingOptions] = useState<
    Option[]
  >([]);
  const [lockedFloatingOption, setLockedFloatingOption] = useState<Option[]>(
    [],
  );

  const data = initialData as {
    id?: string;
    organizationId?: string;
    floatingUnitId?: string;
  } | null;

  const resolvedId = (() => {
    const raw =
      (data as unknown as Record<string, unknown> | null)?.id ??
      (data as unknown as Record<string, unknown> | null)?.Id ??
      "";
    if (typeof raw === "string") return raw;
    if (raw === undefined || raw === null) return "";
    return String(raw);
  })();

  const title = resolvedId ? `تعديل ${name}` : `حفظ ${name}`;
  const description = resolvedId ? "تعديل" : "حفظ جديد";
  const action = resolvedId ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/floating-unit-organization`;
  const toastMessage = resolvedId ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا الربط موجود من قبل";

  useEffect(() => {
    if (organizationOptions.length > 0) {
      setOrgOptions(organizationOptions);
      return;
    }

    const loadOrgs = async () => {
      const currentFloating =
        (typeof data?.floatingUnitId === "string" && data.floatingUnitId.trim()) ||
        (typeof floatingUnitId === "string" && floatingUnitId.trim()) ||
        "";

      const companiesResPromise =
        organizationSource === "operating"
          ? getOperatingCompanies("OperatingCompany")
          : (async () => {
              const floatingUnitCategoryId =
                await resolveFloatingUnitOwnerOrganizationCategoryId();
              return floatingUnitCategoryId
                ? getOwningCompanies(floatingUnitCategoryId, "OwnerCompany")
                : getOwningCompanies(undefined, "OwnerCompany");
            })();

      const [companiesRes, linksRes] = await Promise.all([
        companiesResPromise,
        getFloatingUnitOrganizations(
          currentFloating ? currentFloating : undefined,
        ),
      ]);
      if (!companiesRes || (companiesRes as { error?: string }).error) return;
      const companiesRaw = ((companiesRes as { data?: unknown }).data ??
        companiesRes) as unknown;
      if (!Array.isArray(companiesRaw)) return;

      const linked = new Set<string>();
      const currentOrg =
        (typeof data?.organizationId === "string" && data.organizationId) || "";

      if (linksRes && !(linksRes as { error?: string }).error) {
        const linkList = ((linksRes as { data?: unknown }).data ??
          linksRes) as unknown;
        if (Array.isArray(linkList)) {
          linkList.forEach((row) => {
            const rec = row as Record<string, unknown>;
            const fu =
              (typeof rec.floatingUnitId === "string" && rec.floatingUnitId) ||
              (typeof rec.FloatingUnitId === "string" && rec.FloatingUnitId) ||
              "";
            const org =
              (typeof rec.organizationId === "string" && rec.organizationId) ||
              (typeof rec.OrganizationId === "string" && rec.OrganizationId) ||
              "";
            if (!currentFloating) return;
            if (currentFloating && fu !== currentFloating) return;
            if (org && org !== currentOrg) linked.add(org);
          });
        }
      }

      const merged = companiesRaw
        .map((x) => x as Record<string, unknown>)
        .map((x) => {
          const id = typeof x.id === "string" ? x.id : "";
          const nameAr =
            (typeof x.nameAr === "string" && x.nameAr.trim()) ||
            (typeof x.nameEn === "string" && x.nameEn.trim()) ||
            "";
          return { id, nameAr };
        })
        .filter((x) => x.id && x.nameAr)
        .filter((o) => !linked.has(o.id) || o.id === currentOrg);

      if (merged.length > 0) setOrgOptions(merged);
    };

    void loadOrgs();
  }, [
    organizationOptions,
    organizationSource,
    data?.floatingUnitId,
    data?.organizationId,
    floatingUnitId,
  ]);

  const formDefaultValues = useMemo(
    (): FormValues => ({
      id: resolvedId,
      organizationId: data?.organizationId ?? "",
      floatingUnitId: data?.floatingUnitId ?? floatingUnitId ?? "",
    }),
    [resolvedId, data?.organizationId, data?.floatingUnitId, floatingUnitId],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(floatingUnitOrganization),
    defaultValues: formDefaultValues,
  });

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (floatingUnitId && lockFloatingUnitId) {
      formRef.current.setValue("floatingUnitId", floatingUnitId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [floatingUnitId, lockFloatingUnitId]);

  const floatingSelectOptions = useMemo(() => {
    if (floatingUnitOptions.length > 0) return floatingUnitOptions;
    if (lockFloatingUnitId && lockedFloatingOption.length > 0)
      return lockedFloatingOption;
    return fetchedFloatingOptions;
  }, [
    floatingUnitOptions,
    lockFloatingUnitId,
    lockedFloatingOption,
    fetchedFloatingOptions,
  ]);

  useEffect(() => {
    if (floatingUnitOptions.length > 0) {
      setFetchedFloatingOptions([]);
      return;
    }
    if (lockFloatingUnitId) {
      setFetchedFloatingOptions([]);
      return;
    }
    const loadUnits = async () => {
      const res = await getFloatingUnits();
      if (!res || (res as { error?: string }).error) return;
      const raw = ((res as { data?: unknown }).data ?? res) as unknown;
      if (!Array.isArray(raw)) return;
      const mapped = raw
        .map((x) => x as Record<string, unknown>)
        .map((x) => {
          const id = typeof x.id === "string" ? x.id : "";
          const nameAr =
            (typeof x.nameAr === "string" && x.nameAr.trim()) ||
            (typeof x.nameEn === "string" && x.nameEn.trim()) ||
            "";
          return { id, nameAr };
        })
        .filter((x) => x.id && x.nameAr);
      if (mapped.length > 0) setFetchedFloatingOptions(mapped);
    };
    void loadUnits();
  }, [floatingUnitOptions.length, lockFloatingUnitId]);

  useEffect(() => {
    if (!lockFloatingUnitId || !floatingUnitId) {
      setLockedFloatingOption([]);
      return;
    }
    if (floatingUnitOptions.some((o) => o.id === floatingUnitId)) {
      setLockedFloatingOption([]);
      return;
    }
    const loadOne = async () => {
      const res = await getFloatingUnitById(floatingUnitId);
      if (!res || (res as { error?: string }).error) {
        setLockedFloatingOption([
          { id: floatingUnitId, nameAr: "الوحدة العائمة" },
        ]);
        return;
      }
      const row = ((res as { data?: unknown }).data ?? res) as Record<
        string,
        unknown
      >;
      const nameAr =
        (typeof row.nameAr === "string" && row.nameAr.trim()) ||
        (typeof row.nameEn === "string" && row.nameEn.trim()) ||
        "الوحدة العائمة";
      setLockedFloatingOption([{ id: floatingUnitId, nameAr }]);
    };
    void loadOne();
  }, [lockFloatingUnitId, floatingUnitId, floatingUnitOptions]);

  const onSubmit = async (values: FormValues) => {
    try {
      toggleLoading();
      if (onSubmitData) {
        await onSubmitData(values);
      } else {
        const payload = {
          organizationId: values.organizationId,
          floatingUnitId: lockFloatingUnitId
            ? (floatingUnitId ?? values.floatingUnitId)
            : values.floatingUnitId,
          ...(resolvedId ? { id: resolvedId } : {}),
        };
        const res = resolvedId
          ? await updateFloatingUnitOrganizationById(payload)
          : await addFloatingUnitOrganization(payload);
        if (res?.error) {
          const msg = String(res.message || res.error || "");
          throw new Error(msg);
        }
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
        description: isDuplicateOrConflictMessage(errorMessage)
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
          ? deleteFloatingUnitOrganizationById
          : softDeleteFloatingUnitOrganizationById;
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
        {resolvedId ? (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => toggleOpen()}
          >
            <Trash className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-full"
        >
          <section className="space-y-4 rounded-lg border border-blue-200/60 bg-blue-50/40 p-4">
            <div
              className={
                lockFloatingUnitId
                  ? "grid grid-cols-1 gap-6"
                  : "grid grid-cols-1 md:grid-cols-2 gap-6"
              }
            >
              {!lockFloatingUnitId ? (
                <FormField
                  control={form.control}
                  name="floatingUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوحدة العائمة</FormLabel>
                      <Select
                        disabled={
                          loading || floatingSelectOptions.length === 0
                        }
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                        dir="rtl"
                      >
                        <FormControl>
                          <SelectTrigger className="text-right [&>span]:w-full [&>span]:text-right">
                            <SelectValue placeholder="اختر الوحدة العائمة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {floatingSelectOptions.map((item) => (
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
              ) : null}

              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الجهة</FormLabel>
                    <Select
                      disabled={loading || orgOptions.length === 0}
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
                        {orgOptions.map((item) => (
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
            </div>
          </section>

          <Button disabled={loading} className="w-full sm:w-auto" type="submit">
            {loading ? (
              <>
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              action
            )}
          </Button>
        </form>
      </Form>
    </>
  );
};

export default FloatingUnitOrganizationForm;
