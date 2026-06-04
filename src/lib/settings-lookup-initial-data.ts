export type SettingsLookupInitialData =
  | ({ id?: string; code?: string; nameAr?: string; nameEn?: string } & Record<
      string,
      unknown
    >)
  | null;

export function settingsLookupFromApiResult(
  result: unknown,
): SettingsLookupInitialData {
  if (!result || typeof result !== "object") return null;
  if ("error" in result && (result as { error?: string }).error) return null;
  const payload =
    "data" in result && (result as { data?: unknown }).data != null
      ? (result as { data: unknown }).data
      : result;
  return payload && typeof payload === "object"
    ? (payload as NonNullable<SettingsLookupInitialData>)
    : null;
}
