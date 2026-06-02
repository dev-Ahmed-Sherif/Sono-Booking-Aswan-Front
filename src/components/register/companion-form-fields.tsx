"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import {
  documentTypeLabels,
  registrationCompanionSchema,
} from "@/schemas";
import { Button } from "@/components/ui/button";
import {
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
import { cn } from "@/lib/utils";
import type { GenericOption } from "@/lib/availability-inquiry";
import { IdentityFileUpload } from "@/components/register/identity-file-upload";
import {
  profileFieldDateButtonClassName,
  profileFieldInputClassName,
  profileFieldSelectTriggerClassName,
} from "@/components/register/registration-profile-fields";
import {
  birthDateFromEgyptianNationalId,
  documentTypeDerivesBirthDate,
  genderFormValueFromNationalId,
} from "@/lib/companion-registration";

export type CompanionFormValues = z.infer<typeof registrationCompanionSchema>;

type CompanionFormFieldsProps = {
  form: UseFormReturn<CompanionFormValues>;
  relationshipOptions: GenericOption[];
  locale: string;
  disabled?: boolean;
  identityRequired?: boolean;
  /** Return an error message to block the selection and show under the field. */
  validateRelationshipId?: (relationshipId: string) => string | undefined;
};

const CompanionFormFields = ({
  form,
  relationshipOptions,
  locale,
  disabled = false,
  identityRequired = true,
  validateRelationshipId,
}: CompanionFormFieldsProps) => {
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;
  const currentYear = new Date().getFullYear();

  return (
    <CompanionFieldsGrid
      form={form}
      relationshipOptions={relationshipOptions}
      dateFnsLocale={dateFnsLocale}
      currentYear={currentYear}
      disabled={disabled}
      identityRequired={identityRequired}
      validateRelationshipId={validateRelationshipId}
    />
  );
};

function CompanionFieldsGrid({
  form,
  relationshipOptions,
  dateFnsLocale,
  currentYear,
  disabled,
  identityRequired,
  validateRelationshipId,
}: {
  form: UseFormReturn<CompanionFormValues>;
  relationshipOptions: GenericOption[];
  dateFnsLocale: typeof ar;
  currentYear: number;
  disabled: boolean;
  identityRequired: boolean;
  validateRelationshipId?: (relationshipId: string) => string | undefined;
}) {
  const documentType = form.watch("documentType");
  const nationalId = form.watch("nationalId");
  const documentImageUrl = form.watch("documentImageUrl");
  const derivesBirthDate = documentType
    ? documentTypeDerivesBirthDate(documentType)
    : false;
  const birthDateAutoDerived = Boolean(
    derivesBirthDate && birthDateFromEgyptianNationalId(nationalId ?? ""),
  );
  const genderAutoDerived = Boolean(
    derivesBirthDate && genderFormValueFromNationalId(nationalId ?? ""),
  );

  useEffect(() => {
    if (!documentType || !documentTypeDerivesBirthDate(documentType)) return;

    const derivedBirth = birthDateFromEgyptianNationalId(nationalId ?? "");
    if (derivedBirth) {
      form.setValue("birthDate", derivedBirth, { shouldValidate: true });
    }

    const derivedGender = genderFormValueFromNationalId(nationalId ?? "");
    if (derivedGender) {
      form.setValue("gender", derivedGender, { shouldValidate: true });
    }
  }, [documentType, nationalId, form]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="relationshipId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-bold">صلة القرابة</FormLabel>
            <Select
              onValueChange={(value) => {
                const error = validateRelationshipId?.(value);
                if (error) {
                  form.setError("relationshipId", {
                    type: "manual",
                    message: error,
                  });
                  return;
                }
                form.clearErrors("relationshipId");
                field.onChange(value);
              }}
              value={field.value}
              disabled={disabled}
              dir="rtl"
            >
              <FormControl>
                <SelectTrigger className={profileFieldSelectTriggerClassName}>
                  <SelectValue placeholder="اختر صلة القرابة" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="text-right" dir="rtl">
                {relationshipOptions.map((option) => (
                  <SelectItem
                    className="text-right"
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="fullName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-bold">اسم المرافق كامل</FormLabel>
            <FormControl>
              <Input
                {...field}
                className={profileFieldInputClassName}
                placeholder="أدخل اسم المرافق كامل"
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="documentType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-bold">نوع المستند</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={disabled}
              dir="rtl"
            >
              <FormControl>
                <SelectTrigger className={profileFieldSelectTriggerClassName}>
                  <SelectValue placeholder="اختر نوع المستند" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="text-right" dir="rtl">
                {(
                  Object.entries(documentTypeLabels) as Array<
                    [keyof typeof documentTypeLabels, string]
                  >
                ).map(([value, label]) => (
                  <SelectItem
                    key={value}
                    className="text-right"
                    value={value}
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="nationalId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-bold">رقم المستند</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode={derivesBirthDate ? "numeric" : "text"}
                maxLength={14}
                className={profileFieldInputClassName}
                placeholder={
                  derivesBirthDate
                    ? "أدخل الرقم القومي (14 رقمًا)"
                    : "أدخل رقم المستند"
                }
                disabled={disabled}
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
            <FormLabel className="font-bold">
              النوع
              {genderAutoDerived ? (
                <span className="font-normal text-muted-foreground text-xs mr-1">
                  (يُستخرج من الرقم القومي)
                </span>
              ) : null}
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={disabled || genderAutoDerived}
              dir="rtl"
            >
              <FormControl>
                <SelectTrigger className={profileFieldSelectTriggerClassName}>
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
              {birthDateAutoDerived ? (
                <span className="font-normal text-muted-foreground text-xs mr-1">
                  (يُستخرج من الرقم القومي)
                </span>
              ) : null}
            </FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || birthDateAutoDerived}
                    className={cn(
                      profileFieldDateButtonClassName,
                      !field.value && "text-muted-foreground",
                    )}
                    dir="rtl"
                  >
                    <span>
                      {field.value instanceof Date &&
                      !Number.isNaN(field.value.getTime())
                        ? format(field.value, "PPP", { locale: dateFnsLocale })
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
        name="identityAttachment"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel className="font-bold">
              رفع صورة البطاقة/شهادة الميلاد
              {!identityRequired ? (
                <span className="font-normal text-muted-foreground text-xs mr-1">
                  (اختياري عند التعديل إذا كان المستند محفوظاً)
                </span>
              ) : null}
            </FormLabel>
            <FormControl>
              <div className="w-full">
                <IdentityFileUpload
                  value={field.value as File | undefined}
                  onChange={field.onChange}
                  disabled={disabled}
                  existingDocumentUrl={documentImageUrl}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export default CompanionFormFields;
