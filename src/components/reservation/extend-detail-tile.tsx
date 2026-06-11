"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ExtendDetailTileProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
};

export function ExtendDetailTile({
  label,
  value,
  icon: Icon,
  className,
}: ExtendDetailTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/80 p-3 text-start",
        className,
      )}
    >
      <p className="mb-1 flex items-center justify-start gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span>{label}</span>
      </p>
      <p className="text-sm font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}
