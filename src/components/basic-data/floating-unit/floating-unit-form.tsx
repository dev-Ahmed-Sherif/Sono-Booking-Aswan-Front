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
  CalendarIcon,
  Eye,
  Loader2,
  Trash,
} from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
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
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { floatingUnitSchema } from "@/schemas";
import { buildFloatingUnitFormData } from "@/actions/basic-data/floatingUnitFormData";
import {
  addFloatingUnit,
  deleteFloatingUnitById,
  softDeleteFloatingUnitById,
  updateFloatingUnitById,
} from "@/actions/basic-data/floatingUnitService";
import { getFloatingUnitOrganizations } from "@/actions/basic-data/floatingUnitOrganizationService";
import { getOperatingCompanies } from "@/actions/basic-data/operatingCompanyService";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { getFloatingUnitStaffs } from "@/actions/basic-data/floatingUnitStaffService";
import { getFloatingUnitTypes } from "@/actions/settings/floatingUnitTypeService";
import FloatingUnitOrganizationForm from "@/components/basic-data/floating-unit-organization/floating-unit-organization-form";
import FloatingUnitOrganizationClient from "@/components/basic-data/floating-unit-organization/client";
import type { FloatingUnitOrganizationColumn } from "@/components/basic-data/floating-unit-organization/columns";
import { resolveFloatingUnitOwnerOrganizationCategoryId } from "@/lib/floating-unit-owner-organization-category";
import {
  filterFloatingUnitOrganizationsBySource,
  mapApiListToFloatingUnitOrganizationColumns,
} from "@/lib/floating-unit-organization-map";
import FloatingUnitStaffForm from "@/components/basic-data/floating-unit-staff/floating-unit-staff-form";
import FloatingUnitStaffClient from "@/components/basic-data/floating-unit-staff/client";
import type { FloatingUnitStaffColumn } from "@/components/basic-data/floating-unit-staff/columns";
import { ToastAction } from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { getFullFileUrl } from "@/lib/file-viewer";
import type { FloatingUnitFormValues } from "@/actions/basic-data/floatingUnitService";
import type { NumericLookupRow } from "@/lib/numeric-lookup";

type FormProps = {
  initialData: unknown | null;
  name: string;
  floatingUnitStaffData?: FloatingUnitStaffColumn[] | null;
  floatingUnitOrganizationData?: FloatingUnitOrganizationColumn[] | null;
  nationalitiesData?: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null;
  gendersData?: NumericLookupRow[] | null;
  idTypesData?: NumericLookupRow[] | null;
};

type FormValues = z.infer<typeof floatingUnitSchema>;

type MolakOrgSelectOption = { id: string; nameAr: string };

function unwrapApiDataArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const top = (payload as { data?: unknown }).data;
    if (Array.isArray(top)) return top;
    if (
      top &&
      typeof top === "object" &&
      Array.isArray((top as { data?: unknown }).data)
    ) {
      return (top as { data: unknown[] }).data;
    }
  }
  return [];
}

function mapOrganizationsToSelectOptions(raw: unknown): MolakOrgSelectOption[] {
  const arr = unwrapApiDataArray(raw);
  return arr
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : "",
      nameAr:
        (typeof x.nameAr === "string" && x.nameAr.trim()) ||
        (typeof x.nameEn === "string" && x.nameEn.trim()) ||
        "",
    }))
    .filter((o) => o.id && o.nameAr);
}

type SaveResponse = {
  error?: string;
  message?: string;
  id?: string;
  data?: { id?: string; [key: string]: unknown } | string;
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

const REQUIREMENTS_MODAL_DOCUMENT_SRC = "/logo.jpeg";

function isPdfDocumentUrl(url: string): boolean {
  const path = url.trim().split("?")[0]?.split("#")[0] ?? "";
  return /\.pdf$/i.test(path);
}

function imagePathFromInitial(initialData: unknown): string | null {
  if (!initialData || typeof initialData !== "object") return null;
  const d = initialData as Record<string, unknown>;
  const raw = d.imageUrl ?? d.ImageUrl;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function manufactureYearFromData(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/^\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})/);
  return m ? m[1] : s.slice(0, 4);
}

function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** First finite number from API fields; `undefined` so empty new rows fail required checks. */
function numberFromData(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s === "") continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Missing/empty API values → `undefined` so zod `required_error` runs (avoids coercing to 0). */
function numericFieldFromData(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s === "") continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const FloatingUnitForm = ({
  initialData,
  name,
  floatingUnitStaffData = null,
  floatingUnitOrganizationData = null,
  nationalitiesData = null,
  gendersData = null,
  idTypesData = null,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? "ar";
  const isRtl = locale === "ar" || locale.startsWith("ar-");
  const listBackPath = `/${locale}/basic-data/floating-unit`;
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;

  const data = initialData as Record<string, unknown> | null;
  const unitId = data && typeof data.id === "string" ? data.id : undefined;

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [staffPromptOpen, setStaffPromptOpen] = useState(false);
  const [pendingSavedId, setPendingSavedId] = useState("");
  const [activeTab, setActiveTab] = useState("geha");
  const [addStaffKey, setAddStaffKey] = useState(0);
  const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] =
    useState<FloatingUnitStaffColumn | null>(null);
  const [unitTypes, setUnitTypes] = useState<{ id: string; nameAr: string }[]>(
    [],
  );
  const [imageFile, setImageFile] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [existingImageRemoved, setExistingImageRemoved] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const postUpdateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const userStorage = useLocalStorage("user");
  const isSuperAdmin = isSuperAdminRoleCandidates(
    userStorage.getItem() as RoleCandidates,
  );

  const [staffRows, setStaffRows] = useState<FloatingUnitStaffColumn[]>(
    floatingUnitStaffData ?? [],
  );
  const [organizationRows, setOrganizationRows] = useState<
    FloatingUnitOrganizationColumn[]
  >(floatingUnitOrganizationData ?? []);
  const [addOrgKey1, setAddOrgKey1] = useState(0);
  const [addOrgKey2, setAddOrgKey2] = useState(0);
  const [editOrgModalOpen, setEditOrgModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] =
    useState<FloatingUnitOrganizationColumn | null>(null);
  const [molakOwnersFull, setMolakOwnersFull] = useState<
    MolakOrgSelectOption[]
  >([]);
  const [molakOperatingFull, setMolakOperatingFull] = useState<
    MolakOrgSelectOption[]
  >([]);

  useEffect(() => {
    setStaffRows(floatingUnitStaffData ?? []);
  }, [floatingUnitStaffData]);

  useEffect(() => {
    setOrganizationRows(floatingUnitOrganizationData ?? []);
  }, [floatingUnitOrganizationData]);

  /** One batched fetch for molak tab selects; avoids duplicate server actions from two forms. */
  useEffect(() => {
    if (activeTab !== "molak" || !unitId) return;
    let cancelled = false;
    const load = async () => {
      const floatingUnitCategoryId =
        await resolveFloatingUnitOwnerOrganizationCategoryId();
      const ownsPromise = floatingUnitCategoryId
        ? getOwningCompanies(floatingUnitCategoryId, "OwnerCompany")
        : getOwningCompanies(undefined, "OwnerCompany");
      const [ownsRes, opsRes] = await Promise.all([
        ownsPromise,
        getOperatingCompanies("OperatingCompany"),
      ]);
      if (cancelled) return;
      if (
        (ownsRes as { error?: string })?.error ||
        (opsRes as { error?: string })?.error
      ) {
        return;
      }
      setMolakOwnersFull(
        mapOrganizationsToSelectOptions(
          (ownsRes as { data?: unknown }).data ?? ownsRes,
        ),
      );
      setMolakOperatingFull(
        mapOrganizationsToSelectOptions(
          (opsRes as { data?: unknown }).data ?? opsRes,
        ),
      );
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, unitId]);

  const ownerOrganizationRows = useMemo(
    () => filterFloatingUnitOrganizationsBySource(organizationRows, "owner"),
    [organizationRows],
  );
  const operatingOrganizationRows = useMemo(
    () =>
      filterFloatingUnitOrganizationsBySource(organizationRows, "operating"),
    [organizationRows],
  );

  const molakOwnerSelectOptions = useMemo(() => {
    const linked = new Set(
      ownerOrganizationRows
        .map((r) => r.organizationId?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    return molakOwnersFull.filter((o) => !linked.has(o.id));
  }, [molakOwnersFull, ownerOrganizationRows]);

  const molakOperatingSelectOptions = useMemo(() => {
    const linked = new Set(
      operatingOrganizationRows
        .map((r) => r.organizationId?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    return molakOperatingFull.filter((o) => !linked.has(o.id));
  }, [molakOperatingFull, operatingOrganizationRows]);

  const staffLookups = useMemo(
    () => ({
      genders: gendersData,
      idTypes: idTypesData,
    }),
    [gendersData, idTypesData],
  );

  const initialImagePath = useMemo(
    () => imagePathFromInitial(initialData),
    [initialData],
  );

  useEffect(() => {
    setExistingImageRemoved(false);
  }, [initialData]);

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

  useEffect(() => {
    return () => clearPostUpdateIdleTimer();
  }, []);

  const editId =
    initialData &&
    typeof initialData === "object" &&
    (initialData as { id?: unknown }).id != null &&
    String((initialData as { id?: unknown }).id) !== "new"
      ? String((initialData as { id: string }).id)
      : "";
  const isEdit = Boolean(editId);

  const validationSchema = useMemo(
    () =>
      floatingUnitSchema
        .omit({ imageUrl: true, isAccepted: true })
        .extend({
          imageUrl: z.any().optional(),
          isAccepted: z.boolean().optional(),
        })
        .superRefine((vals, ctx) => {
          const hasNewFile = vals.imageUrl instanceof File;
          const keepServerFile =
            isEdit && Boolean(initialImagePath) && !existingImageRemoved;
          if (!hasNewFile && !keepServerFile) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "صورة الوحدة مطلوبة",
              path: ["imageUrl"],
            });
          }
          if (vals.isAccepted !== true) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "يجب الموافقة على الاشتراطات",
              path: ["isAccepted"],
            });
          }
        }),
    [isEdit, initialImagePath, existingImageRemoved],
  );

  const title = unitId ? `تعديل ${name}` : `حفظ ${name}`;
  const description = unitId ? "تعديل" : "حفظ جديد";
  const toastMessage = unitId ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = unitId ? "تعديل" : "حفظ";

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      id: unitId,
      code: (data?.code as string) || (data?.Code as string) || "",
      nameAr: (data?.nameAr as string) || (data?.NameAr as string) || "",
      nameEn: (data?.nameEn as string) || (data?.NameEn as string) || "",
      licenseNumber:
        (data?.licenseNumber as string) ||
        (data?.LicenseNumber as string) ||
        "",
      length: numberFromData(data?.length, data?.Length),
      width: numberFromData(data?.width, data?.Width),
      passengerNumber: numberFromData(
        data?.passengerNumber,
        data?.PassengerNumber,
      ),
      roomNumber: numberFromData(data?.roomNumber, data?.RoomNumber),
      manufactureYear: manufactureYearFromData(
        data?.manufactureYear ?? data?.ManufactureYear,
      ),
      lastMaintenanceDate: parseOptionalDate(
        data?.lastMaintenanceDate ?? data?.LastMaintenanceDate,
      ),
      nextMaintenanceDate: parseOptionalDate(
        data?.nextMaintenanceDate ?? data?.NextMaintenanceDate,
      ),
      unitTypeId:
        (data?.unitTypeId as string) || (data?.UnitTypeId as string) || "",
      imageUrl: undefined,
      isAccepted: Boolean(data?.isAccepted ?? data?.IsAccepted ?? false),
    } as FormValues,
  });

  useEffect(() => {
    const loadTypes = async () => {
      const res = await getFloatingUnitTypes();
      if (!res || (res as { error?: string }).error) return;
      const raw = (res as { data?: unknown }).data ?? res;
      if (!Array.isArray(raw)) return;
      setUnitTypes(
        raw
          .map((x) => x as Record<string, unknown>)
          .map((x) => ({
            id: String(x.id ?? ""),
            nameAr:
              (typeof x.nameAr === "string" && x.nameAr) ||
              (typeof x.nameEn === "string" && x.nameEn) ||
              "",
          }))
          .filter((x) => x.id && x.nameAr),
      );
    };
    void loadTypes();
  }, []);

  const imagePreviewUrl = imageFile?.previewUrl ?? null;
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const setImageAttachment = (file: File | null) => {
    if (imageFile?.previewUrl) URL.revokeObjectURL(imageFile.previewUrl);
    if (!file) {
      setImageFile(null);
      form.setValue("imageUrl", undefined, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", description: "يُسمح فقط بملفات الصور" });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setExistingImageRemoved(false);
    setImageFile({ file, previewUrl });
    form.setValue("imageUrl", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const existingImageDisplayUrl =
    initialImagePath && !existingImageRemoved
      ? getFullFileUrl(initialImagePath)
      : null;

  const syncFloatingUnitAfterStaffChange = async () => {
    if (!unitId) return;
    const payload: FloatingUnitFormValues = {
      ...form.getValues(),
      imageUrl: imageFile?.file ?? form.getValues("imageUrl"),
      id: unitId,
    };
    const fd = buildFloatingUnitFormData(payload);
    const res = await updateFloatingUnitById(fd);
    if (res?.error) {
      toast({
        variant: "destructive",
        description: String((res as { message?: string }).message || res.error),
      });
    }
  };

  const syncStaff = async () => {
    if (!unitId) return;
    await syncFloatingUnitAfterStaffChange();
    const result = await getFloatingUnitStaffs(unitId);
    if (result && !(result as { error?: string }).error) {
      const raw = (result as { data?: unknown }).data ?? result;
      setStaffRows(
        Array.isArray(raw) ? (raw as FloatingUnitStaffColumn[]) : [],
      );
    }
  };

  const syncOrganizations = async () => {
    if (!unitId) return;
    await syncFloatingUnitAfterStaffChange();
    const result = await getFloatingUnitOrganizations(unitId);
    if (result && !(result as { error?: string }).error) {
      const raw = (result as { data?: unknown }).data ?? result;
      setOrganizationRows(mapApiListToFloatingUnitOrganizationColumns(raw));
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (activeTab !== "geha") return;
    if (submitLockRef.current) return;
    try {
      submitLockRef.current = true;
      toggleLoading();
      const payload: FloatingUnitFormValues = {
        ...values,
        imageUrl: imageFile?.file ?? values.imageUrl,
        id: unitId,
      };
      const fd = buildFloatingUnitFormData(payload);
      if (unitId) {
        const res = await updateFloatingUnitById(fd);
        if (res?.error) throw new Error((res as { message?: string }).message);
        startPostUpdateIdleTimer();
      } else {
        const res = (await addFloatingUnit(fd)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        const savedId = extractIdFromResponse(res);
        setPendingSavedId(savedId);
        setStaffPromptOpen(true);
      }
      router.refresh();
      toast({ description: `🎉 ${toastMessage}` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ مجهول";
      toast({
        variant: "destructive",
        duration: 10000,
        title: "حدث خطأ !",
        description:
          (
            err as {
              response?: {
                status?: number | string;
                data?: { status?: number | string; message?: string };
              };
              status?: number | string;
              data?: { status?: number | string; message?: string };
            }
          ).response?.status === 409 ||
          (
            err as {
              response?: {
                status?: number | string;
                data?: { status?: number | string; message?: string };
              };
              status?: number | string;
              data?: { status?: number | string; message?: string };
            }
          ).status === 409 ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).response?.status ?? "",
          )
            .toLowerCase()
            .includes("conflict") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).status ?? "",
          )
            .toLowerCase()
            .includes("conflict") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).response?.data?.status ?? "",
          )
            .toLowerCase()
            .includes("conflict") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).data?.status ?? "",
          )
            .toLowerCase()
            .includes("conflict") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).response?.status ?? "",
          ).includes("409") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).status ?? "",
          ).includes("409") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).response?.data?.status ?? "",
          ).includes("409") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).data?.status ?? "",
          ).includes("409") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).response?.data?.message ?? "",
          )
            .toLowerCase()
            .includes("duplicated") ||
          String(
            (
              err as {
                response?: {
                  status?: number | string;
                  data?: { status?: number | string; message?: string };
                };
                status?: number | string;
                data?: { status?: number | string; message?: string };
              }
            ).data?.message ?? "",
          )
            .toLowerCase()
            .includes("duplicated") ||
          String(errorMessage).includes("409") ||
          String(errorMessage).toLowerCase().includes("conflict") ||
          String(errorMessage).toLowerCase().includes("code 409") ||
          String(errorMessage).toLowerCase().includes("duplicated")
            ? `❌ ${toastMessageError}`
            : `❌ ${errorMessage}`,
        action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
      });
    } finally {
      toggleLoading();
      submitLockRef.current = false;
    }
  };

  const onDelete = async () => {
    if (!unitId) return;
    try {
      toggleLoading();
      const deleteFn = isSuperAdmin
        ? deleteFloatingUnitById
        : softDeleteFloatingUnitById;
      const result = await deleteFn(unitId);
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
        description: isSuperAdmin
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

  const onSkipStaff = () => {
    clearPostUpdateIdleTimer();
    setStaffPromptOpen(false);
    setPendingSavedId("");
    router.push(listBackPath);
  };

  const onCompleteStaff = () => {
    clearPostUpdateIdleTimer();
    setStaffPromptOpen(false);
    if (unitId) return;
    if (pendingSavedId) {
      router.push(`/${locale}/basic-data/floating-unit/${pendingSavedId}`);
      setPendingSavedId("");
      return;
    }
    toast({
      variant: "destructive",
      description: "تم الحفظ ولكن تعذر فتح صفحة استكمال بيانات الطاقم.",
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
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      <Dialog
        open={staffPromptOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onSkipStaff();
            return;
          }
          setStaffPromptOpen(true);
        }}
      >
        <DialogContent className="max-w-md" onPointerDownOutside={onSkipStaff}>
          <DialogHeader>
            <DialogTitle>استكمال بيانات طاقم الوحدة</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            هل تريد استكمال بيانات طاقم الوحدة العائمة الآن؟
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSkipStaff}>
              لا
            </Button>
            <Button type="button" onClick={onCompleteStaff}>
              نعم
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(listBackPath)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>

      <div className="my-6 flex items-center justify-between">
        <Heading title={title} description={description} />
        {unitId && (
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
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === "masoolin" || v === "molak") clearPostUpdateIdleTimer();
        }}
        className="w-full mt-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <TabsList className="grid w-full max-w-3xl grid-cols-3 gap-1">
          <TabsTrigger type="button" value="geha">
            الوحدة العائمة
          </TabsTrigger>
          <TabsTrigger type="button" value="masoolin" disabled={!unitId}>
            طاقم الوحدة
          </TabsTrigger>
          <TabsTrigger type="button" value="molak" disabled={!unitId}>
            الملاك والمشغلين
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
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 lg:order-1">
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
                                  disabled={loading}
                                  placeholder="الكود"
                                  autoComplete="off"
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
                                  placeholder="الاسم بالعربية"
                                  onKeyDown={(e) => {
                                    if (
                                      (
                                        e as unknown as {
                                          isComposing?: boolean;
                                        }
                                      ).isComposing
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
                                      if (!/^[\u0600-\u06FF\s-]$/.test(e.key))
                                        e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    field.onChange(
                                      e.target.value.replace(
                                        /[0-9]|[^ \u0600-\u06FF-]/g,
                                        "",
                                      ),
                                    );
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
                                  placeholder="الاسم بالإنجليزية"
                                  onKeyDown={(e) => {
                                    if (
                                      (
                                        e as unknown as {
                                          isComposing?: boolean;
                                        }
                                      ).isComposing
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
                                      if (!/^[A-Za-z\s-]$/.test(e.key))
                                        e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    field.onChange(
                                      e.target.value.replace(
                                        /[^A-Za-z\s-]/g,
                                        "",
                                      ),
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="unitTypeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>نوع الوحدة</FormLabel>
                              <Select
                                dir={isRtl ? "rtl" : "ltr"}
                                disabled={loading}
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر النوع" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {unitTypes.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.nameAr}
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
                          name="licenseNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>رقم الترخيص</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  className="text-center"
                                  maxLength={10}
                                  inputMode="numeric"
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 10),
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="length"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الطول بالمتر</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  inputMode="decimal"
                                  step="any"
                                  min={0}
                                  className="text-center"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    field.onChange(v as unknown as any);
                                  }}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="width"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>العرض بالمتر</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  inputMode="decimal"
                                  step="any"
                                  min={0}
                                  className="text-center"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    field.onChange(v as unknown as any);
                                  }}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="passengerNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>عدد الركاب</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="text-center"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                      field.onChange(undefined);
                                      return;
                                    }
                                    const n = Number.parseInt(v, 10);
                                    field.onChange(
                                      Number.isNaN(n) ? undefined : n,
                                    );
                                  }}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="roomNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>عدد الغرف</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="text-center"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                      field.onChange(undefined);
                                      return;
                                    }
                                    const n = Number.parseInt(v, 10);
                                    field.onChange(
                                      Number.isNaN(n) ? undefined : n,
                                    );
                                  }}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="manufactureYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>سنة الصنع</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  className="text-center"
                                  maxLength={4}
                                  inputMode="numeric"
                                  placeholder="YYYY"
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 4),
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-1 lg:order-2">
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({
                          field: { value: _v, onChange: _oc, ...rest },
                        }) => (
                          <FormItem>
                            <FormLabel>صورة الوحدة</FormLabel>
                            <FormControl>
                              <div>
                                <input
                                  {...rest}
                                  ref={(el) => {
                                    rest.ref(el);
                                    fileInputRef.current = el;
                                  }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={loading}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null;
                                    setImageAttachment(f);
                                    e.target.value = "";
                                    restoreAfterPick();
                                  }}
                                />
                                {imageFile ? (
                                  <div className="relative rounded-md border overflow-hidden w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={imageFile.previewUrl}
                                      alt=""
                                      className="h-64 w-full object-contain bg-white"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setViewerOpen(true)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setImageAttachment(null);
                                          setExistingImageRemoved(true);
                                          if (fileInputRef.current)
                                            fileInputRef.current.value = "";
                                        }}
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : existingImageDisplayUrl ? (
                                  <div className="relative rounded-md border overflow-hidden w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={existingImageDisplayUrl}
                                      alt=""
                                      className="h-64 w-full object-contain bg-white"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setViewerOpen(true)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setExistingImageRemoved(true);
                                          form.setValue("imageUrl", undefined, {
                                            shouldValidate: true,
                                          });
                                        }}
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      "w-full min-h-[256px] border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center py-8",
                                      "border-violet-300 bg-violet-50/50 dark:bg-violet-950/20",
                                    )}
                                    onClick={() =>
                                      triggerFileInputClick(
                                        fileInputRef.current,
                                      )
                                    }
                                  >
                                    <p className="text-violet-700">
                                      اضغط لاختيار صورة
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
                  <h3 className="mb-4 text-base font-semibold">الصيانة</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="lastMaintenanceDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>آخر صيانة</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={loading}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    isRtl && "text-right",
                                  )}
                                >
                                  <CalendarIcon className="ml-2 h-4 w-4" />
                                  {field.value
                                    ? format(field.value, "PPP", {
                                        locale: dateFnsLocale,
                                      })
                                    : "اختر التاريخ"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 z-[10002]"
                              align="end"
                              dir={isRtl ? "rtl" : "ltr"}
                            >
                              <Calendar
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={field.onChange}
                                locale={dateFnsLocale}
                                initialFocus
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
                        <FormItem className="flex flex-col">
                          <FormLabel>الصيانة القادمة</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={loading}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    isRtl && "text-right",
                                  )}
                                >
                                  <CalendarIcon className="ml-2 h-4 w-4" />
                                  {field.value
                                    ? format(field.value, "PPP", {
                                        locale: dateFnsLocale,
                                      })
                                    : "اختر التاريخ"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 z-[10002]"
                              align="end"
                              dir={isRtl ? "rtl" : "ltr"}
                            >
                              <Calendar
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={field.onChange}
                                locale={dateFnsLocale}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-sky-200/60 bg-sky-50/40 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
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
                            تلتزم الوحدة العائمة بكافة الاشتراطات البيئية،
                            واشتراطات السلامة وفقاً للقوانين والقواعد السارية
                            ذات الصلة
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
                </section>
              </div>

              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-center h-11 min-w-32 px-6"
                  data-submit-intent="save-floating-unit"
                >
                  {loading && <Loader2 className="h-6 w-6" />}
                  {action}
                </Button>
              </div>
            </form>
          </Form>

          <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>معاينة الصورة</DialogTitle>
              </DialogHeader>
              {imageFile?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageFile.previewUrl}
                  alt=""
                  className="max-h-[70vh] mx-auto object-contain"
                />
              ) : existingImageDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingImageDisplayUrl}
                  alt=""
                  className="max-h-[70vh] mx-auto object-contain"
                />
              ) : null}
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
        </TabsContent>

        <TabsContent value="masoolin" className="space-y-6 mt-4 text-start">
          {activeTab === "masoolin" && unitId ? (
            <>
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <FloatingUnitStaffForm
                  key={addStaffKey}
                  initialData={null}
                  name="عضو طاقم الوحدة"
                  floatingUnitId={unitId}
                  nationalitiesData={nationalitiesData}
                  gendersData={gendersData}
                  idTypesData={idTypesData}
                  hideBackButton
                  onSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncStaff();
                    setAddStaffKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="mb-8 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h1 className="mb-4 text-2xl font-semibold text-center">
                  قائمة طاقم الوحدة العائمة
                </h1>
                <FloatingUnitStaffClient
                  data={staffRows}
                  lookups={staffLookups}
                  onEditClick={(row) => {
                    clearPostUpdateIdleTimer();
                    setSelectedStaff(row);
                    setEditStaffModalOpen(true);
                  }}
                  onDeleteSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncStaff();
                  }}
                />
              </div>
              <Dialog
                open={editStaffModalOpen}
                onOpenChange={setEditStaffModalOpen}
              >
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="my-7">
                    <DialogTitle />
                  </DialogHeader>
                  {selectedStaff && (
                    <FloatingUnitStaffForm
                      key={selectedStaff.id}
                      initialData={{
                        id: selectedStaff.id,
                        name: selectedStaff.name,
                        job: selectedStaff.job,
                        mobile: selectedStaff.mobile,
                        email: selectedStaff.email,
                        gender: selectedStaff.gender,
                        idType: selectedStaff.idType,
                        identity: selectedStaff.identity,
                        nationalityId: selectedStaff.nationalityId,
                        isDelegate: selectedStaff.isDelegate,
                        delegateAttachment:
                          selectedStaff.delegateAttachment ??
                          selectedStaff.DelegateAttachment,
                      }}
                      name="عضو طاقم الوحدة"
                      floatingUnitId={unitId}
                      nationalitiesData={nationalitiesData}
                      gendersData={gendersData}
                      idTypesData={idTypesData}
                      hideBackButton
                      onSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncStaff();
                        setEditStaffModalOpen(false);
                        setSelectedStaff(null);
                      }}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="molak" className="space-y-6 mt-4 text-start">
          {activeTab === "molak" && unitId ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
                  <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <h2 className="mb-3 text-lg font-semibold text-center">
                      الملاك
                    </h2>
                    <FloatingUnitOrganizationForm
                      key={addOrgKey1}
                      initialData={null}
                      name="ربط مالك بالوحدة"
                      organizationSource="owner"
                      organizationOptions={molakOwnerSelectOptions}
                      floatingUnitId={unitId}
                      lockFloatingUnitId
                      hideBackButton
                      onSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncOrganizations();
                        setAddOrgKey1((k) => k + 1);
                      }}
                    />
                  </div>
                  <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <h2 className="mb-4 text-lg font-semibold text-center">
                      قائمة الملاك المرتبطين
                    </h2>
                    <FloatingUnitOrganizationClient
                      data={ownerOrganizationRows}
                      floatingUnitId={unitId}
                      onEditClick={(row) => {
                        clearPostUpdateIdleTimer();
                        setSelectedOrg(row);
                        setEditOrgModalOpen(true);
                      }}
                      onDeleteSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncOrganizations();
                      }}
                    />
                  </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
                  <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <h2 className="mb-3 text-lg font-semibold text-center">
                      المشغلين
                    </h2>
                    <FloatingUnitOrganizationForm
                      key={addOrgKey2}
                      initialData={null}
                      name="ربط مشغل بالوحدة"
                      organizationSource="operating"
                      organizationOptions={molakOperatingSelectOptions}
                      floatingUnitId={unitId}
                      lockFloatingUnitId
                      hideBackButton
                      onSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncOrganizations();
                        setAddOrgKey2((k) => k + 1);
                      }}
                    />
                  </div>
                  <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <h2 className="mb-4 text-lg font-semibold text-center">
                      قائمة المشغلين المرتبطين
                    </h2>
                    <FloatingUnitOrganizationClient
                      data={operatingOrganizationRows}
                      floatingUnitId={unitId}
                      onEditClick={(row) => {
                        clearPostUpdateIdleTimer();
                        setSelectedOrg(row);
                        setEditOrgModalOpen(true);
                      }}
                      onDeleteSuccess={async () => {
                        clearPostUpdateIdleTimer();
                        await syncOrganizations();
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FloatingUnitForm;
