"use client";

import { useState } from "react";
import { Eye, FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getFullFileUrl } from "@/lib/file-viewer";
import { pathLooksLikeImage, mimeTypeFromFileName } from "@/lib/image-file";
import type { HousingRequestAttachmentSnapshot } from "@/lib/housing-request-detail";

function isPdfAttachment(attachment: HousingRequestAttachmentSnapshot): boolean {
  const ext = (attachment.extension ?? "").toLowerCase();
  const name = attachment.fileName.toLowerCase();
  return ext === ".pdf" || ext === "pdf" || name.endsWith(".pdf");
}

function isImageAttachment(
  attachment: HousingRequestAttachmentSnapshot,
): boolean {
  if (pathLooksLikeImage(attachment.fileName)) return true;
  if (pathLooksLikeImage(attachment.url)) return true;
  const mime = mimeTypeFromFileName(attachment.fileName);
  return mime.startsWith("image/");
}

export type RequestSavedAttachmentsListProps = {
  attachments: HousingRequestAttachmentSnapshot[];
  /** When false, list is read-only (view modal). */
  showUploadHint?: boolean;
  /** Show delete button per row (edit modal). */
  editable?: boolean;
  disabled?: boolean;
  onRemove?: (attachment: HousingRequestAttachmentSnapshot) => void;
};

export function RequestSavedAttachmentsList({
  attachments,
  showUploadHint = false,
  editable = false,
  disabled = false,
  onRemove,
}: RequestSavedAttachmentsListProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (attachments.length === 0) {
    if (!showUploadHint) return null;
    return (
      <p className="text-sm text-muted-foreground">لا توجد مرفقات محفوظة.</p>
    );
  }

  const previewAttachment =
    previewIndex != null ? attachments[previewIndex] : undefined;
  const previewUrl = previewAttachment
    ? getFullFileUrl(previewAttachment.url) ?? previewAttachment.url
    : undefined;
  const previewIsImage = previewAttachment
    ? isImageAttachment(previewAttachment)
    : false;
  const previewIsPdf = previewAttachment
    ? isPdfAttachment(previewAttachment)
    : false;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="space-y-1">
        <Label className="text-sm font-semibold text-slate-900">
          مرفقات الطلب المحفوظة
        </Label>
        <p className="text-xs leading-relaxed text-slate-600">
          {attachments.length.toLocaleString("ar-EG")} مرفق
          {showUploadHint ? " — يمكنك إضافة مرفقات جديدة أدناه" : ""}
        </p>
      </div>

      <ul className="space-y-2">
        {attachments.map((attachment, index) => {
          const displayUrl =
            getFullFileUrl(attachment.url) ?? attachment.url;
          const isImage = isImageAttachment(attachment);
          const key = `${attachment.id}-${attachment.attachmentId}-${index}`;

          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
            >
              {isImage && displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUrl}
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
                  {attachment.fileName}
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
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-slate-500 hover:text-rose-600"
                  disabled={disabled}
                  onClick={() => {
                    if (previewIndex === index) setPreviewIndex(null);
                    onRemove?.(attachment);
                  }}
                  aria-label="حذف المرفق"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={previewIndex != null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {previewAttachment ? previewAttachment.fileName : "معاينة المرفق"}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && previewAttachment ? (
            previewIsImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewAttachment.fileName}
                className="mx-auto max-h-[70vh] object-contain"
              />
            ) : previewIsPdf ? (
              <iframe
                src={previewUrl}
                className="h-[70vh] w-full rounded-md border"
                title={previewAttachment.fileName}
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
