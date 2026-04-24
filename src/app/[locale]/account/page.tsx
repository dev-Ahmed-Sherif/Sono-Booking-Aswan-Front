"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Mail, Lock, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { accountSchema } from "@/schemas";
import { getUserById, updateUserById } from "@/actions/permissions/userService";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const Account = () => {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [technicalJobCategory, setTechnicalJobCategory] = useState<
    string | null
  >(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { getItem: getUserFromStorage } = useLocalStorage("user");

  type AccountFormValues = z.infer<typeof accountSchema>;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      userName: "",
      email: "",
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Watch oldPassword to trigger validation for newPassword and confirmPassword
  const oldPassword = form.watch("oldPassword");
  const isPasswordFieldsDisabled = !oldPassword || oldPassword.trim() === "";

  useEffect(() => {
    if (oldPassword && oldPassword.trim() !== "") {
      // Trigger validation for newPassword and confirmPassword when oldPassword has value
      form.trigger("newPassword");
      form.trigger("confirmPassword");
    } else {
      // Clear newPassword and confirmPassword when oldPassword is cleared
      form.setValue("newPassword", "");
      form.setValue("confirmPassword", "");
    }
  }, [oldPassword, form]);

  // Fetch and prefill form with the currently logged-in user's data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        // Get user ID from localStorage
        const storedUser = getUserFromStorage();
        if (!storedUser || !storedUser.id) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description:
              "لم يتم العثور على معرف المستخدم. يرجى تسجيل الدخول مرة أخرى.",
          });
          return;
        }

        const result = await getUserById(storedUser.id);

        if (result?.error) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: result.message || "فشل في جلب بيانات المستخدم",
          });
          return;
        }

        if (result?.data) {
          const userData = result.data;
          console.log(userData);
          form.reset({
            userName: userData.userName || "",
            email: userData.email || "",
            oldPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          // Store organizationId, roleId, and technicalJobCategory for update
          setUserId(storedUser.id);
          setOrganizationId(userData.organizationId || null);
          setRoleId(userData.roleId || null);
          setTechnicalJobCategory(userData.technicalJobCategory || null);
        }
      } catch (error: any) {
        console.error("Error fetching user data:", error);
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "حدث خطأ أثناء جلب بيانات المستخدم",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const onSubmit = (data: AccountFormValues) => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description:
          "لم يتم العثور على معرف المستخدم. يرجى تسجيل الدخول مرة أخرى.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const updateData: any = {
          id: userId,
          userName: data.userName,
          email: data.email,
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        };

        // Include organizationId, roleId, and technicalJobCategory if they exist
        if (roleId) {
          updateData.roleId = roleId;
        }
        if (organizationId) {
          updateData.organizationId = organizationId;
        }
        if (technicalJobCategory) {
          updateData.technicalJobCategory = technicalJobCategory;
        }

        const result = await updateUserById(updateData);

        if (result?.error) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: result.message || "فشل في تحديث معلومات الحساب",
          });
          return;
        }

        toast({
          title: "تم التحديث بنجاح!",
          description: "تم حفظ معلومات الحساب بنجاح.",
        });

        // Reset password fields after successful update
        form.reset({
          ...data,
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } catch (error: any) {
        console.error("Error updating user:", error);
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "حدث خطأ أثناء تحديث معلومات الحساب",
        });
      }
    });
  };

  return (
    <motion.main
      className="container mx-auto px-4 pb-24 min-h-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <motion.div
        className="pb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h1 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          إدارة الحساب
        </h1>
        <p className="text-muted-foreground text-center text-lg">
          قم بإدارة معلوماتك الشخصية وكلمة المرور
        </p>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="border-2 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="text-center pb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <User className="h-10 w-10 text-white" />
              </motion.div>
              <CardTitle className="text-2xl">بيانات الحساب</CardTitle>
              <CardDescription>
                حدّث بياناتك وكلمة المرور من هنا
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <FormField
                      control={form.control}
                      name="userName"
                      render={({ field }) => (
                        <FormItem className="group">
                          <FormLabel className="text-base font-semibold group-hover:text-primary transition-colors">
                            الاسم الكامل
                          </FormLabel>
                          <FormControl>
                            <motion.div
                              whileFocus={{ scale: 1.02 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Input
                                {...field}
                                disabled={isPending}
                                className="text-lg h-12 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/50"
                                placeholder="أدخل اسمك الكامل"
                              />
                            </motion.div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="group">
                          <FormLabel className="text-base font-semibold group-hover:text-primary transition-colors">
                            البريد الإلكتروني
                          </FormLabel>
                          <FormControl>
                            <motion.div
                              whileFocus={{ scale: 1.02 }}
                              transition={{ duration: 0.2 }}
                              className="relative"
                            >
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                              <Input
                                {...field}
                                disabled={isPending}
                                className="text-lg h-12 pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/50"
                                placeholder="أدخل بريدك الإلكتروني"
                                type="email"
                              />
                            </motion.div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.5 }}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="oldPassword"
                      render={({ field }) => (
                        <FormItem className="group">
                          <FormLabel className="text-base font-semibold group-hover:text-primary transition-colors">
                            كلمة المرور الحالية
                          </FormLabel>
                          <FormControl>
                            <motion.div
                              whileFocus={{ scale: 1.02 }}
                              transition={{ duration: 0.2 }}
                              className="relative"
                            >
                              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                              <Input
                                {...field}
                                disabled={isPending}
                                className="text-lg h-12 pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/50"
                                placeholder="أدخل كلمة المرور الحالية"
                                type={showCurrentPassword ? "text" : "password"}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-12 w-10 hover:bg-transparent"
                                onClick={() =>
                                  setShowCurrentPassword(!showCurrentPassword)
                                }
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </motion.div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem className="group">
                            <FormLabel className="text-base font-semibold group-hover:text-primary transition-colors">
                              كلمة المرور الجديدة
                            </FormLabel>
                            <FormControl>
                              <motion.div
                                whileFocus={{ scale: 1.02 }}
                                transition={{ duration: 0.2 }}
                                className="relative"
                              >
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  {...field}
                                  disabled={
                                    isPending || isPasswordFieldsDisabled
                                  }
                                  className="text-lg h-12 pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/50"
                                  placeholder="أدخل كلمة المرور الجديدة"
                                  type={showNewPassword ? "text" : "password"}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-12 w-10 hover:bg-transparent"
                                  disabled={
                                    isPending || isPasswordFieldsDisabled
                                  }
                                  onClick={() =>
                                    setShowNewPassword(!showNewPassword)
                                  }
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </motion.div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem className="group">
                            <FormLabel className="text-base font-semibold group-hover:text-primary transition-colors">
                              تأكيد كلمة المرور
                            </FormLabel>
                            <FormControl>
                              <motion.div
                                whileFocus={{ scale: 1.02 }}
                                transition={{ duration: 0.2 }}
                                className="relative"
                              >
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  {...field}
                                  disabled={
                                    isPending || isPasswordFieldsDisabled
                                  }
                                  className="text-lg h-12 pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/50"
                                  placeholder="أكد كلمة المرور الجديدة"
                                  type={
                                    showConfirmPassword ? "text" : "password"
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-12 w-10 hover:bg-transparent"
                                  disabled={
                                    isPending || isPasswordFieldsDisabled
                                  }
                                  onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                  }
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </motion.div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                    className="flex justify-center pt-4"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        {isPending ? (
                          <motion.div
                            className="flex items-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <motion.div
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                            />
                            جاري الحفظ...
                          </motion.div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Save className="h-5 w-5" />
                            حفظ التغييرات
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.main>
  );
};

export default Account;
