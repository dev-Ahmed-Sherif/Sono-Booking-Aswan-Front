"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import UserForm from "@/components/permissions/user/user-form";
import { PermissionsSuperAdminGate } from "@/components/permissions/permissions-super-admin-gate";
import { isSonoBookingStaffEmail } from "@/lib/sonobooking-staff";

type PermissionsUserDetailClientProps = {
  initialData: any | null;
};

export function PermissionsUserDetailClient({
  initialData,
}: PermissionsUserDetailClientProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";

  const existingEmail = initialData?.data?.email;
  const isNewUser = !initialData?.data?.id;
  const isBlockedUser =
    !isNewUser &&
    Boolean(existingEmail) &&
    !isSonoBookingStaffEmail(existingEmail);

  useEffect(() => {
    if (isBlockedUser) {
      router.replace(`/${locale}/permissions/users`);
    }
  }, [isBlockedUser, locale, router]);

  if (isBlockedUser) {
    return null;
  }

  return (
    <PermissionsSuperAdminGate>
      <UserForm initialData={initialData} name="المستخدم" />
    </PermissionsSuperAdminGate>
  );
}
