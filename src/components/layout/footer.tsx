"use client";

import { FC } from "react";

import { options } from "@/lib/date-timeOptions";

const { year, timeZone } = options;

const Footer: FC = () => {
  return (
    <footer id="footer" className="w-screen fixed bottom-0 z-[9998] pt-20">
      <p className="font-bold text-center lg:text-xl py-4 border-t border-brand-border bg-brand text-brand-foreground shadow-sm">
        جميع الحقوق محفوظة &copy;{" "}
        {new Date().toLocaleString("ar-EG", { year, timeZone })} لدى الأدارة
        العامة لنظم المعلومات والتحول الرقمى بمحافظة أسوان - ISDT
      </p>
    </footer>
  );
};

export default Footer;
