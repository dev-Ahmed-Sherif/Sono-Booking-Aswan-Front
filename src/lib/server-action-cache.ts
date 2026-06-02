/** In-flight + resolved dedupe for client-side server action calls (per tab session). */
const sessionCache = new Map<string, Promise<unknown>>();

export function oncePerSession<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = sessionCache.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().catch((err) => {
    sessionCache.delete(key);
    throw err;
  });
  sessionCache.set(key, promise);
  return promise;
}
