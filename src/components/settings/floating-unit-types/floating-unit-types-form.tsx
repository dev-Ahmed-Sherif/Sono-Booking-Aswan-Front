"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Trash } from "lucide-react";

import { getUnitCategories } from "@/actions/settings/unitCategoryService";

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
import { Input } from "@/components/ui/input";

import AlertModal from "@/components/modals/alert-modal";

import { useToast } from "@/hooks/use-toast";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

import { floatingUnitTypeSchema } from "@/schemas";
import {
  addFloatingUnitType,
  deleteFloatingUnitTypeById,
  softDeleteFloatingUnitTypeById,
  updateFloatingUnitTypeById,
} from "@/actions/settings/floatingUnitTypeService";

import { ToastAction } from "@radix-ui/react-toast";

type FloatingUnitTypesFormProps = {
  initialData: any | null;
  name: string;
};

type FloatingUnitTypesFormValues = z.infer<typeof floatingUnitTypeSchema>;

const FloatingUnitTypesForm = ({
  initialData,
  name,
}: FloatingUnitTypesFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [unitCategories, setUnitCategories] = useState<
    { id: string; nameAr?: string; nameEn?: string }[]
  >([]);

  const user = useLocalStorage("user");

  const locale = (params.locale as string) ?? "ar";
  const isRtl = locale === "ar" || locale.startsWith("ar-");
  console.log("initialData :", initialData);
  const title = initialData ? `تعديل ${name}` : `حفظ ${name}`;
  const description = initialData ? "تعديل" : "حفظ جديد";
  const toastMessage = initialData ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = initialData ? "تعديل" : "حفظ";
  const listBackPath = `/${locale}/settings/floating-unit-types`;

  const initialUnitCategoryId =
    initialData?.unitCategoryId ??
    (initialData?.unitCategory &&
    typeof initialData.unitCategory === "object" &&
    "id" in initialData.unitCategory
      ? (initialData.unitCategory as { id: string }).id
      : typeof initialData?.unitCategory === "string"
        ? initialData.unitCategory
        : "");

  const form = useForm<FloatingUnitTypesFormValues>({
    resolver: zodResolver(floatingUnitTypeSchema),
    defaultValues: {
      nameAr: initialData?.nameAr || "",
      nameEn: initialData?.nameEn || "",
      unitCategory: initialUnitCategoryId,
    },
  });

  useEffect(() => {
    const fetchUnitCategories = async () => {
      const result = await getUnitCategories();
      if (result?.error) {
        setUnitCategories([]);
        return;
      }
      const list = (result as { data?: unknown[] })?.data ?? result;
      setUnitCategories(Array.isArray(list) ? list : []);
    };
    fetchUnitCategories();
  }, []);

  const onSubmit = async (data: FloatingUnitTypesFormValues) => {
    try {
      toggleLoading();

      if (initialData) {
        const res = await updateFloatingUnitTypeById({
          id: initialData.id,
          code: initialData.code as string,
          nameAr: data.nameAr,
          nameEn: data.nameEn as string,
          unitCategory: data.unitCategory,
        });

        if (res?.error) {
          throw new Error(res.message || res.error);
        }
      } else {
        const res = await addFloatingUnitType({
          code: "",
          nameAr: data.nameAr,
          nameEn: data.nameEn as string,
          unitCategory: data.unitCategory,
        });

        if (res?.error) {
          throw new Error(res.message || res.error);
        }
      }

      router.refresh();
      setTimeout(() => {
        router.push(`/${params.locale}/settings/floating-unit-types`);
      }, 1000);

      toast({
        description: `🎉 ${toastMessage}`,
      });
    } catch (err: any) {
      const errorMessage =
        err.message || err.response?.data?.message || "حدث خطأ مجهول";

      if (((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status === 409 || (err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status === 409 || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.status ?? "").toLowerCase().includes("conflict") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.status ?? "").includes("409") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).response?.data?.message ?? "").toLowerCase().includes("duplicated") || String((err as { response?: { status?: number | string; data?: { status?: number | string; message?: string } }; status?: number | string; data?: { status?: number | string; message?: string } }).data?.message ?? "").toLowerCase().includes("duplicated") || String(err.message ?? "").includes("409") || String(err.message ?? "").toLowerCase().includes("conflict") || String(err.message ?? "").toLowerCase().includes("code 409") || String(err.message ?? "").toLowerCase().includes("duplicated"))) {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "حدث خطأ !",
          description: `❌ ${toastMessageError}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      } else {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "حدث خطأ !",
          description: `❌ ${errorMessage}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      }
    } finally {
      toggleLoading();
    }
  };

  const onDelete = async () => {
    try {
      toggleLoading();

      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteFloatingUnitTypeById
        : softDeleteFloatingUnitTypeById;
      const result = await deleteFn(initialData.id);

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
        router.push(`/${params.locale}/settings/floating-unit-types`);
        setTimeout(() => {
          router.refresh();
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }, 500);
      }, 1000);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err.message || "❌ لم يتم الحذف",
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(listBackPath)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
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
            <FormField
              control={form.control}
              name="unitCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>فئة الوحدة</FormLabel>
                  <Select
                    dir={isRtl ? "rtl" : "ltr"}
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={
                          isRtl
                            ? "text-right border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200 [&>span]:text-right"
                            : "text-left border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200 [&>span]:text-left"
                        }
                      >
                        <SelectValue placeholder="اختر فئة الوحدة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      className={isRtl ? "text-right" : "text-left"}
                      dir={isRtl ? "rtl" : "ltr"}
                    >
                      {unitCategories.length === 0 ? (
                        <SelectItem value="no-data" disabled>
                          لا توجد بيانات
                        </SelectItem>
                      ) : (
                        unitCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nameEn as string}>
                            {isRtl
                              ? (cat.nameAr ?? cat.nameEn ?? cat.id)
                              : (cat.nameEn ?? cat.nameAr ?? cat.id)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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

export default FloatingUnitTypesForm;
