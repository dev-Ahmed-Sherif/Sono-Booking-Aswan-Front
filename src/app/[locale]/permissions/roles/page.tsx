import dynamic from "next/dynamic";

import { getRoles } from "@/actions/permissions/roleService";
import { PermissionsSuperAdminGate } from "@/components/permissions/permissions-super-admin-gate";

const ClientRole = dynamic(() => import("@/components/permissions/role/client"), {
  loading: () => <div className="p-4">Loading...</div>,
});

async function PermissionsRolesPage() {
  let rolesData = null;
  try {
    rolesData = await getRoles();
  } catch (error) {
    console.log("Error fetching roles (possibly during logout):", error);
    rolesData = null;
  }

  return (
    <PermissionsSuperAdminGate>
      <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <ClientRole
            data={rolesData?.data || null}
            path="/permissions/roles/new"
            viewOnly
          />
        </div>
      </main>
    </PermissionsSuperAdminGate>
  );
}

export default PermissionsRolesPage;
