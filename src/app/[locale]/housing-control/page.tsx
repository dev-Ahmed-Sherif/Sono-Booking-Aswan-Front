"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const normalizeReasonType = (reason: string): Exclude<RequestType, "all"> => {
  if (reason.includes("علاج")) return "treatment";
  if (reason.includes("تخصص")) return "specialization";
  return "work";
};

const HousingControlPage = () => {
  const [selectedType, setSelectedType] = useState<RequestType>("all");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredPendingRequests = useMemo(() => {
    return pendingRequests.filter((request) => {
      const matchesType =
        selectedType === "all" || normalizeReasonType(request.reason) === selectedType;
      const matchesDate = !selectedDate || request.date === selectedDate;

      return matchesType && matchesDate;
    });
  }, [selectedDate, selectedType]);

  return (
    <main dir="rtl" className="w-full min-h-screen bg-background p-4 md:p-6">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-4">
          <div className="rounded border border-[#00004a] bg-[#00005c] px-4 py-3 text-white">
            <h1 className="text-right text-xl font-bold md:text-3xl">
              نظام إدارة إسكان محافظة أسوان
            </h1>
          </div>
          <h2 className="text-right text-2xl font-semibold text-foreground">
            لوحة تحكم مسؤول أسوان
          </h2>
        </header>

        <section className="space-y-4">
          <h3 className="text-right text-xl font-semibold text-foreground">فلترة</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_220px_1fr] md:items-end">
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">حسب نوع الطلب</label>
              <Select
                value={selectedType}
                onValueChange={(value) => setSelectedType(value as RequestType)}
                dir="rtl"
              >
                <SelectTrigger>
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="work">مأمورية عمل</SelectItem>
                  <SelectItem value="treatment">علاج</SelectItem>
                  <SelectItem value="specialization">تخصص</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">حسب التاريخ</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-right text-xl font-semibold">قسم الطلبات الجديدة</h3>
          <div className="rounded-md border">
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
                {filteredPendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.id}</TableCell>
                    <TableCell>{request.applicant}</TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>{request.date}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="default">
                          موافقة
                        </Button>
                        <Button size="sm" variant="outline">
                          رفض
                        </Button>
                        <Button size="sm" variant="outline">
                          تفاصيل
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPendingRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      لا يوجد طلبات مطابقة للفلترة الحالية
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-right text-xl font-semibold">قسم الطلبات الموافق عليها مؤخرًا</h3>
          <div className="rounded-md border">
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
                {recentlyApprovedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.id}</TableCell>
                    <TableCell>{request.applicant}</TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>{request.date}</TableCell>
                    <TableCell>{request.nights}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-right text-xl font-semibold">قسم طلبات التمديد</h3>
          <div className="rounded-md border">
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
                {extensionRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.id}</TableCell>
                    <TableCell>{request.applicant}</TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>{request.date}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="default">
                          موافقة
                        </Button>
                        <Button size="sm" variant="outline">
                          رفض
                        </Button>
                        <Button size="sm" variant="outline">
                          تفاصيل
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </section>
    </main>
  );
};

export default HousingControlPage;
