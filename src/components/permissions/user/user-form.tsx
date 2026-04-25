"use client";

import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Resolver } from "react-hook-form";
import { Loader2, Trash } from "lucide-react";

import Heading from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import AlertModal from "@/components/modals/alert-modal";

import { useToast } from "@/hooks/use-toast";

import useToggleState from "@/hooks/use-toggle-state";

import { userSchema } from "@/schemas";
import {
  addUser,
  deleteUserById,
  getUsers,
  updateUserById,
} from "@/actions/permissions/userService";

import { getRoles } from "@/actions/permissions/roleService";

import { getUnitCategories } from "@/actions/settings/unitCategoryService";

import { ToastAction } from "@radix-ui/react-toast";

type UserFormProps = {
  initialData: any | null;
  name: string;
};

type UserFormValues = z.infer<typeof userSchema>;

const UserForm = ({ initialData, name }: UserFormProps) => {
  console.log("initialData", initialData);
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);
  const [rolesData, setRolesData] = useState<any[]>([]);
  const [organizationsData, setOrganizationsData] = useState<any[]>([]);
  const [technicalJobCategoriesData, setTechnicalJobCategoriesData] = useState<
    any[]
  >([]);

  const title = initialData ? `تعديل ${name}` : `حفظ ${name}`;
  const description = initialData ? "تعديل" : "حفظ مستخدم جديد";
  const toastMessage = initialData ? "تم التعديل بنجاح" : "تم الأضافة بنجاح";
  const toastMessageError = "هذا المستخدم موجود بالفعل";
  const action = initialData ? "تعديل" : "حفظ";

  useEffect(() => {
    const fetchData = async () => {
      const rolesDataResult = await getRoles();
      if (rolesDataResult?.data) {
        setRolesData(rolesDataResult.data);
      }

      // const organizationsDataResult = await getOrganizations();
      // if (organizationsDataResult?.data) {
      //   setOrganizationsData(organizationsDataResult.data);
      // }

      const technicalJobCategoriesResult = await getUnitCategories();
      if (technicalJobCategoriesResult?.data) {
        setTechnicalJobCategoriesData(technicalJobCategoriesResult.data);
        console.log(technicalJobCategoriesResult);
      }
    };
    fetchData();
  }, []);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    mode: "onSubmit",
    defaultValues: {
      name: initialData?.data?.userName || "",
      email: initialData?.data?.email || "",
      password: "",
      roleId: initialData?.data?.roleId || "",
      organizationId: initialData?.data?.organizationId || "",
      // Support multiple possible shapes for the technical job category coming from the API
      technicalJobCategory: initialData?.data?.technicalJobCategory ?? "",
    },
  });

  // Watch roleId to handle conditional validation
  const selectedRoleId = form.watch("roleId");

  // Check if selected role is Super Admin or Admin
  const isSuperAdminOrAdminRole = useMemo(() => {
    if (!selectedRoleId || !rolesData.length) return false;
    const selectedRole = rolesData.find(
      (role: any) => String(role.id) === String(selectedRoleId),
    );
    if (!selectedRole) return false;

    const roleNameAr = (selectedRole?.nameAr || "").toLowerCase().trim();
    const roleNameEn = (selectedRole?.nameEn || "").toLowerCase().trim();
    const roleName = (selectedRole?.name || "").toLowerCase().trim();

    // Check all possible variations
    const isSuperAdmin =
      roleNameAr.includes("super admin") ||
      roleNameAr.includes("superadmin") ||
      roleNameEn.includes("super admin") ||
      roleNameEn.includes("superadmin") ||
      roleName.includes("super admin") ||
      roleName.includes("superadmin");

    const isAdmin =
      roleNameAr === "admin" ||
      roleNameEn === "admin" ||
      roleName === "admin" ||
      roleNameAr.includes(" admin") ||
      roleNameEn.includes(" admin");

    const result = isSuperAdmin || isAdmin;
    console.log("Role check:", {
      selectedRoleId,
      roleNameAr,
      roleNameEn,
      roleName,
      isSuperAdmin,
      isAdmin,
      result,
    });

    return result;
  }, [selectedRoleId, rolesData]);

  // Clear validation errors and values for organizationId and technicalJobCategory when role is Super Admin or Admin
  useEffect(() => {
    if (isSuperAdminOrAdminRole) {
      // Clear errors for these fields when role is Super Admin or Admin
      form.clearErrors("organizationId");
      form.clearErrors("technicalJobCategory");
      // Clear the values (set to empty string/null) when role changes to Super Admin or Admin
      form.setValue("organizationId", "");
      form.setValue("technicalJobCategory", "");
    }
  }, [isSuperAdminOrAdminRole, form]);

  // Normalize technical job category value (API may return name instead of id)
  useEffect(() => {
    if (!initialData || !technicalJobCategoriesData.length) return;

    const current = form.getValues("technicalJobCategory");
    // If already set (e.g., id from API), skip
    if (current) return;

    const apiValue =
      initialData?.data?.technicalJobCategoryId ??
      initialData?.data?.technicalJobCategory ??
      initialData?.technicalJobCategoryId;

    if (!apiValue) return;

    const match = technicalJobCategoriesData.find(
      (cat: any) =>
        String(cat.id) === String(apiValue) ||
        cat.nameAr === apiValue ||
        cat.nameEn === apiValue ||
        cat.name === apiValue,
    );

    if (match) {
      form.setValue("technicalJobCategory", String(match.id));
    }
  }, [initialData, technicalJobCategoriesData, form]);

  const onSubmit = async (data: UserFormValues) => {
    console.log(data);
    try {
      toggleLoading();

      // Check if the selected role is Super Admin or Admin
      const selectedRole = rolesData.find(
        (role: any) => String(role.id) === String(data.roleId),
      );

      if (!selectedRole) {
        console.error("Role not found for roleId:", data.roleId);
      }

      const roleNameAr = (selectedRole?.nameAr || "").toLowerCase().trim();
      const roleNameEn = (selectedRole?.nameEn || "").toLowerCase().trim();
      const roleName = (selectedRole?.name || "").toLowerCase().trim();

      const isSuperAdmin = roleNameEn === "super admin";

      const isAdmin = roleNameEn === "admin";

      const isSuperAdminOrAdmin = isSuperAdmin || isAdmin;

      console.log("Submit validation - Role check:", {
        roleId: data.roleId,
        roleNameAr,
        roleNameEn,
        roleName,
        isSuperAdmin,
        isAdmin,
        isSuperAdminOrAdmin,
      });

      // Validate organizationId and technicalJobCategory if role is not Super Admin or Admin
      if (!isSuperAdminOrAdmin) {
        if (!data.organizationId || data.organizationId.trim() === "") {
          form.setError("organizationId", {
            type: "required",
            message: "الجهة مطلوبة",
          });
          // toggleLoading();
          return;
        }
        if (
          !data.technicalJobCategory ||
          data.technicalJobCategory.trim() === ""
        ) {
          form.setError("technicalJobCategory", {
            type: "required",
            message: "فئة المهمة التقنية مطلوبة",
          });
          // toggleLoading();
          return;
        }
      }

      console.log(process.env.DEF_PASS);

      if (initialData) {
        // For update, password is optional
        const updateData: any = {
          id: initialData.data.id,
          userName: data.name,
          email: data.email,
          oldPassword: "",
          newPassword: data.password === "" ? "123456" : data.password,
          // newPassword: data.password,
          // confirmPassword: data.password,
          confirmPassword: data.password === "" ? "123456" : data.password,
          roleId: data.roleId,
          // Only include organizationId and technicalJobCategory if they are provided
          ...(data.organizationId && { organizationId: data.organizationId }),
          ...(data.technicalJobCategory && {
            technicalJobCategory: data.technicalJobCategory,
          }),
        };

        // Only include password if it's provided
        if (!data.password || data.password.trim() === "") {
          delete updateData.password;
        }

        let res = await updateUserById(updateData);
        console.log(res);

        if (res?.error) {
          throw new Error(res.message || res.error);
        }
      } else {
        // Prepare data for addUser, only include organizationId and technicalJobCategoryId if provided
        const addUserData: any = {
          name: data.name,
          email: data.email,
          oldPassword: data.password,
          newPassword: data.password === "" ? "123456" : data.password,
          confirmPassword: data.password === "" ? "123456" : data.password,
          roleId: data.roleId,
        };
        if (data.organizationId) {
          addUserData.organizationId = data.organizationId;
        }
        if (data.technicalJobCategory) {
          addUserData.technicalJobCategoryId = data.technicalJobCategory;
        }
        let res = await addUser(addUserData);
        console.log(res);

        if (res?.error) {
          throw new Error(res.message || res.error);
        }
      }

      router.refresh();
      setTimeout(() => {
        router.push(`/${params.locale}/permissions`);
      }, 1000);

      toast({
        description: `🎉 ${toastMessage}`,
      });
    } catch (err: any) {
      const errorMessage =
        err.message || err.response?.data?.message || "حدث خطأ مجهول";

      if (err.message?.includes("409") || err.message?.includes("Conflict")) {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "حدث خطأ !",
          description: `❌ ${toastMessageError}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      } else if (
        err.message?.includes("500") ||
        err.message?.includes("Server Error")
      ) {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "حدث خطأ في الخادم !",
          description: `❌ ${errorMessage}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      } else if (
        err.message?.includes("401") ||
        err.message?.includes("Unauthorized")
      ) {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "خطأ في المصادقة !",
          description: `❌ ${errorMessage}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      } else {
        toast({
          variant: "destructive",
          duration: 3000,
          title: "حدث خطأ !",
          description: `❌ ${errorMessage}`,
          action: <ToastAction altText="Try again">حاول مره اخرى</ToastAction>,
        });
      }
    } finally {
      toggleLoading();
    }
  };

  const onDelete = async () => {
    try {
      toggleLoading();

      const result = await deleteUserById(initialData.data.id);

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "خطأ في الحذف",
          description: result.message || "❌ لم يتم الحذف",
          duration: 3000,
        });
        toggleLoading();
        toggleOpen();
        return;
      }

      toast({
        description: "👍👍 تم الحذف بنجاح",
        duration: 2000,
      });

      toggleOpen();
      toggleLoading();

      setTimeout(() => {
        router.push(`/${params.locale}/permissions`);
        setTimeout(() => {
          router.refresh();
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }, 500);
      }, 1000);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err.message || "❌ لم يتم الحذف",
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => {
              toggleOpen();
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-full"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="text"
                      placeholder="أدخل الاسم"
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
                  <FormLabel>الإيميل</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="email"
                      placeholder="example@email.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!initialData && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="password"
                        placeholder="أدخل كلمة المرور"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {initialData && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور (اختياري)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={loading}
                        type="password"
                        placeholder="اتركه فارغاً إذا لم تريد التغيير"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    الدور
                  </FormLabel>
                  <FormControl>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      dir="rtl"
                    >
                      <FormControl>
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200">
                          <SelectValue placeholder="أختر الدور" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>الدور</SelectLabel>
                          {rolesData.map((role: any) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.nameAr || role.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    الجهة
                    {isSuperAdminOrAdminRole && (
                      <span className="text-gray-500 text-sm"> (اختياري)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      dir="rtl"
                    >
                      <FormControl>
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200">
                          <SelectValue placeholder="أختر الجهة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>الجهة</SelectLabel>
                          {organizationsData.map((organization: any) => (
                            <SelectItem
                              key={organization.id}
                              value={organization.id}
                            >
                              {organization.nameAr}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="technicalJobCategory"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    فئة المهمة التقنية
                    {isSuperAdminOrAdminRole && (
                      <span className="text-gray-500 text-sm"> (اختياري)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Select
                      disabled={loading}
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      value={field.value ? String(field.value) : ""}
                      dir="rtl"
                    >
                      <FormControl>
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200">
                          <SelectValue placeholder="أختر فئة المهمة التقنية" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>فئة المهمة التقنية</SelectLabel>
                          {technicalJobCategoriesData.map((category: any) => (
                            <SelectItem
                              key={category.id}
                              value={String(category.code)}
                            >
                              {category.nameAr || category.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-center">
            <Button
              disabled={loading}
              className="text-center h-11 min-w-32 px-6"
            >
              {loading && <Loader2 className="h-6 w-6" />}
              {action}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default UserForm;
