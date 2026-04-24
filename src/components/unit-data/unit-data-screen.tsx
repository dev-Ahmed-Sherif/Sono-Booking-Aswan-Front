"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApartmentForm from "@/components/apartment/apartment-form";
import RoomForm from "@/components/room/room-form";
import BedForm from "@/components/bed/bed-form";

export default function UnitDataScreen() {
  const [activeTab, setActiveTab] = useState<"apartment" | "room" | "bed">(
    "apartment",
  );

  return (
    <div
      className="space-y-4 text-right [&_form]:space-y-4 [&_form_.grid]:gap-3 [&_form_.grid]:[direction:rtl] [&_form_.grid>*]:justify-self-start [&_form_.space-y-6]:space-y-4 [&_[role=tabpanel]]:text-right"
      dir="rtl"
    >
      <motion.header
        className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm"
        style={{ backgroundColor: "#00005c" }}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
            <Home className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl md:text-3xl font-bold text-white tracking-wide">
              نظام إدارة إسكان محافظة أسوان
            </h1>
          </div>
        </div>
      </motion.header>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "apartment" | "room" | "bed")
        }
        className="text-right [&_[data-slot=tabs-list]]:[direction:rtl] [&_[data-slot=tabs-list]]:justify-start [&_[data-slot=tabs-trigger]]:text-right"
      >
        <TabsList className="grid w-full grid-cols-3 text-right [direction:rtl]">
          <TabsTrigger value="apartment">بيانات الشقة</TabsTrigger>
          <TabsTrigger value="room">بيانات الغرفة</TabsTrigger>
          <TabsTrigger value="bed">بيانات السرير</TabsTrigger>
        </TabsList>

        <TabsContent value="apartment" className="mt-4 text-right">
          <motion.div
            key="apartment-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <ApartmentForm onSubmit={async () => setActiveTab("room")} />
          </motion.div>
        </TabsContent>

        <TabsContent value="room" className="mt-4 text-right">
          <motion.div
            key="room-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <RoomForm onSubmit={async () => setActiveTab("bed")} />
          </motion.div>
        </TabsContent>

        <TabsContent value="bed" className="mt-4 text-right">
          <motion.div
            key="bed-form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <BedForm />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
