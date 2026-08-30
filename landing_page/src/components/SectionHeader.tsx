"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AnimatedBackground, type BackgroundVariant } from "./AnimatedBackground";
import { Reveal } from "./Reveal";
import { useMotionSafe } from "@/lib/motion";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
  accent?: boolean;
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
  accent = true,
}: SectionHeaderProps) {
  const alignClass = align === "center" ? "text-center mx-auto max-w-3xl" : "max-w-3xl";

  return (
    <Reveal className={alignClass}>
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2
        className={`mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl ${
          accent ? "landing-text-gradient" : "text-foreground"
        } ${className}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">{subtitle}</p>
      ) : null}
    </Reveal>
  );
}

export function SectionShell({
  id,
  children,
  className = "",
  background = "cream",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  background?: BackgroundVariant;
}) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-28 ${className}`}
    >
      <AnimatedBackground variant={background} />
      <div className="relative z-10 mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionDivider() {
  const { reduced } = useMotionSafe();

  return (
    <div className="relative mx-auto my-2 h-px max-w-6xl overflow-hidden bg-border/60">
      {!reduced ? (
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          animate={{ x: ["-100%", "400%"] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
        />
      ) : null}
    </div>
  );
}
