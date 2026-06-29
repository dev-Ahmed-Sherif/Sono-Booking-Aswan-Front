"use client";

import { useEffect } from "react";
import { Download, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { triggerDownload } from "@/lib/report-blob";

export type ReportPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  fileUrl: string | null;
  blob: Blob | null;
  filename?: string;
  title?: string;
  onDownloadSuccess?: () => void;
};

export function ReportPreviewDialog({
  open,
  onOpenChange,
  loading = false,
  fileUrl,
  blob,
  filename = "report.pdf",
  title,
  onDownloadSuccess,
}: ReportPreviewDialogProps) {
  useEffect(() => {
    return () => {
      if (fileUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!open && fileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(fileUrl);
    }
  }, [open, fileUrl]);

  const dialogTitle = title || filename || "معاينة التقرير";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col high-z-index"
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="relative flex items-center justify-end">
            <span className="absolute inset-x-0 text-center pointer-events-none">
              {dialogTitle}
            </span>
            <div className="flex gap-2 z-10">
              {blob && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    triggerDownload(blob, filename);
                    onDownloadSuccess?.();
                  }}
                  title="تحميل"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="outline" size="icon" title="إغلاق">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 min-h-[75vh]">
          {loading ? (
            <div className="flex items-center justify-center min-h-[75vh]">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="mr-2 text-gray-600 dark:text-gray-400">
                جاري تحميل التقرير...
              </span>
            </div>
          ) : fileUrl ? (
            <div className="w-full h-[70vh] border rounded-lg overflow-hidden">
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                title={filename}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
