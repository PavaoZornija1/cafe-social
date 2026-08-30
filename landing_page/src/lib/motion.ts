"use client";

import { useReducedMotion } from "motion/react";

export function useMotionSafe() {
  const reduced = useReducedMotion();

  return {
    reduced: Boolean(reduced),
    fadeUp: reduced
      ? {}
      : {
          initial: { opacity: 0, y: 32 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
        },
    fadeScale: reduced
      ? {}
      : {
          initial: { opacity: 0, y: 24, scale: 0.96 },
          whileInView: { opacity: 1, y: 0, scale: 1 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
        },
    spring: { type: "spring" as const, stiffness: 380, damping: 28 },
    stagger: reduced ? 0 : 0.09,
  };
}
