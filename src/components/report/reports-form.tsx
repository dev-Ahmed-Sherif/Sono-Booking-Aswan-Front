"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CalendarIcon, X, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as z from "zod";

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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import useToggleState from "@/hooks/use-toggle-state";

import { reportSchema } from "@/schemas";
import { getReservationReport } from "@/actions/reservationService";
import { getRequestReport } from "@/actions/requestService";
import { getReservationStatuses } from "@/actions/settings/reservationStatusService";

type ReportsFormValues = z.infer<typeof reportSchema>;

const REPORT_OPTIONS = [
  { value: "ReservationDetailsReport", label: "تقرير تفاصيل الحجوزات" },
  { value: "RequestReport", label: "تقرير الطلبات" },
] as const;

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ReportsForm = () => {
  const { toast } = useToast();
  const [loading, toggleLoading] = useToggleState(false);
  const [previewLoading, togglePreviewLoading] = useToggleState(false);
  const [reservationStatuses, setReservationStatuses] = useState<
    Array<{ id: string | number; nameAr?: string; name?: string }>
  >([]);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [reportFilename, setReportFilename] = useState<string>("");

  const form = useForm<ReportsFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      startDate: undefined,
      endDate: undefined,
      reservationStatus: undefined,
      reportName: "",
      reportType: "",
    },
  });

  const selectedReportName = form.watch("reportName");

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const result = await getReservationStatuses();
        if (result && !("error" in result)) {
          const list = Array.isArray(result)
            ? result
            : (result as { data?: unknown[] }).data || [];
          setReservationStatuses(
            list as Array<{ id: string | number; nameAr?: string; name?: string }>,
          );
        }
      } catch (error) {
        console.error("Error fetching reservation statuses:", error);
      }
    };

    fetchStatuses();
  }, []);

  useEffect(() => {
    return () => {
      if (fileContent?.startsWith("blob:")) {
        URL.revokeObjectURL(fileContent);
      }
    };
  }, [fileContent]);

  useEffect(() => {
    if (!viewerOpen && fileContent?.startsWith("blob:")) {
      URL.revokeObjectURL(fileContent);
      setFileContent(null);
      setReportBlob(null);
    }
  }, [viewerOpen, fileContent]);

  const fetchReport = async (reportType: string) => {
    const data = form.getValues();

    if (data.reportName === "ReservationDetailsReport") {
      return getReservationReport({
        startDate: data.startDate,
        endDate: data.endDate,
        reportName: data.reportName,
        reportType,
        reservationStatus: data.reservationStatus,
      });
    }

    if (data.reportName === "RequestReport") {
      return getRequestReport({
        startDate: data.startDate,
        endDate: data.endDate,
        reportName: data.reportName,
        reportType,
      });
    }

    return {
      error: "Validation Error",
      message: "يرجى اختيار اسم التقرير",
    };
  };

  const handleDownload = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    try {
      toggleLoading();
      const data = form.getValues();
      const result = await fetchReport(data.reportType);

      if (result && "error" in result) {
        toast({
          variant: "destructive",
          description: result.message || "حدث خطأ في جلب التقرير",
        });
        return;
      }

      if (result?.data) {
        const blob = await dataUrlToBlob(result.data);
        const filename = result.filename || "report";
        triggerDownload(blob, filename);
        toast({ description: "تم تحميل التقرير بنجاح" });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "حصل خطأ ما";
      toast({ variant: "destructive", description: message });
    } finally {
      toggleLoading();
    }
  };

  const handlePreview = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    try {
      togglePreviewLoading();
      setLoadingContent(true);
      setViewerOpen(true);
      setFileContent(null);
      setReportBlob(null);

      const result = await fetchReport("pdf");

      if (result && "error" in result) {
        setViewerOpen(false);
        toast({
          variant: "destructive",
          description: result.message || "حدث خطأ في جلب التقرير",
        });
        return;
      }

      if (result?.data) {
        const blob = await dataUrlToBlob(result.data);
        const filename = result.filename || "report.pdf";
        const url = URL.createObjectURL(blob);

        setReportFilename(filename);
        setReportBlob(blob);
        setFileContent(url);
      }
    } catch (error: unknown) {
      setViewerOpen(false);
      const message =
        error instanceof Error ? error.message : "حصل خطأ ما";
      toast({ variant: "destructive", description: message });
    } finally {
      setLoadingContent(false);
      togglePreviewLoading();
    }
  };

  const isBusy = loading || previewLoading;

  return (
    <>
      <div className="p-2 sm:p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <Heading title="إنشاء تقرير" description="قم بإنشاء تقرير جديد" />
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col space-y-4 sm:space-y-6 md:space-y-8 w-full min-h-[calc(100vh-13rem)] pb-12 sm:pb-16 md:pb-20 px-2 sm:px-4 md:px-6 relative"
        >
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-blue-900 dark:text-blue-100">
                  معلومات التقرير
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                <FormField
                  control={form.control}
                  name="reportName"
                  render={({ field }) => (
                    <FormItem className="space-y-2 sm:space-y-3">
                      <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                        اسم التقرير
                      </FormLabel>
                      <FormControl>
                        <Select
                          disabled={isBusy}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "ReservationDetailsReport") {
                              form.setValue("reservationStatus", undefined);
                            }
                          }}
                          value={field.value || ""}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                              <SelectValue placeholder="اختر اسم التقرير" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REPORT_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem className="space-y-2 sm:space-y-3">
                      <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                        نوع الملف للتحميل
                      </FormLabel>
                      <FormControl>
                        <Select
                          disabled={isBusy}
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                              <SelectValue placeholder="اختر نوع الملف" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedReportName === "ReservationDetailsReport" && (
                  <FormField
                    control={form.control}
                    name="reservationStatus"
                    render={({ field }) => (
                      <FormItem className="space-y-2 sm:space-y-3 md:col-span-2">
                        <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                          حالة الحجز (اختياري)
                        </FormLabel>
                        <FormControl>
                          <Select
                            disabled={isBusy}
                            onValueChange={field.onChange}
                            value={field.value || ""}
                            dir="rtl"
                          >
                            <FormControl>
                              <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                                <SelectValue placeholder="اختر حالة الحجز" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {reservationStatuses.length > 0 ? (
                                reservationStatuses.map((status) => (
                                  <SelectItem
                                    key={String(status.id)}
                                    value={String(status.id)}
                                  >
                                    {status.nameAr || status.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-data" disabled>
                                  لا توجد بيانات
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200/50 dark:border-purple-800/50">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-purple-900 dark:text-purple-100">
                  الفترة الزمنية
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                <div className="bg-white dark:bg-gray-800/50 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-sm">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                          تاريخ البداية
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-between text-right font-normal hover:bg-purple-50 dark:hover:bg-purple-950/20 border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-sm sm:text-base h-9 sm:h-10 md:h-11",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                <span className="truncate">
                                  {field.value
                                    ? format(field.value, "PPP")
                                    : "اختر تاريخ البداية"}
                                </span>
                                <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 opacity-50 ml-2 flex-shrink-0" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date("1900-01-01")
                              }
                              captionLayout="dropdown"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-white dark:bg-gray-800/50 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-sm">
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                          تاريخ النهاية
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-between text-right font-normal hover:bg-purple-50 dark:hover:bg-purple-950/20 border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-sm sm:text-base h-9 sm:h-10 md:h-11",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                <span className="truncate">
                                  {field.value
                                    ? format(field.value, "PPP")
                                    : "اختر تاريخ النهاية"}
                                </span>
                                <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 opacity-50 ml-2 flex-shrink-0" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date("1900-01-01")}
                              captionLayout="dropdown"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 sm:pt-5 md:pt-6">
            <Button
              type="button"
              disabled={isBusy}
              onClick={handlePreview}
              variant="outline"
              className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-semibold"
            >
              {previewLoading && (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
              )}
              <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              معاينة
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={handleDownload}
              className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loading && (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
              )}
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              تحميل
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col high-z-index"
          hideCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle className="relative flex items-center justify-end">
              <span className="absolute inset-x-0 text-center pointer-events-none">
                {reportFilename || "معاينة التقرير"}
              </span>
              <div className="flex gap-2 z-10">
                {reportBlob && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (reportBlob) {
                        triggerDownload(reportBlob, reportFilename);
                        toast({ description: "تم تحميل التقرير بنجاح" });
                      }
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
            {loadingContent ? (
              <div className="flex items-center justify-center min-h-[75vh]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="mr-2 text-gray-600 dark:text-gray-400">
                  جاري تحميل التقرير...
                </span>
              </div>
            ) : fileContent ? (
              <div className="w-full h-[70vh] border rounded-lg overflow-hidden">
                <iframe
                  src={fileContent}
                  className="w-full h-full border-0"
                  title={reportFilename}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportsForm;
