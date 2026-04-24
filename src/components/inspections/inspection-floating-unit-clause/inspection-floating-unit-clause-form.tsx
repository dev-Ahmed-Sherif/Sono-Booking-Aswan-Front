"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Textarea } from "@/components/ui/textarea";
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
import { inspectionFloatingUnitClauseSchema } from "@/schemas";
import {
  addInspectionFloatingUnitClause,
  deleteInspectionFloatingUnitClauseById,
  softDeleteInspectionFloatingUnitClauseById,
  updateInspectionFloatingUnitClauseById,
} from "@/actions/inspection/inspectionFloatingUnitClauseService";
import { ToastAction } from "@radix-ui/react-toast";

type InspectionFloatingUnitClauseFormValues = z.infer<
  typeof inspectionFloatingUnitClauseSchema
>;

type LookupItem = { id: string; nameAr?: string; name?: string };

type InspectionFloatingUnitClauseFormProps = {
  initialData: any | null;
  inspections?: LookupItem[];
  inspectionClauses?: LookupItem[];
  basePath?: string;
};

const InspectionFloatingUnitClauseForm = ({
  initialData,
  inspections = [],
  inspectionClauses = [],
  basePath = "/inspections/inspection-floating-unit-clause",
}: InspectionFloatingUnitClauseFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const user = useLocalStorage("user");
  const locale = (params?.locale as string) ?? "ar";

  const title = initialData
    ? "تعديل بند تفتيش الوحدة العائمة"
    : "حفظ بند تفتيش الوحدة العائمة";
  const description = initialData ? "تعديل" : "حفظ جديد";
  const toastMessage = initialData ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const action = initialData ? "تعديل" : "حفظ";
  const listBackPath = `/${locale}${basePath}`;

  const form = useForm<InspectionFloatingUnitClauseFormValues>({
    resolver: zodResolver(inspectionFloatingUnitClauseSchema),
    defaultValues: {
      id: initialData?.id ?? undefined,
      isInspected: initialData?.isInspected ?? false,
      number: initialData?.number ?? "",
      note: initialData?.note ?? "",
      inspectionId: initialData?.inspectionId ?? "",
      inspectionClauseId: initialData?.inspectionClauseId ?? "",
    },
  });

  const onSubmit = async (data: InspectionFloatingUnitClauseFormValues) => {
    try {
      toggleLoading();
      if (initialData) {
        const res = await updateInspectionFloatingUnitClauseById({
          ...data,
          id: initialData.id,
        });
        if (res?.error) throw new Error(res.message || res.error);
      } else {
        const res = await addInspectionFloatingUnitClause(data);
        if (res?.error) throw new Error(res.message || res.error);
      }
      router.refresh();
      setTimeout(() => router.push(listBackPath), 1000);
      toast({ description: `🎉 ${toastMessage}` });
    } catch (err: any) {
      const errorMessage =
        err.message || err.response?.data?.message || "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        duration: 3000,
        title: "حدث خطأ !",
        description: `❌ ${errorMessage}`,
        action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
      });
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
        ? deleteInspectionFloatingUnitClauseById
        : softDeleteInspectionFloatingUnitClauseById;
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
        router.push(listBackPath);
        setTimeout(() => {
          router.refresh();
          setTimeout(() => window.location.reload(), 500);
        }, 500);
      }, 1000);
    } catch (err: any) {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* تم الفحص */}
            <FormField
              control={form.control}
              name="isInspected"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تم الفحص</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={(val) => field.onChange(val === "true")}
                    value={String(field.value ?? false)}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">نعم</SelectItem>
                      <SelectItem value="false">لا</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* التفتيش */}
            <FormField
              control={form.control}
              name="inspectionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التفتيش</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التفتيش" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inspections.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nameAr ?? i.name ?? i.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* بند التفتيش */}
            <FormField
              control={form.control}
              name="inspectionClauseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>بند التفتيش</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر بند التفتيش" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inspectionClauses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nameAr ?? c.name ?? c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* الرقم (اختياري) */}
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الرقم (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      placeholder="رقم البند"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ملاحظات */}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ملاحظات (اختياري)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    disabled={loading}
                    placeholder="ملاحظات"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-center">
            <Button
              disabled={loading}
              className="text-center h-11 min-w-32 px-6"
            >
              {loading && <Loader2 className="h-6 w-6 animate-spin ml-2" />}
              {action}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default InspectionFloatingUnitClauseForm;
