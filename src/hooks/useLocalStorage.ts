export const useLocalStorage = (key: string) => {
  const removeItem = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing localStorage:", error);
    }
  };

  const setItem = (value: any) => {
    if (typeof window === "undefined") return;
    try {
      // Don't store undefined or null values
      if (value === undefined || value === null) {
        removeItem();
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error setting localStorage:", error);
      return;
    }
  };

  const getItem = () => {
    if (typeof window === "undefined") return undefined;
    try {
      const item = localStorage.getItem(key);
      // Check if item exists and is not the string "undefined" or "null"
      if (!item || item === "undefined" || item === "null") {
        return undefined;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error("Error getting localStorage:", error);
      // If parsing fails, remove the invalid item and return undefined
      try {
        localStorage.removeItem(key);
      } catch (removeError) {
        console.error("Error removing invalid localStorage item:", removeError);
      }
      return undefined;
    }
  };

  return { getItem, setItem, removeItem };
};
