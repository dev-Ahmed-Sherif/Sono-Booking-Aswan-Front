import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getApartments } from "@/actions/settings/apartmentService";
import { getBeds } from "@/actions/settings/bedService";
import { getRooms } from "@/actions/settings/roomService";
import type { ApartmentColumn } from "@/components/settings/unit-data/columns";
import {
  buildApartmentUnitCounts,
  resolveApartmentUnitCounts,
  rowsFromServiceList,
} from "@/lib/apartment-unit-counts";

const UnitDataClient = dynamic(
  () => import("@/components/settings/unit-data/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type UnitDataPageProps = {
  params: { locale: string };
};

const UnitDataPage = async ({ params }: UnitDataPageProps) => {
  const { locale } = params;

  let data: ApartmentColumn[] | null = null;
  const [apartmentsResult, roomsResult, bedsResult] = await Promise.all([
    getApartments(),
    getRooms(undefined, { allStatuses: true }),
    getBeds(undefined, { allStatuses: true }),
  ]);

  const unitCounts = buildApartmentUnitCounts(
    rowsFromServiceList(roomsResult),
    rowsFromServiceList(bedsResult),
  );

  if (apartmentsResult && !(apartmentsResult as { error?: string }).error) {
    const raw = (apartmentsResult as { data?: unknown }).data ?? apartmentsResult;
    if (Array.isArray(raw)) {
      data = raw
        .filter(
          (item): item is Record<string, unknown> =>
            item != null && typeof item === "object",
        )
        .map((item) => {
          const id = String(item.id ?? item.Id ?? "").trim();
          const { roomsCount, bedsCount } = resolveApartmentUnitCounts(
            item,
            unitCounts,
          );
          return { ...item, id, roomsCount, bedsCount } as ApartmentColumn;
        })
        .filter((row) => row.id);
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <Link
          href={`/${params.locale}/settings`}
          className="mb-2 inline-flex items-center gap-2 rounded-md px-4 h-10 text-base hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowRight className="h-5 w-5" />
          رجوع
        </Link>
        <UnitDataClient
          data={data}
          path={`/${locale}/settings/unit-data/new`}
        />
      </div>
    </main>
  );
};

export default UnitDataPage;
