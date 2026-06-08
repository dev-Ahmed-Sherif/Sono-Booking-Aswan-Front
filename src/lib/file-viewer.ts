import * as XLSX from "xlsx";

import { mimeTypeFromFileName } from "@/lib/image-file";

// Type for local files
export type LocalFile = { file: File; previewUrl?: string; id?: string };

// Helper function to convert File to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to convert Excel to HTML (better Arabic support than PDF)
export const excelToHtml = async (
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<string> => {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  let htmlContent =
    '<div class="excel-viewer" dir="rtl" style="width: 100%; overflow-x: auto; font-family: Arial, "Segoe UI", Tahoma, sans-serif;">';

  // Process each sheet
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    if (sheetIndex > 0) {
      htmlContent +=
        '<div class="sheet-separator" style="margin: 2rem 0; border-top: 2px solid #ccc; padding-top: 2rem;"></div>';
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to HTML table with proper Arabic support
    // sheet_to_html preserves text encoding by default, including Arabic characters
    const htmlTable = XLSX.utils.sheet_to_html(worksheet, {
      id: `sheet-${sheetIndex}`,
      editable: false,
    });

    // Wrap table in a container with sheet name and ensure RTL direction
    htmlContent += `<div class="sheet-container" style="margin-bottom: 2rem; direction: rtl; text-align: right;">`;
    htmlContent += `<h3 style="margin-bottom: 1rem; font-size: 1.25rem; font-weight: bold; text-align: right; direction: rtl;">${sheetName}</h3>`;
    // Add RTL and Arabic text support to the table
    htmlContent += htmlTable.replace(
      "<table",
      '<table style="direction: rtl; text-align: right; font-family: Arial, "Segoe UI", Tahoma, sans-serif;"'
    );
    htmlContent += `</div>`;
  });

  htmlContent += "</div>";
  return htmlContent;
};

// Helper function to convert relative URLs to full URLs with backend base URL
export const getFullFileUrl = (
  url: string | undefined | null
): string | undefined => {
  if (!url) return undefined;

  // If URL is already a full URL (starts with http:// or https://), return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If URL is a blob URL, return as is
  if (url.startsWith("blob:")) {
    return url;
  }

  // For relative URLs, extract the Attach/ part
  // Remove leading slash if present
  const cleanUrl = url.startsWith("/") ? url.substring(1) : url;

  // Find the "Attach/" part in the URL
  const attachIndex = cleanUrl.indexOf("Attach/");
  if (attachIndex !== -1) {
    // Extract everything from "Attach/" onwards
    const attachPath = cleanUrl.substring(attachIndex);

    // Use NEXT_PUBLIC_BACK_END_DEV for client-side access, fallback to localhost:57950
    const backendBaseUrl =
      process.env.NEXT_PUBLIC_BACK_END || "http://localhost:57950";

    // Combine base URL with the Attach/ path
    return `${backendBaseUrl}/${attachPath}`;
  }

  // If "Attach/" not found, use the original URL (fallback)
  const backendBaseUrl =
    process.env.NEXT_PUBLIC_BACK_END || "http://localhost:57950";

  return `${backendBaseUrl}/${cleanUrl}`;
};

// Helper function to convert attachments from initialData to LocalFile format
export const convertAttachmentsToLocalFiles = (
  attachs: any[] | null | undefined
): LocalFile[] => {
  if (!attachs || !Array.isArray(attachs) || attachs.length === 0) {
    return [];
  }

  return attachs.map((attach, index) => {
    // If attach is a string (URL), create a placeholder File and use URL as preview
    if (typeof attach === "string") {
      const url = attach;
      const fullUrl = getFullFileUrl(url);
      const fileName = url.split("/").pop() || `file-${index}`;
      const mimeType = (() => {
        const imageMime = mimeTypeFromFileName(fileName);
        if (imageMime !== "application/octet-stream") return imageMime;
        const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
        const documentMimeTypes: Record<string, string> = {
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xls: "application/vnd.ms-excel",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
        return documentMimeTypes[fileExtension] || "application/octet-stream";
      })();
      const isImage = mimeType.startsWith("image/");

      // Create a placeholder File object
      const placeholderFile = new File([], fileName, { type: mimeType });

      return {
        file: placeholderFile,
        previewUrl: fullUrl, // Use full URL
        id: undefined, // No ID available for string attachments
      };
    }

    // If attach is an object with file information
    if (typeof attach === "object" && attach !== null) {
      const fileName = attach.name || attach.fileName || `file-${index}`;
      const fileUrl = attach.url || attach.path || attach.filePath;
      const fullUrl = getFullFileUrl(fileUrl);
      const attachId = attach.attachId || attach.attachmentId;
      const mimeType =
        attach.type || attach.mimeType || "application/octet-stream";
      const isImage = mimeType.startsWith("image/");

      // Create a placeholder File object
      const placeholderFile = new File([], fileName, { type: mimeType });

      return {
        file: placeholderFile,
        previewUrl: fullUrl, // Use full URL
        id: attachId,
      };
    }

    // Fallback: create empty file
    return {
      file: new File([], `file-${index}`, { type: "application/octet-stream" }),
    };
  });
};
