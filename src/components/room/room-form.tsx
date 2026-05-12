"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Eye, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roomSchema, type RoomFormValues } from "@/schemas";
import { useToast } from "@/hooks/use-toast";
import {
  addRoom,
  getRoomById,
  getRooms,
  softDeleteRoomById,
  updateRoomById,
} from "@/actions/settings/roomService";
import { getRoomTypes } from "@/actions/settings/roomTypeService";
import { DataTable } from "@/components/ui/data-table";
import { getFullFileUrl } from "@/lib/file-viewer";
import {
  MAX_IMAGE_SIZE_LABEL,
  MAX_NEW_IMAGES,
  filterUnitImageFiles,
} from "@/lib/unit-image-constraints";
import { localizeUnitStatus, toArabicDigits } from "@/lib/unit-format";
import { mapApiRoomToFormDefaults } from "@/lib/room-form-map";
import CellAction from "@/components/room/cell-action";

function basename(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

type RoomImageMeta = { id?: string; path: string; isPrimary?: boolean };
type LookupOption = { id: string; nameAr: string; nameEn?: string };
type RoomTypeOption = LookupOption;

type RoomFormProps = {
  defaultValues?: Partial<RoomFormValues>;
  statusOptions?: LookupOption[];
  onSubmit?: (values: RoomFormValues) => void | Promise<void>;
  /** When true, hides the records table at the bottom (used inside the edit modal). */
  hideRecordsTable?: boolean;
};

type RoomRecordRow = {
  id: string;
  roomNumber: string;
  price: string;
  status: string;
  roomTypeId: string;
  roomType: string;
};

function buildRoomRecordColumns(
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  roomTypeNameById: Record<string, string>,
): ColumnDef<RoomRecordRow>[] {
  return [
    {
      accessorKey: "roomNumber",
      header: "رقم الغرفة",
      cell: ({ row }) => toArabicDigits(row.original.roomNumber),
    },
    {
      accessorKey: "roomType",
      header: "نوع الغرفة",
      cell: ({ row }) => {
        const fromRow = row.original.roomType?.trim();
        if (fromRow) return fromRow;
        const fromOptions = roomTypeNameById[row.original.roomTypeId]?.trim();
        return fromOptions || "-";
      },
    },
    {
      accessorKey: "price",
      header: "السعر",
      cell: ({ row }) => toArabicDigits(row.original.price),
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ row }) => localizeUnitStatus(row.original.status),
    },
    {
      id: "actions",
      header: "الإجراءات",
      cell: ({ row }) => (
        <CellAction
          data={{
            id: row.original.id,
            roomNumber: row.original.roomNumber,
            bedsCount: 0,
            status: row.original.status,
          }}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];
}

export default function RoomForm({
  defaultValues,
  statusOptions = [
    { id: "1", nameAr: "متاح", nameEn: "Available" },
    { id: "2", nameAr: "محجوز", nameEn: "Reserved" },
    { id: "3", nameAr: "مشغول", nameEn: "Occupied" },
  ],
  onSubmit,
  hideRecordsTable = false,
}: RoomFormProps) {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const routeUnitDataId =
    typeof params?.id === "string" && params.id !== "new" ? params.id : "";
  const preferredStatus =
    statusOptions.find((item) => item.nameAr === "متاح")?.id ??
    statusOptions[0]?.id ??
    "";

  const roomImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [roomImages, setRoomImages] = useState<
    Array<{ key: string; file: File; previewUrl: string }>
  >([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [roomRecords, setRoomRecords] = useState<RoomRecordRow[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<RoomTypeOption[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editDefaults, setEditDefaults] = useState<
    Partial<RoomFormValues> | null
  >(null);
  const currentId =
    typeof (defaultValues as Record<string, unknown> | undefined)?.id ===
    "string"
      ? String((defaultValues as Record<string, unknown>).id)
      : "";

  const defaultImageMeta = useMemo(() => {
    const rawMeta = (defaultValues as Record<string, unknown> | undefined)
      ?.roomImageMeta;
    const fromMeta = Array.isArray(rawMeta)
      ? rawMeta
          .map((item) => item as RoomImageMeta)
          .filter((item) => typeof item?.path === "string" && item.path.trim())
          .map((item) => ({
            id: String(item.id ?? "").trim(),
            path: String(item.path).trim(),
            isPrimary: Boolean(item.isPrimary),
          }))
      : [];
    if (fromMeta.length > 0) return fromMeta;

    const imgs = defaultValues?.images;
    if (!Array.isArray(imgs))
      return [] as Array<{ id: string; path: string; isPrimary: boolean }>;
    return imgs
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((path) => ({ id: "", path, isPrimary: false }));
  }, [defaultValues]);

  const serverImagePaths = useMemo(
    () => defaultImageMeta.map((item) => item.path),
    [defaultImageMeta],
  );

  const serverImagePathsKey = serverImagePaths.join("|");

  const [removedServerPaths, setRemovedServerPaths] = useState(
    () => new Set<string>(),
  );
  const [serverPrimaryMap, setServerPrimaryMap] = useState<
    Record<string, boolean>
  >({});
  const [serverIdByPath, setServerIdByPath] = useState<Record<string, string>>(
    {},
  );
  const [newPrimaryMap, setNewPrimaryMap] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    setRemovedServerPaths(new Set());
    setServerPrimaryMap(
      Object.fromEntries(
        defaultImageMeta.map((item) => [item.path, Boolean(item.isPrimary)]),
      ),
    );
    setServerIdByPath(
      Object.fromEntries(
        defaultImageMeta.map((item) => [item.path, String(item.id ?? "")]),
      ),
    );
    setNewPrimaryMap({});
  }, [serverImagePathsKey, currentId, defaultImageMeta]);

  const visibleServerPaths = useMemo(
    () => serverImagePaths.filter((p) => !removedServerPaths.has(p)),
    [serverImagePaths, removedServerPaths],
  );

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      roomNumber: "",
      description: "",
      price: 0,
      status: (preferredStatus as RoomFormValues["status"] | undefined) || "1",
      apartmentId: "",
      roomTypeId: "",
      images: [],
      ...defaultValues,
    },
  });

  useEffect(() => {
    const files = roomImages.map((x) => x.file);
    const combined: (File | string)[] = [...visibleServerPaths, ...files];
    const nextImages = combined.length > 0 ? combined : currentId ? [""] : [];
    form.setValue("images", nextImages, {
      shouldValidate: form.formState.isSubmitted,
    });
  }, [visibleServerPaths, roomImages, currentId, form]);

  useEffect(() => {
    if (!routeUnitDataId) return;
    const current = form.getValues("apartmentId");
    if (current && current.trim().length > 0) return;
    form.setValue("apartmentId", routeUnitDataId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: form.formState.isSubmitted,
    });
  }, [routeUnitDataId, form]);

  useEffect(() => {
    const currentStatus = form.getValues("status");
    if (!currentStatus) return;
    const matchedById = statusOptions.some(
      (item) => item.id === currentStatus,
    );
    if (matchedById) return;
    const matchedByName = statusOptions.find(
      (item) =>
        item.nameAr === currentStatus || item.nameEn === currentStatus,
    );
    if (matchedByName) {
      form.setValue("status", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
  }, [form, statusOptions]);

  const loadRoomRecords = async (): Promise<RoomRecordRow[]> => {
    try {
      setRecordsLoading(true);
      const result = await getRooms(routeUnitDataId);
      if ((result as { error?: string })?.error) return [];
      const raw = (result as { data?: unknown }).data ?? result;
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list
        .filter(
          (item): item is Record<string, unknown> =>
            item != null && typeof item === "object",
        )
        .map((item) => {
          const rawRoomTypeId = String(
            item.roomTypeId ?? item.RoomTypeId ?? "",
          ).trim();
          const rawRoomTypeName = String(
            item.roomType ?? item.RoomType ?? "",
          ).trim();
          const resolvedName =
            rawRoomTypeName ||
            roomTypeOptions.find((opt) => opt.id === rawRoomTypeId)?.nameAr ||
            "";
          return {
            id: String(item.id ?? item.Id ?? "").trim(),
            roomNumber: String(
              item.roomNumber ?? item.RoomNumber ?? "",
            ).trim(),
            price: String(item.price ?? item.Price ?? "").trim(),
            status: String(item.status ?? item.Status ?? "").trim(),
            roomTypeId: rawRoomTypeId,
            roomType: resolvedName,
          };
        })
        .filter((item) => item.id && item.roomNumber);
      setRoomRecords(mapped);
      return mapped;
    } finally {
      setRecordsLoading(false);
    }
  };

  const submitHandler = async (values: RoomFormValues) => {
    console.log(values);
    try {
      setLoading(true);
      const payload = new FormData();
      if (currentId) payload.append("id", currentId);
      const trimmedRoomNumber = String(values.roomNumber ?? "").trim();
      if (trimmedRoomNumber.length > 0) {
        payload.append("roomNumber", trimmedRoomNumber);
      }
      payload.append("description", String(values.description ?? ""));
      payload.append("price", String(values.price ?? ""));
      payload.append("status", String(values.status ?? ""));
      payload.append("apartmentId", String(values.apartmentId ?? ""));
      payload.append("roomTypeId", String(values.roomTypeId ?? ""));
      visibleServerPaths.forEach((path, index) => {
        const oldId = serverIdByPath[path] ?? "";
        payload.append(`OldImages[${index}].Id`, oldId);
        payload.append(
          `OldImages[${index}].IsPrimary`,
          serverPrimaryMap[path] ? "true" : "false",
        );
      });
      roomImages.forEach((image, index) => {
        payload.append(`Images[${index}].Image`, image.file);
        payload.append(
          `Images[${index}].IsPrimary`,
          newPrimaryMap[image.key] ? "true" : "false",
        );
      });
      const result = currentId
        ? await updateRoomById(payload)
        : await addRoom(payload);

      if ((result as { error?: string })?.error) {
        const errResult = result as {
          message?: string;
          status?: number;
          statusText?: string;
          validationErrors?: Record<string, string[]>;
          detail?: unknown;
        };
        console.error("[room-form] backend rejected save:", errResult);

        const validationLines = errResult.validationErrors
          ? Object.entries(errResult.validationErrors).map(
              ([field, msgs]) => `${field}: ${msgs.join(" | ")}`,
            )
          : [];

        const description =
          (validationLines.length > 0 ? validationLines.join("\n") : null) ||
          errResult.message ||
          "تعذر حفظ بيانات الغرفة";

        toast({
          variant: "destructive",
          title: errResult.status
            ? `حدث خطأ (HTTP ${errResult.status}${errResult.statusText ? ` ${errResult.statusText}` : ""})`
            : "حدث خطأ",
          description,
        });
        return;
      }

      toast({
        description: currentId
          ? "تم تعديل بيانات الغرفة بنجاح"
          : "تم حفظ بيانات الغرفة بنجاح",
      });
      await loadRoomRecords();
      resetFormAfterSave();

      if (onSubmit) await onSubmit(values);
    } finally {
      setLoading(false);
    }
  };

  const deleteHandler = async () => {
    if (!currentId || loading) return;
    const confirmed = window.confirm("هل أنت متأكد من حذف بيانات الغرفة؟");
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await softDeleteRoomById(currentId);
      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message ||
            "تعذر حذف بيانات الغرفة",
        });
        return;
      }

      toast({ description: "تم حذف بيانات الغرفة بنجاح" });
      await loadRoomRecords();
      router.push(`/${params.locale}/settings/unit-data`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleRowEdit = async (id: string) => {
    if (!id || editLoading) return;
    try {
      setEditLoading(true);
      const result = await getRoomById(id);
      if (!result || (result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل بيانات الغرفة",
          description:
            (result as { message?: string } | undefined)?.message ||
            "تعذر جلب بيانات الغرفة للتعديل",
        });
        return;
      }
      const raw = (result as { data?: unknown }).data ?? result;
      if (!raw || typeof raw !== "object") return;
      const mapped = mapApiRoomToFormDefaults(raw as Record<string, unknown>);
      setEditDefaults(mapped as Partial<RoomFormValues>);
      setEditModalOpen(true);
    } finally {
      setEditLoading(false);
    }
  };

  const handleRowDelete = async (id: string) => {
    if (!id || loading) return;
    const confirmed = window.confirm("هل أنت متأكد من حذف بيانات الغرفة؟");
    if (!confirmed) return;
    try {
      setLoading(true);
      const result = await softDeleteRoomById(id);
      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message ||
            "تعذر حذف بيانات الغرفة",
        });
        return;
      }
      toast({ description: "تم حذف بيانات الغرفة بنجاح" });
      await loadRoomRecords();
    } finally {
      setLoading(false);
    }
  };

  const roomTypeNameById = useMemo(() => {
    const map: Record<string, string> = {};
    roomTypeOptions.forEach((option) => {
      if (option.id) map[option.id] = option.nameAr;
    });
    return map;
  }, [roomTypeOptions]);

  const recordColumns = useMemo(
    () =>
      buildRoomRecordColumns(handleRowEdit, handleRowDelete, roomTypeNameById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editLoading, loading, roomTypeNameById],
  );

  useEffect(() => {
    return () => {
      roomImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [roomImages]);

  useEffect(() => {
    void loadRoomRecords();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRoomTypes = async () => {
      const result = await getRoomTypes();
      if (cancelled) return;
      if ((result as { error?: string })?.error) return;
      const raw = (result as { data?: unknown }).data ?? result;
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list
        .filter(
          (item): item is Record<string, unknown> =>
            item != null && typeof item === "object",
        )
        .map((item) => ({
          id: String(item.id ?? item.Id ?? "").trim(),
          nameAr: String(item.nameAr ?? item.NameAr ?? item.name ?? "").trim(),
          nameEn: String(item.nameEn ?? item.NameEn ?? "").trim() || undefined,
        }))
        .filter((item) => item.id && item.nameAr);
      setRoomTypeOptions(mapped);
    };
    void loadRoomTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentRoomType = form.getValues("roomTypeId");
    if (!currentRoomType || roomTypeOptions.length === 0) return;
    const matchedById = roomTypeOptions.some(
      (item) => item.id === currentRoomType,
    );
    if (matchedById) return;
    const matchedByName = roomTypeOptions.find(
      (item) =>
        item.nameAr === currentRoomType || item.nameEn === currentRoomType,
    );
    if (matchedByName) {
      form.setValue("roomTypeId", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [form, roomTypeOptions]);

  const downloadFromUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const resetFormAfterSave = () => {
    roomImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setRoomImages([]);
    setNewPrimaryMap({});
    setRemovedServerPaths(new Set());
    setServerPrimaryMap({});
    setServerIdByPath({});
    if (roomImagesInputRef.current) roomImagesInputRef.current.value = "";

    form.reset({
      roomNumber: "",
      description: "",
      price: 0,
      status: (preferredStatus as RoomFormValues["status"] | undefined) || "1",
      apartmentId: routeUnitDataId || "",
      roomTypeId: "",
      images: [],
    });
  };

  const setRoomImageFiles = (files: File[]) => {
    const remainingSlots = Math.max(
      0,
      MAX_NEW_IMAGES - visibleServerPaths.length,
    );
    const { accepted, oversized, overflowedCount } = filterUnitImageFiles(
      files,
      remainingSlots,
    );
    if (oversized.length > 0) {
      toast({
        variant: "destructive",
        title: "حجم الصورة كبير",
        description: `الحد الأقصى لحجم الصورة ${MAX_IMAGE_SIZE_LABEL}. تم تجاهل ${oversized.length} صورة.`,
      });
    }
    if (overflowedCount > 0) {
      toast({
        variant: "destructive",
        title: "تجاوز الحد الأقصى للصور",
        description:
          remainingSlots === 0
            ? `لا يمكن إضافة المزيد من الصور. الحد الأقصى ${MAX_NEW_IMAGES} صور إجمالاً (${visibleServerPaths.length} محفوظة).`
            : `يمكنك إضافة ${remainingSlots} صورة فقط (${visibleServerPaths.length} محفوظة من أصل ${MAX_NEW_IMAGES}).`,
      });
    }

    roomImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    const nextImages = accepted.map((file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setRoomImages(nextImages);
    setNewPrimaryMap(
      Object.fromEntries(nextImages.map((item) => [item.key, false])),
    );
  };

  const removeRoomImageAt = (index: number) => {
    const target = roomImages[index];
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    setRoomImages((prev) => prev.filter((_, i) => i !== index));
    setNewPrimaryMap((prev) => {
      const next = { ...prev };
      delete next[target.key];
      return next;
    });
  };

  const removeServerImagePath = (path: string) => {
    setRemovedServerPaths((prev) => new Set(prev).add(path));
    setServerPrimaryMap((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const clearRoomImages = () => {
    roomImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setRoomImages([]);
    setNewPrimaryMap({});
    if (roomImagesInputRef.current) roomImagesInputRef.current.value = "";
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
    if (!open) setViewerSrc(null);
  };

  const totalImageSlots = visibleServerPaths.length + roomImages.length;
  const remainingNewSlots = Math.max(
    0,
    MAX_NEW_IMAGES - visibleServerPaths.length,
  );
  const reachedNewLimit = remainingNewSlots === 0;

  const onInvalidSubmit = (errors: Record<string, unknown>) => {
    console.warn("Room form validation errors:", errors);
    const firstKey = Object.keys(errors)[0];
    const firstError = firstKey
      ? (errors[firstKey] as { message?: string } | undefined)
      : undefined;
    const fallbackByKey: Record<string, string> = {
      apartmentId: "الشقة مطلوبة (لم يتم تحديد الشقة من الرابط).",
      roomTypeId: "نوع الغرفة مطلوب.",
      description: "وصف الغرفة مطلوب.",
      price: "السعر مطلوب ويجب أن يكون أكبر من صفر.",
      status: "حالة الغرفة مطلوبة.",
      images: "يجب رفع صورة واحدة على الأقل للغرفة.",
    };
    toast({
      variant: "destructive",
      title: "تعذر حفظ بيانات الغرفة",
      description:
        firstError?.message ||
        (firstKey ? fallbackByKey[firstKey] : undefined) ||
        "يوجد خطأ في البيانات. تأكد من ملء جميع الحقول المطلوبة.",
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submitHandler, onInvalidSubmit)}
        className="space-y-6 rounded-lg border p-4 text-right"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="roomNumber"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>رقم الغرفة</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled
                    readOnly
                    className="w-full bg-muted cursor-not-allowed"
                    placeholder="يُنشأ تلقائياً"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>السعر</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>الحالة</FormLabel>
                <Select
                  dir="rtl"
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {statusOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        className="text-right"
                        value={option.id}
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
            name="roomTypeId"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>نوع الغرفة</FormLabel>
                <Select
                  dir="rtl"
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر نوع الغرفة" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {roomTypeOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        لا توجد بيانات
                      </div>
                    ) : (
                      roomTypeOptions.map((option) => (
                        <SelectItem
                          key={option.id}
                          className="text-right"
                          value={option.id}
                        >
                          {option.nameAr}
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="w-full md:col-span-2">
                <FormLabel>وصف الغرفة</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    className="w-full text-right placeholder:text-right"
                    placeholder="أدخل وصف الغرفة"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>صور الغرفة</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <input
                    ref={(element) => {
                      field.ref(element);
                      roomImagesInputRef.current = element;
                    }}
                    name={field.name}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      const imageFiles = selected.filter((file) =>
                        file.type.startsWith("image/"),
                      );
                      setRoomImageFiles(imageFiles);
                      event.target.value = "";
                    }}
                  />

                  {totalImageSlots > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visibleServerPaths.map((path, index) => {
                        const displaySrc = getFullFileUrl(path) ?? path;
                        const isPrimary = Boolean(serverPrimaryMap[path]);
                        return (
                          <div
                            key={`server-${path}-${index}`}
                            className="relative group rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-white/60 dark:bg-gray-900/40 w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displaySrc}
                              alt={basename(path)}
                              className="h-44 w-full object-cover bg-white"
                            />
                            {isPrimary ? (
                              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-3 py-1.5 text-sm text-white">
                                صورة أساسية
                              </div>
                            ) : null}
                            <label className="absolute top-2 right-2 flex items-center gap-2 rounded bg-white/90 px-3 py-1.5 text-sm font-medium">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-violet-600 cursor-pointer"
                                checked={isPrimary}
                                onChange={(event) =>
                                  setServerPrimaryMap((prev) => ({
                                    ...prev,
                                    [path]: event.target.checked,
                                  }))
                                }
                              />
                              أساسية
                            </label>
                            <div className="absolute top-2 left-2 flex gap-1">
                              <button
                                type="button"
                                title="عرض"
                                onClick={() => {
                                  setViewerSrc(displaySrc);
                                  setViewerOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="تحميل"
                                onClick={() => {
                                  const url =
                                    getFullFileUrl(path || "") ||
                                    displaySrc ||
                                    "";
                                  if (url) downloadFromUrl(url, basename(path));
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="إخفاء من القائمة"
                                onClick={() => removeServerImagePath(path)}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {roomImages.map((image, index) => {
                        const isPrimary = Boolean(newPrimaryMap[image.key]);
                        return (
                          <div
                            key={image.key}
                            className="relative rounded-md border overflow-hidden w-full border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.previewUrl}
                              alt={image.file.name}
                              className="h-44 w-full object-cover bg-white"
                            />
                            {isPrimary ? (
                              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-3 py-1.5 text-sm text-white">
                                صورة أساسية
                              </div>
                            ) : null}
                            <label className="absolute top-2 right-2 flex items-center gap-2 rounded bg-white/90 px-3 py-1.5 text-sm font-medium">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-violet-600 cursor-pointer"
                                checked={isPrimary}
                                onChange={(event) =>
                                  setNewPrimaryMap((prev) => ({
                                    ...prev,
                                    [image.key]: event.target.checked,
                                  }))
                                }
                              />
                              أساسية
                            </label>
                            <div className="absolute top-2 left-2 flex gap-1">
                              <button
                                type="button"
                                title="عرض"
                                onClick={() => {
                                  setViewerSrc(image.previewUrl);
                                  setViewerOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="تحميل"
                                onClick={() =>
                                  downloadFromUrl(
                                    image.previewUrl,
                                    image.file.name,
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="حذف"
                                onClick={() => removeRoomImageAt(index)}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div
                    className={`w-full min-h-[130px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-5 border-violet-300 bg-violet-50/50 dark:bg-violet-950/20 ${
                      reachedNewLimit
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
                    }`}
                    onClick={() => {
                      if (reachedNewLimit) return;
                      roomImagesInputRef.current?.click();
                    }}
                  >
                    <p className="text-lg font-bold text-violet-700">
                      {reachedNewLimit
                        ? "تم الوصول للحد الأقصى من الصور"
                        : totalImageSlots > 0
                          ? "اضغط لإضافة أو استبدال صور جديدة"
                          : "اضغط لاختيار صور الغرفة"}
                    </p>
                    <p className="mt-1 text-base font-semibold text-muted-foreground">
                      {totalImageSlots > 0
                        ? `${totalImageSlots} صورة معروضة (${visibleServerPaths.length} محفوظة، ${roomImages.length} جديدة) — متبقي ${remainingNewSlots} من أصل ${MAX_NEW_IMAGES} و${MAX_IMAGE_SIZE_LABEL} لكل صورة`
                        : `PNG / JPG / WEBP — حد أقصى ${MAX_NEW_IMAGES} صور و${MAX_IMAGE_SIZE_LABEL} لكل صورة`}
                    </p>
                  </div>

                  {roomImages.length > 0 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearRoomImages}
                      >
                        إزالة الصور الجديدة فقط
                      </Button>
                    </div>
                  ) : null}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Dialog open={viewerOpen} onOpenChange={handleViewerOpenChange}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>معاينة الصورة</DialogTitle>
            </DialogHeader>
            {viewerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewerSrc}
                alt=""
                className="max-h-[70vh] mx-auto object-contain"
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="flex justify-start gap-2">
          {currentId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={deleteHandler}
              disabled={loading}
            >
              حذف بيانات الغرفة
            </Button>
          ) : null}
          <Button
            className="bg-[#00005c] hover:bg-[#00004a] text-white"
            type="submit"
            disabled={loading}
          >
            حفظ بيانات الغرفة
          </Button>
        </div>
        {hideRecordsTable ? null : (
          <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <h3 className="mb-2 text-base font-semibold text-center">
              قائمة الغرف
            </h3>
            {recordsLoading || editLoading ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                جاري تحميل البيانات...
              </p>
            ) : (
              <DataTable
                columns={recordColumns}
                data={roomRecords}
                searchKey="roomNumber"
              />
            )}
          </div>
        )}

      </form>

      {hideRecordsTable ? null : (
        <Dialog
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setEditDefaults(null);
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعديل بيانات الغرفة</DialogTitle>
            </DialogHeader>
            {editDefaults ? (
              <RoomForm
                defaultValues={editDefaults}
                statusOptions={statusOptions}
                hideRecordsTable
                onSubmit={async () => {
                  setEditModalOpen(false);
                  setEditDefaults(null);
                  await loadRoomRecords();
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </Form>
  );
}
