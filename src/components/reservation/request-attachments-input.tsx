"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileText, Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isImageFile } from "@/lib/image-file";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
  MAX_NEW_IMAGES,
} from "@/lib/unit-image-constraints";

const ACCEPT = "image/*,.pdf,application/pdf";

function isAllowedAttachment(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return isImageFile(file) || type === "application/pdf" || name.endsWith(".pdf");
}

function isPdfFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

export type RequestAttachmentsInputProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

export function RequestAttachmentsInput({
  files,
  onChange,
  disabled,
}: RequestAttachmentsInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const objectUrlByIndex = useMemo(() => {
    return files.map((file) => URL.createObjectURL(file));
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlByIndex) {
        URL.revokeObjectURL(url);
      }
    };
  }, [objectUrlByIndex]);

  useEffect(() => {
    if (previewIndex != null && previewIndex >= files.length) {
      setPreviewIndex(null);
    }
  }, [files.length, previewIndex]);

  const previewFile = previewIndex != null ? files[previewIndex] : undefined;
  const previewUrl =
    previewIndex != null ? objectUrlByIndex[previewIndex] : undefined;
  const previewIsImage = previewFile ? isImageFile(previewFile) : false;
  const previewIsPdf = previewFile ? isPdfFile(previewFile) : false;

  const handlePick = (picked: FileList | null) => {
    if (!picked?.length || disabled) return;

    const next = [...files];
    const rejectedType: string[] = [];
    const oversized: string[] = [];

    for (const file of Array.from(picked)) {
      if (!isAllowedAttachment(file)) {
        rejectedType.push(file.name);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        oversized.push(file.name);
        continue;
      }
      if (next.length >= MAX_NEW_IMAGES) break;
      next.push(file);
    }

    if (rejectedType.length > 0) {
      toast({
        variant: "destructive",
        title: "نوع ملف غير مسموح",
        description: "يُسمح برفع الصور أو ملفات PDF فقط",
      });
    }
    if (oversized.length > 0) {
      toast({
        variant: "destructive",
        title: "حجم الملف كبير",
        description: `الحد الأقصى ${MAX_IMAGE_SIZE_LABEL} لكل مرفق`,
      });
    }
    if (next.length >= MAX_NEW_IMAGES && picked.length > next.length - files.length) {
      toast({
        title: "الحد الأقصى للمرفقات",
        description: `يمكنك إرفاق ${MAX_NEW_IMAGES} ملفات كحد أقصى`,
      });
    }

    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-4">
      <div className="space-y-1">
        <Label className="text-sm font-semibold text-slate-900">
          مرفقات الطلب (اختياري)
        </Label>
        <p className="text-xs leading-relaxed text-slate-600">
          صور أو PDF — حتى {MAX_NEW_IMAGES} ملفات، {MAX_IMAGE_SIZE_LABEL} لكل
          ملف
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={disabled || files.length >= MAX_NEW_IMAGES}
        className="sr-only"
        onChange={(e) => handlePick(e.target.files)}
      />

      <Button
        type="button"
        variant="outline"
        disabled={disabled || files.length >= MAX_NEW_IMAGES}
        className="w-full rounded-xl border-slate-300 bg-white"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="ms-2 h-4 w-4 shrink-0" />
        {files.length > 0 ? "إضافة مرفقات أخرى" : "اختر المرفقات"}
      </Button>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => {
            const previewUrl = objectUrlByIndex[index];
            const key = `${file.name}-${file.size}-${file.lastModified}-${index}`;
            return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
            >
              {isImageFile(file) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                  <FileText className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-slate-500 hover:text-blue-600"
                disabled={disabled}
                onClick={() => setPreviewIndex(index)}
                aria-label="معاينة المرفق"
                title="معاينة"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-slate-500 hover:text-rose-600"
                disabled={disabled}
                onClick={() => removeAt(index)}
                aria-label="حذف المرفق"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog
        open={previewIndex != null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {previewFile ? previewFile.name : "معاينة المرفق"}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && previewFile ? (
            previewIsImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewFile.name}
                className="mx-auto max-h-[70vh] object-contain"
              />
            ) : previewIsPdf ? (
              <iframe
                src={previewUrl}
                className="h-[70vh] w-full rounded-md border"
                title={previewFile.name}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  معاينة هذا النوع غير متاحة هنا.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(previewUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  فتح الملف
                </Button>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
