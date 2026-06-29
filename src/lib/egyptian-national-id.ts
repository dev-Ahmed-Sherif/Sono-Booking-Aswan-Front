/** Valid Egyptian national-ID governorate codes (digits 8–9, 0-indexed 7–8). */
export const EGYPTIAN_GOVERNORATE_CODES = new Set([
  "01", // القاهرة
  "02", // الإسكندرية
  "03", // بورسعيد
  "04", // السويس
  "11", // دمياط
  "12", // الدقهلية
  "13", // الشرقية
  "14", // القليوبية
  "15", // كفر الشيخ
  "16", // الغربية
  "17", // المنوفية
  "18", // البحيرة
  "19", // الإسماعيلية
  "21", // الجيزة
  "22", // بني سويف
  "23", // الفيوم
  "24", // المنيا
  "25", // أسيوط
  "26", // سوهاج
  "27", // قنا
  "28", // أسوان
  "29", // الأقصر
  "31", // البحر الأحمر
  "32", // الوادي الجديد
  "33", // مطروح
  "34", // شمال سيناء
  "35", // جنوب سيناء
  "88", // المولودون خارج جمهورية مصر العربية
]);

/** Century, birth date (YYMMDD); governorate checked separately via {@link EGYPTIAN_GOVERNORATE_CODES}. */
const EGYPTIAN_NATIONAL_ID_BASE_REGEX =
  /^[23]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{7}$/;

export const EGYPTIAN_NATIONAL_ID_REGEX = EGYPTIAN_NATIONAL_ID_BASE_REGEX;

export const EGYPTIAN_NATIONAL_ID_MESSAGE =
  "الرقم القومي يجب أن يبدأ بـ 2 أو 3، وأن يكون الشهر بين 01 و 12، وأن يكون اليوم صالحًا، وأن يكون كود المحافظة (الرقمين 8 و 9) من الأكواد المعتمدة أو 88 للمولودين خارج مصر، ويتكون من 14 رقمًا";

export function egyptianNationalIdGovernorateCode(
  value: string,
): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9) return undefined;
  return digits.slice(7, 9);
}

export function isValidEgyptianNationalId(value: string): boolean {
  const digits = value.trim().replace(/\D/g, "");
  if (!EGYPTIAN_NATIONAL_ID_BASE_REGEX.test(digits)) return false;

  const governorate = digits.slice(7, 9);
  return EGYPTIAN_GOVERNORATE_CODES.has(governorate);
}

/** بطاقة شخصية / شهادة ميلاد use the 14-digit Egyptian national ID format. */
export function documentTypeRequiresEgyptianNationalId(
  documentType: string | undefined,
): boolean {
  return documentType === "IDCard" || documentType === "ResidencePermit";
}
