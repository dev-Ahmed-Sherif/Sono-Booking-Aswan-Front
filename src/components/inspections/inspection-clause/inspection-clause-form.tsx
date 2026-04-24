"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowRight, Loader2, Trash } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

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
import { inspectionClauseSchema } from "@/schemas";
import {
  addInspectionClause,
  deleteInspectionClauseById,
  softDeleteInspectionClauseById,
  updateInspectionClauseById,
} from "@/actions/inspection/inspectionClauseService";
import { ToastAction } from "@radix-ui/react-toast";

type InspectionClauseFormValues = z.infer<typeof inspectionClauseSchema>;

type LookupItem = { id: string; code?: string; nameAr?: string; name?: string };

type InspectionClauseFormProps = {
  initialData: any | null;
  inspectionTypes?: LookupItem[];
  parentClauses?: LookupItem[];
  basePath?: string;
};

function parseInitialInspectionClause(
  data: unknown,
): (InspectionClauseFormValues & { id?: string }) | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const idRaw = o.id ?? o.Id;
  const codeRaw = o.code ?? o.Code;
  const nameRaw = o.name ?? o.Name ?? o.nameAr ?? o.NameAr;
  const parentIdRaw =
    o.parentId ??
    o.ParentId ??
    o.parentClauseId ??
    o.ParentClauseId ??
    (o.parent as Record<string, unknown> | undefined)?.id ??
    (o.parent as Record<string, unknown> | undefined)?.Id;
  const inspectionTypeIdRaw =
    o.inspectionTypeId ??
    o.InspectionTypeId ??
    (o.inspectionType as Record<string, unknown> | undefined)?.id ??
    (o.inspectionType as Record<string, unknown> | undefined)?.Id;

  return {
    id: idRaw != null ? String(idRaw) : undefined,
    code: codeRaw != null ? String(codeRaw) : "",
    name: nameRaw != null ? String(nameRaw) : "",
    parentId: parentIdRaw != null ? String(parentIdRaw) : undefined,
    inspectionTypeId:
      inspectionTypeIdRaw != null ? String(inspectionTypeIdRaw) : "",
  };
}

const InspectionClauseForm = ({
  initialData,
  inspectionTypes = [],
  parentClauses = [],
  basePath = "/inspections/inspection-clause",
}: InspectionClauseFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const user = useLocalStorage("user");
  const locale = (params?.locale as string) ?? "ar";
  const parsedInitialData = useMemo(
    () => parseInitialInspectionClause(initialData),
    [initialData],
  );
  const isEdit = Boolean(parsedInitialData?.id);

  const title = isEdit ? "تعديل بند التفتيش" : "حفظ بند التفتيش";
  const description = isEdit ? "تعديل" : "حفظ جديد";
  const toastMessage = isEdit ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = isEdit ? "تعديل" : "حفظ";
  const listBackPath = `/${locale}${basePath}`;

  const form = useForm<InspectionClauseFormValues>({
    resolver: zodResolver(inspectionClauseSchema),
    defaultValues: {
      id: parsedInitialData?.id ?? undefined,
      code: parsedInitialData?.code ?? "",
      name: parsedInitialData?.name ?? "",
      parentId: parsedInitialData?.parentId ?? undefined,
      inspectionTypeId: parsedInitialData?.inspectionTypeId ?? "",
    },
  });

  const codeValue = useWatch({
    control: form.control,
    name: "code",
    defaultValue: parsedInitialData?.code ?? "",
  });
  const previousCodeRef = useRef(String(parsedInitialData?.code ?? "").trim());

  // useEffect(() => {
  //   form.reset({
  //     id: parsedInitialData?.id ?? undefined,
  //     code: parsedInitialData?.code ?? "",
  //     name: parsedInitialData?.name ?? "",
  //     parentId: parsedInitialData?.parentId ?? undefined,
  //     inspectionTypeId: parsedInitialData?.inspectionTypeId ?? "",
  //   });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when loaded row changes
  // }, [
  //   parsedInitialData?.id,
  //   parsedInitialData?.code,
  //   parsedInitialData?.name,
  //   parsedInitialData?.parentId,
  //   parsedInitialData?.inspectionTypeId,
  // ]);

  const filteredParentClauses = useMemo(() => {
    // if (isEdit) return parentClauses;
    // console.log("parentClauses :", parentClauses);

    const normalizedCode = String(codeValue ?? "").trim();
    if (normalizedCode.length < 2) return [];

    // Immediate hierarchical parent:
    // 12  -> 1
    // 122 -> 12
    const expectedParentCode = normalizedCode.slice(0, -1);

    return parentClauses.filter((c) => {
      const parentCode = String(c.code ?? "").trim();
      return parentCode === expectedParentCode;
    });
  }, [codeValue, isEdit, parentClauses]);

  useEffect(() => {
    if (isEdit) {
      previousCodeRef.current = String(codeValue ?? "").trim();
      return;
    }

    const normalizedCode = String(codeValue ?? "").trim();
    const previousCode = previousCodeRef.current;
    const codeChanged = normalizedCode !== previousCode;

    if (codeChanged) {
      previousCodeRef.current = normalizedCode;
      const currentParentId = form.getValues("parentId");
      if (currentParentId) {
        form.setValue("parentId", undefined);
      }
      return;
    }

    const currentParentId = form.getValues("parentId");
    if (
      currentParentId &&
      !filteredParentClauses.some((c) => c.id === currentParentId)
    ) {
      form.setValue("parentId", undefined);
    }
  }, [codeValue, filteredParentClauses, form, isEdit]);

  const onSubmit = async (data: InspectionClauseFormValues) => {
    try {
      toggleLoading();
      if (isEdit && parsedInitialData?.id) {
        const res = await updateInspectionClauseById({
          ...data,
          id: parsedInitialData.id,
        });
        if (res?.error) throw new Error(res.message || res.error);
      } else {
        const res = await addInspectionClause(data);
        if (res?.error) throw new Error(res.message || res.error);
      }
      router.refresh();
      setTimeout(() => router.push(listBackPath), 1000);
      toast({ description: `🎉 ${toastMessage}` });
    } catch (err: any) {
      const errorMessage =
        err.message || err.response?.data?.message || "حدث خطأ مجهول";
      const isDuplicate =
        String(err.response?.status ?? "").includes("409") ||
        String(err.message ?? "")
          .toLowerCase()
          .includes("duplicated") ||
        String(err.message ?? "")
          .toLowerCase()
          .includes("conflict");
      toast({
        variant: "destructive",
        duration: 3000,
        title: "حدث خطأ !",
        description: isDuplicate
          ? `❌ ${toastMessageError}`
          : `❌ ${errorMessage}`,
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
        ? deleteInspectionClauseById
        : softDeleteInspectionClauseById;
      if (!parsedInitialData?.id) throw new Error("بيانات البند غير مكتملة");
      const result = await deleteFn(parsedInitialData.id);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* الكود */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الكود</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      placeholder="كود البند"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* الاسم */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      placeholder="اسم البند"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* نوع التفتيش */}
            <FormField
              control={form.control}
              name="inspectionTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع التفتيش</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع التفتيش" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inspectionTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nameAr ?? t.name ?? t.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* البند الرئيسي (اختياري) */}
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البند الرئيسي (اختياري)</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="بدون بند رئيسي" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredParentClauses.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          لا توجد بنود بطول كود مناسب
                        </div>
                      ) : (
                        filteredParentClauses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code ? `${c.code} - ` : ""}
                            {c.nameAr ?? c.name ?? c.id}
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
              {loading && <Loader2 className="h-6 w-6 animate-spin ml-2" />}
              {action}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default InspectionClauseForm;
