const STORAGE_KEY = "sono-notification-sound-enabled";
const DEFAULT_DURATION_MS = 21_000;
const CHIME_INTERVAL_MS = 2_000;
const SOUND_URLS = ["/sounds/notification.wav", "/sounds/notification.mp3"];

/** Minimal silent WAV used to satisfy browser autoplay unlock. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let activeStop: (() => void) | null = null;
let webAudioStop: (() => void) | null = null;
let audioUnlocked = false;
let pendingPlay = false;
let pendingDurationMs = DEFAULT_DURATION_MS;
let sharedAudioContext: AudioContext | null = null;
let unlockInitialized = false;
const unlockWaiters: Array<() => void> = [];

/** Runs `callback` once browser audio is unlocked (immediately if already unlocked). */
export function whenAudioUnlocked(callback: () => void): void {
  if (audioUnlocked) {
    callback();
    return;
  }
  unlockWaiters.push(callback);
  initNotificationSoundUnlock();
}

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function isNotificationSoundUnlocked(): boolean {
  return audioUnlocked;
}

export function stopNotificationSound(): void {
  activeStop?.();
  activeStop = null;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextCtor();
  }

  return sharedAudioContext;
}

/** Unlocks HTML audio after a user gesture (also resumes Web Audio if needed). */
export function unlockAudioFromUserGesture(): void {
  void unlockAudio();
}

async function unlockAudio(): Promise<void> {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    await ctx.resume().catch(() => {});
  }

  const silent = new Audio(SILENT_WAV);
  silent.volume = 0.001;
  await silent.play().catch(() => {});

  if (pendingPlay) {
    pendingPlay = false;
    playNotificationSound(pendingDurationMs);
  }

  const waiters = unlockWaiters.splice(0);
  waiters.forEach((callback) => callback());
}

/** Call once on app mount; unlocks audio on first user gesture. */
export function initNotificationSoundUnlock(): () => void {
  if (typeof window === "undefined" || unlockInitialized) {
    return () => {};
  }

  unlockInitialized = true;

  const onGesture = () => {
    void unlockAudio();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const events = ["pointerdown", "keydown", "touchstart"] as const;

  events.forEach((event) => {
    document.addEventListener(event, onGesture, opts);
  });

  return () => {
    events.forEach((event) => {
      document.removeEventListener(event, onGesture, opts);
    });
    unlockInitialized = false;
  };
}

function startWebAudioChime(durationMs: number): () => void {
  const ctx = getAudioContext();
  if (!ctx) {
    return () => {};
  }

  let stopped = false;
  let intervalId = 0;
  let timeoutId = 0;

  const playChime = () => {
    if (stopped || ctx.state === "closed") return;

    const now = ctx.currentTime;
    const ringDuration = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.52, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ringDuration);
    gain.connect(ctx.destination);

    // Match WAV bell: G6 fundamental + inharmonic partials (higher pitch)
    [1567.98, 3135.96, 3935.61].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      osc.start(now + index * 0.06);
      osc.stop(now + ringDuration);
    });
  };

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
  };

  void ctx.resume().then(() => {
    if (stopped) return;
    playChime();
    intervalId = window.setInterval(playChime, CHIME_INTERVAL_MS);
  });

  timeoutId = window.setTimeout(cleanup, durationMs);

  return cleanup;
}

function playWithWebAudio(durationMs: number): void {
  webAudioStop = startWebAudioChime(durationMs);

  activeStop = () => {
    webAudioStop?.();
    webAudioStop = null;
  };
}

function playWithHtmlAudio(url: string, durationMs: number, urlIndex: number): void {
  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0.72;

  const timeoutId = window.setTimeout(stopNotificationSound, durationMs);

  activeStop = () => {
    window.clearTimeout(timeoutId);
    audio.pause();
    audio.currentTime = 0;
    webAudioStop?.();
    webAudioStop = null;
  };

  audio.addEventListener(
    "error",
    () => {
      const nextUrl = SOUND_URLS[urlIndex + 1];
      if (nextUrl) {
        stopNotificationSound();
        playWithHtmlAudio(nextUrl, durationMs, urlIndex + 1);
        return;
      }
      stopNotificationSound();
      playWithWebAudio(durationMs);
    },
    { once: true },
  );

  void audio.play().catch(() => {
    const nextUrl = SOUND_URLS[urlIndex + 1];
    if (nextUrl) {
      stopNotificationSound();
      playWithHtmlAudio(nextUrl, durationMs, urlIndex + 1);
      return;
    }
    stopNotificationSound();
    playWithWebAudio(durationMs);
  });
}

/** Plays a notification alert for up to `durationMs` (default 21s). */
export function playNotificationSound(durationMs = DEFAULT_DURATION_MS): void {
  if (typeof window === "undefined" || !isNotificationSoundEnabled()) return;

  if (!audioUnlocked) {
    pendingPlay = true;
    pendingDurationMs = durationMs;
    initNotificationSoundUnlock();
    return;
  }

  stopNotificationSound();
  playWithHtmlAudio(SOUND_URLS[0], durationMs, 0);
}
