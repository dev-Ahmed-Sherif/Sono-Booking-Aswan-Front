import { useState, useCallback } from "react";

const useToggleState = (intialState: boolean = false) => {
  const [state, setState] = useState<boolean>(intialState);

  const toggle = useCallback(() => {
    setState((prev) => !prev);
  }, []);

  return [state, toggle] as const;
};

export default useToggleState;
