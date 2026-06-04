import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { accessTokenCookieName } from "@/lib/auth-cookies";

export default async function Home() {
  const backEndCookies = cookies();
  const access = backEndCookies.get(accessTokenCookieName());
  // if (access) {
  //   redirect("/ar/dashboard");
  // }

  return (
    <main className="mb-20 w-full flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-scroll">
      <LoginForm Cookie={access || null} />
    </main>
  );
}
