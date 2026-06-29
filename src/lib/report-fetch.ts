import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";

export type ReportFetchParams = {
  startDate: Date | string;
  endDate: Date | string;
  reportName: string;
  reportType: string;
  reservationStatus?: string | number;
  requestId?: string;
};

type ReportSuccess = {
  data: string;
  contentType: string;
  filename: string;
};

type ReportError = {
  error: string;
  message: string;
};

export type ReportFetchResult = ReportSuccess | ReportError;

function formatDate(date: Date | string): string {
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const str = String(date).trim();
  if (!str) return str;

  // Calendar date selected in the UI — send as-is to the API.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return str;
}

function normalizeReportType(reportType: string): string {
  const upper = reportType.trim().toUpperCase();
  if (upper === "EXCEL" || upper === "XLS") return "EXCEL";
  return "PDF";
}

function extractErrorMessage(data: unknown): string | undefined {
  if (!data) return undefined;

  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return undefined;
    try {
      return extractErrorMessage(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  if (data instanceof ArrayBuffer) {
    return extractErrorMessage(Buffer.from(data).toString("utf8"));
  }

  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    const direct = d.message ?? d.Message ?? d.title ?? d.Title;
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }

  return undefined;
}

function parseFilename(
  contentDisposition: string | undefined,
  defaultName: string,
  reportType: string,
): string {
  if (!contentDisposition) {
    return `${defaultName}.${reportType === "EXCEL" ? "xls" : "pdf"}`;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
  if (utf8Match) {
    const decodedFilename = decodeURIComponent(utf8Match[1]);
    const fileExtension = decodedFilename.split(".").pop() || reportType;
    return `${defaultName}.${fileExtension}`;
  }

  const filenameMatch = contentDisposition.match(
    /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
  );
  if (filenameMatch) {
    const raw = filenameMatch[1].replace(/['"]/g, "").trim().split(";")[0].trim();
    const fileExtension = raw.split(".").pop() || reportType;
    return `${defaultName}.${fileExtension}`;
  }

  return `${defaultName}.${reportType === "EXCEL" ? "xls" : "pdf"}`;
}

export async function fetchReportBlob(
  endpointUrl: string,
  params: ReportFetchParams,
  defaultArabicFilename: string,
): Promise<ReportFetchResult> {
  const { startDate, endDate, reportName, reportType, reservationStatus, requestId } =
    params;

  if (!startDate || !endDate || !reportName || !reportType) {
    return {
      error: "Validation Error",
      message: "startDate, endDate, reportName, and reportType are required.",
    };
  }

  const apiBase = process.env.BACK_END?.trim();
  if (!apiBase) {
    return {
      error: "Configuration Error",
      message: "عنوان الخادم غير مهيأ (BACK_END).",
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
    };
  }

  const normalizedReportType = normalizeReportType(reportType);

  const query = new URLSearchParams();
  query.append("StartDate", formatDate(startDate));
  query.append("EndDate", formatDate(endDate));
  query.append("ReportName", String(reportName));
  query.append("ReportType", normalizedReportType);

  if (
    reservationStatus !== undefined &&
    reservationStatus !== null &&
    reservationStatus !== ""
  ) {
    query.append("ReservationStatus", String(reservationStatus));
  }

  if (requestId !== undefined && requestId !== null && String(requestId).trim()) {
    query.append("RequestId", String(requestId).trim());
  }

  const url = endpointUrl.startsWith("http")
    ? `${endpointUrl}?${query.toString()}`
    : `${apiBase.replace(/\/$/, "")}/${endpointUrl.replace(/^\//, "")}?${query.toString()}`;

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(res.data);
    if (!buffer || buffer.length === 0) {
      return {
        error: "Empty Response",
        message: "The server returned an empty file.",
      };
    }

    const contentType = res.headers["content-type"] || "application/pdf";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;
    const filename = parseFilename(
      res.headers["content-disposition"],
      defaultArabicFilename,
      normalizedReportType,
    );

    return { data: dataUrl, contentType, filename };
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    const bodyMessage = extractErrorMessage(err.response?.data);

    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: bodyMessage || "Authentication failed. Please login again.",
      };
    }

    if (err.response?.status === 400) {
      return {
        error: "Bad Request",
        message:
          bodyMessage ||
          "Invalid request parameters. Please check your input.",
      };
    }

    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message:
          bodyMessage ||
          "Report endpoint not found. Ensure the API is deployed with GetReport support.",
      };
    }

    return {
      error: "Failed to get report",
      message: bodyMessage || err.message || "An unexpected error occurred",
    };
  }
}
