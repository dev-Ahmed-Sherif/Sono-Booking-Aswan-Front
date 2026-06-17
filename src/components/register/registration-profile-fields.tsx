"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import type { DocumentType } from "@/schemas";
import { documentTypeLabels } from "@/schemas";
import { CheckNationalIdExists } from "@/actions/auth";
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
import { IdentityFileUpload } from "@/components/register/identity-file-upload";
import {
  birthDateFromEgyptianNationalId,
  documentTypeDerivesBirthDate,
  genderFormValueFromNationalId,
  NATIONAL_ID_EXISTED_MESSAGE,
} from "@/lib/companion-registration";

export const profileFieldInputClassName =
  "h-12 border-2 border-black dark:border-white bg-white text-base";

export const profileFieldSelectTriggerClassName = cn(
  profileFieldInputClassName,
  "text-right [&>span]:w-full [&>span]:text-right",
);

export const profileFieldDateButtonClassName = cn(
  profileFieldInputClassName,
  "w-full justify-between text-right font-normal",
);

/** Minimal shape for profile + identity fields (registration vs account DTO naming). */
export type RegistrationProfileFormShape = {
  documentType?: DocumentType;
  nationalId?: string;
  documentNumber?: string;
  gender?: "male" | "female";
  birthDate?: Date;
  mobile?: string;
  phone?: string;
  email: string;
  identityAttachment?: File;
  fullName?: string;
  userName?: string;
  documentImageUrl?: string;
  existingDocumentImageUrl?: string;
};

export type ProfileDocumentIdField = "nationalId" | "documentNumber";
export type ProfilePhoneField = "mobile" | "phone";

type RegistrationProfileFieldsProps<T extends RegistrationProfileFormShape> = {
  form: UseFormReturn<T>;
  locale: string;
  disabled?: boolean;
  nameField?: "fullName" | "userName";
  identityRequired?: boolean;
  inputClassName?: string;
  /** Bind رقم المستند to `nationalId` (تسجيل) or `documentNumber` (حساب / DTO). */
  documentIdField?: ProfileDocumentIdField;
  /** Bind رقم الموبيل to `mobile` (تسجيل) or `phone` (حساب / DTO). */
  phoneField?: ProfilePhoneField;
  /** Rendered beside the email field in the same row */
  afterEmailField?: ReactNode;
  /** Rendered after email/mobile grid, before identity file upload */
  betweenMainFieldsAndIdentity?: ReactNode;
  /** Live duplicate check for registration national ID / document number */
  checkNationalIdAvailability?: boolean;
};

const RegistrationProfileFields = <T extends RegistrationProfileFormShape>({
  form,
  locale,
  disabled = false,
  nameField = "fullName",
  identityRequired = true,
  inputClassName = profileFieldInputClassName,
  documentIdField = "nationalId",
  phoneField = "mobile",
  afterEmailField,
  betweenMainFieldsAndIdentity,
  checkNationalIdAvailability = false,
}: RegistrationProfileFieldsProps<T>) => {
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;
  const currentYear = new Date().getFullYear();
  const nationalIdCheckRequestId = useRef(0);
  const [nationalIdCheckStatus, setNationalIdCheckStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  const docIdPath = documentIdField as FieldPath<T>;
  const phonePath = phoneField as FieldPath<T>;

  const documentType = form.watch("documentType" as FieldPath<T>);
  const documentIdValue = form.watch(docIdPath) as string;
  const documentImageUrl = form.watch(
    "documentImageUrl" as FieldPath<T>,
  ) as string | undefined;
  const derivesBirthDate = documentType
    ? documentTypeDerivesBirthDate(documentType as DocumentType)
    : false;
  const birthDateAutoDerived = Boolean(
    derivesBirthDate && birthDateFromEgyptianNationalId(documentIdValue ?? ""),
  );
  const genderAutoDerived = Boolean(
    derivesBirthDate && genderFormValueFromNationalId(documentIdValue ?? ""),
  );

  useEffect(() => {
    if (!documentType || !documentTypeDerivesBirthDate(documentType as DocumentType)) {
      return;
    }

    const derivedBirth = birthDateFromEgyptianNationalId(documentIdValue ?? "");
    if (derivedBirth) {
      form.setValue(
        "birthDate" as FieldPath<T>,
        derivedBirth as never,
        { shouldValidate: true },
      );
    }

    const derivedGender = genderFormValueFromNationalId(documentIdValue ?? "");
    if (derivedGender) {
      form.setValue(
        "gender" as FieldPath<T>,
        derivedGender as never,
        { shouldValidate: true },
      );
    }
  }, [documentType, documentIdValue, form]);

  useEffect(() => {
    if (!checkNationalIdAvailability || documentIdField !== "nationalId") {
      setNationalIdCheckStatus("idle");
      return;
    }

    const trimmed = (documentIdValue ?? "").trim();
    if (!trimmed) {
      setNationalIdCheckStatus("idle");
      form.clearErrors(docIdPath);
      return;
    }

    const requestId = ++nationalIdCheckRequestId.current;
    setNationalIdCheckStatus("checking");

    const timer = window.setTimeout(async () => {
      const result = await CheckNationalIdExists(trimmed);
      if (requestId !== nationalIdCheckRequestId.current) return;

      if (result.exists) {
        setNationalIdCheckStatus("taken");
        form.setError(docIdPath, {
          type: "manual",
          message: result.message || NATIONAL_ID_EXISTED_MESSAGE,
        });
        return;
      }

      if (result.error) {
        setNationalIdCheckStatus("idle");
        return;
      }

      setNationalIdCheckStatus("available");
      const currentError = form.getFieldState(docIdPath).error;
      if (currentError?.type === "manual") {
        form.clearErrors(docIdPath);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    checkNationalIdAvailability,
    documentIdField,
    documentIdValue,
    docIdPath,
    form,
  ]);

  const nameLabel = nameField === "userName" ? "userName" : "fullName";
  const nameTitle =
    nameField === "userName" ? "الاسم الكامل" : "الاسم الكامل";

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField
          control={form.control}
          name={nameLabel as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">{nameTitle}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  disabled={disabled}
                  className={inputClassName}
                  placeholder="أدخل الاسم الكامل"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"documentType" as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">نوع المستند</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value as string}
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
          name={docIdPath}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">رقم المستند</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  inputMode={derivesBirthDate ? "numeric" : "text"}
                  maxLength={14}
                  disabled={disabled}
                  className={inputClassName}
                  placeholder={
                    derivesBirthDate
                      ? "أدخل الرقم القومي (14 رقمًا)"
                      : "أدخل رقم المستند"
                  }
                />
              </FormControl>
              {checkNationalIdAvailability && nationalIdCheckStatus === "checking" ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  جاري التحقق من رقم المستند...
                </p>
              ) : null}
              {checkNationalIdAvailability && nationalIdCheckStatus === "available" ? (
                <p className="text-xs text-emerald-600">رقم المستند متاح</p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"gender" as FieldPath<T>}
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
                value={field.value as string}
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
          name={"birthDate" as FieldPath<T>}
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
                        !Number.isNaN((field.value as Date).getTime())
                          ? format(field.value as Date, "PPP", {
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
                    selected={field.value as Date | undefined}
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
          name={phonePath}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">رقم الموبيل</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  inputMode="numeric"
                  maxLength={11}
                  disabled={disabled}
                  className={inputClassName}
                  placeholder="01XXXXXXXXX"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"email" as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">الإيميل</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string}
                  type="email"
                  disabled={disabled}
                  className={inputClassName}
                  placeholder="name@mail.com"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {afterEmailField}
      </div>

      {betweenMainFieldsAndIdentity ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {betweenMainFieldsAndIdentity}
        </div>
      ) : null}

      <div className="w-full">
      <FormField
        control={form.control}
        name={"identityAttachment" as FieldPath<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-bold">
              رفع صورة البطاقة/شهادة الميلاد
              {!identityRequired ? (
                <span className="font-normal text-muted-foreground text-xs mr-1">
                  (اختياري عند التحديث)
                </span>
              ) : null}
            </FormLabel>
            <FormControl>
              <IdentityFileUpload
                value={field.value as File | undefined}
                onChange={field.onChange}
                disabled={disabled}
                existingDocumentUrl={documentImageUrl}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      </div>
    </>
  );
};

export default RegistrationProfileFields;
