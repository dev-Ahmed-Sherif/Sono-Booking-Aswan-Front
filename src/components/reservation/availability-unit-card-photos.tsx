import { Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardPhotosProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardPhotos({
  card,
}: AvailabilityUnitCardPhotosProps) {
  const urls = card.primaryPhotoUrls ?? [];
  if (urls.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs font-semibold"
        >
          <ImageIcon className="h-4 w-4" />
          عرض الصور
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-center">الصور الأساسية للوحدة</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-1 sm:grid-cols-2">
          {urls.map((url, idx) => (
            <div
              key={`${card.id}-photo-${idx}`}
              className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${card.title} - صورة ${idx + 1}`}
                className="h-56 w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
