import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";

export default async function Home() {
  const backEndCookies = cookies();
  const access = backEndCookies.get(`${process.env.ACCESS_TOKEN_COOKIE}`);
  // if (access) {
  //   redirect("/ar/dashboard");
  // }

  return (
    <main className="w-full flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-scroll">
      <LoginForm Cookie={access || null} />
    </main>
  );
}
