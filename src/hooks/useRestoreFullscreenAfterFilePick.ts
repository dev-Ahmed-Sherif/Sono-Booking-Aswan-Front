import { useRef } from "react";

function isDocumentFullscreen(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
  };
  return !!(
    document.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement
  );
}

function isFullscreenApiAvailable(): boolean {
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
  };
  return !!(
    document.fullscreenEnabled ??
    doc.webkitFullscreenEnabled ??
    doc.mozFullScreenEnabled
  );
}

async function requestFullscreenOnElement(el: Element): Promise<void> {
  const anyEl = el as Element & {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => void;
    mozRequestFullScreen?: () => void;
  };
  if (typeof anyEl.requestFullscreen === "function") {
    await anyEl.requestFullscreen();
  } else if (typeof anyEl.webkitRequestFullscreen === "function") {
    anyEl.webkitRequestFullscreen();
  } else if (typeof anyEl.mozRequestFullScreen === "function") {
    anyEl.mozRequestFullScreen();
  }
}

/**
 * Opening the native file picker usually exits Fullscreen API mode.
 * Call `captureBeforePick` (or `triggerFileInputClick`) right before `input.click()`,
 * then `restoreAfterPick` from the input's `onChange` after a file was chosen.
 *
 * Restoration may be blocked by the browser if it no longer considers the chain a user gesture.
 */
export function useRestoreFullscreenAfterFilePick() {
  const wasFullscreenRef = useRef(false);
  const focusListenerRef = useRef<(() => void) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryListenerRef = useRef<(() => void) | null>(null);

  const clearPendingRestoreHandlers = () => {
    if (focusListenerRef.current) {
      window.removeEventListener("focus", focusListenerRef.current);
      focusListenerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (retryListenerRef.current) {
      window.removeEventListener("pointerdown", retryListenerRef.current);
      window.removeEventListener("keydown", retryListenerRef.current);
      retryListenerRef.current = null;
    }
  };

  const queueRetryOnNextUserGesture = () => {
    if (retryListenerRef.current) return;
    const retry = () => {
      if (!isFullscreenApiAvailable()) return;
      clearPendingRestoreHandlers();
      void requestFullscreenOnElement(document.documentElement).catch(() => {});
    };
    retryListenerRef.current = retry;
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
  };

  const captureBeforePick = () => {
    wasFullscreenRef.current = isDocumentFullscreen();
  };

  const restoreAfterPick = () => {
    if (!wasFullscreenRef.current) return;
    clearPendingRestoreHandlers();
    wasFullscreenRef.current = false;
    if (!isFullscreenApiAvailable()) return;
    void requestFullscreenOnElement(document.documentElement).catch(() => {
      // If blocked after file-picker close, retry on the next real user gesture.
      queueRetryOnNextUserGesture();
    });
  };

  const triggerFileInputClick = (input: HTMLInputElement | null) => {
    captureBeforePick();
    clearPendingRestoreHandlers();

    // If the user cancels the picker, input onChange may not fire.
    // Browsers usually return focus to the page after picker closes.
    if (wasFullscreenRef.current) {
      const onWindowFocus = () => {
        restoreAfterPick();
      };
      focusListenerRef.current = onWindowFocus;
      window.addEventListener("focus", onWindowFocus, { once: true });

      // Safety net in case focus event isn't delivered by the browser.
      fallbackTimerRef.current = setTimeout(() => {
        restoreAfterPick();
      }, 1000);
    }

    input?.click();
  };

  return { captureBeforePick, restoreAfterPick, triggerFileInputClick };
}
