"use client";

import { useParams, useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Input } from "@/components/ui/input";

import AlertModal from "@/components/modals/alert-modal";

import { useToast } from "@/hooks/use-toast";

import useToggleState from "@/hooks/use-toggle-state";

import { roleSchema } from "@/schemas";
import {
  addRole,
  deleteRoleById,
  updateRoleById,
} from "@/actions/permissions/roleService";

import { ToastAction } from "@radix-ui/react-toast";

type RoleFormProps = {
  initialData: any | null;
  name: string;
};

type RoleFormValues = z.infer<typeof roleSchema>;

const RoleForm = ({ initialData, name }: RoleFormProps) => {
  console.log("initialData", initialData);
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();

  const [open, toggleOpen] = useToggleState(false);
  const [loading, toggleLoading] = useToggleState(false);

  const title = initialData ? `تعديل ${name}` : `حفظ ${name}`;
  const description = initialData ? "تعديل" : "حفظ دور جديد";
  const toastMessage = initialData ? "تم التعديل بنجاح" : "تم الأضافة بنجاح";
  const toastMessageError = "هذا الدور موجود بالفعل";
  const action = initialData ? "تعديل" : "حفظ";

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      nameAr: initialData?.nameAr || "",
      nameEn: initialData?.nameEn || "",
    },
  });

  const onSubmit = async (data: RoleFormValues) => {
    console.log(data);
    try {
      toggleLoading();

      if (initialData) {
        let res = await updateRoleById({
          ...data,
          id: initialData.id,
        });
        console.log(res);

        if (res?.error) {
          throw new Error(res.message || res.error);
        }
      } else {
        let res = await addRole(data);
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

      const result = await deleteRoleById(initialData.id);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="nameAr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الدور بالعربية</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="text"
                      placeholder="اسم الدور بالعربية"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الدور بالإنجليزية</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      type="text"
                      placeholder="اسم الدور بالإنجليزية"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-center">
            <Button disabled={loading} className="text-center h-11 min-w-32 px-6">
              {loading && <Loader2 className="h-6 w-6" />}
              {action}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

export default RoleForm;
