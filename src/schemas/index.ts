// import { UserRole } from "@prisma/client";
import * as z from "zod";

import { isImageFile } from "@/lib/image-file";

export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, {
      message: "Email is required",
    })
    .email({
      message: "Email is Invalid",
    }),
  password: z.string().min(6, {
    message: "Minimum 6 characters required",
  }),
  name: z.string().min(1, {
    message: "Name is required",
  }),
});

export const LoginSchema = z.object({
  // name: z.string().min(1, { message: "Please Enter Your Name Or Number" }),
  email: z.string().min(1, { message: "يجب إدخال الإيميل" }),
  // password: z.string().min(1, { message: "Please Enter Your Password" }),
  password: z.string().min(1, { message: "يجب إدخال كلمة المرور" }),
});

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "يجب إدخال البريد الإلكتروني" })
    .email({ message: "البريد الإلكتروني غير صالح" }),
});

const birthDateSchema = z.date({
  required_error: "تاريخ الميلاد مطلوب",
  invalid_type_error: "تاريخ الميلاد غير صالح",
});

const identityFileSchema = z
  .any()
  .refine((val) => val instanceof File, {
    message: "يرجى رفع صورة البطاقة/شهادة الميلاد",
  })
  .refine(
    (val) => {
      if (!(val instanceof File)) return false;
      const type = (val.type || "").toLowerCase();
      const name = (val.name || "").toLowerCase();
      return isImageFile(val) || type === "application/pdf" || name.endsWith(".pdf");
    },
    {
      message: "يُسمح برفع الصور أو ملفات PDF فقط",
    },
  );

export const documentTypeEnum = z.enum(
  ["IDCard", "Passport", "ResidencePermit"],
  {
    required_error: "نوع المستند مطلوب",
  },
);

export type DocumentType = z.infer<typeof documentTypeEnum>;

export const documentTypeLabels: Record<DocumentType, string> = {
  IDCard: "بطاقة شخصية",
  Passport: "جواز سفر",
  ResidencePermit: "شهادة ميلاد",
};

export const registrationCompanionSchema = z
  .object({
    id: z.string().optional(),
    relationshipId: z.string().min(1, { message: "صلة القرابة مطلوبة" }),
    fullName: z.string().min(1, { message: "اسم المرافق كامل مطلوب" }),
    documentType: documentTypeEnum.optional(),
    nationalId: z
      .string()
      .min(1, { message: "رقم المستند مطلوب" })
      .max(14, { message: "رقم المستند يجب ألا يزيد عن 14 رقمًا" }),
    gender: z.enum(["male", "female"], {
      required_error: "النوع مطلوب",
    }).optional(),
    birthDate: birthDateSchema,
    documentImageUrl: z.string().optional(),
    identityAttachment: identityFileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.documentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentType"],
        message: "نوع المستند مطلوب",
      });
    }
    if (!data.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gender"],
        message: "النوع مطلوب",
      });
    }

    const needsNationalId =
      data.documentType === "IDCard" ||
      data.documentType === "ResidencePermit";
    if (needsNationalId && !/^\d{14}$/.test(data.nationalId.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nationalId"],
        message: "رقم المستند يجب أن يكون 14 رقمًا",
      });
    }
  });

export const registrationSchema = z
  .object({
  fullName: z
    .string()
    .min(1, { message: "الاسم الكامل مطلوب" })
    .max(70, { message: "الاسم الكامل يجب ألا يزيد عن 70 حرفًا" }),
  nationalId: z
    .string()
    .min(1, { message: "رقم المستند مطلوب" })
    .max(14, { message: "رقم المستند يجب ألا يزيد عن 14 رقمًا" }),
  documentType: documentTypeEnum,
  gender: z.enum(["male", "female"], {
    required_error: "النوع مطلوب",
  }),
  birthDate: birthDateSchema,
  mobile: z
    .string()
    .min(1, { message: "رقم الموبيل مطلوب" })
    .regex(/^(010|011|012|015)\d{8}$/, {
      message:
        "رقم الموبيل يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقمًا",
    }),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
  password: z
    .string()
    .min(1, { message: "كلمة المرور مطلوبة" })
    .min(6, { message: "كلمة المرور يجب أن تكون على الأقل 6 أحرف" }),
  identityAttachment: identityFileSchema,
  companions: z.array(registrationCompanionSchema).default([]),
})
  .superRefine((data, ctx) => {
    const needsNationalId =
      data.documentType === "IDCard" ||
      data.documentType === "ResidencePermit";
    if (needsNationalId && !/^\d{14}$/.test(data.nationalId.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nationalId"],
        message: "رقم المستند يجب أن يكون 14 رقمًا",
      });
    }
  });

export type RegistrationFormValues = z.infer<typeof registrationSchema>;

export const reservationSelectableGuestSchema = z.object({
  id: z.string().min(1, { message: "معرّف الشخص مطلوب" }),
  name: z.string().min(1, { message: "اسم الشخص مطلوب" }),
  role: z.enum(["applicant", "companion"]),
});

export const reservationRequestSchema = z
  .object({
    startDate: z
      .string()
      .min(1, { message: "تاريخ البدء مطلوب" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "صيغة تاريخ البدء غير صحيحة",
      }),
    numberOfNights: z.coerce
      .number({
        required_error: "عدد الليالي مطلوب",
        invalid_type_error: "عدد الليالي غير صالح",
      })
      .int({ message: "عدد الليالي يجب أن يكون عددًا صحيحًا" })
      .min(1, { message: "عدد الليالي يجب أن يكون ليلة واحدة على الأقل" }),
    guests: z.array(reservationSelectableGuestSchema).min(1, {
      message: "بيانات طالب الإقامة مطلوبة",
    }),
    selectedGuestIds: z.array(z.string()).min(1, {
      message: "يجب اختيار اسم واحد على الأقل",
    }),
  })
  .superRefine((data, ctx) => {
    const guestIds = new Set(data.guests.map((guest) => guest.id));

    data.selectedGuestIds.forEach((selectedId, index) => {
      if (!guestIds.has(selectedId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedGuestIds", index],
          message: "تم اختيار اسم غير موجود ضمن القائمة",
        });
      }
    });
  });

export type ReservationRequestFormValues = z.infer<
  typeof reservationRequestSchema
>;

export const inboxSchema = z.object({
  // name: z.string().min(1, { message: "Please Enter Your Name Or Number" }),
  inboxTypeId: z.string().min(1, { message: "يجب إدخال نوع الوارد" }),
  // password: z.string().min(1, { message: "Please Enter Your Password" }),
  organizationId: z.string().min(1, { message: "يجب إدخال الجهة المستلمة" }),
  employeeName: z.string().min(1, { message: "يجب إدخال اسم الموظف المستلم" }),
  startDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  startTime: z.string().min(1, { message: "يجب إدخال وقت البداية" }),
  endDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  endTime: z.string().min(1, { message: "يجب إدخال وقت النهاية" }),
  description: z.string().min(1, { message: "يجب إدخال الوصف" }),
  images: z.any().array().optional(),
});

export const visitorSchema = z.object({
  // name: z.string().min(1, { message: "Please Enter Your Name Or Number" }),
  visitorTypeId: z.string().min(1, { message: "يجب إدخال نوع الزائر" }),
  // password: z.string().min(1, { message: "Please Enter Your Password" }),
  organizationId: z.string().min(1, { message: "يجب إدخال الجهة المستضيفة" }),
  employeeName: z.string().min(1, { message: "يجب إدخال اسم الموظف المستضيف" }),
  startDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  startTime: z.string().min(1, { message: "يجب إدخال وقت البداية" }),
  endDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  endTime: z.string().min(1, { message: "يجب إدخال وقت النهاية" }),
  description: z.string().min(1, { message: "يجب إدخال الوصف" }),
  images: z.any().array().optional(),
});

export const sentSchema = z.object({
  // name: z.string().min(1, { message: "Please Enter Your Name Or Number" }),
  sentTypeId: z.string().min(1, { message: "يجب إدخال نوع الصادر" }),
  // password: z.string().min(1, { message: "Please Enter Your Password" }),
  organizationId: z.string().min(1, { message: "يجب إدخال الجهة المستلمة" }),
  employeeName: z.string().min(1, { message: "يجب إدخال اسم الموظف المستلم" }),
  startDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  startTime: z.string().min(1, { message: "يجب إدخال وقت البداية" }),
  endDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }),
  endTime: z.string().min(1, { message: "يجب إدخال وقت النهاية" }),
  description: z.string().min(1, { message: "يجب إدخال الوصف" }),
  images: z.any().array().optional(),
});

export const ResetSchema = z.object({
  email: z
    .string()
    .min(1, {
      message: "Email is required",
    })
    .email({
      message: "Email is Invalid",
    }),
});

export const NewPasswordSchema = z.object({
  password: z.string().min(1, {
    message: "Password is required",
  }),
});

export const SettingsSchema = z
  .object({
    name: z.optional(z.string()),
    isTwoFactorEnabled: z.optional(z.boolean()),
    // role: z.enum([UserRole.ADMIN, UserRole.USER]),
    email: z.optional(z.string()),
    password: z.optional(
      z.string().min(6, {
        message: "Minimum 6 characters required",
      }),
    ),
    newPassword: z.optional(
      z.string().min(6, {
        message: "Minimum 6 characters required",
      }),
    ),
  })
  .refine(
    (data) => {
      if (data.password && !data.newPassword) {
        return false;
      }
      return true;
    },
    {
      message: "New Password is required",
      path: ["newPassword"],
    },
  )
  .refine(
    (data) => {
      if (!data.password && data.newPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Password is required",
      path: ["password"],
    },
  );

export const accountSchema = z
  .object({
    id: z.string().optional(),
    userName: z
      .string()
      .min(1, { message: "الاسم الكامل مطلوب" })
      .max(70, { message: "الاسم الكامل يجب ألا يزيد عن 70 حرفًا" }),
    documentType: documentTypeEnum,
    documentNumber: z
      .string()
      .min(1, { message: "رقم المستند مطلوب" })
      .max(14, { message: "رقم المستند يجب ألا يزيد عن 14 رقمًا" }),
    gender: z.enum(["male", "female"], {
      required_error: "النوع مطلوب",
    }),
    birthDate: birthDateSchema,
    phone: z
      .string()
      .min(1, { message: "رقم الموبيل مطلوب" })
      .regex(/^(010|011|012|015)\d{8}$/, {
        message:
          "رقم الموبيل يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقمًا",
      }),
    email: z
      .string()
      .min(1, { message: "الإيميل مطلوب" })
      .email({ message: "الإيميل غير صحيح" }),
    identityAttachment: identityFileSchema.optional(),
    documentImageUrl: z.string().optional(),
    oldPassword: z.string().optional(),
    newPassword: z
      .union([
        z.string().min(6, { message: "كلمة المرور يجب ألا تقل عن 6 أحرف" }),
        z.literal(""),
      ])
      .optional(),
    confirmPassword: z
      .union([
        z
          .string()
          .min(6, { message: "تأكيد كلمة المرور يجب ألا يقل عن 6 أحرف" }),
        z.literal(""),
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    const needsNationalId =
      data.documentType === "IDCard" ||
      data.documentType === "ResidencePermit";
    if (needsNationalId && !/^\d{14}$/.test(data.documentNumber.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentNumber"],
        message: "رقم المستند يجب أن يكون 14 رقمًا",
      });
    }

    const hasDocImage =
      Boolean(data.identityAttachment) ||
      Boolean(data.documentImageUrl?.trim());
    const isChangingPassword = Boolean(data.oldPassword?.trim());
    if (!hasDocImage && !isChangingPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identityAttachment"],
        message: "يرجى رفع صورة البطاقة/شهادة الميلاد",
      });
    }

    // If oldPassword has a value, then newPassword and confirmPassword are required
    if (data.oldPassword && data.oldPassword.trim() !== "") {
      if (!data.newPassword || data.newPassword.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newPassword"],
          message: "كلمة المرور الجديدة مطلوبة",
        });
      }

      if (!data.confirmPassword || data.confirmPassword.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "تأكيد كلمة المرور مطلوب",
        });
      }
    }

    // Validate that old password and new password are different
    if (
      data.oldPassword &&
      data.newPassword &&
      data.oldPassword === data.newPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
      });
    }

    // Validate match only when both fields have input (avoid stale mismatch while typing)
    if (
      data.newPassword?.trim() &&
      data.confirmPassword?.trim() &&
      data.newPassword !== data.confirmPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "كلمتا المرور غير متطابقتين",
      });
    }
  });

/** Staff/admin account page: password change only (no profile / identity validation). */
export const accountPasswordChangeSchema = z
  .object({
    id: z.string().optional(),
    oldPassword: z
      .string()
      .min(1, { message: "كلمة المرور الحالية مطلوبة" }),
    newPassword: z
      .string()
      .min(6, { message: "كلمة المرور يجب ألا تقل عن 6 أحرف" }),
    confirmPassword: z
      .string()
      .min(6, { message: "تأكيد كلمة المرور يجب ألا يقل عن 6 أحرف" }),
  })
  .superRefine((data, ctx) => {
    if (
      data.oldPassword.trim() &&
      data.newPassword.trim() &&
      data.oldPassword === data.newPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
      });
    }
    if (
      data.confirmPassword.trim() &&
      data.newPassword !== data.confirmPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "كلمتا المرور غير متطابقتين",
      });
    }
  });

export const reportSchema = z.object({
  startDate: z.date({
    required_error: "يجب اختيار تاريخ البداية",
    invalid_type_error: "تاريخ غير صالح",
  }),
  endDate: z.date({
    required_error: "يجب اختيار تاريخ النهاية",
    invalid_type_error: "تاريخ غير صالح",
  }),
  reservationStatus: z.string().optional(),
  reportName: z.string().min(1, {
    message: "اسم التقرير مطلوب",
  }),
  reportType: z.string().min(1, {
    message: "نوع التقرير مطلوب",
  }),
});

export const technicalJobSchema = z.object({
  technicalJobTypeId: z.preprocess(
    (val) => {
      if (Array.isArray(val)) return String(val[0] || "");
      if (val === null || val === undefined) return "";
      return String(val);
    },
    z.string().min(1, { message: "نوع المهمة مطلوبة" }),
  ),
  organizationId: z.preprocess(
    (val) => {
      if (Array.isArray(val)) return String(val[0] || "");
      if (val === null || val === undefined) return "";
      return String(val);
    },
    z.string().min(1, { message: "الجهة مطلوبة" }),
  ),
  employeeName: z.string().min(1, { message: "اسم الموظف مطلوب" }),
  startDate: z.date({
    required_error: "يجب اختيار تاريخ بداية المهمة",
    invalid_type_error: "تاريخ غير صالح",
  }),
  startTime: z.string().min(1, { message: "وقت البداية مطلوب" }),
  endDate: z.date({ invalid_type_error: "يجب أختيار التاريخ" }).optional(),
  endTime: z.string().optional(),
  description: z.preprocess(
    (val) => {
      if (Array.isArray(val)) return val.join(" ");
      if (val === null || val === undefined) return "";
      return String(val);
    },
    z.string().min(1, {
      // message: "Description is required",
      message: "وصف العمل مطلوب",
    }),
  ),
  // Accept an array of File objects from the client uploader
  images: z.any().array().optional(),
});

const arabicRegex = /^[\u0600-\u06FF\s-]+$/;
const englishRegex = /^[A-Za-z\s-]+$/;
/** Name/Job on `AddFloatingUnitStaffDto`: Arabic/Latin letters and spaces only (no digits/special chars). */
const floatingUnitStaffNameJobRegex = /^[ \u0600-\u06FF\u0750-\u077Fa-zA-Z]+$/;

export const lookupSchema = z.object({
  nameAr: z
    .string()
    .min(1, {
      message: "هذا البيان مطلوب",
    })
    .regex(arabicRegex, {
      message: "يجب أن يكون الاسم بالعربية فقط",
    }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  // value: z.string().min(1, {
  //   message: "Size Value Id is required",
  // }),
});

export const allowedDayBeforeReservationSchema = lookupSchema.extend({
  numofDays: z.coerce
    .number({
      invalid_type_error: "يجب إدخال عدد صحيح",
    })
    .int({ message: "يجب أن يكون عدد الأيام رقماً صحيحاً" })
    .min(0, { message: "يجب أن يكون عدد الأيام صفراً أو أكثر" }),
});

export const floatingUnitTypeSchema = z.object({
  nameAr: z
    .string()
    .min(1, {
      message: "الاسم بالعربية مطلوب",
    })
    .regex(arabicRegex, {
      message: "يجب أن يكون الاسم بالعربية فقط",
    }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  unitCategory: z.string().min(1, {
    message: "فئة الوحدة مطلوبة",
  }),
});

/** Matches `AddFloatingUnitDto` + `LookupDto<string>` (SonoTracker.Common.DTO.Tracker.FloatingUnit). */
export const floatingUnitSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1, { message: "الكود مطلوب" }),
  nameAr: z
    .string()
    .min(1, { message: "الاسم بالعربية مطلوب" })
    .regex(arabicRegex, { message: "يجب أن يكون الاسم بالعربية فقط" }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  licenseNumber: z.string().min(1, { message: "رقم الترخيص مطلوب" }),
  length: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "الطول مطلوب",
        invalid_type_error: "الطول غير صالح",
      })
      .gt(0, { message: "يجب إدخال طول أكبر من صفر" }),
  ),
  width: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "العرض مطلوب",
        invalid_type_error: "العرض غير صالح",
      })
      .gt(0, { message: "يجب إدخال عرض أكبر من صفر" }),
  ),
  passengerNumber: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "عدد الركاب مطلوب",
        invalid_type_error: "عدد الركاب غير صالح",
      })
      .int({ message: "عدد الركاب يجب أن يكون عدداً صحيحاً" })
      .min(0, { message: "عدد الركاب لا يمكن أن يكون سالباً" }),
  ),
  roomNumber: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "عدد الغرف مطلوب",
        invalid_type_error: "عدد الغرف غير صالح",
      })
      .int({ message: "عدد الغرف يجب أن يكون عدداً صحيحاً" })
      .min(0, { message: "عدد الغرف لا يمكن أن يكون سالباً" }),
  ),
  manufactureYear: z.string().min(1, { message: "سنة الصنع مطلوبة" }),
  lastMaintenanceDate: z.date().optional().nullable(),
  nextMaintenanceDate: z.date().optional().nullable(),
  unitTypeId: z.string().min(1, { message: "نوع الوحدة مطلوب" }),
  imageUrl: z
    .any()
    .refine(
      (val) =>
        val === undefined || val === null || val === "" || val instanceof File,
      { message: "ملف الصورة غير صالح" },
    )
    .optional(),
  isAccepted: z.boolean().refine((val) => val === true, {
    message: "يجب الموافقة على الاشتراطات",
  }),
});

/** Base shape; use `floatingUnitStaffSchema` for delegate file rule. Matches `AddFloatingUnitStaffDto`. */
export const floatingUnitStaffBaseSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, { message: "الاسم مطلوب" })
    .regex(floatingUnitStaffNameJobRegex, {
      message: "الاسم لا يقبل أرقاماً أو رموزاً خاصة",
    }),
  job: z
    .string()
    .min(1, { message: "الوظيفة مطلوبة" })
    .regex(floatingUnitStaffNameJobRegex, {
      message: "الوظيفة لا تقبل أرقاماً أو رموزاً خاصة",
    }),
  mobile: z
    .string()
    .min(1, { message: "رقم المحمول مطلوب" })
    .regex(/^[0-9]{11}$/, {
      message: "المحمول يجب أن يكون 11 رقماً",
    }),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
  /** From settings `genders/getall` (numeric id). */
  gender: z.coerce
    .number({
      invalid_type_error: "النوع مطلوب",
    })
    .int({ message: "قيمة النوع غير صالحة" }),
  /** From settings `idtypes/getall` (numeric id). */
  idType: z.coerce
    .number({
      invalid_type_error: "نوع الهوية مطلوب",
    })
    .int({ message: "نوع الهوية غير صالح" }),
  identity: z
    .string()
    .min(1, { message: "رقم الهوية مطلوب" })
    .regex(/^[0-9A-Za-z]{15}$/, {
      message: "رقم الهوية يجب أن يكون 15 حرفاً (أرقام وحروف إنجليزية)",
    }),
  nationalityId: z
    .string()
    .min(1, { message: "الجنسية مطلوبة" })
    .max(50, { message: "معرّف الجنسية يجب ألا يزيد عن 50 حرفاً" }),
  floatingUnitId: z
    .string()
    .min(1, { message: "الوحدة العائمة مطلوبة" })
    .max(50, { message: "معرّف الوحدة يجب ألا يزيد عن 50 حرفاً" }),
  isDelegate: z.boolean().optional(),
  delegateAttachment: z
    .any()
    .refine(
      (val) =>
        val === undefined || val === null || val === "" || val instanceof File,
      { message: "ملف التفويض غير صالح" },
    )
    .optional(),
});

export const floatingUnitStaffSchema = floatingUnitStaffBaseSchema.superRefine(
  (data, ctx) => {
    if (data.isDelegate && !data.delegateAttachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delegateAttachment"],
        message: "ملف التفويض مطلوب عند التفويض",
      });
    }
  },
);

export const organizationSchema = z.object({
  nameAr: z.string().min(1, {
    // message: "Name is required",
    message: "أسم الجهة مطلوب",
  }),
  organizationTypeId: z.string().min(1, {
    // message: "Or Type is required",
    message: "نوع الجهة مطلوب",
  }),
});

const sonoBookingStaffEmailRefine = (
  data: { email?: string },
  ctx: z.RefinementCtx,
) => {
  const normalized = String(data.email ?? "").trim().toLowerCase();
  if (!normalized.endsWith("@sonobooking.com")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "يجب أن ينتهي البريد الإلكتروني بـ @sonobooking.com",
      path: ["email"],
    });
  }
};

export const userSchema = z
  .object({
    name: z.string().min(1, {
      message: "الاسم مطلوب",
    }),
    email: z
      .string()
      .min(1, {
        message: "الإيميل مطلوب",
      })
      .email({
        message: "الإيميل غير صحيح",
      }),
    password: z
      .union([
        z.string().min(6, {
          message: "كلمة المرور يجب أن تكون على الأقل 6 أحرف",
        }),
        z.literal(""),
      ])
      .optional(),
    roleId: z.string().min(1, {
      message: "الدور مطلوب",
    }),
    organizationId: z.string().optional().or(z.literal("")),
    technicalJobCategory: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // This validation will be handled in the form component
    // The schema allows these fields to be optional/empty
  });

/** Super-admin staff user management: email must be @sonobooking.com */
export const sonoBookingStaffUserSchema = userSchema.superRefine(
  sonoBookingStaffEmailRefine,
);

export const roleSchema = z.object({
  nameAr: z
    .string()
    .min(1, {
      message: "اسم الدور مطلوب",
    })
    .regex(arabicRegex, {
      message: "يجب أن يكون الاسم بالعربية فقط",
    }),
  nameEn: z
    .string()
    .min(1, {
      message: "اسم الدور بالإنجليزية مطلوب",
    })
    .regex(englishRegex, {
      message: "يجب أن يكون الاسم بالإنجليزية فقط",
    }),
});

export const employeeSchema = z.object({
  nameAr: z.string().min(1, {
    message: "اسم الموظف مطلوب",
  }),
  nameEn: z.string().optional(),
  organizationTypeId: z.string().min(1, {
    message: "نوع الجهة مطلوب",
  }),
});

export const governateSchema = z.object({
  id: z.string().optional(),
  nameAr: z
    .string()
    .min(1, { message: "الاسم بالعربية مطلوب" })
    .max(100, { message: "الحد الأقصى 100 حرف" })
    .regex(arabicRegex, { message: "يجب أن يكون الاسم بالعربية فقط" }),
  nameEn: z
    .string()
    .min(1, { message: "الاسم بالإنجليزية مطلوب" })
    .max(100, { message: "الحد الأقصى 100 حرف" })
    .regex(englishRegex, { message: "يجب أن يكون الاسم بالإنجليزية فقط" }),
  code: z
    .string()
    .min(1, { message: "الكود مطلوب" })
    .max(2, { message: "الكود يجب أن يكون رقمين كحد أقصى" })
    .regex(/^\d+$/, { message: "Must be Number" }),
  address: z.string().max(250, { message: "الحد الأقصى 250 حرف" }).optional(),
  websiteUrl: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/?([^\s]*)$/.test(
          val,
        ),
      { message: "Unvalid Web Site Address" },
    ),
  imageUrl: z
    .any()
    .refine((val) => val === undefined || val === null || val instanceof File, {
      message: "ملف الصورة غير صالح",
    })
    .optional(),
});

export const cityFormSchema = z.object({
  code: z.string().max(20, { message: "الحد الأقصى 20 حرف" }),
  nameAr: z.string().min(1, { message: "الاسم العربي مطلوب" }),
  nameEn: z.string().optional(),
});

export type CityFormValues = z.infer<typeof cityFormSchema>;

export const partiesOfficialsSchema = z.object({
  code: z.string().optional(),
  nameAr: z.string().min(1, { message: "الاسم مطلوب" }),
  isReport: z.boolean().optional(),
  address: z.string().min(1, { message: "العنوان مطلوب" }),
  phone: z.string().min(1, { message: "رقم الهاتف مطلوب" }),
  fax: z.string().min(1, { message: "رقم الفاكس مطلوب" }),
  mobile: z
    .string()
    .min(1, { message: "رقم المحمول مطلوب" })
    .regex(/^(010|011|012|015)\d{8}$/, {
      message:
        "رقم المحمول يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقمًا",
    }),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
});

export const operatingCompaniesSchema = z.object({
  code: z.string().optional(),
  nameAr: z
    .string()
    .min(1, { message: "الاسم مطلوب" })
    .refine((val) => !val || arabicRegex.test(val), {
      message: "يجب أن يكون الاسم بالعربية فقط",
    }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  address: z.string().min(1, { message: "العنوان مطلوب" }),
  nationalityId: z.string().min(1, { message: "الجنسية مطلوبة" }),
  phone: z.string().min(1, { message: "رقم الهاتف مطلوب" }),
  fax: z.string().min(1, { message: "رقم الفاكس مطلوب" }),
  mobile: z.string().min(1, { message: "رقم المحمول مطلوب" }),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
  website: z.string().url({ message: "الموقع الإلكتروني غير صحيح" }).optional(),
  commercialRegistrationNumber: z
    .string()
    .min(1, { message: "رقم السجل التجاري مطلوب" })
    .regex(/^\d+$/, {
      message: "رقم السجل التجاري يجب أن يكون أرقاماً فقط",
    })
    .refine((val) => val.length < 16, {
      message: "رقم السجل التجاري يجب أن يكون أقل من 16 رقماً",
    }),
  commercialRegistrationAttachment: z
    .any()
    .refine((val) => val instanceof File, {
      message: "ملف السجل التجاري مطلوب",
    }),
  // isAccepted: z.boolean().refine((val) => val === true, {
  //   message: "يجب الموافقة على الاشتراطات",
  // }),
});

export const owningCompaniesSchema = z.object({
  code: z.string().optional(),
  nameAr: z
    .string()
    .min(1, { message: "الاسم مطلوب" })
    .refine((val) => !val || arabicRegex.test(val), {
      message: "يجب أن يكون الاسم بالعربية فقط",
    }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  address: z.string().min(1, { message: "العنوان مطلوب" }),
  nationalityId: z.string().min(1, { message: "الجنسية مطلوبة" }),
  phone: z.string().min(1, { message: "رقم الهاتف مطلوب" }),
  fax: z.string().min(1, { message: "رقم الفاكس مطلوب" }),
  mobile: z.string().min(1, { message: "رقم المحمول مطلوب" }),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
  website: z.string().url({ message: "الموقع الإلكتروني غير صحيح" }).optional(),
  commercialRegistrationNumber: z
    .string()
    .min(1, { message: "رقم السجل التجاري مطلوب" })
    .regex(/^\d+$/, {
      message: "رقم السجل التجاري يجب أن يكون أرقاماً فقط",
    })
    .refine((val) => val.length < 16, {
      message: "رقم السجل التجاري يجب أن يكون أقل من 16 رقماً",
    }),
  commercialRegistrationAttachment: z
    .any()
    .refine((val) => val === undefined || val === null || val instanceof File, {
      message: "ملف السجل التجاري مطلوب",
    }),
  touristMarinaNumber: z
    .string()
    .min(1, { message: "عدد المراسي السياحي مطلوب" })
    .regex(/^\d+$/, {
      message: "عدد المراسي السياحي يجب أن يكون أرقاماً فقط",
    })
    .refine((val) => val.length < 3, {
      message: "عدد المراسي السياحي يجب أن يكون أقل من 3 رقماً",
    }),
  isAccepted: z.boolean().refine((val) => val !== undefined && val !== null, {
    message: "الحالة مطلوبة",
  }),
});

export const touristMarinaSchema = z.object({
  code: z.string().optional(),
  nameAr: z
    .string()
    .min(1, { message: "الاسم بالعربية مطلوب" })
    .regex(arabicRegex, { message: "يجب أن يكون الاسم بالعربية فقط" }),
  nameEn: z
    .string()
    .optional()
    .refine(
      (val) => !val || englishRegex.test(val),
      "يجب أن يكون الاسم بالإنجليزية فقط",
    ),
  cityId: z.string().min(1, { message: "المدينة مطلوبة" }),
  marinaAddress: z.string().optional(),
  length: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "الطول مطلوب",
        invalid_type_error: "الطول غير صالح",
      })
      .refine((val) => Number.isFinite(val), { message: "الطول غير صالح" }),
  ),
  northSide: z.string().min(1, { message: "الشمالى الحد مطلوب" }),
  southSide: z.string().min(1, { message: "الجنوبى الحد مطلوب" }),
  northGeo: z.string().optional(),
  eastGeo: z.string().optional(),
  geoPointId: z.string().optional(),
  note: z.string().optional(),
  imageUrl: z
    .any()
    .refine(
      (val) =>
        val === undefined || val === null || val === "" || val instanceof File,
      { message: "ملف الصورة غير صالح" },
    )
    .optional(),
});

export const touristMarinaOrganizations = z.object({
  id: z.string().optional(),
  licenseNumber: z
    .string()
    .min(1, { message: "رقم الترخيص مطلوب" })
    .max(50, { message: "رقم الترخيص يجب ألا يزيد عن 50 حرفًا" }),
  touristMarinaId: z.string().min(1, { message: "المرسى السياحي مطلوب" }),
  organizationId: z.string().min(1, { message: "الجهة مطلوبة" }),
  fromDate: z.date({ invalid_type_error: "تاريخ البداية غير صالح" }),
  toDate: z.date({ invalid_type_error: "تاريخ النهاية غير صالح" }),
  isActive: z.boolean().optional(),
});

/** Matches `AddFloatingUnitOrganizationDto`: OrganizationId & FloatingUnitId max length 50. */
export const floatingUnitOrganization = z.object({
  id: z.string().optional(),
  organizationId: z
    .string()
    .min(1, { message: "الجهة مطلوبة" })
    .max(50, { message: "معرّف الجهة يجب ألا يزيد عن 50 حرفًا" }),
  floatingUnitId: z
    .string()
    .min(1, { message: "الوحدة العائمة مطلوبة" })
    .max(50, { message: "معرّف الوحدة العائمة يجب ألا يزيد عن 50 حرفًا" }),
});

/** Base shape; use `organizationEmployeeSchema` or compose with custom superRefine in forms. */
export const organizationEmployeeBaseSchema = z.object({
  name: z.string().min(1, { message: "الاسم مطلوب" }).regex(arabicRegex, {
    message: "يجب أن يكون الاسم بالعربية فقط",
  }),
  job: z.string().min(1, { message: "الوظيفة مطلوبة" }).regex(arabicRegex, {
    message: "يجب أن يكون الاسم بالعربية فقط",
  }),
  nationalId: z
    .string()
    .min(1, { message: "الرقم القومي مطلوب" })
    .regex(/^[23]\d{2}(0[1-9]|1[0-2])[0-3]\d{8}$/, {
      message:
        "الرقم القومي يجب أن يبدأ بـ 2 أو 3، وأن يكون الشهر بين 01 و 12، وأن يكون الرقم السادس بين 0 و 2، ويتكون من 14 رقمًا",
    }),
  mobile: z
    .string()
    .min(1, { message: "رقم المحمول مطلوب" })
    .regex(/^(010|011|012|015)\d{8}$/, {
      message:
        "رقم المحمول يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقمًا",
    }),
  phone: z.string().optional(),
  phoneExtension: z.string().optional(),
  email: z
    .string()
    .min(1, { message: "الإيميل مطلوب" })
    .email({ message: "الإيميل غير صحيح" }),
  isDelegate: z.boolean().optional(),
  delegateAttachment: z
    .any()
    .refine((val) => val === undefined || val === null || val instanceof File, {
      message: "ملف التفويض غير صالح",
    })
    .optional(),
});

export const organizationEmployeeSchema =
  organizationEmployeeBaseSchema.superRefine((data, ctx) => {
    if (data.isDelegate && !data.delegateAttachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delegateAttachment"],
        message: "ملف التفويض مطلوب",
      });
    }
  });

/** Matches `AddLicenseApplicationDto`; required files accept `File` or an existing path `string` when editing. */
const licenseAttachmentRequired = (message: string) =>
  z
    .any()
    .refine(
      (val) =>
        val instanceof File ||
        (typeof val === "string" && val.trim().length > 0),
      { message },
    );

/** Matches `SonoTracker.Common.DTO.Tracker.LicenseApplication.AddLicenseApplicationDto`. */
export const licenseTouristMarinaSchema = z.object({
  id: z.string().optional(),
  licenseNumber: z
    .string()
    .min(1, { message: "رقم الترخيص مطلوب" })
    .max(50, { message: "رقم الترخيص يجب ألا يزيد عن 50 حرفًا" }),
  licenseDate: z
    .string()
    .min(1, { message: "تاريخ الترخيص مطلوب" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "تاريخ الترخيص يجب أن يكون بالصيغة سنة-شهر-يوم",
    }),
  licenseNote: z.string().optional(),
  insurance: licenseAttachmentRequired("ملف التأمين مطلوب"),
  commercialRegister: licenseAttachmentRequired("ملف السجل التجاري مطلوب"),
  taxes: licenseAttachmentRequired("ملف الضرائب مطلوب"),
  civilProtection: licenseAttachmentRequired("ملف الحماية المدنية مطلوب"),
  irrigation: licenseAttachmentRequired("ملف الري مطلوب"),
  stateProperty: licenseAttachmentRequired("ملف أملاك الدولة مطلوب"),
  other: z
    .any()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === null ||
        val === "" ||
        val instanceof File ||
        (typeof val === "string" && val.trim().length > 0),
      { message: "الملف الإضافي غير صالح" },
    ),
  fromOrganizationId: z
    .string()
    .min(1, { message: "الجهة المرسلة مطلوبة" })
    .max(50, { message: "معرّف الجهة يجب ألا يزيد عن 50 حرفًا" }),
  toOrganizationId: z
    .string()
    .min(1, { message: "الجهة المستلمة مطلوبة" })
    .max(50, { message: "معرّف الجهة يجب ألا يزيد عن 50 حرفًا" }),
  touristMarinaNumber: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "عدد المراسي السياحية مطلوب",
        invalid_type_error: "عدد المراسي السياحية غير صالح",
      })
      .int({ message: "عدد المراسي السياحية يجب أن يكون عددًا صحيحًا" })
      .min(0, { message: "عدد المراسي السياحية غير صالح" }),
  ),
  sendMail: z.boolean().optional().default(false),
  status: z.enum(["pending", "NeedCompelete", "Approved"]).optional(),
});

export type LicenseTouristMarinaFormValues = z.infer<
  typeof licenseTouristMarinaSchema
>;

/** Matches `SonoTracker.Common.DTO.Tracker.Maintenance.AddMaintenanceDto`. */
export const maintenanceSchema = z.object({
  id: z.string().optional(),
  number: z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: "رقم الصيانة مطلوب",
        invalid_type_error: "رقم الصيانة غير صالح",
      })
      .int({ message: "رقم الصيانة يجب أن يكون عددًا صحيحًا" })
      .min(1, { message: "رقم الصيانة يجب أن يكون أكبر من صفر" }),
  ),
  maintenanceDate: z.date({
    required_error: "تاريخ الصيانة مطلوب",
    invalid_type_error: "تاريخ الصيانة غير صالح",
  }),
  nextMaintenanceDate: z
    .date({
      invalid_type_error: "تاريخ الصيانة القادم غير صالح",
    })
    .optional()
    .nullable(),
  maintenanceTypeId: z
    .string()
    .min(1, { message: "نوع الصيانة مطلوب" })
    .max(50, { message: "معرّف نوع الصيانة يجب ألا يزيد عن 50 حرفًا" }),
  floatingUnitId: z
    .string()
    .min(1, { message: "الوحدة العائمة مطلوبة" })
    .max(50, { message: "معرّف الوحدة العائمة يجب ألا يزيد عن 50 حرفًا" }),
  maintenanceReport: z.any().refine((val) => val instanceof File, {
    message: "تقرير الصيانة مطلوب",
  }),
  other: z
    .any()
    .optional()
    .refine(
      (val) =>
        val === undefined || val === null || val === "" || val instanceof File,
      { message: "الملف الإضافي غير صالح" },
    ),
  notes: z.string().optional(),
});

/** Matches `AddInspectionClauseDto`. */
export const inspectionClauseSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, { message: "كود البند مطلوب" }),
  name: z.string().min(1, { message: "اسم البند مطلوب" }),
  parentId: z.string().optional(),
  inspectionTypeId: z.string().min(1, { message: "نوع التفتيش مطلوب" }),
});

export type InspectionClauseFormValues = z.infer<typeof inspectionClauseSchema>;

/** Matches `AddInspectionFloatingUnitClauseDto`. */
export const inspectionFloatingUnitClauseSchema = z.object({
  id: z.string().optional(),
  isInspected: z.boolean({ required_error: "حالة الفحص مطلوبة" }),
  number: z.string().optional(),
  note: z.string().optional(),
  inspectionId: z.string().min(1, { message: "التفتيش مطلوب" }),
  inspectionClauseId: z.string().min(1, { message: "بند التفتيش مطلوب" }),
});

export type InspectionFloatingUnitClauseFormValues = z.infer<
  typeof inspectionFloatingUnitClauseSchema
>;

/**
 * Used inside inspection form (add/edit): `inspectionId` may be absent on create
 * and is filled/managed by backend after inspection creation.
 */
const inspectionFloatingUnitClauseInInspectionSchema =
  inspectionFloatingUnitClauseSchema.extend({
    inspectionId: z.string().optional(),
  });

/** Matches `AddInspectionDto`. */
export const inspectionSchema = z.object({
  id: z.string().optional(),
  inspectionTypeId: z.string().optional(),
  inspectionDate: z.date({
    required_error: "تاريخ التفتيش مطلوب",
    invalid_type_error: "تاريخ التفتيش غير صالح",
  }),
  saftyPetroleumWaste: z.boolean().optional().default(false),
  rightWasteDisposal: z.boolean().optional().default(false),
  note: z.string().optional(),
  floatingUnitId: z.string().min(1, { message: "الوحدة العائمة مطلوبة" }),
  organizationId: z.string().min(1, { message: "الجهة مطلوبة" }),
  inspectionAttachment: z
    .any()
    .refine(
      (val) =>
        val === undefined || val === null || val === "" || val instanceof File,
      { message: "ملف التفتيش غير صالح" },
    )
    .optional(),
  inspectionFloatingUnitClauses: z
    .array(inspectionFloatingUnitClauseInInspectionSchema)
    .optional()
    .default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionSchema>;

const unitDataFileLikeSchema = z
  .any()
  .refine((value) => value instanceof File || typeof value === "string", {
    message: "ملف الصورة غير صالح",
  });

export const apartmentStatusEnum = z.enum(
  ["متاح", "محجوز", "مشغول", "متاحة", "محجوزة", "مشغولة"],
  {
    required_error: "حالة الشقة مطلوبة",
  },
);

export const apartmentAllocationEnum = z.enum(["رجال", "سيدات"], {
  required_error: "التخصيص مطلوب",
});

export const apartmentAllocationTypeEnum = z.enum(["ثابت", "مرن"], {
  required_error: "نوع التخصيص مطلوب",
});

export const apartmentSchema = z.object({
  apartmentNumber: z.coerce
    .number({
      required_error: "رقم الشقة مطلوب",
      invalid_type_error: "رقم الشقة غير صالح",
    })
    .positive({ message: "رقم الشقة يجب أن يكون أكبر من صفر" }),
  description: z
    .string()
    .min(1, { message: "وصف الشقة مطلوب" })
    .max(500, { message: "وصف الشقة يجب ألا يزيد عن 500 حرفًا" }),
  price: z.coerce
    .number({
      required_error: "السعر مطلوب",
      invalid_type_error: "السعر غير صالح",
    })
    .positive({ message: "السعر يجب أن يكون أكبر من صفر" }),
  status: z
    .string()
    .min(1, { message: "حالة الشقة مطلوبة" })
    .max(20, { message: "حالة الشقة يجب ألا تزيد عن 20 حرفًا" }),
  gender: z
    .string()
    .min(1, { message: "النوع مطلوب" })
    .max(10, { message: "النوع يجب ألا يزيد عن 10 أحرف" }),
  allocationType: z
    .string()
    .min(1, { message: "نوع التخصيص مطلوب" })
    .max(50, { message: "نوع التخصيص يجب ألا يزيد عن 50 حرفًا" }),
  street: z
    .string()
    .min(1, { message: "الشارع مطلوب" })
    .max(50, { message: "الشارع يجب ألا يزيد عن 50 حرفًا" }),
  buildingNumber: z
    .string()
    .min(1, { message: "رقم المبنى مطلوب" })
    .max(20, { message: "رقم المبنى يجب ألا يزيد عن 20 حرفًا" }),
  floor: z
    .string()
    .min(1, { message: "الدور مطلوب" })
    .max(10, { message: "الدور يجب ألا يزيد عن 10 أحرف" }),
  detailedAddress: z
    .string()
    .min(1, { message: "العنوان التفصيلي مطلوب" })
    .max(500, { message: "العنوان التفصيلي يجب ألا يزيد عن 500 حرفًا" }),
  apartmentTypeId: z
    .string()
    .min(1, { message: "نوع الشقة مطلوب" })
    .max(50, { message: "نوع الشقة يجب ألا يزيد عن 50 حرفًا" }),
  governorateId: z
    .string()
    .min(1, { message: "المحافظة مطلوبة" })
    .max(50, { message: "المحافظة يجب ألا تزيد عن 50 حرفًا" }),
  cityId: z
    .string()
    .min(1, { message: "المدينة مطلوبة" })
    .max(50, { message: "المدينة يجب ألا تزيد عن 50 حرفًا" }),
  images: z
    .array(unitDataFileLikeSchema)
    .min(1, { message: "يجب رفع صورة واحدة على الأقل للشقة" }),
});

export type ApartmentFormValues = z.infer<typeof apartmentSchema>;

export const roomStatusEnum = z.enum(
  ["متاح", "محجوز", "مشغول", "متاحة", "محجوزة", "مشغولة"],
  {
    required_error: "حالة الغرفة مطلوبة",
  },
);

export const roomSchema = z.object({
  roomNumber: z.coerce
    .number({
      required_error: "رقم الغرفة مطلوب",
      invalid_type_error: "رقم الغرفة غير صالح",
    })
    .positive({ message: "رقم الغرفة يجب أن يكون أكبر من صفر" }),
  description: z
    .string()
    .min(1, { message: "وصف الغرفة مطلوب" })
    .max(500, { message: "وصف الغرفة يجب ألا يزيد عن 500 حرف" }),
  price: z.coerce
    .number({
      required_error: "السعر مطلوب",
      invalid_type_error: "السعر غير صالح",
    })
    .positive({ message: "السعر يجب أن يكون أكبر من صفر" }),
  status: z.string().min(1, { message: "حالة الغرفة مطلوبة" }),
  apartmentId: z
    .string()
    .min(1, { message: "الشقة مطلوبة" })
    .max(50, { message: "معرّف الشقة يجب ألا يزيد عن 50 حرفًا" }),
  roomTypeId: z
    .string()
    .min(1, { message: "نوع الغرفة مطلوب" })
    .max(50, { message: "معرّف نوع الغرفة يجب ألا يزيد عن 50 حرفًا" }),
  images: z
    .array(unitDataFileLikeSchema)
    .min(1, { message: "يجب رفع صورة واحدة على الأقل للغرفة" }),
});

export type RoomFormValues = z.infer<typeof roomSchema>;

export const bedStatusEnum = z.enum(
  ["متاح", "محجوز", "مشغول", "متاحة", "محجوزة", "مشغولة"],
  {
    required_error: "حالة السرير مطلوبة",
  },
);

export const bedSchema = z.object({
  bedNumber: z.coerce
    .number({
      required_error: "رقم السرير مطلوب",
      invalid_type_error: "رقم السرير غير صالح",
    })
    .positive({ message: "رقم السرير يجب أن يكون أكبر من صفر" }),
  description: z
    .string()
    .min(1, { message: "وصف السرير مطلوب" })
    .max(500, { message: "وصف السرير يجب ألا يزيد عن 500 حرف" }),
  dimensions: z
    .string()
    .min(1, { message: "الأبعاد مطلوبة" })
    .max(100, { message: "الأبعاد يجب ألا تزيد عن 100 حرف" }),
  price: z.coerce
    .number({
      required_error: "السعر مطلوب",
      invalid_type_error: "السعر غير صالح",
    })
    .positive({ message: "السعر يجب أن يكون أكبر من صفر" }),
  status: z.string().min(1, { message: "حالة السرير مطلوبة" }),
  roomId: z
    .string()
    .min(1, { message: "الغرفة مطلوبة" })
    .max(50, { message: "معرّف الغرفة يجب ألا يزيد عن 50 حرفًا" }),
  images: z
    .array(unitDataFileLikeSchema)
    .min(1, { message: "يجب رفع صورة واحدة على الأقل للسرير" }),
});

export type BedFormValues = z.infer<typeof bedSchema>;

export * from "./chat";
