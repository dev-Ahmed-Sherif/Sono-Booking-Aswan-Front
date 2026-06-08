"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Book,
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { operatingCompaniesSchema } from "@/schemas";
import {
  addOperatingCompany,
  deleteOperatingCompanyById,
  softDeleteOperatingCompanyById,
  updateOperatingCompanyById,
} from "@/actions/basic-data/operatingCompanyService";
import EmployeeOrganizationForm from "@/components/basic-data/employee-organization/employee-organization-form";
import EmployeeOrganizationClient from "@/components/basic-data/employee-organization/client";
import type { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";
import { ToastAction } from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import {
  fileToBase64,
  getFullFileUrl,
  type LocalFile,
} from "@/lib/file-viewer";
import { isImageFile } from "@/lib/image-file";

type FormProps = {
  initialData: unknown | null;
  name: string;
  staffData?: EmployeeOrganizationColumn[] | null;
  nationalitiesData?: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null;
};

type FormValues = Omit<
  z.infer<typeof operatingCompaniesSchema>,
  "commercialRegistrationAttachment"
> & { commercialRegistrationAttachment?: File };
type SaveResponse = {
  error?: string;
  message?: string;
  id?: string;
  data?: { id?: string; [key: string]: unknown } | string;
  [key: string]: unknown;
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

/** شاشة الأشتراطات: مسار من `public` أو URL كامل؛ يُعرض PDF في iframe والصور عبر الصورة. */
const REQUIREMENTS_MODAL_DOCUMENT_SRC = "/logo.jpeg";

function isPdfDocumentUrl(url: string): boolean {
  const path = url.trim().split("?")[0]?.split("#")[0] ?? "";
  return /\.pdf$/i.test(path);
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

/** Raw relative paths (before base URL) for counting attachments */
function getRawCommercialAttachmentPathStrings(initialData: unknown): string[] {
  if (!initialData || typeof initialData !== "object") return [];
  const d = initialData as Record<string, unknown>;
  const multi =
    d.commercialRegistrationAttachments ?? d.CommercialRegistrationAttachments;
  if (Array.isArray(multi)) {
    return multi
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((s) => s.trim().replace(/\\/g, "/"));
  }
  for (const k of [
    "commercialRegistrationAttachment",
    "commercialRegistrationAttachmentPath",
    "CommercialRegistrationAttachment",
  ] as const) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim().replace(/\\/g, "/");
      if (t.includes(",") || t.includes(";")) {
        return t
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [t];
    }
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      for (const pk of ["path", "filePath", "url", "attachmentPath"] as const) {
        const p = o[pk];
        if (typeof p === "string" && p.trim()) {
          return [p.trim().replace(/\\/g, "/")];
        }
      }
    }
  }
  return [];
}

/** Reads API string path e.g. `Organization/OperatingCompany/639....pdf` */
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

/** Server Actions cannot serialize `File` inside plain objects — use FormData for multipart. */
function buildOperatingCompanyFormData(
  values: FormValues,
  options?: { id?: string },
): FormData {
  const fd = new FormData();
  if (options?.id) {
    fd.append("id", options.id);
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (key === "commercialRegistrationAttachment") {
      if (value instanceof File) fd.append(key, value);
      continue;
    }
    if (value instanceof File) {
      fd.append(key, value);
    } else if (key === "commercialRegistrationNumber") {
      // Match API: numeric only, max 14 digits (backend: length less than 15)
      const digits = String(value).replace(/\D/g, "").slice(0, 14);
      fd.append(key, digits);
    } else {
      fd.append(key, String(value));
    }
  }
  return fd;
}

const OperatingCompaniesForm = ({
  initialData,
  name,
  staffData = null,
  nationalitiesData = null,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const [commercialFile, setCommercialFile] = useState<{
    file: File;
    previewUrl?: string;
  } | null>(null);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<LocalFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<
    "image" | "pdf" | "text"
  >("text");
  const [loadingContent, setLoadingContent] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const postUpdateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const data = initialData as {
    id?: string;
    code?: string;
    nameAr?: string;
    nameEn?: string;
    address?: string;
    nationalityId?: string;
    phone?: string;
    fax?: string;
    mobile?: string;
    email?: string;
    website?: string;
    commercialRegistrationNumber?: string;
    /** API may return a relative path string; create flow uses `File` only in form state */
    commercialRegistrationAttachment?: File | string;
    // isAccepted?: boolean;
  } | null;
  const initialCommercialPath = useMemo(
    () => commercialPathFromInitialData(initialData),
    [initialData],
  );
  const rawCommercialAttachmentPaths = useMemo(
    () => getRawCommercialAttachmentPathStrings(initialData),
    [initialData],
  );
  /** أيقونة الحذف للمرفقات المحفوظة فقط عند وجود أكثر من ملف؛ العرض متاح دائماً */
  const showServerAttachmentDeleteIcon =
    rawCommercialAttachmentPaths.length > 1;
  const [existingAttachmentRemoved, setExistingAttachmentRemoved] =
    useState(false);

  useEffect(() => {
    setExistingAttachmentRemoved(false);
  }, [initialData]);

  const validationSchema = useMemo(() => {
    const editId =
      initialData &&
      typeof initialData === "object" &&
      (initialData as { id?: unknown }).id != null &&
      String((initialData as { id?: unknown }).id) !== "new"
        ? String((initialData as { id: string }).id)
        : "";
    const isEdit = Boolean(editId);

    return operatingCompaniesSchema
      .omit({ commercialRegistrationAttachment: true })
      .extend({
        commercialRegistrationAttachment: z.any().optional(),
      })
      .superRefine((vals, ctx) => {
        const hasNewFile =
          vals.commercialRegistrationAttachment instanceof File;
        const keepServerFile =
          isEdit &&
          Boolean(initialCommercialPath) &&
          !existingAttachmentRemoved;
        if (!hasNewFile && !keepServerFile) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ملف السجل التجاري مطلوب",
            path: ["commercialRegistrationAttachment"],
          });
        }
      });
  }, [initialData, initialCommercialPath, existingAttachmentRemoved]);

  const locale = (params?.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/operating-companies`;
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
  const filteredNationalities = (nationalitiesData ?? []).filter((n) =>
    `${n.nameAr} ${n.nameEn ?? ""}`
      .toLowerCase()
      .includes(nationalitySearch.toLowerCase()),
  );

  const MAX_COMMERCIAL_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35MB
  const COMMERCIAL_ACCEPTED_MIME_TYPES = ["application/pdf"];

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      code: data?.code ?? undefined,
      nameAr: data?.nameAr || "",
      nameEn: data?.nameEn || "",
      address: data?.address || "",
      nationalityId: data?.nationalityId || "",
      phone: data?.phone || "",
      fax: data?.fax || "",
      mobile: data?.mobile || "",
      email: data?.email || "",
      // Keep optional fields undefined when empty.
      website: data?.website || undefined,
      commercialRegistrationNumber: data?.commercialRegistrationNumber || "",
      commercialRegistrationAttachment: undefined,
      // isAccepted: data?.isAccepted ?? false,
    },
  });

  useEffect(() => {
    return () => {
      clearPostUpdateIdleTimer();
      if (commercialFile?.previewUrl) {
        URL.revokeObjectURL(commercialFile.previewUrl);
      }
    };
  }, [commercialFile?.previewUrl]);

  const setCommercialAttachment = (file: File | null) => {
    if (commercialFile?.previewUrl)
      URL.revokeObjectURL(commercialFile.previewUrl);

    if (!file) {
      setCommercialFile(null);
      form.setValue("commercialRegistrationAttachment", undefined as never, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return;
    }

    const isAcceptedType = COMMERCIAL_ACCEPTED_MIME_TYPES.some((t) =>
      t.endsWith("/") ? file.type.startsWith(t) : file.type === t,
    );
    const isUnderLimit = file.size <= MAX_COMMERCIAL_FILE_SIZE_BYTES;

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
        description: "الحد الأقصى لحجم الملف 35 ميجابايت",
      });
      return;
    }

    const previewUrl = isImageFile(file)
      ? URL.createObjectURL(file)
      : undefined;
    setCommercialFile({ file, previewUrl });
    form.setValue("commercialRegistrationAttachment", file as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
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

  const existingCommercialFileUrl =
    initialCommercialPath && !existingAttachmentRemoved
      ? getFullFileUrl(initialCommercialPath)
      : null;
  const existingCommercialDisplayName =
    initialCommercialPath?.split("/").filter(Boolean).pop() ?? "file.pdf";

  const onSubmit = async (values: FormValues) => {
    try {
      toggleLoading();
      let savedId = "";
      if (data?.id) {
        const res = (await updateOperatingCompanyById(
          buildOperatingCompanyFormData(values, { id: data.id }),
        )) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        startPostUpdateIdleTimer();
      } else {
        const res = (await addOperatingCompany(
          buildOperatingCompanyFormData(values),
        )) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        savedId = extractIdFromResponse(res);
      }
      router.refresh();
      toast({ description: `🎉 ${toastMessage}` });
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
        duration: 10000,
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

  /** Re-save organization after مسؤولين add/update so the backend stays in sync with current form fields. */
  const syncOperatingCompanyAfterEmployeeChange = async () => {
    if (!data?.id) return;
    try {
      const values = form.getValues();
      const res = (await updateOperatingCompanyById(
        buildOperatingCompanyFormData(values, { id: data.id }),
      )) as SaveResponse;
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
        ? deleteOperatingCompanyById
        : softDeleteOperatingCompanyById;
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
        router.push(`/${params.locale}/basic-data/operating-companies`);
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
      router.push(
        `/${locale}/basic-data/operating-companies/${pendingSavedId}`,
      );
      setPendingSavedId("");
      return;
    }

    toast({
      variant: "destructive",
      description: "تم الحفظ ولكن تعذر فتح صفحة استكمال بيانات المسؤلين.",
      duration: 3000,
    });
    setPendingSavedId("");
    router.push(listBackPath);
  };

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
            <DialogTitle>استكمال بيانات المسؤلين</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            هل تريد استكمال بيانات المسؤلين الآن؟
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
          <TabsTrigger value="geha">الشركة</TabsTrigger>
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
              <div className="space-y-6">
                <section className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <h3 className="mb-4 text-base font-semibold">
                    البيانات الأساسية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
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
                          <FormLabel>الاسم بالعربية</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الاسم بالعربية"
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
                                  const isAllowed = /^[A-Za-z\s-]$/.test(e.key);
                                  if (!isAllowed) e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(
                                  /[^A-Za-z\s-]/g,
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
                                  aria-expanded={nationalityOpen}
                                  disabled={loading}
                                  className="w-full justify-between"
                                >
                                  {field.value
                                    ? ((nationalitiesData ?? []).find(
                                        (n) => n.id === field.value,
                                      )?.nameAr ?? "اختر الجنسية")
                                    : "اختر الجنسية"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[320px] p-2"
                                align="start"
                              >
                                <Input
                                  value={nationalitySearch}
                                  onChange={(e) =>
                                    setNationalitySearch(e.target.value)
                                  }
                                  placeholder="ابحث عن الجنسية..."
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
                    <div className="sm:col-span-2 xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <FormField
                        control={form.control}
                        name="commercialRegistrationNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>رقم السجل التجاري</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={loading}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="مثال: 1234567890123456 (أرقام فقط)"
                                onChange={(e) => {
                                  const digits = e.target.value
                                    .replace(/\D/g, "")
                                    .slice(0, 15);
                                  field.onChange(digits);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="commercialRegistrationAttachment"
                        render={({ field: { value: _value, ...rest } }) => (
                          <FormItem className="md:col-span-2">
                          <FormLabel>مرفق السجل التجاري</FormLabel>
                          <FormControl>
                            <div>
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
                                  setCommercialAttachment(file);
                                  e.target.value = "";
                                  restoreAfterPick();
                                }}
                              />
                              {commercialFile ? (
                                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
                                  <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                    {commercialFile.previewUrl ? (
                                      <Image
                                        src={commercialFile.previewUrl}
                                        alt="preview-commercial-registration-attachment"
                                        width={300}
                                        height={180}
                                        unoptimized
                                        className="w-full h-28 object-cover"
                                      />
                                    ) : (
                                      <div className="h-28 flex items-center justify-center">
                                        <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                          {(() => {
                                            const type = commercialFile.file.type;
                                            const Icon = isImageFile(
                                              commercialFile.file,
                                            )
                                              ? FileImage
                                              : type === "application/pdf"
                                                ? FileText
                                                : type ===
                                                      "application/msword" ||
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
                                              commercialFile.file.name
                                                .split(".")
                                                .pop()
                                                ?.toUpperCase() ?? "";
                                            return (
                                              <>
                                                <Icon className="w-8 h-8 mb-1" />
                                                <span
                                                  className="text-xs truncate max-w-[90%]"
                                                  title={
                                                    commercialFile.file.name
                                                  }
                                                >
                                                  {commercialFile.file.name}
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
                                            file: commercialFile.file,
                                            previewUrl:
                                              commercialFile.previewUrl,
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
                                            commercialFile.file,
                                          );
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = commercialFile.file.name;
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
                                          setCommercialAttachment(null);
                                          fileInputRef.current &&
                                            (fileInputRef.current.value = "");
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                        title="حذف"
                                      >
                                        <Trash className="w-4 h-4" />
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
                                        setCommercialAttachment(
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
                                      triggerFileInputClick(
                                        fileInputRef.current,
                                      )
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
                              ) : existingCommercialFileUrl ? (
                                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
                                  <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                    <div className="h-28 flex items-center justify-center">
                                      <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                        <FileText className="w-8 h-8 mb-1" />
                                        <span
                                          className="text-xs truncate max-w-[90%] text-center px-1"
                                          title={existingCommercialDisplayName}
                                        >
                                          {existingCommercialDisplayName}
                                        </span>
                                        <span className="text-[10px] opacity-70">
                                          {existingCommercialDisplayName
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
                                            existingCommercialDisplayName
                                              .toLowerCase()
                                              .endsWith(".pdf")
                                              ? existingCommercialDisplayName
                                              : `${existingCommercialDisplayName}.pdf`;
                                          openFileViewer({
                                            file: new File([], pdfName, {
                                              type: "application/pdf",
                                            }),
                                            previewUrl:
                                              existingCommercialFileUrl,
                                          });
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                        title="عرض"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      {showServerAttachmentDeleteIcon ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setExistingAttachmentRemoved(true);
                                            form.setValue(
                                              "commercialRegistrationAttachment",
                                              undefined as never,
                                              {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                              },
                                            );
                                            if (fileInputRef.current)
                                              fileInputRef.current.value = "";
                                          }}
                                          className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                          title="حذف"
                                        >
                                          <Trash className="w-4 h-4" />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          window.open(
                                            existingCommercialFileUrl,
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
                                        setCommercialAttachment(
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
                                      triggerFileInputClick(
                                        fileInputRef.current,
                                      )
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
                                      setCommercialAttachment(
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
                  </div>
                </section>

                <section className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h3 className="mb-4 text-base font-semibold">
                    وسائل الاتصال
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الموقع الإلكتروني</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="url"
                              placeholder="https://example.com"
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v.trim() === "" ? undefined : v);
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
                        <FormItem className="sm:col-span-2 lg:col-span-2">
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
                  </div>
                </section>

                {/* <section className="rounded-lg border border-sky-200/60 bg-sky-50/40 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                  <h3 className="mb-4 text-base font-semibold">الاشتراطات</h3>
                  <FormField
                    control={form.control}
                    name="isAccepted"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex flex-row items-center gap-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value ?? false}
                              onChange={(e) => field.onChange(e.target.checked)}
                              disabled={loading}
                              className="h-7 w-7 rounded border-input"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 flex-1 text-base leading-7">
                            تلتزم الشركة بكافة الاشتراطات البيئية، واشتراطات
                            السلامة وفقا للقوانين والقواعد السارية ذات الصلة
                            وذلك على جميع وحداتها العائمة في النيل
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded opacity-90 flex items-center gap-1"
                            onClick={() => setLogoModalOpen(true)}
                          >
                            <Book className="w-3 h-3" />
                            الأشتراطات
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section> */}
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
                  name="مسئول الشركة المشغلة"
                  organizationId={data.id}
                  defaultPhone={form.watch("phone") ?? ""}
                  hideBackButton
                  onSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncOperatingCompanyAfterEmployeeChange();
                    setAddEmployeeKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="mb-8 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h1 className="mb-4 text-2xl font-semibold text-center">
                  قائمة المسؤولين
                </h1>
                <EmployeeOrganizationClient
                  data={staffData ?? null}
                  onEditClick={(row) => {
                    clearPostUpdateIdleTimer();
                    setSelectedEmployee(row);
                    setEditEmployeeModalOpen(true);
                  }}
                  onDeleteSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncOperatingCompanyAfterEmployeeChange();
                  }}
                  showDelegateColumns={true}
                />
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
                        isDelegate: selectedEmployee.isDelegate ?? false,
                        delegateAttachment:
                          selectedEmployee.delegateAttachment ??
                          selectedEmployee.DelegateAttachment,
                      }}
                      name="مسئول الشركة المشغلة"
                      organizationId={data.id}
                      hideBackButton
                      onSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncOperatingCompanyAfterEmployeeChange();
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
      <Dialog open={logoModalOpen} onOpenChange={setLogoModalOpen}>
        <DialogContent
          className={
            isPdfDocumentUrl(REQUIREMENTS_MODAL_DOCUMENT_SRC)
              ? "max-w-5xl max-h-[90vh] overflow-hidden flex flex-col gap-2"
              : "max-w-md"
          }
        >
          <DialogHeader>
            <DialogTitle className="text-center">الأشتراطات</DialogTitle>
          </DialogHeader>
          {isPdfDocumentUrl(REQUIREMENTS_MODAL_DOCUMENT_SRC) ? (
            <iframe
              src={REQUIREMENTS_MODAL_DOCUMENT_SRC}
              className="min-h-[70vh] w-full flex-1 rounded-md border"
              title="الأشتراطات"
            />
          ) : (
            <div className="flex justify-center">
              <Image
                src={REQUIREMENTS_MODAL_DOCUMENT_SRC}
                alt="الأشتراطات"
                width={320}
                height={320}
                className="rounded-md object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default OperatingCompaniesForm;
