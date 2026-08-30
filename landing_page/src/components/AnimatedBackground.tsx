"use client";

import { motion } from "motion/react";
import { useMotionSafe } from "@/lib/motion";

export type BackgroundVariant = "hero" | "cream" | "surface" | "muted" | "dark";

type Orb = {
  className: string;
  x: [number, number, number];
  y: [number, number, number];
  duration: number;
  delay?: number;
};

const variantConfig: Record<
  BackgroundVariant,
  { baseClass: string; meshClass?: string; grid?: boolean; orbs: Orb[] }
> = {
  hero: {
    baseClass: "bg-background",
    meshClass: "landing-mesh-hero",
    grid: true,
    orbs: [
      {
        className: "left-[-8%] top-[8%] h-80 w-80 bg-primary/24",
        x: [0, 52, 0],
        y: [0, -38, 0],
        duration: 20,
      },
      {
        className: "right-[-6%] top-[18%] h-72 w-72 bg-honey/20",
        x: [0, -44, 0],
        y: [0, 30, 0],
        duration: 24,
        delay: 1.2,
      },
      {
        className: "bottom-[6%] left-[22%] h-64 w-64 bg-primary/16",
        x: [0, 34, 0],
        y: [0, 26, 0],
        duration: 18,
        delay: 0.6,
      },
    ],
  },
  cream: {
    baseClass: "bg-background",
    meshClass: "landing-mesh-cream",
    orbs: [
      {
        className: "right-[8%] top-[12%] h-64 w-64 bg-primary/14",
        x: [0, -30, 0],
        y: [0, 22, 0],
        duration: 22,
      },
      {
        className: "bottom-[10%] left-[4%] h-56 w-56 bg-honey/12",
        x: [0, 26, 0],
        y: [0, -20, 0],
        duration: 26,
        delay: 1.5,
      },
    ],
  },
  surface: {
    baseClass: "bg-surface",
    meshClass: "landing-mesh-surface",
    orbs: [
      {
        className: "left-[-4%] top-[20%] h-72 w-72 bg-primary/12",
        x: [0, 38, 0],
        y: [0, -26, 0],
        duration: 23,
      },
      {
        className: "right-[6%] bottom-[8%] h-60 w-60 bg-honey/10",
        x: [0, -32, 0],
        y: [0, 18, 0],
        duration: 28,
        delay: 1,
      },
    ],
  },
  muted: {
    baseClass: "bg-surface-muted",
    meshClass: "landing-mesh-muted",
    orbs: [
      {
        className: "left-[10%] top-[8%] h-80 w-80 bg-primary/16",
        x: [0, 42, 0],
        y: [0, 32, 0],
        duration: 21,
      },
      {
        className: "right-[4%] bottom-[12%] h-72 w-72 bg-honey/14",
        x: [0, -38, 0],
        y: [0, -24, 0],
        duration: 25,
        delay: 1.4,
      },
    ],
  },
  dark: {
    baseClass: "bg-primary-dark",
    meshClass: "landing-mesh-dark",
    orbs: [
      {
        className: "left-[-10%] top-[10%] h-96 w-96 bg-primary/32",
        x: [0, 46, 0],
        y: [0, -34, 0],
        duration: 22,
      },
      {
        className: "right-[-8%] bottom-[6%] h-80 w-80 bg-honey/22",
        x: [0, -40, 0],
        y: [0, 28, 0],
        duration: 26,
        delay: 1.2,
      },
    ],
  },
};

function FloatingOrb({ orb, reduced }: { orb: Orb; reduced: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${orb.className}`}
      animate={reduced ? undefined : { x: orb.x, y: orb.y }}
      transition={{
        duration: orb.duration,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay: orb.delay ?? 0,
      }}
    />
  );
}

export function AnimatedBackground({ variant }: { variant: BackgroundVariant }) {
  const { reduced } = useMotionSafe();
  const config = variantConfig[variant];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${config.baseClass}`}
    >
      {config.meshClass ? (
        <div className={`absolute inset-0 ${config.meshClass} ${reduced ? "" : "landing-mesh-animate"}`} />
      ) : null}
      {config.grid ? (
        <div
          className={`landing-grid-dots absolute inset-0 opacity-50 ${reduced ? "" : "landing-grid-animate"}`}
        />
      ) : null}
      {config.orbs.map((orb, index) => (
        <FloatingOrb key={`${variant}-${index}`} orb={orb} reduced={reduced} />
      ))}
    </div>
  );
}
