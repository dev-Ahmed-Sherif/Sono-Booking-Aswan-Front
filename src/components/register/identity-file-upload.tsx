"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Trash } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getFullFileUrl } from "@/lib/file-viewer";

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "1 ميجابايت";

const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".pdf",
] as const;

const isImageFile = (file: File): boolean =>
  (file.type || "").toLowerCase().startsWith("image/");

const isAllowedFile = (file: File): boolean => {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (type.startsWith("image/") || type === "application/pdf") return true;
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

/** Path or URL string — extension only, ignores query string. */
const urlLooksLikeImage = (url: string): boolean => {
  const path = url.split("?")[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(path);
};

const urlLooksLikePdf = (url: string): boolean =>
  url.split("?")[0].toLowerCase().endsWith(".pdf");

type IdentityFileUploadProps = {
  value?: File;
  onChange: (file: File | undefined) => void;
  disabled?: boolean;
  /**
   * Saved document path/URL (e.g. `CompanionDto.DocumentImageUrl`, `Attach/...`).
   * Shown when no new `File` is selected.
   */
  existingDocumentUrl?: string;
};

export function IdentityFileUpload({
  value,
  onChange,
  disabled,
  existingDocumentUrl,
}: IdentityFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { toast } = useToast();

  const resolvedExistingUrl = useMemo(() => {
    const raw = existingDocumentUrl?.trim();
    if (!raw) return undefined;
    return getFullFileUrl(raw) ?? raw;
  }, [existingDocumentUrl]);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleSelect = (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedFile(file)) {
      toast({
        variant: "destructive",
        title: "نوع ملف غير مسموح",
        description: "يُسمح برفع الصور أو ملفات PDF فقط",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        variant: "destructive",
        title: "حجم الملف كبير",
        description: `الحد الأقصى لحجم الملف ${MAX_FILE_SIZE_LABEL}.`,
      });
      return;
    }
    onChange(file);
  };

  const clearFile = () => {
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadCurrent = () => {
    if (!value || !previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = value.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openExistingInNewTab = () => {
    if (resolvedExistingUrl) window.open(resolvedExistingUrl, "_blank", "noopener,noreferrer");
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
  };

  const hasNewFile = Boolean(value);
  /** New file blocks picking another until cleared; saved URL alone does not. */
  const reachedLimit = hasNewFile;
  const showServerPreview = !value && Boolean(resolvedExistingUrl);

  const viewerSrc = hasNewFile && previewUrl ? previewUrl : resolvedExistingUrl;
  const viewerIsImage = hasNewFile && value
    ? isImageFile(value)
    : resolvedExistingUrl
      ? urlLooksLikeImage(resolvedExistingUrl)
      : false;
  const viewerIsPdf = hasNewFile && value
    ? !isImageFile(value)
    : resolvedExistingUrl
      ? urlLooksLikePdf(resolvedExistingUrl)
      : false;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          handleSelect(file);
          event.target.value = "";
        }}
      />

      {hasNewFile && value ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative rounded-md border overflow-hidden w-full border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
            {isImageFile(value) && previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={value.name}
                className="h-44 w-full object-cover bg-white"
              />
            ) : (
              <div className="h-44 w-full flex flex-col items-center justify-center bg-white px-3">
                <FileText className="h-14 w-14 text-rose-600" />
                <p className="mt-2 text-sm font-semibold text-gray-700 line-clamp-1 max-w-full text-center">
                  {value.name}
                </p>
              </div>
            )}
            <div className="absolute top-2 left-2 flex gap-1">
              <button
                type="button"
                title="عرض"
                onClick={() => {
                  if (previewUrl) setViewerOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="تحميل"
                onClick={downloadCurrent}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="حذف"
                onClick={clearFile}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : showServerPreview && resolvedExistingUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative rounded-md border overflow-hidden w-full border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
            {urlLooksLikeImage(resolvedExistingUrl) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolvedExistingUrl}
                alt="مستند محفوظ"
                className="h-44 w-full object-cover bg-white"
              />
            ) : (
              <div className="h-44 w-full flex flex-col items-center justify-center bg-white px-3">
                <FileText className="h-14 w-14 text-rose-600" />
                <p className="mt-2 text-sm font-semibold text-gray-700 text-center">
                  مستند محفوظ
                </p>
              </div>
            )}
            <div className="absolute top-2 left-2 flex gap-1">
              <button
                type="button"
                title="عرض"
                onClick={() => setViewerOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="فتح / تحميل"
                onClick={openExistingInNewTab}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded opacity-90 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`w-full min-h-[130px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-5 border-violet-300 bg-violet-50/50 dark:bg-violet-950/20 ${
          reachedLimit || disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer"
        }`}
        onClick={() => {
          if (reachedLimit || disabled) return;
          inputRef.current?.click();
        }}
      >
        <p className="text-lg font-bold text-violet-700">
          {reachedLimit
            ? "تم اختيار ملف جديد — احذفه لاستبداله أو للإبقاء على المستند المحفوظ"
            : showServerPreview
              ? "اضغط لاستبدال صورة البطاقة / شهادة الميلاد (اختياري)"
              : "اضغط لاختيار صورة البطاقة / شهادة الميلاد"}
        </p>
        <p className="mt-1 text-base font-semibold text-muted-foreground">
          {`PNG / JPG / PDF — حد أقصى ملف واحد و${MAX_FILE_SIZE_LABEL}`}
        </p>
      </div>

      <Dialog open={viewerOpen} onOpenChange={handleViewerOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>معاينة الملف</DialogTitle>
          </DialogHeader>
          {viewerSrc ? (
            viewerIsImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={viewerSrc}
                alt=""
                className="max-h-[70vh] mx-auto object-contain"
              />
            ) : viewerIsPdf ? (
              <iframe
                src={viewerSrc}
                className="w-full h-[70vh]"
                title={hasNewFile && value ? value.name : "document"}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                  معاينة هذا النوع غير متاحة هنا. استخدم زر الفتح في نافذة جديدة.
                </p>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => window.open(viewerSrc, "_blank", "noopener,noreferrer")}
                >
                  فتح الملف
                </button>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IdentityFileUpload;
