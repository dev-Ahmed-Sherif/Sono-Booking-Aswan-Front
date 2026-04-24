import dynamic from "next/dynamic";
import { getUsers } from "@/actions/permissions/userService";

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

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <ClientUser
          data={usersData?.data || null}
          path="/permissions/users/new"
        />
      </div>
    </main>
  );
}

export default PermissionsUsersPage;
