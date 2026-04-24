import RegisterForm from "@/components/register/register-form";

const RegisterPage = () => {
  return (
    <main className="w-full flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-scroll">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
        <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <RegisterForm />
        </div>
      </div>
      </div>
    </main>
  );
};

export default RegisterPage;
