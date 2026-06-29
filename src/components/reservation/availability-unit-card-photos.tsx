"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardPhotosProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardPhotos({
  card,
}: AvailabilityUnitCardPhotosProps) {
  const [open, setOpen] = useState(false);
  const urls = card.primaryPhotoUrls ?? [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-xl px-4 text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        المزيد
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-center">{card.title}</DialogTitle>
          </DialogHeader>
          {urls.length > 0 ? (
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
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              لا توجد صور لهذه الوحدة.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
