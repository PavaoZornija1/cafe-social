"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useMotionSafe } from "@/lib/motion";

export function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "scale";
}) {
  const { reduced, fadeUp, fadeScale } = useMotionSafe();
  const preset = variant === "scale" ? fadeScale : fadeUp;

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={preset.initial}
      whileInView={preset.whileInView}
      viewport={preset.viewport}
      transition={{ ...preset.transition, delay }}
    >
      {children}
    </motion.div>
  );
}
