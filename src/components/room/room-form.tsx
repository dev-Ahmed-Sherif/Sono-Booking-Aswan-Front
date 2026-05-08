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
import { roomSchema, type RoomFormValues } from "@/schemas";

type RoomFormProps = {
  defaultValues?: Partial<RoomFormValues>;
  statusOptions?: string[];
  onSubmit?: (values: RoomFormValues) => void | Promise<void>;
};

export default function RoomForm({
  defaultValues,
  statusOptions = ["متاح", "محجوز", "مشغول"],
  onSubmit,
}: RoomFormProps) {
  const preferredStatus = statusOptions.includes("متاح")
    ? "متاح"
    : statusOptions[0];

  const roomImageInputRef = useRef<HTMLInputElement | null>(null);
  const [roomImage, setRoomImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      roomNumber: "",
      roomDescription: "",
      bedsCount: 1,
      status: (preferredStatus as RoomFormValues["status"] | undefined) || "متاح",
      roomImage: undefined,
      ...defaultValues,
    },
  });

  const submitHandler = async (values: RoomFormValues) => {
    if (onSubmit) await onSubmit(values);
  };

  useEffect(() => {
    return () => {
      if (roomImage?.previewUrl) URL.revokeObjectURL(roomImage.previewUrl);
    };
  }, [roomImage]);

  const setRoomImageAttachment = (file: File | null) => {
    if (roomImage?.previewUrl) URL.revokeObjectURL(roomImage.previewUrl);
    if (!file || !file.type.startsWith("image/")) {
      setRoomImage(null);
      form.setValue("roomImage", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setRoomImage({ file, previewUrl });
    form.setValue("roomImage", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submitHandler)}
        className="space-y-6 rounded-lg border p-4 text-right"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="roomNumber"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[240px]">
                <FormLabel>رقم الغرفة</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="w-full"
                    placeholder="أدخل رقم الغرفة"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bedsCount"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-[220px]">
                <FormLabel>عدد الأسرة</FormLabel>
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
                    {statusOptions.map((option) => (
                      <SelectItem
                        key={option}
                        className="text-right"
                        value={option}
                      >
                        {option}
                      </SelectItem>
                    ))}
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
            name="roomDescription"
            render={({ field }) => (
              <FormItem className="w-full md:max-w-3xl">
                <FormLabel>وصف الغرفة</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    className="w-full md:max-w-3xl text-right placeholder:text-right"
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
          name="roomImage"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>صورة الغرفة</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <input
                    ref={(element) => {
                      field.ref(element);
                      roomImageInputRef.current = element;
                    }}
                    name={field.name}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      setRoomImageAttachment(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />

                  {roomImage ? (
                    <div className="relative rounded-md border overflow-hidden w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={roomImage.previewUrl}
                        alt={roomImage.file.name}
                        className="h-56 w-full object-contain bg-white"
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
                            setRoomImageAttachment(null);
                            if (roomImageInputRef.current)
                              roomImageInputRef.current.value = "";
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full min-h-[130px] border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center py-5 border-violet-300 bg-violet-50/50 dark:bg-violet-950/20"
                      onClick={() => roomImageInputRef.current?.click()}
                    >
                      <p className="text-violet-700">
                        اضغط لاختيار صورة الغرفة
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        PNG / JPG / WEBP
                      </p>
                    </div>
                  )}

                  {roomImage ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoomImageAttachment(null);
                          if (roomImageInputRef.current)
                            roomImageInputRef.current.value = "";
                        }}
                      >
                        إزالة الصورة
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
            {roomImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={roomImage.previewUrl}
                alt={roomImage.file.name}
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
            حفظ بيانات الغرفة
          </Button>
        </div>
      </form>
    </Form>
  );
}
