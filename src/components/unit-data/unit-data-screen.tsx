"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ApartmentClient from "@/components/apartment/client";
import RoomClient from "@/components/room/client";
import BedClient from "@/components/bed/client";
import type { ApartmentFormValues } from "@/schemas";

type UnitDataTab = "apartment" | "room" | "bed";
type LookupOption = { id: string; nameAr: string; nameEn?: string };
type CityOption = LookupOption & { governorateId: string };

type UnitDataScreenProps = {
  apartmentDefaultValues?: Partial<ApartmentFormValues>;
  genderOptions?: LookupOption[];
  allocationTypeOptions?: LookupOption[];
  apartmentTypeOptions?: LookupOption[];
  statusOptions?: LookupOption[];
  governorateOptions?: LookupOption[];
  cityOptions?: CityOption[];
};

export default function UnitDataScreen({
  apartmentDefaultValues,
  genderOptions = [
    { id: "1", nameAr: "رجال" },
    { id: "2", nameAr: "سيدات" },
  ],
  allocationTypeOptions = [
    { id: "1", nameAr: "ثابت" },
    { id: "2", nameAr: "مرن" },
  ],
  apartmentTypeOptions = [],
  statusOptions = [
    { id: "1", nameAr: "متاح", nameEn: "Available" },
    { id: "2", nameAr: "محجوز", nameEn: "Reserved" },
    { id: "3", nameAr: "مشغول", nameEn: "Occupied" },
  ],
  governorateOptions = [],
  cityOptions = [],
}: UnitDataScreenProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "ar";
  const unitDataId = params?.id as string | undefined;
  const isCreateMode = unitDataId === "new";
  const tabsOrder: UnitDataTab[] = ["apartment", "room", "bed"];
  const [activeTab, setActiveTab] = useState<UnitDataTab>("apartment");
  const [lastUnlockedTabIndex, setLastUnlockedTabIndex] = useState(
    isCreateMode ? 0 : tabsOrder.length - 1,
  );

  const isTabUnlocked = (tab: UnitDataTab) =>
    tabsOrder.indexOf(tab) <= lastUnlockedTabIndex;

  const goToNextTab = (currentTab: UnitDataTab) => {
    const currentIndex = tabsOrder.indexOf(currentTab);
    if (currentIndex === -1) return;

    const nextIndex = Math.min(currentIndex + 1, tabsOrder.length - 1);

    if (nextIndex > lastUnlockedTabIndex) {
      setLastUnlockedTabIndex(nextIndex);
    }

    setActiveTab(tabsOrder[nextIndex]);
  };

  return (
    <div
      className="space-y-4 text-right [&_form]:space-y-4 [&_form_.grid]:gap-3 [&_form_.grid]:[direction:rtl] [&_form_.grid>*]:justify-self-start [&_form_.space-y-6]:space-y-4 [&_[role=tabpanel]]:text-right"
      dir="rtl"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/${locale}/settings/unit-data`)}
        className="mb-2 h-10 px-4 gap-2 text-base"
      >
        <ArrowRight className="h-5 w-5" />
        رجوع
      </Button>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const selectedTab = value as UnitDataTab;
          if (!isCreateMode || isTabUnlocked(selectedTab)) {
            setActiveTab(selectedTab);
          }
        }}
        className="text-right [&_[data-slot=tabs-list]]:[direction:rtl] [&_[data-slot=tabs-list]]:justify-start [&_[data-slot=tabs-trigger]]:text-right"
      >
        <TabsList className="grid w-full grid-cols-3 text-right [direction:rtl]">
          <TabsTrigger value="apartment">بيانات الشقة</TabsTrigger>
          <TabsTrigger
            value="room"
            disabled={isCreateMode && !isTabUnlocked("room")}
          >
            بيانات الغرفة
          </TabsTrigger>
          <TabsTrigger
            value="bed"
            disabled={isCreateMode && !isTabUnlocked("bed")}
          >
            بيانات السرير
          </TabsTrigger>
        </TabsList>

        <TabsContent
          forceMount
          value="apartment"
          className="mt-4 text-right data-[state=inactive]:hidden"
        >
          <motion.div
            key="apartment-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <ApartmentClient
              key={unitDataId ?? "apartment"}
              defaultValues={apartmentDefaultValues}
              genderOptions={genderOptions}
              allocationTypeOptions={allocationTypeOptions}
              apartmentTypeOptions={apartmentTypeOptions}
              statusOptions={statusOptions}
              governorateOptions={governorateOptions}
              cityOptions={cityOptions}
              onSubmit={async () => {
                if (isCreateMode) goToNextTab("apartment");
              }}
            />
          </motion.div>
        </TabsContent>

        <TabsContent
          forceMount
          value="room"
          className="mt-4 text-right data-[state=inactive]:hidden"
        >
          <motion.div
            key="room-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <RoomClient
              statusOptions={statusOptions}
              onSubmit={async () => {
                if (isCreateMode) goToNextTab("room");
              }}
            />
          </motion.div>
        </TabsContent>

        <TabsContent
          forceMount
          value="bed"
          className="mt-4 text-right data-[state=inactive]:hidden"
        >
          <motion.div
            key="bed-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <BedClient statusOptions={statusOptions} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
