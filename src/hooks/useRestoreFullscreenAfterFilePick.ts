import { useCallback } from "react";
import {
  captureFullscreenBeforeFilePick,
  restoreFullscreenAfterFilePick,
  triggerFileInputClick,
} from "@/lib/fullscreen-file-pick-restore";

/**
 * Opening the native file picker usually exits Fullscreen API mode.
 * Call `triggerFileInputClick` before `input.click()`, or `captureBeforePick` +
 * `restoreAfterPick` manually. Global listeners in `FullscreenProvider` also
 * restore fullscreen for any file input in the app.
 */
export function useRestoreFullscreenAfterFilePick() {
  const captureBeforePick = useCallback(() => {
    captureFullscreenBeforeFilePick();
  }, []);

  const restoreAfterPick = useCallback(() => {
    restoreFullscreenAfterFilePick();
  }, []);

  const trigger = useCallback((input: HTMLInputElement | null) => {
    triggerFileInputClick(input);
  }, []);

  return { captureBeforePick, restoreAfterPick, triggerFileInputClick: trigger };
}
