import UnitDataScreen from "@/components/unit-data/unit-data-screen";
import { getCities } from "@/actions/basic-data/cityService";
import { getGovernorates } from "@/actions/basic-data/governorateService";
import { getGenders } from "@/actions/settings/genderService";
import { getAllocationTypes } from "@/actions/settings/allocationTypeService";
import { getUnitStatuses } from "@/actions/settings/unitStatusService";
import { normalizeAllCitiesResponse } from "@/lib/governorate-cities";
import { normalizeNumericLookupList } from "@/lib/numeric-lookup";

type PageProps = { params: { locale: string; id: string } };
type LookupOption = { id: string; nameAr: string };
type CityOption = LookupOption & { governorateId: string };

const UnitDataDetailsPage = async ({ params }: PageProps) => {
  let allocationOptions = ["رجال", "سيدات"];
  let allocationTypeOptions = ["ثابت", "مرن"];
  let statusOptions = ["متاح", "محجوز", "مشغول"];
  let governorateOptions: LookupOption[] = [];
  let cityOptions: CityOption[] = [];

  const gendersResult = await getGenders();
  if (gendersResult && !(gendersResult as { error?: string }).error) {
    const raw = (gendersResult as { data?: unknown }).data ?? gendersResult;
    const normalized = normalizeNumericLookupList(raw);
    const mapped = normalized.map((item) => item.nameAr).filter(Boolean);
    if (mapped.length > 0) {
      allocationOptions = mapped;
    }
  }

  const statusesResult = await getUnitStatuses();
  if (statusesResult && !(statusesResult as { error?: string }).error) {
    const raw = (statusesResult as { data?: unknown }).data ?? statusesResult;
    const normalized = normalizeNumericLookupList(raw);
    const mapped = normalized.map((item) => item.nameAr).filter(Boolean);
    if (mapped.length > 0) {
      statusOptions = mapped;
    }
  }

  const allocationTypesResult = await getAllocationTypes();
  if (
    allocationTypesResult &&
    !(allocationTypesResult as { error?: string }).error
  ) {
    const raw =
      (allocationTypesResult as { data?: unknown }).data ??
      allocationTypesResult;
    const normalized = normalizeNumericLookupList(raw);
    const mapped = normalized.map((item) => item.nameAr).filter(Boolean);
    if (mapped.length > 0) {
      allocationTypeOptions = mapped;
    }
  }

  const governoratesResult = await getGovernorates();
  if (governoratesResult && !(governoratesResult as { error?: string }).error) {
    const raw =
      (governoratesResult as { data?: unknown }).data ?? governoratesResult;
    const list = Array.isArray(raw) ? raw : [];
    governorateOptions = list
      .filter(
        (item): item is Record<string, unknown> =>
          item != null && typeof item === "object",
      )
      .map((item) => ({
        id: String(item.id ?? item.Id ?? "").trim(),
        nameAr: String(item.nameAr ?? item.NameAr ?? "").trim(),
      }))
      .filter((item) => item.id && item.nameAr);
  }

  const citiesResult = await getCities();
  if (citiesResult && !(citiesResult as { error?: string }).error) {
    const raw = (citiesResult as { data?: unknown }).data ?? citiesResult;
    cityOptions = normalizeAllCitiesResponse(raw)
      .map((item) => ({
        id: item.id.trim(),
        nameAr: item.nameAr.trim(),
        governorateId: String(item.governorateId ?? "").trim(),
      }))
      .filter((item) => item.id && item.nameAr);
  }

  // Some API responses omit governorate id in the global getCities() endpoint.
  // In that case, load cities per governorate to guarantee cascade mapping.
  const hasGovernorateMappedCities = cityOptions.some((c) => c.governorateId);
  if (!hasGovernorateMappedCities && governorateOptions.length > 0) {
    const perGovernorateCities = await Promise.all(
      governorateOptions.map(async (governorate) => {
        const res = await getCities(governorate.id);
        if (!res || (res as { error?: string }).error) return [] as CityOption[];
        const payload = (res as { data?: unknown }).data ?? res;
        return normalizeAllCitiesResponse(payload)
          .map((city) => ({
            id: city.id.trim(),
            nameAr: city.nameAr.trim(),
            governorateId: governorate.id,
          }))
          .filter((city) => city.id && city.nameAr);
      }),
    );

    cityOptions = perGovernorateCities.flat();
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <UnitDataScreen
            allocationOptions={allocationOptions}
            allocationTypeOptions={allocationTypeOptions}
            statusOptions={statusOptions}
            governorateOptions={governorateOptions}
            cityOptions={cityOptions}
          />
        </div>
      </div>
    </main>
  );
};

export default UnitDataDetailsPage;
