"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { getGovernorates } from "@/actions/basic-data/governorateService";
import {
  addCity,
  deleteCityById,
  softDeleteCityById,
  updateCityById,
} from "@/actions/basic-data/cityService";
import { cityFormSchema, type CityFormValues } from "@/schemas";
import { ToastAction } from "@radix-ui/react-toast";

type GovernorateOption = { id: string; nameAr: string };

type CityFormProps = {
  initialData: unknown | null;
  name: string;
  /** When set (e.g. nested context or `?governorateId=` on new), المحافظة is fixed and not user-selectable. */
  governorateId?: string;
  /** When nested (e.g. governorate tabs), hide رجوع and skip navigating to city list after save/delete. */
  hideBackButton?: boolean;
  /** Called after successful save or delete; use with `hideBackButton` for embedded flows. */
  onSuccess?: () => void | Promise<void>;
};

function parseInitialCity(data: unknown): {
  id: string;
  governorateId: string;
  code: string;
  nameAr: string;
  nameEn: string;
} | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = String(o.id ?? o.Id ?? "");
  if (!id || id === "new") return null;
  return {
    id,
    governorateId: String(
      o.governorateId ??
        o.GovernorateId ??
        o.GovernateId ??
        o.governateId ??
        "",
    ),
    code: String(o.code ?? o.Code ?? ""),
    nameAr: String(o.nameAr ?? o.NameAr ?? ""),
    nameEn:
      o.nameEn != null
        ? String(o.nameEn)
        : o.NameEn != null
          ? String(o.NameEn)
          : "",
  };
}

const CityForm = ({
  initialData,
  name,
  governorateId: governorateIdProp,
  hideBackButton = false,
  onSuccess,
}: CityFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const user = useLocalStorage("user");
  const [governorates, setGovernorates] = useState<GovernorateOption[]>([]);
  /** Used only when creating and `governorateId` prop is not provided. */
  const [selectedGovernorateId, setSelectedGovernorateId] = useState("");

  const parsed = useMemo(() => parseInitialCity(initialData), [initialData]);
  const isEdit = Boolean(parsed);

  const propGovernorateId = governorateIdProp?.trim() ?? "";
  const isGovernorateLockedFromProp = propGovernorateId.length > 0;
  const effectiveGovernorateId = isEdit
    ? (parsed?.governorateId ?? propGovernorateId)
    : isGovernorateLockedFromProp
      ? propGovernorateId
      : selectedGovernorateId;

  const title = isEdit ? `تعديل ${name}` : `حفظ ${name}`;
  const description = isEdit ? "تعديل" : "حفظ جديد";
  const toastMessage = isEdit ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = isEdit ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/city`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getGovernorates();
      if (cancelled) return;
      if (res && typeof res === "object" && "error" in res && res.error) {
        return;
      }
      const raw =
        res && typeof res === "object" && "data" in res
          ? (res as { data: unknown }).data
          : res;
      const list = Array.isArray(raw) ? raw : [];
      const opts: GovernorateOption[] = list
        .filter(
          (x): x is Record<string, unknown> =>
            x != null && typeof x === "object",
        )
        .map((x) => ({
          id: String(x.id ?? x.Id ?? ""),
          nameAr: String(x.nameAr ?? x.NameAr ?? x.id ?? ""),
        }))
        .filter((g) => g.id);
      setGovernorates(opts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<CityFormValues>({
    resolver: zodResolver(cityFormSchema),
    defaultValues: {
      code: parsed?.code ?? "",
      nameAr: parsed?.nameAr ?? "",
      nameEn: parsed?.nameEn ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      code: parsed?.code ?? "",
      nameAr: parsed?.nameAr ?? "",
      nameEn: parsed?.nameEn ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form.reset when loaded city row changes
  }, [parsed?.id, parsed?.code, parsed?.nameAr, parsed?.nameEn]);

  const onSubmit = async (data: CityFormValues) => {
    if (!isEdit && !effectiveGovernorateId.trim()) {
      toast({
        variant: "destructive",
        description: "يجب اختيار المحافظة",
        duration: 3000,
      });
      return;
    }
    try {
      toggleLoading();
      if (isEdit && parsed) {
        const code = data.code.trim() || "1";
        const res = await updateCityById({
          id: parsed.id,
          code,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          governorateId: effectiveGovernorateId || undefined,
        });
        if (res?.error) throw new Error(res.message || res.error);
      } else {
        const res = await addCity({
          code: data.code.trim() || undefined,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          governorateId: effectiveGovernorateId,
        });
        if (res?.error) throw new Error(res.message || res.error);
      }
      router.refresh();
      toast({ description: `🎉 ${toastMessage}` });
      if (onSuccess) {
        await onSuccess();
        if (!isEdit) {
          form.reset({ code: "", nameAr: "", nameEn: "" });
        }
      } else {
        setTimeout(() => router.push(listBackPath), 1000);
      }
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
    if (!parsed) return;
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin ? deleteCityById : softDeleteCityById;
      const result = await deleteFn(parsed.id);
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
      if (onSuccess) {
        await onSuccess();
        router.refresh();
      } else {
        setTimeout(() => {
          router.push(listBackPath);
          setTimeout(() => {
            router.refresh();
            setTimeout(() => window.location.reload(), 500);
          }, 500);
        }, 1000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "❌ لم يتم الحذف";
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: message,
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
    }
  };

  const isRtl = locale === "ar" || locale === "ar-EG";

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      {!hideBackButton ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(listBackPath)}
          className="mb-2 h-10 px-4 gap-2 text-base"
        >
          <ArrowRight className="h-5 w-5" />
          رجوع
        </Button>
      ) : null}
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {isEdit && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الكود</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      readOnly
                      disabled={loading}
                      className="bg-muted/60"
                      type="text"
                      placeholder="يُحدد تلقائياً عند الحفظ"
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
                  <FormLabel>الاسم بالعربية</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="text"
                      placeholder="الاسم بالعربية"
                      onKeyDown={(e) => {
                        if (/[0-9]/.test(e.key)) e.preventDefault();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم بالإنجليزية</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="text"
                      placeholder="الاسم بالإنجليزية"
                      onKeyDown={(e) => {
                        if (/[0-9]/.test(e.key)) e.preventDefault();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
    </>
  );
};

export default CityForm;
