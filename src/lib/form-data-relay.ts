/** Copy multipart entries from an incoming HTTP FormData for backend relay. */
export function relayFormDataEntries(source: FormData): FormData {
  const target = new FormData();
  for (const [key, value] of source.entries()) {
    if (typeof value === "string") {
      target.append(key, value);
      continue;
    }
    if (value.size > 0) {
      target.append(key, value, value.name || "upload.bin");
    }
  }
  return target;
}

/**
 * Re-buffer file parts before forwarding to the ASP.NET API.
 * Node axios/fetch relays can drop streams unless bytes are materialized.
 */
export async function relayFormDataEntriesAsync(
  source: FormData,
): Promise<FormData> {
  const target = new FormData();
  for (const [key, value] of source.entries()) {
    if (typeof value === "string") {
      target.append(key, value);
      continue;
    }
    const bytes = await value.arrayBuffer();
    if (bytes.byteLength === 0) continue;
    const blob = new Blob([bytes], {
      type: value.type || "application/octet-stream",
    });
    target.append(key, blob, value.name || "upload.bin");
  }
  return target;
}

/** True when FormData contains at least one non-empty file entry. */
export function formDataHasFileEntries(source: FormData): boolean {
  for (const [, value] of source.entries()) {
    if (typeof value !== "string" && value.size > 0) {
      return true;
    }
  }
  return false;
}
