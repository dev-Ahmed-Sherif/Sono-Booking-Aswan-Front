"use client";

import { useRef, useCallback } from "react";
import {
  animate,
  KeyframeOptions,
  useInView,
  useIsomorphicLayoutEffect,
} from "framer-motion";

type CounterProps = {
  to: number;
  from: number;
  name?: string;
  animationOptions?: KeyframeOptions;
};

const Counter = ({ from, to, name, animationOptions }: CounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  const animateCounter = useCallback(() => {
    const element = ref.current;
    if (!element || !inView) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = String(to);
      return;
    }

    element.textContent = String(from);

    const controls = animate(from, to, {
      duration: 2.8,
      delay: 1,
      ease: "easeOut",
      ...animationOptions,
      onUpdate(value) {
        element.textContent = String(Math.round(value));
      },
    });

    return () => controls.stop();
  }, [from, to, inView, animationOptions]);

  useIsomorphicLayoutEffect(animateCounter, [animateCounter]);

  return (
    <div className="flex flex-col justify-center items-center text-xl text-center xsm:text-base font-semibold">
      <span ref={ref} aria-live="polite" />
      {name && <h2>{name}</h2>}
    </div>
  );
};

export default Counter;
