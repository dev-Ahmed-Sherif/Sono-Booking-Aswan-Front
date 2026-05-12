export const MAX_NEW_IMAGES = 5;
export const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;
export const MAX_IMAGE_SIZE_LABEL = "1 ميجابايت";

export type UnitImageFilterResult = {
  accepted: File[];
  oversized: File[];
  overflowedCount: number;
};

/** Apply unit-image upload constraints: per-file size cap + remaining-slots cap. */
export function filterUnitImageFiles(
  files: File[],
  maxNew: number = MAX_NEW_IMAGES,
): UnitImageFilterResult {
  const cap = Math.max(0, maxNew);
  const oversized = files.filter((file) => file.size > MAX_IMAGE_SIZE_BYTES);
  const validSize = files.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);
  const accepted = validSize.slice(0, cap);
  const overflowedCount = Math.max(0, validSize.length - cap);
  return { accepted, oversized, overflowedCount };
}
