"use client";

import { motion } from "framer-motion";
import { Home } from "lucide-react";

export function AppHeader() {
  return (
    <motion.header
      className="flex w-full max-w-full min-w-0 shrink-0 items-center justify-center gap-3 border-b border-brand-border bg-brand px-6 py-5 text-brand-foreground shadow-sm"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-green-500 to-blue-600 p-2 shadow-lg">
          <Home className="h-6 w-6 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-wide md:text-3xl">
            نظام إدارة إسكان محافظة أسوان
          </h1>
        </div>
      </div>
    </motion.header>
  );
}
