"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import {
  reservationRequestSchema,
  type ReservationRequestFormValues,
} from "@/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReservationCompanion = {
  id: string;
  name: string;
};

type ReservationRequestFormProps = {
  applicantName: string;
  companions?: ReservationCompanion[];
  initialStartDate?: string;
  initialNumberOfNights?: number;
  isSubmitting?: boolean;
  onSubmit?: (values: ReservationRequestFormValues) => Promise<void> | void;
};

const ReservationRequestForm = ({
  applicantName,
  companions = [],
  initialStartDate = "",
  initialNumberOfNights = 1,
  isSubmitting = false,
  onSubmit,
}: ReservationRequestFormProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const guests = useMemo(
    () => [
      { id: "applicant", name: applicantName, role: "applicant" as const },
      ...companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: "companion" as const,
      })),
    ],
    [applicantName, companions],
  );

  const form = useForm<ReservationRequestFormValues>({
    resolver: zodResolver(reservationRequestSchema),
    defaultValues: {
      startDate: initialStartDate,
      numberOfNights: initialNumberOfNights,
      guests,
      selectedGuestIds: guests.length ? [guests[0].id] : [],
    },
  });

  useEffect(() => {
    const validIds = new Set(guests.map((guest) => guest.id));
    const currentSelected = form
      .getValues("selectedGuestIds")
      .filter((id) => validIds.has(id));
    const selectedGuestIds = currentSelected.length
      ? currentSelected
      : guests.length
        ? [guests[0].id]
        : [];

    form.setValue("guests", guests, { shouldValidate: true });
    form.setValue("selectedGuestIds", selectedGuestIds, { shouldValidate: true });
  }, [form, guests]);

  const selectedGuestIds = form.watch("selectedGuestIds");

  const toggleGuestSelection = (guestId: string, checked: boolean) => {
    const currentSelected = form.getValues("selectedGuestIds");
    const nextSelected = checked
      ? Array.from(new Set([...currentSelected, guestId]))
      : currentSelected.filter((id) => id !== guestId);

    form.setValue("selectedGuestIds", nextSelected, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleSubmit = async (values: ReservationRequestFormValues) => {
    try {
      setIsSaving(true);
      if (onSubmit) {
        await onSubmit(values);
      } else {
        console.log("reservation-request-form-values", values);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const loading = isSubmitting || isSaving;

  return (
    <Card dir="rtl" className="w-full">
      <CardHeader>
        <CardTitle>طلب إقامة</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ البدء</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numberOfNights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>عدد الليالي</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        disabled={loading}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="selectedGuestIds"
              render={() => (
                <FormItem>
                  <FormLabel>أسماء طالب الإقامة والمرافقين</FormLabel>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">اختيار</TableHead>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-right">الصفة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guests.map((guest) => (
                          <TableRow key={guest.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedGuestIds.includes(guest.id)}
                                disabled={loading}
                                onChange={(event) =>
                                  toggleGuestSelection(
                                    guest.id,
                                    event.target.checked,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>{guest.name}</TableCell>
                            <TableCell>
                              {guest.role === "applicant"
                                ? "طالب الإقامة"
                                : "مرافق"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-center">
              <Button type="submit" disabled={loading} className="min-w-32">
                {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                تقديم الطلب
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ReservationRequestForm;
