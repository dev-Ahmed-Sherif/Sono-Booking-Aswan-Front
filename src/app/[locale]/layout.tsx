import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

import "@/styles/globals.css";

import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

import ThemeProvider from "@/providers/theme-provider";
import ToastProvider from "@/providers/toast-provider";
import StoreProvider from "@/providers/store-provider";
import { FullscreenProvider } from "@/components/layout/fullscreen-provider";

const inter = Cairo({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: process.env.TITLE,
  description: process.env.DESCRIPTION,
  icons: ["/favicon.ico"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: process.env.TITLE,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const backEndCookies = cookies();
  const messages = await getMessages();
  const locale = await getLocale();

  // Get the access token cookie - check if it exists (not just the name)
  const accessCookie = backEndCookies.get(`${process.env.ACCESS_TOKEN_COOKIE}`);
  const access = accessCookie ? accessCookie.value : null;

  return (
    <StoreProvider>
      <html
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
        suppressHydrationWarning
        className="h-full"
      >
        <body
          className={`${inter.className} overflow-x-hidden min-h-screen h-full flex flex-col`}
          suppressHydrationWarning
        >
          <ThemeProvider attribute="class" enableSystem>
            <NextIntlClientProvider messages={messages}>
              <FullscreenProvider>
                <Navbar cookie={access} locale={locale} />
                {children}
                <Footer />
                {/* <Emergency /> */}
              </FullscreenProvider>
            </NextIntlClientProvider>
            <ToastProvider />
          </ThemeProvider>
        </body>
      </html>
    </StoreProvider>
  );
}
