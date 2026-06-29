import { getRequestDetailsReport } from "@/actions/requestService";
import { dataUrlToBlob } from "@/lib/report-blob";

export type RequestDetailsReportPreviewResult =
  | {
      ok: true;
      blob: Blob;
      url: string;
      filename: string;
    }
  | { ok: false; message: string };

export async function fetchRequestDetailsReportPreview(
  requestId: string,
): Promise<RequestDetailsReportPreviewResult> {
  const trimmedId = requestId.trim();
  if (!trimmedId) {
    return { ok: false, message: "معرّف الطلب غير صالح." };
  }

  const result = await getRequestDetailsReport({ requestId: trimmedId });
  if (result && "error" in result) {
    return {
      ok: false,
      message: result.message || "تعذر تحميل نموذج طلب الإقامة.",
    };
  }

  if (!result?.data) {
    return { ok: false, message: "لم يُرجع الخادم ملف التقرير." };
  }

  const blob = await dataUrlToBlob(
    result.data,
    result.contentType || "application/pdf",
  );
  const filename = result.filename?.endsWith(".pdf")
    ? result.filename
    : `${result.filename || "نموذج طلب الإقامة"}.pdf`;
  const url = URL.createObjectURL(blob);

  return { ok: true, blob, url, filename };
}
