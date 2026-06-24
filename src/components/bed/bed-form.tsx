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
import { bedSchema, type BedFormValues } from "@/schemas";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { useToast } from "@/hooks/use-toast";
import {
  addBed,
  deleteBedAttachmentsRange,
  getBedById,
  getBeds,
  softDeleteBedById,
  updateBedById,
} from "@/actions/settings/bedService";
import { submitUpdateBedFormData } from "@/lib/bed-multipart-client";
import { getRooms } from "@/actions/settings/roomService";
import { getApartmentById } from "@/actions/settings/apartmentService";
import { DataTable } from "@/components/ui/data-table";
import { getFullFileUrl } from "@/lib/file-viewer";
import {
  IMAGE_FILE_ACCEPT,
  filterImageFiles,
} from "@/lib/image-file";
import {
  MAX_IMAGE_SIZE_LABEL,
  MAX_NEW_IMAGES,
  filterUnitImageFiles,
} from "@/lib/unit-image-constraints";
import { localizeUnitStatus, toArabicDigits } from "@/lib/unit-format";
import { mapApiBedToFormDefaults } from "@/lib/bed-form-map";
import { mapApiApartmentSummary } from "@/lib/apartment-summary";
import CellAction from "@/components/bed/cell-action";
import UnitRecordsApartmentHeader from "@/components/unit-data/unit-records-apartment-header";

function basename(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

type BedImageMeta = {
  id?: string;
  attachmentId?: string;
  path: string;
  isPrimary?: boolean;
};
type LookupOption = { id: string; nameAr: string; nameEn?: string };

type BedFormProps = {
  defaultValues?: Partial<BedFormValues>;
  statusOptions?: LookupOption[];
  onSubmit?: (values: BedFormValues) => void | Promise<void>;
  /** When true, hides the records table at the bottom (used inside the edit modal). */
  hideRecordsTable?: boolean;
};

type BedRecordRow = {
  id: string;
  bedNumber: string;
  roomNumber: string;
  dimensions: string;
  status: string;
  roomId: string;
};

function buildBedRecordColumns(
  onEdit: (id: string, roomId?: string) => void,
  onDelete: (id: string) => void | Promise<void>,
  deletingId?: string | null,
): ColumnDef<BedRecordRow>[] {
  return [
    {
      accessorKey: "bedNumber",
      header: "رقم السرير",
      cell: ({ row }) => toArabicDigits(row.original.bedNumber),
    },
    {
      accessorKey: "roomNumber",
      header: "رقم الغرفة",
      cell: ({ row }) => {
        const roomNumber = row.original.roomNumber?.trim();
        return roomNumber ? toArabicDigits(roomNumber) : "-";
      },
    },
    {
      accessorKey: "dimensions",
      header: "الأبعاد",
      cell: ({ row }) => toArabicDigits(row.original.dimensions),
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
            bedNumber: row.original.bedNumber,
            dimensions: row.original.dimensions,
            status: row.original.status,
          }}
          onEdit={() => onEdit(row.original.id, row.original.roomId)}
          onDelete={onDelete}
          deleting={deletingId === row.original.id}
        />
      ),
    },
  ];
}

export default function BedForm({
  defaultValues,
  statusOptions = [
    { id: "1", nameAr: "متاح", nameEn: "Available" },
    { id: "2", nameAr: "محجوز", nameEn: "Reserved" },
    { id: "3", nameAr: "مشغول", nameEn: "Occupied" },
  ],
  onSubmit,
  hideRecordsTable = false,
}: BedFormProps) {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const routeApartmentId =
    typeof params?.id === "string" && params.id !== "new" ? params.id : "";
  const preferredStatus =
    statusOptions.find((item) => item.nameAr === "متاح")?.id ??
    statusOptions[0]?.id ??
    "";

  const bedImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [bedImages, setBedImages] = useState<
    Array<{ key: string; file: File; previewUrl: string }>
  >([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, toggleDeleteOpen] = useToggleState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [bedRecords, setBedRecords] = useState<BedRecordRow[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editDefaults, setEditDefaults] = useState<
    Partial<BedFormValues> | null
  >(null);
  const [roomOptions, setRoomOptions] = useState<
    Array<{ id: string; roomNumber: string; apartmentId: string }>
  >([]);
  const [apartmentSummary, setApartmentSummary] = useState({
    apartmentNumber: "",
    genderLabel: "",
  });
  const currentId =
    typeof (defaultValues as Record<string, unknown> | undefined)?.id ===
    "string"
      ? String((defaultValues as Record<string, unknown>).id)
      : "";

  const defaultImageMeta = useMemo(() => {
    const rawMeta = (defaultValues as Record<string, unknown> | undefined)
      ?.bedImageMeta;
    const fromMeta = Array.isArray(rawMeta)
      ? rawMeta
          .map((item) => item as BedImageMeta)
          .filter((item) => typeof item?.path === "string" && item.path.trim())
          .map((item) => ({
            id: String(item.id ?? "").trim(),
            attachmentId: String(item.attachmentId ?? "").trim(),
            path: String(item.path).trim(),
            isPrimary: Boolean(item.isPrimary),
          }))
      : [];
    if (fromMeta.length > 0) return fromMeta;

    const imgs = defaultValues?.images;
    if (!Array.isArray(imgs))
      return [] as Array<{
        id: string;
        attachmentId: string;
        path: string;
        isPrimary: boolean;
      }>;
    return imgs
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((path) => ({ id: "", attachmentId: "", path, isPrimary: false }));
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
  const [serverAttachmentIdByPath, setServerAttachmentIdByPath] = useState<
    Record<string, string>
  >({});
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
    setServerAttachmentIdByPath(
      Object.fromEntries(
        defaultImageMeta.map((item) => [
          item.path,
          String(item.attachmentId ?? ""),
        ]),
      ),
    );
    setNewPrimaryMap({});
  }, [serverImagePathsKey, currentId, defaultImageMeta]);

  const visibleServerPaths = useMemo(
    () => serverImagePaths.filter((p) => !removedServerPaths.has(p)),
    [serverImagePaths, removedServerPaths],
  );

  const form = useForm<BedFormValues>({
    resolver: zodResolver(bedSchema),
    defaultValues: {
      description: "",
      dimensions: "",
      price: 0,
      status: (preferredStatus as BedFormValues["status"] | undefined) || "1",
      roomId: "",
      images: [],
      ...defaultValues,
    },
  });

  const incomingRoomId = String(
    (defaultValues as Record<string, unknown> | undefined)?.roomId ?? "",
  ).trim();

  useEffect(() => {
    if (!incomingRoomId) return;
    const currentRoomId = String(form.getValues("roomId") ?? "").trim();
    if (currentRoomId === incomingRoomId) return;
    form.setValue("roomId", incomingRoomId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [incomingRoomId, form]);

  useEffect(() => {
    const files = bedImages.map((x) => x.file);
    const combined: (File | string)[] = [...visibleServerPaths, ...files];
    const nextImages = combined.length > 0 ? combined : currentId ? [""] : [];
    form.setValue("images", nextImages, { shouldValidate: false });
  }, [visibleServerPaths, bedImages, currentId, form]);

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

  const loadBedRecords = async () => {
    try {
      setRecordsLoading(true);
      const roomNumberById: Record<string, string> = {};
      let apartmentRoomIds = new Set<string>();
      if (routeApartmentId) {
        const roomsResult = await getRooms(routeApartmentId, {
          allStatuses: true,
        });
        if (!(roomsResult as { error?: string })?.error) {
          const roomsRaw =
            (roomsResult as { data?: unknown }).data ?? roomsResult;
          const roomsList = Array.isArray(roomsRaw) ? roomsRaw : [];
          for (const item of roomsList) {
            if (item == null || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            const id = String(row.id ?? row.Id ?? "").trim();
            const roomNumber = String(
              row.roomNumber ?? row.RoomNumber ?? "",
            ).trim();
            if (id) {
              apartmentRoomIds.add(id);
              if (roomNumber) roomNumberById[id] = roomNumber;
            }
          }
        }
      }

      const result = await getBeds(undefined, { allStatuses: true });
      if ((result as { error?: string })?.error) return;
      const raw = (result as { data?: unknown }).data ?? result;
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list
        .filter(
          (item): item is Record<string, unknown> =>
            item != null && typeof item === "object",
        )
        .map((item) => {
          const roomId = String(item.roomId ?? item.RoomId ?? "").trim();
          return {
            id: String(item.id ?? item.Id ?? "").trim(),
            bedNumber: String(item.bedNumber ?? item.BedNumber ?? "").trim(),
            roomNumber: roomNumberById[roomId] ?? "",
            dimensions: String(item.dimensions ?? item.Dimensions ?? "").trim(),
            status: String(item.status ?? item.Status ?? "").trim(),
            roomId,
          };
        })
        .filter((item) => item.id && item.bedNumber)
        .filter((item) =>
          routeApartmentId ? apartmentRoomIds.has(item.roomId) : true,
        );
      setBedRecords(mapped);
    } finally {
      setRecordsLoading(false);
    }
  };

  const FIELD_LABELS: Record<string, string> = {
    bedNumber: "رقم السرير",
    dimensions: "الأبعاد",
    price: "السعر",
    status: "الحالة",
    description: "الوصف",
    roomId: "الغرفة",
    images: "الصور",
  };

  const onInvalidSubmit = (errors: Record<string, unknown>) => {
    console.error("[bed-form] validation errors", errors);
    const firstKey = Object.keys(errors)[0];
    const firstError = firstKey
      ? (errors[firstKey] as { message?: string } | undefined)
      : undefined;
    const fieldLabel = firstKey ? FIELD_LABELS[firstKey] ?? firstKey : "";
    toast({
      variant: "destructive",
      title: "تعذر إرسال النموذج",
      description:
        firstError?.message ||
        (fieldLabel
          ? `يرجى مراجعة الحقل: ${fieldLabel}`
          : "يرجى مراجعة الحقول المطلوبة"),
    });
  };

  const submitHandler = async (values: BedFormValues) => {
    try {
      setLoading(true);
      const payload = new FormData();
      if (currentId) payload.append("id", currentId);
      payload.append("bedNumber", String(values.bedNumber ?? ""));
      payload.append("description", String(values.description ?? ""));
      payload.append("dimensions", String(values.dimensions ?? ""));
      payload.append("price", String(values.price ?? ""));
      payload.append("status", String(values.status ?? ""));
      payload.append("roomId", String(values.roomId ?? ""));
      visibleServerPaths.forEach((path, index) => {
        const oldId = serverIdByPath[path] ?? "";
        payload.append(`OldImages[${index}].Id`, oldId);
        payload.append(
          `OldImages[${index}].IsPrimary`,
          serverPrimaryMap[path] ? "true" : "false",
        );
      });
      bedImages.forEach((image, index) => {
        payload.append(`Images[${index}].Image`, image.file);
        payload.append(
          `Images[${index}].IsPrimary`,
          newPrimaryMap[image.key] ? "true" : "false",
        );
      });
      const result = currentId
        ? bedImages.length > 0
          ? await submitUpdateBedFormData(payload)
          : await updateBedById(payload)
        : await addBed(payload);

      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message ||
            "تعذر حفظ بيانات السرير",
        });
        return;
      }

      toast({
        description: currentId
          ? "تم تعديل بيانات السرير بنجاح"
          : "تم حفظ بيانات السرير بنجاح",
      });

      const attachmentIdsToDelete = Array.from(removedServerPaths)
        .map((path) => (serverAttachmentIdByPath[path] ?? "").trim())
        .filter(Boolean);
      if (attachmentIdsToDelete.length > 0) {
        const delResult = await deleteBedAttachmentsRange(attachmentIdsToDelete);
        if ((delResult as { error?: string })?.error) {
          toast({
            variant: "destructive",
            title: "تعذر حذف بعض الصور",
            description:
              (delResult as { message?: string })?.message ||
              "تعذر حذف الصور المُزالة من الخادم",
          });
        }
      }

      await loadBedRecords();
      resetFormAfterSave();

      if (onSubmit) await onSubmit(values);
    } finally {
      setLoading(false);
    }
  };

  const deleteHandler = async () => {
    if (!currentId || loading) return;

    try {
      setLoading(true);
      const result = await softDeleteBedById(currentId);
      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message ||
            "تعذر حذف بيانات السرير",
        });
        return;
      }

      toast({ description: "تم حذف بيانات السرير بنجاح" });
      toggleDeleteOpen();
      await loadBedRecords();
      router.push(`/${params.locale}/settings/unit-data`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleRowEdit = async (id: string, fallbackRoomId?: string) => {
    if (!id || editLoading) return;
    try {
      setEditLoading(true);
      const result = await getBedById(id);
      if (!result || (result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل بيانات السرير",
          description:
            (result as { message?: string } | undefined)?.message ||
            "تعذر جلب بيانات السرير للتعديل",
        });
        return;
      }
      const raw = (result as { data?: unknown }).data ?? result;
      if (!raw || typeof raw !== "object") return;
      const mapped = mapApiBedToFormDefaults(raw as Record<string, unknown>);
      const merged: Partial<BedFormValues> = {
        ...(mapped as Partial<BedFormValues>),
      };
      if (
        (!merged.roomId || String(merged.roomId).trim() === "") &&
        fallbackRoomId
      ) {
        merged.roomId = fallbackRoomId;
      }
      setEditDefaults(merged);
      setEditModalOpen(true);
    } finally {
      setEditLoading(false);
    }
  };

  const handleRowDelete = async (id: string) => {
    if (!id || loading) return;
    try {
      setDeletingId(id);
      setLoading(true);
      const result = await softDeleteBedById(id);
      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message ||
            "تعذر حذف بيانات السرير",
        });
        return;
      }
      toast({ description: "تم حذف بيانات السرير بنجاح" });
      await loadBedRecords();
    } finally {
      setDeletingId(null);
      setLoading(false);
    }
  };

  const recordColumns = useMemo(
    () => buildBedRecordColumns(handleRowEdit, handleRowDelete, deletingId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletingId, editLoading, loading],
  );

  useEffect(() => {
    return () => {
      bedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [bedImages]);

  useEffect(() => {
    void loadBedRecords();
  }, []);

  useEffect(() => {
    if (!routeApartmentId) return;

    let cancelled = false;
    const loadApartmentSummary = async () => {
      const result = await getApartmentById(routeApartmentId);
      if (cancelled || (result as { error?: string })?.error) return;

      const raw = (result as { data?: unknown }).data ?? result;
      if (!raw || typeof raw !== "object") return;

      setApartmentSummary(mapApiApartmentSummary(raw as Record<string, unknown>));
    };

    void loadApartmentSummary();
    return () => {
      cancelled = true;
    };
  }, [routeApartmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadRoomOptions = async () => {
      const apartmentFilter = routeApartmentId || "";
      const result = await getRooms(apartmentFilter, { allStatuses: true });
      if (cancelled) return;
      if ((result as { error?: string })?.error) {
        console.error("[bed-form] getRooms failed", result);
        return;
      }
      const raw = (result as { data?: unknown }).data ?? result;
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list
        .filter(
          (item): item is Record<string, unknown> =>
            item != null && typeof item === "object",
        )
        .map((item) => ({
          id: String(item.id ?? item.Id ?? "").trim(),
          roomNumber: String(item.roomNumber ?? item.RoomNumber ?? "").trim(),
          apartmentId: String(
            item.apartmentId ?? item.ApartmentId ?? "",
          ).trim(),
        }))
        .filter((item) => item.id && item.roomNumber);

      setRoomOptions(mapped);
    };
    void loadRoomOptions();
    return () => {
      cancelled = true;
    };
  }, [routeApartmentId]);

  useEffect(() => {
    const currentRoomId = form.getValues("roomId");
    if (!currentRoomId || roomOptions.length === 0) return;
    const matchedById = roomOptions.some((item) => item.id === currentRoomId);
    if (matchedById) return;
    const matchedByName = roomOptions.find(
      (item) => item.roomNumber === currentRoomId,
    );
    if (matchedByName) {
      form.setValue("roomId", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
  }, [form, roomOptions]);

  const downloadFromUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const resetFormAfterSave = () => {
    bedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setBedImages([]);
    setNewPrimaryMap({});
    setRemovedServerPaths(new Set());
    setServerPrimaryMap({});
    setServerIdByPath({});
    setServerAttachmentIdByPath({});
    if (bedImagesInputRef.current) bedImagesInputRef.current.value = "";

    form.reset(
      {
        description: "",
        dimensions: "",
        price: 0,
        status: (preferredStatus as BedFormValues["status"] | undefined) || "1",
        roomId: "",
        images: [],
      },
      {
        keepErrors: false,
        keepDirty: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false,
      },
    );
    form.clearErrors();
  };

  const setBedImageFiles = (files: File[]) => {
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

    bedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    const nextImages = accepted.map((file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setBedImages(nextImages);
    setNewPrimaryMap(
      Object.fromEntries(nextImages.map((item) => [item.key, false])),
    );
  };

  const removeBedImageAt = (index: number) => {
    const target = bedImages[index];
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    setBedImages((prev) => prev.filter((_, i) => i !== index));
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

  const clearBedImages = () => {
    bedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setBedImages([]);
    setNewPrimaryMap({});
    if (bedImagesInputRef.current) bedImagesInputRef.current.value = "";
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
    if (!open) setViewerSrc(null);
  };

  const totalImageSlots = visibleServerPaths.length + bedImages.length;
  const remainingNewSlots = Math.max(
    0,
    MAX_NEW_IMAGES - visibleServerPaths.length,
  );
  const reachedNewLimit = remainingNewSlots === 0;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submitHandler, onInvalidSubmit)}
        className="space-y-6 rounded-lg border p-4 text-right"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="bedNumber"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>رقم السرير</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    className="w-full"
                    placeholder="أدخل رقم السرير"
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
            name="dimensions"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>الأبعاد</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="w-full"
                    placeholder="مثال: 200x90 سم"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="roomId"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>الغرفة</FormLabel>
                <Select
                  key={`room-select-${roomOptions.length}`}
                  dir="rtl"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue
                        placeholder={
                          roomOptions.length === 0
                            ? "لا توجد غرف متاحة"
                            : "اختر الغرفة"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {roomOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        className="text-right"
                        value={option.id}
                      >
                        {`غرفة رقم ${toArabicDigits(option.roomNumber)}`}
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
            name="description"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>وصف السرير</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    className="w-full text-right placeholder:text-right"
                    placeholder="أدخل وصف السرير"
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
              <FormLabel>صور السرير</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <input
                    ref={(element) => {
                      field.ref(element);
                      bedImagesInputRef.current = element;
                    }}
                    name={field.name}
                    type="file"
                    multiple
                    accept={IMAGE_FILE_ACCEPT}
                    className="hidden"
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      setBedImageFiles(filterImageFiles(selected));
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
                      {bedImages.map((image, index) => {
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
                                onClick={() => removeBedImageAt(index)}
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
                      bedImagesInputRef.current?.click();
                    }}
                  >
                    <p className="text-lg font-bold text-violet-700">
                      {reachedNewLimit
                        ? "تم الوصول للحد الأقصى من الصور"
                        : totalImageSlots > 0
                          ? "اضغط لإضافة أو استبدال صور جديدة"
                          : "اضغط لاختيار صور السرير"}
                    </p>
                    <p className="mt-1 text-base font-semibold text-muted-foreground">
                      {totalImageSlots > 0
                        ? `${totalImageSlots} صورة معروضة (${visibleServerPaths.length} محفوظة، ${bedImages.length} جديدة) — متبقي ${remainingNewSlots} من أصل ${MAX_NEW_IMAGES} و${MAX_IMAGE_SIZE_LABEL} لكل صورة`
                        : `جميع صيغ الصور — حد أقصى ${MAX_NEW_IMAGES} صور و${MAX_IMAGE_SIZE_LABEL} لكل صورة`}
                    </p>
                  </div>

                  {bedImages.length > 0 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearBedImages}
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

        <AlertModal
          isOpen={deleteOpen}
          loading={loading}
          onClose={toggleDeleteOpen}
          onConfirm={deleteHandler}
        />

        <div className="flex justify-start gap-2">
          {currentId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={toggleDeleteOpen}
              disabled={loading}
            >
              حذف بيانات السرير
            </Button>
          ) : null}
          <Button
            className="bg-brand hover:bg-brand-hover text-brand-foreground"
            type="submit"
            disabled={loading}
          >
            حفظ بيانات السرير
          </Button>
        </div>
        {hideRecordsTable ? null : (
          <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <h3 className="mb-2 text-base font-semibold text-center">
              قائمة الأسرة
            </h3>
            <UnitRecordsApartmentHeader
              apartmentNumber={apartmentSummary.apartmentNumber}
              genderLabel={apartmentSummary.genderLabel}
            />
            {recordsLoading || editLoading ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                جاري تحميل البيانات...
              </p>
            ) : (
              <DataTable
                columns={recordColumns}
                data={bedRecords}
                searchKey="bedNumber"
                className="text-base [&_th]:text-base [&_td]:text-base"
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
            <DialogHeader className="items-center text-center">
              <DialogTitle>تعديل بيانات السرير</DialogTitle>
            </DialogHeader>
            {editDefaults ? (
              <BedForm
                defaultValues={editDefaults}
                statusOptions={statusOptions}
                hideRecordsTable
                onSubmit={async () => {
                  setEditModalOpen(false);
                  setEditDefaults(null);
                  await loadBedRecords();
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </Form>
  );
}
