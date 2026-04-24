import { getRoleById } from "@/actions/permissions/roleService";
import RoleForm from "@/components/permissions/role/role-form";

type RoleProps = {
  params: {
    roleId: string;
  };
};

const RolePage = async ({ params }: RoleProps) => {
  const role = await getRoleById(params.roleId);
  console.log("role:", role);

  // Check if there's an error in the response
  if (role && "error" in role) {
    // If it's a 404, treat it as new role
    if (role.error === "Not Found") {
      return (
        <main className="flex min-h-screen w-full flex-col">
          <div className="flex-1 space-y-4 p-8 pt-6">
            <RoleForm initialData={role || null} name="الدور" />
          </div>
        </main>
      );
    }

    // For other errors, show error message or redirect
    return (
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive">
              خطأ في تحميل البيانات
            </h2>
            <p className="mt-2 text-muted-foreground">
              {role.message || "حدث خطأ أثناء تحميل بيانات الدور"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <RoleForm initialData={role || null} name="الدور" />
      </div>
    </main>
  );
};

export default RolePage;
