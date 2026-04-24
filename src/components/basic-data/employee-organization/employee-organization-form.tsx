"use client";

import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Download,
  Eye,
  FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
import { organizationEmployeeBaseSchema } from "@/schemas";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import {
  addOrganizationStaff,
  deleteOrganizationStaffById,
  softDeleteOrganizationStaffById,
  updateOrganizationStaffById,
} from "@/actions/basic-data/organizationStaffService";
import { ToastAction } from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import {
  fileToBase64,
  getFullFileUrl,
  type LocalFile,
} from "@/lib/file-viewer";

type FormProps = {
  initialData: unknown | null;
  name: string;
  hideDelegate?: boolean;
  organizationId?: string;
  onSuccess?: () => void;
  defaultPhone?: string;
  /** When nested inside another form (e.g. company tabs), hide duplicate back control */
  hideBackButton?: boolean;
};
type FormValues = z.infer<typeof organizationEmployeeBaseSchema>;

type EmployeeOrganizationData = {
  id?: string;
  name?: string;
  job?: string;
  nationalId?: string;
  mobile?: string;
  phone?: string;
  phoneExtension?: string;
  email?: string;
  isDelegate?: boolean;
  /** API path or nested attachment object — used to show existing delegate PDF on edit */
  delegateAttachment?: unknown;
};

const defaultFormValues: FormValues = {
  name: "",
  job: "",
  nationalId: "",
  mobile: "",
  phone: "",
  phoneExtension: "",
  email: "",
  isDelegate: false,
  delegateAttachment: undefined,
};

/** Relative paths become `NEXT_PUBLIC_BACK_END/...`; absolute / blob URLs unchanged. */
function resolveCommercialAttachmentPathWithBase(path: string): string {
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

function getInitialCommercialAttachmentPath(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim()) {
    return resolveCommercialAttachmentPathWithBase(raw.trim());
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["path", "filePath", "url", "attachmentPath"] as const) {
      const p = o[k];
      if (typeof p === "string" && p.trim()) {
        return resolveCommercialAttachmentPathWithBase(p.trim());
      }
    }
  }
  return null;
}

/** Reads API string path e.g. `Organization/OwnerCompany/639....pdf` */
function commercialPathFromInitialData(initialData: unknown): string | null {
  if (!initialData || typeof initialData !== "object") return null;
  const d = initialData as Record<string, unknown>;
  const keys = [
    "commercialRegistrationAttachment",
    "commercialRegistrationAttachmentPath",
    "CommercialRegistrationAttachment",
  ];
  for (const k of keys) {
    const p = getInitialCommercialAttachmentPath(d[k]);
    if (p) return p;
  }
  return null;
}

/** Delegate PDF path from staff API (same resolution as commercialPathFromInitialData). */
function delegatePathFromInitialData(initialData: unknown): string | null {
  if (!initialData || typeof initialData !== "object") return null;
  const d = initialData as Record<string, unknown>;
  const keys = [
    "delegateAttachment",
    "delegateAttachmentPath",
    "DelegateAttachment",
    "DelegateAttachmentPath",
  ];
  for (const k of keys) {
    const p = getInitialCommercialAttachmentPath(d[k]);
    if (p) return p;
  }
  return null;
}

/** Server Actions cannot serialize `File` inside plain objects — use FormData for multipart. */
function buildOrganizationStaffFormData(
  values: FormValues,
  options?: { id?: string; organizationId?: string },
): FormData {
  const fd = new FormData();
  if (options?.id) {
    fd.append("id", options.id);
  }
  if (
    options?.organizationId !== undefined &&
    options.organizationId !== null
  ) {
    fd.append("organizationId", String(options.organizationId));
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (key === "delegateAttachment") {
      if (value instanceof File) fd.append(key, value);
      continue;
    }
    if (value instanceof File) {
      fd.append(key, value);
    } else {
      fd.append(key, String(value));
    }
  }
  return fd;
}

const EmployeeOrganizationForm = ({
  initialData,
  name,
  hideDelegate = false,
  organizationId,
  onSuccess,
  defaultPhone = "",
  hideBackButton = false,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? "ar";
  const employeeListBackPath = `/${locale}/basic-data`;
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
  const data = initialData as EmployeeOrganizationData | null;
  const initialDelegatePath = useMemo(
    () => delegatePathFromInitialData(initialData),
    [initialData],
  );
  const [existingDelegateRemoved, setExistingDelegateRemoved] = useState(false);

  /** RHF keeps the first `resolver`; read dynamic flags here so validation stays in sync on update. */
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
      organizationEmployeeBaseSchema.superRefine((vals, ctx) => {
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
      }),
    [],
  );

  const MAX_DELEGATE_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35MB
  const DELEGATE_ACCEPTED_MIME_TYPES = ["application/pdf"];
  const title = data?.id ? `تعديل ${name}` : `حفظ ${name}`;
  const description = data?.id ? "تعديل" : "حفظ جديد";
  const toastMessage = data?.id ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = data?.id ? "تعديل" : "حفظ";

  const user = useLocalStorage("user");
  const createDefaultValues: FormValues = {
    ...defaultFormValues,
    phone: defaultPhone,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: data?.id
      ? {
          name: data.name ?? "",
          job: data.job ?? "",
          nationalId: data.nationalId ?? "",
          mobile: data.mobile ?? "",
          phone: data.phone ?? "",
          phoneExtension: data.phoneExtension ?? "",
          email: data.email ?? "",
          isDelegate: data.isDelegate ?? false,
          delegateAttachment: undefined,
        }
      : createDefaultValues,
  });

  const isDelegateChecked = form.watch("isDelegate");

  useEffect(() => {
    if (!didAddSuccessfully) return;

    // Reset after React Hook Form finishes submit cycle
    form.reset({ ...createDefaultValues });
    setDelegateAttachment(null);
    setExistingDelegateRemoved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    form.clearErrors();
    setResetKey((k) => k + 1);

    setDidAddSuccessfully(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didAddSuccessfully]);
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

    const isAcceptedType = DELEGATE_ACCEPTED_MIME_TYPES.some((t) =>
      t.endsWith("/") ? file.type.startsWith(t) : file.type === t,
    );
    const isUnderLimit = file.size <= MAX_DELEGATE_FILE_SIZE_BYTES;

    if (!isAcceptedType) {
      toast({
        variant: "destructive",
        description: "يُسمح فقط بملفات PDF",
      });
      return;
    }

    if (!isUnderLimit) {
      toast({
        variant: "destructive",
        description: "الحد الأقصى لحجم ملف التفويض 35 ميجابايت",
      });
      return;
    }

    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;

    setDelegateFile({ file, previewUrl });
    form.setValue("delegateAttachment", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      toggleLoading();
      const orgId = organizationId ?? "";
      if (data?.id) {
        const res = await updateOrganizationStaffById(
          buildOrganizationStaffFormData(values, {
            id: data.id,
            organizationId: orgId,
          }),
        );
        if (res?.error)
          throw new Error(
            (res as { message?: string }).message ||
              (res as { error?: string }).error,
          );
        onSuccess?.();
      } else {
        const res = await addOrganizationStaff(
          buildOrganizationStaffFormData(values, { organizationId: orgId }),
        );
        if (res?.error)
          throw new Error(
            (res as { message?: string }).message ||
              (res as { error?: string }).error,
          );
        setDidAddSuccessfully(true);
        onSuccess?.();
      }
      toast({ description: `🎉 ${toastMessage}` });
      // After creating a new record, clear inputs for next entry

      setTimeout(() => {
        router.refresh();
      }, 1000);
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
        ? deleteOrganizationStaffById
        : softDeleteOrganizationStaffById;
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
      setTimeout(() => {
        // router.push(`/${params.locale}/basic-data/employee-organization`);
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

  const openFileViewer = async (file: LocalFile) => {
    setViewingFile(file);
    setViewerOpen(true);
    setLoadingContent(true);
    setFileContent(null);
    setFileContentType("text");
    try {
      const fileObj = file.file;
      const fileName = fileObj.name.toLowerCase();
      const fileType = fileObj.type;
      const isImage =
        fileType.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileName);
      const isPdf = fileType === "application/pdf" || fileName.endsWith(".pdf");

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
          onClick={() => router.push(employeeListBackPath)}
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
          {/* Section 1: basic + communication */}
          <section className="space-y-4 rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <h3 className="text-base font-semibold">
              البيانات الأساسية والتواصل
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
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
                        type="text"
                        placeholder="الاسم"
                        className="text-center"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (
                            (e as unknown as { isComposing?: boolean })
                              .isComposing
                          )
                            return;

                          // Allow navigation/control keys.
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

                          // Allow only letters (Arabic/English) and spaces.
                          if (e.key.length === 1) {
                            const isLetterOrSpace = /^[A-Za-z\u0600-\u06FF\s]$/.test(
                              e.key,
                            );
                            if (!isLetterOrSpace) e.preventDefault();
                          }
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
                        type="text"
                        placeholder="الوظيفة"
                        className="text-center"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (
                            (e as unknown as { isComposing?: boolean })
                              .isComposing
                          )
                            return;

                          // Allow navigation/control keys.
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

                          // Allow only letters (Arabic/English) and spaces.
                          if (e.key.length === 1) {
                            const isLetterOrSpace = /^[A-Za-z\u0600-\u06FF\s]$/.test(
                              e.key,
                            );
                            if (!isLetterOrSpace) e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الرقم القومي</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="text"
                        placeholder="الرقم القومي"
                        className="text-center"
                        autoComplete="off"
                        maxLength={14}
                        inputMode="numeric"
                        pattern="[0-9]*"
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
                        className="text-center"
                        autoComplete="off"
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
                    <FormLabel>الموبايل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="tel"
                        placeholder="مثال: 01012345678"
                        className="text-center"
                        autoComplete="off"
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هاتف مباشر</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="tel"
                        placeholder="مثال: 2465321"
                        className="text-center"
                        autoComplete="off"
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
                name="phoneExtension"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التحويلة</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="text"
                        placeholder="مثال: 700"
                        className="text-center"
                        autoComplete="off"
                        maxLength={5}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onChange={(e) => {
                          const onlyDigits = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 5);
                          field.onChange(onlyDigits);
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
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>مرفق التفويض</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            {...rest}
                            ref={(el) => {
                              rest.ref(el);
                              fileInputRef.current = el;
                            }}
                            disabled={loading}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setDelegateAttachment(file);
                              // allow same file re-select
                              e.target.value = "";
                              restoreAfterPick();
                            }}
                          />

                          {delegateFile ? (
                            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
                              <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                {delegateFile.previewUrl ? (
                                  <Image
                                    src={delegateFile.previewUrl}
                                    alt="preview-delegate-attachment"
                                    width={300}
                                    height={180}
                                    unoptimized
                                    className="w-full h-28 object-cover"
                                  />
                                ) : (
                                  <div className="h-28 flex items-center justify-center">
                                    <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                      {(() => {
                                        const type = delegateFile.file.type;
                                        const Icon = type.startsWith("image/")
                                          ? FileImage
                                          : type === "application/pdf"
                                            ? FileText
                                            : type === "application/msword" ||
                                                type ===
                                                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                              ? FileText
                                              : type ===
                                                    "application/vnd.ms-excel" ||
                                                  type ===
                                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                                ? FileSpreadsheet
                                                : FileIcon;
                                        const ext =
                                          delegateFile.file.name
                                            .split(".")
                                            .pop()
                                            ?.toUpperCase() ?? "";
                                        return (
                                          <>
                                            <Icon className="w-8 h-8 mb-1" />
                                            <span
                                              className="text-xs truncate max-w-[90%]"
                                              title={delegateFile.file.name}
                                            >
                                              {delegateFile.file.name}
                                            </span>
                                            <span className="text-[10px] opacity-70">
                                              {ext}
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}

                                <div className="absolute top-1 right-1 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openFileViewer({
                                        file: delegateFile.file,
                                        previewUrl: delegateFile.previewUrl,
                                      });
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="عرض"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = URL.createObjectURL(
                                        delegateFile.file,
                                      );
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = delegateFile.file.name;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      setTimeout(
                                        () => URL.revokeObjectURL(url),
                                        1000,
                                      );
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="تحميل"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDelegateAttachment(null);
                                      fileInputRef.current &&
                                        (fileInputRef.current.value = "");
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="إزالة"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  "w-full border-2 border-dashed rounded-lg transition-colors duration-200",
                                  "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30",
                                  "flex flex-col items-center justify-center cursor-pointer group py-6",
                                )}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (
                                    e.dataTransfer.files &&
                                    e.dataTransfer.files.length > 0
                                  ) {
                                    setDelegateAttachment(
                                      e.dataTransfer.files[0],
                                    );
                                    e.dataTransfer.clearData();
                                  }
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={() =>
                                  triggerFileInputClick(fileInputRef.current)
                                }
                              >
                                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                  تغيير الملف
                                </div>
                                <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                                  اسحب وأفلت أو اضغط للاختيار
                                </div>
                              </div>
                            </div>
                          ) : existingDelegateFileUrl ? (
                            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
                              <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                <div className="h-28 flex items-center justify-center">
                                  <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                    <FileText className="w-8 h-8 mb-1" />
                                    <span
                                      className="text-xs truncate max-w-[90%] text-center px-1"
                                      title={existingDelegateDisplayName}
                                    >
                                      {existingDelegateDisplayName}
                                    </span>
                                    <span className="text-[10px] opacity-70">
                                      {existingDelegateDisplayName
                                        .split(".")
                                        .pop()
                                        ?.toUpperCase() ?? "PDF"}
                                    </span>
                                  </div>
                                </div>
                                <div className="absolute top-1 right-1 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pdfName =
                                        existingDelegateDisplayName
                                          .toLowerCase()
                                          .endsWith(".pdf")
                                          ? existingDelegateDisplayName
                                          : `${existingDelegateDisplayName}.pdf`;
                                      openFileViewer({
                                        file: new File([], pdfName, {
                                          type: "application/pdf",
                                        }),
                                        previewUrl: existingDelegateFileUrl,
                                      });
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="عرض"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
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
                                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="إزالة"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.open(
                                        existingDelegateFileUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                    title="تحميل"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "w-full border-2 border-dashed rounded-lg transition-colors duration-200",
                                  "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30",
                                  "flex flex-col items-center justify-center cursor-pointer group py-6",
                                )}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (
                                    e.dataTransfer.files &&
                                    e.dataTransfer.files.length > 0
                                  ) {
                                    setDelegateAttachment(
                                      e.dataTransfer.files[0],
                                    );
                                    e.dataTransfer.clearData();
                                  }
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={() =>
                                  triggerFileInputClick(fileInputRef.current)
                                }
                              >
                                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                  استبدال الملف
                                </div>
                                <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                                  اسحب وأفلت أو اضغط للاختيار
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "w-full min-h-[75px] border-2 border-dashed rounded-lg transition-colors duration-200",
                                "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30",
                                "flex flex-col items-center justify-center cursor-pointer group",
                              )}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (
                                  e.dataTransfer.files &&
                                  e.dataTransfer.files.length > 0
                                ) {
                                  setDelegateAttachment(
                                    e.dataTransfer.files[0],
                                  );
                                  e.dataTransfer.clearData();
                                }
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={() =>
                                triggerFileInputClick(fileInputRef.current)
                              }
                            >
                              <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
                                <FileText className="w-5 h-5" />
                              </div>
                              <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                                اسحب وأفلت الملف هنا أو اضغط للاختيار
                              </p>
                              <p className="text-sm text-blue-500 dark:text-blue-500 mt-1 text-center">
                                PDF — حتى 35MB
                              </p>
                            </div>
                          )}
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
export default EmployeeOrganizationForm;
