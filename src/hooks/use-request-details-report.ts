"use client";

import { useCallback, useState } from "react";

import type { ReportPreviewDialogProps } from "@/components/report/report-preview-dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchRequestDetailsReportPreview } from "@/lib/request-details-report";

export function useRequestDetailsReport() {
  const { toast } = useToast();
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [reportFilename, setReportFilename] = useState("");

  const resetPreview = useCallback(() => {
    setFileUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setReportBlob(null);
    setReportFilename("");
  }, []);

  const openRequestDetailsReport = useCallback(
    async (requestId: string) => {
      const trimmedId = requestId.trim();
      if (!trimmedId || loadingRequestId) return;

      setLoadingRequestId(trimmedId);
      setLoadingContent(true);
      setViewerOpen(true);
      resetPreview();

      try {
        const result = await fetchRequestDetailsReportPreview(trimmedId);
        if (!result.ok) {
          setViewerOpen(false);
          toast({
            variant: "destructive",
            description: result.message,
          });
          return;
        }

        setReportFilename(result.filename);
        setReportBlob(result.blob);
        setFileUrl(result.url);
      } catch (error: unknown) {
        setViewerOpen(false);
        const message =
          error instanceof Error
            ? error.message
            : "تعذر تحميل نموذج طلب الإقامة.";
        toast({ variant: "destructive", description: message });
      } finally {
        setLoadingContent(false);
        setLoadingRequestId(null);
      }
    },
    [loadingRequestId, resetPreview, toast],
  );

  const isReportLoading = useCallback(
    (requestId: string) => loadingRequestId === requestId.trim(),
    [loadingRequestId],
  );

  const handleViewerOpenChange = useCallback(
    (open: boolean) => {
      setViewerOpen(open);
      if (!open) {
        resetPreview();
      }
    },
    [resetPreview],
  );

  const previewProps: ReportPreviewDialogProps = {
    open: viewerOpen,
    onOpenChange: handleViewerOpenChange,
    loading: loadingContent,
    fileUrl,
    blob: reportBlob,
    filename: reportFilename,
    title: reportFilename || "معاينة نموذج طلب الإقامة",
    onDownloadSuccess: () => {
      toast({ description: "تم تحميل التقرير بنجاح" });
    },
  };

  return {
    openRequestDetailsReport,
    isReportLoading,
    reportLoading: loadingRequestId !== null,
    previewProps,
  };
}
