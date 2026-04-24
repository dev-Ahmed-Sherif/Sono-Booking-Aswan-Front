"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CalendarIcon,
  CalendarDays,
  CheckCircle2,
  Home,
  Moon,
  Search,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useToast } from "@/hooks/use-toast";

type ReservationView = "new" | "extend" | "history";
type AvailabilityResult = "available" | "unavailable" | null;

const latestReservations = [
  {
    requestNo: "REQ-2026-0012",
    startDate: "2026-04-25",
    nights: 3,
    type: "طلب إقامة جديد",
    status: "قيد المراجعة",
  },
  {
    requestNo: "REQ-2026-0007",
    startDate: "2026-03-14",
    nights: 2,
    type: "تمديد إقامة",
    status: "تمت الموافقة",
  },
  {
    requestNo: "REQ-2026-0002",
    startDate: "2026-02-09",
    nights: 4,
    type: "طلب إقامة جديد",
    status: "مرفوض",
  },
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

const ReservationPage = () => {
  const { toast } = useToast();

  const [activeView, setActiveView] = useState<ReservationView>("new");

  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState("");
  const [unitType, setUnitType] = useState("");
  const [gender, setGender] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult>(null);
  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);
  const minSelectableDate = new Date();
  minSelectableDate.setHours(0, 0, 0, 0);

  useEffect(() => {
    setAvailability(null);
  }, [startDate, nights, unitType, gender, activeView]);

  const handleCheckAvailability = () => {
    if (!startDate || !nights || !unitType || !gender) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى تعبئة جميع الحقول للتحقق من التوفر",
      });
      return;
    }

    setIsChecking(true);
    setAvailability(null);

    setTimeout(() => {
      setAvailability(Math.random() > 0.4 ? "available" : "unavailable");
      setIsChecking(false);
    }, 1200);
  };

  const isAvailabilityView = activeView === "new" || activeView === "extend";

  return (
    <main className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
      <motion.div
        className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4"
        variants={mainCardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden border-2 border-blue-100 rounded-3xl shadow-xl">
          <motion.header
            className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm"
            style={{ backgroundColor: "#00005c" }}
            variants={mainCardChildrenVariants}
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

          <motion.div
            className="px-2 sm:px-4 md:px-6 lg:px-8 py-4"
            variants={mainCardChildrenVariants}
          >
            <motion.div
              className="w-full"
              variants={pageContentVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-4">
                <motion.div variants={sectionVariants}>
                  <Card className="border-2 border-blue-100 rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">الخدمات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("new")}
                          variant={activeView === "new" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          طلب إقامة جديد
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("extend")}
                          variant={activeView === "extend" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          تمديد إقامة
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Button
                          type="button"
                          onClick={() => setActiveView("history")}
                          variant={activeView === "history" ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          طلباتى السابقة
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.section className="min-h-[420px]" variants={sectionVariants}>
                  {isAvailabilityView ? (
                    <motion.div
                      key={activeView}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.15,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 90,
                      }}
                    >
                      <Card className="h-full border-2 border-blue-200 rounded-3xl shadow-lg bg-white text-gray-800">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                              <Search className="h-5 w-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-lg md:text-xl text-gray-800">
                              {activeView === "new"
                                ? "طلب إقامة جديد"
                                : "تمديد إقامة"}
                            </CardTitle>
                          </div>
                          <p className="text-gray-500 text-sm mt-1 pe-1">
                            تحقق من توفر الوحدات السكنية في التاريخ المطلوب
                          </p>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                              <CalendarDays className="h-4 w-4 text-blue-500" />
                              تاريخ البدء
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={`w-full justify-between text-right font-normal bg-white border-gray-300 text-gray-800 ${
                                    !startDate ? "text-muted-foreground" : ""
                                  }`}
                                  dir="rtl"
                                >
                                  <span>
                                    {startDate
                                      ? format(new Date(startDate), "PPP")
                                      : "اختر التاريخ"}
                                  </span>
                                  <CalendarIcon className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="z-[10002] w-auto p-0 pointer-events-auto"
                                align="end"
                                dir="rtl"
                              >
                                <Calendar
                                  mode="single"
                                  selected={
                                    startDate ? new Date(startDate) : undefined
                                  }
                                  onSelect={(date) =>
                                    setStartDate(
                                      date ? format(date, "yyyy-MM-dd") : "",
                                    )
                                  }
                                  disabled={(date) =>
                                    date > maxSelectableDate ||
                                    date < minSelectableDate
                                  }
                                  initialFocus
                                  captionLayout="dropdown"
                                  toYear={currentYear + 5}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                              <Moon className="h-4 w-4 text-blue-500" />
                              عدد الليالي
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              placeholder="أدخل عدد الليالي"
                              value={nights}
                              onChange={(e) => setNights(e.target.value)}
                              className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/30"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 flex items-center gap-1.5 text-sm">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              نوع الوحدة
                            </Label>
                            <Select
                              value={unitType}
                              onValueChange={setUnitType}
                              dir="rtl"
                            >
                              <SelectTrigger className="bg-white border-gray-300 text-gray-800 focus:ring-blue-400/30 focus:border-blue-400 text-right [&>span]:w-full [&>span]:text-right">
                                <SelectValue placeholder="اختر نوع الوحدة" />
                              </SelectTrigger>
                              <SelectContent className="z-50 text-right">
                                <SelectItem className="text-right" value="bed">سرير</SelectItem>
                                <SelectItem className="text-right" value="room">غرفة</SelectItem>
                                <SelectItem className="text-right" value="apartment">شقة كاملة</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-gray-700 text-sm flex items-center gap-1">
                              الجنس
                              <span className="text-red-500 text-xs">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { value: "male", label: "رجال" },
                                { value: "female", label: "سيدات" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setGender(opt.value)}
                                  className={`py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                                    gender === opt.value
                                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                                      : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <Button
                            type="button"
                            onClick={handleCheckAvailability}
                            disabled={isChecking}
                            className="w-full py-5 rounded-2xl font-semibold text-base text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ backgroundColor: "#00005c" }}
                          >
                            {isChecking ? (
                              <span className="flex items-center gap-2">
                                <motion.div
                                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                />
                                جارٍ التحقق...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                تحقق من التوفر
                              </span>
                            )}
                          </Button>

                          {availability && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.4 }}
                              className={`flex items-center gap-3 p-4 rounded-2xl border-2 font-semibold text-base ${
                                availability === "available"
                                  ? "bg-green-500/20 border-green-400/50 text-green-700"
                                  : "bg-red-500/20 border-red-400/50 text-red-700"
                              }`}
                            >
                              {availability === "available" ? (
                                <>
                                  <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />
                                  يوجد أماكن متاحة في التاريخ المطلوب
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-6 w-6 shrink-0 text-red-500" />
                                  لا يوجد أماكن متاحة في هذا التاريخ
                                </>
                              )}
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Card className="border-2 border-blue-100 rounded-2xl">
                        <CardHeader>
                          <CardTitle>آخر طلبات الإقامة</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">رقم الطلب</TableHead>
                                  <TableHead className="text-right">نوع الطلب</TableHead>
                                  <TableHead className="text-right">تاريخ البدء</TableHead>
                                  <TableHead className="text-right">الليالي</TableHead>
                                  <TableHead className="text-right">الحالة</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {latestReservations.map((reservation) => (
                                  <TableRow key={reservation.requestNo}>
                                    <TableCell>{reservation.requestNo}</TableCell>
                                    <TableCell>{reservation.type}</TableCell>
                                    <TableCell>{reservation.startDate}</TableCell>
                                    <TableCell>{reservation.nights}</TableCell>
                                    <TableCell>{reservation.status}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </motion.section>
              </div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </main>
  );
};

export default ReservationPage;
