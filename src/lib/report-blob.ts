export async function dataUrlToBlob(
  dataUrl: string,
  fallbackType = "application/pdf",
): Promise<Blob> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (
    blob.type &&
    blob.type !== "application/octet-stream" &&
    blob.type !== "text/plain"
  ) {
    return blob;
  }
  return new Blob([await blob.arrayBuffer()], { type: fallbackType });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
