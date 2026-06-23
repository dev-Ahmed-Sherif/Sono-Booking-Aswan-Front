import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ChatMessageCircleBadgeProps = {
  className?: string;
  iconClassName?: string;
};

/** Shared circle + MessageCircle; matches app header background. */
export function ChatMessageCircleBadge({
  className,
  iconClassName,
}: ChatMessageCircleBadgeProps) {
  return (
    <div
      className={cn(
        "flex h-24 w-24 items-center justify-center rounded-full border border-border bg-background shadow-md ring-1 ring-border/60",
        className,
      )}
    >
      <MessageCircle
        className={cn(
          "h-11 w-11 text-primary dark:text-primary",
          iconClassName,
        )}
        aria-hidden
      />
    </div>
  );
}
