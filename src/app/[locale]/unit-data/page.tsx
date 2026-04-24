import UnitDataScreen from "@/components/unit-data/unit-data-screen";

const UnitDataPage = () => {
  return (
    <main className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4">
        <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <UnitDataScreen />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};

export default UnitDataPage;
