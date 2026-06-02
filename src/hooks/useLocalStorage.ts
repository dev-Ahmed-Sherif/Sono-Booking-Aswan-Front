import { useCallback, useMemo } from "react";

export const useLocalStorage = (key: string) => {
  const removeItem = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing localStorage:", error);
    }
  }, [key]);

  const setItem = useCallback((value: unknown) => {
    if (typeof window === "undefined") return;
    try {
      if (value === undefined || value === null) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error setting localStorage:", error);
    }
  }, [key]);

  const getItem = useCallback(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const item = localStorage.getItem(key);
      if (!item || item === "undefined" || item === "null") {
        return undefined;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error("Error getting localStorage:", error);
      try {
        localStorage.removeItem(key);
      } catch (removeError) {
        console.error("Error removing invalid localStorage item:", removeError);
      }
      return undefined;
    }
  }, [key]);

  return useMemo(
    () => ({ getItem, setItem, removeItem }),
    [getItem, setItem, removeItem],
  );
};
