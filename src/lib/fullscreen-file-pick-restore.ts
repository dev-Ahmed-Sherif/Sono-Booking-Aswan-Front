type ScreenfullApi = {
  isEnabled: boolean;
  isFullscreen: boolean;
  request: (element?: Element, options?: FullscreenOptions) => Promise<void>;
};

let screenfullRef: ScreenfullApi | null = null;
let wasFullscreen = false;
let focusListener: (() => void) | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let retryListener: (() => void) | null = null;

export function bindScreenfullForFilePickRestore(api: ScreenfullApi | null) {
  screenfullRef = api;
}

function clearPendingRestoreHandlers() {
  if (focusListener) {
    window.removeEventListener("focus", focusListener);
    focusListener = null;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  if (retryListener) {
    window.removeEventListener("pointerdown", retryListener);
    window.removeEventListener("keydown", retryListener);
    retryListener = null;
  }
}

function queueRetryOnNextUserGesture() {
  if (retryListener || !screenfullRef?.isEnabled) return;
  const retry = () => {
    clearPendingRestoreHandlers();
    if (!screenfullRef?.isEnabled || screenfullRef.isFullscreen) return;
    void screenfullRef.request().catch(() => {});
  };
  retryListener = retry;
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
}

export function captureFullscreenBeforeFilePick() {
  wasFullscreen = Boolean(screenfullRef?.isEnabled && screenfullRef.isFullscreen);
}

export function restoreFullscreenAfterFilePick() {
  if (!wasFullscreen) return;
  clearPendingRestoreHandlers();
  wasFullscreen = false;
  if (!screenfullRef?.isEnabled || screenfullRef.isFullscreen) return;
  void screenfullRef.request().catch(() => {
    queueRetryOnNextUserGesture();
  });
}

export function scheduleFullscreenRestoreAfterFilePick() {
  if (!wasFullscreen) return;
  clearPendingRestoreHandlers();

  const onWindowFocus = () => {
    restoreFullscreenAfterFilePick();
  };
  focusListener = onWindowFocus;
  window.addEventListener("focus", onWindowFocus, { once: true });

  fallbackTimer = setTimeout(() => {
    restoreFullscreenAfterFilePick();
  }, 1000);
}

export function triggerFileInputClick(input: HTMLInputElement | null) {
  captureFullscreenBeforeFilePick();
  scheduleFullscreenRestoreAfterFilePick();
  input?.click();
}

function isFileInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "file";
}

function onDocumentFileInputClick(event: Event) {
  if (!isFileInput(event.target)) return;
  captureFullscreenBeforeFilePick();
  scheduleFullscreenRestoreAfterFilePick();
}

function onDocumentFileInputChange(event: Event) {
  if (!isFileInput(event.target)) return;
  restoreFullscreenAfterFilePick();
}

export function installGlobalFullscreenFilePickRestore() {
  document.addEventListener("click", onDocumentFileInputClick, true);
  document.addEventListener("change", onDocumentFileInputChange, true);

  return () => {
    document.removeEventListener("click", onDocumentFileInputClick, true);
    document.removeEventListener("change", onDocumentFileInputChange, true);
    clearPendingRestoreHandlers();
    wasFullscreen = false;
  };
}
