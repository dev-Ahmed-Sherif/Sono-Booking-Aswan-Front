"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CalendarIcon, X, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

import { useToast } from "@/hooks/use-toast";

import { reportSchema } from "@/schemas";
import { getFloatingUnitTypes } from "@/actions/settings/floatingUnitTypeService";
import { getReport } from "@/actions/basic-data/floatingUnitService";
import useToggleState from "@/hooks/use-toggle-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import jsPDF from "jspdf";
// @ts-ignore - jspdf-autotable types might not be available
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { excelToHtml } from "@/lib/file-viewer";

type ReportsFormValues = z.infer<typeof reportSchema>;

// Helper function to convert Excel to PDF with Arabic support
// Uses HTML conversion first (which preserves Arabic), then converts to PDF using html2canvas
const excelToPdf = async (
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<Blob> => {
  let tempDiv: HTMLDivElement | null = null;

  try {
    // First, convert Excel to HTML (this preserves Arabic text properly)
    const htmlContent = await excelToHtml(arrayBuffer, fileName);

    // Create a temporary container element to render HTML
    tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = "relative";
    tempDiv.style.left = "0";
    tempDiv.style.top = "0";
    tempDiv.style.width = "1123px"; // A4 landscape width in pixels (297mm * 3.7795)
    tempDiv.style.padding = "20px";
    tempDiv.style.fontFamily = "Arial, 'Segoe UI', Tahoma, sans-serif";
    tempDiv.style.fontSize = "10pt";
    tempDiv.style.direction = "rtl";
    tempDiv.style.textAlign = "right";
    tempDiv.style.backgroundColor = "#ffffff";
    tempDiv.style.color = "#000000"; // Black text color
    tempDiv.style.visibility = "visible";
    tempDiv.style.opacity = "1";
    document.body.appendChild(tempDiv);

    // Wait for the DOM to render and images to load
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Use html2canvas to capture the HTML as an image
    const canvas = await html2canvas(tempDiv, {
      scale: 1.5, // Balance between quality and performance
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => {
        // Ensure Arabic fonts and black text color in the cloned document
        const clonedDiv = clonedDoc.querySelector("div");
        if (clonedDiv) {
          clonedDiv.style.fontFamily = "Arial, 'Segoe UI', Tahoma, sans-serif";
          clonedDiv.style.color = "#000000"; // Black text color
        }
        // Also apply black color to all text elements in the cloned document
        const allElements = clonedDoc.querySelectorAll("*");
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            htmlEl.style.color = htmlEl.style.color || "#000000";
          }
        });
      },
    });

    // Validate canvas has content
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error("Failed to capture HTML content - canvas is empty");
    }

    console.log("Canvas dimensions:", canvas.width, "x", canvas.height);

    // Clean up temporary element
    if (tempDiv && tempDiv.parentNode) {
      document.body.removeChild(tempDiv);
      tempDiv = null;
    }

    // Get image dimensions in pixels
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 landscape dimensions in mm
    const pdfWidth = 297; // A4 landscape width
    const pdfHeight = 210; // A4 landscape height

    // Convert pixels to mm (at 96 DPI: 1px = 0.264583mm)
    const pxToMm = 0.264583;
    const imgWidthMm = imgWidth * pxToMm;
    const imgHeightMm = imgHeight * pxToMm;

    // Calculate scale to fit width
    const widthScale = pdfWidth / imgWidthMm;
    const scaledHeightMm = imgHeightMm * widthScale;

    // Create PDF with landscape orientation
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Calculate number of pages needed
    const numPages = Math.max(1, Math.ceil(scaledHeightMm / pdfHeight));
    console.log(
      "Number of pages needed:",
      numPages,
      "Scaled height:",
      scaledHeightMm
    );

    // Convert canvas to image data once
    const imgData = canvas.toDataURL("image/png", 0.95);

    // Add image to PDF, splitting across pages if needed
    if (numPages === 1) {
      // Single page - add entire image
      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        pdfWidth,
        scaledHeightMm,
        undefined,
        "FAST"
      );
    } else {
      // Multiple pages - split the image
      const pageHeightPx = pdfHeight / widthScale / pxToMm; // Height of one page in pixels

      for (let i = 0; i < numPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const sourceY = i * pageHeightPx; // Source Y position in pixels
        const remainingHeight = imgHeight - sourceY;
        const pageHeight = Math.min(pageHeightPx, remainingHeight);

        if (pageHeight <= 0) break; // No more content

        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgWidth;
        pageCanvas.height = pageHeight;
        const ctx = pageCanvas.getContext("2d");

        if (ctx) {
          // Draw the slice from the original canvas
          ctx.drawImage(
            canvas,
            0,
            sourceY,
            imgWidth,
            pageHeight, // Source rectangle
            0,
            0,
            imgWidth,
            pageHeight // Destination rectangle
          );

          // Convert page canvas to image data
          const pageImgData = pageCanvas.toDataURL("image/png", 0.95);

          // Calculate height in mm for this page
          const pageHeightMm = pageHeight * pxToMm * widthScale;

          // Add image slice to PDF
          pdf.addImage(
            pageImgData,
            "PNG",
            0,
            0,
            pdfWidth,
            pageHeightMm,
            undefined,
            "FAST"
          );
        }
      }
    }

    // Convert PDF to Blob
    const pdfData = pdf.output("arraybuffer");
    const pdfBlob = new Blob([pdfData], { type: "application/pdf" });
    console.log(
      "PDF blob created with Arabic support, size:",
      pdfBlob.size,
      "pages:",
      numPages
    );
    return pdfBlob;
  } catch (error) {
    // Clean up temporary element in case of error
    if (tempDiv && tempDiv.parentNode) {
      document.body.removeChild(tempDiv);
    }
    console.error("Error in excelToPdf:", error);
    throw error;
  }
};

const ReportsForm = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, toggleLoading] = useToggleState(false);
  const [floatingUnitTypes, setFloatingUnitTypes] = useState<any[]>([]);

  // File viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<
    "html" | "url" | "text" | "image" | "pdf"
  >("text");
  const [loadingContent, setLoadingContent] = useState(false);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null); // Original blob for download
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null); // PDF blob for preview (if Excel)
  const [reportFilename, setReportFilename] = useState<string>("");

  const form = useForm<ReportsFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      startDate: undefined,
      endDate: undefined,
      technicalJobTypeId: undefined,
      reportName: "",
      reportType: "",
    },
  });

  // Fetch floating unit types
  useEffect(() => {
    const fetchData = async () => {
      try {
        const typesData = await getFloatingUnitTypes();
        if (typesData && !typesData.error) {
          setFloatingUnitTypes(
            Array.isArray(typesData) ? typesData : typesData.data || []
          );
        }
      } catch (error) {
        console.error("Error fetching floating unit types:", error);
        toast({
          variant: "destructive",
          description: "حدث خطأ في تحميل أنواع الوحدات العائمة",
        });
      }
    };

    fetchData();
  }, [toast]);

  // Cleanup blob URLs when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      if (fileContent && fileContent.startsWith("blob:")) {
        URL.revokeObjectURL(fileContent);
      }
    };
  }, [fileContent]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!viewerOpen) {
      if (fileContent && fileContent.startsWith("blob:")) {
        URL.revokeObjectURL(fileContent);
      }
      setFileContent(null);
      setPreviewBlob(null);
    }
  }, [viewerOpen, fileContent]);

  const onSubmit = async (data: ReportsFormValues) => {
    try {
      toggleLoading();
      console.log(data);

      const result = await getReport({
        startDate: data.startDate,
        endDate: data.endDate,
        technicalJobTypeId: data.technicalJobTypeId,
        reportName: data.reportName,
        reportType: data.reportType,
      });
      console.log("result :", result);
      if (result?.error) {
        toast({
          variant: "destructive",
          description: result.message || "حدث خطأ في جلب التقرير",
        });
        return;
      }

      // Handle blob preview from base64 data URL
      if (result?.data) {
        try {
          // result.data is a base64 data URL (e.g., "data:application/pdf;base64,...")
          // Convert to Blob for preview
          const response = await fetch(result.data);
          const blob = await response.blob();
          const filename =
            result.filename || `تقرير المهام الفنية.${data.reportType}`;

          setReportFilename(filename);
          setLoadingContent(true);
          setViewerOpen(true);
          setFileContent(null);

          // Determine file type and prepare content for preview
          if (data.reportType === "excel" || data.reportType === "xls") {
            // For Excel files: convert to PDF for preview, but keep original Excel for download
            try {
              const arrayBuffer = await blob.arrayBuffer();

              // Store original Excel blob for download
              setReportBlob(blob);

              // Convert Excel to PDF for preview
              const pdfBlob = await excelToPdf(arrayBuffer, filename);
              setPreviewBlob(pdfBlob);

              // Create URL for PDF preview (pdfBlob already has correct MIME type)
              const pdfUrl = URL.createObjectURL(pdfBlob);
              setFileContent(pdfUrl);
              setFileContentType("pdf");
            } catch (error) {
              console.error("Error converting Excel to PDF:", error);
              // Fallback: use original Excel blob
              setReportBlob(blob);
              setPreviewBlob(null);
              const url = URL.createObjectURL(blob);
              setFileContent(url);
              setFileContentType("url");
            }
          } else if (data.reportType === "pdf") {
            // For PDF files, use blob URL for both preview and download
            setFileContentType("pdf");
            setReportBlob(blob);
            setPreviewBlob(null);
            const url = URL.createObjectURL(blob);
            setFileContent(url);
          } else {
            // Fallback for other types
            setFileContentType("url");
            setReportBlob(blob);
            setPreviewBlob(null);
            const url = URL.createObjectURL(blob);
            setFileContent(url);
          }

          toast({
            description: `تم إنشاء التقرير بنجاح. يمكنك معاينته قبل التحميل`,
          });
        } catch (previewError: any) {
          console.error("Error preparing report preview:", previewError);
          toast({
            variant: "destructive",
            description: "حدث خطأ أثناء تحضير التقرير للمعاينة",
          });
        } finally {
          setLoadingContent(false);
        }
      }
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        variant: "destructive",
        description: error?.message || "حصل خطأ ما",
      });
    } finally {
      toggleLoading();
    }
  };

  return (
    <>
      <div className="p-2 sm:p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <Heading title="إنشاء تقرير" description="قم بإنشاء تقرير جديد" />
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-4 sm:space-y-6 md:space-y-8 w-full min-h-[calc(100vh-13rem)] pb-12 sm:pb-16 md:pb-20 px-2 sm:px-4 md:px-6 relative"
        >
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            {/* Report Information Section */}
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
                          disabled={loading}
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                              <SelectValue placeholder="اختر اسم التقرير" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TechnicalJobReport">
                              تقرير المهام الفنية
                            </SelectItem>
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
                        نوع التقرير
                      </FormLabel>
                      <FormControl>
                        <Select
                          disabled={loading}
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                              <SelectValue placeholder="اختر نوع التقرير" />
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
                <FormField
                  control={form.control}
                  name="technicalJobTypeId"
                  render={({ field }) => (
                    <FormItem className="space-y-2 sm:space-y-3 md:col-span-2">
                      <FormLabel className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                        نوع المهمة الفنية (اختياري)
                      </FormLabel>
                      <FormControl>
                        <Select
                          disabled={loading}
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="text-sm sm:text-base border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 h-9 sm:h-10 md:h-11">
                              <SelectValue placeholder="اختر نوع المهمة الفنية" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {floatingUnitTypes.length > 0 ? (
                              floatingUnitTypes.map((type: any) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.nameAr || type.name}
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
              </div>
            </div>

            {/* Date Range Section */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200/50 dark:border-purple-800/50">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-purple-900 dark:text-purple-100">
                  الفترة الزمنية
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {/* Start Date */}
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
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-between text-right font-normal hover:bg-purple-50 dark:hover:bg-purple-950/20 border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-sm sm:text-base h-9 sm:h-10 md:h-11",
                                  !field.value && "text-muted-foreground"
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

                {/* End Date */}
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
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-between text-right font-normal hover:bg-purple-50 dark:hover:bg-purple-950/20 border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-sm sm:text-base h-9 sm:h-10 md:h-11",
                                  !field.value && "text-muted-foreground"
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
              </div>
            </div>
          </div>
          <div className="flex justify-center pt-4 sm:pt-5 md:pt-6">
            <Button
              disabled={loading}
              type="submit"
              className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50"
            >
              {loading && (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
              )}
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              إرسال
            </Button>
          </div>
        </form>
      </Form>

      {/* File Viewer Dialog */}
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
                        const url = URL.createObjectURL(reportBlob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = reportFilename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast({
                          description: `تم تحميل التقرير بنجاح`,
                        });
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
              <>
                {fileContentType === "pdf" ? (
                  // PDF viewer
                  <div className="w-full h-[70vh] border rounded-lg overflow-hidden">
                    <iframe
                      src={fileContent}
                      className="w-full h-full border-0"
                      title={reportFilename}
                    />
                  </div>
                ) : fileContentType === "html" ? (
                  // HTML content (Excel converted to HTML)
                  <div className="w-full min-h-[75vh] border rounded-lg overflow-auto p-6 bg-white dark:bg-gray-900">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: fileContent }}
                      style={{
                        direction: "rtl",
                        textAlign: "right",
                        minHeight: "75vh",
                      }}
                    />
                    <style jsx global>{`
                      /* Excel table styling */
                      .excel-viewer {
                        width: 100%;
                        min-height: 100%;
                      }
                      .sheet-container {
                        margin-bottom: 2rem;
                        min-height: 200px;
                      }
                      .excel-viewer table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 1rem 0;
                        font-size: 0.875rem;
                        min-width: 100%;
                        table-layout: auto;
                      }
                      .excel-viewer table th,
                      .excel-viewer table td {
                        border: 1px solid #d1d5db;
                        padding: 0.75rem;
                        text-align: right;
                        vertical-align: top;
                        word-wrap: break-word;
                      }
                      .excel-viewer table th {
                        background-color: #f3f4f6;
                        font-weight: 600;
                        color: #111827;
                      }
                      .excel-viewer table tr:nth-child(even) {
                        background-color: #f9fafb;
                      }
                      .excel-viewer table tr:hover {
                        background-color: #f3f4f6;
                      }
                      /* Dark mode for Excel tables */
                      .dark .excel-viewer table th,
                      .dark .excel-viewer table td {
                        border-color: #4b5563;
                        color: #e5e7eb;
                      }
                      .dark .excel-viewer table th {
                        background-color: #374151;
                        color: #f9fafb;
                      }
                      .dark .excel-viewer table tr:nth-child(even) {
                        background-color: #1f2937;
                      }
                      .dark .excel-viewer table tr:hover {
                        background-color: #374151;
                      }
                    `}</style>
                  </div>
                ) : fileContentType === "url" ? (
                  // Other file types - try to display in iframe
                  <div className="w-full h-[70vh] border rounded-lg overflow-hidden">
                    <iframe
                      src={fileContent}
                      className="w-full h-full border-0"
                      title={reportFilename}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportsForm;
