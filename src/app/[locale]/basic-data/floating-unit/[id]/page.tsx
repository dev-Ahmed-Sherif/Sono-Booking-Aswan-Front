import { getFloatingUnitById } from "@/actions/basic-data/floatingUnitService";
import { getFloatingUnitOrganizations } from "@/actions/basic-data/floatingUnitOrganizationService";
import { getFloatingUnitStaffs } from "@/actions/basic-data/floatingUnitStaffService";
import { getGenders } from "@/actions/settings/genderService";
import { getIdTypes } from "@/actions/settings/idTypeService";
import { getNationalities } from "@/actions/settings/nationalityService";
import FloatingUnitForm from "@/components/basic-data/floating-unit/floating-unit-form";
import type { FloatingUnitOrganizationColumn } from "@/components/basic-data/floating-unit-organization/columns";
import { mapApiListToFloatingUnitOrganizationColumns } from "@/lib/floating-unit-organization-map";
import type { FloatingUnitStaffColumn } from "@/components/basic-data/floating-unit-staff/columns";
import {
  normalizeNumericLookupList,
  type NumericLookupRow,
} from "@/lib/numeric-lookup";

type PageProps = { params: { locale: string; id: string } };

const FloatingUnitIdPage = async ({ params }: PageProps) => {
  const { id } = params;
  let initialData: unknown = null;
  let floatingUnitStaffData: FloatingUnitStaffColumn[] | null = null;
  let floatingUnitOrganizationData: FloatingUnitOrganizationColumn[] | null =
    null;
  let nationalitiesData: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null = null;
  let gendersData: NumericLookupRow[] = [];
  let idTypesData: NumericLookupRow[] = [];

  const nationalitiesResult = await getNationalities();
  if (
    nationalitiesResult &&
    !(nationalitiesResult as { error?: string }).error
  ) {
    const rawNationalities =
      (nationalitiesResult as { data?: unknown }).data ?? nationalitiesResult;
    nationalitiesData = Array.isArray(rawNationalities)
      ? (rawNationalities as Array<{
          id: string;
          nameAr: string;
          nameEn?: string;
        }>)
      : null;
  }

  const gendersResult = await getGenders();
  if (gendersResult && !(gendersResult as { error?: string }).error) {
    const raw = (gendersResult as { data?: unknown }).data ?? gendersResult;
    gendersData = normalizeNumericLookupList(raw);
  }

  const idTypesResult = await getIdTypes();
  if (idTypesResult && !(idTypesResult as { error?: string }).error) {
    const raw = (idTypesResult as { data?: unknown }).data ?? idTypesResult;
    idTypesData = normalizeNumericLookupList(raw);
  }

  if (id && id !== "new") {
    const result = await getFloatingUnitById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
    const staffResult = await getFloatingUnitStaffs(id);
    if (staffResult && !(staffResult as { error?: string }).error) {
      const raw = (staffResult as { data?: unknown }).data ?? staffResult;
      floatingUnitStaffData = Array.isArray(raw)
        ? (raw as FloatingUnitStaffColumn[])
        : null;
    }
    const orgResult = await getFloatingUnitOrganizations(id);
    if (orgResult && !(orgResult as { error?: string }).error) {
      const raw = (orgResult as { data?: unknown }).data ?? orgResult;
      floatingUnitOrganizationData = mapApiListToFloatingUnitOrganizationColumns(
        raw,
      );
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <FloatingUnitForm
            initialData={initialData}
            name="الوحدة العائمة / طاقم الوحدة"
            floatingUnitStaffData={floatingUnitStaffData}
            floatingUnitOrganizationData={floatingUnitOrganizationData}
            nationalitiesData={nationalitiesData}
            gendersData={gendersData}
            idTypesData={idTypesData}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};

export default FloatingUnitIdPage;
