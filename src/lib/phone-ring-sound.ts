const PHONE_RING_URL = "/phone-ring.wav";

let ringAudio: HTMLAudioElement | null = null;

/**
 * Plays incoming-call ring, looping until {@link stopPhoneRing}.
 * Retries once on autoplay failure (e.g. before overlay paint).
 */
export function playPhoneRing(): void {
  if (typeof window === "undefined") return;
  stopPhoneRing();
  const audio = new Audio(PHONE_RING_URL);
  audio.loop = true;
  ringAudio = audio;
  void audio.play().catch((err: unknown) => {
    console.warn("[video] phone ring playback failed:", err);
    window.setTimeout(() => {
      if (ringAudio !== audio) return;
      void audio.play().catch(() => {});
    }, 300);
  });
}

export function stopPhoneRing(): void {
  if (ringAudio) {
    ringAudio.pause();
    ringAudio.currentTime = 0;
    ringAudio.loop = false;
    ringAudio = null;
  }
}
