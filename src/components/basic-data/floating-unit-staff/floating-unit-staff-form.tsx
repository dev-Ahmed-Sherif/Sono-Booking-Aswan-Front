"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  FileText,
  Loader2,
  Trash,
  X,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import useToggleState from "@/hooks/use-toggle-state";
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { floatingUnitStaffBaseSchema } from "@/schemas";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { buildFloatingUnitStaffFormData } from "@/actions/basic-data/floatingUnitStaffFormData";
import {
  addFloatingUnitStaff,
  deleteFloatingUnitStaffById,
  softDeleteFloatingUnitStaffById,
  updateFloatingUnitStaffById,
} from "@/actions/basic-data/floatingUnitStaffService";
import { ToastAction } from "@radix-ui/react-toast";
import {
  fileToBase64,
  getFullFileUrl,
  type LocalFile,
} from "@/lib/file-viewer";
import { isImageFile } from "@/lib/image-file";
import type { FloatingUnitStaffFormValues } from "@/actions/basic-data/floatingUnitStaffFormData";
import {
  resolveNumericLookupId,
  type NumericLookupRow,
} from "@/lib/numeric-lookup";

type FormProps = {
  initialData: unknown | null;
  name: string;
  hideDelegate?: boolean;
  floatingUnitId?: string;
  nationalitiesData?: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null;
  gendersData: NumericLookupRow[] | null;
  idTypesData: NumericLookupRow[] | null;
  onSuccess?: () => void;
  hideBackButton?: boolean;
};

type FormValues = z.infer<typeof floatingUnitStaffBaseSchema>;

type StaffData = {
  id?: string;
  name?: string;
  job?: string;
  mobile?: string;
  email?: string;
  gender?: number | string;
  Gender?: number | string;
  idType?: number | string;
  IDType?: number | string;
  identity?: string;
  Identity?: string;
  nationalityId?: string;
  NationalityId?: string;
  isDelegate?: boolean;
  delegateAttachment?: unknown;
};

function resolvePathWithBase(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/");
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }
  const base = (process.env.NEXT_PUBLIC_BACK_END ?? "").replace(/\/$/, "");
  const clean = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  return base ? `${base}/${clean}` : clean;
}

function pathFromRaw(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim())
    return resolvePathWithBase(raw.trim());
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["path", "filePath", "url", "attachmentPath"] as const) {
      const p = o[k];
      if (typeof p === "string" && p.trim())
        return resolvePathWithBase(p.trim());
    }
  }
  return null;
}

function delegatePathFromInitialData(initialData: unknown): string | null {
  if (!initialData || typeof initialData !== "object") return null;
  const d = initialData as Record<string, unknown>;
  for (const k of [
    "delegateAttachment",
    "delegateAttachmentPath",
    "DelegateAttachment",
    "DelegateAttachmentPath",
  ] as const) {
    const p = pathFromRaw(d[k]);
    if (p) return p;
  }
  return null;
}

function resolveLookupIdWithAliases(
  value: unknown,
  list: NumericLookupRow[] | null | undefined,
  hardFallback: number,
  aliases: string[],
): number {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized && !Number.isNaN(Number(normalized))) {
    return resolveNumericLookupId(Number(normalized), list, hardFallback);
  }
  const hit = (list ?? []).find((x) => {
    const ar = String(x.nameAr ?? "").trim().toLowerCase();
    const en = String(x.nameEn ?? "").trim().toLowerCase();
    return aliases.some((a) => ar.includes(a) || en.includes(a));
  });
  if (hit) return hit.id;
  return resolveNumericLookupId(value, list, hardFallback);
}

const FloatingUnitStaffForm = ({
  initialData,
  name,
  hideDelegate = false,
  floatingUnitId,
  nationalitiesData = null,
  gendersData,
  idTypesData,
  onSuccess,
  hideBackButton = false,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/floating-unit`;
  const isRtl = locale === "ar" || locale.startsWith("ar-");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const [resetKey, setResetKey] = useState(0);
  const [didAddSuccessfully, setDidAddSuccessfully] = useState(false);
  const [delegateFile, setDelegateFile] = useState<{
    file: File;
    previewUrl?: string;
  } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<LocalFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<
    "image" | "pdf" | "text"
  >("text");
  const [loadingContent, setLoadingContent] = useState(false);
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const data = initialData as StaffData | null;
  const initialDelegatePath = useMemo(
    () => delegatePathFromInitialData(initialData),
    [initialData],
  );
  const [existingDelegateRemoved, setExistingDelegateRemoved] = useState(false);

  const personalCardTypeIds = useMemo(() => {
    return new Set(
      (idTypesData ?? [])
        .filter((x) => (x.nameAr ?? "").trim() === "بطاقة شخصية")
        .map((x) => x.id),
    );
  }, [idTypesData]);
  const passportTypeIds = useMemo(() => {
    return new Set(
      (idTypesData ?? [])
        .filter((x) => (x.nameAr ?? "").trim() === "جواز سفر")
        .map((x) => x.id),
    );
  }, [idTypesData]);

  const delegateValidationRef = useRef({
    isEdit: false as boolean,
    initialDelegatePath: null as string | null,
    existingDelegateRemoved: false,
  });
  delegateValidationRef.current = {
    isEdit: Boolean(data?.id),
    initialDelegatePath,
    existingDelegateRemoved,
  };

  useEffect(() => {
    setExistingDelegateRemoved(false);
  }, [initialData]);

  const validationSchema = useMemo(
    () =>
      floatingUnitStaffBaseSchema
        .extend({
          identity: z.string().min(1, { message: "رقم الهوية مطلوب" }),
        })
        .superRefine((vals, ctx) => {
        const {
          isEdit,
          initialDelegatePath: path,
          existingDelegateRemoved: removed,
        } = delegateValidationRef.current;
        const hasNewFile = vals.delegateAttachment instanceof File;
        const keepServerFile = isEdit && Boolean(path) && !removed;
        if (vals.isDelegate && !hasNewFile && !keepServerFile) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["delegateAttachment"],
            message: "ملف التفويض مطلوب",
          });
        }
        const isPersonalCard = personalCardTypeIds.has(vals.idType);
        if (isPersonalCard) {
          if (!/^\d{14}$/.test(vals.identity)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["identity"],
              message: "الرقم القومي يجب أن يكون 14 رقماً",
            });
          }
          return;
        }
        const isPassport = passportTypeIds.has(vals.idType);
        if (isPassport) {
          if (!/^[0-9A-Za-z]{7,15}$/.test(vals.identity)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["identity"],
              message:
                "رقم جواز السفر يجب أن يكون من 7 إلى 15 حرفاً (أرقام وحروف إنجليزية)",
            });
          }
          return;
        }
        if (!/^[0-9A-Za-z]+$/.test(vals.identity)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["identity"],
            message: "رقم الهوية يجب أن يحتوي على أرقام وحروف إنجليزية فقط",
          });
          return;
        }
        if (vals.identity.length !== 15) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["identity"],
            message: "رقم الهوية يجب أن يكون 15 حرفاً (أرقام وحروف إنجليزية)",
          });
        }
      }),
    [personalCardTypeIds, passportTypeIds],
  );

  const MAX_DELEGATE = 35 * 1024 * 1024;
  const title = data?.id ? `تعديل ${name}` : `حفظ ${name}`;
  const description = data?.id ? "تعديل" : "حفظ جديد";
  const toastMessage = data?.id ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = data?.id ? "تعديل" : "حفظ";
  const user = useLocalStorage("user");

  const filteredNationalities = (nationalitiesData ?? []).filter((n) =>
    `${n.nameAr} ${n.nameEn ?? ""}`
      .toLowerCase()
      .includes(nationalitySearch.toLowerCase()),
  );

  const defaultValues = useMemo((): FormValues => {
    const d = initialData as StaffData | null;
    if (d?.id) {
      return {
        id: d.id,
        name: d.name ?? "",
        job: d.job ?? "",
        mobile: d.mobile ?? "",
        email: d.email ?? "",
        gender: resolveLookupIdWithAliases(
          d.gender ?? d.Gender,
          gendersData,
          1,
          ["male", "ذكر"],
        ),
        idType: resolveLookupIdWithAliases(
          d.idType ?? d.IDType,
          idTypesData,
          1,
          ["idcard", "بطاقة", "passport", "جواز"],
        ),
        identity: String(d.identity ?? d.Identity ?? ""),
        nationalityId: String(d.nationalityId ?? d.NationalityId ?? ""),
        floatingUnitId: floatingUnitId ?? "",
        isDelegate: d.isDelegate ?? false,
        delegateAttachment: undefined,
      };
    }
    return {
      name: "",
      job: "",
      mobile: "",
      email: "",
      gender: resolveNumericLookupId(undefined, gendersData, 1),
      idType: resolveNumericLookupId(undefined, idTypesData, 1),
      identity: "",
      nationalityId: "",
      floatingUnitId: floatingUnitId ?? "",
      isDelegate: false,
      delegateAttachment: undefined,
    };
  }, [initialData, gendersData, idTypesData, floatingUnitId]);

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });
  const watchedIdType = form.watch("idType");
  const isPersonalCardIdType = useMemo(
    () => personalCardTypeIds.has(Number(watchedIdType)),
    [personalCardTypeIds, watchedIdType],
  );
  const isPassportIdType = useMemo(
    () => passportTypeIds.has(Number(watchedIdType)),
    [passportTypeIds, watchedIdType],
  );

  useEffect(() => {
    if (floatingUnitId) {
      form.setValue("floatingUnitId", floatingUnitId, {
        shouldValidate: true,
      });
    }
  }, [floatingUnitId, form]);

  const isDelegateChecked = form.watch("isDelegate");

  useEffect(() => {
    if (!didAddSuccessfully) return;
    form.reset({
      name: "",
      job: "",
      mobile: "",
      email: "",
      gender: resolveNumericLookupId(undefined, gendersData, 1),
      idType: resolveNumericLookupId(undefined, idTypesData, 1),
      identity: "",
      nationalityId: "",
      floatingUnitId: floatingUnitId ?? "",
      isDelegate: false,
      delegateAttachment: undefined,
    });
    setDelegateAttachment(null);
    setExistingDelegateRemoved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    form.clearErrors();
    setResetKey((k) => k + 1);
    setDidAddSuccessfully(false);
  }, [
    didAddSuccessfully,
    form,
    floatingUnitId,
    gendersData,
    idTypesData,
  ]);

  useEffect(() => {
    return () => {
      if (delegateFile?.previewUrl)
        URL.revokeObjectURL(delegateFile.previewUrl);
    };
  }, [delegateFile?.previewUrl]);

  const setDelegateAttachment = (file: File | null) => {
    if (delegateFile?.previewUrl) URL.revokeObjectURL(delegateFile.previewUrl);
    if (!file) {
      setDelegateFile(null);
      form.setValue("delegateAttachment", undefined, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: !!isDelegateChecked,
      });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ variant: "destructive", description: "يُسمح فقط بملفات PDF" });
      return;
    }
    if (file.size > MAX_DELEGATE) {
      toast({
        variant: "destructive",
        description: "الحد الأقصى لحجم ملف التفويض 35 ميجابايت",
      });
      return;
    }
    const previewUrl = undefined;
    setDelegateFile({ file, previewUrl });
    form.setValue("delegateAttachment", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  };

  const openFileViewer = async (file: LocalFile) => {
    setViewingFile(file);
    setViewerOpen(true);
    setLoadingContent(true);
    setFileContent(null);
    setFileContentType("text");
    try {
      const fileObj = file.file;
      const fileName = fileObj.name.toLowerCase();
      const isImage = isImageFile(fileObj);
      const isPdf =
        fileObj.type === "application/pdf" || fileName.endsWith(".pdf");
      if (isImage) {
        setFileContentType("image");
        setFileContent(file.previewUrl || (await fileToBase64(fileObj)));
      } else if (isPdf) {
        setFileContentType("pdf");
        setFileContent(file.previewUrl || (await fileToBase64(fileObj)));
      } else {
        setFileContentType("text");
        setFileContent("هذا النوع من الملفات لا يدعم العرض المباشر.");
      }
    } finally {
      setLoadingContent(false);
    }
  };

  const existingDelegateFileUrl =
    initialDelegatePath && !existingDelegateRemoved
      ? getFullFileUrl(initialDelegatePath)
      : null;
  const existingDelegateDisplayName =
    initialDelegatePath?.split("/").filter(Boolean).pop() ?? "file.pdf";

  const onSubmit = async (values: FormValues) => {
    const unitId = floatingUnitId ?? "";
    if (!unitId) {
      toast({
        variant: "destructive",
        description: "معرّف الوحدة العائمة غير متوفر",
      });
      return;
    }
    try {
      toggleLoading();
      const payload: FormValues = {
        ...values,
        floatingUnitId: unitId,
        id: data?.id,
      };
      const fd = buildFloatingUnitStaffFormData(
        payload as FloatingUnitStaffFormValues,
      );
      if (data?.id) {
        const res = await updateFloatingUnitStaffById(fd);
        if (res?.error)
          throw new Error(
            (res as { message?: string }).message ||
              (res as { error?: string }).error,
          );
        onSuccess?.();
      } else {
        const res = await addFloatingUnitStaff(fd);
        if (res?.error)
          throw new Error(
            (res as { message?: string }).message ||
              (res as { error?: string }).error,
          );
        setDidAddSuccessfully(true);
        onSuccess?.();
      }
      toast({ description: `🎉 ${toastMessage}` });
      setTimeout(() => router.refresh(), 800);
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
    if (!data?.id) return;
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteFloatingUnitStaffById
        : softDeleteFloatingUnitStaffById;
      const result = await deleteFn(data.id);
      if (result?.error) {
        toast({
          variant: "destructive",
          title: "خطأ في الحذف",
          description:
            (result as { message?: string }).message || "❌ لم يتم الحذف",
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
      onSuccess?.();
      setTimeout(() => router.refresh(), 800);
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
        <div className="my-7 flex flex-col items-center justify-center gap-2 w-full">
          <Heading title={title} description={description} />
          <Separator />
        </div>
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
      <Form {...form}>
        <form
          key={resetKey}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-full"
          autoComplete="off"
        >
          <section className="space-y-4 rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <h3 className="text-base font-semibold">
              البيانات الأساسية والتواصل
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                        className="text-center"
                        placeholder="الاسم"
                        onKeyDown={(e) => {
                          if (
                            (e as unknown as { isComposing?: boolean })
                              .isComposing
                          )
                            return;
                          const ok = [
                            "Backspace",
                            "Delete",
                            "ArrowLeft",
                            "ArrowRight",
                            "Tab",
                            "Enter",
                          ];
                          if (ok.includes(e.key)) return;
                          if (
                            e.key.length === 1 &&
                            !/^[A-Za-z\u0600-\u06FF\s]$/.test(e.key)
                          )
                            e.preventDefault();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="job"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوظيفة</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        className="text-center"
                        placeholder="الوظيفة"
                        onKeyDown={(e) => {
                          if (
                            (e as unknown as { isComposing?: boolean })
                              .isComposing
                          )
                            return;
                          const ok = [
                            "Backspace",
                            "Delete",
                            "ArrowLeft",
                            "ArrowRight",
                            "Tab",
                            "Enter",
                          ];
                          if (ok.includes(e.key)) return;
                          if (
                            e.key.length === 1 &&
                            !/^[A-Za-z\u0600-\u06FF\s]$/.test(e.key)
                          )
                            e.preventDefault();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="identity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isPersonalCardIdType
                        ? "الرقم القومي (14 رقماً)"
                        : isPassportIdType
                          ? "رقم جواز السفر (7-15 حرفاً)"
                          : "رقم الهوية (15 حرفاً)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        className="text-center"
                        maxLength={isPersonalCardIdType ? 14 : 15}
                        minLength={isPassportIdType ? 7 : undefined}
                        inputMode={isPersonalCardIdType ? "numeric" : undefined}
                        pattern={isPersonalCardIdType ? "[0-9]*" : undefined}
                        placeholder={
                          isPersonalCardIdType
                            ? "الرقم القومي"
                            : isPassportIdType
                              ? "رقم جواز السفر"
                              : "أرقام وحروف إنجليزية"
                        }
                        onChange={(e) => {
                          const v = isPersonalCardIdType
                            ? e.target.value.replace(/\D/g, "").slice(0, 14)
                            : e.target.value
                                .replace(/[^0-9A-Za-z]/g, "")
                                .slice(0, 15);
                          field.onChange(v);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => {
                  const list = gendersData ?? [];
                  const hasValue =
                    typeof field.value === "number" &&
                    list.some((g) => g.id === field.value);
                  const options =
                    hasValue || !list.length
                      ? list
                      : [
                          ...list,
                          {
                            id: field.value as number,
                            nameAr: `#${field.value}`,
                          },
                        ];
                  return (
                    <FormItem>
                      <FormLabel>النوع</FormLabel>
                      {options.length > 0 ? (
                        <Select
                          dir={isRtl ? "rtl" : "ltr"}
                          disabled={loading}
                          value={
                            field.value === undefined
                              ? undefined
                              : String(field.value)
                          }
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[10002]">
                            {options.map((g) => (
                              <SelectItem key={g.id} value={String(g.id)}>
                                {g.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2 text-center">
                          لا توجد أنواع متاحة من الخادم
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="idType"
                render={({ field }) => {
                  const list = idTypesData ?? [];
                  const hasValue =
                    typeof field.value === "number" &&
                    list.some((t) => t.id === field.value);
                  const options =
                    hasValue || !list.length
                      ? list
                      : [
                          ...list,
                          {
                            id: field.value as number,
                            nameAr: `#${field.value}`,
                          },
                        ];
                  return (
                    <FormItem>
                      <FormLabel>نوع الهوية</FormLabel>
                      {options.length > 0 ? (
                        <Select
                          dir={isRtl ? "rtl" : "ltr"}
                          disabled={loading}
                          value={
                            field.value === undefined
                              ? undefined
                              : String(field.value)
                          }
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="نوع الهوية" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[10002]">
                            {options.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2 text-center">
                          لا توجد أنواع هوية متاحة من الخادم
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="nationalityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الجنسية</FormLabel>
                    <FormControl>
                      <Popover
                        open={nationalityOpen}
                        onOpenChange={setNationalityOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            disabled={loading}
                            className="w-full justify-between"
                          >
                            {field.value
                              ? ((nationalitiesData ?? []).find(
                                  (n) => n.id === field.value,
                                )?.nameAr ?? field.value)
                              : "اختر الجنسية"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[320px] p-2 z-[10002]"
                          align="start"
                        >
                          <Input
                            value={nationalitySearch}
                            onChange={(e) =>
                              setNationalitySearch(e.target.value)
                            }
                            placeholder="ابحث..."
                            className="mb-2"
                          />
                          <div className="max-h-60 overflow-y-auto space-y-1">
                            {filteredNationalities.length === 0 ? (
                              <div className="px-2 py-3 text-sm text-muted-foreground">
                                لا توجد نتائج
                              </div>
                            ) : (
                              filteredNationalities.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="w-full flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent"
                                  onClick={() => {
                                    field.onChange(item.id);
                                    setNationalityOpen(false);
                                    setNationalitySearch("");
                                  }}
                                >
                                  <span>{item.nameAr}</span>
                                  {field.value === item.id && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
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
                        className="text-center"
                        placeholder="الإيميل"
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
                        className="text-center"
                        maxLength={11}
                        inputMode="numeric"
                        onChange={(e) => {
                          field.onChange(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {!hideDelegate && (
            <section className="space-y-4 rounded-lg border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <h3 className="text-base font-semibold">بيانات التفويض</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-6xl mx-auto">
                <FormField
                  control={form.control}
                  name="isDelegate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-8">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={loading}
                          className="h-7 w-7 rounded border-input"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">مفوض</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="delegateAttachment"
                  render={({
                    field: { onChange: _oc, value: _v, ...rest },
                  }) => (
                    <FormItem>
                      <FormLabel>مرفق التفويض (PDF)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <input
                            {...rest}
                            ref={(el) => {
                              rest.ref(el);
                              fileInputRef.current = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            disabled={loading}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setDelegateAttachment(file);
                              e.target.value = "";
                              restoreAfterPick();
                            }}
                          />
                          {delegateFile ? (
                            <div className="flex flex-wrap items-center gap-2 rounded border p-2">
                              <FileText className="h-5 w-5" />
                              <span className="text-sm flex-1 truncate">
                                {delegateFile.file.name}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openFileViewer({
                                    file: delegateFile.file,
                                    previewUrl: delegateFile.previewUrl,
                                  })
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDelegateAttachment(null);
                                  if (fileInputRef.current)
                                    fileInputRef.current.value = "";
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : existingDelegateFileUrl ? (
                            <div className="flex flex-wrap items-center gap-2 rounded border p-2">
                              <span className="text-sm flex-1 truncate">
                                {existingDelegateDisplayName}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openFileViewer({
                                    file: new File(
                                      [],
                                      existingDelegateDisplayName,
                                      {
                                        type: "application/pdf",
                                      },
                                    ),
                                    previewUrl: existingDelegateFileUrl,
                                  })
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(
                                    existingDelegateFileUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setExistingDelegateRemoved(true);
                                  form.setValue(
                                    "delegateAttachment",
                                    undefined,
                                    {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    },
                                  );
                                  if (fileInputRef.current)
                                    fileInputRef.current.value = "";
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              triggerFileInputClick(fileInputRef.current)
                            }
                          >
                            اختيار ملف PDF
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
          )}

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

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {viewingFile?.file.name || "عرض الملف"}
            </DialogTitle>
          </DialogHeader>
          {loadingContent ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              جاري تحميل الملف...
            </div>
          ) : fileContentType === "image" && fileContent ? (
            <div className="flex justify-center">
              <Image
                src={fileContent}
                alt={viewingFile?.file.name || "preview"}
                width={1000}
                height={700}
                unoptimized
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          ) : fileContentType === "pdf" && fileContent ? (
            <iframe
              src={fileContent}
              className="w-full h-[70vh] rounded-md border"
              title={viewingFile?.file.name || "pdf-preview"}
            />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {fileContent || "لا يمكن عرض هذا الملف."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingUnitStaffForm;
