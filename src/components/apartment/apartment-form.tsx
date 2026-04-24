"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Trash } from "lucide-react";
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
import { apartmentSchema, type ApartmentFormValues } from "@/schemas";

type ApartmentFormProps = {
  defaultValues?: Partial<ApartmentFormValues>;
  onSubmit?: (values: ApartmentFormValues) => void | Promise<void>;
};

export default function ApartmentForm({
  defaultValues,
  onSubmit,
}: ApartmentFormProps) {
  const apartmentImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [apartmentImages, setApartmentImages] = useState<
    Array<{ file: File; previewUrl: string }>
  >([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const form = useForm<ApartmentFormValues>({
    resolver: zodResolver(apartmentSchema),
    defaultValues: {
      apartmentNumber: "",
      apartmentDescription: "",
      roomsCount: 1,
      status: "متاحة",
      allocation: "رجال",
      allocationType: "ثابت",
      location: {
        governorate: "",
        city: "",
        street: "",
        buildingNumber: "",
        floor: "",
        detailedAddress: "",
      },
      apartmentImages: [],
      ...defaultValues,
    },
  });

  const submitHandler = async (values: ApartmentFormValues) => {
    if (onSubmit) await onSubmit(values);
  };

  useEffect(() => {
    return () => {
      apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [apartmentImages]);

  const setApartmentImageFiles = (files: File[]) => {
    apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    const nextImages = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setApartmentImages(nextImages);
    form.setValue(
      "apartmentImages",
      nextImages.map((image) => image.file),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  const removeApartmentImageAt = (index: number) => {
    const target = apartmentImages[index];
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    const nextImages = apartmentImages.filter((_, i) => i !== index);
    setApartmentImages(nextImages);
    form.setValue(
      "apartmentImages",
      nextImages.map((image) => image.file),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  const clearApartmentImages = () => {
    apartmentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setApartmentImages([]);
    form.setValue("apartmentImages", [], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    if (apartmentImagesInputRef.current)
      apartmentImagesInputRef.current.value = "";
  };

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
                    className="w-full"
                    placeholder="أدخل رقم الشقة"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="roomsCount"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[220px]">
                <FormLabel>عدد الغرف</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
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
                    <SelectItem className="text-right" value="متاحة">متاحة</SelectItem>
                    <SelectItem className="text-right" value="محجوزة">محجوزة</SelectItem>
                    <SelectItem className="text-right" value="مشغولة">مشغولة</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="allocation"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[220px]">
                <FormLabel>التخصيص</FormLabel>
                <Select dir="rtl" value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full text-right [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر التخصيص" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir="rtl" className="text-right">
                    <SelectItem className="text-right" value="رجال">رجال</SelectItem>
                    <SelectItem className="text-right" value="سيدات">سيدات</SelectItem>
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
                    <SelectItem className="text-right" value="ثابت">ثابت</SelectItem>
                    <SelectItem className="text-right" value="مرن">مرن</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <FormField
            control={form.control}
            name="apartmentDescription"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-3xl">
                <FormLabel>وصف الشقة</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
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
              name="location.governorate"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[260px]">
                  <FormLabel>المحافظة</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full"
                      placeholder="المحافظة"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location.city"
              render={({ field }) => (
                <FormItem className="w-full md:max-w-[260px]">
                  <FormLabel>المدينة</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="w-full"
                      placeholder="المدينة"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location.street"
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
              name="location.buildingNumber"
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
              name="location.floor"
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
              name="location.detailedAddress"
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
          name="apartmentImages"
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

                  {apartmentImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {apartmentImages.map((image, index) => (
                        <div
                          key={`${image.file.name}-${index}`}
                          className="relative rounded-md border overflow-hidden w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="h-44 w-full object-cover bg-white"
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setViewerSrc(image.previewUrl);
                                setViewerOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeApartmentImageAt(index)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className="w-full min-h-[130px] border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center py-5 border-violet-300 bg-violet-50/50 dark:bg-violet-950/20"
                    onClick={() => apartmentImagesInputRef.current?.click()}
                  >
                    <p className="text-violet-700">
                      {apartmentImages.length > 0
                        ? "اضغط لتغيير صور الشقة"
                        : "اضغط لاختيار صور الشقة"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {apartmentImages.length > 0
                        ? `تم اختيار ${apartmentImages.length} صورة`
                        : "PNG / JPG / WEBP"}
                    </p>
                  </div>

                  {apartmentImages.length > 0 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearApartmentImages}
                      >
                        إزالة الصور المختارة
                      </Button>
                    </div>
                  ) : null}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
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

        <div className="flex justify-start">
          <Button
            className="bg-[#00005c] hover:bg-[#00004a] text-white"
            type="submit"
          >
            حفظ بيانات الشقة
          </Button>
        </div>
      </form>
    </Form>
  );
}
