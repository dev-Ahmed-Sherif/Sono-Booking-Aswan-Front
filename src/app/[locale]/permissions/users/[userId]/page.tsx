import { getUserById } from "@/actions/permissions/userService";
import UserForm from "@/components/permissions/user/user-form";

type UserProps = {
  params: {
    userId: string;
  };
};

const UserPage = async ({ params }: UserProps) => {
  const user = await getUserById(params.userId);
  console.log("user:", user);
  // console.log("organization:", organization);

  // Check if there's an error in the response
  if (user && "error" in user) {
    // If it's a 404, treat it as new organization
    if (user.error === "Not Found") {
      return (
        <main className="flex min-h-screen w-full flex-col">
          <div className="flex-1 space-y-4 p-8 pt-6">
            <UserForm initialData={null} name="المستخدم" />
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
              {user.message || "حدث خطأ أثناء تحميل بيانات الجهة"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <UserForm initialData={user || null} name="المستخدم" />
      </div>
    </main>
  );
};

export default UserPage;
