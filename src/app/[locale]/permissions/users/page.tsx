import dynamic from "next/dynamic";

import { getUsers } from "@/actions/permissions/userService";
import { PermissionsSuperAdminGate } from "@/components/permissions/permissions-super-admin-gate";
import type { UserColumn } from "@/components/permissions/user/columns";
import { filterSonoBookingStaffUsers } from "@/lib/sonobooking-staff";

const ClientUser = dynamic(() => import("@/components/permissions/user/client"), {
  loading: () => <div className="p-4">Loading...</div>,
});

async function PermissionsUsersPage() {
  let usersData = null;
  try {
    usersData = await getUsers();
  } catch (error) {
    console.log("Error fetching users (possibly during logout):", error);
    usersData = null;
  }

  const staffUsers = filterSonoBookingStaffUsers<UserColumn>(
    usersData?.data || null,
  );

  return (
    <PermissionsSuperAdminGate>
      <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <ClientUser
            data={staffUsers}
            path="/permissions/users/new"
          />
        </div>
      </main>
    </PermissionsSuperAdminGate>
  );
}

export default PermissionsUsersPage;
