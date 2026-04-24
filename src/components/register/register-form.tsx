"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Home, Loader2, Plus, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

import { registrationSchema, type RegistrationFormValues } from "@/schemas";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const companionRelationshipOptions = [
  "جد",
  "جدة",
  "أب",
  "أم",
  "زوج",
  "زوجة",
  "ابن",
  "ابنه",
] as const;

const RegisterForm = () => {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;
  const currentYear = new Date().getFullYear();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      gender: undefined,
      birthDate: undefined,
      mobile: "",
      email: "",
      identityAttachment: undefined,
      companions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "companions",
  });

  const onSubmit = async (values: RegistrationFormValues) => {
    try {
      setIsSubmitting(true);
      console.log("registration-form-values", values);
      toast({
        title: "تم إرسال البيانات بنجاح",
        description: "تم تجهيز بيانات التسجيل الأساسية والمرافقين.",
      });
      form.reset({
        fullName: "",
        nationalId: "",
        gender: undefined,
        birthDate: undefined,
        mobile: "",
        email: "",
        identityAttachment: undefined,
        companions: [],
      });
    } catch {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال البيانات",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
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
            {/* <p className="text-xs md:text-sm text-white/70 mt-0.5">
              Aswan Governorate Housing Management System
            </p> */}
          </div>
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <Card className="w-full border-[2.5px] border-slate-300 dark:border-slate-600 shadow-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <CardHeader>
          <CardTitle className="text-2xl font-extrabold">تسجيل جديد</CardTitle>
          <CardDescription>
            أدخل البيانات الأساسية ثم أضف بيانات المرافقين من التبويب المخصص.
          </CardDescription>
          </CardHeader>
        </motion.div>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
            <Tabs defaultValue="main" dir="rtl" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="main" className="font-bold">
                  البيانات الأساسية
                </TabsTrigger>
                <TabsTrigger value="companions" className="font-bold">
                  المرافقين
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.45 }}
                >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">
                          الاسم الكامل
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="border-[2.5px] border-slate-300 dark:border-slate-600"
                            placeholder="أدخل الاسم الكامل"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">
                          الرقم القومي
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            inputMode="numeric"
                            maxLength={14}
                            className="border-[2.5px] border-slate-300 dark:border-slate-600"
                            placeholder="أدخل الرقم القومي"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">النوع</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isSubmitting}
                          dir="rtl"
                        >
                          <FormControl>
                            <SelectTrigger className="border-[2.5px] border-slate-300 dark:border-slate-600 text-right [&>span]:w-full [&>span]:text-right">
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="text-right" dir="rtl">
                            <SelectItem className="text-right" value="male">
                              ذكر
                            </SelectItem>
                            <SelectItem className="text-right" value="female">
                              أنثى
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">
                          تاريخ الميلاد
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-between text-right font-normal border-[2.5px] border-slate-300 dark:border-slate-600",
                                  !field.value && "text-muted-foreground",
                                )}
                                dir="rtl"
                              >
                                <span>
                                  {field.value instanceof Date &&
                                  !Number.isNaN(field.value.getTime())
                                    ? format(field.value, "PPP", {
                                        locale: dateFnsLocale,
                                      })
                                    : "اختر التاريخ"}
                                </span>
                                <CalendarIcon className="h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="z-[10002] w-auto p-0 pointer-events-auto"
                            align="end"
                            dir="rtl"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={dateFnsLocale}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                              captionLayout="dropdown"
                              toYear={currentYear}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">رقم الموبيل</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            inputMode="numeric"
                            maxLength={11}
                            className="border-[2.5px] border-slate-300 dark:border-slate-600"
                            placeholder="01XXXXXXXXX"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">الإيميل</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            className="border-[2.5px] border-slate-300 dark:border-slate-600"
                            placeholder="name@mail.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                </motion.div>

                <FormField
                  control={form.control}
                  name="identityAttachment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">
                        رفع صورة البطاقة/شهادة الميلاد
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          className="border-[2.5px] border-slate-300 dark:border-slate-600"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            field.onChange(file);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="companions" className="space-y-6">
                <motion.div
                  className="flex items-center justify-between"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.45 }}
                >
                  <h3 className="text-sm font-medium">أسماء المرافقين</h3>
                  <Button
                    className="bg-[#00005c] hover:bg-[#00004a] text-white"
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      append({
                        relationship: "أب",
                        fullName: "",
                        nationalId: "",
                        birthDate: undefined as unknown as Date,
                        identityAttachment: undefined as unknown as File,
                      })
                    }
                  >
                    <Plus className="ml-1 h-4 w-4 text-white" />
                    إضافة مرافق
                  </Button>
                </motion.div>

                {fields.length === 0 ? (
                  <div className="rounded-md border-[2.5px] border-dashed border-slate-300 dark:border-slate-600 p-4 text-sm text-muted-foreground">
                    لا يوجد مرافقون بعد، يمكنك إضافة مرافق أو أكثر.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      className="rounded-lg border-[2.5px] border-slate-300 dark:border-slate-600 p-4 space-y-4"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 * index, duration: 0.35 }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold">
                          المرافق رقم {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`companions.${index}.relationship`}
                          render={({ field: companionField }) => (
                            <FormItem>
                              <FormLabel className="font-bold">
                                صلة القرابة
                              </FormLabel>
                              <Select
                                onValueChange={companionField.onChange}
                                value={companionField.value}
                                disabled={isSubmitting}
                                dir="rtl"
                              >
                                <FormControl>
                                  <SelectTrigger className="border-[2.5px] border-slate-300 dark:border-slate-600 text-right [&>span]:w-full [&>span]:text-right">
                                    <SelectValue placeholder="اختر صلة القرابة" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="text-right" dir="rtl">
                                  {companionRelationshipOptions.map(
                                    (option) => (
                                      <SelectItem
                                        className="text-right"
                                        key={option}
                                        value={option}
                                      >
                                        {option}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`companions.${index}.fullName`}
                          render={({ field: companionField }) => (
                            <FormItem>
                              <FormLabel className="font-bold">
                                اسم المرافق كامل
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...companionField}
                                  className="border-[2.5px] border-slate-300 dark:border-slate-600"
                                  placeholder="أدخل اسم المرافق كامل"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`companions.${index}.nationalId`}
                          render={({ field: companionField }) => (
                            <FormItem>
                              <FormLabel className="font-bold">
                                الرقم القومي للمرافق
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...companionField}
                                  inputMode="numeric"
                                  maxLength={14}
                                  className="border-[2.5px] border-slate-300 dark:border-slate-600"
                                  placeholder="من واقع البطاقة أو شهادة الميلاد"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`companions.${index}.birthDate`}
                          render={({ field: companionField }) => (
                            <FormItem>
                              <FormLabel className="font-bold">
                                تاريخ الميلاد
                              </FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-between text-right font-normal border-[2.5px] border-slate-300 dark:border-slate-600",
                                        !companionField.value &&
                                          "text-muted-foreground",
                                      )}
                                      dir="rtl"
                                    >
                                      <span>
                                        {companionField.value instanceof Date &&
                                        !Number.isNaN(
                                          companionField.value.getTime(),
                                        )
                                          ? format(companionField.value, "PPP", {
                                              locale: dateFnsLocale,
                                            })
                                          : "اختر التاريخ"}
                                      </span>
                                      <CalendarIcon className="h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="z-[10002] w-auto p-0 pointer-events-auto"
                                  align="end"
                                  dir="rtl"
                                >
                                  <Calendar
                                    mode="single"
                                    selected={companionField.value}
                                    onSelect={companionField.onChange}
                                    locale={dateFnsLocale}
                                    disabled={(date) =>
                                      date > new Date() ||
                                      date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    captionLayout="dropdown"
                                    toYear={currentYear}
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`companions.${index}.identityAttachment`}
                        render={({ field: companionField }) => (
                          <FormItem>
                            <FormLabel className="font-bold">
                              رفع صورة البطاقة/شهادة الميلاد
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*,.pdf"
                                className="border-[2.5px] border-slate-300 dark:border-slate-600"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  companionField.onChange(file);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            </motion.div>

            <motion.div
              className="flex justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.45 }}
            >
              <Button
                type="button"
                variant="outline"
                className="ml-3 w-auto"
                onClick={() => router.push(`/${locale}`)}
              >
                رجوع لتسجيل الدخول
              </Button>
              <Button
                type="submit"
                className="ml-4 w-auto bg-[#00005c] hover:bg-[#00004a] text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  "إرسال التسجيل"
                )}
              </Button>
            </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
      </motion.div>
    </>
  );
};

export default RegisterForm;
