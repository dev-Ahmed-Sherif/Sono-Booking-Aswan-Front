"use client";

import { motion } from "framer-motion";
import { Home } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const kpiItems = [
  { label: "إجمالي طلبات اليوم", value: "15" },
  { label: "الطلبات الموافق عليها", value: "10" },
  { label: "الطلبات المرفوضة", value: "3" },
  { label: "نسبة الإشغال", value: "75%" },
  { label: "إجمالي الإيرادات", value: "15000 جنيه" },
];

const occupancyData = [
  { unitLabel: "شقة 5", percent: 66 },
  { unitLabel: "شقة 4", percent: 25 },
  { unitLabel: "شقة 3", percent: 100 },
  { unitLabel: "شقة 2", percent: 50 },
  { unitLabel: "شقة 1", percent: 75 },
];

const approvedRequests = [
  { id: "1001", name: "أحمد محمد", reason: "عمل", date: "2023-10-26" },
  { id: "1002", name: "فاطمة علي", reason: "علاج", date: "2023-10-25" },
  { id: "1003", name: "محمود حسن", reason: "تخصص", date: "2023-10-24" },
  { id: "1004", name: "زينب خالد", reason: "عمل", date: "2023-10-23" },
  { id: "1005", name: "خالد إبراهيم", reason: "عمل", date: "2023-10-22" },
  { id: "1006", name: "مريم سامي", reason: "علاج", date: "2023-10-21" },
  { id: "1007", name: "ياسر عبد الله", reason: "تخصص", date: "2023-10-20" },
  { id: "1008", name: "سارة محمد", reason: "عمل", date: "2023-10-19" },
  { id: "1009", name: "محمد ناصر", reason: "علاج", date: "2023-10-18" },
  { id: "1010", name: "نورا علي", reason: "عمل", date: "2023-10-17" },
];

const DashboardPage = () => {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <motion.header
          className="relative z-10 mt-2 flex items-center justify-center gap-3 rounded-md border border-[#00004a] px-6 py-5 shadow-sm"
          style={{ backgroundColor: "#00005c" }}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-blue-600 p-2 shadow-lg">
              <Home className="h-6 w-6 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-wide text-white md:text-3xl">
                نظام إدارة إسكان محافظة أسوان
              </h1>
            </div>
          </div>
        </motion.header>

        <motion.section
          className="space-y-4"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <h2 className="text-right text-2xl font-semibold text-slate-800">
            تقرير للمحافظ
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpiItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45 + index * 0.06, duration: 0.35 }}
              >
                <Card className="border-0 bg-slate-200/70 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center text-base font-medium text-slate-700">
                      {item.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-center text-4xl font-bold text-[#1e3a8a]">
                      {item.value}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
        >
          <Card className="border-0 bg-slate-200/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-right text-2xl font-semibold text-slate-800">
              إشغال كل شقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid min-h-[280px] grid-cols-2 items-end gap-4 rounded-md bg-white p-4 sm:grid-cols-3 md:grid-cols-5">
              {occupancyData.map((item) => (
                <div key={item.unitLabel} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="relative flex h-52 w-full items-end rounded-sm bg-slate-100">
                    <div
                      className="w-full rounded-sm bg-[#1e3a8a] transition-all"
                      style={{ height: `${Math.max(item.percent, 10)}%` }}
                    />
                    <div className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white">
                      <p>{item.percent}%</p>
                      <p>{item.unitLabel}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Card className="border-0 bg-slate-200/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-right text-2xl font-semibold text-slate-800">
              آخر 10 طلبات موافق عليها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الطلب</TableHead>
                    <TableHead className="text-right">اسم الطالب</TableHead>
                    <TableHead className="text-right">سبب الطلب</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.id}</TableCell>
                      <TableCell>{request.name}</TableCell>
                      <TableCell>{request.reason}</TableCell>
                      <TableCell>{request.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
};

export default DashboardPage;
