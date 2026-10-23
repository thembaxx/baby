export function readStoredValue<T extends object>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(fallback)) {
      return Array.isArray(saved) ? (saved as T) : fallback;
    }
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      return { ...fallback, ...saved };
    }
  } catch {
    // Missing, malformed, or unavailable storage uses the server-safe defaults.
  }
  return fallback;
}
