"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReceiverView = "active" | "upcoming";

type ActiveReservation = {
  id: string;
  userName: string;
  room: string;
  arrivalDate: string;
};

type UpcomingReservation = {
  id: string;
  userName: string;
  room: string;
  arrivalDate: string;
};

const activeReservations: ActiveReservation[] = [
  { id: "1", userName: "أحمد محمد", room: "شقة 101", arrivalDate: "2023-10-26" },
  { id: "2", userName: "فاطمة علي", room: "غرفة 203", arrivalDate: "2023-10-26" },
  { id: "3", userName: "خالد محمود", room: "سرير 305", arrivalDate: "2023-10-26" },
];

const upcomingReservations: UpcomingReservation[] = [
  { id: "4", userName: "سارة حسن", room: "شقة 102", arrivalDate: "2023-10-28" },
  { id: "5", userName: "محمد إبراهيم", room: "غرفة 201", arrivalDate: "2023-10-29" },
];

const pageContentVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.1, 0.25, 1] as const,
      staggerChildren: 0.12,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const mainCardVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const mainCardChildrenVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const viewTitles: Record<ReceiverView, { title: string; description: string }> = {
  active: {
    title: "قسم الحجوزات النشطة اليوم",
    description: "عرض الحجوزات الحالية وإجراءات تأكيد الوصول",
  },
  upcoming: {
    title: "قسم الحجوزات المستقبلية الموافق عليها",
    description: "عرض الحجوزات القادمة المعتمدة",
  },
};

const HousingReceiverPage = () => {
  const [activeView, setActiveView] = useState<ReceiverView>("active");

  return (
    <main className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto" dir="rtl">
      <motion.div
        className="container mx-auto px-2 py-4 sm:px-4 md:px-6 lg:px-8"
        variants={mainCardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden rounded-3xl border-2 border-blue-100 shadow-xl">
          <motion.header
            className="relative z-10 flex items-center justify-center gap-3 border-b border-[#00004a] px-6 py-5 shadow-sm"
            style={{ backgroundColor: "#00005c" }}
            variants={mainCardChildrenVariants}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-green-500 to-blue-600 p-2 shadow-lg">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-wide text-white md:text-3xl">
                  نظام إدارة إسكان محافظة أسوان
                </h1>
                <p className="mt-1 text-sm text-white/85 md:text-base">
                  لوحة تحكم مسؤول الاستقبال
                </p>
              </div>
            </div>
          </motion.header>

          <motion.div
            className="px-2 py-4 sm:px-4 md:px-6 lg:px-8"
            variants={mainCardChildrenVariants}
          >
            <motion.div
              className="w-full"
              variants={pageContentVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[270px_1fr]">
                <motion.div variants={sectionVariants}>
                  <Card className="rounded-2xl border-2 border-blue-100">
                    <CardHeader>
                      <CardTitle className="text-base">الأقسام</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("active")}
                          variant={activeView === "active" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          الحجوزات النشطة
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("upcoming")}
                          variant={activeView === "upcoming" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          الحجوزات المستقبلية
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.section className="min-h-[420px]" variants={sectionVariants}>
                  <Card className="h-full rounded-3xl border-2 border-blue-200 bg-white text-gray-800 shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-gray-800 md:text-xl">
                            {viewTitles[activeView].title}
                          </CardTitle>
                          <p className="mt-1 pe-1 text-sm text-gray-500">
                            {viewTitles[activeView].description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <motion.div
                        key={activeView}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.1,
                          duration: 0.45,
                          type: "spring",
                          stiffness: 90,
                        }}
                      >
                        <div className="overflow-x-auto rounded-md border border-gray-200">
                          {activeView === "active" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">اسم المستخدم</TableHead>
                                  <TableHead className="text-right">الشقة/الغرفة/السرير</TableHead>
                                  <TableHead className="text-right">تاريخ الوصول</TableHead>
                                  <TableHead className="text-right">إجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activeReservations.map((reservation) => (
                                  <TableRow key={reservation.id}>
                                    <TableCell>{reservation.userName}</TableCell>
                                    <TableCell>{reservation.room}</TableCell>
                                    <TableCell>{reservation.arrivalDate}</TableCell>
                                    <TableCell>
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          className="bg-[#00005c] text-white hover:bg-[#00004a]"
                                        >
                                          تأكيد وصول
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}

                          {activeView === "upcoming" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">اسم المستخدم</TableHead>
                                  <TableHead className="text-right">الشقة/الغرفة/السرير</TableHead>
                                  <TableHead className="text-right">تاريخ الوصول</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {upcomingReservations.map((reservation) => (
                                  <TableRow key={reservation.id}>
                                    <TableCell>{reservation.userName}</TableCell>
                                    <TableCell>{reservation.room}</TableCell>
                                    <TableCell>{reservation.arrivalDate}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.section>
              </div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </main>
  );
};

export default HousingReceiverPage;
