"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, Loader2, Trash, X } from "lucide-react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import useToggleState from "@/hooks/use-toggle-state";
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import { getFullFileUrl } from "@/lib/file-viewer";
import { touristMarinaSchema } from "@/schemas";
import {
  addTouristMarina,
  deleteTouristMarinaById,
  softDeleteTouristMarinaById,
  updateTouristMarinaById,
} from "@/actions/basic-data/touristMarinaService";
import { getCities } from "@/actions/settings/cityService";
import { normalizeAllCitiesResponse } from "@/lib/governorate-cities";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastAction } from "@radix-ui/react-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TouristMarinaOrganizationForm from "@/components/basic-data/tourist-marina-organization/tourist-marina-organization-form";
import TouristMarinaOrganizationClient from "@/components/basic-data/tourist-marina-organization/client";
import type { TouristMarinaOrganizationColumn } from "@/components/basic-data/tourist-marina-organization/columns";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { getTouristMarinaOrganizations } from "@/actions/basic-data/touristMarinaOrganizationService";

type FormProps = {
  initialData: unknown | null;
  name: string;
  touristMarinaOrganizationsData?: TouristMarinaOrganizationColumn[] | null;
};
type FormValues = z.infer<typeof touristMarinaSchema>;
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

type LatLngLiteral = google.maps.LatLngLiteral;
type MapClickEvent = google.maps.MapMouseEvent;

const TouristMarinasForm = ({
  initialData,
  name,
  touristMarinaOrganizationsData = null,
}: FormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [ownerPromptOpen, setOwnerPromptOpen] = useState(false);
  const [pendingSavedId, setPendingSavedId] = useState("");
  const data = initialData as {
    id?: string;
    code?: string;
    nameAr?: string;
    nameEn?: string;
    cityId?: string;
    marinaAddress?: string;
    length?: number;
    northSide?: string;
    southSide?: string;
    northGeo?: string;
    eastGeo?: string;
    geoPointId?: string;
    note?: string;
    imageUrl?: string;
  } | null;
  const title = data ? `تعديل ${name}` : `حفظ ${name}`;
  const description = data ? "تعديل" : "حفظ جديد";
  const toastMessage = data ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = data ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/basic-data/tourist-marinas`;
  const isRtl = locale === "ar" || locale.startsWith("ar-");

  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(touristMarinaSchema),
    defaultValues: {
      code: data?.code || "",
      nameAr: data?.nameAr || "",
      nameEn: data?.nameEn || "",
      cityId: data?.cityId || "",
      marinaAddress: data?.marinaAddress || "",
      length: data?.length ?? 0,
      northSide: data?.northSide || "",
      southSide: data?.southSide || "",
      northGeo: data?.northGeo || undefined,
      eastGeo: data?.eastGeo || undefined,
      geoPointId: data?.geoPointId || undefined,
      note: data?.note || "",
      // Keep imageUrl undefined for existing remote URLs.
      // The selected local file is managed in `imageFile` state.
      imageUrl: undefined,
    },
  });

  const [imageFile, setImageFile] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [mapTypeId, setMapTypeId] = useState<"roadmap" | "satellite">(
    "roadmap",
  );
  const [is3DView, setIs3DView] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tourist-marina");
  const [addTouristMarinaOrganizationKey, setAddTouristMarinaOrganizationKey] =
    useState(0);
  const [
    editTouristMarinaOrganizationModalOpen,
    setEditTouristMarinaOrganizationModalOpen,
  ] = useState(false);
  const [
    selectedTouristMarinaOrganization,
    setSelectedTouristMarinaOrganization,
  ] = useState<TouristMarinaOrganizationColumn | null>(null);
  const [marinaOwnerOptions, setMarinaOwnerOptions] = useState<
    { id: string; nameAr: string }[]
  >([]);
  const [touristMarinaOrganizationsRows, setTouristMarinaOrganizationsRows] =
    useState<TouristMarinaOrganizationColumn[]>(touristMarinaOrganizationsData ?? []);
  const [cities, setCities] = useState<{ id: string; nameAr: string }[]>([]);
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();
  const userStorage = useLocalStorage("user");
  const isSuperAdmin = isSuperAdminRoleCandidates(
    userStorage.getItem() as RoleCandidates,
  );

  useEffect(() => {
    setTouristMarinaOrganizationsRows(touristMarinaOrganizationsData ?? []);
  }, [touristMarinaOrganizationsData]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const userData = userStorage.getItem() as
          | { governorateId?: string }
          | undefined;
        const govId = userData?.governorateId ?? "";
        const citiesRes = await getCities(govId);
        if (!citiesRes || citiesRes.error) return;
        const raw = (citiesRes as { data?: unknown }).data ?? citiesRes;
        setCities(normalizeAllCitiesResponse(raw));
      } catch (err) {
        console.error("Error fetching cities:", err);
      }
    };
    fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchMarinaOwners = async () => {
      try {
        const result = await getOwningCompanies(undefined, "OwnerCompany");
        if (!result || (result as { error?: string }).error) return;
        const raw = ((result as { data?: unknown }).data ?? result) as unknown;
        if (!Array.isArray(raw)) return;

        const getCategoryName = (item: Record<string, unknown>) => {
          const category = item.organizationCategory as
            | Record<string, unknown>
            | undefined;
          return (
            (typeof item.organizationCategoryNameAr === "string" &&
              item.organizationCategoryNameAr) ||
            (typeof item.organizationCategoryNameEn === "string" &&
              item.organizationCategoryNameEn) ||
            (typeof item.categoryNameAr === "string" && item.categoryNameAr) ||
            (typeof item.categoryNameEn === "string" && item.categoryNameEn) ||
            (category &&
              typeof category.nameAr === "string" &&
              category.nameAr) ||
            (category &&
              typeof category.nameEn === "string" &&
              category.nameEn) ||
            ""
          ).trim();
        };

        const options = raw
          .map((x) => x as Record<string, unknown>)
          .filter((item) => {
            const rawName = getCategoryName(item);
            const lower = rawName.toLowerCase();
            return (
              rawName.includes("مراسى") ||
              rawName.includes("مراسي") ||
              lower.includes("marina")
            );
          })
          .map((item) => {
            const id = typeof item.id === "string" ? item.id : "";
            const nameAr =
              (typeof item.nameAr === "string" && item.nameAr.trim()) ||
              (typeof item.nameEn === "string" && item.nameEn.trim()) ||
              "";
            return { id, nameAr };
          })
          .filter((item) => item.id && item.nameAr);

        setMarinaOwnerOptions(options);
      } catch (err) {
        console.error("Error fetching marina owner companies:", err);
      }
    };

    void fetchMarinaOwners();
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
        shouldValidate: false,
      });
      return;
    }

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      toast({ variant: "destructive", description: "يُسمح فقط بملفات الصور" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile({ file, previewUrl });
    form.setValue("imageUrl", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  };

  const pickImage = (file: File | null) => setImageAttachment(file);

  const parsedMarker = (() => {
    const lat = Number(form.watch("northGeo"));
    const lng = Number(form.watch("eastGeo"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng } satisfies LatLngLiteral;
  })();

  const mapCenter: LatLngLiteral =
    parsedMarker ??
    ({
      // Aswan
      lat: 24.088938,
      lng: 32.899829,
    } satisfies LatLngLiteral);

  const onMapClick = (e: MapClickEvent) => {
    if (loading) return;
    const lat = e.latLng?.lat();
    const lng = e.latLng?.lng();
    if (lat === undefined || lng === undefined) return;

    form.setValue("northGeo", String(lat), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue("eastGeo", String(lng), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    map.setMapTypeId(mapTypeId);
    map.setTilt(is3DView ? 45 : 0);
  };

  const buildTouristMarinaFormData = (
    values: FormValues,
    options?: { includeId?: string },
  ) => {
    const formData = new FormData();
    if (options?.includeId) formData.append("id", options.includeId);
    if (values.code) formData.append("code", values.code);
    formData.append("nameAr", values.nameAr);
    if (values.nameEn) formData.append("nameEn", values.nameEn);
    formData.append("cityId", values.cityId);
    if (values.marinaAddress) formData.append("marinaAddress", values.marinaAddress);
    formData.append("length", String(values.length));
    formData.append("northSide", values.northSide);
    formData.append("southSide", values.southSide);
    if (values.northGeo) formData.append("northGeo", values.northGeo);
    if (values.eastGeo) formData.append("eastGeo", values.eastGeo);
    if (values.note) formData.append("note", values.note);
    if (values.geoPointId) formData.append("geoPointId", values.geoPointId);
    if (imageFile?.file) formData.append("imageUrl", imageFile.file);
    return formData;
  };

  const toggle3DView = () => {
    setIs3DView((prev) => {
      const next = !prev;
      if (mapRef.current) {
        mapRef.current.setTilt(next ? 45 : 0);
      }
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (activeTab !== "tourist-marina") return;
    if (submitLockRef.current) return;
    try {
      submitLockRef.current = true;
      toggleLoading();

      const formData = buildTouristMarinaFormData(values);

      if (data?.id) {
        formData.append("id", data.id);
        const res = await updateTouristMarinaById(formData);
        if (res?.error) throw new Error(res.message || res.error);
        router.refresh();
        setTimeout(
          () => router.push(`/${params.locale}/basic-data/tourist-marinas`),
          1000,
        );
      } else {
        const res = (await addTouristMarina(formData)) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        const savedId = extractIdFromResponse(res);
        setPendingSavedId(savedId);
        setOwnerPromptOpen(true);
        router.refresh();
      }
      toast({ description: `🎉 ${toastMessage}` });
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
      submitLockRef.current = false;
    }
  };

  const onDelete = async () => {
    if (!data?.id) return;
    try {
      toggleLoading();
      const deleteFn = isSuperAdmin
        ? deleteTouristMarinaById
        : softDeleteTouristMarinaById;
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
        description: isSuperAdmin
          ? "👍👍 تم الحذف بنجاح"
          : "👍👍 تم الحذف (Soft) بنجاح",
        duration: 2000,
      });
      toggleOpen();
      toggleLoading();
      setTimeout(() => {
        router.push(`/${params.locale}/basic-data/tourist-marinas`);
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

  const syncTouristMarinaAfterOrganizationChange = async () => {
    if (!data?.id) return;
    const syncRes = await updateTouristMarinaById(
      buildTouristMarinaFormData(form.getValues(), { includeId: data.id }),
    );
    if (syncRes?.error) {
      toast({
        variant: "destructive",
        description: String(syncRes.message || syncRes.error),
      });
    }
    const result = await getTouristMarinaOrganizations(data.id);
    if (result && !(result as { error?: string }).error) {
      const raw = (result as { data?: unknown }).data ?? result;
      setTouristMarinaOrganizationsRows(
        Array.isArray(raw) ? (raw as TouristMarinaOrganizationColumn[]) : [],
      );
    }
    router.refresh();
  };

  const onSkipOwners = () => {
    setOwnerPromptOpen(false);
    setPendingSavedId("");
    router.push(`/${params.locale}/basic-data/tourist-marinas`);
  };

  const onCompleteOwners = () => {
    setOwnerPromptOpen(false);
    if (pendingSavedId) {
      router.push(`/${locale}/basic-data/tourist-marinas/${pendingSavedId}`);
      setPendingSavedId("");
      return;
    }
    setPendingSavedId("");
    router.push(`/${params.locale}/basic-data/tourist-marinas`);
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
        open={ownerPromptOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onSkipOwners();
            return;
          }
          setOwnerPromptOpen(true);
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={onSkipOwners}
        >
          <DialogHeader>
            <DialogTitle>استكمال بيانات الملاك</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            هل تريد استكمال بيانات ملاك المرسى السياحي الآن؟
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSkipOwners}>
              لا
            </Button>
            <Button type="button" onClick={onCompleteOwners}>
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
      <div className="flex items-center justify-between">
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
        defaultValue="tourist-marina"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full mt-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger type="button" value="tourist-marina">
            بيانات المرسى
          </TabsTrigger>
          <TabsTrigger
            type="button"
            value="tourist-marina-organization"
            disabled={!data?.id}
          >
            ملاك المرسى السياحي
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="tourist-marina"
          className="space-y-6 mt-4 text-start"
        >
          <Form {...form}>
            <form
              onSubmit={(e) => {
                const nativeEvent = e.nativeEvent as SubmitEvent;
                const submitter =
                  nativeEvent.submitter as HTMLButtonElement | null;
                // Guard against accidental submits triggered by non-save controls.
                if (
                  submitter?.dataset?.submitIntent !== "save-tourist-marina"
                ) {
                  e.preventDefault();
                  return;
                }
                void form.handleSubmit(onSubmit)(e);
              }}
              className="w-full"
            >
              <div className="space-y-6">
                <section className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div className="mb-4">
                    <div className="text-lg sm:text-xl font-semibold">
                      الوسائط والموقع
                    </div>
                    <div className="text-sm text-muted-foreground">
                      أضف صورة وحدد الإحداثيات من الخريطة.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem className="self-start h-[320px] mt-14 max-[770px]:mb-7">
                          <FormLabel className="text-base">الصورة</FormLabel>
                          <FormControl>
                            <div className="h-[320px] flex items-center justify-center">
                              <input
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={(el) => {
                                  field.ref(el);
                                  fileInputRef.current = el;
                                }}
                                disabled={loading}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  pickImage(file);
                                  e.target.value = "";
                                  restoreAfterPick();
                                }}
                              />

                              {imageFile ? (
                                <div className="w-full h-full flex flex-col gap-3">
                                  <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40 flex-1 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={imageFile.previewUrl}
                                      alt={
                                        form.getValues("nameAr") ||
                                        "preview-tm-image"
                                      }
                                      className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-1 right-1 flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setViewerOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                        title="عرض"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          pickImage(null);
                                          if (fileInputRef.current)
                                            fileInputRef.current.value = "";
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                        title="إزالة"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-center">
                                    <Button
                                      disabled={loading}
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        triggerFileInputClick(
                                          fileInputRef.current,
                                        )
                                      }
                                    >
                                      تغيير الصورة
                                    </Button>
                                  </div>
                                </div>
                              ) : data?.imageUrl ? (
                                <div className="w-full h-full flex flex-col gap-3">
                                  <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40 flex-1 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={
                                        getFullFileUrl(data.imageUrl) ??
                                        data.imageUrl
                                      }
                                      alt={
                                        form.getValues("nameAr") ||
                                        "existing-tm-image"
                                      }
                                      className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-1 right-1 flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setViewerOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
                                        title="عرض"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div
                                    className="w-full border-2 border-dashed rounded-lg transition-colors duration-200 border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30
                              flex flex-col items-center justify-center cursor-pointer group py-6"
                                    onClick={() =>
                                      triggerFileInputClick(
                                        fileInputRef.current,
                                      )
                                    }
                                  >
                                    <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                      استبدال الصورة
                                    </div>
                                    <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                                      اسحب وأفلت أو اضغط للاختيار
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="w-full h-full border-2 border-dashed rounded-lg transition-colors duration-200
                            border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30
                            flex flex-col items-center justify-center cursor-pointer group"
                                  onClick={() =>
                                    triggerFileInputClick(fileInputRef.current)
                                  }
                                >
                                  <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
                                    <Eye className="w-5 h-5" />
                                  </div>
                                  <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                                    اسحب وأفلت أو اضغط للاختيار
                                  </p>
                                  <p className="text-sm text-blue-500 dark:text-blue-500 mt-1 text-center">
                                    PNG / JPG / WEBP
                                  </p>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3 self-start">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-lg font-medium">الخريطة</div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              mapTypeId === "roadmap" ? "default" : "outline"
                            }
                            disabled={loading}
                            onClick={() => {
                              setMapTypeId("roadmap");
                              mapRef.current?.setMapTypeId("roadmap");
                            }}
                          >
                            {locale === "ar" ? "خريطة" : "Map"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              mapTypeId === "satellite" ? "default" : "outline"
                            }
                            disabled={loading}
                            onClick={() => {
                              setMapTypeId("satellite");
                              mapRef.current?.setMapTypeId("satellite");
                            }}
                          >
                            {locale === "ar" ? "قمر صناعي" : "Satellite"}
                          </Button>
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={is3DView ? "default" : "outline"}
                              disabled={loading}
                              onClick={toggle3DView}
                            >
                              {locale === "ar" ? "3D" : "3D"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => setMapModalOpen(true)}
                          >
                            عرض أكبر
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="northGeo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base">شمال</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  readOnly
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="شمال"
                                  className="text-base"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eastGeo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base">شرق</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  readOnly
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="شرق"
                                  className="text-base"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
                        {mapsLoadError ? (
                          <div className="p-4 text-sm text-destructive">
                            فشل تحميل Google Maps. تأكد من إعداد
                            `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
                          </div>
                        ) : !isMapsLoaded ? (
                          <div className="p-4 text-sm text-muted-foreground">
                            جاري تحميل الخريطة...
                          </div>
                        ) : (
                          <GoogleMap
                            mapContainerStyle={{
                              width: "100%",
                              height: "320px",
                            }}
                            center={mapCenter}
                            zoom={parsedMarker ? 16 : 12}
                            onClick={onMapClick}
                            onLoad={onMapLoad}
                            mapTypeId={mapTypeId}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: true,
                              rotateControl: true,
                              fullscreenControl: false,
                              scrollwheel: true,
                              gestureHandling: "greedy",
                            }}
                          >
                            {parsedMarker && <Marker position={parsedMarker} />}
                          </GoogleMap>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        اضغط على الخريطة لتحديد الموقع.
                      </div>
                    </div>
                  </div>
                </section>

                <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader className="text-center">
                      <DialogTitle className="text-center">
                        صورة المرسي السياحي
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center">
                      {imageFile?.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageFile.previewUrl}
                          alt={form.getValues("nameAr") || "image"}
                          className="max-h-[70vh] w-auto rounded-md border object-contain"
                        />
                      ) : data?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getFullFileUrl(data.imageUrl) ?? data.imageUrl}
                          alt={form.getValues("nameAr") || "image"}
                          className="max-h-[70vh] w-auto rounded-md border object-contain"
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
                  <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] sm:w-[70vw] sm:max-w-[70vw] sm:h-[70vh] p-3 sm:p-4 overflow-y-auto">
                    <DialogHeader className="mb-7">
                      <DialogTitle className="text-lg font-semibold text-center">
                        عرض موسع للخريطة
                      </DialogTitle>
                    </DialogHeader>
                    <div className="h-full min-h-0 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-lg font-medium">الخريطة</div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              mapTypeId === "roadmap" ? "default" : "outline"
                            }
                            disabled={loading}
                            onClick={() => {
                              setMapTypeId("roadmap");
                              mapRef.current?.setMapTypeId("roadmap");
                            }}
                          >
                            {locale === "ar" ? "خريطة" : "Map"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              mapTypeId === "satellite" ? "default" : "outline"
                            }
                            disabled={loading}
                            onClick={() => {
                              setMapTypeId("satellite");
                              mapRef.current?.setMapTypeId("satellite");
                            }}
                          >
                            {locale === "ar" ? "قمر صناعي" : "Satellite"}
                          </Button>
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={is3DView ? "default" : "outline"}
                              disabled={loading}
                              onClick={toggle3DView}
                            >
                              {locale === "ar" ? "3D" : "3D"}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <div className="mb-2 text-base">شمال</div>
                          <Input
                            value={form.watch("northGeo") ?? ""}
                            readOnly
                            disabled={loading}
                            type="text"
                            inputMode="decimal"
                            placeholder="شمال"
                            className="text-base"
                          />
                        </div>
                        <div>
                          <div className="mb-2 text-base">شرق</div>
                          <Input
                            value={form.watch("eastGeo") ?? ""}
                            readOnly
                            disabled={loading}
                            type="text"
                            inputMode="decimal"
                            placeholder="شرق"
                            className="text-base"
                          />
                        </div>
                      </div>

                      <div className="h-[38vh] sm:h-[calc(70vh-220px)] rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
                        {mapsLoadError ? (
                          <div className="p-4 text-sm text-destructive">
                            فشل تحميل Google Maps. تأكد من إعداد
                            `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
                          </div>
                        ) : !isMapsLoaded ? (
                          <div className="p-4 text-sm text-muted-foreground">
                            جاري تحميل الخريطة...
                          </div>
                        ) : (
                          <GoogleMap
                            mapContainerStyle={{
                              width: "100%",
                              height: "100%",
                            }}
                            center={mapCenter}
                            zoom={parsedMarker ? 16 : 12}
                            onClick={onMapClick}
                            onLoad={onMapLoad}
                            mapTypeId={mapTypeId}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: true,
                              rotateControl: true,
                              fullscreenControl: false,
                              scrollwheel: true,
                              gestureHandling: "greedy",
                            }}
                          >
                            {parsedMarker && <Marker position={parsedMarker} />}
                          </GoogleMap>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <section className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="mb-4">
                    <div className="text-lg sm:text-xl font-semibold">
                      البيانات الأساسية
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">الكود</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled
                              readOnly
                              type="text"
                              placeholder="الكود"
                              className="text-base"
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
                          <FormLabel className="text-base">
                            الاسم بالعربية
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الاسم بالعربية"
                              className="text-base"
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
                          <FormLabel className="text-base">
                            الاسم بالإنجليزية
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الاسم بالإنجليزية"
                              className="text-base"
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
                  </div>
                </section>

                <section className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="mb-4">
                    <div className="text-lg sm:text-xl font-semibold">
                      معلومات إضافية
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <FormField
                      control={form.control}
                      name="cityId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">المدينة</FormLabel>
                          <Select
                            disabled={loading}
                            onValueChange={field.onChange}
                            value={field.value}
                            defaultValue={field.value}
                            dir="rtl"
                          >
                            <FormControl>
                              <SelectTrigger className="text-base">
                                <SelectValue
                                  defaultValue={field.value}
                                  placeholder="اختر المدينة"
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem
                                  key={city.id}
                                  value={city.id}
                                  className="text-base"
                                >
                                  {city.nameAr}
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
                      name="marinaAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">
                            موقع المرسي
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="موقع المرسي"
                              className="text-base"
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
                          <FormLabel className="text-base">الطول</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              inputMode="decimal"
                              placeholder="الطول"
                              className="text-base"
                              onChange={(e) =>
                                field.onChange(e.target.value as unknown as any)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-8">
                    <FormField
                      control={form.control}
                      name="northSide"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">
                            الحد البحرى
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الحد البحرى"
                              className="text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="southSide"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">
                            الحد القبلي
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="الحد القبلي"
                              className="text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8">
                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel className="text-base">ملاحظات</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={loading}
                              type="text"
                              placeholder="ملاحظات"
                              className="text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button
                      type="submit"
                      data-submit-intent="save-tourist-marina"
                      disabled={loading}
                      className="text-center h-12 min-w-40 px-8 text-lg"
                    >
                      {loading && <Loader2 className="h-6 w-6" />}
                      {action}
                    </Button>
                  </div>
                </section>
              </div>
            </form>
          </Form>
        </TabsContent>
        <TabsContent
          value="tourist-marina-organization"
          className="space-y-6 mt-4 text-start"
        >
          {data?.id && (
            <>
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <TouristMarinaOrganizationForm
                  key={addTouristMarinaOrganizationKey}
                  initialData={null}
                  name="مالك المرسى السياحي"
                  touristMarinaId={data.id}
                  organizationOptions={marinaOwnerOptions}
                  hideBackButton
                  onSuccess={async () => {
                    await syncTouristMarinaAfterOrganizationChange();
                    setAddTouristMarinaOrganizationKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="mb-8 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h1 className="mb-4 text-2xl font-semibold text-center">
                  قائمة ملاك المرسى السياحي
                </h1>
                <div className="mb-8">
                  <TouristMarinaOrganizationClient
                    data={touristMarinaOrganizationsRows}
                    onEditClick={(row) => {
                      setSelectedTouristMarinaOrganization(row);
                      setEditTouristMarinaOrganizationModalOpen(true);
                    }}
                    onDeleteSuccess={async () => {
                      await syncTouristMarinaAfterOrganizationChange();
                    }}
                  />
                </div>
              </div>
              <Dialog
                open={editTouristMarinaOrganizationModalOpen}
                onOpenChange={setEditTouristMarinaOrganizationModalOpen}
              >
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="my-7">
                    <DialogTitle></DialogTitle>
                  </DialogHeader>
                  {selectedTouristMarinaOrganization && (
                    <TouristMarinaOrganizationForm
                      key={selectedTouristMarinaOrganization.id}
                      initialData={{
                        id: selectedTouristMarinaOrganization.id,
                        licenseNumber:
                          selectedTouristMarinaOrganization.licenseNumber,
                        organizationId:
                          (
                            selectedTouristMarinaOrganization as {
                              organizationId?: string;
                            }
                          ).organizationId ?? "",
                        touristMarinaId: data.id,
                        fromDate: selectedTouristMarinaOrganization.fromDate,
                        toDate: selectedTouristMarinaOrganization.toDate,
                        isActive: selectedTouristMarinaOrganization.isActive,
                      }}
                      name="مالك المرسى السياحي"
                      touristMarinaId={data.id}
                      organizationOptions={marinaOwnerOptions}
                      lockOrganizationId
                      hideBackButton
                      onSuccess={async () => {
                        await syncTouristMarinaAfterOrganizationChange();
                        setEditTouristMarinaOrganizationModalOpen(false);
                        setSelectedTouristMarinaOrganization(null);
                      }}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default TouristMarinasForm;
