"use client";

import { useParams, useRouter } from "next/navigation";
import { FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarIcon, Loader2, Trash } from "lucide-react";
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
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { cn } from "@/lib/utils";
import { inspectionSchema, type InspectionFormValues } from "@/schemas";
import {
  addInspectionMultipart,
  deleteInspectionById,
  softDeleteInspectionById,
  updateInspectionMultipart,
} from "@/actions/inspection/inspectionService";
import { ToastAction } from "@radix-ui/react-toast";

import {
  getPartiesOfficials,
  getPartiesOfficialById,
} from "@/actions/basic-data/partiesOfficialService";
import { getInspectionClauses } from "@/actions/inspection/inspectionClauseService";

type LookupItem = { id: string; nameAr?: string; name?: string };
type StoredUser = { organizationId?: string | null; role?: string | null };
type InspectionClauseItem = {
  id?: string;
  isInspected: boolean;
  number?: string;
  note?: string;
  inspectionClauseId: string;
  inspectionId?: string;
  inspectionClauseCode?: string;
  inspectionClauseName?: string;
};

const sortClauseRowsByCode = (rows: InspectionClauseItem[]) =>
  [...rows].sort((a, b) =>
    (a.inspectionClauseCode ?? "").localeCompare(
      b.inspectionClauseCode ?? "",
      "ar",
    ),
  );

type InspectionFormProps = {
  initialData: any | null;
  floatingUnits?: LookupItem[];
  inspectionFloatingUnitClauses?: InspectionClauseItem[];
  inspectionTypeName?: string;
  basePath?: string;
};

const InspectionForm = ({
  initialData,
  floatingUnits = [],
  inspectionFloatingUnitClauses = [],
  inspectionTypeName = "",
  basePath = "/inspections/inspection",
}: InspectionFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);

  const user = useLocalStorage("user");
  const [organizationOptions, setOrganizationOptions] = useState<LookupItem[]>(
    [],
  );
  const [clauseRows, setClauseRows] = useState<InspectionClauseItem[]>([]);
  const [clauseSearch, setClauseSearch] = useState("");
  const [clauseTableError, setClauseTableError] = useState("");
  const [editedClauseIndices, setEditedClauseIndices] = useState<Set<number>>(
    new Set(),
  );
  const [editingClauseIndex, setEditingClauseIndex] = useState<number | null>(
    null,
  );
  const [clauseDraft, setClauseDraft] = useState<InspectionClauseItem | null>(
    null,
  );
  const locale = (params?.locale as string) ?? "ar";
  const inspectionTypeId = (params?.typeId as string) ?? "";
  const isRtl = locale === "ar";
  const dateFnsLocale = isRtl ? ar : enUS;
  const normalizedInspectionTypeName = inspectionTypeName
    .trim()
    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا");
  const showEnvironmentalFields =
    normalizedInspectionTypeName === "تفتيش بيئي" ||
    normalizedInspectionTypeName === "تفتيش بيئى";
  const storedUser = useMemo(
    () => (user.getItem() as StoredUser | undefined) ?? undefined,
    [user],
  );

  const currentUserOrganizationId = useMemo(() => {
    const organizationId = storedUser?.organizationId;
    return typeof organizationId === "string" ? organizationId : "";
  }, [storedUser]);

  const isSuperAdmin = useMemo(
    () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
    [user],
  );

  const title = initialData ? "تعديل تفتيش" : "حفظ تفتيش";
  const description = initialData ? "تعديل" : "حفظ جديد";
  const toastMessage = initialData ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const action = initialData ? "تعديل" : "حفظ";
  const listBackPath = `/${locale}${basePath}`;

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      id: initialData?.id ?? undefined,
      inspectionDate: initialData?.inspectionDate
        ? new Date(initialData.inspectionDate)
        : undefined,
      saftyPetroleumWaste: initialData?.saftyPetroleumWaste ?? false,
      rightWasteDisposal: initialData?.rightWasteDisposal ?? false,
      note: initialData?.note ?? "",
      floatingUnitId: initialData?.floatingUnitId ?? "",
      organizationId: initialData?.organizationId ?? "",
      inspectionFloatingUnitClauses: [],
    },
  });

  useEffect(() => {
    let active = true;

    const loadClauses = async () => {
      // For new records use the prop directly — no fetching needed
      if (!initialData) {
        const rows = (inspectionFloatingUnitClauses ?? []) as InspectionClauseItem[];
        if (active) setClauseRows(sortClauseRowsByCode(rows));
        return;
      }

      // For update: always fetch all clauses and merge with already-inspected ones
      const alreadyInspected = (
        inspectionFloatingUnitClauses ?? []
      ) as InspectionClauseItem[];

      if (!inspectionTypeId) {
        if (active) setClauseRows(sortClauseRowsByCode(alreadyInspected));
        return;
      }

      const result = await getInspectionClauses(inspectionTypeId);
      if (!active) return;

      const raw = Array.isArray(result)
        ? result
        : Array.isArray((result as { data?: unknown })?.data)
          ? ((result as { data: unknown[] }).data as unknown[])
          : [];

      const inspectedIds = new Set(
        alreadyInspected.map((r) => r.inspectionClauseId),
      );

      const missingRows: InspectionClauseItem[] = (
        raw as Array<{
          id: string;
          code?: string;
          name?: string;
          nameAr?: string;
        }>
      )
        .filter((c) => !inspectedIds.has(c.id))
        .map((c) => ({
          inspectionClauseId: c.id,
          isInspected: false,
          number: "",
          note: "",
          inspectionClauseCode: c.code ?? "",
          inspectionClauseName: c.nameAr ?? c.name ?? "",
        }));

      const merged = sortClauseRowsByCode([...alreadyInspected, ...missingRows]);
      if (active) setClauseRows(merged);
    };

    loadClauses();
    return () => {
      active = false;
    };
  }, [
    initialData,
    inspectionFloatingUnitClauses,
    inspectionTypeId,
  ]);

  useEffect(() => {
    let active = true;
    const loadOrganizations = async () => {
      if (isSuperAdmin) {
        const result = await getPartiesOfficials("GovernmentCompany");
        if (!active) return;
        if (result && !(result as { error?: string }).error) {
          const raw = (result as { data?: unknown }).data ?? result;
          if (Array.isArray(raw)) {
            setOrganizationOptions(
              raw as Array<{ id: string; nameAr?: string; name?: string }>,
            );
            return;
          }
        }
        setOrganizationOptions([]);
        return;
      }

      if (!currentUserOrganizationId) {
        setOrganizationOptions([]);
        return;
      }

      const result = await getPartiesOfficialById(currentUserOrganizationId);
      if (!active) return;
      if (result && !(result as { error?: string }).error) {
        const raw = (result as { data?: unknown }).data ?? result;
        if (raw && typeof raw === "object") {
          setOrganizationOptions([
            raw as { id: string; nameAr?: string; name?: string },
          ]);
          return;
        }
      }
      setOrganizationOptions([]);
    };

    loadOrganizations();
    return () => {
      active = false;
    };
  }, [isSuperAdmin, currentUserOrganizationId]);

  useEffect(() => {
    if (initialData) return;
    if (isSuperAdmin) return;
    if (!currentUserOrganizationId) return;
    if (form.getValues("organizationId")) return;
    form.setValue("organizationId", currentUserOrganizationId);
  }, [form, initialData, isSuperAdmin, currentUserOrganizationId]);

  useEffect(() => {
    form.setValue("inspectionFloatingUnitClauses", clauseRows as any);
  }, [form, clauseRows]);

  const startEditClauseRow = (index: number) => {
    setEditingClauseIndex(index);
    setClauseDraft({ ...clauseRows[index] });
  };

  const cancelEditClauseRow = () => {
    setEditingClauseIndex(null);
    setClauseDraft(null);
  };

  const saveClauseRow = () => {
    if (editingClauseIndex === null || !clauseDraft) return;
    setClauseRows((prev) =>
      prev.map((row, idx) =>
        idx === editingClauseIndex
          ? {
              ...row,
              isInspected: Boolean(clauseDraft.isInspected),
              number: clauseDraft.number ?? "",
              note: clauseDraft.note ?? "",
            }
          : row,
      ),
    );
    setEditedClauseIndices((prev) => new Set(prev).add(editingClauseIndex));
    setClauseTableError("");
    setEditingClauseIndex(null);
    setClauseDraft(null);
  };

  const filteredClauseRows = useMemo(() => {
    const query = clauseSearch.trim().toLowerCase();
    return clauseRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (!query) return true;
        const code = (row.inspectionClauseCode ?? "").toLowerCase();
        const name = (row.inspectionClauseName ?? "").toLowerCase();
        return code.includes(query) || name.includes(query);
      });
  }, [clauseRows, clauseSearch]);

  const buildFormData = (data: InspectionFormValues): FormData => {
    console.log("data", data);
    const fd = new FormData();
    if (data.id) fd.append("Id", data.id);
    if (data.inspectionDate)
      fd.append("InspectionDate", format(data.inspectionDate, "yyyy-MM-dd"));
    if (showEnvironmentalFields) {
      fd.append(
        "SaftyPetroleumWaste",
        String(data.saftyPetroleumWaste ?? false),
      );
      fd.append("RightWasteDisposal", String(data.rightWasteDisposal ?? false));
    }
    if (data.note) fd.append("Note", data.note);
    if (inspectionTypeId) fd.append("InspectionTypeId", inspectionTypeId);
    fd.append("FloatingUnitId", data.floatingUnitId);
    fd.append("OrganizationId", data.organizationId);
    if (Array.isArray(data.inspectionFloatingUnitClauses)) {
      const normalize = (clause: (typeof data.inspectionFloatingUnitClauses)[number]) => ({
        id: clause.id,
        isInspected: clause.isInspected,
        number: clause.number ?? "",
        note: clause.note ?? "",
        inspectionId: clause.inspectionId,
        inspectionClauseId: clause.inspectionClauseId,
      });

      let clausesToSend: ReturnType<typeof normalize>[];

      if (initialData) {
        // Already-saved rows (have a backend id) — send them all with current values
        const savedRows = clauseRows
          .filter((row) => Boolean(row.id))
          .map(normalize);

        // New rows (no backend id) that the user explicitly edited in this session
        const newlyEditedRows = clauseRows
          .filter((row, idx) => !row.id && editedClauseIndices.has(idx))
          .map(normalize);

        clausesToSend = [...savedRows, ...newlyEditedRows];
      } else {
        // New record — only send rows the user edited
        clausesToSend = data.inspectionFloatingUnitClauses
          .filter((_, idx) => editedClauseIndices.has(idx))
          .map(normalize);
      }

      if (clausesToSend.length > 0) {
        fd.append(
          "InspectionFloatingUnitClauses",
          JSON.stringify(clausesToSend),
        );
      }
    }
    if (attachmentFile) fd.append("InspectionAttachment", attachmentFile);
    return fd;
  };

  const onSubmit = async (data: InspectionFormValues) => {
    if (clauseRows.length > 0 && editedClauseIndices.size === 0) {
      setClauseTableError("يجب اختيار بنود التفتيش");
      return;
    }
    try {
      toggleLoading();
      const fd = buildFormData(data);
      const res = initialData
        ? await updateInspectionMultipart(fd)
        : await addInspectionMultipart(fd);

      const statusValue =
        typeof res?.status === "string" ? res.status.toLowerCase() : "";
      const failedStatuses = new Set([
        "badrequest",
        "error",
        "failed",
        "conflict",
        "unauthorized",
        "forbidden",
        "notfound",
      ]);
      const hasApiFailure =
        Boolean(res?.error) ||
        (statusValue !== "" && failedStatuses.has(statusValue)) ||
        res?.data === false;

      if (hasApiFailure) {
        throw new Error(
          res?.message || res?.error || "تعذر حفظ بيانات التفتيش",
        );
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

  const onInvalid = (errors: FieldErrors<InspectionFormValues>) => {
    console.error("Inspection form validation errors:", errors);
    toast({
      variant: "destructive",
      duration: 3000,
      title: "البيانات غير مكتملة",
      description: "يرجى استكمال الحقول المطلوبة ثم المحاولة مرة أخرى.",
      action: <ToastAction altText="Try again">حسناً</ToastAction>,
    });
  };

  const onDelete = async () => {
    try {
      toggleLoading();
      const deleteFn = isSuperAdmin
        ? deleteInspectionById
        : softDeleteInspectionById;
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
        description: isSuperAdmin
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
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-8 w-full"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* تاريخ التفتيش */}
            <FormField
              control={form.control}
              name="inspectionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>تاريخ التفتيش</FormLabel>
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
                            !field.value && "text-muted-foreground",
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
                        onSelect={(date) => field.onChange(date ?? undefined)}
                        locale={dateFnsLocale}
                        initialFocus
                        captionLayout="dropdown"
                        toYear={new Date().getFullYear() + 1}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* الوحدة العائمة */}
            <FormField
              control={form.control}
              name="floatingUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوحدة العائمة</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الوحدة العائمة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {floatingUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nameAr ?? u.name ?? u.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* الجهة */}
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الجهة</FormLabel>
                  <Select
                    disabled={!isSuperAdmin}
                    onValueChange={field.onChange}
                    value={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الجهة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizationOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nameAr ?? o.name ?? o.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showEnvironmentalFields ? (
              <>
                {/* سلامة النفايات البترولية */}
                <FormField
                  control={form.control}
                  name="saftyPetroleumWaste"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>سلامة النفايات البترولية</FormLabel>
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

                {/* التخلص السليم من النفايات */}
                <FormField
                  control={form.control}
                  name="rightWasteDisposal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>التخلص السليم من النفايات</FormLabel>
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
              </>
            ) : null}
          </div>

          {clauseRows.length ? (
            <FormItem>
              <FormLabel>بنود التفتيش</FormLabel>
              <Input
                value={clauseSearch}
                onChange={(e) => setClauseSearch(e.target.value)}
                placeholder="ابحث بالكود أو اسم البند"
                className="mb-3"
              />
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-right">الكود</th>
                      <th className="p-2 text-right">اسم البند</th>
                      <th className="p-2 text-right">تم الفحص</th>
                      {!showEnvironmentalFields ? (
                        <th className="p-2 text-right">الرقم</th>
                      ) : null}
                      <th className="p-2 text-right">ملاحظات</th>
                      <th className="p-2 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClauseRows.map(({ row, originalIndex }) => {
                      const isEditing = editingClauseIndex === originalIndex;
                      return (
                        <tr
                          key={`${row.id ?? row.inspectionClauseId}-${originalIndex}`}
                          className="border-t align-top"
                        >
                          <td className="p-2 whitespace-nowrap">
                            {row.inspectionClauseCode || "-"}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row.inspectionClauseName || "-"}
                          </td>
                          <td className="p-2">
                            {isEditing && clauseDraft ? (
                              <Select
                                value={
                                  clauseDraft.isInspected ? "true" : "false"
                                }
                                onValueChange={(val) =>
                                  setClauseDraft({
                                    ...clauseDraft,
                                    isInspected: val === "true",
                                  })
                                }
                                dir="rtl"
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">نعم</SelectItem>
                                  <SelectItem value="false">لا</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : row.isInspected ? (
                              "نعم"
                            ) : (
                              "لا"
                            )}
                          </td>
                          {!showEnvironmentalFields ? (
                            <td className="p-2">
                              {isEditing && clauseDraft ? (
                                <Input
                                  value={clauseDraft.number ?? ""}
                                  onChange={(e) =>
                                    setClauseDraft({
                                      ...clauseDraft,
                                      number: e.target.value,
                                    })
                                  }
                                  className="h-9"
                                />
                              ) : (
                                row.number || "-"
                              )}
                            </td>
                          ) : null}
                          <td className="p-2 min-w-40">
                            {isEditing && clauseDraft ? (
                              <Textarea
                                value={clauseDraft.note ?? ""}
                                onChange={(e) =>
                                  setClauseDraft({
                                    ...clauseDraft,
                                    note: e.target.value,
                                  })
                                }
                                rows={2}
                              />
                            ) : (
                              row.note || "-"
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={saveClauseRow}
                                  disabled={loading}
                                >
                                  حفظ
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditClauseRow}
                                  disabled={loading}
                                >
                                  إلغاء
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  startEditClauseRow(originalIndex)
                                }
                                disabled={loading}
                              >
                                تعديل
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {clauseTableError && (
                <p className="text-sm font-medium text-destructive mt-1">
                  {clauseTableError}
                </p>
              )}
            </FormItem>
          ) : null}

          {/* ملاحظات */}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ملاحظات</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    disabled={loading}
                    placeholder="ملاحظات (اختياري)"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* مرفق التفتيش */}
          <FormItem>
            <FormLabel>مرفق التفتيش (اختياري)</FormLabel>
            <FormControl>
              <Input
                ref={attachmentRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAttachmentFile(file);
                }}
              />
            </FormControl>
            {initialData?.inspectionAttachment && !attachmentFile && (
              <p className="text-sm text-muted-foreground mt-1">
                مرفق حالي: {initialData.inspectionAttachment}
              </p>
            )}
          </FormItem>

          <div className="flex justify-center">
            <Button
              type="submit"
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

export default InspectionForm;
