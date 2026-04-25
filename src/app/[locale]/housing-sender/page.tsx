"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SenderView = "new" | "approved" | "extension";
type RequestType = "all" | "work" | "treatment" | "specialization";

type PendingRequest = {
  id: string;
  applicant: string;
  reason: string;
  date: string;
};

type ApprovedRequest = {
  id: string;
  applicant: string;
  reason: string;
  date: string;
  nights: number;
};

const pendingRequests: PendingRequest[] = [
  { id: "1001", applicant: "أحمد محمد", reason: "مأمورية عمل", date: "2023-10-26" },
  { id: "1002", applicant: "فاطمة علي", reason: "علاج", date: "2023-10-25" },
];

const recentlyApprovedRequests: ApprovedRequest[] = [
  { id: "998", applicant: "محمود السيد", reason: "مأمورية عمل", date: "2023-10-24", nights: 30 },
  { id: "997", applicant: "نورا حسن", reason: "علاج", date: "2023-10-23", nights: 7 },
];

const extensionRequests: PendingRequest[] = [
  { id: "850", applicant: "خالد إبراهيم", reason: "مأمورية عمل", date: "2023-10-22" },
  { id: "845", applicant: "لبنى جمال", reason: "علاج", date: "2023-10-21" },
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

const normalizeReasonType = (reason: string): Exclude<RequestType, "all"> => {
  if (reason.includes("علاج")) return "treatment";
  if (reason.includes("تخصص")) return "specialization";
  return "work";
};

const matchesFilters = (
  reason: string,
  date: string,
  selectedType: RequestType,
  selectedDate: string,
) => {
  const matchesType =
    selectedType === "all" || normalizeReasonType(reason) === selectedType;
  const matchesDate = !selectedDate || date === selectedDate;
  return matchesType && matchesDate;
};

const viewTitles: Record<SenderView, { title: string; description: string }> = {
  new: {
    title: "قسم الطلبات الجديدة",
    description: "مراجعة الطلبات الجديدة واتخاذ الإجراء المناسب",
  },
  approved: {
    title: "قسم الطلبات الموافق عليها مؤخرًا",
    description: "آخر الطلبات التي تمت الموافقة عليها",
  },
  extension: {
    title: "قسم طلبات التمديد",
    description: "مراجعة طلبات تمديد الإقامة",
  },
};

const HousingSenderPage = () => {
  const [activeView, setActiveView] = useState<SenderView>("new");
  const [selectedType, setSelectedType] = useState<RequestType>("all");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredPending = useMemo(
    () =>
      pendingRequests.filter((r) =>
        matchesFilters(r.reason, r.date, selectedType, selectedDate),
      ),
    [selectedDate, selectedType],
  );

  const filteredApproved = useMemo(
    () =>
      recentlyApprovedRequests.filter((r) =>
        matchesFilters(r.reason, r.date, selectedType, selectedDate),
      ),
    [selectedDate, selectedType],
  );

  const filteredExtension = useMemo(
    () =>
      extensionRequests.filter((r) =>
        matchesFilters(r.reason, r.date, selectedType, selectedDate),
      ),
    [selectedDate, selectedType],
  );

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
                  لوحة تحكم مسؤول أسوان
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
                      <CardTitle className="text-base">أقسام الطلبات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("new")}
                          variant={activeView === "new" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          قسم الطلبات الجديدة
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("approved")}
                          variant={activeView === "approved" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          قسم الطلبات الموافق عليها مؤخرًا
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          type="button"
                          onClick={() => setActiveView("extension")}
                          variant={activeView === "extension" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          قسم طلبات التمديد
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
                      <div className="rounded-2xl border border-blue-100 bg-slate-50/80 p-4">
                        <p className="mb-3 text-right text-sm font-medium text-gray-700">
                          فلترة
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-sm text-gray-700">حسب نوع الطلب</Label>
                            <Select
                              value={selectedType}
                              onValueChange={(value) => setSelectedType(value as RequestType)}
                              dir="rtl"
                            >
                              <SelectTrigger className="border-gray-300 bg-white text-right text-gray-800 [&>span]:w-full [&>span]:text-right">
                                <SelectValue placeholder="الكل" />
                              </SelectTrigger>
                              <SelectContent className="z-50 text-right">
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="work">مأمورية عمل</SelectItem>
                                <SelectItem value="treatment">علاج</SelectItem>
                                <SelectItem value="specialization">تخصص</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm text-gray-700">حسب التاريخ</Label>
                            <Input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="border-gray-300 bg-white text-gray-800"
                            />
                          </div>
                        </div>
                      </div>

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
                          {activeView === "new" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">رقم الطلب</TableHead>
                                  <TableHead className="text-right">اسم الطالب</TableHead>
                                  <TableHead className="text-right">سبب الطلب</TableHead>
                                  <TableHead className="text-right">التاريخ</TableHead>
                                  <TableHead className="text-right">إجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredPending.map((request) => (
                                  <TableRow key={request.id}>
                                    <TableCell>{request.id}</TableCell>
                                    <TableCell>{request.applicant}</TableCell>
                                    <TableCell>{request.reason}</TableCell>
                                    <TableCell>{request.date}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-[#00005c] text-white hover:bg-[#00004a]"
                                        >
                                          موافقة
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="bg-red-600 text-white hover:bg-red-700"
                                        >
                                          رفض
                                        </Button>
                                        <Button size="sm" variant="outline">
                                          تفاصيل
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {filteredPending.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}

                          {activeView === "approved" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">رقم الطلب</TableHead>
                                  <TableHead className="text-right">اسم الطالب</TableHead>
                                  <TableHead className="text-right">سبب الطلب</TableHead>
                                  <TableHead className="text-right">التاريخ</TableHead>
                                  <TableHead className="text-right">عدد الليالي</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredApproved.map((request) => (
                                  <TableRow key={request.id}>
                                    <TableCell>{request.id}</TableCell>
                                    <TableCell>{request.applicant}</TableCell>
                                    <TableCell>{request.reason}</TableCell>
                                    <TableCell>{request.date}</TableCell>
                                    <TableCell>{request.nights}</TableCell>
                                  </TableRow>
                                ))}
                                {filteredApproved.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}

                          {activeView === "extension" && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">رقم الطلب</TableHead>
                                  <TableHead className="text-right">اسم الطالب</TableHead>
                                  <TableHead className="text-right">سبب الطلب</TableHead>
                                  <TableHead className="text-right">التاريخ</TableHead>
                                  <TableHead className="text-right">إجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredExtension.map((request) => (
                                  <TableRow key={request.id}>
                                    <TableCell>{request.id}</TableCell>
                                    <TableCell>{request.applicant}</TableCell>
                                    <TableCell>{request.reason}</TableCell>
                                    <TableCell>{request.date}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-[#00005c] text-white hover:bg-[#00004a]"
                                        >
                                          موافقة
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="bg-red-600 text-white hover:bg-red-700"
                                        >
                                          رفض
                                        </Button>
                                        <Button size="sm" variant="outline">
                                          تفاصيل
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {filteredExtension.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center text-muted-foreground"
                                    >
                                      لا توجد طلبات مطابقة للفلترة الحالية
                                    </TableCell>
                                  </TableRow>
                                )}
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

export default HousingSenderPage;
