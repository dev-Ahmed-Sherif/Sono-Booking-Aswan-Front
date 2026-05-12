"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronDown, Download, Eye, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apartmentSchema, type ApartmentFormValues } from "@/schemas";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  addApartment,
  softDeleteApartmentById,
  updateApartmentById,
} from "@/actions/settings/apartmentService";
import { getFullFileUrl } from "@/lib/file-viewer";
import {
  MAX_IMAGE_SIZE_LABEL,
  MAX_NEW_IMAGES,
  filterUnitImageFiles,
} from "@/lib/unit-image-constraints";

function basename(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

type LookupOption = { id: string; nameAr: string; nameEn?: string };
type CityOption = LookupOption & { governorateId: string };
type ApartmentImageMeta = { id?: string; path: string; isPrimary?: boolean };

type ApartmentFormProps = {
  defaultValues?: Partial<ApartmentFormValues>;
  genderOptions?: LookupOption[];
  allocationTypeOptions?: LookupOption[];
  apartmentTypeOptions?: LookupOption[];
  statusOptions?: LookupOption[];
  governorateOptions?: LookupOption[];
  cityOptions?: CityOption[];
  onSubmit?: (values: ApartmentFormValues) => void | Promise<void>;
};

export default function ApartmentForm({
  defaultValues,
  genderOptions = [
    { id: "1", nameAr: "رجال" },
    { id: "2", nameAr: "سيدات" },
  ],
  allocationTypeOptions = [
    { id: "1", nameAr: "ثابت" },
    { id: "2", nameAr: "مرن" },
  ],
  apartmentTypeOptions = [],
  statusOptions = [
    { id: "1", nameAr: "متاح" },
    { id: "2", nameAr: "محجوز" },
    { id: "3", nameAr: "مشغول" },
  ],
  governorateOptions = [],
  cityOptions = [],
  onSubmit,
}: ApartmentFormProps) {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const normalizeLookupValue = (value: string | undefined) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const preferredStatus =
    statusOptions.find((item) => item.nameAr === "متاح")?.id ??
    statusOptions[0]?.id ??
    "";

  const apartmentImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [apartmentImages, setApartmentImages] = useState<
    Array<{ key: string; file: File; previewUrl: string }>
  >([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [governorateOpen, setGovernorateOpen] = useState(false);
  const [governorateSearch, setGovernorateSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const currentId =
    typeof (defaultValues as Record<string, unknown> | undefined)?.id === "string"
      ? String((defaultValues as Record<string, unknown>).id)
      : "";

  const defaultImageMeta = useMemo(() => {
    const rawMeta = (defaultValues as Record<string, unknown> | undefined)
      ?.apartmentImageMeta;
    const fromMeta = Array.isArray(rawMeta)
      ? rawMeta
          .map((item) => item as ApartmentImageMeta)
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

  const [removedServerPaths, setRemovedServerPaths] = useState(() => new Set<string>());
  const [serverPrimaryMap, setServerPrimaryMap] = useState<Record<string, boolean>>({});
  const [serverIdByPath, setServerIdByPath] = useState<Record<string, string>>({});
  const [newPrimaryMap, setNewPrimaryMap] = useState<Record<string, boolean>>({});

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

  const form = useForm<ApartmentFormValues>({
    resolver: zodResolver(apartmentSchema),
    defaultValues: {
      apartmentNumber: "",
      description: "",
      price: 0,
      status:
        (preferredStatus as ApartmentFormValues["status"] | undefined) || "1",
      gender:
        (genderOptions[0]?.id as ApartmentFormValues["gender"] | undefined) ?? "1",
      allocationType:
        (allocationTypeOptions[0]?.id as ApartmentFormValues["allocationType"]) ??
        "1",
      street: "",
      buildingNumber: "",
      floor: "",
      detailedAddress: "",
      apartmentTypeId: "",
      governorateId: "",
      cityId: "",
      images: [],
      ...defaultValues,
    },
  });

  useEffect(() => {
    const files = apartmentImages.map((x) => x.file);
    const combined: (File | string)[] = [...visibleServerPaths, ...files];
    const nextImages = combined.length > 0 ? combined : currentId ? [""] : [];
    form.setValue("images", nextImages, {
      shouldValidate: form.formState.isSubmitted,
    });
  }, [visibleServerPaths, apartmentImages, currentId, form]);

  const submitHandler = async (values: ApartmentFormValues) => {
    try {
      setLoading(true);
      const resolveLookupSubmitValue = (selected: string, options: LookupOption[]) => {
        const item = options.find((option) => option.id === selected);
        if (!item) return selected;
        return String(item.nameEn ?? item.nameAr ?? selected).trim();
      };
      const payload = new FormData();
      if (currentId) payload.append("id", currentId);
      const trimmedApartmentNumber = String(values.apartmentNumber ?? "").trim();
      if (trimmedApartmentNumber.length > 0) {
        payload.append("apartmentNumber", trimmedApartmentNumber);
      }
      payload.append("description", String(values.description ?? ""));
      payload.append("price", String(values.price ?? ""));
      payload.append(
        "status",
        resolveLookupSubmitValue(String(values.status ?? ""), statusOptions),
      );
      payload.append(
        "gender",
        resolveLookupSubmitValue(String(values.gender ?? ""), genderOptions),
      );
      payload.append(
        "allocationType",
        resolveLookupSubmitValue(
          String(values.allocationType ?? ""),
          allocationTypeOptions,
        ),
      );
      payload.append("street", String(values.street ?? ""));
      payload.append("buildingNumber", String(values.buildingNumber ?? ""));
      payload.append("floor", String(values.floor ?? ""));
      payload.append("detailedAddress", String(values.detailedAddress ?? ""));
      payload.append("apartmentTypeId", String(values.apartmentTypeId ?? ""));
      payload.append("governorateId", String(values.governorateId ?? ""));
      payload.append("cityId", String(values.cityId ?? ""));
      visibleServerPaths.forEach((path, index) => {
        const oldId = serverIdByPath[path] ?? "";
        payload.append(`OldImages[${index}].Id`, oldId);
        payload.append(
          `OldImages[${index}].IsPrimary`,
          serverPrimaryMap[path] ? "true" : "false",
        );
      });
      apartmentImages.forEach((image, index) => {
        payload.append(`Images[${index}].Image`, image.file);
        payload.append(
          `Images[${index}].IsPrimary`,
          newPrimaryMap[image.key] ? "true" : "false",
        );
      });
      const result = currentId
        ? await updateApartmentById(payload)
        : await addApartment(payload);

      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message || "تعذر حفظ بيانات الشقة",
        });
        return;
      }

      toast({
        description: currentId
          ? "تم تعديل بيانات الشقة بنجاح"
          : "تم حفظ بيانات الشقة بنجاح",
      });

      if (onSubmit) await onSubmit(values);
    } finally {
      setLoading(false);
    }
  };

  const deleteHandler = async () => {
    if (!currentId || loading) return;
    const confirmed = window.confirm("هل أنت متأكد من حذف بيانات الشقة؟");
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await softDeleteApartmentById(currentId);
      if ((result as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description:
            (result as { message?: string })?.message || "تعذر حذف بيانات الشقة",
        });
        return;
      }

      toast({ description: "تم حذف بيانات الشقة بنجاح" });
      router.push(`/${params.locale}/settings/unit-data`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const selectedGovernorate = form.watch("governorateId");
  const selectedGovernorateLabel =
    governorateOptions.find((item) => item.id === selectedGovernorate)?.nameAr ?? "";
  const availableCities = cityOptions.filter(
    (city) =>
      normalizeLookupValue(city.governorateId) ===
      normalizeLookupValue(selectedGovernorate),
  );
  const filteredGovernorates = governorateOptions.filter((item) =>
    item.nameAr.toLowerCase().includes(governorateSearch.toLowerCase()),
  );

  useEffect(() => {
    const currentStatus = form.getValues("status");
    if (!currentStatus) return;
    const matchedById = statusOptions.some((item) => item.id === currentStatus);
    if (matchedById) return;
    const matchedByName = statusOptions.find((item) => item.nameAr === currentStatus);
    if (matchedByName) {
      form.setValue("status", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [form, statusOptions]);

  useEffect(() => {
    const currentGender = form.getValues("gender");
    if (!currentGender) return;
    const matchedById = genderOptions.some((item) => item.id === currentGender);
    if (matchedById) return;
    const matchedByName = genderOptions.find((item) => item.nameAr === currentGender);
    if (matchedByName) {
      form.setValue("gender", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [form, genderOptions]);

  useEffect(() => {
    const currentAllocationType = form.getValues("allocationType");
    if (!currentAllocationType) return;
    const matchedById = allocationTypeOptions.some(
      (item) => item.id === currentAllocationType,
    );
    if (matchedById) return;
    const matchedByName = allocationTypeOptions.find(
      (item) => item.nameAr === currentAllocationType,
    );
    if (matchedByName) {
      form.setValue("allocationType", matchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [allocationTypeOptions, form]);

  useEffect(() => {
    const currentApartmentType = form.getValues("apartmentTypeId");
    if (!currentApartmentType) return;
    const apartmentTypeMatchedById = apartmentTypeOptions.some(
      (item) => item.id === currentApartmentType,
    );
    if (apartmentTypeMatchedById) return;

    const apartmentTypeMatchedByName = apartmentTypeOptions.find(
      (item) => item.nameAr === currentApartmentType,
    );
    if (apartmentTypeMatchedByName) {
      form.setValue("apartmentTypeId", apartmentTypeMatchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [apartmentTypeOptions, form]);

  useEffect(() => {
    const currentGovernorate = form.getValues("governorateId");
    if (!currentGovernorate) return;
    const governorateMatchedById = governorateOptions.some(
      (item) => item.id === currentGovernorate,
    );
    if (governorateMatchedById) return;

    const governorateMatchedByName = governorateOptions.find(
      (item) => item.nameAr === currentGovernorate,
    );
    if (governorateMatchedByName) {
      form.setValue("governorateId", governorateMatchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [form, governorateOptions]);

  useEffect(() => {
    const currentCity = form.getValues("cityId");
    if (!currentCity) return;
    const cityMatchedById = cityOptions.some((item) => item.id === currentCity);
    if (cityMatchedById) return;

    const cityMatchedByName = cityOptions.find((item) => item.nameAr === currentCity);
    if (cityMatchedByName) {
      form.setValue("cityId", cityMatchedByName.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [cityOptions, form]);

  useEffect(() => {
    const selectedCity = form.getValues("cityId");
    if (!selectedCity) return;
    const cityBelongsToGovernorate = cityOptions.some(
      (city) =>
        normalizeLookupValue(city.id) === normalizeLookupValue(selectedCity) &&
        normalizeLookupValue(city.governorateId) ===
          normalizeLookupValue(selectedGovernorate),
    );
    if (!cityBelongsToGovernorate) {
      form.setValue("cityId", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [cityOptions, form, selectedGovernorate]);

  useEffect(() => {
    return () => {
      apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [apartmentImages]);

  const downloadFromUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const setApartmentImageFiles = (files: File[]) => {
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

    apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    const nextImages = accepted.map((file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setApartmentImages(nextImages);
    setNewPrimaryMap(
      Object.fromEntries(nextImages.map((item) => [item.key, false])),
    );
  };

  const removeApartmentImageAt = (index: number) => {
    const target = apartmentImages[index];
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    setApartmentImages((prev) => prev.filter((_, i) => i !== index));
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

  const clearNewApartmentImages = () => {
    apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setApartmentImages([]);
    setNewPrimaryMap({});
    if (apartmentImagesInputRef.current)
      apartmentImagesInputRef.current.value = "";
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
    if (!open) setViewerSrc(null);
  };

  const totalImageSlots =
    visibleServerPaths.length + apartmentImages.length;
  const remainingNewSlots = Math.max(
    0,
    MAX_NEW_IMAGES - visibleServerPaths.length,
  );
  const reachedNewLimit = remainingNewSlots === 0;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submitHandler)}
        className="space-y-6 rounded-lg border p-4 text-right"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 justify-items-start">
          <FormField
            control={form.control}
            name="apartmentNumber"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[240px]">
                <FormLabel>رقم الشقة</FormLabel>
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
              <FormItem className="w-full md:max-w-[220px]">
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
              <FormItem className="w-full md:max-w-[240px]">
                <FormLabel>الحالة</FormLabel>
                <Select dir="rtl" value={field.value} onValueChange={field.onChange}>
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
            name="gender"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[220px]">
                <FormLabel>النوع</FormLabel>
                <Select dir="rtl" value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {genderOptions.map((option) => (
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
            name="allocationType"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[220px]">
                <FormLabel>نوع التخصيص</FormLabel>
                <Select dir="rtl" value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر نوع التخصيص" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {allocationTypeOptions.map((option) => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-start">
          <FormField
            control={form.control}
            name="apartmentTypeId"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[260px]">
                <FormLabel>نوع الشقة</FormLabel>
                <Select dir="rtl" value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر نوع الشقة" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    {apartmentTypeOptions.map((option) => (
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
            name="description"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-3xl">
                <FormLabel>وصف الشقة</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    className="w-full md:max-w-3xl text-right placeholder:text-right"
                    placeholder="أدخل وصف الشقة"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">الموقع</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="governorateId"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[260px]">
                  <FormLabel className="font-extrabold">المحافظة</FormLabel>
                  <Popover open={governorateOpen} onOpenChange={setGovernorateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-right font-normal border-2 border-black dark:border-white"
                        >
                          <span className="truncate">
                            {selectedGovernorateLabel || "اختر المحافظة"}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      className="w-[var(--radix-popover-trigger-width)] p-2 border-2 border-black dark:border-white"
                    >
                      <Input
                        value={governorateSearch}
                        onChange={(event) => setGovernorateSearch(event.target.value)}
                        placeholder="ابحث عن المحافظة..."
                        className="mb-2 h-9"
                      />
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {filteredGovernorates.map((option) => (
                          <Button
                            key={option.id}
                            type="button"
                            variant="ghost"
                            className="w-full justify-between text-right"
                            onClick={() => {
                              field.onChange(option.id);
                              form.setValue("cityId", "", {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              });
                              setGovernorateOpen(false);
                              setGovernorateSearch("");
                            }}
                          >
                            <span>{option.nameAr}</span>
                            <Check
                              className={cn(
                                "h-4 w-4",
                                option.id === field.value ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </Button>
                        ))}
                        {filteredGovernorates.length === 0 ? (
                          <p className="py-2 text-center text-sm text-muted-foreground">
                            لا توجد نتائج
                          </p>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[260px]">
                  <FormLabel>المدينة</FormLabel>
                  <Select
                    dir="rtl"
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("cityId", value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      form.clearErrors("cityId");
                    }}
                    disabled={!selectedGovernorate}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                        <SelectValue
                          placeholder={
                            selectedGovernorate
                              ? "اختر المدينة"
                              : "اختر المحافظة أولا"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir="rtl" className="text-right">
                      {availableCities.map((option) => (
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
              name="street"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[300px]">
                  <FormLabel>الشارع</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full"
                      placeholder="الشارع"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buildingNumber"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[220px]">
                  <FormLabel>رقم المبنى</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full"
                      placeholder="رقم المبنى"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[220px]">
                  <FormLabel>الدور</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full"
                      placeholder="الدور"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="detailedAddress"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-xl">
                  <FormLabel>عنوان تفصيلي</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full md:max-w-xl"
                      placeholder="العنوان التفصيلي"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>صور الشقة</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <input
                    ref={(element) => {
                      field.ref(element);
                      apartmentImagesInputRef.current = element;
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
                      setApartmentImageFiles(imageFiles);
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
                                  if (url)
                                    downloadFromUrl(url, basename(path));
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
                      {apartmentImages.map((image, index) => {
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
                                downloadFromUrl(image.previewUrl, image.file.name)
                              }
                              className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="حذف"
                              onClick={() => removeApartmentImageAt(index)}
                              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )})}
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
                      apartmentImagesInputRef.current?.click();
                    }}
                  >
                    <p className="text-lg font-bold text-violet-700">
                      {reachedNewLimit
                        ? "تم الوصول للحد الأقصى من الصور"
                        : totalImageSlots > 0
                          ? "اضغط لإضافة أو استبدال صور جديدة"
                          : "اضغط لاختيار صور الشقة"}
                    </p>
                    <p className="mt-1 text-base font-semibold text-muted-foreground">
                      {totalImageSlots > 0
                        ? `${totalImageSlots} صورة معروضة (${visibleServerPaths.length} محفوظة، ${apartmentImages.length} جديدة) — متبقي ${remainingNewSlots} من أصل ${MAX_NEW_IMAGES} و${MAX_IMAGE_SIZE_LABEL} لكل صورة`
                        : `PNG / JPG / WEBP — حد أقصى ${MAX_NEW_IMAGES} صور و${MAX_IMAGE_SIZE_LABEL} لكل صورة`}
                    </p>
                  </div>

                  {apartmentImages.length > 0 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearNewApartmentImages}
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
              حذف بيانات الشقة
            </Button>
          ) : null}
          <Button
            className="bg-[#00005c] hover:bg-[#00004a] text-white"
            type="submit"
            disabled={loading}
          >
            حفظ بيانات الشقة
          </Button>
        </div>
      </form>
    </Form>
  );
}
