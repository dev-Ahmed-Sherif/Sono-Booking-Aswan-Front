"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Inbox, Send, Leaf, ShieldCheck, AlertTriangle, Wrench, MapPin, MapPinned, Landmark, Ship, Sailboat, Anchor, Database, Briefcase, Flag, Blocks, LayoutTemplate, Route, ClipboardCheck, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type NavigationItem = {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  hoverColor: string;
};

type NavigationCardsProps = {
  items: NavigationItem[];
  locale: string;
  columns?: 2 | 3;
};

const iconMap: Record<string, LucideIcon> = {
  Users,
  Building2,
  Inbox,
  Send,
  Leaf,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  MapPin,
  MapPinned,
  Landmark,
  Ship,
  Sailboat,
  Anchor,
  Database,
  Briefcase,
  Flag,
  Blocks,
  Pages: LayoutTemplate,
  Route,
  ClipboardCheck,
};

export function NavigationCards({ items, locale, columns = 2 }: NavigationCardsProps) {
  return (
    <div
      className={`pb-24 grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
    >
      {items.map((item, index) => {
        const Icon = iconMap[item.icon] || Users;
        return (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Link href={`/${locale}${item.href}`}>
              <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50 group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg bg-gradient-to-br ${item.color} ${item.hoverColor} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
                    >
                      <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg sm:text-xl md:text-2xl text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                        {item.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
