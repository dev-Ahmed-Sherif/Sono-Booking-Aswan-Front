"use client";

import * as React from "react";
import { useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import Modal from "@/components/ui/model";
import { Button } from "@/components/ui/button";

import useToggleState from "@/hooks/use-toggle-state";

type AlertModalProps = {
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loadingMessage?: string;
  confirmLabel?: string;
};

const AlertModal = ({
  isOpen,
  loading,
  onClose,
  onConfirm,
  title = "هل أنت متأكد من الحذف ؟",
  description = "هذا الإجراء لا يمكن التراجع عنه",
  loadingMessage = "جاري الحذف...",
  confirmLabel = "موافق",
}: AlertModalProps) => {
  const [isMounted, setIsMounted] = React.useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent hydration mismatch - only render on client
  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      title={title}
      description={description}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="pt-6 space-x-2 flex flex-col items-center gap-4 w-full">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <p className="text-sm text-muted-foreground animate-pulse">
              {loadingMessage}
            </p>
          </div>
        )}
        {!loading && description ? (
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{description}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 justify-end w-full">
          <Button
            disabled={loading}
            variant="outline"
            onClick={onClose}
            className="min-w-[100px]"
          >
            إلغاء
          </Button>
          <Button
            disabled={loading}
            variant="destructive"
            onClick={onConfirm}
            className="min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingMessage}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AlertModal;
