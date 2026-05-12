"use client";

import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, Loader2, Trash, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import AlertModal from "@/components/modals/alert-modal";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import useToggleState from "@/hooks/use-toggle-state";
import { useRestoreFullscreenAfterFilePick } from "@/hooks/useRestoreFullscreenAfterFilePick";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";
import { governateSchema } from "@/schemas";
import {
  addGovernorateMultipart,
  deleteGovernorateById,
  softDeleteGovernorateById,
  updateGovernorateById,
  updateGovernorateMultipartById,
} from "@/actions/settings/governorateService";
import { ToastAction } from "@radix-ui/react-toast";
import { getFullFileUrl } from "@/lib/file-viewer";
import { cn } from "@/lib/utils";
import type { GovernorateCityRow } from "@/lib/governorate-cities";
import CityForm from "@/components/settings/cities/city-form";
import CityClient from "@/components/settings/cities/client";
import type { CityColumn } from "@/components/settings/cities/columns";

type GovernorateFormProps = {
  initialData: unknown | null;
  name: string;
  citiesData?: GovernorateCityRow[] | null;
};
type GovernorateFormValues = z.infer<typeof governateSchema>;

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

const GovernorateForm = ({
  initialData,
  name,
  citiesData = null,
}: GovernorateFormProps) => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const user = useLocalStorage("user");
  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [activeTab, setActiveTab] = useState("geha");
  const [cityPromptOpen, setCityPromptOpen] = useState(false);
  const [pendingSavedId, setPendingSavedId] = useState("");
  const [addCityKey, setAddCityKey] = useState(0);
  const [editCityModalOpen, setEditCityModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityColumn | null>(null);
  const postUpdateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const data = initialData as {
    id?: string;
    code?: string;
    nameAr?: string;
    nameEn?: string;
    address?: string;
    websiteUrl?: string;
    imageUrl?: string;
  } | null;
  const title = data ? `تعديل ${name}` : `حفظ ${name}`;
  const description = data ? "تعديل" : "حفظ جديد";
  const toastMessage = data ? "تم التعديل بنجاح" : "تم الحفظ بنجاح";
  const toastMessageError = "هذا البيان موجود من قبل";
  const action = data ? "تعديل" : "حفظ";
  const locale = (params.locale as string) ?? "ar";
  const listBackPath = `/${locale}/settings/governorates`;
  const isRtl = locale === "ar" || locale.startsWith("ar-");
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

  const form = useForm<GovernorateFormValues>({
    resolver: zodResolver(governateSchema),
    defaultValues: {
      id: data?.id,
      code: data?.code || "",
      nameAr: data?.nameAr || "",
      nameEn: data?.nameEn || "",
      address: data?.address || "",
      websiteUrl: data?.websiteUrl || "",
      imageUrl: undefined,
    },
  });

  const [imageFile, setImageFile] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { restoreAfterPick, triggerFileInputClick } =
    useRestoreFullscreenAfterFilePick();

  const citiesForClient = useMemo((): CityColumn[] => {
    if (!data?.id) return [];
    return (citiesData ?? []).map((c) => ({ ...c, governorateId: data.id }));
  }, [citiesData, data?.id]);

  useEffect(() => {
    return () => {
      clearPostUpdateIdleTimer();
      if (imageFile?.previewUrl) URL.revokeObjectURL(imageFile.previewUrl);
    };
  }, [imageFile?.previewUrl]);

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

  const pickImage = (file: File | null) => {
    setImageAttachment(file);
  };

  const buildGovernorateFormData = (values: GovernorateFormValues) => {
    const fd = new FormData();
    if (data?.id) fd.append("id", data.id);
    fd.append("nameAr", values.nameAr);
    fd.append("nameEn", values.nameEn);
    fd.append("code", values.code);
    if (values.address) fd.append("address", values.address);
    if (values.websiteUrl) fd.append("websiteUrl", values.websiteUrl);
    // Use selected local file as source of truth for upload.
    if (imageFile?.file) fd.append("imageUrl", imageFile.file);
    return fd;
  };

  const onSubmit = async (values: GovernorateFormValues) => {
    try {
      toggleLoading();
      let savedId = "";
      if (data?.id) {
        const res = imageFile?.file
          ? ((await updateGovernorateMultipartById(
              buildGovernorateFormData(values),
            )) as SaveResponse)
          : ((await updateGovernorateById({
              id: data.id,
              nameAr: values.nameAr,
              nameEn: values.nameEn,
            })) as SaveResponse);
        if (res?.error) throw new Error(res.message || res.error);
        startPostUpdateIdleTimer();
      } else {
        const res = (await addGovernorateMultipart(
          buildGovernorateFormData(values),
        )) as SaveResponse;
        if (res?.error) throw new Error(res.message || res.error);
        savedId = extractIdFromResponse(res);
      }
      router.refresh();
      toast({ description: `🎉 ${toastMessage}` });
      const hasNoCities = !Array.isArray(citiesData) || citiesData.length === 0;
      const shouldOpenCityPrompt = !data?.id || hasNoCities;
      if (shouldOpenCityPrompt) {
        setPendingSavedId(savedId);
        setCityPromptOpen(true);
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
    }
  };

  const syncGovernorateAfterCityChange = async () => {
    if (!data?.id) return;
    try {
      const values = form.getValues();
      const res = imageFile?.file
        ? ((await updateGovernorateMultipartById(
            buildGovernorateFormData(values),
          )) as SaveResponse)
        : ((await updateGovernorateById({
            id: data.id,
            nameAr: values.nameAr,
            nameEn: values.nameEn,
          })) as SaveResponse);
      if (res?.error) {
        toast({
          variant: "destructive",
          description: String(
            res.message || res.error || "تعذر مزامنة بيانات المحافظة",
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

  const onSkipCities = () => {
    clearPostUpdateIdleTimer();
    setCityPromptOpen(false);
    setPendingSavedId("");
    router.push(listBackPath);
  };

  const onCompleteCities = () => {
    clearPostUpdateIdleTimer();
    setCityPromptOpen(false);
    if (data?.id) return;
    if (pendingSavedId) {
      router.push(`/${locale}/basic-data/governorate/${pendingSavedId}`);
      setPendingSavedId("");
      return;
    }
    toast({
      variant: "destructive",
      description: "تم الحفظ ولكن تعذر فتح صفحة المدن.",
      duration: 3000,
    });
    setPendingSavedId("");
    router.push(listBackPath);
  };

  const onDelete = async () => {
    if (!data?.id) return;
    try {
      toggleLoading();
      const superAdmin = isSuperAdminRoleCandidates(
        user.getItem() as RoleCandidates,
      );
      const deleteFn = superAdmin
        ? deleteGovernorateById
        : softDeleteGovernorateById;
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
        open={cityPromptOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onSkipCities();
            return;
          }
          setCityPromptOpen(true);
        }}
      >
        <DialogContent className="max-w-md" onPointerDownOutside={onSkipCities}>
          <DialogHeader>
            <DialogTitle>استكمال بيانات المدن</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            هل تريد استكمال بيانات المدن الآن؟
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSkipCities}>
              لا
            </Button>
            <Button type="button" onClick={onCompleteCities}>
              نعم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editCityModalOpen}
        onOpenChange={(open) => {
          setEditCityModalOpen(open);
          if (!open) setSelectedCity(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="my-7">
            <DialogTitle></DialogTitle>
          </DialogHeader>
          {selectedCity && data?.id ? (
            <CityForm
              key={selectedCity.id}
              initialData={{
                id: selectedCity.id,
                code: selectedCity.code,
                nameAr: selectedCity.nameAr,
                nameEn: selectedCity.nameEn,
                governorateId: data.id,
              }}
              name="مدينة"
              governorateId={data.id}
              hideBackButton
              onSuccess={async () => {
                clearPostUpdateIdleTimer();
                await syncGovernorateAfterCityChange();
                setEditCityModalOpen(false);
                setSelectedCity(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">شعار المحافظة</DialogTitle>
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
              <div className="text-sm text-muted-foreground">لا توجد شعار</div>
            )}
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
          if (value === "madin") clearPostUpdateIdleTimer();
        }}
        className="w-full mt-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="geha">المحافظة</TabsTrigger>
          <TabsTrigger value="madin" disabled={!data?.id}>
            المدن
          </TabsTrigger>
        </TabsList>
        <TabsContent value="geha" className="space-y-6 mt-4 text-start">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8 w-full"
            >
              <div className="space-y-6">
                <section className="rounded-lg border p-4 sm:p-6 space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold">
                    البيانات الأساسية
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-1 lg:order-2">
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({
                          field: {
                            onChange: _onChange,
                            value: _value,
                            ref,
                            ...rest
                          },
                        }) => (
                          <FormItem>
                            <FormControl>
                              <div>
                                <input
                                  {...rest}
                                  ref={(el) => {
                                    ref(el);
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
                                  <div className="space-y-4">
                                    <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={imageFile.previewUrl}
                                        alt={
                                          form.getValues("nameAr") ||
                                          "preview-governorate-image"
                                        }
                                        className="w-full h-80 object-contain bg-white"
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
                                          pickImage(e.dataTransfer.files[0]);
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
                                        تغيير الشعار
                                      </div>
                                      <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                                        اسحب وأفلت أو اضغط للاختيار
                                      </div>
                                    </div>
                                  </div>
                                ) : data?.imageUrl ? (
                                  <div className="space-y-4">
                                    <div className="relative group border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-900/40">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={
                                          getFullFileUrl(data.imageUrl) ??
                                          data.imageUrl
                                        }
                                        alt={
                                          form.getValues("nameAr") ||
                                          "existing-governorate-image"
                                        }
                                        className="w-full h-80 object-contain bg-white"
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
                                          pickImage(e.dataTransfer.files[0]);
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
                                        استبدال الشعار
                                      </div>
                                      <div className="text-xs text-blue-500 dark:text-blue-500 mt-1 text-center">
                                        اسحب وأفلت أو اضغط للاختيار
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      "w-full min-h-[320px] border-2 border-dashed rounded-lg transition-colors duration-200",
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
                                        pickImage(e.dataTransfer.files[0]);
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
                                    <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
                                      <Eye className="w-5 h-5" />
                                    </div>
                                    <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                                      اسحب وأفلت الشعار هنا أو اضغط للاختيار
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
                    </div>
                    <div className="lg:col-span-2 lg:order-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2 text-center">
                              <FormLabel>الكود</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  type="text"
                                  placeholder="الكود"
                                  inputMode="numeric"
                                  maxLength={2}
                                  pattern="[0-9]*"
                                  className="text-center"
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

                                    if (
                                      e.key.length === 1 &&
                                      !/^\d$/.test(e.key)
                                    ) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    const onlyDigits = e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 2);
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
                                      // Arabic letters + spaces + hyphen only.
                                      const isAllowed =
                                        /^[\u0600-\u06FF\s-]$/.test(e.key);
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
                                      // English letters + spaces + hyphen only.
                                      const isAllowed = /^[A-Za-z\s-]$/.test(
                                        e.key,
                                      );
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
                          name="address"
                          render={({ field }) => (
                            <FormItem>
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
                        <FormField
                          control={form.control}
                          name="websiteUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الموقع الإلكتروني</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={loading}
                                  type="url"
                                  placeholder="https://example.com"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </section>
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
        <TabsContent value="madin" className="space-y-6 mt-4 text-start">
          {data?.id && (
            <>
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <CityForm
                  key={addCityKey}
                  initialData={null}
                  name="مدينة"
                  governorateId={data.id}
                  hideBackButton
                  onSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncGovernorateAfterCityChange();
                    setAddCityKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="mb-8 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h3 className="mb-4 text-base font-semibold text-center">
                  قائمة المدن
                </h3>
                <CityClient
                  data={citiesForClient}
                  hideBackButton
                  onEditClick={(row) => {
                    clearPostUpdateIdleTimer();
                    setSelectedCity(row);
                    setEditCityModalOpen(true);
                  }}
                  onDeleteSuccess={async () => {
                    clearPostUpdateIdleTimer();
                    await syncGovernorateAfterCityChange();
                  }}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default GovernorateForm;
