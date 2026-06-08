/** Standard `accept` value for image-only file inputs. */
export const IMAGE_FILE_ACCEPT = "image/*";

/** Common image extensions (lowercase, without dot). */
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "pjpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "svgz",
  "ico",
  "tif",
  "tiff",
  "heic",
  "heif",
  "heics",
  "heifs",
  "avif",
  "apng",
  "xpm",
  "ppm",
  "pgm",
  "pbm",
  "pnm",
  "psd",
  "ai",
  "eps",
  "jxl",
  "jp2",
  "j2k",
  "jpf",
  "jpx",
  "jpm",
  "mj2",
  "raw",
  "cr2",
  "nef",
  "orf",
  "sr2",
  "dng",
  "arw",
  "rw2",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  svgz: "image/svg+xml",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  heics: "image/heic",
  heifs: "image/heif",
  avif: "image/avif",
  apng: "image/apng",
  jxl: "image/jxl",
  jp2: "image/jp2",
};

/** Extension from a file name or URL path (ignores query/hash). */
export function getFileExtension(pathOrName: string): string {
  const base = pathOrName.split("?")[0].split("#")[0];
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function isImageExtension(extension: string): boolean {
  return IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

/** True when the file is an image (MIME or extension). */
export function isImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return isImageExtension(getFileExtension(file.name || ""));
}

/** True when a path/URL points to an image (by extension). */
export function pathLooksLikeImage(pathOrUrl: string): boolean {
  return isImageExtension(getFileExtension(pathOrUrl));
}

export function mimeTypeFromFileName(fileName: string): string {
  const ext = getFileExtension(fileName);
  if (MIME_BY_EXTENSION[ext]) return MIME_BY_EXTENSION[ext];
  if (isImageExtension(ext)) return `image/${ext}`;
  return "application/octet-stream";
}

export function filterImageFiles(files: File[]): File[] {
  return files.filter(isImageFile);
}
