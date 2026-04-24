import { getInspectionById } from "@/actions/inspection/inspectionService";
import { getFloatingUnits } from "@/actions/basic-data/floatingUnitService";
import { getInspectionClauses } from "@/actions/inspection/inspectionClauseService";
import { getInspectionFloatingUnitClauses } from "@/actions/inspection/inspectionFloatingUnitClauseService";
import { getInspectionTypeById } from "@/actions/settings/inspectionTypeService";
import InspectionForm from "@/components/inspections/inspection/inspection-form";

type PageProps = {
  params: { locale: string; typeId: string; id: string };
};

const InspectionCategoryIdPage = async ({ params }: PageProps) => {
  const { typeId, id } = params;
  let initialData: unknown = null;
  let inspectionTypeName = "";
  let floatingUnits: Array<{ id: string; nameAr?: string; name?: string }> = [];
  let inspectionFloatingUnitClauses: Array<{
    id?: string;
    isInspected: boolean;
    number?: string;
    note?: string;
    inspectionClauseId: string;
    inspectionId?: string;
    inspectionClauseCode?: string;
    inspectionClauseName?: string;
  }> = [];

  if (id && id !== "new") {
    const result = await getInspectionById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
  }

  const categoryResult = await getInspectionTypeById(typeId);
  if (categoryResult && !(categoryResult as { error?: string }).error) {
    const raw = (categoryResult as { data?: unknown }).data ?? categoryResult;
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      inspectionTypeName = String(
        obj.nameAr ?? obj.NameAr ?? obj.name ?? obj.Name ?? "",
      );
    }
  }

  const floatingUnitsResult = await getFloatingUnits();

  if (
    floatingUnitsResult &&
    !(floatingUnitsResult as { error?: string }).error
  ) {
    const raw =
      (floatingUnitsResult as { data?: unknown }).data ?? floatingUnitsResult;
    if (Array.isArray(raw)) {
      floatingUnits = raw as Array<{
        id: string;
        nameAr?: string;
        name?: string;
      }>;
    }
  }

  if (id === "new") {
    const clausesResult = await getInspectionClauses(typeId);
    if (clausesResult && !(clausesResult as { error?: string }).error) {
      const raw = (clausesResult as { data?: unknown }).data ?? clausesResult;
      if (Array.isArray(raw)) {
        inspectionFloatingUnitClauses = raw
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const rec = item as Record<string, unknown>;
            const clauseId = rec.id;
            if (typeof clauseId !== "string" || !clauseId) return null;
            const inspectionClauseName =
              typeof rec.name === "string"
                ? rec.name
                : typeof rec.nameAr === "string"
                  ? rec.nameAr
                  : "";
            const inspectionClauseCode =
              typeof rec.code === "string"
                ? rec.code
                : typeof rec.Code === "string"
                  ? rec.Code
                  : "";
            return {
              inspectionClauseId: clauseId,
              isInspected: false,
              number: "",
              note: "",
              inspectionClauseCode,
              inspectionClauseName,
            };
          })
          .filter(
            (
              item,
            ): item is {
              inspectionClauseId: string;
              isInspected: boolean;
              number: string;
              note: string;
              inspectionClauseCode: string;
              inspectionClauseName: string;
            } => item !== null,
          );
      }
    }
  } else {
    const floatingClausesResult = await getInspectionFloatingUnitClauses(id);
    if (
      floatingClausesResult &&
      !(floatingClausesResult as { error?: string }).error
    ) {
      const raw =
        (floatingClausesResult as { data?: unknown }).data ??
        floatingClausesResult;
      if (Array.isArray(raw)) {
        inspectionFloatingUnitClauses = raw.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const rec = item as Record<string, unknown>;
          const inspectionClauseId = rec.inspectionClauseId;
          if (typeof inspectionClauseId !== "string" || !inspectionClauseId) {
            return [];
          }
          const clauseObj =
            rec.inspectionClause && typeof rec.inspectionClause === "object"
              ? (rec.inspectionClause as Record<string, unknown>)
              : null;
          const inspectionClauseCode =
            typeof rec.inspectionClauseCode === "string"
              ? rec.inspectionClauseCode
              : typeof rec.inspectionClauseCodeAr === "string"
                ? rec.inspectionClauseCodeAr
                : typeof clauseObj?.code === "string"
                  ? clauseObj.code
                  : "";
          const inspectionClauseName =
            typeof rec.inspectionClauseName === "string"
              ? rec.inspectionClauseName
              : typeof rec.inspectionClauseNameAr === "string"
                ? rec.inspectionClauseNameAr
                : typeof rec.inspectionClause === "string"
                  ? rec.inspectionClause
                  : typeof clauseObj?.name === "string"
                    ? clauseObj.name
                    : typeof clauseObj?.nameAr === "string"
                      ? clauseObj.nameAr
                      : "";
          return [
            {
              id: typeof rec.id === "string" ? rec.id : undefined,
              isInspected: Boolean(rec.isInspected),
              number: typeof rec.number === "string" ? rec.number : "",
              note: typeof rec.note === "string" ? rec.note : "",
              inspectionClauseId,
              inspectionId:
                typeof rec.inspectionId === "string" ? rec.inspectionId : id,
              inspectionClauseCode,
              inspectionClauseName,
            },
          ];
        });
      }
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <InspectionForm
            initialData={initialData}
            floatingUnits={floatingUnits}
            inspectionFloatingUnitClauses={inspectionFloatingUnitClauses}
            inspectionTypeName={inspectionTypeName}
            basePath={`/inspection/${typeId}`}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};

export default InspectionCategoryIdPage;
