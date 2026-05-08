"use client";

import * as z from "zod";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Trash } from "lucide-react";

import { lookupSchema } from "@/schemas";
import * as service from "@/actions/settings/apartmentTypeService";
import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import useToggleState from "@/hooks/use-toggle-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type ApartmentTypeFormProps = {
  initialData:
    | ({
        id?: string;
        code?: string;
        nameAr?: string;
        nameEn?: string;
      } & Record<string, unknown>)
    | null;
  name: string;
};

type ApartmentTypeFormValues = z.infer<typeof lookupSchema>;
type ServiceFn = (arg: any) => Promise<any>;

const svc = service as unknown as Record<string, ServiceFn | undefined>;
const addFn = svc["addApartmentType"];
const updateFn = svc["updateApartmentTypeById"];
const deleteFn = svc["deleteApartmentTypeById"];
const softDeleteFn = svc["softDeleteApartmentTypeById"];

const ApartmentTypeForm = ({ initialData, name }: ApartmentTypeFormProps) => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const form = useForm<ApartmentTypeFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      nameAr: initialData?.nameAr ?? "",
      nameEn: initialData?.nameEn ?? "",
    },
  });

  const onSubmit = async (values: ApartmentTypeFormValues) => {
    try {
      toggleLoading();
      if (initialData?.id) {
        if (!updateFn) throw new Error("دالة التعديل غير متاحة");
        const result = await updateFn({
          ...values,
          id: initialData.id,
          code: initialData.code,
        });
        if (result?.error) throw new Error(result.message || "فشل التعديل");
      } else {
        if (!addFn) throw new Error("دالة الإضافة غير متاحة");
        const result = await addFn({ ...values, code: "" });
        if (result?.error) throw new Error(result.message || "فشل الإضافة");
      }

      toast({
        description: initialData?.id ? "تم التعديل بنجاح" : "تمت الإضافة بنجاح",
      });
      router.refresh();
      setTimeout(
        () => router.push(`/${params.locale}/settings/apartment-types`),
        300,
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error?.message || "تعذر حفظ البيانات",
      });
    } finally {
      toggleLoading();
    }
  };

  const onDelete = async () => {
    if (!initialData?.id) return;
    if (!deleteFn && !softDeleteFn) {
      toast({
        variant: "destructive",
        description: "لا توجد دالة حذف متاحة حاليا",
      });
      return;
    }

    try {
      toggleLoading();
      const result = await softDeleteFn?.(initialData.id as string);
      if (result?.error) throw new Error(result.message || "فشل الحذف");
      toast({ description: "تم حذف البيان بنجاح" });
      toggleOpen();
      router.push(`/${params.locale}/settings/apartment-types`);
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: error?.message || "لم يتم الحذف",
      });
    } finally {
      toggleLoading();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/${params.locale}/settings/apartment-types`)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={toggleOpen}
        onConfirm={onDelete}
      />
      <div className="flex items-center justify-between">
        <Heading
          title={initialData ? `تعديل ${name}` : `إضافة ${name}`}
          description="إدارة بيانات الضبط والإعدادات"
        />
        {initialData ? (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={toggleOpen}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      placeholder="الاسم بالعربية"
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
                      placeholder="الاسم بالإنجليزية"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {initialData ? "تعديل" : "حفظ"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default ApartmentTypeForm;
