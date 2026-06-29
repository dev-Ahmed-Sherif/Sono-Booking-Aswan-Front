"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type HousingSenderDecisionKind = "approve" | "reject";

type HousingSenderDecisionDialogProps = {
  open: boolean;
  kind: HousingSenderDecisionKind | null;
  requestNumber?: string;
  note: string;
  percentage: string;
  submitting?: boolean;
  onNoteChange: (value: string) => void;
  onPercentageChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function HousingSenderDecisionDialog({
  open,
  kind,
  requestNumber,
  note,
  percentage,
  submitting = false,
  onNoteChange,
  onPercentageChange,
  onOpenChange,
  onConfirm,
}: HousingSenderDecisionDialogProps) {
  const isApprove = kind === "approve";
  const title = isApprove ? "تأكيد الموافقة على الطلب" : "تأكيد رفض الطلب";
  const inputLabel = isApprove
    ? "ملاحظات (اختياري)"
    : "سبب الرفض";
  const confirmLabel = isApprove ? "تأكيد الموافقة" : "تأكيد الرفض";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md text-right">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <DialogTitle className="w-full text-center">{title}</DialogTitle>
          {requestNumber ? (
            <p className="text-sm text-muted-foreground">
              رقم الطلب: {requestNumber}
            </p>
          ) : null}
        </DialogHeader>

        {isApprove ? (
          <div className="space-y-2">
            <Label htmlFor="housing-sender-decision-percentage">
              نسبة الخصم (%)
              <span className="text-red-500 text-xs"> *</span>
            </Label>
            <Input
              id="housing-sender-decision-percentage"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={percentage}
              onChange={(e) => onPercentageChange(e.target.value)}
              placeholder="أدخل نسبة الخصم"
              className="h-12 min-h-12 border-2 border-black text-right text-base"
              disabled={submitting}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="housing-sender-decision-note">{inputLabel}</Label>
          <Textarea
            id="housing-sender-decision-note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={
              isApprove ? "أدخل ملاحظة إن وجدت..." : "أدخل سبب الرفض..."
            }
            rows={4}
            className="resize-none text-right"
            disabled={submitting}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            className={
              isApprove
                ? "bg-brand text-brand-foreground hover:bg-brand-hover"
                : "bg-red-600 text-white hover:bg-red-700"
            }
            disabled={
              submitting ||
              (!isApprove && !note.trim()) ||
              (isApprove &&
                (!percentage.trim() ||
                  !Number.isFinite(Number(percentage)) ||
                  Number(percentage) < 0 ||
                  Number(percentage) > 100))
            }
            onClick={onConfirm}
          >
            {submitting ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
