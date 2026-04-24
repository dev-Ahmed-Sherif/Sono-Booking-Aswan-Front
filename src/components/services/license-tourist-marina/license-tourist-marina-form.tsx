"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarIcon,
  Download,
  Eye,
  FileText,
  Loader2,
  Trash,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import useToggleState from "@/hooks/use-toggle-state";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import {
  licenseTouristMarinaSchema,
  type LicenseTouristMarinaFormValues,
} from "@/schemas";
import {
  addLicenseApplicationMultipart,
  deleteLicenseApplicationById,
  softDeleteLicenseApplicationById,
  updateLicenseApplicationMultipart,
} from "@/actions/services/touristMarinaLicenseApplicationService";
import { getOperatingCompanies } from "@/actions/basic-data/operatingCompanyService";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { getOrganizationCategories } from "@/actions/settings/organizationCategoryService";
import { getPartiesOfficials } from "@/actions/basic-data/partiesOfficialService";
import { ToastAction } from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import {
  fileToBase64,
  getFullFileUrl,
  type LocalFile,
} from "@/lib/file-viewer";

type LicenseTouristMarinaFormProps = {
  initialData: unknown | null;
  name: string;
};

type OrgOption = { id: string; nameAr: string };

type SaveResponse = {
  error?: string;
  message?: string;
  id?: string;
  data?: { id?: string; [key: string]: unknown } | string;
  [key: string]: unknown;
};

const FILE_FIELDS: {
  name: keyof Pick<
    LicenseTouristMarinaFormValues,
    | "insurance"
    | "commercialRegister"
    | "taxes"
    | "civilProtection"
    | "irrigation"
    | "stateProperty"
  >;
  label: string;
}[] = [
  { name: "insurance", label: "التأمين" },
  { name: "commercialRegister", label: "السجل التجاري" },
  { name: "taxes", label: "الضرائب" },
  { name: "civilProtection", label: "الحماية المدنية" },
  { name: "irrigation", label: "الري" },
  { name: "stateProperty", label: "أملاك الدولة" },
];

type LicenseAttachmentFieldName =
  | (typeof FILE_FIELDS)[number]["name"]
  | "other";

const PDF_ACCEPT_MIME = ["application/pdf"] as const;
const MAX_LICENSE_PDF_BYTES = 35 * 1024 * 1024;

function readRecord(initial: unknown): Record<string, unknown> | null {
  if (!initial || typeof initial !== "object") return null;
  return initial as Record<string, unknown>;
}

function str(rec: Record<string, unknown> | null, ...keys: string[]): string {
  if (!rec) return "";
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function num(rec: Record<string, unknown> | null, ...keys: string[]): number {
  if (!rec) return 0;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** `yyyy-MM-dd` for `<input type="date" />` and `DateOnly` form binding. */
function dateOnlyInputFromRecord(
  rec: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!rec) return "";
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) {
      const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const y = v.getUTCFullYear();
      const mo = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
  }
  return "";
}

function basename(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function extractIdFromResponse(res: SaveResponse): string {
  if (typeof res.id === "string" && res.id) return res.id;
  if (typeof res.data === "string" && res.data) return res.data;
  if (res.data && typeof res.data === "object" && "id" in res.data) {
    const nestedId = (res.data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) return nestedId;
  }
  return "";
}

function buildLicenseApplicationFormData(
  values: LicenseTouristMarinaFormValues,
  existingId?: string,
): FormData {
  const fd = new FormData();
  const id = existingId || values.id;
  if (id) fd.append("id", id);
  fd.append("licenseNumber", values.licenseNumber);
  fd.append("licenseDate", values.licenseDate);
  fd.append("licenseNote", values.licenseNote ?? "");
  fd.append("fromOrganizationId", values.fromOrganizationId);
  fd.append("toOrganizationId", values.toOrganizationId);
  fd.append("touristMarinaNumber", String(values.touristMarinaNumber));
  fd.append("sendMail", values.sendMail ? "true" : "false");
  if (values.status) fd.append("status", values.status);

  const keys = [
    "insurance",
    "commercialRegister",
    "taxes",
    "civilProtection",
    "irrigation",
    "stateProperty",
    "other",
  ] as const;
  for (const key of keys) {
    const v = values[key];
    if (v instanceof File) fd.append(key, v);
  }
  return fd;
}

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

const LicenseTouristMarinaForm = ({
  initialData,
  name,
}: LicenseTouristMarinaFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const user = useLocalStorage("user");
  const isSuperAdmin = isSuperAdminRoleCandidates(
    user.getItem() as RoleCandidates,
  );
  const currentUserOrganizationId = useMemo(() => {
    const stored = user.getItem() as { organizationId?: string | null } | undefined;
    return typeof stored?.organizationId === "string" ? stored.organizationId : "";
  }, [user]);
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [fromOrgOptions, setFromOrgOptions] = useState<OrgOption[]>([]);
  const fileInputRefs = useRef<
    Partial<Record<LicenseAttachmentFieldName, HTMLInputElement | null>>
  >({});
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<LocalFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<
    "image" | "pdf" | "text"
  >("text");
  const [loadingContent, setLoadingContent] = useState(false);

  const rec = useMemo(() => readRecord(initialData), [initialData]);
  const resolvedId = str(rec, "id", "Id");
  const title = resolvedId ? `تعديل ${name}` : `حفظ ${name}`;
  const description = resolvedId ? "تعديل" : "حفظ جديد";
  const toastMessage = resolvedId ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = resolvedId ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/services/license-tourist-marina`;
  const isRtl = locale === "ar" || locale.startsWith("ar-");
  const dateFnsLocale = isRtl ? ar : enUS;
  const currentYear = new Date().getFullYear();

  const defaultValues = useMemo((): LicenseTouristMarinaFormValues => {
    if (!rec) {
      return {
        id: undefined,
        licenseNumber: "",
        licenseDate: "",
        licenseNote: "",
        insurance: undefined,
        commercialRegister: undefined,
        taxes: undefined,
        civilProtection: undefined,
        irrigation: undefined,
        stateProperty: undefined,
        other: undefined,
        fromOrganizationId: "",
        toOrganizationId: "",
        touristMarinaNumber: undefined as unknown as number,
        sendMail: false,
        status: "pending",
      } as LicenseTouristMarinaFormValues;
    }
    return {
      id: resolvedId || undefined,
      licenseNumber: str(rec, "licenseNumber", "LicenseNumber"),
      licenseDate: dateOnlyInputFromRecord(rec, "licenseDate", "LicenseDate"),
      licenseNote: str(rec, "licenseNote", "LicenseNote", "text", "Text"),
      insurance: str(
        rec,
        "insurance",
        "Insurance",
      ) as LicenseTouristMarinaFormValues["insurance"],
      commercialRegister: str(
        rec,
        "commercialRegister",
        "CommercialRegister",
      ) as LicenseTouristMarinaFormValues["commercialRegister"],
      taxes: str(
        rec,
        "taxes",
        "Taxes",
      ) as LicenseTouristMarinaFormValues["taxes"],
      civilProtection: str(
        rec,
        "civilProtection",
        "CivilProtection",
      ) as LicenseTouristMarinaFormValues["civilProtection"],
      irrigation: str(
        rec,
        "irrigation",
        "Irrigation",
      ) as LicenseTouristMarinaFormValues["irrigation"],
      stateProperty: str(
        rec,
        "stateProperty",
        "StateProperty",
      ) as LicenseTouristMarinaFormValues["stateProperty"],
      other: (() => {
        const o = str(rec, "other", "Other");
        return o || undefined;
      })() as LicenseTouristMarinaFormValues["other"],
      fromOrganizationId: str(rec, "fromOrganizationId", "FromOrganizationId"),
      toOrganizationId: str(rec, "toOrganizationId", "ToOrganizationId"),
      touristMarinaNumber: num(
        rec,
        "touristMarinaNumber",
        "TouristMarinaNumber",
      ),
      sendMail: false,
      status: (() => {
        const s = str(rec, "status", "Status").toLowerCase();
        if (s === "needcompelete") return "NeedCompelete";
        if (s === "approved") return "Approved";
        return "pending";
      })() as LicenseTouristMarinaFormValues["status"],
    } as LicenseTouristMarinaFormValues;
  }, [rec, resolvedId]);

  const form = useForm<LicenseTouristMarinaFormValues>({
    resolver: zodResolver(licenseTouristMarinaSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    if (!isSuperAdmin && currentUserOrganizationId && !form.getValues("fromOrganizationId")) {
      form.setValue("fromOrganizationId", currentUserOrganizationId, {
        shouldValidate: true,
      });
    }
  }, [isSuperAdmin, currentUserOrganizationId, form]);

  useEffect(() => {
    const extractOrgOptions = (res: unknown): OrgOption[] => {
      if (!res || (res as { error?: string }).error) return [];
      const raw = ((res as { data?: unknown }).data ?? res) as unknown;
      if (!Array.isArray(raw)) return [];
      const out: OrgOption[] = [];
      for (const row of raw) {
        const x = row as Record<string, unknown>;
        const id =
          (typeof x.id === "string" && x.id) ||
          (typeof x.Id === "string" && x.Id) ||
          "";
        const nameAr =
          (typeof x.nameAr === "string" && x.nameAr.trim()) ||
          (typeof x.NameAr === "string" && x.NameAr.trim()) ||
          (typeof x.nameEn === "string" && x.nameEn.trim()) ||
          (typeof x.NameEn === "string" && x.NameEn.trim()) ||
          "";
        if (id && nameAr) out.push({ id, nameAr });
      }
      return out;
    };

    const normalize = (s: string) =>
      s.trim().replace(/[\u0622\u0623\u0625]/g, "\u0627").replace(/\s+/g, " ");

    const load = async () => {
      // toOrganizationId — filter GovernmentCompany orgs to "أدارة المراسى السياحية"
      const govRes = await getPartiesOfficials("GovernmentCompany");
      const allGov = extractOrgOptions(govRes);
      const toOrgs = allGov.filter((o) =>
        normalize(o.nameAr).includes("مراسى") ||
        normalize(o.nameAr).includes("مراسي"),
      );
      toOrgs.sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
      const resolvedToOrgs = toOrgs.length ? toOrgs : allGov;
      setOrgOptions(resolvedToOrgs);
      if (resolvedToOrgs.length > 0 && !form.getValues("toOrganizationId")) {
        form.setValue("toOrganizationId", resolvedToOrgs[0].id, {
          shouldValidate: true,
        });
      }

      // fromOrganizationId — owner companies of the "مراسى" category
      const catRes = await getOrganizationCategories();
      const categories = extractOrgOptions(catRes) as Array<{
        id: string;
        nameAr: string;
      }>;
      const marinaCategory = categories.find((c) =>
        normalize(c.nameAr).includes("مراسى") ||
        normalize(c.nameAr).includes("مراسي"),
      );
      if (marinaCategory) {
        const marinaOwnersRes = await getOwningCompanies(
          marinaCategory.id,
          "OwnerCompany",
        );
        const marinaOwners = extractOrgOptions(marinaOwnersRes);
        marinaOwners.sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
        setFromOrgOptions(marinaOwners);
      }
    };
    void load();
  }, []);

  const setAttachmentFile = (
    name: LicenseAttachmentFieldName,
    file: File | null,
  ) => {
    if (!file) {
      form.setValue(
        name as keyof LicenseTouristMarinaFormValues,
        undefined as never,
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      return;
    }
    const isAcceptedType = PDF_ACCEPT_MIME.some((t) =>
      t.endsWith("/") ? file.type.startsWith(t) : file.type === t,
    );
    const isPdfByName = file.name.toLowerCase().endsWith(".pdf");
    if (!isAcceptedType && !isPdfByName) {
      toast({
        variant: "destructive",
        description: "يُسمح فقط بملفات PDF",
      });
      return;
    }
    if (file.size > MAX_LICENSE_PDF_BYTES) {
      toast({
        variant: "destructive",
        description: "الحد الأقصى لحجم الملف 35 ميجابايت",
      });
      return;
    }
    form.setValue(name as keyof LicenseTouristMarinaFormValues, file as never, {
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

  const onSubmit = async (values: LicenseTouristMarinaFormValues) => {
    try {
      toggleLoading();
      const fd = buildLicenseApplicationFormData(values, resolvedId);
      if (resolvedId) {
        const res = (await updateLicenseApplicationMultipart(
          fd,
        )) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
      } else {
        const res = (await addLicenseApplicationMultipart(fd)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        const newId = extractIdFromResponse(res);
        if (newId) {
          router.push(`/${locale}/services/license-tourist-marina/${newId}`);
        }
      }
      router.refresh();
      toast({ description: `🎉 ${toastMessage}` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        duration: 10000,
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
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteLicenseApplicationById
        : softDeleteLicenseApplicationById;
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
      toggleOpen();
      toggleLoading();
      setTimeout(() => {
        router.push(listBackPath);
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

  const renderPdfAttachment = (
    name: LicenseAttachmentFieldName,
    label: string,
    opts?: { optional?: boolean },
  ) => {
    const optional = opts?.optional === true;
    return (
      <FormField
        key={name}
        control={form.control}
        name={name as keyof LicenseTouristMarinaFormValues}
        render={({ field: { value, ...rest } }) => {
          const isFile = value instanceof File;
          const pathStr =
            typeof value === "string" && value.trim() ? value.trim() : "";
          const existingUrl = pathStr
            ? (getFullFileUrl(pathStr) ?? pathStr)
            : "";
          const displayName = isFile
            ? (value as File).name
            : pathStr
              ? basename(pathStr)
              : "";
          const emptyDropZone = (
            fileInput: HTMLInputElement | null | undefined,
          ) => (
            <div
              className={cn(
                "w-full min-h-[75px] border-2 border-dashed rounded-lg transition-colors duration-200",
                "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30",
                "flex flex-col items-center justify-center cursor-pointer group",
              )}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length) {
                  setAttachmentFile(name, e.dataTransfer.files[0]);
                  e.dataTransfer.clearData();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => triggerFileInputClick(fileInput ?? null)}
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
          );

          const swapDropZone = (
            fileInput: HTMLInputElement | null | undefined,
            mode: "change" | "replace",
          ) => (
            <div
              className={cn(
                "w-full border-2 border-dashed rounded-lg transition-colors duration-200",
                "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30",
                "flex flex-col items-center justify-center cursor-pointer group py-6",
              )}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length) {
                  setAttachmentFile(name, e.dataTransfer.files[0]);
                  e.dataTransfer.clearData();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => triggerFileInputClick(fileInput ?? null)}
            >
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                {mode === "change" ? "تغيير الملف" : "استبدال الملف"}
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                اسحب وأفلت أو اضغط للاختيار
              </div>
            </div>
          );

          const extLabel = displayName.split(".").pop()?.toUpperCase() ?? "PDF";

          const previewCard = (
            <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
              <div className="h-28 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                  <FileText className="w-8 h-8 mb-1" />
                  <span
                    className="text-xs truncate max-w-[90%] text-center px-1"
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <span className="text-[10px] opacity-70">{extLabel}</span>
                </div>
              </div>
              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isFile) {
                      void openFileViewer({ file: value as File });
                    } else if (existingUrl) {
                      const pdfName = displayName.toLowerCase().endsWith(".pdf")
                        ? displayName
                        : `${displayName || "file"}.pdf`;
                      void openFileViewer({
                        file: new File([], pdfName, {
                          type: "application/pdf",
                        }),
                        previewUrl: existingUrl,
                      });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                  title="عرض"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isFile) {
                      const url = URL.createObjectURL(value as File);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = (value as File).name;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } else if (existingUrl) {
                      window.open(existingUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                  title="تحميل"
                >
                  <Download className="w-4 h-4" />
                </button>
                {(optional && (isFile || pathStr)) || (isFile && !optional) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentFile(name, null);
                      const el = fileInputRefs.current[name];
                      if (el) el.value = "";
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                    title="حذف"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </div>
          );

          return (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <div>
                  <input
                    {...rest}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    ref={(el) => {
                      rest.ref(el);
                      fileInputRefs.current[name] = el;
                    }}
                    disabled={loading}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setAttachmentFile(name, file);
                      e.target.value = "";
                      restoreAfterPick();
                    }}
                  />
                  {isFile || pathStr ? (
                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
                      {previewCard}
                      {swapDropZone(
                        fileInputRefs.current[name],
                        isFile ? "change" : "replace",
                      )}
                    </div>
                  ) : (
                    emptyDropZone(fileInputRefs.current[name])
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    );
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(isRtl ? "text-right" : "text-left")}
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
      <div className="my-6 flex items-center justify-between">
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
          className="space-y-8 w-full mt-6"
        >
          <section className="rounded-lg border p-4 sm:p-6 space-y-6">
            <h3 className="text-base sm:text-lg font-semibold">
              البيانات الأساسية
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم الترخيص</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly={true}
                          disabled={true}
                          placeholder="رقم الترخيص"
                          className={
                            resolvedId
                              ? "cursor-not-allowed bg-muted/60 opacity-90"
                              : undefined
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseDate"
                  render={({ field }) => {
                    const dateValue = field.value
                      ? new Date(field.value)
                      : undefined;
                    return (
                      <FormItem>
                        <FormLabel>تاريخ الترخيص</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                disabled={loading}
                                className={cn(
                                  "w-full justify-between text-right font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                                dir="rtl"
                              >
                                <span>
                                  {dateValue && !Number.isNaN(dateValue.getTime())
                                    ? format(dateValue, "PPP", { locale: dateFnsLocale })
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
                              selected={dateValue}
                              onSelect={(date) =>
                                field.onChange(
                                  date ? format(date, "yyyy-MM-dd") : "",
                                )
                              }
                              locale={dateFnsLocale}
                              disabled={(date) =>
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
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="touristMarinaNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عدد المراسي السياحية</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          disabled={loading}
                          placeholder="عدد المراسي السياحية"
                          value={
                            field.value === undefined || field.value === null
                              ? ""
                              : field.value
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            field.onChange(
                              raw === "" ? undefined : Number(raw),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isSuperAdmin && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الحالة</FormLabel>
                        <Select
                          disabled={loading}
                          onValueChange={field.onChange}
                          value={field.value ?? "pending"}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الحالة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">جارى المراجعة</SelectItem>
                            <SelectItem value="NeedCompelete">مطلوب الإستكمال</SelectItem>
                            <SelectItem value="Approved">مقبول</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={form.control}
                name="licenseNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات الترخيص</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={loading}
                        placeholder="ملاحظات الترخيص"
                        rows={4}
                        className="min-h-[100px] resize-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="fromOrganizationId"
                  render={({ field }) => {
                    const isDisabled = !isSuperAdmin;
                    const selectedOrg = fromOrgOptions.find(
                      (o) => o.id === field.value,
                    );
                    const displayName =
                      selectedOrg?.nameAr ??
                      (field.value ? field.value : "");
                    return (
                      <FormItem>
                        <FormLabel>الجهة المرسلة</FormLabel>
                        <Select
                          disabled={loading || isDisabled}
                          onValueChange={isDisabled ? undefined : field.onChange}
                          value={field.value ? field.value : undefined}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger
                              className={
                                isDisabled
                                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="اختر الجهة">
                                {isDisabled ? displayName : undefined}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fromOrgOptions.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="toOrganizationId"
                  render={({ field }) => {
                    const selectedOrg = orgOptions.find(
                      (o) => o.id === field.value,
                    );
                    return (
                      <FormItem>
                        <FormLabel>الجهة المستلمة</FormLabel>
                        <Select
                          disabled
                          value={field.value ? field.value : undefined}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="bg-muted text-muted-foreground cursor-not-allowed">
                              <SelectValue placeholder="جارى التحميل...">
                                {selectedOrg?.nameAr ?? ""}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orgOptions.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name="sendMail"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-input"
                        checked={field.value === true}
                        onChange={(e) => field.onChange(e.target.checked)}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">
                      إرسال بريد إلكتروني
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-lg border p-4 sm:p-6 space-y-6">
            <h3 className="text-base sm:text-lg font-semibold">المرفقات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FILE_FIELDS.map(({ name, label }) =>
                renderPdfAttachment(name, label),
              )}
              {renderPdfAttachment("other", "مرفقات أخرى (اختياري)", {
                optional: true,
              })}
            </div>
          </section>

          <div className="flex justify-center">
            <Button
              disabled={loading}
              className="text-center h-11 min-w-32 px-6"
              type="submit"
            >
              {loading && <Loader2 className="h-6 w-6 mr-2 animate-spin" />}
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
    </div>
  );
};

export default LicenseTouristMarinaForm;
