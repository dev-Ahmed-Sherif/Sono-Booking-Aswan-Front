"use client";

import { Loader2 } from "lucide-react";

import { ExtendStayReservationCard } from "@/components/reservation/extend-stay-reservation-card";
import { ExtendSubmittedRequestPanel } from "@/components/reservation/extend-submitted-request-panel";
import { canSubmitNewExtensionRequest } from "@/lib/housing-request-list";
import type { HousingRequestTableRow } from "@/lib/housing-request-list";
import type { ReservationDtoPayload } from "@/lib/reservation-map";

type ExtendStayTabContentProps = {
  loading: boolean;
  error: string | null;
  reservation: ReservationDtoPayload | null;
  submittedRequest: HousingRequestTableRow | null;
  extendInquiryOpen: boolean;
  prefillLoading: boolean;
  onStartExtend: () => void;
};

export function ExtendStayTabContent({
  loading,
  error,
  reservation,
  submittedRequest,
  extendInquiryOpen,
  prefillLoading,
  onStartExtend,
}: ExtendStayTabContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        جاري تحميل آخر إقامة...
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-base text-destructive">
        {error}
      </p>
    );
  }

  if (!reservation) {
    return (
      <p className="rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center text-base text-muted-foreground">
        لا يوجد حجز بحالة «تم اكتمال الإقامة» لتمديده.
      </p>
    );
  }

  const showSubmittedPreview =
    submittedRequest != null && !extendInquiryOpen;
  const showExtendAction =
    !submittedRequest ||
    extendInquiryOpen ||
    canSubmitNewExtensionRequest(submittedRequest.status);

  return (
    <div className="space-y-4">
      {showSubmittedPreview ? (
        <ExtendSubmittedRequestPanel request={submittedRequest} />
      ) : null}

      {showExtendAction ? (
        <ExtendStayReservationCard
          reservation={reservation}
          loading={prefillLoading}
          extendStarted={extendInquiryOpen}
          onExtend={onStartExtend}
        />
      ) : null}
    </div>
  );
}
