"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import { registrationCompanionSchema } from "@/schemas";
import {
  addCompanion,
  deleteCompanionById,
  getCompanions,
  updateCompanionById,
} from "@/actions/companionService";
import { getRelationships } from "@/actions/settings/relationshipService";
import {
  FATHER_MOTHER_DUPLICATE_MESSAGE,
  filterRelationshipOptionsForEditCompanion,
  documentTypeToApiNumber,
  filterRelationshipOptionsForNewCompanion,
  genderToApiNumber,
  isFatherMotherRelationshipTaken,
  mapCompanionDtoToFormEntry,
} from "@/lib/companion-registration";
import {
  getLookupArray,
  mapGenericOptions,
  type GenericOption,
} from "@/lib/availability-inquiry";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CompanionFormFields, {
  type CompanionFormValues,
} from "@/components/register/companion-form-fields";

const emptyCompanionValues: CompanionFormValues = {
  relationshipId: "",
  fullName: "",
  documentType: undefined,
  nationalId: "",
  gender: undefined,
  birthDate: undefined as unknown as Date,
  identityAttachment: undefined,
  documentImageUrl: undefined,
};

type RegisterCompanionsTabProps = {
  locale: string;
  registeredUserId: string | null;
  isActive: boolean;
};

const toDateOnlyString = (input: Date | string): string => {
  if (typeof input === "string") {
    const match = input.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : input;
  }
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const RegisterCompanionsTab = ({
  locale,
  registeredUserId,
  isActive,
}: RegisterCompanionsTabProps) => {
  const { toast } = useToast();
  const dateFnsLocale = locale === "ar" || locale.startsWith("ar-") ? ar : enUS;

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [relationshipOptions, setRelationshipOptions] = useState<
    GenericOption[]
  >([]);
  const [savedCompanions, setSavedCompanions] = useState<CompanionFormValues[]>(
    [],
  );
  const [editModalOpen, setEditModalOpen] = useState(false);

  const newCompanionForm = useForm<CompanionFormValues>({
    resolver: zodResolver(registrationCompanionSchema),
    defaultValues: emptyCompanionValues,
  });

  const editCompanionForm = useForm<CompanionFormValues>({
    resolver: zodResolver(registrationCompanionSchema),
    defaultValues: emptyCompanionValues,
  });

  const relationshipLabel = (relationshipId: string) =>
    relationshipOptions.find((o) => o.value === relationshipId)?.label ?? "—";

  const validateFatherMotherRelationship = useCallback(
    (relationshipId: string, excludeCompanionId?: string) => {
      if (
        isFatherMotherRelationshipTaken(
          relationshipId,
          relationshipOptions,
          savedCompanions,
          excludeCompanionId,
        )
      ) {
        return FATHER_MOTHER_DUPLICATE_MESSAGE;
      }
      return undefined;
    },
    [relationshipOptions, savedCompanions],
  );

  const setFatherMotherDuplicateError = (
    form: UseFormReturn<CompanionFormValues>,
  ) => {
    form.setError("relationshipId", {
      type: "manual",
      message: FATHER_MOTHER_DUPLICATE_MESSAGE,
    });
    toast({
      variant: "destructive",
      title: FATHER_MOTHER_DUPLICATE_MESSAGE,
    });
  };

  const newCompanionRelationshipOptions = useMemo(
    () =>
      filterRelationshipOptionsForNewCompanion(
        relationshipOptions,
        savedCompanions,
      ),
    [relationshipOptions, savedCompanions],
  );

  const editingCompanionId = editCompanionForm.watch("id");

  const editCompanionRelationshipOptions = useMemo(
    () =>
      filterRelationshipOptionsForEditCompanion(
        relationshipOptions,
        savedCompanions,
        editingCompanionId,
      ),
    [relationshipOptions, savedCompanions, editingCompanionId],
  );

  const loadData = useCallback(async () => {
    if (!registeredUserId) return;

    setIsLoading(true);
    try {
      const [relationshipsRes, companionsRes] = await Promise.all([
        getRelationships(),
        getCompanions(registeredUserId),
      ]);

      if (!(relationshipsRes as { error?: string })?.error) {
        const mapped = mapGenericOptions(relationshipsRes);
        if (mapped.length > 0) setRelationshipOptions(mapped);
      }

      if ((companionsRes as { error?: string })?.error) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل المرافقين",
          description:
            (companionsRes as { message?: string }).message ||
            "حدث خطأ أثناء جلب بيانات المرافقين",
        });
        return;
      }

      const list = getLookupArray(companionsRes)
        .map((item) =>
          mapCompanionDtoToFormEntry(item as Record<string, unknown>),
        )
        .filter((c) => c.id && c.fullName);

      setSavedCompanions(list);
    } finally {
      setIsLoading(false);
    }
  }, [registeredUserId, toast]);

  useEffect(() => {
    if (isActive && registeredUserId) {
      void loadData();
    }
  }, [isActive, registeredUserId, loadData]);

  useEffect(() => {
    if (newCompanionRelationshipOptions.length === 0) return;

    const current = newCompanionForm.getValues("relationshipId");
    const stillAvailable = newCompanionRelationshipOptions.some(
      (o) => o.value === current,
    );

    if (!current || !stillAvailable) {
      newCompanionForm.setValue(
        "relationshipId",
        newCompanionRelationshipOptions[0].value,
      );
    }
  }, [newCompanionRelationshipOptions, newCompanionForm]);

  const persistCompanion = async (
    companion: CompanionFormValues,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const isNew = !companion.id;

    if (isNew && !(companion.identityAttachment instanceof File)) {
      return {
        ok: false,
        message: "يرجى رفع صورة البطاقة/شهادة الميلاد",
      };
    }

    const fd = new FormData();
    if (companion.id) {
      fd.append("Id", companion.id);
    }
    fd.append("FullName", companion.fullName);
    fd.append("DocumentNumber", companion.nationalId);
    fd.append("BirthDate", toDateOnlyString(companion.birthDate));
    fd.append("Gender", String(genderToApiNumber(companion.gender!)));
    fd.append(
      "DocumentType",
      String(documentTypeToApiNumber(companion.documentType)),
    );
    fd.append("RelationshipId", companion.relationshipId);

    if (companion.identityAttachment instanceof File) {
      fd.append("DocumentImage", companion.identityAttachment);
    }

    const apiRes = companion.id
      ? await updateCompanionById(fd, userId)
      : await addCompanion(fd, userId);

    if ((apiRes as { error?: string })?.error) {
      return {
        ok: false,
        message:
          (apiRes as { message?: string }).message ||
          (companion.id ? "تعذر تحديث المرافق" : "تعذر إضافة المرافق"),
      };
    }

    return { ok: true };
  };

  const handleSaveNewCompanion = async () => {
    if (!registeredUserId) return;

    const values = newCompanionForm.getValues();
    if (!(values.identityAttachment instanceof File)) {
      toast({
        variant: "destructive",
        title: "مستند المرافق مطلوب",
        description: "يرجى رفع صورة البطاقة/شهادة الميلاد",
      });
      return;
    }

    const valid = await newCompanionForm.trigger();
    if (!valid) return;

    if (validateFatherMotherRelationship(values.relationshipId)) {
      setFatherMotherDuplicateError(newCompanionForm);
      return;
    }

    setIsSaving(true);
    try {
      const result = await persistCompanion(values, registeredUserId);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "تعذر إضافة المرافق",
          description: result.message,
        });
        return;
      }

      toast({
        title: "تم حفظ المرافق",
        description: "تمت إضافة المرافق إلى القائمة.",
      });

      await loadData();
      newCompanionForm.reset({ ...emptyCompanionValues });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (companion: CompanionFormValues) => {
    editCompanionForm.reset({
      ...companion,
      identityAttachment: undefined,
    });
    setEditModalOpen(true);
  };

  const handleUpdateCompanion = async () => {
    if (!registeredUserId) return;

    const valid = await editCompanionForm.trigger();
    if (!valid) return;

    const values = editCompanionForm.getValues();

    if (validateFatherMotherRelationship(values.relationshipId, values.id)) {
      setFatherMotherDuplicateError(editCompanionForm);
      return;
    }

    if (
      !values.documentImageUrl &&
      !(values.identityAttachment instanceof File)
    ) {
      toast({
        variant: "destructive",
        title: "مستند المرافق مطلوب",
        description: "يرجى رفع صورة جديدة أو الإبقاء على المستند المحفوظ",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await persistCompanion(values, registeredUserId);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "تعذر تحديث المرافق",
          description: result.message,
        });
        return;
      }

      toast({ title: "تم تحديث المرافق" });
      setEditModalOpen(false);
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (companionId: string) => {
    if (!registeredUserId) return;

    const res = await deleteCompanionById(companionId, registeredUserId);
    if ((res as { error?: string })?.error) {
      toast({
        variant: "destructive",
        title: "تعذر حذف المرافق",
        description:
          (res as { message?: string }).message ||
          "حدث خطأ أثناء حذف المرافق",
      });
      return;
    }

    toast({ title: "تم حذف المرافق" });
    await loadData();
  };

  const formDisabled = !registeredUserId || isSaving || isLoading;

  return (
    <>
      <div className="space-y-6">
        {!registeredUserId ? (
          <motion.div
            className="rounded-md border-[2.5px] border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            أكمل تسجيل البيانات الأساسية أولاً، ثم يمكنك إضافة المرافقين
            وحفظهم.
          </motion.div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري تحميل المرافقين...
          </div>
        ) : null}

        <Card className="border-[2.5px] border-slate-300 dark:border-slate-600 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">إضافة مرافق جديد</CardTitle>
            <CardDescription>
              أدخل بيانات المرافق ثم اضغط حفظ لإضافته إلى القائمة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {newCompanionRelationshipOptions.length === 0 &&
            relationshipOptions.length > 0 ? (
              <motion.div
                className="rounded-md border-[2.5px] border-slate-300 dark:border-slate-600 p-4 text-sm text-muted-foreground"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                تمت إضافة مرافق بصلة أب أو أم أو زوج. يمكنك إضافة مرافقين
                بصلات قرابة أخرى بعد حذف أحدهما، أو تعديل البيانات من الجدول
                أدناه.
              </motion.div>
            ) : (
            <Form {...newCompanionForm}>
              <motion.div className="space-y-4">
                <CompanionFormFields
                  form={newCompanionForm}
                  relationshipOptions={newCompanionRelationshipOptions}
                  locale={locale}
                  disabled={formDisabled}
                  identityRequired
                  validateRelationshipId={(id) =>
                    validateFatherMotherRelationship(id)
                  }
                />
                <motion.div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    className="bg-[#00005c] hover:bg-[#00004a] text-white"
                    disabled={
                      formDisabled ||
                      newCompanionRelationshipOptions.length === 0
                    }
                    onClick={() => void handleSaveNewCompanion()}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      "حفظ المرافق"
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </Form>
            )}
          </CardContent>
        </Card>

        <Card className="border-[2.5px] border-slate-300 dark:border-slate-600 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">المرافقون المحفوظون</CardTitle>
            <CardDescription>
              قائمة المرافقين المسجلين على حسابك.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {savedCompanions.length === 0 ? (
              <motion.div className="rounded-md border-[2.5px] border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-muted-foreground">
                لا يوجد مرافقون محفوظون بعد.
              </motion.div>
            ) : (
              <div className="rounded-md border-[2.5px] border-slate-200 dark:border-slate-700 overflow-hidden">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right font-bold">الاسم</TableHead>
                      <TableHead className="text-right font-bold">
                        صلة القرابة
                      </TableHead>
                      <TableHead className="text-right font-bold">
                        الرقم القومي
                      </TableHead>
                      <TableHead className="text-right font-bold">
                        تاريخ الميلاد
                      </TableHead>
                      <TableHead className="text-right font-bold w-[120px]">
                        إجراءات
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedCompanions.map((companion) => (
                      <TableRow key={companion.id}>
                        <TableCell className="font-medium">
                          {companion.fullName}
                        </TableCell>
                        <TableCell>
                          {relationshipLabel(companion.relationshipId)}
                        </TableCell>
                        <TableCell>{companion.nationalId}</TableCell>
                        <TableCell>
                          {companion.birthDate instanceof Date &&
                          !Number.isNaN(companion.birthDate.getTime())
                            ? format(companion.birthDate, "PPP", {
                                locale: dateFnsLocale,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={formDisabled}
                              onClick={() => handleOpenEdit(companion)}
                              aria-label="تعديل المرافق"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={formDisabled}
                              onClick={() =>
                                companion.id && void handleDelete(companion.id)
                              }
                              aria-label="حذف المرافق"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent dir="rtl" className="max-w-2xl text-right max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-center text-xl">
              تعديل بيانات المرافق
            </DialogTitle>
          </DialogHeader>
          <Form {...editCompanionForm}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleUpdateCompanion();
              }}
            >
              <CompanionFormFields
                form={editCompanionForm}
                relationshipOptions={editCompanionRelationshipOptions}
                locale={locale}
                disabled={isSaving}
                identityRequired={false}
                validateRelationshipId={(id) =>
                  validateFatherMotherRelationship(
                    id,
                    editCompanionForm.getValues("id"),
                  )
                }
              />
              <DialogFooter className="flex flex-row-reverse justify-start gap-2 sm:justify-start pt-2">
                <Button
                  type="submit"
                  className="bg-[#00005c] hover:bg-[#00004a] text-white"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    "حفظ التعديلات"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setEditModalOpen(false)}
                >
                  إلغاء
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegisterCompanionsTab;
