"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Calendar } from "@/components/ui/calendar";
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
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { cn } from "@/lib/utils";
import { maintenanceSchema } from "@/schemas";
import {
  addMaintenanceMultipart,
  deleteMaintenanceById,
  softDeleteMaintenanceById,
  updateMaintenanceMultipart,
} from "@/actions/operation/maintenanceService";
import { getMaintenanceTypes } from "@/actions/settings/maintenanceTypeService";
import { getFloatingUnits } from "@/actions/basic-data/floatingUnitService";
import { ToastAction } from "@radix-ui/react-toast";
import { getFullFileUrl } from "@/lib/file-viewer";

type MaintenanceFormProps = {
  initialData: unknown | null;
  name: string;
};

type MaintenanceFormValues = {
  id?: string;
  number?: string;
  maintenanceDate: Date;
  nextMaintenanceDate?: Date | null;
  maintenanceTypeId: string;
  floatingUnitId: string;
  maintenanceReport?: File;
  other?: File;
  notes?: string;
};

type Option = { id: string; nameAr: string };

type SaveResponse = {
  error?: string;
  message?: string;
  id?: string;
  data?: { id?: string; [key: string]: unknown } | string;
  [key: string]: unknown;
};

const ACCEPTED_PDF_MIME_TYPES = ["application/pdf"];

// Keep `number` validation relaxed here because the field is readonly
// and its edit value is sourced directly from backend initial data.
// `maintenanceReport`: optional `File` here; create flow adds “required” via `superRefine` + ref below.
const maintenanceFormBaseSchema = maintenanceSchema
  .partial({ number: true })
  .omit({ maintenanceReport: true })
  .extend({
    number: z.union([z.string(), z.number()]).optional(),
    maintenanceReport: z
      .instanceof(File, { message: "ملف تقرير الصيانة غير صالح" })
      .optional(),
  });

function readRecord(initial: unknown): Record<string, unknown> | null {
  if (!initial || typeof initial !== "object") return null;
  const rec = initial as Record<string, unknown>;
  const wrapped =
    rec.data ??
    rec.Data ??
    rec.item ??
    rec.Item ??
    rec.maintenance ??
    rec.Maintenance;
  if (wrapped && typeof wrapped === "object") {
    return wrapped as Record<string, unknown>;
  }
  return rec;
}

function str(rec: Record<string, unknown> | null, ...keys: string[]): string {
  if (!rec) return "";
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Backend may return a path string or an object with path/url fields (see table columns). */
function attachmentPathFromRecord(
  rec: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!rec) return "";
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      for (const inner of [
        "path",
        "filePath",
        "url",
        "attachmentPath",
        "Path",
        "FilePath",
        "Url",
        "AttachmentPath",
      ] as const) {
        const innerV = o[inner];
        if (typeof innerV === "string" && innerV.trim()) return innerV.trim();
      }
    }
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

function numOptional(
  rec: Record<string, unknown> | null,
  ...keys: string[]
): number | undefined {
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function idFromRecord(
  rec: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!rec) return "";
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const nested = v as Record<string, unknown>;
      const nestedId =
        (typeof nested.id === "string" && nested.id.trim()) ||
        (typeof nested.Id === "string" && nested.Id.trim()) ||
        "";
      if (nestedId) return nestedId;
    }
  }
  return "";
}

function dateFromRecord(
  rec: Record<string, unknown> | null,
  ...keys: string[]
): Date | undefined {
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}

function basename(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function formatDateForApi(d?: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function buildMaintenanceFormData(
  values: MaintenanceFormValues,
  existingId?: string,
): FormData {
  const fd = new FormData();
  const id = existingId || values.id;
  if (id) fd.append("id", id);
  if (
    values.number !== undefined &&
    values.number !== null &&
    String(values.number).trim() !== ""
  ) {
    fd.append("number", String(values.number).trim());
  }
  fd.append("maintenanceDate", formatDateForApi(values.maintenanceDate));
  if (values.nextMaintenanceDate) {
    fd.append(
      "nextMaintenanceDate",
      formatDateForApi(values.nextMaintenanceDate),
    );
  }
  fd.append("maintenanceTypeId", values.maintenanceTypeId);
  fd.append("floatingUnitId", values.floatingUnitId);
  if (values.maintenanceReport instanceof File) {
    fd.append("maintenanceReport", values.maintenanceReport);
  }
  if (values.other) fd.append("other", values.other);
  if (values.notes && values.notes.trim())
    fd.append("notes", values.notes.trim());
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

const MaintenanceForm = ({ initialData, name }: MaintenanceFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const user = useLocalStorage("user");
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [maintenanceTypeOptions, setMaintenanceTypeOptions] = useState<
    Option[]
  >([]);
  const [floatingUnitOptions, setFloatingUnitOptions] = useState<Option[]>([]);
  const [existingMaintenanceReportRemoved, setExistingMaintenanceReportRemoved] =
    useState(false);
  const [existingOtherRemoved, setExistingOtherRemoved] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingFileUrl, setViewingFileUrl] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");
  const [viewingObjectUrl, setViewingObjectUrl] = useState<string | null>(null);
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const fileInputRefs = useRef<{
    maintenanceReport: HTMLInputElement | null;
    other: HTMLInputElement | null;
  }>({
    maintenanceReport: null,
    other: null,
  });

  const rec = useMemo(
    () => readRecord((initialData as { data?: unknown })?.data ?? initialData),
    [initialData],
  );
  const resolvedId = str(rec, "id", "Id");
  const initialCodeRaw =
    str(
      rec,
      "code",
      "Code",
      "number",
      "Number",
      "maintenanceNumber",
      "MaintenanceNumber",
    ) ||
    ((): string => {
      const n = numOptional(
        rec,
        "number",
        "Number",
        "code",
        "Code",
        "maintenanceNumber",
        "MaintenanceNumber",
      );
      return n !== undefined ? String(n) : "";
    })();
  const initialCode = initialCodeRaw || "";
  const existingMaintenanceReportPath = attachmentPathFromRecord(
    rec,
    "maintenanceReport",
    "MaintenanceReport",
    "maintenanceReportPath",
    "MaintenanceReportPath",
  );
  const existingOtherPath = str(rec, "other", "Other");
  const activeExistingMaintenanceReportPath = existingMaintenanceReportRemoved
    ? ""
    : existingMaintenanceReportPath;
  const activeExistingOtherPath = existingOtherRemoved ? "" : existingOtherPath;
  const title = resolvedId ? `تعديل ${name}` : `حفظ ${name}`;
  const description = resolvedId ? "تعديل" : "حفظ جديد";
  const toastMessage = resolvedId ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = resolvedId ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/operation/maintenance`;
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;
  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);
  useEffect(() => {
    setExistingMaintenanceReportRemoved(false);
    setExistingOtherRemoved(false);
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (viewingObjectUrl) URL.revokeObjectURL(viewingObjectUrl);
    };
  }, [viewingObjectUrl]);

  const defaultValues = useMemo((): Partial<MaintenanceFormValues> => {
    if (!rec) {
      return {
        id: undefined,
        number: undefined,
        maintenanceDate: undefined,
        nextMaintenanceDate: null,
        maintenanceTypeId: "",
        floatingUnitId: "",
        maintenanceReport: undefined,
        other: undefined,
        notes: "",
      };
    }
    return {
      number: initialCode,
      id: resolvedId || undefined,
      maintenanceDate: dateFromRecord(
        rec,
        "maintenanceDate",
        "MaintenanceDate",
      ),
      nextMaintenanceDate:
        dateFromRecord(rec, "nextMaintenanceDate", "NextMaintenanceDate") ??
        null,
      maintenanceTypeId: idFromRecord(
        rec,
        "maintenanceTypeId",
        "MaintenanceTypeId",
        "maintenanceType",
        "MaintenanceType",
      ),
      floatingUnitId: idFromRecord(
        rec,
        "floatingUnitId",
        "FloatingUnitId",
        "floatingUnit",
        "FloatingUnit",
      ),
      maintenanceReport: undefined,
      other: undefined,
      notes: str(rec, "notes", "Notes"),
    };
  }, [initialCode, rec, resolvedId]);

  const isEditModeRef = useRef(false);
  isEditModeRef.current = Boolean(resolvedId);

  const maintenanceFormValidationSchema = useMemo(
    () =>
      maintenanceFormBaseSchema.superRefine((data, ctx) => {
        if (
          !isEditModeRef.current &&
          !(data.maintenanceReport instanceof File)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["maintenanceReport"],
            message: "تقرير الصيانة مطلوب",
          });
        }
      }),
    [],
  );

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormValidationSchema),
    defaultValues: defaultValues as MaintenanceFormValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues as MaintenanceFormValues);
  }, [defaultValues, form]);

  useEffect(() => {
    const loadOptions = async () => {
      const [typesRes, floatingUnitsRes] = await Promise.all([
        getMaintenanceTypes(),
        getFloatingUnits(),
      ]);

      const toOptions = (payload: unknown): Option[] => {
        if (!payload) return [];
        const raw = ((payload as { data?: unknown; Data?: unknown }).data ??
          (payload as { data?: unknown; Data?: unknown }).Data ??
          payload) as unknown;
        if (!Array.isArray(raw)) return [];
        const parsed: Option[] = [];
        const seen = new Set<string>();
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
          if (!id || !nameAr || seen.has(id)) continue;
          seen.add(id);
          parsed.push({ id, nameAr });
        }
        parsed.sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
        return parsed;
      };

      if (!typesRes || !(typesRes as { error?: string }).error) {
        setMaintenanceTypeOptions(toOptions(typesRes));
      }
      if (
        !floatingUnitsRes ||
        !(floatingUnitsRes as { error?: string }).error
      ) {
        setFloatingUnitOptions(toOptions(floatingUnitsRes));
      }
    };
    void loadOptions();
  }, []);
  const onSubmit = async (values: MaintenanceFormValues) => {
    try {
      toggleLoading();
      let targetId = resolvedId;
      const effectiveNumber = resolvedId ? initialCode : values.number;
      const payload: MaintenanceFormValues = {
        ...values,
        number: effectiveNumber,
      };
      if (
        resolvedId &&
        (payload.number === undefined ||
          payload.number === null ||
          String(payload.number).trim() === "")
      ) {
        throw new Error("رقم الصيانة غير متاح للتعديل");
      }
      const fd = buildMaintenanceFormData(payload, resolvedId);
      if (resolvedId) {
        const res = (await updateMaintenanceMultipart(fd)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
      } else {
        const res = (await addMaintenanceMultipart(fd)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
      }

      router.push(`/${locale}/operation/maintenance`);
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
        ? deleteMaintenanceById
        : softDeleteMaintenanceById;
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

  const reportValue = form.watch("maintenanceReport");
  const otherValue = form.watch("other");

  /** Pass `field.onChange` from `FormField` render so errors show under `FormMessage`. */
  const setPdfFileField = (
    name: "maintenanceReport" | "other",
    file: File | null,
    write?: (file: File | undefined) => void,
  ) => {
    const commit = (next: File | undefined) => {
      if (write) {
        write(next);
      } else {
        form.setValue(name, next as never, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });
      }
    };

    if (!file) {
      commit(undefined);
      return;
    }

    const isAcceptedType =
      ACCEPTED_PDF_MIME_TYPES.includes(file.type) ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isAcceptedType) {
      toast({
        variant: "destructive",
        description: "يُسمح فقط بملفات PDF",
      });
      return;
    }

    commit(file);
  };

  const downloadFromUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadLocalFile = (file: File) => {
    const url = URL.createObjectURL(file);
    downloadFromUrl(url, file.name);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openFileViewerFromLocal = (file: File) => {
    if (viewingObjectUrl) URL.revokeObjectURL(viewingObjectUrl);
    const nextUrl = URL.createObjectURL(file);
    setViewingObjectUrl(nextUrl);
    setViewingFileUrl(nextUrl);
    setViewingFileName(file.name);
    setViewerOpen(true);
  };

  const openFileViewerFromPath = (path: string) => {
    if (viewingObjectUrl) {
      URL.revokeObjectURL(viewingObjectUrl);
      setViewingObjectUrl(null);
    }
    const fullUrl = getFullFileUrl(path) || "";
    setViewingFileUrl(fullUrl);
    setViewingFileName(basename(path) || "عرض الملف");
    setViewerOpen(true);
  };

  const handleViewerOpenChange = (nextOpen: boolean) => {
    setViewerOpen(nextOpen);
    if (!nextOpen) {
      if (viewingObjectUrl) URL.revokeObjectURL(viewingObjectUrl);
      setViewingObjectUrl(null);
      setViewingFileUrl("");
      setViewingFileName("");
    }
  };

  return (
    <>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="number"
                  render={() => (
                    <FormItem>
                      <FormLabel>رقم الصيانة</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          disabled={true}
                          readOnly
                          placeholder="رقم الصيانة"
                          value={initialCode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maintenanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الصيانة</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-between text-right font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                              dir="rtl"
                              disabled={loading}
                            >
                              <span>
                                {field.value instanceof Date &&
                                !Number.isNaN(field.value.getTime())
                                  ? format(field.value, "PPP", {
                                      locale: dateFnsLocale,
                                    })
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
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={dateFnsLocale}
                            disabled={(date) =>
                              date > maxSelectableDate ||
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
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextMaintenanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الصيانة القادم (اختياري)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-between text-right font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                              dir="rtl"
                              disabled={loading}
                            >
                              <span>
                                {field.value instanceof Date &&
                                !Number.isNaN(field.value.getTime())
                                  ? format(field.value, "PPP", {
                                      locale: dateFnsLocale,
                                    })
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
                            selected={field.value ?? undefined}
                            onSelect={(date) => field.onChange(date ?? null)}
                            locale={dateFnsLocale}
                            disabled={(date) =>
                              date > maxSelectableDate ||
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
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="maintenanceTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع الصيانة</FormLabel>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value ? field.value : undefined}
                        dir="rtl"
                      >
                        <FormControl>
                          <SelectTrigger className="text-right [&>span]:w-full [&>span]:text-right">
                            <SelectValue placeholder="اختر نوع الصيانة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="text-right" dir="rtl">
                          {maintenanceTypeOptions.map((option) => (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              className="text-right"
                            >
                              {option.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="floatingUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوحدة العائمة</FormLabel>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value ? field.value : undefined}
                        dir="rtl"
                      >
                        <FormControl>
                          <SelectTrigger className="text-right [&>span]:w-full [&>span]:text-right">
                            <SelectValue placeholder="اختر الوحدة العائمة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="text-right" dir="rtl">
                          {floatingUnitOptions.map((option) => (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              className="text-right"
                            >
                              {option.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>ملاحظات</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={loading}
                        placeholder="ملاحظات"
                        rows={4}
                        className="min-h-[100px] resize-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-lg border p-4 sm:p-6 space-y-6">
            <h3 className="text-base sm:text-lg font-semibold">المرفقات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maintenanceReport"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>تقرير الصيانة</FormLabel>
                    <FormControl>
                      <div
                        className={cn(
                          "space-y-2",
                          fieldState.error &&
                            "rounded-md ring-2 ring-destructive ring-offset-2 ring-offset-background",
                        )}
                      >
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={(el) => {
                            field.ref(el);
                            fileInputRefs.current.maintenanceReport = el;
                          }}
                          disabled={loading}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPdfFileField(
                              "maintenanceReport",
                              file,
                              field.onChange,
                            );
                            e.target.value = "";
                            restoreAfterPick();
                          }}
                        />
                        {reportValue instanceof File ||
                        activeExistingMaintenanceReportPath ? (
                          <div className="flex flex-col gap-2">
                            <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                              <div className="h-24 flex items-center justify-center">
                                <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                  <FileText className="w-8 h-8 mb-1" />
                                  <span className="text-xs truncate max-w-[90%] text-center px-1">
                                    {reportValue instanceof File
                                      ? reportValue.name
                                      : basename(activeExistingMaintenanceReportPath)}
                                  </span>
                                  <span className="text-[10px] opacity-70">PDF</span>
                                </div>
                              </div>
                              <div className="absolute top-1 right-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    reportValue instanceof File
                                      ? openFileViewerFromLocal(reportValue)
                                      : openFileViewerFromPath(
                                          activeExistingMaintenanceReportPath || "",
                                        )
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                  title="عرض"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    reportValue instanceof File
                                      ? downloadLocalFile(reportValue)
                                      : downloadFromUrl(
                                          getFullFileUrl(
                                            activeExistingMaintenanceReportPath || "",
                                          ) || "",
                                          basename(activeExistingMaintenanceReportPath),
                                        )
                                  }
                                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                  title="تحميل"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (reportValue instanceof File) {
                                      setPdfFileField(
                                        "maintenanceReport",
                                        null,
                                        field.onChange,
                                      );
                                    } else {
                                      setExistingMaintenanceReportRemoved(true);
                                      field.onChange(undefined);
                                    }
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
                                "flex flex-col items-center justify-center cursor-pointer group py-4 min-h-[72px]",
                                loading && "pointer-events-none opacity-60",
                              )}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (loading) return;
                                if (
                                  e.dataTransfer.files &&
                                  e.dataTransfer.files.length > 0
                                ) {
                                  setPdfFileField(
                                    "maintenanceReport",
                                    e.dataTransfer.files[0],
                                    field.onChange,
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
                                  fileInputRefs.current.maintenanceReport,
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
                              loading && "pointer-events-none opacity-60",
                            )}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (loading) return;
                              if (
                                e.dataTransfer.files &&
                                e.dataTransfer.files.length > 0
                              ) {
                                setPdfFileField(
                                  "maintenanceReport",
                                  e.dataTransfer.files[0],
                                  field.onChange,
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
                                fileInputRefs.current.maintenanceReport,
                              )
                            }
                          >
                            <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
                              <FileText className="w-5 h-5" />
                            </div>
                            <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                              اسحب وأفلت الملف هنا أو اضغط للاختيار
                            </p>
                            <p className="text-sm text-blue-500 dark:text-blue-500 mt-1 text-center">
                              PDF فقط
                            </p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="other"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>مرفق إضافي (اختياري)</FormLabel>
                    <FormControl>
                      <div
                        className={cn(
                          "space-y-2",
                          fieldState.error &&
                            "rounded-md ring-2 ring-destructive ring-offset-2 ring-offset-background",
                        )}
                      >
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={(el) => {
                            field.ref(el);
                            fileInputRefs.current.other = el;
                          }}
                          disabled={loading}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPdfFileField("other", file, field.onChange);
                            e.target.value = "";
                            restoreAfterPick();
                          }}
                        />
                        {otherValue instanceof File || activeExistingOtherPath ? (
                          <div className="flex flex-col gap-2">
                            <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                              <div className="h-24 flex items-center justify-center">
                                <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                                  <FileText className="w-8 h-8 mb-1" />
                                  <span className="text-xs truncate max-w-[90%] text-center px-1">
                                    {otherValue instanceof File
                                      ? otherValue.name
                                      : basename(activeExistingOtherPath)}
                                  </span>
                                  <span className="text-[10px] opacity-70">PDF</span>
                                </div>
                              </div>
                              <div className="absolute top-1 right-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    otherValue instanceof File
                                      ? openFileViewerFromLocal(otherValue)
                                      : openFileViewerFromPath(
                                          activeExistingOtherPath || "",
                                        )
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                  title="عرض"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    otherValue instanceof File
                                      ? downloadLocalFile(otherValue)
                                      : downloadFromUrl(
                                          getFullFileUrl(activeExistingOtherPath || "") || "",
                                          basename(activeExistingOtherPath),
                                        )
                                  }
                                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                  title="تحميل"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (otherValue instanceof File) {
                                      setPdfFileField("other", null, field.onChange);
                                    } else {
                                      setExistingOtherRemoved(true);
                                      field.onChange(undefined);
                                    }
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
                                "flex flex-col items-center justify-center cursor-pointer group py-4 min-h-[72px]",
                                loading && "pointer-events-none opacity-60",
                              )}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (loading) return;
                                if (
                                  e.dataTransfer.files &&
                                  e.dataTransfer.files.length > 0
                                ) {
                                  setPdfFileField(
                                    "other",
                                    e.dataTransfer.files[0],
                                    field.onChange,
                                  );
                                  e.dataTransfer.clearData();
                                }
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={() =>
                                triggerFileInputClick(fileInputRefs.current.other)
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
                              loading && "pointer-events-none opacity-60",
                            )}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (loading) return;
                              if (
                                e.dataTransfer.files &&
                                e.dataTransfer.files.length > 0
                              ) {
                                setPdfFileField(
                                  "other",
                                  e.dataTransfer.files[0],
                                  field.onChange,
                                );
                                e.dataTransfer.clearData();
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={() =>
                              triggerFileInputClick(fileInputRefs.current.other)
                            }
                          >
                            <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
                              <FileText className="w-5 h-5" />
                            </div>
                            <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                              اسحب وأفلت الملف هنا أو اضغط للاختيار
                            </p>
                            <p className="text-sm text-blue-500 dark:text-blue-500 mt-1 text-center">
                              PDF فقط
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
      <Dialog open={viewerOpen} onOpenChange={handleViewerOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {viewingFileName || "عرض الملف"}
            </DialogTitle>
          </DialogHeader>
          {viewingFileUrl ? (
            <iframe
              src={viewingFileUrl}
              className="w-full h-[70vh] rounded-md border"
              title={viewingFileName || "pdf-preview"}
            />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              لا يمكن عرض هذا الملف.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MaintenanceForm;
