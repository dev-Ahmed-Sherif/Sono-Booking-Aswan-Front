import { getUserById } from "@/actions/permissions/userService";
import { PermissionsUserDetailClient } from "@/components/permissions/permissions-user-detail-client";

type UserProps = {
  params: {
    userId: string;
  };
};

const UserPage = async ({ params }: UserProps) => {
  const isNewUser = params.userId === "new";
  const user = isNewUser ? null : await getUserById(params.userId);

  if (!isNewUser && user && "error" in user) {
    if (user.error === "Not Found") {
      return (
        <main className="flex min-h-screen w-full flex-col">
          <div className="flex-1 space-y-4 p-8 pt-6">
            <PermissionsUserDetailClient initialData={null} />
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive">
              خطأ في تحميل البيانات
            </h2>
            <p className="mt-2 text-muted-foreground">
              {user.message || "حدث خطأ أثناء تحميل بيانات المستخدم"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <PermissionsUserDetailClient initialData={user || null} />
      </div>
    </main>
  );
};

export default UserPage;
