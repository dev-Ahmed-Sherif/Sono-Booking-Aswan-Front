import { PermissionsSuperAdminGate } from "@/components/permissions/permissions-super-admin-gate";

const ModulesPermissionsPage = async () => {
  return (
    <PermissionsSuperAdminGate>
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <h1 className="text-2xl font-bold">الموديلات</h1>
          <p className="text-muted-foreground">محتوى صلاحيات الموديلات قريباً.</p>
        </div>
      </main>
    </PermissionsSuperAdminGate>
  );
};

export default ModulesPermissionsPage;
